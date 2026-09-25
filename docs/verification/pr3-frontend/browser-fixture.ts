// Isolated in-memory visual fixture. Never connects to OneBot or a real model.

import { createQqScheme } from "../../../src/server/db/qq-scheme-repository.ts";
import { updateQqSettings } from "../../../src/server/db/qq-settings-repository.ts";
import { DEFAULT_AGENT_ID, ensureDefaults } from "../../../src/server/db/repositories.ts";
import { openBusinessDb } from "../../../src/server/db/schema-gate.ts";
import { createRuntime } from "../../../src/server/runtime.ts";

const b = openBusinessDb();
ensureDefaults(b.orm, "fixture");
updateQqSettings(b.orm, { accountId: "10001", enabled: true, expectedRevision: 1 });
const scheme = createQqScheme(b.orm, {
  name: "group",
  reply: { split_by_speaker: true },
  triggers: { direct_reply: true, follow_up: true, chiming_in: true, idle_topic: true },
});
const at = new Date().toISOString(),
  sec = Math.floor(Date.now() / 1000),
  binding = "11111111-1111-4111-8111-111111111111";
b.db
  .query(
    "INSERT INTO qq_bindings(id,account_id,conversation_kind,peer_id,agent_id,scheme_id,created_at,updated_at) VALUES(?,'10001','group','30003',?,?,?,?)",
  )
  .run(binding, DEFAULT_AGENT_ID, scheme.id, at, at);
for (const [i, id] of ["20002000000001", "20003000000002"].entries()) {
  b.db
    .query(
      "INSERT INTO qq_events(event_key,account_id,conversation_kind,peer_id,agent_id,message_id,occurred_at_seconds,speaker_kind,speaker_id,recorded_at,addressed) VALUES(?,'10001','group','30003',?,?,?,'member',?,?,1)",
    )
    .run("msg" + i, DEFAULT_AGENT_ID, "" + i, sec, id, at);
  b.db
    .query(
      "INSERT INTO qq_observation_text(event_key,body,occurred_at_seconds,expires_at,recorded_at) VALUES(?,?,?,?,?)",
    )
    .run("msg" + i, "hello", sec, new Date(Date.now() + 86400000).toISOString(), at);
}
const gateway: any = {
  config: { baseUrl: "http://unused.invalid", model: "fixture", timeoutSeconds: 1 },
  listModels: async () => ["fixture"],
  loadedContextCapacity: async () => 65536,
  probeModelLoaded: async () => true,
  complete: async () =>
    JSON.stringify({
      kind: "final",
      outputs: ["20002000000001", "20003000000002"].map((targetId) => ({
        kind: "generate",
        targetId,
        instructions: "answer",
      })),
    }),
  async *streamChat() {
    yield "这是第一段已确认的回复。\n这是第二段回复。";
  },
};

import path from "node:path";
import { ConversationEventRepository } from "../../../src/server/db/conversation-event-repository.ts";
import { createSession } from "../../../src/server/db/repositories.ts";
import { WakeRepository } from "../../../src/server/db/wake-repository.ts";
import { isApiPath } from "../../../src/shared/api-routes.ts";

let sends = 0;
const intake: any = {
  state: { phase: "ready" },
  connection: {
    send: async () =>
      ++sends === 2
        ? { kind: "unknown", reason: "disconnected" }
        : { kind: "confirmed", messageId: "synthetic-" + sends },
  },
  start: async () => {},
  stop() {
    this.state = { phase: "closed" };
  },
};
const runtime = createRuntime({
  business: b,
  gateway,
  qqIntake: intake,
  browserStateSecret: "synthetic-pr3-browser",
});
const journal = new ConversationEventRepository(b.db);
const conversation = journal.ensureOneBot(binding)!;
b.db.query("UPDATE conversation_events SET addressing=? WHERE kind='inbound'").run(
  JSON.stringify({
    reasons: ["mention", "reply_to_agent"],
    mentionIds: ["10001"],
    replyTo: { sourceId: "synthetic-previous", participantId: "10001" },
  }),
);
for (const id of ["20002000000001", "20003000000002"])
  b.db
    .query("UPDATE conversation_events SET participant=? WHERE json_extract(participant,'$.id')=?")
    .run(JSON.stringify({ id, label: "同名成员", role: "member" }), id);
await runtime.botWorker.runCycle();
const wakes = new WakeRepository(b.db);
const wake = wakes.enqueue({
  conversationId: conversation.id,
  cause: "chiming_in",
  throughSeq: journal.get(conversation.id)!.lastSeq,
  dedupeKey: "synthetic-no-output",
  readyAt: new Date().toISOString(),
  priority: 0,
});
// Synthetic historical state used only to exercise projection of a completed silent wake.
b.db.query("UPDATE wake_signals SET status='no_output' WHERE id=?").run(wake.id);
const old = new Date(Date.now() - 15 * 86400000).toISOString();
journal.append({
  conversationId: conversation.id,
  eventKey: "synthetic-expired",
  kind: "inbound",
  source: { kind: "qq_observation", id: "synthetic-expired", revision: "1", expiresAt: old },
  occurredAt: old,
  participant: { id: "20002000000001", label: "同名成员", role: "member" },
});
createSession(b.orm, "网页会话 · 同一 AgentRuntime", { modelName: "fixture" });
// Later Web requests use the same production AgentRuntime with a synthetic model target.
gateway.complete = async () =>
  JSON.stringify({
    kind: "final",
    outputs: [{ kind: "generate", targetId: "reply", instructions: "answer" }],
  });
const root = path.resolve(import.meta.dir, "../../../dist/web");
runtime.app.get("*", async (c) => {
  const pathname = new URL(c.req.url).pathname;
  if (isApiPath(pathname)) return c.notFound();
  const file = path.resolve(root, pathname === "/" ? "index.html" : pathname.slice(1));
  if (!file.startsWith(root + "/")) return c.notFound();
  const f = Bun.file(file);
  return (await f.exists()) ? new Response(f) : c.notFound();
});
const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: runtime.app.fetch });
console.log(
  JSON.stringify({
    url: server.url.toString(),
    conversationId: conversation.id,
    sends,
    deliveries: b.db.query("SELECT status FROM outbound_intents ORDER BY output_ordinal").all(),
  }),
);
