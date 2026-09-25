# PR 2 / PR 3 conversation design before implementation

This design follows the reviewed architecture and the PR 1 feature-preservation inventory. No existing function may be simplified or downgraded. This document describes component behavior before changing those components. Wire contracts are owned by the backend/shared-contract changes; proposed fields below are requirements, not a second DTO definition in the frontend.

## Current surface and consequences

`features/chat/actions.ts` stores one `messages`, `composer`, `runtimeConfig`, `contextUsage`, `failedChat`, `knowledgeResend` and `sending`. Its stream callback stops applying events when another session is selected. `SessionList` disables every session during any send. `ChatPage` shows the single message list and error; `ContextUsagePanel` also follows that single state. This cannot safely support simultaneous Web conversations or a read-only OneBot timeline.

Keep the existing Web session lifecycle (create/default/custom name, Agent selection, rename, refresh, delete, message deletion, error/partial states, retry, changed-knowledge-permission confirmation), all context-use data and every settings surface. New conversation state makes in-progress sessions independently navigable. The visible surface continues to use the current typography, spacing, themes and localized terms.

## Libraries and component primitives

Continue React, Zustand and Radix. PR 1 already provides an accessible Dialog and diagnostic drawer. The new-session chooser becomes Radix Dialog with the current choice of default/custom naming; selected Agent controls remain intact. Native textarea/button/select semantics remain suitable. For contextual operations, prefer Radix Context Menu/Dropdown Menu over copying the current manual positioning, pointer-outside and arrow-key code. Existing destructive confirmations continue to use Radix Alert Dialog.

SSE framing should use [eventsource-parser](https://github.com/rexxars/eventsource-parser), reviewed against its primary documentation before implementation. It handles arbitrary chunk splits, SSE comments and multi-line fields. The application owns strict RunEvent validation and completion/reconciliation. Do not add the library's automatic reconnect semantics to POST requests: reconnecting blindly would undermine request ownership and delivery semantics. Pin the actual installed package version at implementation time. Radix references: [Dialog](https://www.radix-ui.com/primitives/docs/components/dialog), [Context Menu](https://www.radix-ui.com/primitives/docs/components/context-menu), [Dropdown Menu](https://www.radix-ui.com/primitives/docs/components/dropdown-menu).

Motion and Effect remain candidates only if an actual requirement calls for them. The conversation view needs stable content, focus and readable transitions; no ornamental animation or alternative global state engine is introduced. Reuse the existing context ring and design tokens, keeping reduced-motion behavior.

## Shared conversation selection and keyed state

Canonical conversation ID is the state key. The backend summary provides `sourceId` to correlate Web `sessionId` and OneBot `bindingId`. Selecting a Web session resolves its canonical conversation before sending, via a filtered source lookup or equivalent backend projection. Do not load every conversation page just to find one Web session. Creating a Web session must make the same lookup possible immediately.

The conversation slice owns `byId` and selection. Each entry contains metadata, ordered messages/events, load/error state, composer draft, runtime configuration, latest context usage, pending request, last conversation-event sequence and recovery phase. The run slice remains keyed by run ID. These are different cursors and different records. Setting the active selection never moves live text between entries. Every async operation captures its conversation/session IDs; results always update their own entry even when another conversation is selected.

There is one mutable source for each field. Existing component selectors/actions are migrated to the keyed slice, and old global chat fields are removed after their consumers and tests move. Compatibility read selectors may project the active entry; there must not be two independently writable message lists. Old tests are adapted to the same behavioral assertions with keyed fixtures, not deleted to avoid failures.

Operation ownership:

| Operation | State affected | Visible behavior |
| --- | --- | --- |
| Select A while B streams | Selection + A load only | B keeps accumulating its own deltas; sidebar shows B active |
| Send A | A draft, request and optimistic rows | A composer disabled for this request; B may send independently |
| Refresh A | A authoritative messages/runtime | A's pending partial must not be marked completed by missing terminal evidence |
| Rename A | Session metadata + A title | Preserves A draft, stream and selection |
| Delete A | A plus source/run transient caches | Only A's own active mutation blocks deletion; B does not globally lock A |
| Delete message in A | A authoritative source/message state | Clear A's stale context accounting and exact inspection; retain existing confirmation |
| Failed request in background A | A recovery/error state | No error banner is injected into unrelated B |

## PR 2: Web conversation and stream lifecycle

The main header preserves session title, Agent name and current mode. Add a quiet phase indicator and a run-details entry associated with the active/latest run. The message area preserves existing timestamps, user/model distinction, failed/cancelled partial content and message actions. No-output is an activity result, never an empty assistant bubble.

Composer: one draft per conversation; preserve Enter/Shift+Enter and IME behavior, current send/clear behavior and accessibility labels. Context usage stays adjacent and shows the same model, input/budget/reserves/component breakdown, unmeasured states and draft-byte estimate. `context_usage` updates only the originating conversation/run. A late usage response for A must not replace B's panel.

Stream state transitions:

```text
idle → submitting → active (started/steps/deltas) → terminal + authoritative message reload
                      ↘ EOF/network error without terminal → reconciling
reconciling → by-request lookup → known run → run snapshot + authoritative messages
                                     ↘ still active → remain reconciling; refresh/poll read-only status
                                     ↘ failed/cancelled → keep partial + existing explicit retry
                                     ↘ completed/no_output → show confirmed result
           ↘ no run/lookup failure → visible unresolved state; explicit check-result action
```

Before first SSE frame, request identity is `sessionId + clientRequestId`. Afterwards the run ID/output ID links stream deltas. Terminal outcome is required: EOF does not mean success. Persisted `output_delta` events may intentionally have empty text for retention reasons, so replayed events never reconstruct full replies. Reload existing message data using the authoritative session/message ID. Request lookup must distinguish an absent request from a failed HTTP lookup.

Explicit ordinary retry reuses the same clientRequestId; a completed request replays its persisted result. A `KNOWLEDGE_ACCESS_CHANGED` response keeps the existing separate confirmation, and that explicit resend gets a new clientRequestId and current permissions. No background auto-POST retry. Switching conversation, opening settings or minimizing a panel does not cancel the model stream. A new cancel-generation control is optional new functionality and is not required to preserve the current UI.

New session Dialog: same default-name/custom-name options; initial focus on naming choice; custom input gets focus and supports IME; error stays in dialog; submitting disables duplicate submits; close restores the “新建任务” trigger. All current no-active-Agent guidance remains reachable. Dialog selection does not discard other conversation drafts.

## PR 2: read-only OneBot direct view

The conversation list visibly distinguishes Web from OneBot and uses real participant labels. Opening a OneBot conversation displays its source, Agent binding and direct/shared topology; it does not create a Web session or fake a composer. Private-chat observations and confirmed outgoing messages are read-only source-backed entries. Missing/deleted/expired text has an explicit content-state label. The view never treats an empty projection as an empty original message.

For visible conversation events, request incremental pages using the conversation-local sequence. Apply per-sequence dedupe and update media revisions by source reference instead of emitting duplicate original messages. Hide the polling loop when the document is hidden and abort obsolete requests when switching conversations. Resume from the last successful cursor when visible. A failed poll leaves existing entries visible with a retry/read status, not a replacement blank timeline.

Media uses existing authorized serving endpoints and descriptions. No arbitrary remote media URL is rendered directly from source text. Images, voice descriptions and sticker IDs remain distinguishable even when bytes are unavailable. The initial read-only view must not remove existing sticker/import/description controls from settings.

## PR 3: shared timeline, wake and delivery activity

A shared timeline uses actual speaker labels/IDs and per-message addressing (`@`, reply-to-agent, referenced message); it never pretends the group has one “other user”. Preserve occurred time and source/event references. Ordering follows local sequence, not second-granularity timestamps. Media annotations are visibly attached to the original observation with their own revision/status.

Keep messages and runtime activity as distinct row types within a shared sequence. Ordinary visible items are incoming messages and confirmed own messages. Compact activity rows explain “等待发言机会”, “正在准备”, “本次未发言”, “正在送达”, “发送结果待确认”, and failures. Activity details reveal wake reason, run steps, audience and output parts without filling the chat with internal protocol jargon. RunInspector remains an optional advanced view.

For multiple targets, render one output group per target with independent outcomes. A text part confirmed while a sticker failed is partial delivery; preserve both facts. `unknown` means effect unconfirmed and never gets an ordinary resend button. `stale` shows that the prepared output expired and a new decision may occur. Model run completion is separate from delivery confirmation. Delivery refresh reads `GET /v2/deliveries/:outputId`; it never reopens a completed run or sends a command by inspecting details.

## PR 3: access/settings grouping

Reorganize existing controls using compositional page groups rather than recreating their business forms: connection/transport, bindings, wake & speaking strategy, media/stickers, activity & storage. Keep every input, save whitelist, validation, conflict behavior and preview. QQ judgement model stays global, scheme prompts stay scheme-scoped, Agent model purposes retain the PR 1 effective-value map. Show read/edit scope in headings. Existing unsaved-draft navigation protection remains one central entry point.

The target top-level navigation is 对话 / Agent / 资料 / 接入 / 偏好, but switching nav shape must preserve every current entry including planned/unavailable labels. Create an explicit old-route → new-route table before applying this part; leave a route alias for bookmarks/tests where useful. Do not delete unavailable-feature explanations just because those features have no backend yet.

## Existing route → target group map

| Existing route/view | Target navigation group | Retained content / ownership |
| --- | --- | --- |
| `page=chat` / Web sessions | 对话 → Web | Complete session lifecycle, stream, message operations, model/runtime and context use |
| `settingsView=agents`, `basic` | Agent → 助手管理 | Create, multi-select/delete, enable, default new-session Agent, name/description |
| `management`, `models`, `knowledge-model` aliases | Agent → 模型用途 | Existing mixed-scope page, all independent save groups, availability and one-click overwrite |
| `external-api` | Agent → 模型服务 | Provider endpoint/auth editing, model capacities, tests and removal; application scope |
| `identity`, `expression` | Agent → 身份与表达 | Complete persona, prompts, advanced/extra instructions, intensity |
| `emotion` | Agent → 情绪 | Keep unavailable state and explanation |
| `context` | Agent → 上下文 | All capacity, output, compression, summary, recent-history and timeout fields |
| `long-memory` | 资料 → 长期记忆 | Current-Agent selector; read modes/rules, organization controls and governance |
| `knowledge-config`, `settingsView=knowledge` | 资料 → 知识库 | Agent reading config, global organization/budget, full library and grants |
| `profile` | 资料 → 用户画像 | Keep unavailable state and explanation |
| `settingsView=operating-mode` | 接入 → 运行模式与连接 | Preserve mode availability, external-chat enable, OneBot transport/token/connection and bindings |
| `qq-scheme-config` | 接入 → 聊天方案 | All four triggers, rhythm, window/budget, target reply, media behavior, six prompts and usage |
| `qq-stickers` | 接入 → 表情素材 | Import, annotate, bulk operations, collections, activation and impact preview |
| `qq-storage` | 接入 → 存储与诊断 | Existing usage, retention explanations and expired-only cleanup |
| `settingsView=general/appearance` | 偏好 | Language, appearance, browser persistence, desktop close/lifecycle preferences |
| `settingsView=hub` | Settings overview/alias | Preserve access through the existing settings button and route guards |

The new groups change navigation metadata and composition first; they do not rename stored IDs or change existing save APIs. Preserve route aliases until callers are migrated. Global pages must not acquire an Agent selector that implies per-Agent ownership. A selection in settings must not change the current conversation's Agent or the new-session default unless the original explicit action does so.

## Accessibility, responsive behavior and verification

Phase updates are a polite live region; token deltas are not announced repeatedly. Each message is addressable by speaker and timestamp; group identity never depends only on color. Long IDs/source hashes wrap. Context drawer and new-session dialog maintain focus containment and Escape return through Radix. Keyboard context-menu shortcuts, arrow navigation and existing rename Enter/Escape/IME behavior remain covered when moving to primitives. At 320px the main content fits, controls remain reachable, and overlays use the available viewport; test 200% zoom separately. Current light/dark themes and both locales are required.

PR 2 gates: existing chat/session/context-usage/draft tests plus two simultaneous sessions, switching while streaming, partial+failure, no terminal EOF before/after first frame, read-only reconciliation, same-ID replay, changed-permission new request, out-of-order/replayed seq, usage isolation, delete/refresh of unrelated session, and direct OneBot retention/media states. Browser tests must exercise the integrated routes, not only fixtures.

PR 3 gates: all pre-existing QQ scheme/access/sticker/storage tests; group speakers, mentions/replies, wake/no_output activity with no fake message, independent target outcomes, partial text/sticker delivery, unknown without resend, retention redaction and settings navigation with dirty drafts. Visual evidence covers desktop and narrow group timeline plus each moved settings category. Record unverified live OneBot/NapCat behavior separately from browser/fixture proof.
