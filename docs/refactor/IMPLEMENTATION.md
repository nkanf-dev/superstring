# Implementation ledger

Baseline: d3167e4. Three stacked pull requests: Agent runtime/leaf/modules; direct conversations/SSE/delivery; shared conversations/convergence.

## Hard compatibility gate

No existing feature may be simplified, downgraded, or omitted. Enhancements are permitted. Existing prompts, models, retrieval modes, budgets, compression, governance, multiple recipients, media/stickers, and editable settings remain covered by the behavior matrix in 08. Existing regression coverage must be retained; a changed test must explain the changed architecture without weakening its behavioral assertion.

## Work status

- PR 1: in progress, parallel runtime core, leaf/module migration, frontend design and implementation.
- PR 2: pending PR 1 contracts.
- PR 3: pending direct host and delivery contracts.

## Validation

Baseline on d3167e4 after installing declared missing dependencies: typecheck/check passed; 1,490 full integration tests across 82 files passed (including 132 focused tests); 416 frontend tests across 35 files passed.

Implementation validation pending. Live model, OneBot, browser, and Windows evidence must be reported separately from automated tests.
