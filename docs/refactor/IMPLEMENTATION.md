# Implementation ledger

Baseline: d3167e4. Three stacked pull requests: Agent runtime/leaf/modules; direct conversations/SSE/delivery; shared conversations/convergence.

## Hard compatibility gate

No existing feature may be simplified, downgraded, or omitted. Enhancements are permitted. Existing prompts, models, retrieval modes, budgets, compression, governance, multiple recipients, media/stickers, and editable settings remain covered by the behavior matrix in 08. Existing regression coverage must be retained; a changed test must explain the changed architecture without weakening its behavioral assertion.

## Work status

- PR 1: [draft #1](https://github.com/nkanf-dev/superstring/pull/1), source f83ff30 (full suite at ecb2bad; later source-access fix has focused proof); unified runtime, background task migration, lightweight modules, authorized source-bound context inspection and run UI. Original Web/QQ main loops remain until PR 2/3.
- PR 2: [draft #2](https://github.com/nkanf-dev/superstring/pull/2), latest source 628505b; shared Web/private host, journal, durable wake/outbox, SSE and conversation UI. The reload recovery correction has 14 focused frontend tests.
- PR 3: implemented on codex/shared-conversations at 8fad8f0; shared Bot context, scheduling, module lifecycle/ingestion/query composition, canonical directory and complete UI draft convergence. Draft PR pending creation.

## Validation

Baseline on d3167e4 after installing declared missing dependencies: typecheck/check passed; 1,490 full integration tests across 82 files passed (including 132 focused tests); 416 frontend tests across 35 files passed.

PR 1 integrated source ecb2bad: 1,525 integration tests across 85 files passed (5,253 assertions); 427 frontend tests across 36 files passed. Typecheck, Biome (411 files), and Vite production build passed. Vite reports its existing large-bundle advisory; no bundle optimization is claimed.

All old behavior assertions remain. Schema tests advance current version/table counts for additive 0039; original 0001–0038 SQL fingerprints are unchanged. The first integrated run found six failures; after merging pending runtime fixes and updating schema expectations, the stable integrated head passed the complete suite.

Frontend browser fixture verification covers desktop, 320px, on-demand context inspection, partial media and focus return; see ../verification/pr1-frontend/README.md. This is fixture evidence, not real model/OneBot validation. Real model endpoints, real OneBot delivery, Windows packaging, assistive technology and integrated production-browser flows remain unverified. Draft PR status does not mean those gates passed.

## PR 2 integrated verification

Source e368889: 1,589 integration tests / 93 files / 5,635 assertions passed. Typecheck, Biome (451 files, warnings remain) and Vite build passed. Frontend behavior at ec9f9e8 plus subsequent server integration: 446 tests / 39 files passed; final frontend-only change is formatting.

The production composition test exercises actual createRuntime, Web SSE and OneBot private activation with a synthetic model/transport; two split parts are persisted and confirmed once. Private parity tests cover all six memory modes, original selection model routes, initial knowledge, sticker-only output, inline stickers, cancelled/no-output runs, current source deletion, same-second incoming messages, stale input, offline expiry, CQ mentions and delayed sticker disablement. Confirmed partial speech retains its original expiry; unknown delivery is not retried. The restored v38 database is byte-verified from backup.

Actual in-app browser against isolated Hono/SQLite/shared AgentRuntime: two Web turns, reload, prior history in next context, usage, run details, dialog keyboard/focus and 320px layout; see [integrated browser evidence](../verification/pr2-frontend/integrated-browser.md). Separate real frontend-client SSE/reload proofs verify one POST. Model/transport outputs are synthetic: no live model quality, real OneBot/NapCat delivery, Windows packaging or assistive-technology acceptance is claimed. Group activation remains the old pipeline in this intermediate PR and is removed in PR 3. These local test results are not CI results.

## PR 3 integrated verification

Source 8fad8f0: **1,663 integration tests / 100 files / 6,036 assertions**, **470 frontend tests / 42 files**, TypeScript, Biome and Vite production build passed. Biome warnings and the existing large-bundle advisory remain. Tests remain local; no GitHub CI run is being claimed.

Three independent focused reviews found and fixed shutdown consumption of unstarted output, cross-cause duplicate response, stale recovery refreshing old input age/target, module source inspection disagreement, instance binding in asynchronous observation, reload recovery lockup, compact menu focus, and loaded-directory collapse. The final full integration run also caught a legacy knowledge error-code regression, fixed without changing its assertion.

Old fixed QQ loops have moved to test-only oracles. Their assertions are retained, but new host coverage is separately in private/shared/runtime/composition/delivery tests. See [implemented architecture and parity map](13-实现架构与功能证据.md) and [real browser fixture evidence](../verification/pr3-frontend/README.md). Actual model quality, OneBot/NapCat delivery, Windows packaging and assistive technology still require release acceptance.
