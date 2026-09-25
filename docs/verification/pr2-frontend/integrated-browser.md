# PR2 integrated browser verification

2026-09-26. Actual Vite production UI (through `bba755e`) against local Hono routes, SQLite repositories, ConversationHost and AgentRuntime. Isolated in-memory database, synthetic streaming model, no workers or external Bot connection. This verifies application integration, not real model quality or NapCat delivery.

Verified with the Codex in-app browser:

- Send a Web message through the real `/v2/chat`; pending state and disabled send appear, then streamed text and completed state appear.
- Reload: committed user/assistant messages remain visible.
- Send a second turn; actual run inspection shows `next` and `generate` steps and exact generation context containing the previous assistant answer plus the current user input.
- Actual context usage is displayed (571 units first turn, 771 second turn for this fixture).
- Radix new-session dialog receives focus; Escape returns focus to its trigger.
- New-session dialog is readable at 320 × 740. Temporary viewport reset and verification tab closed afterward.

Screenshots: [actual context](integrated-context.png), [320px new-session dialog](new-session-320.png).

The run inspected was `29cf2c9e-b428-4475-9e01-a09af8266b12`; no snapshot text is invented by the frontend fixture. Server source was loaded before later failure-atomicity refinements, which are covered by integration tests separately. OneBot timeline, actual disconnect/replay in a browser, live model and live OneBot remain outside this browser evidence.
