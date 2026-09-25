import { afterEach, describe, expect, it } from "bun:test";
import { AgentRuntime } from "../../src/server/agent/agent-runtime";
import type { ModelPort, ModelRequest } from "../../src/server/agent/model-port";
import { OneBot11Adapter } from "../../src/server/channels/onebot11/adapter";
import { OneBotPrivateHost } from "../../src/server/channels/onebot11/private-host";
import { OutboundDelivery } from "../../src/server/conversation/outbound-delivery";
import { WakeScheduler } from "../../src/server/conversation/wake-scheduler";
import { AgentRunRepository } from "../../src/server/db/agent-run-repository";
import { ConversationEventRepository } from "../../src/server/db/conversation-event-repository";
import { OutboundIntentRepository } from "../../src/server/db/outbound-intent-repository";
import { WakeRepository } from "../../src/server/db/wake-repository";
import { createQqScheme } from "../../src/server/db/qq-scheme-repository";
import { updateQqSettings } from "../../src/server/db/qq-settings-repository";
import { DEFAULT_AGENT_ID, ensureDefaults } from "../../src/server/db/repositories";
import * as schema from "../../src/server/db/schema";
import { openBusinessDb } from "../../src/server/db/schema-gate";
import type { ModelGateway } from "../../src/server/llm/model-gateway";
import { recordInbound } from "../../src/server/services/qq-intake";
import { normalizeOneBotMessage } from "../../src/server/services/onebot-protocol";
import {
  peekQqImmediateReplyTask,
  nextQqImmediateReplyTask,
} from "../../src/server/services/qq-dispatch";
const handles: ReturnType<typeof openBusinessDb>[] = [];
afterEach(() => {
  for (const h of handles.splice(0)) h.close();
});
const bindingId = "11111111-1111-4111-8111-111111111111",
  nowSeconds = 2_000_000_000;
function setup(model?: Partial<ModelPort>) {
  const h = openBusinessDb();
  handles.push(h);
  ensureDefaults(h.orm, "chat-model");
  updateQqSettings(h.orm, { accountId: "10001", enabled: true, expectedRevision: 1 });
  const scheme = createQqScheme(h.orm, {
    name: "test",
    reply: { split_by_speaker: false },
    triggers: { direct_reply: true, follow_up: true, chiming_in: true, idle_topic: true },
  });
  h.orm
    .insert(schema.qqBindings)
    .values({
      id: bindingId,
      accountId: "10001",
      conversationKind: "private",
      peerId: "20002",
      agentId: DEFAULT_AGENT_ID,
      schemeId: scheme.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .run();
  const journal = new ConversationEventRepository(h.db),
    wakes = new WakeRepository(h.db),
    outbox = new OutboundIntentRepository(h.db),
    runs = new AgentRunRepository(h.db);
  const requests: ModelRequest[] = [];
  const runtime = new AgentRuntime({
    repository: runs,
    now: () => new Date(nowSeconds * 1000).toISOString(),
    model: {
      complete: async (req) => {
        requests.push(req);
        return '{"kind":"final","outputs":[{"kind":"generate","targetId":"20002","instructions":"answer"}]}';
      },
      async *streamText(req) {
        requests.push(req);
        yield "first\nsecond";
      },
      completeMultimodal: async () => "",
      ...model,
    },
  });
  const gateway = {
    loadedContextCapacity: async () => 65536,
    complete: async () => {
      throw new Error("DIRECT_GATEWAY_FORBIDDEN");
    },
  } as unknown as ModelGateway;
  const adapter = new OneBot11Adapter({ orm: h.orm, journal, wakes, nowSeconds: () => nowSeconds });
  const host = new OneBotPrivateHost({
    orm: h.orm,
    journal,
    wakes,
    outbox,
    gateway,
    agentRuntime: runtime,
    stickers: { counts: ["confirmed"], isAvailable: () => false },
    policy: () => ({ maxSteps: 12, deliveryTtlSeconds: 600, retentionDays: 14 }),
    now: () => new Date(nowSeconds * 1000).toISOString(),
  });
  const receive = (id: string, text = "hello") =>
    recordInbound(
      h.orm,
      normalizeOneBotMessage(
        {
          post_type: "message",
          message_type: "private",
          sub_type: "friend",
          time: nowSeconds,
          self_id: 10001,
          user_id: 20002,
          message_id: id,
          message: [{ type: "text", data: { text } }],
          sender: { nickname: "Peer" },
        },
        "10001",
      ),
      { accountId: "10001", conversationIngress: adapter },
    );
  return { ...h, journal, wakes, outbox, runs, runtime, requests, adapter, host, receive, scheme };
}
describe("OneBot private common host", () => {
  it("atomically journals intake and wake, runs decide/generate, commits intent before any send and preserves multipart", async () => {
    const h = setup();
    expect(h.receive("1")).toMatchObject({ kind: "recorded", recorded: true });
    h.receive("1");
    const conversation = h.journal.ensureOneBot(bindingId)!;
    expect(h.journal.eventsAfter(conversation.id).items).toHaveLength(1);
    const scheduler = new WakeScheduler({
      repository: h.wakes,
      policy: () => ({ leaseMs: 120000, renewMs: 30000, maxAttempts: 3, retryDelayMs: 1000 }),
      activate: (w, s) => h.host.activate(w, s),
      now: () => new Date(nowSeconds * 1000).toISOString(),
      onError: (e) => {
        throw e;
      },
    });
    expect(await scheduler.runOnce()).toBe(true);
    const intents = h.outbox.list({ conversationId: conversation.id });
    expect(intents).toHaveLength(1);
    expect(h.outbox.parts(intents[0]!.id).map((p) => JSON.parse(p.payload!))).toEqual([
      { text: "first" },
      { text: "second" },
    ]);
    expect(h.journal.get(conversation.id)!.consumedSeq).toBe(1);
    expect(h.db.query("SELECT * FROM qq_send_log").all()).toEqual([]);
    expect(h.requests).toHaveLength(2);
    expect(h.requests[0]!.messages[0]!.content).not.toEqual(h.requests[1]!.messages[0]!.content);
    expect(
      h.db.query("SELECT status FROM agent_runs WHERE spec_id='onebot.private.main'").get(),
    ).toEqual({ status: "completed" });
  });
  it("re-enters deciding for a same-second inbound message during generation", async () => {
    let receive: ReturnType<typeof setup>["receive"];
    let decisions = 0,
      generations = 0;
    const h = setup({
      complete: async () => {
        decisions++;
        return '{"kind":"final","outputs":[{"kind":"generate","targetId":"20002","instructions":"answer"}]}';
      },
      async *streamText() {
        generations++;
        if (generations === 1) receive("2", "new same second");
        yield generations === 1 ? "old draft" : "new draft";
      },
    });
    receive = h.receive;
    receive("1");
    const wake = h.wakes.claim({ at: new Date(nowSeconds * 1000).toISOString(), leaseMs: 120000 })!;
    await h.host.activate(wake, new AbortController().signal);
    expect(decisions).toBe(2);
    expect(generations).toBe(2);
    expect(h.outbox.list({})).toHaveLength(1);
    expect(JSON.parse(h.outbox.parts(h.outbox.list({})[0]!.id)[0]!.payload!)).toEqual({
      text: "new draft",
    });
  });
  it("group-only legacy selection cannot consume a private wake", () => {
    const h = setup();
    h.receive("1");
    expect(peekQqImmediateReplyTask(h.orm, { nowSeconds }, ["group"])).toBeNull();
    expect(nextQqImmediateReplyTask(h.orm, { nowSeconds }, ["group"])).toBeNull();
    expect(
      h.wakes.peek({ at: new Date(nowSeconds * 1000).toISOString(), topology: "direct" })?.cause,
    ).toBe("direct_reply");
  });
  it("rolls back observation when journal/queue write fails", () => {
    const h = setup();
    h.db.exec(
      "CREATE TRIGGER fixture_fail BEFORE INSERT ON wake_signals BEGIN SELECT RAISE(ABORT,'fixture'); END",
    );
    expect(h.receive("1")).toMatchObject({ kind: "discarded" });
    expect(h.db.query("SELECT * FROM qq_events").all()).toEqual([]);
    expect(h.db.query("SELECT * FROM conversation_events").all()).toEqual([]);
  });
});
describe("durable per-part delivery", () => {
  async function prepared() {
    const h = setup();
    h.receive("1");
    const wake = h.wakes.claim({ at: new Date(nowSeconds * 1000).toISOString(), leaseMs: 120000 })!;
    await h.host.activate(wake, new AbortController().signal);
    return { ...h, id: h.outbox.list({})[0]!.id };
  }
  it("writes sending before network, projects receipts once, appends delivery revisions", async () => {
    const h = await prepared();
    let sends = 0;
    const delivery = new OutboundDelivery({
      orm: h.orm,
      repository: h.outbox,
      journal: h.journal,
      stickerFile: () => null,
      authorize: () => true,
      now: () => new Date(nowSeconds * 1000).toISOString(),
      port: {
        async send() {
          sends++;
          expect(h.outbox.parts(h.id).filter((p) => p.status === "sending")).toHaveLength(1);
          return { kind: "confirmed", messageId: String(sends) };
        },
      },
    });
    await delivery.deliver(h.id);
    await delivery.deliver(h.id);
    expect(sends).toBe(2);
    expect(h.outbox.get(h.id)!.status).toBe("confirmed");
    expect(h.db.query("SELECT COUNT(*) AS n FROM qq_send_log").get()).toEqual({ n: 1 });
    expect(h.db.query("SELECT body FROM qq_speech_text").get()).toEqual({ body: "first\nsecond" });
    expect(
      h.journal
        .eventsAfter(h.outbox.get(h.id)!.conversationId)
        .items.filter((e) => e.kind === "delivery").length,
    ).toBeGreaterThan(2);
  });
  it("unknown receipt never sends later parts or resends after restart", async () => {
    const h = await prepared();
    let sends = 0;
    const delivery = new OutboundDelivery({
      orm: h.orm,
      repository: h.outbox,
      journal: h.journal,
      stickerFile: () => null,
      authorize: () => true,
      now: () => new Date(nowSeconds * 1000).toISOString(),
      port: {
        async send() {
          sends++;
          return { kind: "unknown", reason: "timeout" };
        },
      },
    });
    await delivery.deliver(h.id);
    delivery.recover();
    await delivery.runOnce();
    expect(sends).toBe(1);
    expect(h.outbox.get(h.id)!.parts.map((p) => p.status)).toEqual(["unknown", "not_sent"]);
    expect(h.db.query("SELECT * FROM qq_speech_text").all()).toEqual([]);
  });
  it("crash between parts retains confirmed text and makes obsolete unsent tail stale", async () => {
    const h = await prepared();
    const at = new Date(nowSeconds * 1000).toISOString();
    const first = h.outbox.claimPart(h.id, at)!;
    h.outbox.settlePart(first.part.id, { status: "confirmed", messageId: "delivered" }, at);
    let sends = 0,
      stale = 0;
    const delivery = new OutboundDelivery({
      orm: h.orm,
      repository: h.outbox,
      journal: h.journal,
      stickerFile: () => null,
      authorize: () => true,
      onStale: () => {
        stale++;
      },
      now: () => new Date((nowSeconds + 601) * 1000).toISOString(),
      port: {
        async send() {
          sends++;
          return { kind: "confirmed", messageId: "should-not-send" };
        },
      },
    });
    delivery.recover();
    await delivery.runOnce();
    expect(sends).toBe(0);
    expect(stale).toBe(1);
    expect(h.outbox.get(h.id)!.parts.map((p) => p.status)).toEqual(["confirmed", "stale"]);
    expect(h.db.query("SELECT body FROM qq_speech_text").get()).toBeNull();
    expect(
      h.outbox.partialSpeechSince(h.outbox.get(h.id)!.conversationId, {
        sinceSeconds: nowSeconds - 1,
        limit: 10,
        at,
      }),
    ).toMatchObject([{ text: "first" }]);
    await delivery.runOnce();
    expect(h.db.query("SELECT COUNT(*) AS n FROM qq_send_log").get()).toEqual({ n: 1 });
  });
});
