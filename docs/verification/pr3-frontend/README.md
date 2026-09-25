# PR3 browser verification

Date: 2026-09-26. Integrated frontend behavior at 20a1206; subsequent server fixes and import formatting do not alter these views.

## Reproduction

From repository root: `bun run build`, then `bun docs/verification/pr3-frontend/browser-fixture.ts`. Open the printed localhost URL. The fixture uses real Hono routes, SQLite schema, AgentRuntime, Bot scheduler, outbox and projections with a synthetic model and send transport. It never starts a real OneBot socket. The directory includes a Web session and a group conversation.

Two real synthetic-model output intents are confirmed/unknown through the actual delivery worker. Display names/reply references and a historical silent wake/expired event are synthetic seeded UI states; this does not prove that a real model selected those outcomes. Runtime integration tests separately cover actual no-output generation, multiple parts and sticker-only/partial delivery.

## Observed in the in-app browser

- At 1280 × 900, the unified directory contains Web and group entries. Same labels retain distinct participant IDs; mention and reply references are readable.
- Unknown delivery names the exact target, distinguishes uncertainty from confirmation and provides refresh only, with no automatic resend action.
- `no_output` appears as an activity; expired content displays its retention state rather than its old body.
- At 390 × 844, document client/scroll width both equal 390. Long participant IDs and delivery status remain readable.
- Compact directory Shift+F10 opens the existing context menu and moves focus to Rename inside the Radix dialog.
- Clear an integer in Scheme → Context, open compact navigation and select Agent: the dirty dialog opens. Save and continue fails validation, retains the draft/dialog; Cancel returns focus to navigation; Discard then completes navigation. No real settings are changed outside the in-memory fixture.
- Browser console error query returned no errors at the end of the successful scenario.

Screenshots: [desktop](group-desktop.png), [compact delivery detail](group-compact.png), [mobile](group-mobile.png), [invalid draft](invalid-draft-mobile.png).

These are local browser/fixture results, not real QQ/NapCat, real model quality/latency, Windows packaging or screen-reader acceptance.
