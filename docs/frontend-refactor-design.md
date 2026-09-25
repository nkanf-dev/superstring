# Frontend refactor: design before implementation

PR 1 design, 2026-09-26. This record precedes component implementation. The existing feature inventory in `~/docs/superstring/refactor/09-前端体验与架构.md` remains an acceptance gate. **No current capability, setting, model role, scope, retention choice, editing interaction, import/export input, or error recovery may be removed or simplified.** New UI is additive in PR 1; PR 2 and PR 3 move the conversation surfaces with equivalent or richer behavior.

## Library decision

The application already uses React 19, Zustand 5, Zod and Radix Alert Dialog. Use the separately packaged Radix Dialog primitive for the diagnostic drawer: it provides modal focus containment, Escape handling, accessible title/description, and trigger focus restoration without imposing a design system. Keep the current CSS tokens and theme behavior. Use semantic native disclosure (`details/summary`) for optional message content, and native buttons/selects for actions.

Official references reviewed before implementation: [Radix Dialog](https://www.radix-ui.com/primitives/docs/components/dialog), [Motion accessibility](https://motion.dev/docs/react-accessibility), [Effect introduction](https://effect.website/docs/v3/getting-started). Motion is an animation library and Effect is an effects/concurrency library, not a component kit. Neither solves a missing requirement in this diagnostic feature; the existing keyed Zustand slice and normal abortable requests are sufficient. No new animation dependency: the drawer appears directly and works with reduced motion. No custom focus trap, portal manager, or alert-dialog used as a generic drawer.

## Run inspector / job entry point

Purpose: from a memory organization task or knowledge document, understand the actual model attempts, status, errors and input used. Entry is a quiet secondary “运行详情” button next to the existing task status. Opening loads the owner's run list; the latest attempt is selected. Earlier attempts remain selectable, including errors. Empty history means “no recorded run yet”, never success. The selection is keyed by owner and run IDs, not the global chat `sending` flag.

Desktop: a right-side modal drawer, width up to 46rem. Header: title, concise purpose, close button. Body: refresh + attempt selector, status summary and timestamps, steps. Each step shows ID/model/purpose metadata when available and an explicit “查看实际输入” action. Precise messages are not loaded with run lists, events or steps. Raw IDs wrap rather than force horizontal overflow. At 320px the drawer fills the viewport; one scrollable body preserves access to closing controls. Dark/light colors reuse existing tokens.

Interaction/state: closed → loading → empty/ready/error. Refresh errors keep the last non-sensitive run metadata visible with a retry. Run switches discard inspected text and abort in-flight detail requests. Closing, component unmount, tab hide and window blur clear inspected text. Inspect is explicitly requested per step and fetched anew; `exact`, `partial`, `expired`, `revoked` have distinct explanations. Partial media shows source/hash and unavailable bytes; it never renders guessed images. Expired/revoked/error replaces old content, including already-open content. No exact prompt is persisted in localStorage or Zustand. Run completion is not a claim of external delivery; this diagnostic has no retry/resend effects.

Accessibility: Radix `Title/Description`, focus on close when opened, Tab contained, Escape closes, focus returns to the trigger. Status announcement uses a polite live region only for phase changes. Errors use role=alert; actual prompt text is not a live region. Every selector has an accessible name; dates are rendered through existing local-time helper. Buttons remain native, keyboard operable and visible under zoom. English text is added for every Chinese product string.

## Run slice / API

Shared strict DTOs provide schema validation at the HTTP boundary. `runById` stores independent snapshots and event cursors; owner lists contain IDs. One reducer folds every event using per-run sequence ordering and ignores replayed events. Partial streamed text is keyed by output ID. Terminal outcomes remain distinct (`completed`, `no_output`, `failed`, `cancelled`); there is no automatic resend or empty message on no_output. Older snapshots do not overwrite newer event state. Existing chat APIs and state remain in PR 1 until the v2 conversation migration in PR 2.

## Model use / scope explanation

Add concise read-only effective-value explanations beside existing model selectors. Existing write scopes and save buttons stay exactly where they are. Agent chat, retrieval, compression, and memory organization remain separate fields; memory organization can inherit the shared organization default, then chat. Knowledge organization retains global override → shared organization default → gateway default. QQ judgement retains shared global override → the conversation's bound Agent chat model (not whichever Agent happens to be open in settings). Image understanding and transcription remain independent global purposes. Where a default is not loaded or is dynamic, say so instead of fabricating an effective model. Unsaved draft values must be labelled as a preview; saved global fallback values, not unsaved global drafts, determine actual inheritance.

## Feature preservation and verification gates

| Feature group | Preserve | PR 1 evidence |
| --- | --- | --- |
| Web chat | New/select/rename/delete sessions; send, same-request retry, partial/error behavior, context usage | Existing chat, flow, session menu, context tests |
| Agent/model | Identity/persona/prompts; all four text roles; independent media roles; availability; defaults and one-click overwrite; save/discard/conflict and page draft guard | Existing settings/draft/model/action tests; effective-role cases |
| Memory | Four read modes, scope/search/pagination, selected-turn organization, automatic/QQ settings, merge/suppress/enable/purge/correction | Existing memory suites; additive job inspector |
| Knowledge | Categories, file/paste import, complete source, versioned draft, mode, per-document/batch grants, budgets, model/rules/retry | Existing knowledge suites; additive job inspector |
| OneBot/QQ | Connections, token, bindings, unknown targets, pause, four triggers, rhythm, audience, prompts, media/stickers, diagnostics/retention | Existing QQ suites; no field deletion |
| App shell | Navigation draft guards, themes, locales, desktop lifecycle/close preferences | Existing workspace, accessibility, appearance, locale, lifecycle suites |

Targeted tests cover multi-run isolation, replay and stale snapshots, terminal distinctions, API ID encoding/validation, drawer focus/Escape restoration, on-demand inspect, revoked/expired purging and late-response races. Browser checks cover current settings plus the integrated drawer at desktop/narrow widths. Unit checks do not substitute for visual evidence.

## Next boundaries

PR 2: design the keyed Web/direct conversation surface and v2 SSE reconciling states before implementation; retain optimistic send, same-ID replay, context usage, active-conversation switching and all errors. Expose a read-only OneBot direct timeline. PR 3: design shared participant/addressing, wake/no_output/delivery activities and reorganized access settings before implementation; preserve all old controls and expose unknown delivery without unsafe resend. The inspector and reducer above are reusable foundations for those surfaces.


## PR 1 verification record

- All 35 pre-existing web test files remain unchanged and passed; the new run suite adds 10 tests (36 files / 426 tests in total).
- `tsc --noEmit` and `vite build` passed. The build retains the existing >500 kB bundle warning; this change does not claim a bundle-size optimization.
- In-app browser, real React components and application CSS with temporary deterministic API fixtures: desktop drawer, 320 × 640 narrow view, exact text expansion, partial image/source/hash explanation, Escape close and trigger focus restoration checked. At 320px, both document and dialog scroll widths were 320px. The close control was shortened visually to “关闭” with full accessible label after the narrow check.
- This is component/browser fixture evidence, not evidence of real persisted API authorization or live model behavior. Root integration must verify those server paths. 200% zoom and assistive-technology interaction remain integration checks; they are not claimed from the 320px check.
- Reproducible synthetic [preview, screenshots and test output](./verification/pr1-frontend/README.md) are retained. The temporary server is stopped after validation. No exact context data is stored in browser persistence or the global run slice.
