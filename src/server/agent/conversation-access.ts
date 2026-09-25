import type { Database } from "bun:sqlite";
import type { ConversationSummary } from "../../shared/contracts/conversation";
import type { ConversationEventRepository } from "../db/conversation-event-repository";
import type { ContextPrincipal } from "./context-access";

/** A conversation ID does not preserve access after its session/binding is removed or rebound. */
export function visibleConversation(
  db: Database,
  repository: ConversationEventRepository,
  id: string,
  principal: ContextPrincipal,
  includeShared = false,
): ConversationSummary | null {
  const row = repository.row(id);
  if (
    !row ||
    row.user_id !== principal.userId ||
    row.closed_at !== null ||
    (!includeShared && row.topology === "shared")
  )
    return null;
  const source =
    row.channel === "web"
      ? db
          .query("SELECT 1 FROM sessions WHERE id=? AND user_id=? AND agent_id=?")
          .get(row.source_id, principal.userId, row.agent_id)
      : db
          .query(`SELECT 1 FROM qq_bindings b JOIN agents a ON a.id=b.agent_id
        WHERE b.id=? AND b.agent_id=?`)
          .get(row.source_id, row.agent_id);
  return source ? repository.get(id, principal.userId) : null;
}
