import { afterEach, describe, expect, it } from "bun:test";
import { createAgentRuntime } from "../../src/server/agent/agent-runtime";
import type { AgentSpec } from "../../src/server/agent/agent-specs";
import { ContextEngine } from "../../src/server/agent/context-engine";
import { BotContextSource } from "../../src/server/channels/onebot11/context-source";
import { AgentRunRepository } from "../../src/server/db/agent-run-repository";
import { ConversationEventRepository } from "../../src/server/db/conversation-event-repository";
import { KnowledgeRepository } from "../../src/server/db/knowledge-repository";
import { OutboundIntentRepository } from "../../src/server/db/outbound-intent-repository";
import { insertQqBinding } from "../../src/server/db/qq-binding-repository";
import { createQqScheme } from "../../src/server/db/qq-scheme-repository";
import { updateQqSettings } from "../../src/server/db/qq-settings-repository";
import {
  DEFAULT_AGENT_ID,
  DEFAULT_USER_ID,
  ensureDefaults,
  getAgentRow,
} from "../../src/server/db/repositories";
import * as schema from "../../src/server/db/schema";
import { openBusinessDb } from "../../src/server/db/schema-gate";
import type { ModelGateway } from "../../src/server/llm/model-gateway";
import {
  captureQqTask,
  createQqBinding,
  qqConversationKey,
  qqConversationScope,
  qqMemoryScopeKey,
} from "../../src/server/services/qq-binding-contract";
import { QQ_CONTEXT_DEFAULT } from "../../src/server/services/qq-context-contract";
import { QQ_MEDIA_RULE } from "../../src/server/services/qq-prompt-contract";
import { runtimeFromAgent } from "../../src/server/services/runtime-config";

const handles: ReturnType<typeof openBusinessDb>[] = [];
afterEach(() => {
  for (const h of handles.splice(0)) h.close();
});
function setup(input: { decisionTier?: "judgement" | "reply"; tokenBudget?: number } = {}) {
  const h = openBusinessDb();
  handles.push(h);
  ensureDefaults(h.orm, "reply-model");
  const seconds = Math.floor(Date.now() / 1000),
    now = new Date(seconds * 1000).toISOString();
  updateQqSettings(h.orm, { enabled: true, accountId: "10001", expectedRevision: 1 });
  const scheme = createQqScheme(h.orm, {
    name: "context",
    ...(input.tokenBudget
      ? { context: { ...QQ_CONTEXT_DEFAULT, reply_token_budget: input.tokenBudget } }
      : {}),
  });
  const created = createQqBinding({
    id: crypto.randomUUID(),
    accountId: "10001",
    kind: "group",
    peerId: "30003",
    agentId: DEFAULT_AGENT_ID,
    schemeId: scheme.id,
    paused: false,
    shareWebMemory: false,
  });
  if (created.kind !== "saved") throw new Error("binding");
  const binding = insertQqBinding(h.orm, created.binding);
  const capture = captureQqTask(binding, "reply");
  if (capture.kind !== "captured") throw new Error("snapshot");
  const row = getAgentRow(h.orm, DEFAULT_AGENT_ID);
  if (!row) throw new Error("agent");
  const runtime = runtimeFromAgent(row);
  runtime.p5_config.retrieval_mode = "off";
  const journal = new ConversationEventRepository(h.db),
    outbox = new OutboundIntentRepository(h.db);
  const conversation = journal.ensureOneBot(binding.id);
  if (!conversation) throw new Error("conversation");
  const calls: Parameters<ModelGateway["complete"]>[0][] = [];
  const gateway: ModelGateway = {
    config: { baseUrl: "http://unused.invalid", model: "reply-model", timeoutSeconds: 1 },
    listModels: async () => [],
    probeModelLoaded: async () => true,
    loadedContextCapacity: async () => 65536,
    async complete(request) {
      calls.push(request);
      const data = JSON.parse(request.messages[1].content);
      if (data.events)
        return JSON.stringify({
          facts: [
            ...(data.previous_overview?.facts ?? []),
            ...data.events.map((event: { id: string; speaker: string }) => ({
              kind: "fact",
              speaker: event.speaker,
              text: "old fact",
              source_ids: [event.id],
            })),
          ],
        });
      return JSON.stringify({
        ids: data.candidates.map((candidate: { id: string }) => candidate.id),
      });
    },
    async *streamChat() {
      yield "unused";
    },
  };
  const runs = new AgentRunRepository(h.db),
    agentRuntime = createAgentRuntime({ gateway, repository: runs });
  const spec: AgentSpec = {
    id: "test.bot",
    model: input.decisionTier === "judgement" ? "judge-model" : "reply-model",
    context: "conversation",
    instructions: QQ_MEDIA_RULE,
    availableActions: [],
    limits: { steps: 16 },
  };
  const diagnostics: unknown[] = [];
  const source = new BotContextSource({
    ...h,
    gateway,
    agentRuntime,
    journal,
    outbox,
    conversationId: conversation.id,
    binding,
    snapshot: capture.snapshot,
    scheme,
    runtime,
    spec,
    path: "direct_reply",
    decisionTier: input.decisionTier ?? "reply",
    targets: () => [
      { id: "alice", speakerId: "20002" },
      { id: "bob", speakerId: "20003" },
    ],
    assertCurrent() {},
    now: () => now,
    onDiagnostic: (event) => diagnostics.push(event),
  });
  spec.availableActions = source.actions.map((action) => action.description);
  const seed = (text: string, age = 0, peer = "30003") => {
    const id = crypto.randomUUID();
    h.orm
      .insert(schema.qqEvents)
      .values({
        eventKey: id,
        accountId: "10001",
        conversationKind: "group",
        peerId: peer,
        agentId: DEFAULT_AGENT_ID,
        messageId: id,
        occurredAtSeconds: seconds - age,
        speakerKind: "member",
        speakerId: "20002",
        recordedAt: now,
      })
      .run();
    h.orm
      .insert(schema.qqObservationText)
      .values({
        eventKey: id,
        body: text,
        occurredAtSeconds: seconds - age,
        expiresAt: new Date((seconds + 3600) * 1000).toISOString(),
        recordedAt: now,
      })
      .run();
    if (peer === "30003") journal.ingestOneBotEvent(id, binding.id);
    return id;
  };
  const memory = (body: string, peer = "30003") => {
    const id = seed(body, 20, peer),
      key = qqMemoryScopeKey({ ...qqConversationScope(binding), peerId: peer });
    h.orm
      .insert(schema.memoryEntries)
      .values({
        id,
        agentId: DEFAULT_AGENT_ID,
        userId: DEFAULT_USER_ID,
        name: body,
        summary: body,
        tags: "[]",
        kinds: '["semantic"]',
        body,
        scope: "reality_user",
        scopeKey: key,
        status: "active",
        configSnapshot: "{}",
        createdAt: now,
      })
      .run();
    h.orm
      .insert(schema.qqMemorySources)
      .values({
        memoryId: id,
        eventKey: id,
        scopeKey: key,
        conversationKey: qqConversationKey({ accountId: "10001", kind: "group", peerId: peer }),
        messageId: id,
        occurredAtSeconds: seconds - 20,
        speakerKind: "member",
        speakerId: "20002",
      })
      .run();
    return id;
  };
  return {
    ...h,
    source,
    spec,
    runtime,
    calls,
    gateway,
    journal,
    conversation,
    memory,
    seed,
    runs,
    diagnostics,
  };
}
const readInput = () => ({ signal: new AbortController().signal, observations: [] });
describe("shared Bot context source", () => {
  it.each(["off", "conservative", "standard", "broad", "full_catalog", "full_body"] as const)(
    "preserves initial %s memory, scope and unchanged-step reuse",
    async (mode) => {
      const h = setup();
      h.runtime.p5_config.retrieval_mode = mode;
      const own = h.memory("own apples"),
        foreign = h.memory("foreign pears", "40004");
      h.seed("apples?");
      const material = await h.source.read(readInput());
      expect(JSON.stringify(material)).not.toContain(foreign);
      expect(JSON.stringify(h.calls)).not.toContain("foreign pears");
      expect(
        material.sources?.some((source) => source.kind === "memory" && source.id === own),
      ).toBe(mode !== "off");
      expect(h.calls.length > 0).toBe(mode !== "off" && mode !== "full_body");
      const count = h.calls.length;
      expect(await h.source.read(readInput())).toBe(material);
      expect(h.calls).toHaveLength(count);
      if (mode !== "off") {
        h.db.query("UPDATE memory_entries SET body='revised' WHERE id=?").run(own);
        await expect(h.source.read(readInput())).rejects.toMatchObject({
          code: "CONTEXT_SOURCE_INVALID",
        });
      }
    },
  );
  it("injects semantic knowledge initially with grant provenance and rejects revocation on reuse", async () => {
    const h = setup();
    h.seed("apples?");
    const repo = new KnowledgeRepository(h.db);
    const doc = repo.importDocument({
      name: "apples",
      category_id: "default",
      original_text: "apples need cold storage",
    });
    repo.replaceGrants(doc.id, doc.revision, [DEFAULT_AGENT_ID]);
    const material = await h.source.read(readInput());
    expect(JSON.stringify(material.evidence)).toContain("cold storage");
    expect(material.sources?.some((source) => source.kind === "knowledge_grant")).toBe(true);
    repo.replaceGrants(doc.id, repo.detail(doc.id).revision, []);
    await expect(h.source.read(readInput())).rejects.toMatchObject({
      code: "CONTEXT_SOURCE_INVALID",
    });
  });
  it("preserves distinct judgement/reply windows and per-target trusted instructions", async () => {
    const h = setup({ decisionTier: "judgement" });
    h.seed("older reply-only fact", 7200);
    h.seed("recent fact");
    const material = await h.source.read(readInput());
    expect(JSON.stringify(material)).not.toContain("older reply-only fact");
    const context = new ContextEngine().render(h.spec, material, [], ["alice", "bob"]);
    const prepared = await h.source.prepareGeneration(
      { kind: "generate", targetId: "bob", instructions: "answer" },
      { context, outputId: "output", signal: new AbortController().signal },
    );
    expect(JSON.stringify(prepared.context?.messages)).toContain("older reply-only fact");
    expect(prepared.instructions).toContain("20003");
    expect(prepared.model).toBe("reply-model");
    expect(prepared.context?.sources.length).toBeGreaterThan(context.sources.length);
    const count = h.calls.length;
    await h.source.read(readInput());
    expect(h.calls).toHaveLength(count);
  });
  it("re-observes newer events explicitly while rejecting deleted prior sources", async () => {
    const h = setup();
    const first = h.seed("first");
    await h.source.read(readInput());
    const seq = h.source.observedSeq;
    h.seed("second");
    expect(JSON.stringify(await h.source.read(readInput()))).not.toContain("second");
    h.source.invalidate();
    expect(JSON.stringify(await h.source.read(readInput()))).toContain("second");
    expect(h.source.observedSeq).toBeGreaterThan(seq);
    h.db.query("DELETE FROM qq_observation_text WHERE event_key=?").run(first);
    await expect(h.source.read(readInput())).rejects.toMatchObject({
      code: "CONTEXT_SOURCE_INVALID",
    });
  });
  it("adds source-bearing compression for older budget-excluded input without removing raw recent messages", async () => {
    const h = setup({ tokenBudget: 256 });
    const old = h.seed(`old ${"x".repeat(200)}`, 3);
    h.seed(`middle ${"x".repeat(200)}`, 2);
    h.seed(`new ${"x".repeat(200)}`);
    const material = await h.source.read(readInput());
    expect(material.summaries).toHaveLength(1);
    expect(JSON.stringify(material.pending)).toContain("new ");
    expect(JSON.stringify(material.pending)).not.toContain("old ");
    expect(material.summaries?.[0].sources.some((source) => source.id === old)).toBe(true);
    const text = JSON.parse(material.summaries?.[0].text ?? "{}");
    expect(text.coverage.fromSeq).toBe(1);
    expect(text.coverage.throughSeq).toBe(2);
    h.db.query("DELETE FROM qq_observation_text WHERE event_key=?").run(old);
    await expect(h.source.read(readInput())).rejects.toMatchObject({
      code: "CONTEXT_SOURCE_INVALID",
    });
  });
  it("keeps the legacy raw suffix when optional summary inference fails and records the failed leaf", async () => {
    const h = setup({ tokenBudget: 256 });
    h.seed(`old ${"x".repeat(200)}`, 2);
    h.seed(`new ${"x".repeat(200)}`);
    h.gateway.complete = async () => "invalid JSON";
    const material = await h.source.read(readInput());
    expect(JSON.stringify(material.pending)).toContain("new ");
    expect(material.summaries).toBeUndefined();
    expect(h.diagnostics).toMatchObject([
      { kind: "supplemental_summary_failed", code: "MODEL_STRUCTURE_INVALID" },
    ]);
    expect(
      h.runs.listRuns({
        ownerKind: "qq_binding",
        ownerId: h.journal.get(h.conversation.id)?.sourceId ?? "",
      })[0]?.status,
    ).toBe("failed");
  });
});
