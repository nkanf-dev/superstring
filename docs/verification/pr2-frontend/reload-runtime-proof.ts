import { api } from "../../../src/web/api";
import { currentChat } from "../../../src/web/features/chat/conversation-state";
import { useSuperstringStore as store } from "../../../src/web/store";

const origin = process.argv[2];
if (!origin) throw new Error("Usage: bun reload-runtime-proof.ts <disposable-fixture-origin>");
let chatPosts = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = ((input, options) => {
  const target = typeof input === "string" ? new URL(input, origin) : input;
  if (String(target).endsWith("/v2/chat") && options?.method === "POST") chatPosts++;
  return originalFetch(target, options);
}) as typeof fetch;
const [existing] = await api.listSessions();
const session = await api.createSession({
  title: "刷新恢复 集成验证",
  agent_id: existing.agent_id,
  mode: "chat",
  client_request_id: crypto.randomUUID(),
});
const requestId = crypto.randomUUID();
const response = await fetch("/v2/chat", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    session_id: session.id,
    message: "验证从已落盘 pending turn 恢复运行，不重发模型请求。",
    client_request_id: requestId,
  }),
});
if (!response.ok) throw new Error(`Fixture request failed: ${response.status}`);
store.getState().resetForTests(api);
await store.getState().selectSession(session.id);
const recovered = currentChat(store.getState());
const before = {
  phase: recovered.phase,
  runId: recovered.runId,
  requestId: recovered.request?.requestId,
};
await response.text();
await store.getState().reconcileChat();
const settled = currentChat(store.getState());
const proof = {
  sessionId: session.id,
  requestId,
  before,
  after: {
    phase: settled.phase,
    error: settled.error,
    messageStatus: settled.messages.at(-1)?.status,
  },
  chatPosts,
};
console.log(JSON.stringify(proof, null, 2));
if (
  before.phase !== "reconciling" ||
  before.requestId !== requestId ||
  settled.phase !== "idle" ||
  chatPosts !== 1
)
  process.exitCode = 1;
