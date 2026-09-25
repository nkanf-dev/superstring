import { describe, expect, it } from "bun:test";
import { ContextBuilder } from "../../src/server/agent/conversation-context";
import { chatV2Routes } from "../../src/server/api/chat-v2";
import { parseSseFrames } from "../../src/server/api/sse";
import { createApp } from "../../src/server/app";
import { WebChannel } from "../../src/server/channels/web-channel";
import { AgentRunRepository } from "../../src/server/db/agent-run-repository";
import { ConversationEventRepository } from "../../src/server/db/conversation-event-repository";
import {
  createSession,
  ensureDefaults,
  getTurnByRequest,
  listMessages,
} from "../../src/server/db/repositories";
import { openBusinessDb } from "../../src/server/db/schema-gate";
import type { ModelGateway } from "../../src/server/llm/model-gateway";
import type { ChatV2Event } from "../../src/shared/contracts/chat-v2";
import { ChatV2EventSchema } from "../../src/shared/contracts/chat-v2";

class Gateway implements ModelGateway {
  config = { baseUrl: "http://unused", model: "model", timeoutSeconds: 60 };
  decisions: unknown[] = [
    { kind: "final", outputs: [{ kind: "generate", targetId: "reply", instructions: "" }] },
  ];
  deltas = ["answer"];
  fail?: Error;
  completeCalls: Parameters<ModelGateway["complete"]>[0][] = [];
  streamCalls: Parameters<ModelGateway["streamChat"]>[0][] = [];
  async listModels() {
    return ["model"];
  }
  async loadedContextCapacity() {
    return 32768;
  }
  async probeModelLoaded() {
    return true;
  }
  async complete(input: Parameters<ModelGateway["complete"]>[0]) {
    this.completeCalls.push(input);
    return JSON.stringify(this.decisions.shift());
  }
  async *streamChat(input: Parameters<ModelGateway["streamChat"]>[0]) {
    this.streamCalls.push(input);
    for (const delta of this.deltas) yield delta;
    if (this.fail) throw this.fail;
  }
}
function setup() {
  const business = openBusinessDb();
  ensureDefaults(business.orm, "model");
  const session = createSession(business.orm, "test", { modelName: "model" });
  const gateway = new Gateway();
  return { business, session, gateway };
}
async function collect(reply: AsyncGenerator<ChatV2Event>) {
  const result: ChatV2Event[] = [];
  for await (const e of reply) result.push(e);
  return result;
}

describe("Web Agent and v2 streaming", () => {
  it("iterates read-observe-decide with initial context prepared once and stable output identity", async () => {
    const { business, session, gateway } = setup();
    try {
      gateway.decisions = [
        { kind: "invoke", name: "memory.query", arguments: { query: "second query" } },
        {
          kind: "final",
          outputs: [
            { kind: "generate", targetId: "reply", instructions: "answer the original question" },
          ],
        },
      ];
      const builder = new ContextBuilder({ db: business.db, orm: business.orm, gateway });
      const original = builder.build.bind(builder);
      let builds = 0;
      builder.build = async (args) => {
        builds++;
        return original(args);
      };
      const channel = new WebChannel({
        db: business.db,
        orm: business.orm,
        gateway,
        contextBuilder: builder,
      });
      const events = await collect(
        await channel.openReply({
          sessionId: session.id,
          message: "question",
          clientRequestId: "request",
        }),
      );
      const run = events.find((e) => e.type === "started");
      expect(run?.type).toBe("started");
      if (run?.type !== "started") throw Error("missing started");
      expect(run.requestId).toBe("request");
      expect(builds).toBe(1);
      expect(events.some((e) => e.type === "action_result" && e.name === "memory.query")).toBe(
        true,
      );
      const output = events.find((e) => e.type === "output_delta");
      const done = events.at(-1);
      expect(done?.type).toBe("completed");
      if (output?.type !== "output_delta" || done?.type !== "completed")
        throw Error("missing output");
      expect(output.outputId).toBe(done.messageId ?? "missing");
      const persisted = listMessages(business.orm, session.id).find((m) => m.role === "assistant");
      expect(persisted?.content).toBe("answer");
      expect(persisted?.id).toBe(output.outputId);
      expect(gateway.completeCalls).toHaveLength(2);
      expect(
        gateway.completeCalls[1]?.messages.some((m) => m.content.includes('"action_observation"')),
      ).toBe(true);
      expect(gateway.streamCalls[0]?.messages.at(-1)?.content).toBe("question");
      expect(gateway.streamCalls[0]?.messages[0]?.content).not.toContain(
        "Return exactly one JSON decision",
      );
      const journal = new ConversationEventRepository(business.db);
      const c = journal.ensureWeb(session.id);
      expect(c?.consumedSeq).toBe(1);
      expect(c?.lastSeq).toBe(2);
      const repo = new AgentRunRepository(business.db);
      expect(repo.getRun(run.runId)?.status).toBe("completed");
      expect(repo.getRun(run.runId)?.steps.map((s) => s.phase)).toEqual([
        "next",
        "next",
        "generate",
      ]);
      const sequences = events.filter((e) => e.type !== "replay").map((e) => e.seq);
      expect(sequences).toEqual(sequences.map((_, i) => i + 1));
      expect(
        repo
          .listEvents(run.runId)
          .filter((e) => e.type === "output_delta")
          .every((e) => e.text === ""),
      ).toBe(true);
      for (const event of events) expect(ChatV2EventSchema.safeParse(event).success).toBe(true);
      const replay = await collect(
        await channel.openReply({
          sessionId: session.id,
          message: "question",
          clientRequestId: "request",
        }),
      );
      expect(replay).toHaveLength(1);
      expect(replay[0]?.type).toBe("replay");
      expect(gateway.completeCalls).toHaveLength(2);
    } finally {
      business.close();
    }
  });
  it("keeps failure partials before terminal and retries with a new run on the same reserved message", async () => {
    const { business, session, gateway } = setup();
    try {
      gateway.deltas = ["partial"];
      gateway.fail = new Error("broken");
      const channel = new WebChannel({ db: business.db, orm: business.orm, gateway });
      const first: ChatV2Event[] = [];
      try {
        for await (const event of await channel.openReply({
          sessionId: session.id,
          message: "question",
          clientRequestId: "request",
        })) {
          first.push(event);
          if (event.type === "failed")
            expect(
              listMessages(business.orm, session.id).find((m) => m.role === "assistant")?.content,
            ).toBe("partial");
        }
      } catch {
        /* The v1 facade receives the classified legacy error after the v2 terminal. */
      }
      expect(first.at(-1)?.type).toBe("failed");
      const before = listMessages(business.orm, session.id).find((m) => m.role === "assistant");
      expect(before?.status).toBe("failed");
      gateway.fail = undefined;
      gateway.deltas = ["retried"];
      gateway.decisions = [
        { kind: "final", outputs: [{ kind: "generate", targetId: "reply", instructions: "" }] },
      ];
      const second = await collect(
        await channel.openReply({
          sessionId: session.id,
          message: "question",
          clientRequestId: "request",
        }),
      );
      const a = first[0],
        b = second[0];
      if (!a || !b || a.type === "replay" || b.type === "replay") throw Error("missing runs");
      expect(a.runId).not.toBe(b.runId);
      expect(b.seq).toBe(1);
      expect(listMessages(business.orm, session.id).find((m) => m.role === "assistant")?.id).toBe(
        before?.id,
      );
      expect(getTurnByRequest(business.orm, session.id, "request")?.generationStatus).toBe(
        "completed",
      );
    } finally {
      business.close();
    }
  });
  it("serves typed full SSE records and preserves eager JSON preparation errors", async () => {
    const { business, session, gateway } = setup();
    try {
      const app = createApp({ business, gateway });
      app.route("/", chatV2Routes({ db: business.db, orm: business.orm, gateway }));
      const response = await app.request("/v2/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          session_id: session.id,
          message: "question",
          client_request_id: "request",
        }),
      });
      expect(response.status).toBe(200);
      const frames = parseSseFrames(await response.text());
      expect(frames[0]?.event).toBe("started");
      expect(frames.at(-1)?.event).toBe("completed");
      for (const frame of frames) {
        const parsed = ChatV2EventSchema.parse(frame.data);
        expect(frame.event).toBe(parsed.type);
      }
      const conflict = await app.request("/v2/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          session_id: session.id,
          message: "different",
          client_request_id: "request",
        }),
      });
      expect(conflict.status).toBe(409);
      expect(conflict.headers.get("content-type")).toContain("application/json");
    } finally {
      business.close();
    }
  });
});
