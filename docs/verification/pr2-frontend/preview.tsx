import { createRoot } from "react-dom/client";
import type { AgentResponse, RuntimeConfig, SessionResponse } from "../../../src/shared/contracts";
import type {
  ConversationEventView,
  ConversationSummary,
} from "../../../src/shared/contracts/conversation";
import { api } from "../../../src/web/api";
import { Sidebar } from "../../../src/web/app/Sidebar";
import { StatusBar } from "../../../src/web/app/StatusBar";
import { ChatPage } from "../../../src/web/features/chat/ChatPage";
import { ConversationTimeline } from "../../../src/web/features/conversations/ConversationTimeline";
import { useSuperstringStore as store } from "../../../src/web/store";
import "../../../src/web/styles.css";

// Synthetic records only: visual/focus proof, not API or platform integration proof.
const now = "2026-09-26T00:00:00Z";
const bot: ConversationSummary = {
  id: "conversation-direct-design",
  channel: "onebot11",
  topology: "direct",
  sourceId: "binding-private-30001",
  agentId: "research-assistant",
  bindingEpoch: 1,
  title: "小林 · 项目讨论",
  participants: [
    { id: "30001", label: "小林", role: "user" },
    { id: "research-assistant", label: "研究助手", role: "agent" },
  ],
  updatedAt: now,
  lastSeq: 3,
  consumedSeq: 2,
};
const base = {
  conversationId: bot.id,
  source: { kind: "qq_event", id: "observation-20260926-1", revision: "1" },
  sources: [{ kind: "qq_event", id: "observation-20260926-1", revision: "1" }],
  occurredAt: now,
  recordedAt: now,
  addressing: { reasons: ["private" as const], mentionIds: [] },
  runId: null,
  outputId: null,
  media: [],
  deliveryStatus: null,
  messageStatus: null,
  contentState: "active" as const,
};
const events: ConversationEventView[] = [
  {
    ...base,
    seq: 1,
    eventKey: "1",
    kind: "inbound",
    participant: bot.participants[0],
    text: "我们统一 Agent Loop，长期记忆的四种读取模式要全部保留。",
    media: [
      {
        id: "image-source-60001",
        kind: "image",
        description: "项目架构草图：Web 与 OneBot 接入同一个 Agent Runtime。",
        availability: "available",
      },
    ],
  },
  {
    ...base,
    seq: 2,
    eventKey: "2",
    kind: "outbound",
    source: { kind: "qq_send", id: "send-2", revision: "1" },
    participant: bot.participants[1],
    text: "已记录。统一运行层，保留完整上下文统计、记忆读取和知识权限控制。",
    deliveryStatus: "confirmed",
  },
  {
    ...base,
    seq: 3,
    eventKey: "3",
    kind: "delivery",
    source: { kind: "qq_send", id: "send-3", revision: "1" },
    participant: null,
    text: null,
    outputId: "output-demo",
    deliveryStatus: "unknown",
  },
];
const session: SessionResponse = {
  id: "web-design",
  title: "架构重构讨论",
  agent_id: "research-assistant",
  mode: "chat",
  config_version: 1,
  created_at: now,
  updated_at: now,
};
store.getState().resetForTests({
  ...api,
  listConversations: async ({ channel, sourceId } = {}) => ({
    items:
      channel === "onebot11"
        ? [bot]
        : [
            {
              ...bot,
              id: `conversation:${sourceId}`,
              channel: "web",
              sourceId: sourceId ?? session.id,
            },
          ],
    nextCursor: null,
  }),
  getConversationEvents: async () => ({ items: events, nextSeq: 3, hasMore: false }),
  getDelivery: async () => ({
    id: "output-demo",
    runId: "run-demo",
    conversationId: bot.id,
    ordinal: 0,
    status: "unknown",
    sourceThroughSeq: 2,
    deliverBy: now,
    createdAt: now,
    parts: [
      {
        id: "text-part",
        ordinal: 0,
        kind: "text",
        status: "confirmed",
        platformMessageId: "platform-msg-1",
        attemptedAt: now,
        finishedAt: now,
        stickerId: null,
      },
      {
        id: "sticker-part",
        ordinal: 1,
        kind: "sticker",
        status: "unknown",
        platformMessageId: null,
        attemptedAt: now,
        finishedAt: null,
        stickerId: "sticker-collection-8",
      },
    ],
  }),
  listMessages: async () => [],
  getSessionRuntime: async () => ({ name: "研究助手", mode: "chat" }) as RuntimeConfig,
  listSessions: async () => [session],
  createSession: async (body) => ({ ...session, id: `web-${Date.now()}`, title: body.title }),
});
store.setState({
  status: "ready",
  sessions: [session],
  selectedNewSessionAgentId: "research-assistant",
  agents: [{ id: "research-assistant", name: "研究助手", is_active: true }] as AgentResponse[],
  selectedBotConversation: bot,
  currentConversationId: bot.id,
});
function Preview() {
  const selected = store((s) => s.selectedBotConversation);
  return (
    <div id="superstring-shell">
      <Sidebar version="0.2.1" />
      <main className="main-area">
        {selected ? (
          <ConversationTimeline key={selected.id} conversation={selected} />
        ) : (
          <ChatPage />
        )}
      </main>
      <StatusBar />
    </div>
  );
}
const root = document.getElementById("root");
if (root) createRoot(root).render(<Preview />);
