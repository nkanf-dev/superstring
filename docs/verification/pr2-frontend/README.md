# PR 2 frontend verification

## Implemented and preserved

- Canonical conversation keyed Web drafts, messages, runtime/config availability, usage, errors, retry and request state. No production compatibility shadow store.
- v2 SSE framing through `eventsource-parser@4.1.1`; strictly validated shared DTOs; per-run sequence dedupe/buffering, complete replay and terminal-authoritative reload.
- EOF/transport errors use read-only by-request reconciliation. Pending persisted turns recover through existing run ownership and request events after page reload. No automatic POST retry and no prompt storage in browser persistence.
- Existing knowledge-permission confirmation still sends a fresh request ID; ordinary retry retains its original ID and text. Existing empty-state, failure, partial-output, message deletion, session/default/custom naming, rename/delete/refresh, IME and context-accounting behavior remain covered.
- OneBot direct list and read-only timeline retain participants/source revisions, media descriptions/availability, message status and independent delivery parts. Source-backed projections revalidate loaded pages and clear on blur/hidden. `unknown` delivery has no resend button.
- New-session naming uses Radix Dialog; custom-name input is explicitly labelled, focuses on selection, supports IME and restores trigger focus on dismissal.
- Every old settings route/form remains available. The previous global “no details anywhere” test is scoped to `.settings-navigation details`, retaining the original uncollapsed-settings-navigation assertion while allowing the new independent OneBot history disclosure.

## Automated evidence

| Check | Result |
| --- | --- |
| Original suite after keyed migration | 36 files / 427 tests passed |
| Full suite with new conversation/reload/timeline/dialog tests | 39 files / 445 tests passed (`full-suite.txt`) |
| Final sidebar race fix and latest recovery API signatures | 3 files / 29 focused tests passed (`final-focused.txt`); this adds one further regression test |
| Final TypeScript | `bun run typecheck` passed (`typecheck.txt`) |
| Vite production build | Passed (`build.txt`); existing single-bundle size warning remains |
| Existing semantic tests | Retained; `tests/web/helpers/chat-fixture.ts` maps old data fixtures onto the actual keyed store; it does not turn v2 transport failures into successful outcomes |

## Actual client/runtime integration

The two scripts import the real frontend API validators, actions and SSE parser and connect to a disposable local Hono/SQLite/AgentRuntime server. Only its model gateway is synthetic. These are client/runtime integration checks without a browser DOM.

- `client-runtime-proof.ts` / `.json`: actual `/v2/chat` request → canonical conversation → `next` + `generate` → persisted assistant message → completed run and idle/error-free UI state. The full context accounting structure arrives through the real v2 stream.
- `reload-runtime-proof.ts` / `.json`: begin one real server request, create fresh frontend state, recover the pending turn's existing run/request ID, wait for completion and reconcile. The recorded `/v2/chat` POST count is **1** throughout recovery.

Re-run only against the disposable fixture host:

```sh
bun docs/verification/pr2-frontend/client-runtime-proof.ts http://127.0.0.1:<fixture-port>
bun docs/verification/pr2-frontend/reload-runtime-proof.ts http://127.0.0.1:<fixture-port>
```

The fixture contains no live OneBot connection or external model. These checks do not establish real QQ/NapCat delivery, real model quality or knowledge retrieval quality.

## Visual and keyboard proof boundary

`preview.html` / `preview.tsx` is a synthetic fixture for the new OneBot history, delivery disclosure and naming dialog. Keyboard/IME/focus behavior is covered in the component tests. This worker could not complete visual inspection: its IAB surface was unavailable, and a fallback native browser action was interrupted by the user's active browsing. It stopped without changing the active user page. Therefore no screenshot, narrow viewport, 200% zoom or assistive-technology claim is made by this record. The integration owner is performing real browser verification separately; attach that evidence before marking the visual gate complete.
