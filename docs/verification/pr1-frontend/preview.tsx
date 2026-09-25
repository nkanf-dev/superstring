import { createRoot } from "react-dom/client";
import type { RunSnapshot } from "../../../src/shared/contracts/agent-run";
import { api } from "../../../src/web/api";
import { JobRunLink } from "../../../src/web/features/runs/RunInspector";
import { useSuperstringStore as store } from "../../../src/web/store";
import "../../../src/web/styles.css";

// Synthetic records only. This page validates components and CSS, not real API authorization.
const now = "2026-09-26T00:00:00.000Z";
const runId = "run-memory-maintenance-20260926-001";
const run: RunSnapshot = {
  runId,
  specId: "memory.organize",
  specVersion: "1",
  owner: { kind: "memory_job", id: "job-demo" },
  status: "completed",
  lastSeq: 5,
  outputs: [],
  startedAt: now,
  endedAt: now,
  errorCode: null,
  steps: ["leaf", "vision"].map((phase, index) => ({
    stepId: `step-${index}`,
    runId,
    stepNo: index + 1,
    model: phase === "leaf" ? "qwen3-32b" : "qwen3-vl",
    phase: phase as "leaf" | "vision",
    status: "completed",
    context: { runId, stepId: `step-${index}` },
    startedAt: now,
    endedAt: now,
    errorCode: null,
  })),
};
store.getState().resetForTests({
  ...api,
  listRuns: async () => ({ runs: [run] }),
  getRun: async () => run,
  inspectRunContext: async (handle) => ({
    status: handle.stepId === "step-1" ? "partial" : "exact",
    layout: [
      { role: "system", units: 148, sourceIds: [] },
      { role: "user", units: 860, sourceIds: ["source-30003"] },
    ],
    sourceVersions: [{ id: "source-30003", revision: "5" }],
    exactMessages: [
      {
        role: "system",
        content: [{ kind: "text", text: "提取可长期保留的事实。保留更正、来源及不确定性。" }],
      },
      {
        role: "user",
        content: [
          {
            kind: "text",
            text: "用户：项目重构必须保留当前所有功能。\n助手：统一 AgentRuntime，保持四档记忆读取与完整知识授权。",
          },
        ],
      },
    ],
    ...(handle.stepId === "step-1"
      ? {
          unavailableMedia: [
            {
              sourceId: "qq-image-source-30003-20260926",
              sha256: "5ca94a3ed221046e8646c849854301857f68d6eb4a30b8027f8a152dba097fff",
              reason: "media_unavailable" as const,
            },
          ],
        }
      : {}),
  }),
});
createRoot(document.getElementById("root") as HTMLElement).render(
  <main style={{ padding: "2rem", maxWidth: "60rem", margin: "auto" }}>
    <p className="hint">SUPERSTRING · UI fixture verification</p>
    <h1>长期记忆</h1>
    <section className="run-step">
      <h2>记忆分区与整理状态</h2>
      <p>QQ · 群 30003 · Agent 研究助手</p>
      <p className="hint">最近整理：整理成功 · 2026-09-26 08:00</p>
      <JobRunLink ownerKind="memory_job" ownerId="job-demo" />
    </section>
  </main>,
);
