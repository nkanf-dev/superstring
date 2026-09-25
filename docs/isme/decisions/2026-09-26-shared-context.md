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

## Unified scheduling composition

A neutral BotWorker owns only timer/wake/stop, sweeps even offline, and waits for active work before the database closes. The shared WakeScheduler owns all direct/shared opportunity claims and per-conversation leases. A global concurrency count is checked inside the same SQLite immediate transaction; its default remains one and is constructor configurable. Ready opportunities drain in priority order without adding a new 15-second delay between immediate and initiative work. Old unexpired global leases block transition claims; old pending candidate migration is adapter-owned and idempotent. Production no longer calls the fixed group generation pipeline after cutover. Its original tests may use an explicit test-only baseline oracle; those are compatibility references, not production coverage of the new host.
## Summary envelope and parent-source follow-up

- Current: the summary leaf also receives the recent question, while the compacted records cover the older prefix. Counting only the fact JSON misses the published coverage/provenance envelope.
- Change: every folded leaf and resulting summary inherit question/material sources as well as all covered records; cache reuse rechecks those sources. Admission and validation measure the final rendered summary envelope including coverage and references against both remaining context capacity and the configured summary reading budget.
- Effect: deleting an input cannot leave its derived text inspectable through a child summary. An envelope that cannot fit does not start auxiliary work. Auxiliary timeouts retain valid raw input; source revocation and caller cancellation still propagate. Knowledge original/derived pairs remain atomic at each selected offset without making the whole document an indivisible unit.
- Verification: multi-batch previous overview preservation, source deletion during inference, cancellation, timeout fallback, exact empty-envelope rejection, full-mode action budget with accumulated observations, and question ancestry in persisted leaf snapshots.

## Initiative score context

- Current: the legacy eligibility helper also rebuilt score-call material with separate fixed memory/knowledge budgets. Reusing it for `speech.evaluate` would leave a parallel context implementation after the main loop migration.
- Change: eligibility and recipient selection remain host policy; `BotContextSource.prepareEvaluation` projects the cached judgement phase into the configured score prompt. It retains the score rubric/schema, global judgement model and judgement output reserve, and includes the same six-mode memory, knowledge, summaries and current action observations. Only the trusted output protocol changes; score data never inherits the main decision directive.
- Effect: initial enabled retrieval and subsequent evidence are consistent across main decisions and their score leaf, without running a second selector per recipient. Actual score messages, media rule and JSON schema count against the same phase capacity; source validity is checked immediately before returning the child input.
- Verification: all six modes in score projections, scope exclusion, per-recipient prompt/model, observation sources, unchanged-view reuse, and revocation before score preparation.

## Child inference source revalidation

- Current: module selection validates its own memory/catalog or knowledge grants, but a parent question may be deleted while the auxiliary capacity probe is awaited and before the child run begins.
- Change: SQLite query modules accept a host source-check callback and invoke it for parent plus candidate sources before/after child inference. BotContextSource supplies the same owner/scoped source validator used for main and generation views.
- Effect: deleted input cannot be sent to a newly started selector merely because its candidate document is still authorized. Existing ownership, cursor and transaction behavior is unchanged.
- Verification: delete the current question during the selector capacity probe for both memory and knowledge; assert no child model call or run is started.

## Action input and causal provenance

- Current: subsequent steps receive an action name and result, but omit the query arguments and may retain only the returned evidence's source references.
- Change: typed observations carry the actual decision arguments as data and inherit the decision context's sources alongside result sources. Query budgeting includes the argument envelope. Durable event/decision metadata remains content-free; argument text lives only in source-bound context snapshots.
- Effect: the Agent can distinguish repeated queries and revise its search; an observation cannot outlive the input from which its query was generated after context refresh.
- Verification: remove the old question from the refreshed material, verify the next model sees the query and inherited source, then revoke the source and verify its later snapshot text is erased.

## Concrete module composition

- Current: optional lifecycle method names existed only in interfaces, while production ingestion/maintenance entered repositories and workers separately; context owners constructed SQLite readers themselves.
- Change: one module composition owns concrete synchronous SQLite observe/ingest, queued maintain and lifecycle delegation to the existing workers. Query bindings receive the frozen runtime and host source checker. Source replacement has an explicit resolver seam: unhandled source kinds still pass to the existing authoritative resolver; unknown kinds are never automatically available. SQLite document ingestion accepts a stable source UUID and retains the existing import receipt, job scheduling and idempotence conflict behavior.
- Effect: source+journal hooks can remain in one SQLite transaction; there is no pretend async atomic callback. Read-only replacements implement query only. Remote backend storage/inspection is not implemented: a future adapter must use its source resolver consistently for live consumption and ContextHandle inspection. Existing Web frozen-read policy is being moved into a module-owned compatibility adapter so its leases/capacities/snapshots remain unchanged.
- Verification: real organizer completion through maintain, stable document ingestion identity, OneBot hook failure rolls back source writes, repeated observation deduplicates, completed Web ownership checks, and an alternate knowledge backend whose source can later be revoked.

## Initial evidence compatibility and replacement

- Current: injectable action queries alone would leave initial memory and frozen Web knowledge wired directly to SQLite inside context owners.
- Change: module bindings optionally provide existing Web frozen-read and Bot memory presentation adapters. SQLite supplies those adapters from `modules/initial-evidence.ts`, retaining exact selectors, message templates, retry snapshots and revision checks. ContextBuilder owns history/compression but consumes adapter material and provenance. An alternate binding need only supply the standard memory/knowledge query methods; generic initial-evidence rendering treats its text as opaque data and checks its explicit source resolver.
- Effect: replacing a query backend affects both initial evidence and later actions. The compatibility adapters are optional migration policy, not mandatory stages imposed on every backend. The complete default Web six-mode/context/knowledge suites remain unchanged.
- Verification: an alternate module supplies initial Web memory plus knowledge without creating a SQLite turn knowledge snapshot; alternate Bot memory supplies both initial material and a later action. Revocation is checked through the same supplied resolver.

## Canonical source commits and optional module ingestion

- Current: generic `observe` can be asynchronous, while the existing SQLite source+journal/wake commit must remain synchronous and atomic.
- Change: channel/document repositories remain the canonical source registry. The production composition may notify an optional module after that source transaction commits. SQLite `observe` accepts the committed QQ event identity and original completed Web turn, validates ownership/version, and schedules using the existing queue policy; it does not duplicate source facts. Standalone SQLite observation import remains available with the original synchronous hooks. Knowledge's default ingestion recognizes an already imported document identity and returns the existing detail receipt.
- Effect: `ModuleComposition` does not force an external backend to impersonate SQLite transactions or management UI records. Durable cross-backend notification/replay is a future adapter concern and is not claimed as implemented here; default SQLite maintenance still recovers eligible canonical sources through the established polling/cursor policy.
- Verification: committed QQ event notification preserves dedup count and rejects stale source versions; original hook rollback and maintenance tests remain in place.
