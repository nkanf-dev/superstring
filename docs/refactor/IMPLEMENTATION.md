# Implementation ledger

Baseline: d3167e4. Three stacked pull requests: Agent runtime/leaf/modules; direct conversations/SSE/delivery; shared conversations/convergence.

## Hard compatibility gate

No existing feature may be simplified, downgraded, or omitted. Enhancements are permitted. Existing prompts, models, retrieval modes, budgets, compression, governance, multiple recipients, media/stickers, and editable settings remain covered by the behavior matrix in 08. Existing regression coverage must be retained; a changed test must explain the changed architecture without weakening its behavioral assertion.

## Work status

- PR 1: implemented at ecb2bad; unified runtime, background task migration, lightweight modules, authorized source-bound context inspection and run UI. Original Web/QQ main loops remain until PR 2/3.
- PR 2: in progress on codex/direct-conversations and three isolated implementation worktrees.
- PR 3: pending direct host and delivery contracts.

## Validation

Baseline on d3167e4 after installing declared missing dependencies: typecheck/check passed; 1,490 full integration tests across 82 files passed (including 132 focused tests); 416 frontend tests across 35 files passed.

PR 1 integrated source ecb2bad: 1,525 integration tests across 85 files passed (5,253 assertions); 427 frontend tests across 36 files passed. Typecheck, Biome (411 files), and Vite production build passed. Vite reports its existing large-bundle advisory; no bundle optimization is claimed.

All old behavior assertions remain. Schema tests advance current version/table counts for additive 0039; original 0001–0038 SQL fingerprints are unchanged. The first integrated run found six failures; after merging pending runtime fixes and updating schema expectations, the stable integrated head passed the complete suite.

Frontend browser fixture verification covers desktop, 320px, on-demand context inspection, partial media and focus return; see ../verification/pr1-frontend/README.md. This is fixture evidence, not real model/OneBot validation. Real model endpoints, real OneBot delivery, Windows packaging, assistive technology and integrated production-browser flows remain unverified. Draft PR status does not mean those gates passed.
