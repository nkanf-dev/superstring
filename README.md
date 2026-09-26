# Superstring frontend redesign — review gallery

All images use synthetic demonstration data. No real model call or QQ send is represented. Some memory, sticker, delivery and attempt detail screens use read-only browser response fixtures, marked in their captions.

These review assets are separate from the application pull request. No preview servers, credentials, logs or machine paths are included.

## 对话与上下文

### 桌面 Web 对话：独立会话目录、绑定身份与模型、完整消息画布、按会话隔离的输入草稿及实际请求用量。

![桌面 Web 对话：独立会话目录、绑定身份与模型、完整消息画布、按会话隔离的输入草稿及实际请求用量。](screenshots/conversations-web-desktop.png)

### 桌面上下文检查：展示本次请求估算、各组成部分、回复/安全预留和独立的未发送草稿。

![桌面上下文检查：展示本次请求估算、各组成部分、回复/安全预留和独立的未发送草稿。](screenshots/conversations-context-desktop.png)

### 会话身份检查：只读展示会话/来源标识、Agent 绑定版本和参与者，避免把配置编辑身份与当前会话身份混用。

![会话身份检查：只读展示会话/来源标识、Agent 绑定版本和参与者，避免把配置编辑身份与当前会话身份混用。](screenshots/conversations-identity-desktop.png)

### 新建会话：明确选择下一段会话使用的助手，并设置可选名称；不会修改当前会话或助手编辑器。

![新建会话：明确选择下一段会话使用的助手，并设置可选名称；不会修改当前会话或助手编辑器。](screenshots/conversations-create-desktop.png)

### 全局命令面板：产品空间、功能入口与已加载会话分组，支持键盘查找和已有草稿导航守卫。

![全局命令面板：产品空间、功能入口与已加载会话分组，支持键盘查找和已有草稿导航守卫。](screenshots/conversations-command-desktop.png)

### OneBot 历史：只读群聊记录、来源及参与者，独立滚动区域与离开底部后出现的“回到最新”。

![OneBot 历史：只读群聊记录、来源及参与者，独立滚动区域与离开底部后出现的“回到最新”。](screenshots/conversations-onebot-history-desktop.png)

### 会话内运行观测：当前连接/队列/失败/投递未确认状态，以及与当前会话绑定的执行账本入口。

![会话内运行观测：当前连接/队列/失败/投递未确认状态，以及与当前会话绑定的执行账本入口。](screenshots/conversations-onebot-runtime-desktop.png)

### 窄屏会话目录：独立 Sheet 承载搜索、渠道过滤、创建及会话操作，主对话画布不被永久侧栏挤压。

![窄屏会话目录：独立 Sheet 承载搜索、渠道过滤、创建及会话操作，主对话画布不被永久侧栏挤压。](screenshots/conversations-directory-mobile.png)

### 窄屏 Web 对话：保留身份、消息、草稿与上下文入口；目录和产品导航分别按需打开。

![窄屏 Web 对话：保留身份、消息、草稿与上下文入口；目录和产品导航分别按需打开。](screenshots/conversations-web-mobile.png)

### 窄屏上下文检查：同一预算明细通过可滚动 Popover 展示，不删减桌面可见信息。

![窄屏上下文检查：同一预算明细通过可滚动 Popover 展示，不删减桌面可见信息。](screenshots/conversations-context-mobile.png)

### 窄屏 OneBot 历史：群聊来源、只读语义、消息滚动与最新入口保持完整。

![窄屏 OneBot 历史：群聊来源、只读语义、消息滚动与最新入口保持完整。](screenshots/conversations-onebot-history-mobile.png)

### 窄屏当前会话运行状态：队列/运行数、失败唤醒、未确认投递及采样时间清晰可读。

![窄屏当前会话运行状态：队列/运行数、失败唤醒、未确认投递及采样时间清晰可读。](screenshots/conversations-onebot-runtime-mobile.png)

## 接入与模型

### 接入 / 会话绑定、参与状态与筛选

![接入 / 会话绑定、参与状态与筛选](screenshots/connections-bindings.png)

### 接入 / OneBot 传输与本机凭据

![接入 / OneBot 传输与本机凭据](screenshots/connections-transport.png)

### 接入 / 手动绑定会话

![接入 / 手动绑定会话](screenshots/connections-bind-dialog.png)

### 会话设置 / 参与与覆盖

![会话设置 / 参与与覆盖](screenshots/connections-binding-participation.png)

### 会话设置 / 重要的人

![会话设置 / 重要的人](screenshots/connections-binding-attention.png)

### 会话设置 / 记忆整理

![会话设置 / 记忆整理](screenshots/connections-binding-memory.png)

### 共享方案 / 参与方式、时序与判断

![共享方案 / 参与方式、时序与判断](screenshots/connections-scheme-participation.png)

### 共享方案 / 如何回应

![共享方案 / 如何回应](screenshots/connections-scheme-response.png)

### 共享方案 / 读取什么

![共享方案 / 读取什么](screenshots/connections-scheme-context.png)

### 共享方案 / 媒体与表达

![共享方案 / 媒体与表达](screenshots/connections-scheme-media.png)

### 接入 / 数据与保留、运行调度事实

![接入 / 数据与保留、运行调度事实](screenshots/connections-storage.png)

### 模型服务 / 服务目录与本地模型

![模型服务 / 服务目录与本地模型](screenshots/models-providers.png)

### 模型服务 / 服务配置与模型容量

![模型服务 / 服务配置与模型容量](screenshots/models-provider-editor.png)

### 模型服务 / 整理、知识与判断模型用途

![模型服务 / 整理、知识与判断模型用途](screenshots/models-defaults.png)

### 窄屏 / 模型用途与默认值

![窄屏 / 模型用途与默认值](screenshots/models-defaults-mobile.png)

## 运行观测

### 执行账本：按请求/触发链路分组，查看任务、来源、状态、模型与命中步骤。合成本地记录。

![执行账本：按请求/触发链路分组，查看任务、来源、状态、模型与命中步骤。合成本地记录。](screenshots/runs-01-ledger.png)

### 高级筛选：通道、阶段、状态、实际模型、关联对象与时间范围；筛选匹配链路，展开保持完整因果上下文。

![高级筛选：通道、阶段、状态、实际模型、关联对象与时间范围；筛选匹配链路，展开保持完整因果上下文。](screenshots/runs-02-filters.png)

### 独立调查工作台：按真实父子关系排列的时间轴，唤醒、模型、表情和投递各阶段可追踪。合成时间样本。

![独立调查工作台：按真实父子关系排列的时间轴，唤醒、模型、表情和投递各阶段可追踪。合成时间样本。](screenshots/runs-03-waterfall.png)

### 模型调用列表：独立呈现任务、调用阶段、实际请求模型、状态与耗时。

![模型调用列表：独立呈现任务、调用阶段、实际请求模型、状态与耗时。](screenshots/runs-04-model-calls.png)

### 模型输入：显式核验来源权限后读取精确输入，提供搜索、换行、复制与来源信息。正文为合成测试文本。

![模型输入：显式核验来源权限后读取精确输入，提供搜索、换行、复制与来源信息。正文为合成测试文本。](screenshots/runs-05-model-input.png)

### 模型输出：与输入分开展示保留的实际响应及其完整/部分/不可用状态。响应来自本地合成 gateway。

![模型输出：与输入分开展示保留的实际响应及其完整/部分/不可用状态。响应来自本地合成 gateway。](screenshots/runs-06-model-output.png)

### 来源与版本：检查当前上下文的来源版本；这份合成独立任务没有附加来源引用，界面保持真实空状态。

![来源与版本：检查当前上下文的来源版本；这份合成独立任务没有附加来源引用，界面保持真实空状态。](screenshots/runs-07-sources.png)

### 运行详情：从步骤原位进入所属运行，保留阶段序列、调用模型、时间和上下文检查入口，不叠加二级模态。

![运行详情：从步骤原位进入所属运行，保留阶段序列、调用模型、时间和上下文检查入口，不叠加二级模态。](screenshots/runs-08-run-detail.png)

### 逐段投递证据：文本已确认、贴图回执未知，清楚区分部分送达与完成。该缺省场景通过浏览器只读契约 fixture 注入，未发送任何 QQ 消息。

![逐段投递证据：文本已确认、贴图回执未知，清楚区分部分送达与完成。该缺省场景通过浏览器只读契约 fixture 注入，未发送任何 QQ 消息。](screenshots/runs-09-delivery.png)

### 独立链路比较：两侧分别呈现请求身份、时长与模型调用，证据读取独立鉴权，不混合上下文。

![独立链路比较：两侧分别呈现请求身份、时长与模型调用，证据读取独立鉴权，不混合上下文。](screenshots/runs-10-compare.png)

### 后台任务的运行尝试：通过知识整理任务入口检查多次执行，当前选择最新一次。尝试关联由浏览器只读合成元数据提供。

![后台任务的运行尝试：通过知识整理任务入口检查多次执行，当前选择最新一次。尝试关联由浏览器只读合成元数据提供。](screenshots/runs-11-attempts.png)

### 历史尝试失败：保留稳定错误码和对应模型步骤，失败记录不覆盖后续成功尝试。合成失败状态。

![历史尝试失败：保留稳定错误码和对应模型步骤，失败记录不覆盖后续成功尝试。合成失败状态。](screenshots/runs-12-attempt-failure.png)

### 窄屏执行账本：工具换行、表格在自身区域横向滚动，页面不被撑宽。390px。

![窄屏执行账本：工具换行、表格在自身区域横向滚动，页面不被撑宽。390px。](screenshots/runs-13-ledger-mobile.png)

### 窄屏调查工作台：保持完整父子步骤与状态，通过内部横向滚动查看时轴。390px。

![窄屏调查工作台：保持完整父子步骤与状态，通过内部横向滚动查看时轴。390px。](screenshots/runs-14-waterfall-mobile.png)

### 窄屏模型证据：展开阅读后独立显示调用身份与实际输出，正文不塞入嵌套弹窗。390px，合成数据。

![窄屏模型证据：展开阅读后独立显示调用身份与实际输出，正文不塞入嵌套弹窗。390px，合成数据。](screenshots/runs-15-evidence-mobile.png)

## 助手工作室

### 助手目录：创建、检索、批量选择与新会话默认助手

![助手目录：创建、检索、批量选择与新会话默认助手](screenshots/library-agent-directory.png)

### 创建助手：名称、简介、模型与补充指令

![创建助手：名称、简介、模型与补充指令](screenshots/library-agent-create.png)

### 助手工作室 · 身份与表达：五项人格与实际编译预览

![助手工作室 · 身份与表达：五项人格与实际编译预览](screenshots/library-agent-identity.png)

### 助手工作室 · 模型与上下文：四用途、容量与压缩预算

![助手工作室 · 模型与上下文：四用途、容量与压缩预算](screenshots/library-agent-models-context.png)

### 助手工作室 · 资料规则：记忆维护与知识访问

![助手工作室 · 资料规则：记忆维护与知识访问](screenshots/library-agent-resource-rules.png)

### 助手工作室 · 检索参数与目录提示词

![助手工作室 · 检索参数与目录提示词](screenshots/library-agent-retrieval-detail.png)

### 390px 窄屏 · English models and context（浏览器只读契约演示数据）（只读浏览器合成响应）

![390px 窄屏 · English models and context（浏览器只读契约演示数据）（只读浏览器合成响应）](screenshots/library-narrow-agent-models-english.png)

## 知识库

### 资料库 · 文档目录：检索、分类、状态与授权

![资料库 · 文档目录：检索、分类、状态与授权](screenshots/library-knowledge-directory.png)

### 文档工作台 · 编辑原文

![文档工作台 · 编辑原文](screenshots/library-knowledge-original.png)

### 文档工作台 · 整理稿与任务结果

![文档工作台 · 整理稿与任务结果](screenshots/library-knowledge-draft.png)

### 文档工作台 · 来源证据

![文档工作台 · 来源证据](screenshots/library-knowledge-sources.png)

### 文档授权：明确授予或撤销助手访问

![文档授权：明确授予或撤销助手访问](screenshots/library-knowledge-grants.png)

### 知识整理设置：自动整理、全局读取预算与模型入口

![知识整理设置：自动整理、全局读取预算与模型入口](screenshots/library-knowledge-settings.png)

### 知识分类创建

![知识分类创建](screenshots/library-knowledge-category-create.png)

### 导入文档：文本或 TXT / Markdown 文件

![导入文档：文本或 TXT / Markdown 文件](screenshots/library-knowledge-import.png)

### 知识分类重命名与修订保护

![知识分类重命名与修订保护](screenshots/library-knowledge-category-edit.png)

### 知识文档批量授权：明确选中对象与授予或撤销

![知识文档批量授权：明确选中对象与授予或撤销](screenshots/library-knowledge-batch-grants.png)

### 390px 窄屏 · 文档编辑（浏览器只读契约演示数据）（只读浏览器合成响应）

![390px 窄屏 · 文档编辑（浏览器只读契约演示数据）（只读浏览器合成响应）](screenshots/library-narrow-knowledge-editor.png)

## 长期记忆

### 记忆目录与维护任务（浏览器只读契约演示数据）（只读浏览器合成响应）

![记忆目录与维护任务（浏览器只读契约演示数据）（只读浏览器合成响应）](screenshots/library-memory-directory.png)

### 记忆分区：读取范围、写入范围与绑定整理批次（浏览器只读契约演示数据）（只读浏览器合成响应）

![记忆分区：读取范围、写入范围与绑定整理批次（浏览器只读契约演示数据）（只读浏览器合成响应）](screenshots/library-memory-partition.png)

### 记忆详情 · 内容（浏览器只读契约演示数据）（只读浏览器合成响应）

![记忆详情 · 内容（浏览器只读契约演示数据）（只读浏览器合成响应）](screenshots/library-memory-content.png)

### 记忆详情 · 来源（浏览器只读契约演示数据）（只读浏览器合成响应）

![记忆详情 · 来源（浏览器只读契约演示数据）（只读浏览器合成响应）](screenshots/library-memory-sources.png)

### 记忆详情 · 修订正文与标签（浏览器只读契约演示数据）（只读浏览器合成响应）

![记忆详情 · 修订正文与标签（浏览器只读契约演示数据）（只读浏览器合成响应）](screenshots/library-memory-correction.png)

### 记忆详情 · 生成配置快照（浏览器只读契约演示数据）（只读浏览器合成响应）

![记忆详情 · 生成配置快照（浏览器只读契约演示数据）（只读浏览器合成响应）](screenshots/library-memory-snapshot.png)

### 手动整理：选择来源对话与已完成轮次（未发起模型任务）

![手动整理：选择来源对话与已完成轮次（未发起模型任务）](screenshots/library-memory-manual.png)

### 390px 窄屏 · 记忆纠正与修订（浏览器只读契约演示数据）（只读浏览器合成响应）

![390px 窄屏 · 记忆纠正与修订（浏览器只读契约演示数据）（只读浏览器合成响应）](screenshots/library-narrow-memory-correction.png)

## 表情素材

### 素材目录：搜索、集合、状态与多选（浏览器只读契约演示数据）（只读浏览器合成响应）

![素材目录：搜索、集合、状态与多选（浏览器只读契约演示数据）（只读浏览器合成响应）](screenshots/library-stickers-directory.png)

### 素材详情：预览、说明、模型草稿与集合（浏览器只读契约演示数据）（只读浏览器合成响应）

![素材详情：预览、说明、模型草稿与集合（浏览器只读契约演示数据）（只读浏览器合成响应）](screenshots/library-stickers-editor.png)

### 素材集合管理（浏览器只读契约演示数据）（只读浏览器合成响应）

![素材集合管理（浏览器只读契约演示数据）（只读浏览器合成响应）](screenshots/library-stickers-collections.png)

### 素材导入（未上传文件）

![素材导入（未上传文件）](screenshots/library-stickers-import.png)

### 素材批量编辑：集合、标签与启停（浏览器只读契约演示数据）（只读浏览器合成响应）

![素材批量编辑：集合、标签与启停（浏览器只读契约演示数据）（只读浏览器合成响应）](screenshots/library-stickers-bulk.png)

### 390px 窄屏 · 素材编辑（浏览器只读契约演示数据）（只读浏览器合成响应）

![390px 窄屏 · 素材编辑（浏览器只读契约演示数据）（只读浏览器合成响应）](screenshots/library-narrow-stickers-editor.png)

### 390px 窄屏 · 素材保存与启停（未执行写入）（浏览器只读契约演示数据）（只读浏览器合成响应）

![390px 窄屏 · 素材保存与启停（未执行写入）（浏览器只读契约演示数据）（只读浏览器合成响应）](screenshots/library-narrow-stickers-actions.png)

## 偏好设置

### 偏好：语言、深浅模式与十六种主题

![偏好：语言、深浅模式与十六种主题](screenshots/library-preferences.png)

### 偏好 · 深色主题

![偏好 · 深色主题](screenshots/library-preferences-dark.png)

### Preferences · English localization

![Preferences · English localization](screenshots/library-preferences-english.png)

### 390px 窄屏 · 偏好与深色主题（浏览器只读契约演示数据）（只读浏览器合成响应）

![390px 窄屏 · 偏好与深色主题（浏览器只读契约演示数据）（只读浏览器合成响应）](screenshots/library-narrow-preferences-dark.png)

### 390px 窄屏 · English Preferences（浏览器只读契约演示数据）（只读浏览器合成响应）

![390px 窄屏 · English Preferences（浏览器只读契约演示数据）（只读浏览器合成响应）](screenshots/library-narrow-preferences-english.png)

