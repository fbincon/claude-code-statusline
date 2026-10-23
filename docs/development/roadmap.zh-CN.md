# 开发路线

[English](roadmap.md) | **简体中文**

更新：**2026-10-23**（Asia/Shanghai）· 产品基线：**v3.6.0** · 规划基线：**`2bdf429d3356796232efff926235617cdab4f430`**

Claude Code Statusline 专注于清楚呈现任务、子代理、项目和用量信息，并保持 CLI 与两个编辑器的配置行为一致。首次设置、完整显示方案和显式启用的扩展已交付。后续产品顺序为图形指标 → 组件分组 → GitHub 自动刷新 → 费用速率 → 首页演示，Git 调用核查作为独立维护工作。M4–M7 已选定纳入 v3.7.0，M4 为 VALIDATING；其他未启动工作保持原范围，CI-01 保持已完成。

本页维护产品方向、优先级和工作包状态。[开发计划](development-plan.zh-CN.md)定义范围、依赖及验收，链接的交付记录保存实现与发布证据。公开这些规划文档不会启动功能开发或改变工作包状态。

**导航：** [当前基线](#baseline) · [参考与致谢](#reference) · [阶段路线](#milestones) · [候选池](#candidates) · [工作包说明](#packages) · [验收要求](#acceptance) · [交付历史](#delivery-history) · [文档维护](#maintenance)

<a id="baseline"></a>

## 当前基线与产品方向

| 方面 | 已交付能力 | 后续规划依据 |
| --- | --- | --- |
| 配置入口 | 首次设置向导、会话内编辑器、外部 TUI、CLI、对话指南及 Quick setup | 在演示中复用已交付的配置流程 |
| 显示组合 | 六种既有预设、三套完整方案、组件实例、复制／排序、文字、spacer、导入审阅、颜色及五项 Powerline 控制 | 展示已有方案，按具体需求扩展 |
| 任务与项目 | 任务计时、子代理独立行、只读任务详情、命名方案和项目根目录绑定 | 将任务与多代理场景作为主要特色 |
| 语言 | `en`、`zh-CN`、`zh-TW`、`zh-HK`、`ja`、`ko`；界面语言与输出语言独立 | 新交互和说明保持六语言覆盖 |
| 显示目录 | 主栏 64 个指标、子代理 15 个指标；加上文字与留白后为 66／17 个类型 | 新增显示项时保留现有 ID 与指标口径 |
| 已有数据 | 宿主 `pr` 编号／评审状态、linked worktree 回退、缓存原因诊断与显示 | 清楚区分宿主指标与外部观测 |
| 扩展数据 | 本机 JSON、手动刷新的 GitHub PR／CI、明确命令源；双编辑器及 CLI 管理；可选 OSC 8 链接 | 授权与显示方案分离，导入时移除本机绑定 |
| 接口 | 显示 schema 10、编辑器协议 17、来源注册表／观测 1、runtime 2、lifecycle 4、portable 1、UI preferences 1；方案集合／导出 1 | 分别说明每个接口的兼容路径 |
| 支持边界 | Linux／WSL、Windows、macOS；产品运行时 Node 22／24 | 保留支持范围，记录实际验证结果 |

依据：[v3.6.0 发布记录](../releases/v3.6.0.md)、[扩展交付](extensions.zh-CN.md)、[目录源码](../../packages/core/src/config/catalog-data.ts)、[编辑器协议](../../packages/core/src/contracts/ui.ts)、[方案管理](../PROFILES.zh-CN.md)、[任务详情](../TASK_DETAILS.zh-CN.md)和[架构](architecture.zh-CN.md)。规划基线包含发行源码之后的交付文档；准确的发行身份由交付记录维护。

默认能力使用 Claude 输入与本地状态。联网查询和自定义命令分别显式启用，导入显示方案、绑定项目或选择预设不会启用这些能力。

[Issue #96](https://github.com/fbincon/claude-code-statusline/issues/96) 记录的六项既有缺口继续为**未验证**。包括 [v3.6.0 专项决定](../releases/approvals/v3.6.0.json)在内的限定版本接受，记录的是允许带这些缺口发布，不代表缺失检查已通过，也不豁免新增失败。

<a id="reference"></a>

## 参考项目与致谢

感谢 Matthew Breedlove（[sirmalloc](https://github.com/sirmalloc)）及 [ccstatusline](https://github.com/sirmalloc/ccstatusline) 贡献者的开源工作。其配置体验、展示控制和组件接口，为制定本路线图提供了有价值的设计参考。

下列引用采用已核对的 [ccstatusline v2.2.32 快照](https://github.com/sirmalloc/ccstatusline/tree/bed850187783904a9affcaba1dd80e967622e70b)，列明参考材料与本项目相关工作；具体实现结合本项目的用户需求和架构决定。

| 参考材料 | 本项目相关工作 |
| --- | --- |
| [入口与安装引导](https://github.com/sirmalloc/ccstatusline/blob/bed850187783904a9affcaba1dd80e967622e70b/README.md) | SETUP-01：串联检查、预览、接入与下一步操作 |
| [Powerline 与展示控制](https://github.com/sirmalloc/ccstatusline/blob/bed850187783904a9affcaba1dd80e967622e70b/docs/USAGE.md) | APPEARANCE-01／02、SHOWCASE-01：完整方案、外观控件与演示 |
| [组件能力接口](https://github.com/sirmalloc/ccstatusline/blob/bed850187783904a9affcaba1dd80e967622e70b/src/types/Widget.ts) | CAPABILITIES-01：一致的目录、编辑选项及渲染说明 |
| [链接、PR／CI 与命令组件](https://github.com/sirmalloc/ccstatusline/blob/bed850187783904a9affcaba1dd80e967622e70b/docs/USAGE.md) | LINKS-01、WORKFLOW-01、COMMAND-01：可选导航与外部来源 |
| [Actions 提交固定](https://github.com/sirmalloc/ccstatusline/blob/bed850187783904a9affcaba1dd80e967622e70b/.github/workflows/ci.yml) | CI-01：可核查的依赖身份与遗漏检查 |
| [Git 调用防护](https://github.com/sirmalloc/ccstatusline/blob/bed850187783904a9affcaba1dd80e967622e70b/src/utils/git-hardening.ts) | GIT-01：核查仓库配置触发外部程序的行为及必要防护 |
| [上下文进度条](https://github.com/sirmalloc/ccstatusline/blob/bed850187783904a9affcaba1dd80e967622e70b/src/widgets/ContextBar.ts)与[渲染组合](https://github.com/sirmalloc/ccstatusline/blob/bed850187783904a9affcaba1dd80e967622e70b/src/utils/renderer.ts) | APPEARANCE-03、COMPOSITION-02：可选图形指标及成组显示 |
| [PR／CI 缓存刷新](https://github.com/sirmalloc/ccstatusline/blob/bed850187783904a9affcaba1dd80e967622e70b/src/utils/git-review-cache.ts) | WORKFLOW-02：独立启用、明确生命周期与身份的 GitHub 刷新 |
| [会话费用速率](https://github.com/sirmalloc/ccstatusline/blob/bed850187783904a9affcaba1dd80e967622e70b/src/widgets/SessionCostRate.ts) | METRICS-01：使用既有会话／API 耗时解释每小时费用 |

介绍这些参考时保留原项目与作者署名。复用源码或文档时，应保留适用的版权和许可声明；已核对的项目包含 [MIT 许可证](https://github.com/sirmalloc/ccstatusline/blob/bed850187783904a9affcaba1dd80e967622e70b/LICENSE)。

<a id="milestones"></a>

## 阶段路线与依赖

### 后续主线

| 优先级 | 工作包 | 用户可见结果 | 实现依赖 | 状态 |
| --- | --- | --- | --- | --- |
| 独立维护 | [GIT-01](development-plan.zh-CN.md#git-01) | 核实 Git 调用行为及必要防护 | 既有 Git 采集、来源身份与进程适配 | NOT_STARTED |
| M4 图形指标 | [APPEARANCE-03](development-plan.zh-CN.md#appearance-03) | 上下文／额度可选短进度条及可读文字回退 | 既有已观测百分比、组件选项和布局 | VALIDATING |
| M5 组件分组 | [COMPOSITION-02](development-plan.zh-CN.md#composition-02) | 装饰随指标隐藏，可合并 Powerline 色块 | 既有实例、条件显示与 Powerline | IN_PROGRESS |
| M6 GitHub 刷新 | [WORKFLOW-02](development-plan.zh-CN.md#workflow-02) | 独立启用的 PR／CI 自动刷新，状态及停止操作明确 | 已交付 EXTENSIONS-01、WORKFLOW-01 | NOT_STARTED |
| M7 派生指标 | [METRICS-01](development-plan.zh-CN.md#metrics-01) | 明确按会话／API 时间折算的每小时费用 | 既有已观测会话费用与耗时字段 | NOT_STARTED |
| M8 演示 | [SHOWCASE-01](development-plan.zh-CN.md#showcase-01) | 精简首页、方案展示及可复现的使用演示 | 已验收功能及其匹配安装包 | NOT_STARTED |

M4 → M5 → M6 → M7 → M8 是选定的产品顺序。排期不额外制造技术依赖：组件分组不依赖图形指标，费用速率不依赖自动刷新，各工作包可拆成有界切片交付。SHOWCASE-01 保留原有 ID，安排在功能工作之后；演示使用已验收功能，不要求实现全部未来候选。GIT-01 独立推进；静态比较发现的是待核查的防护差异，不是已确认漏洞，核查及必要修正属于后续开发任务。

已批准的 M4–M7 实现通过独立功能 PR 和最终发布 PR 统一交付 v3.7.0。[实现与验收记录](m4-m7-delivery.zh-CN.md)保存起始提交、接口决定及实际证据；工作包完成与版本发布分别记录。

### 已交付阶段

| 阶段 | 工作包 | 用户可见结果 | 实现依赖 | 状态 |
| --- | --- | --- | --- | --- |
| M1 首次使用 | [SETUP-01](development-plan.zh-CN.md#setup-01) | 从检查到配置、接入和下一步指引的一体化流程 | 既有安装事务与 Quick setup | DONE |
| M2 外观 | [APPEARANCE-01](development-plan.zh-CN.md#appearance-01) | 日常开发、多代理、额度监控三套完整方案 | 已有预设与方案管理 | DONE |
| M2 外观 | [APPEARANCE-02](development-plan.zh-CN.md#appearance-02) | 可配置内边距、分隔及首尾装饰 | APPEARANCE-01 的具体场景 | DONE |
| M3 扩展 | [EXTENSIONS-01](development-plan.zh-CN.md#extensions-01) | 显式启用的本机 JSON 数据组件及来源契约 | 既有诊断与组件实例 | DONE |
| M3 扩展 | [LINKS-01](development-plan.zh-CN.md#links-01) | 可点击 PR／目录等文本及普通文本回退 | 既有文本和布局规则 | DONE |
| M3 扩展 | [WORKFLOW-01](development-plan.zh-CN.md#workflow-01) | 可选 GitHub PR 查询与 CI 状态 | EXTENSIONS-01；LINKS-01 可选 | DONE |
| M3 扩展 | [COMMAND-01](development-plan.zh-CN.md#command-01) | 用户明确配置的外部命令组件 | EXTENSIONS-01 | DONE |
| 按需工程支持 | [CAPABILITIES-01](development-plan.zh-CN.md#capabilities-01) | 组件支持选项与说明一致 | 外观或扩展暴露的具体元数据需求 | DONE |
| 独立维护 | [CI-01](development-plan.zh-CN.md#ci-01) | Actions 引用固定、可核查更新 | 当前工作流清单 | DONE |

M1 → M2 → M3 记录历史交付顺序，保留已完成 ID 及证据。SHOWCASE-01 原列于 M2，现仍未启动，按新顺序安排在 M8。CI-01 已作为独立维护完成，其 Dependabot 每周更新提议及验证记录在 [CI 维护](ci-maintenance.zh-CN.md)。

<a id="candidates"></a>

## 候选池与进入条件

| 候选 | 升入主线前需要的依据 |
| --- | --- |
| 跨行自动对齐、渐变 | 具体多行／配色场景，先明确隐藏项、分组与窄行行为 |
| 选择性配置导入／合并 | 明确可选择的章节，以及实例 ID、行引用、方案和本机绑定的保留规则 |
| 剩余每日预算 | 可靠金额、完整周期边界与时区，不能只凭 `monthly` 标签推算 |
| 额度消耗节奏、时间游标 | 已核实窗口边界、经过时间含义及缺少时间证据时的表现 |
| 命令源自动刷新 | 单独决定重复执行授权、输入、启动／停止和失败结果 |
| GitLab／Gitee 数据提供方 | 实际产品需求、权威字段、既有认证与身份规则；仓库同步另行管理 |
| JJ、服务状态组件 | 明确使用场景与可靠来源，定义可用性语义 |
| 其他客户端、插件市场、自动脚本下载、通用 Shell 模式 | 另行选定范围及交互／授权设计 |

候选不分配版本或日期。列入候选池不启动开发，也不成为六项主线的完成条件。升入主线须明确决定范围并更新对应工作包。

<a id="packages"></a>

## 工作包使用方式

[开发计划](development-plan.zh-CN.md)记录每个工作包的用户问题、范围、模块职责、兼容要求、实施切片与功能验收。后续实施从当时最新的 `main` 开始，选定具体工作包及交付范围。

未启动条目描述设计意图；已完成条目保留历史范围，当前行为和接口以使用指南与链接的实现记录为准。明确区分显示 Save、宿主 Apply 与来源启用的语义。

<a id="acceptance"></a>

## 阶段完成要求

- **流程完整：**验证入口、编辑、预览、保存、重开与实际显示，以及取消和失败的结果。
- **行为一致：**双编辑器及 CLI 共享核心规则，覆盖六语言、Unicode 字素、字体／颜色回退和相关平台。
- **数据可信：**区分样例与真实输入，以及零、缺失、过期、部分和不支持等观测状态，说明来源与作用域。
- **兼容可恢复：**保留实例／方案身份、项目绑定和偏好，验证导入、迁移、并发修改及恢复。
- **交付有据：**分别记录功能合并、工作包完成和版本发布，保留适用的成品与宿主检查；接受的缺口继续按实际验证状态披露。

具体要求见[验收矩阵](development-plan.zh-CN.md#acceptance-matrix)、[测试指南](testing.zh-CN.md)和[发布流程](../RELEASING.zh-CN.md)。纯文档维护只做必要文档检查，不提供产品发布验收证据。

<a id="delivery-history"></a>

## 已交付工作与历史证据

| 版本 | 工作包 | 状态 | 实现与交付记录 |
| --- | --- | --- | --- |
| v3.2.0 | UX-01、UX-02、EXPLAIN-01 | DONE | [配置体验](configuration-experience.zh-CN.md) |
| v3.3.0 | DIAG-01、INPUT-01 | DONE | [真实输入诊断](real-input-diagnostics.zh-CN.md) |
| v3.4.0 | PROFILE-01、PROJECT-01、TASK-01 | DONE | [方案、项目与任务详情](profiles-projects-tasks.zh-CN.md) |
| v3.5.0 | SETUP-01、APPEARANCE-01、APPEARANCE-02 | DONE | [首次设置与完整外观](setup-appearance.zh-CN.md) |
| v3.6.0 | EXTENSIONS-01、LINKS-01、WORKFLOW-01、COMMAND-01、CAPABILITIES-01 | DONE | [扩展与工作流](extensions.zh-CN.md) |

链接的记录保留源码／标签身份、校验值、CI 结果、渠道验证、恢复经过及交付时的限制。历史记录中对后续候选的表述保留原有语境；本页更新时的规划状态以上述阶段表为准。早期迁移里程碑由 [TypeScript 重构计划](typescript-migration.zh-CN.md)维护，发布说明在 [releases](../releases) 目录维护。

CI-01 已作为仓库维护完成，本次没有新产品版本；[验证与更新方法](ci-maintenance.zh-CN.md)记录最终 PR／main 矩阵、手动工作流检查及保留的失败历史。

<a id="maintenance"></a>

## 文档维护与交接

本路线图和[开发计划](development-plan.zh-CN.md)均维护英文与简体中文版本。本页更新阶段及状态，开发计划更新范围及验收，相关交付记录保存实际实现／发布证据。状态使用 `NOT_STARTED` → `IN_PROGRESS` → `VALIDATING` → `DONE`；文档修改不推进功能状态。

未来规划与稳定版使用说明分别维护。同步更新双语文档，保留工作包 ID 和章节锚点，说明范围或依赖的变化。新增对贡献者有用的记录时，在开发指南中补充入口。

执行 `npm run docs:check` 与 `git diff --check`，核对双语 ID、依赖、状态及已交付事实，并在仅含已提交文件的检出目录验证链接。本机规划归档与原始验收记录继续保留在本地，不作为公开文档的依赖。
