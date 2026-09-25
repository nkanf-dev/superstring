# Shared conversation context and target generation

Status: accepted under the user’s explicit delegated implementation decisions; implements reviewed refactor 02/04/06/07 PR3 and SKMB-2026-09-26-agent-refactor.

## Per-output generation

- Current: one AgentSpec.generation applies to every final output. A group reply has a different authorized speaker target for each draft, so one replyingTo instruction cannot describe every generated response.
- Change: a trusted host prepareGeneration callback may specialize instructions/model/temperature/output reserve/input budget for that output after target authorization. The same context source may explicitly project a generation view (messages and source refs), preserving separately configured judgement and reply windows. The runtime renders the final target request over that view and records its actual sources; no hidden inheritance or model-controlled scope expansion is introduced. Callback configuration is local to the output and is not copied into subsequent outputs.
- Effect: private/Web defaults remain unchanged. Group targets preserve their existing reply prompts and model route. Exact final rendered input (including target request), its actual sources and actual selected model are persisted per generation step. One target preparation or capacity failure is a failed output, while other buffered targets continue. A streamed request retains whole-response failure semantics.
- Verification: two target prompts/routes with shared context, no config cross-contamination, and capacity failure isolation. Existing runtime/Web tests remain intact.

## Bot context and compression

- Current: private-host embeds window selection, initial six-mode memory recall, action budgeting and reply prompt assembly. Web already owns segmented summaries and overview. Repeating those algorithms in group-host would produce a second context implementation.
- Change: direct/shared Bot hosts use one BotContextSource. Host callbacks bind authorized targets, live source validity and observation refresh; the source owns timeline material, initial configured memory/knowledge, scoped actions, actual protocol costs and optional source-bearing compression. A common structured summary leaf can be used without Web turn foreign keys. No new persistent summary table is required for run-local Bot compaction.
- Effect: existing QQ window/message limits and reply prompts remain configured; enabled initial retrieval is never delegated to a model’s optional tool choice. Supplemental queries account for evidence, observations and envelopes. Full modes retain all-or-error behavior. Raw facts remain in original source tables; summary snapshots inherit all covered source refs and shortest expiry, so source deletion/revocation cannot be recovered through a compressed copy. Web persisted summaries keep their existing repository and invalidation behavior.
- Verification: all six modes, knowledge permissions, multiple target generation, unchanged reads reuse material, new events re-observe, expired/revised sources fail before model use, and compression source coverage/budget.

- Supplemental Bot compression failure: model/capacity failure retains the unchanged legacy raw suffix and initial evidence, and is observable as a failed model leaf or content-free diagnostic. Source invalidation and cancellation still propagate. This is an optional enhancement, so an auxiliary failure must not block an otherwise valid legacy reply. User reaffirmed no degradation; root accepted this delegated engineering decision.
