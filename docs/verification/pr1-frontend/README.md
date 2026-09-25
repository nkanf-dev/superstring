# PR 1 frontend verification

These screenshots use the real RunInspector, Zustand slice and application styles with deterministic synthetic run responses. They verify layout and interactions only; they do not establish server authorization, model behavior or live OneBot delivery.

Reproduce with `bun run dev:web`, then open `/docs/verification/pr1-frontend/preview.html`. Click “运行详情”; the two steps provide exact-text and partial-image cases. The fixture is a documentation page and is not a production build entry.

- [Desktop drawer](./desktop.png), 1280 × 720: metadata, attempt selector, model steps and close control.
- [Narrow drawer](./narrow-320.png), 320 × 640: no horizontal overflow, identifiers wrap, close control remains reachable.
- [Partial context](./partial-context-320.png), 320 × 640: partial media explanation and on-demand inspection controls.
- [Focused verification output](./focused-tests.txt): run reducer, typed API, inspector request/race/focus handling, model resolution and locale coverage.

Observed browser metrics at 320px: document scrollWidth = 320, dialog scrollWidth = 320. Escape removed the dialog and restored focus to the “运行详情” trigger. The default system dark appearance is shown. Browser viewport overrides were reset and the fixture tab/server closed after verification.

The complete pre-existing 416 tests and initial 10 new tests passed together (36 files / 426 tests). A follow-up test distinguishes maintenance and vision work from conversational reply generation. The full integration run remains the final branch gate. 200% zoom and assistive-technology testing are still pending; a narrow screenshot is not a substitute for either.

## Integrated API browser check (2026-09-26)

[Real application and API screenshot](./integrated-api.png): built production React UI → real Hono routes → in-memory migrated SQLite → AgentRuntime-produced run. A synthetic ModelGateway returned fixed text; no external model or OneBot connection was used. A synthetic knowledge job supplied the owner/source. This checks run lookup and exact-context presentation, not the organizer's model quality or job completion.

Opened Settings → Memory → Knowledge configuration → synthetic document → Run details → actual input. Both original system/user messages matched the persisted step. At 1280px document scrollWidth was 1280; Escape removed the dialog and returned focus to its trigger. The temporary tab/server were closed afterward. No production data was used.
