# PR2 conversation persistence decision basis

## Basis

Implements accepted A1–A12 and refactor documents 03/05/07/08. Existing source bodies, prompts, model choices and capabilities remain authoritative. New durable tables contain source identities and delivery payloads only; a journal is not a second permanent message store.

## State ownership

- Web retains the existing turn lease. OneBot private activation holds one renewable wake lease per conversation. Group activation remains the legacy runtime until PR3.
- SQLite allocates per-conversation sequence numbers transactionally. Platform event identifiers deduplicate, never order. A late event receives a new sequence.
- Rebinding creates an epoch. Its source watermark excludes every OneBot event already persisted before that epoch; initial history backfill runs only for epoch 1. No timestamp-based inheritance across A → B → A.
- Terminal writes group consumed cursor, wake acknowledgement, prepared outbound intents and run terminal event in one transaction. Failed/cancelled attempts do not acknowledge inputs.
- A sending part is committed before the transport call. Restart turns unresolved sending into unknown and remaining parts into not_sent. It cannot be retried automatically.
- Recovery between confirmed parts may mark only unsent parts stale. Confirmed receipts remain immutable.
- Historical send and speech tables lacked a linking key. Backfill pairs records one-to-one within exact account/conversation/agent, timestamp and speech kind, in recording order, preferring platform send receipts and retaining unmatched speech. Unknown sends are delivery activities, never asserted assistant utterances.
- UI projections resolve current source content each time. Expiry and revocation can change an existing projection without a new source message; clients refresh previously loaded pages. Delivery revisions append activities when their state changes.

## Configurable policy

Repository operations accept timing, lease duration, retry delay and maximum attempts explicitly. The scheduler owns defaults and exposes them through its options; persistence does not impose additional hidden retry or timing limits. Outbound payload retention follows existing QQ speech retention. No new tool/Skill implementation is added in PR2.

Production composition exposes `RuntimeOptions.botConversationPolicy`: 16 Agent steps, 120-second prepared-output validity, 15-second model retry delay, 3 attempts and the existing 14-day source retention are initial defaults. The existing saved dispatch lease remains authoritative; renewal uses one third of that lease. These are constructor settings, not storage constraints. The old 600-second immediate-input eligibility remains a separate source-time rule.

PR2's transition uses one Bot pump for new private activations and the remaining group pipeline. Group and private immediate opportunities compare their source activity time; all execution is sequential, with private idle and old group initiative afterward. Web/leaf tasks do not consume that Bot slot. PR3 replaces this temporary bridge with the shared scheduler. Shutdown aborts active private work and prevents subsequent opportunities from starting; payload expiry housekeeping is independent of transport readiness.

Prepared intents capture configuration authority, binding epoch, owner identity revision and actual evidence references. Delivery rechecks those captured authorities before effects. A stale intent is never resent; a fresh wake allows a new decision from current facts. Confirmed parts remain authoritative when the tail expires or is not sent. Existing partial-send unanswered-count policy is retained; confirmed partial text can enter conversation context through its outbox source and original expiry, without inventing a full successful speech record.
