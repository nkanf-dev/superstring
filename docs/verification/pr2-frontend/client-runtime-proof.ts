import { api } from "../../../src/web/api";
import { currentChat } from "../../../src/web/features/chat/conversation-state";
import { useSuperstringStore as store } from "../../../src/web/store";

// Run only against the disposable synthetic-model integration host created for this PR.
// This exercises the real frontend API validators, state actions and SSE parser, without a DOM.
const origin = process.argv[2];
if (!origin) throw new Error("Usage: bun client-runtime-proof.ts <disposable-fixture-origin>");
const originalFetch = globalThis.fetch;
globalThis.fetch = ((input, options) =>
  originalFetch(
    typeof input === "string" ? new URL(input, origin) : input,
    options,
  )) as typeof fetch;
store.getState().resetForTests(api);
const sessions = await api.listSessions();
const session = sessions.find((item) => item.title === "共享 Agent Loop 集成验证");
if (!session) throw new Error("Named disposable proof session not found");
store.setState({ sessions });
await store.getState().selectSession(session.id);
store.getState().setComposer("集成验证：保留四档记忆与完整知识权限，让 Web 使用统一 Agent Loop。");
await store.getState().send();
const state = store.getState();
const chat = currentChat(state);
const run = chat.runId ? await api.getRun(chat.runId) : null;
const proof = {
  sessionId: session.id,
  conversationId: state.currentConversationId,
  phase: chat.phase,
  error: chat.error,
  lastMessage: chat.messages.at(-1),
  runId: chat.runId,
  runStatus: run?.status,
  steps: run?.steps.map(({ phase, status }) => ({ phase, status })),
  contextUsageModel: chat.contextUsage?.model,
  contextComponents: chat.contextUsage?.components,
};
console.log(JSON.stringify(proof, null, 2));
if (
  chat.phase !== "idle" ||
  run?.status !== "completed" ||
  chat.messages.at(-1)?.status !== "completed"
)
  process.exitCode = 1;
