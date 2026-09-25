# SKMB-2026-09-26-agent-refactor

- status: accepted
- decided_by: designer
- approval_source: 用户要求“开始实现吧”，明确“按照我们的这个重构文档去做实现”“按照里面的 PR 的边界去拆 PR 拆分支”；此前明确委托自行细化；追加“不要做任何的简化或者降级”。
- date: 2026-09-26
- commit: pending
- patterns: B_state_persistence, C_concurrent_operations, D_external_dependency, E_security_boundary, F_fail_semantics, G_irreversible_action
- scope: 三阶段 AgentRuntime 重构

## Decision

采用 docs/refactor/06-设计决策记录.md 的 A1–A12 与 02–05、08 的具体状态和迁移定义。先迁 leaf，再 direct，再 shared。所有现有功能是硬性兼容约束；增强允许，简化/降级/遗漏不允许。按原用途保留提示词、结构化输出、模型选择、读取模式、预算、维护事务、媒体贴图、多目标回复与 UI 编辑能力。

每个 run 有持久步骤与受权 ContextHandle。来源删除/撤权/到期不能通过快照读回。leaf 不触发会话装配或其他 leaf。主循环 invoke/final/none，外部发送在宿主。Web 保留真实流式和 partial；OneBot 先提交意图再发送，sending 中断为 unknown 不自动重发。会话序号与 run 事件序号分开；失败不吞 wake。

## Applies To

三个核心 PR 的代码、数据库迁移、配置、测试与前端。架构定义详见相邻 refactor 文档；工程补充遵循用户委托并记录偏差，不能静默放弃功能。

## Supersedes

None. 不安装或修改 Git hooks。
