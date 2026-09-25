import type { Database } from "bun:sqlite";
import type { ConversationEvent, WakeSignal } from "../../../shared/contracts/conversation";
import type { SourceRef } from "../../../shared/contracts/evidence";
import type { AgentRuntime, PreparedOutput } from "../../agent/agent-runtime";
import type { AgentSpec } from "../../agent/agent-specs";
import { ConversationHost } from "../../agent/conversation-host";
import { observationRelevant } from "../../conversation/observation-relevance";
import { AgentRunRepository } from "../../db/agent-run-repository";
import type { ConversationEventRepository } from "../../db/conversation-event-repository";
import type { OutboundIntentRepository } from "../../db/outbound-intent-repository";
import { readQqBinding } from "../../db/qq-binding-repository";
import { recordQqIdleJudgement } from "../../db/qq-dispatch-repository";
import { readQqOwnerIdentity } from "../../db/qq-owner-repository";
import {
  effectiveQqTriggers,
  readQqScheme,
  schemePrompts,
  schemeReply,
  schemeRhythm,
} from "../../db/qq-scheme-repository";
import { readQqSettings } from "../../db/qq-settings-repository";
import { newestMemberMessageSeconds } from "../../db/qq-speech-repository";
import { DEFAULT_USER_ID, getAgentRow, type Orm } from "../../db/repositories";
import type { WakeRepository } from "../../db/wake-repository";
import type { ModelGateway } from "../../llm/model-gateway";
import type { ModuleQueryFactory, ModuleSourceResolver } from "../../modules/composition";
import { captureQqTask, checkQqTask, qqConversationKey } from "../../services/qq-binding-contract";
import {
  attentionTriggerFilter,
  QQ_IMMEDIATE_REPLY_FRESHNESS_SECONDS,
} from "../../services/qq-dispatch";
import { prepareQqJudgement } from "../../services/qq-judgement-preparation";
import type { QqPreparedReply } from "../../services/qq-prepared-reply";
import {
  QQ_JUDGEMENT_RESPONSE_SCHEMA,
  QQ_MEDIA_RULE,
  qqJudgeAllowsSpeech,
  qqJudgeOutcome,
} from "../../services/qq-prompt-contract";
import { speechExpiresAt } from "../../services/qq-retention";
import {
  checkQqSpeechSend,
  disabledKindsFromTriggers,
  isInitiativeSpeech,
  type QqSpeechKind,
} from "../../services/qq-speaking-contract";
import {
  planQqPreparedReply,
  type QqStickerStage,
  selectQqSticker,
} from "../../services/qq-sticker-runner";
import { compileSystemPrompt, runtimeFromAgent } from "../../services/runtime-config";
import { BotContextSource, type BotContextTarget } from "./context-source";
export interface OneBotPolicy {
  maxSteps: number;
  deliveryTtlSeconds: number;
  retentionDays: number;
}
export interface OneBotHostOptions {
  modules?: ModuleQueryFactory;
  resolveSource?: ModuleSourceResolver;
  orm: Orm;
  agentRuntime: AgentRuntime;
  host?: ConversationHost;
  gateway: Pick<ModelGateway, "complete" | "loadedContextCapacity">;
  journal: ConversationEventRepository;
  wakes: WakeRepository;
  outbox: OutboundIntentRepository;
  stickers: QqStickerStage;
  policy: () => OneBotPolicy;
  now?: () => string;
}
/** One host for direct and shared conversations; topology changes targets, not the model loop. */
export class OneBotHost {
  private readonly host: ConversationHost;
  constructor(private readonly options: OneBotHostOptions) {
    this.host = options.host ?? new ConversationHost({ runtime: options.agentRuntime });
  }
  async activate(wake: WakeSignal, signal: AbortSignal) {
    const o = this.options,
      db = (o.orm as Orm & { $client: Database }).$client,
      now = () => o.now?.() ?? new Date().toISOString(),
      seconds = () => Math.floor(Date.parse(now()) / 1000);
    const conversation = o.journal.get(wake.conversationId);
    if (!conversation || conversation.channel !== "onebot11")
      throw new Error("BOT_CONVERSATION_REQUIRED");
    const binding = readQqBinding(o.orm, conversation.sourceId);
    if (!binding || binding.agentId !== conversation.agentId) throw new Error("BINDING_CHANGED");
    const scheme = readQqScheme(o.orm, binding.schemeId),
      agent = getAgentRow(o.orm, binding.agentId);
    if (!scheme || !agent) throw new Error("BOT_CONFIGURATION_MISSING");
    const captured = captureQqTask(binding, "reply", readQqOwnerIdentity(o.orm));
    if (captured.kind !== "captured") throw new Error(captured.reason);
    const snapshot = captured.snapshot,
      runtime = runtimeFromAgent(agent),
      policy = o.policy();
    const path = wake.cause as QqSpeechKind;
    if (!["direct_reply", "follow_up", "chiming_in", "idle_topic"].includes(path))
      throw new Error("BOT_WAKE_CAUSE_INVALID");
    const initiative = isInitiativeSpeech(path),
      split = schemeReply(scheme).split_by_speaker;
    const focus = o.journal.eventsAfter(conversation.id, Math.max(0, wake.throughSeq - 1), 1)
      .items[0];
    const focusKey =
      focus?.source.kind === "qq_event"
        ? focus.source.id
        : focus?.source.kind === "qq_media"
          ? (
              db.query("SELECT event_key FROM qq_media_notes WHERE id=?").get(focus.source.id) as {
                event_key: string;
              } | null
            )?.event_key
          : undefined;
    const settleOpportunity = (readyAtSeconds?: number) =>
      db
        .transaction(() => {
          if (readyAtSeconds !== undefined)
            o.wakes.defer(
              wake.id,
              wake.leaseToken!,
              new Date(readyAtSeconds * 1000).toISOString(),
              now(),
            );
          else {
            o.wakes.complete(wake.id, wake.leaseToken!, "no_output", wake.throughSeq, now());
            o.journal.acknowledge(conversation.id, wake.throughSeq);
          }
        })
        .immediate();
    const focusOccurredAt = focusKey
      ? (
          db.query("SELECT occurred_at_seconds FROM qq_events WHERE event_key=?").get(focusKey) as {
            occurred_at_seconds: number;
          } | null
        )?.occurred_at_seconds
      : undefined;
    if (
      !initiative &&
      (focusOccurredAt === undefined ||
        seconds() - focusOccurredAt > QQ_IMMEDIATE_REPLY_FRESHNESS_SECONDS)
    ) {
      settleOpportunity();
      return { status: "expired" as const };
    }
    // Different immediate causes can describe the same person's already answered input.
    // Coverage belongs to the actual output audience and observed source sequence, not the
    // conversation-wide cursor: replying to one member must not consume another member's turn.
    if (!initiative && focusKey && focus) {
      const covered = db
        .query(`
        SELECT i.status FROM outbound_intents i
        WHERE i.conversation_id=? AND i.source_through_seq>=?
          AND (json_extract(i.target,'$.participantId') IS NULL OR json_extract(i.target,'$.participantId')=?)
          AND i.status IN('confirmed','failed','unknown','stale')
          AND EXISTS(SELECT 1 FROM outbound_parts p WHERE p.intent_id=i.id
            AND p.attempted_at IS NOT NULL AND p.status IN('confirmed','failed','unknown','not_sent'))
        ORDER BY i.status='confirmed' DESC,i.created_at DESC LIMIT 1
      `)
        .get(conversation.id, focus.seq, focus.participant?.id ?? null) as {
        status: string;
      } | null;
      if (covered) {
        settleOpportunity();
        return {
          status: "no_output" as const,
          reason: covered.status === "confirmed" ? "already_replied" : "already_attempted",
        };
      }
    }
    const preparation = () =>
      prepareQqJudgement(
        o.orm,
        {
          bindingId: binding.id,
          path,
          nowSeconds: seconds(),
          ...(focusKey ? { focusEventKey: focusKey } : {}),
        },
        { eligibilityOnly: true },
      );
    let prepared = preparation();
    if (prepared.kind !== "prepared") {
      settleOpportunity(prepared.readyAtSeconds);
      return { status: "no_output" as const, reason: prepared.reason };
    }
    let targets: BotContextTarget[] = [];
    const authorizedTargets: string[] = [];
    const allowed = new Set<string>();
    const setTargets = () => {
      targets =
        prepared.kind !== "prepared"
          ? []
          : binding.kind === "private"
            ? [{ id: binding.peerId, speakerId: binding.peerId }]
            : !split || path === "idle_topic"
              ? [{ id: binding.peerId, speakerId: null }]
              : prepared.targets.map((p) => ({
                  id: p.speakerId ?? "anonymous",
                  speakerId: p.speakerId,
                }));
      if (binding.kind === "group" && split && path === "direct_reply") {
        const attention = attentionTriggerFilter(binding);
        const addressed = o.journal
          .eventsAfter(conversation.id, conversation.consumedSeq, Number.MAX_SAFE_INTEGER)
          .items.filter(
            (e) =>
              e.kind === "inbound" &&
              e.addressing.reasons.some((r) => r === "mention" || r === "reply_to_agent") &&
              seconds() - Math.floor(Date.parse(e.occurredAt) / 1000) <=
                QQ_IMMEDIATE_REPLY_FRESHNESS_SECONDS &&
              (!attention || (!!e.participant?.id && attention.includes(e.participant.id))),
          );
        const byId = new Map(targets.map((t) => [t.id, t]));
        for (const event of addressed) {
          const speaker = event.participant?.id ?? null;
          byId.set(speaker ?? "anonymous", { id: speaker ?? "anonymous", speakerId: speaker });
        }
        targets = [...byId.values()];
      }
      authorizedTargets.splice(0, authorizedTargets.length, ...targets.map((t) => t.id));
    };
    setTargets();
    const assertAuthority = () => {
      signal.throwIfAborted();
      if (!wake.leaseToken || !o.wakes.owns(wake.id, wake.leaseToken, now()))
        throw new Error("WAKE_LEASE_LOST");
      const current = readQqBinding(o.orm, binding.id);
      const check = checkQqTask(snapshot, current, "send", readQqOwnerIdentity(o.orm));
      if (check.kind === "blocked") throw new Error(check.reason);
      if (
        readQqScheme(o.orm, scheme.id)?.revision !== scheme.revision ||
        getAgentRow(o.orm, agent.id)?.configVersion !== agent.configVersion
      )
        throw new Error("BOT_CONFIGURATION_CHANGED");
      const settings = readQqSettings(o.orm);
      if (settings.accountId !== binding.accountId || getAgentRow(o.orm, agent.id)?.isActive !== 1)
        throw new Error("BOT_ACCOUNT_CHANGED");
      const gate = checkQqSpeechSend({
        kind: path,
        featureEnabled: settings.enabled === 1,
        conversationPaused: current?.paused ?? true,
        disabledKinds: disabledKindsFromTriggers(effectiveQqTriggers(current!, scheme)),
      });
      if (gate.kind === "blocked") throw new Error(gate.reason);
      if (o.journal.row(conversation.id)?.closed_at) throw new Error("BINDING_EPOCH_CHANGED");
    };
    const spec: AgentSpec = {
      id: "onebot.main",
      version: "3",
      context: "conversation",
      model: initiative
        ? (readQqSettings(o.orm).judgementModelName ?? runtime.model_name)
        : runtime.model_name,
      instructions: [
        compileSystemPrompt(runtime),
        schemePrompts(scheme).scene,
        QQ_MEDIA_RULE,
        `这是 OneBot ${binding.kind === "private" ? "私聊" : "群聊"}。只向 authorizedTargets 中的目标输出；${split ? "每个目标最多一条回复，由程序添加该目标的 @，不要自行添加。" : "不按发言人拆分，按会话回答。"}`,
        initiative
          ? `这是 ${path} 唤醒。发言前先 invoke speech.evaluate；只有返回 allowed=true 的 targetId 才可 final。没有合适回应时返回 none。`
          : "有人直接与你交流。可查询资料、生成或直接回答，也可保持沉默；不需要群聊兴趣评分。",
        `后续相关消息到来要重新决定尚未发送的计划。复核指导：\n${schemePrompts(scheme).review}`,
      ].join("\n\n"),
      availableActions: [],
      generation: { model: runtime.model_name, allowEmpty: true },
      limits: { steps: policy.maxSteps },
    };
    const baseInstructions = spec.instructions ?? "";
    const observationEpoch = (seq: number) =>
      `${baseInstructions}\n当前观察序列：${String(seq).padStart(20, "0")}。speech.evaluate 的 observedSeq 必须与当前序列相同；新的观察后必须重新评价，不能复用旧结果。`;
    spec.instructions = observationEpoch(0);
    let runId: string | undefined;
    const source = new BotContextSource({
      modules: o.modules,
      resolveSource: o.resolveSource,
      db,
      orm: o.orm,
      gateway: o.gateway,
      agentRuntime: o.agentRuntime,
      journal: o.journal,
      outbox: o.outbox,
      conversationId: conversation.id,
      binding,
      snapshot,
      scheme,
      runtime,
      spec,
      path,
      decisionTier: binding.kind === "private" ? "reply" : "judgement",
      targets: () => targets,
      assertCurrent: assertAuthority,
      now,
      onRead: (seq) => {
        spec.instructions = observationEpoch(seq);
        if (runId) o.journal.linkRun(runId, conversation.id, seq, wake.id);
      },
    });
    const actions = [...source.actions];
    if (initiative)
      actions.push({
        description: {
          name: "speech.evaluate",
          description: "Read the configured per-recipient initiative score and current eligibility",
          parameters: { type: "object", properties: {}, additionalProperties: false },
          capability: "speech.evaluate",
        },
        async execute(_args, action) {
          source.assertCurrent();
          allowed.clear();
          const refs: SourceRef[] = [];
          const p = prepareQqJudgement(
            o.orm,
            { bindingId: binding.id, path, nowSeconds: seconds() },
            { eligibilityOnly: true },
          );
          if (p.kind !== "prepared")
            return { value: { allowed: false, reason: p.reason, targets: [] }, sources: [] };
          const results = [];
          for (const target of targets) {
            const evaluation = await source.prepareEvaluation({
              signal: action.signal,
              target: path === "idle_topic" || !split ? null : target,
            });
            refs.push(...evaluation.sources);
            const raw = await o.agentRuntime.completeLeaf(
              {
                id: "onebot.initiative.evaluate",
                model: evaluation.model,
                limits: { inputUnits: evaluation.inputUnits },
                responseSchema: QQ_JUDGEMENT_RESPONSE_SCHEMA,
              },
              {
                messages: evaluation.messages,
                signal: action.signal,
                owner: {
                  kind: "qq_binding",
                  id: binding.id,
                  userId: DEFAULT_USER_ID,
                  agentId: agent.id,
                },
                sources: evaluation.sources,
                validate: (text) => {
                  const verdict = qqJudgeOutcome(text);
                  if (verdict.kind === "unreadable") throw new Error("JUDGEMENT_UNREADABLE");
                  return verdict;
                },
              },
            );
            const verdict = qqJudgeOutcome(raw);
            const targetId = target.id;
            const yes = qqJudgeAllowsSpeech(verdict, schemeRhythm(scheme).initiative_min_score);
            if (yes) allowed.add(targetId);
            results.push({ targetId, allowed: yes, verdict });
          }
          source.assertCurrent();
          return {
            value: {
              allowed: allowed.size > 0,
              observedSeq: source.observedSeq,
              threshold: schemeRhythm(scheme).initiative_min_score,
              targets: results,
            },
            sources: refs,
          };
        },
      });
    spec.availableActions = actions.map((a) => a.description);
    const audience = () => ({
      topology: conversation.topology,
      participantIds: initiative ? [null] : targets.map((t) => t.speakerId),
      attentionMembers: attentionTriggerFilter(binding) ?? undefined,
    });
    const relevant = (event: ConversationEvent) => observationRelevant(event, audience());
    let recomputes = 0;
    const refresh = async () => {
      source.assertCurrent();
      const updates = o.journal.eventsAfter(
        conversation.id,
        source.observedSeq,
        Number.MAX_SAFE_INTEGER,
      ).items;
      if (!updates.some(relevant)) return false;
      if (recomputes >= schemeRhythm(scheme).max_recompute_count)
        throw new Error("BOT_RECOMPUTE_LIMIT");
      recomputes++;
      prepared = preparation();
      setTargets();
      allowed.clear();
      source.invalidate();
      return true;
    };
    const staged = new Map<string, QqPreparedReply>();
    const reserved = new Set<string>();
    return this.host.activate({
      conversation,
      spec,
      owner: {
        kind: "conversation",
        id: conversation.id,
        userId: DEFAULT_USER_ID,
        agentId: agent.id,
      },
      context: source,
      authorizedTargets,
      actions,
      outputMode: "buffered",
      signal,
      onEvent(event) {
        if (event.type === "started") {
          runId = event.runId;
          o.journal.linkRun(runId, conversation.id, source.observedSeq, wake.id);
        }
      },
      prepareGeneration: (draft, input) => source.prepareGeneration(draft, input),
      prepareOutput: async (draft) => {
        if (split && reserved.has(draft.targetId))
          return { blocked: true, code: "ONE_OUTPUT_PER_SPEAKER" };
        if (draft.kind === "inline" && draft.stickerIds.length > 1)
          return { blocked: true, code: "STICKER_COUNT_EXCEEDED" };
        if (initiative && !allowed.has(draft.targetId))
          return { blocked: true, code: "INITIATIVE_NOT_ELIGIBLE" };
        reserved.add(draft.targetId);
        return { outputId: crypto.randomUUID() };
      },
      beforeFinal: async () => {
        reserved.clear();
        return refresh();
      },
      reconsider: async (outputs) => {
        if (await refresh()) return true;
        for (const output of outputs) {
          if (output.status !== "prepared") continue;
          const raw = output.text ?? "",
            text = split ? raw.replace(/\s*\r?\n+\s*/g, " ").trim() : raw;
          const selection = source.selection;
          if (!selection) throw new Error("BOT_CONTEXT_MISSING");
          const pick =
            output.stickerIds !== undefined
              ? { kind: "chosen" as const, stickerId: output.stickerIds[0] ?? null }
              : await selectQqSticker(
                  o.orm,
                  o.gateway,
                  {
                    bindingId: binding.id,
                    schemeId: scheme.id,
                    schemeRevision: scheme.revision,
                    agentId: agent.id,
                    agentConfigVersion: agent.configVersion,
                    path,
                    text: text || null,
                    messages: selection.messages,
                    nowSeconds: seconds(),
                  },
                  o.stickers,
                  { agentRuntime: o.agentRuntime, signal, sources: source.sources },
                );
          if (pick.kind === "blocked") throw new Error(pick.reason);
          const target = targets.find((t) => t.id === output.targetId)!;
          const pending: QqPreparedReply = {
            text: text || null,
            snapshot,
            schemeRevision: scheme.revision,
            agentConfigVersion: agent.configVersion,
            path,
            nowSeconds: seconds(),

            selection,
            stickerId: pick.kind === "chosen" ? pick.stickerId : null,
            targetSpeakerId: target.speakerId,
          };
          staged.set(output.outputId, pending);
          if (planQqPreparedReply(o.orm, pending, o.stickers).kind !== "planned") {
            output.status = "blocked";
            output.code = "EMPTY_OUTPUT";
          }
        }
        if (await refresh()) return true;
        return outputs.some((output) => output.status === "prepared")
          ? false
          : outputs.length > 0 &&
              outputs.every(
                (output) => output.status === "blocked" && output.code === "EMPTY_OUTPUT",
              )
            ? "no_output"
            : false;
      },
      commitOutputs: async (outputs: readonly PreparedOutput[], currentRunId, terminal) =>
        db
          .transaction(() => {
            source.assertCurrent();
            if (
              o.journal
                .eventsAfter(conversation.id, source.observedSeq, Number.MAX_SAFE_INTEGER)
                .items.some(relevant)
            )
              throw new Error("CONVERSATION_CHANGED_AT_COMMIT");
            for (const [ordinal, output] of outputs.entries()) {
              if (output.status !== "prepared") continue;
              const pending = staged.get(output.outputId);
              if (!pending) throw new Error("OUTPUT_PREPARATION_MISSING");
              const plan = planQqPreparedReply(o.orm, pending, o.stickers);
              if (plan.kind !== "planned") throw new Error("OUTPUT_CHANGED_AT_COMMIT");
              const expiresAt = speechExpiresAt(
                Math.floor(Date.parse(terminal.at) / 1000),
                policy.retentionDays,
              );
              const intent = o.outbox.commit({
                id: output.outputId,
                runId: currentRunId,
                conversationId: conversation.id,
                ordinal,
                target: {
                  accountId: binding.accountId,
                  conversationKind: binding.kind,
                  peerId: binding.peerId,
                  participantId:
                    binding.kind === "group" && split
                      ? (pending.targetSpeakerId ?? undefined)
                      : undefined,
                  agentId: agent.id,
                  bindingId: binding.id,
                  bindingEpoch: conversation.bindingEpoch,
                  bindingRevision: binding.revision,
                  authorityRevision: binding.authorityRevision,
                  ownerIdentityRevision: readQqOwnerIdentity(o.orm)?.revision ?? null,
                  schemeId: scheme.id,
                  schemeRevision: scheme.revision,
                  agentConfigVersion: agent.configVersion,
                  sources: source.sources,
                  attentionMembers: attentionTriggerFilter(binding) ?? undefined,
                },
                speechKind: path,
                sourceThroughSeq: source.observedSeq,
                deliverBy: new Date(
                  Date.parse(terminal.at) + policy.deliveryTtlSeconds * 1000,
                ).toISOString(),
                createdAt: terminal.at,
                expiresAt,
                parts: [...plan.parts],
              });
              o.journal.append({
                conversationId: conversation.id,
                eventKey: `output:${intent.id}`,
                kind: "delivery",
                source: { kind: "outbound_intent", id: intent.id, revision: "planned", expiresAt },
                occurredAt: terminal.at,
                runId: currentRunId,
                outputId: intent.id,
              });
            }
            if (path === "idle_topic")
              recordQqIdleJudgement(o.orm, {
                conversationKey: qqConversationKey({
                  accountId: binding.accountId,
                  kind: binding.kind,
                  peerId: binding.peerId,
                }),
                basisSeconds:
                  prepared.kind === "prepared"
                    ? (newestMemberMessageSeconds(
                        o.orm,
                        {
                          kind: "qq",
                          accountId: binding.accountId,
                          conversationKind: binding.kind,
                          peerId: binding.peerId,
                          agentId: binding.agentId,
                        },
                        { attentionMembers: attentionTriggerFilter(binding) ?? undefined },
                      ) ?? seconds())
                    : Math.floor(Date.parse(focus?.occurredAt ?? now()) / 1000),
                nowSeconds: Math.floor(Date.parse(terminal.at) / 1000),
              });
            o.journal.acknowledge(conversation.id, source.observedSeq);
            o.wakes.complete(wake.id, wake.leaseToken!, terminal.status, source.observedSeq, now());
            o.journal.linkRun(currentRunId, conversation.id, source.observedSeq, wake.id);
            return new AgentRunRepository(db).finishRun(
              currentRunId,
              terminal.status,
              terminal.event,
              terminal.at,
            );
          })
          .immediate(),
    });
  }
}
