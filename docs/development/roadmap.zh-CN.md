# 开发路线

[English](roadmap.md) | **简体中文**

更新：**2026-10-24**（Asia/Shanghai）· 产品基线：**v3.7.0** · 规划基线：**`d3c95232a18cb297bbd836c4deda117749e90ee4`**

Claude Code Statusline 专注于清楚呈现任务、子代理、项目和用量信息，并保持 CLI 与两个编辑器的配置行为一致。首次设置、完整显示方案、显式启用的扩展及 M4–M7 已交付。后续产品顺序为首次入口与安装、版本管理、选择性导入、渐变、显式行对齐，最后制作演示（M8–M13）。Git 调用核查和 Windows 预览一致性作为优先独立维护。GIT-01、TERMINAL-01、SETUP-02、UPDATE-01 正在为 v3.8.0 验证（VALIDATING），其余四个未来工作包保持 NOT_STARTED，含 CI-01 在内的已交付工作保持 DONE。

本页维护产品方向、优先级和工作包状态。[开发计划](development-plan.zh-CN.md)定义范围、依赖及验收，链接的交付记录保存实现与发布证据。公开这些规划文档不会启动功能开发或改变工作包状态。

**导航：** [当前基线](#baseline) · [参考与致谢](#reference) · [阶段路线](#milestones) · [候选池](#candidates) · [工作包说明](#packages) · [验收要求](#acceptance) · [交付历史](#delivery-history) · [文档维护](#maintenance)

<a id="baseline"></a>

## 当前基线与产品方向

| 方面 | 已交付能力 | 后续规划依据 |
| --- | --- | --- |
| 配置入口 | 首次设置向导、会话内编辑器、外部 TUI、CLI、对话指南及 Quick setup | 将包安装及持久入口接到已有 setup，增加显式版本管理 |
| 显示组合 | 六种既有预设、三套完整方案、组件实例、复制／排序、文字、spacer、导入审阅、颜色、五项 Powerline 控制、可选百分比短条及联动分组 | 增加选择性复用、静态前景／Powerline 背景渐变及主栏显式行对齐 |
| 任务与项目 | 任务计时、子代理独立行、只读任务详情、命名方案和项目根目录绑定 | 将任务与多代理场景作为主要特色 |
| 语言 | `en`、`zh-CN`、`zh-TW`、`zh-HK`、`ja`、`ko`；界面语言与输出语言独立 | 新交互和说明保持六语言覆盖 |
| 显示目录 | 主栏 65 个指标、子代理 15 个指标；加上文字与留白后为 67／17 个类型 | 新增显示项时保留现有 ID 与指标口径 |
| 已有数据 | 宿主 `pr` 编号／评审状态、linked worktree 回退、prompt-cache 命中率／写入量、缓存状态／到期／miss 原因及最新请求输出速率 | 考虑新指标时保留已有作用域与口径 |
| 扩展数据 | 本机 JSON、可独立审核自动刷新的 GitHub PR／CI、明确命令源；双编辑器及 CLI 管理；可选 OSC 8 链接 | 授权与显示方案分离，导入时移除本机绑定 |
| 接口 | 显示 schema 13、编辑器协议 21、来源注册表／任务 2、观测 1、runtime 3、lifecycle 4、portable 1、UI preferences 1；方案集合／导出 1 | 分别说明每个接口的兼容路径 |
| 支持边界 | Linux／WSL、Windows、macOS；产品运行时 Node 22／24 | 保留支持范围，记录实际验证结果 |

依据：[v3.7.0 发布记录](../releases/v3.7.0.md)、[M4–M7 交付](m4-m7-delivery.zh-CN.md)、[扩展交付](extensions.zh-CN.md)、[目录源码](../../packages/core/src/config/catalog-data.ts)、[编辑器协议](../../packages/core/src/contracts/ui.ts)、[方案管理](../PROFILES.zh-CN.md)、[任务详情](../TASK_DETAILS.zh-CN.md)和[架构](architecture.zh-CN.md)。规划基线为本次文档修订前的 main；v3.7.0 发布身份与验证限制仍由交付记录维护。

默认能力使用 Claude 输入与本地状态。联网查询和自定义命令分别显式启用，导入显示方案、绑定项目或选择预设不会启用这些能力。

[Issue #96](https://github.com/fbincon/claude-code-statusline/issues/96) 记录的六项既有缺口继续为**未验证**。包括 [v3.7.0 专项决定](../releases/approvals/v3.7.0.json)在内的限定版本接受，记录的是允许带这些缺口发布，不代表缺失检查已通过，也不豁免新增失败。

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
| 优先独立维护 | [GIT-01](development-plan.zh-CN.md#git-01) | 核实直接／间接 Git 调用及必要防护，保留受支持过滤器兼容性 | 既有 Git 采集、来源身份与进程适配 | VALIDATING |
| 优先独立维护 | [TERMINAL-01](development-plan.zh-CN.md#terminal-01) | setup、configure、slash 入口的 Windows 预览颜色一致或差异有明确解释 | 既有终端探测／启动路径；[Issue #130](https://github.com/fbincon/claude-code-statusline/issues/130) | VALIDATING |
| M8 首次入口 | [SETUP-02](development-plan.zh-CN.md#setup-02) | 无参数／npx 入口串联 npm 全局安装、持久绑定和已有 setup | 已交付 SETUP-01 及安装／恢复机制 | VALIDATING |
| M9 版本管理 | [UPDATE-01](development-plan.zh-CN.md#update-01) | 显式版本检查、升级、回退及失败恢复 | SETUP-02 的安装身份及既有兼容／恢复规则 | VALIDATING |
| M10 配置复用 | [IMPORT-01](development-plan.zh-CN.md#import-01) | 先选择全局外观，再选择完整主栏／子代理分区导入 | 既有导入审阅、实例、分组、布局与方案事务 | NOT_STARTED |
| M11 渐变 | [APPEARANCE-04](development-plan.zh-CN.md#appearance-04) | 预设及自定义的静态组件前景、Powerline 背景渐变 | 既有颜色、Powerline、分组及编辑规则 | NOT_STARTED |
| M12 跨行对齐 | [COMPOSITION-03](development-plan.zh-CN.md#composition-03) | 主栏显式多行对齐，明确隐藏／分组／spacer／窄行行为 | 既有显式布局、分组、Unicode 宽度与拟合 | NOT_STARTED |
| M13 演示 | [SHOWCASE-01](development-plan.zh-CN.md#showcase-01) | 已验收新能力的首页、方案展示及可复现流程 | M8–M12 全部完成并验收；匹配的安装包 | NOT_STARTED |

M8 → M9 → M10 → M11 → M12 → M13 是选定的产品顺序。排期不额外制造技术依赖：导入不依赖版本管理，对齐不依赖渐变。各工作包可拆成有界切片交付，后续选项仍须保持导入／导出兼容。SHOWCASE-01 保留 ID，等待选定的 M8–M12 全部功能完成并验收，包括 IMPORT-01 的两个切片；其他候选不阻塞演示。

GIT-01 和 TERMINAL-01 优先、独立推进；相关 Windows 预览与演示验收应纳入 TERMINAL-01 的结果。GIT-01 已实现共享调用策略并正在验证，详见[实现与兼容记录](m8-m9-delivery.zh-CN.md)。历史隔离观察与平台／产物验收分别记录。

M4–M7 已通过四个独立功能 PR 和最终发布 PR 随 v3.7.0 交付。[实现与验收记录](m4-m7-delivery.zh-CN.md)保存起始提交、接口决定及实际证据；工作包完成与版本发布分别记录。

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
| M4 图形指标 | [APPEARANCE-03](development-plan.zh-CN.md#appearance-03) | 上下文／额度可选短进度条及可读文字回退 | 既有已观测百分比、组件选项和布局 | DONE |
| M5 组件分组 | [COMPOSITION-02](development-plan.zh-CN.md#composition-02) | 装饰随指标隐藏，可合并 Powerline 色块 | 既有实例、条件显示与 Powerline | DONE |
| M6 GitHub 刷新 | [WORKFLOW-02](development-plan.zh-CN.md#workflow-02) | 独立启用的 PR／CI 自动刷新，状态及停止操作明确 | 已交付 EXTENSIONS-01、WORKFLOW-01 | DONE |
| M7 派生指标 | [METRICS-01](development-plan.zh-CN.md#metrics-01) | 明确按会话／API 时间折算的每小时费用 | 既有已观测会话费用与耗时字段 | DONE |
| 按需工程支持 | [CAPABILITIES-01](development-plan.zh-CN.md#capabilities-01) | 组件支持选项与说明一致 | 外观或扩展暴露的具体元数据需求 | DONE |
| 独立维护 | [CI-01](development-plan.zh-CN.md#ci-01) | Actions 引用固定、可核查更新 | 当前工作流清单 | DONE |

M1 → M2 → M3 → M4–M7 记录历史交付顺序，保留已完成 ID 及证据。SHOWCASE-01 原列于 M2，后安排在 M8；现仍未启动，移至选定新功能之后的 M13。CI-01 已作为独立维护完成，其 Dependabot 每周更新提议及验证记录在 [CI 维护](ci-maintenance.zh-CN.md)。

<a id="candidates"></a>

## 候选池与进入条件

选择性导入、渐变和主栏显式行对齐已分别进入 [IMPORT-01](development-plan.zh-CN.md#import-01)、[APPEARANCE-04](development-plan.zh-CN.md#appearance-04)、[COMPOSITION-03](development-plan.zh-CN.md#composition-03)。范围与状态在主线及工作包维护，不在下表重复记账。

### 功能候选

| 候选 | 用户场景与最小切片 | 依据与进入条件 |
| --- | --- | --- |
| 新的 token 速率视图 | 查看已观测会话或近期窗口的 token 吞吐，先选一种作用域 | 定义耗时、token 包含范围、重放去重及主／子代理归属；保留已有最新请求 `output-rate` 的含义 |
| 新的缓存视图 | 查看选定请求／会话范围内的读写量或比率 | 已有 `prompt-cache` 提供命中率／写入量；要求独立需求、权威字段和明确分母 |
| 每日剩余预算 | 显示已验证的每日额度剩余或明确标识的用户预算 | 可靠金额、币种、新鲜度、完整周期边界及时区；仅有 `monthly` 标签不足以推算 |
| 配额消耗节奏与时间游标 | 对照额度消耗与已验证的窗口进度 | 明确窗口边界、经过时间含义及未知时行为，区分倒计时、消耗和估算 |
| 命令源自动刷新 | 在选定上下文中重复一个明确的有界命令 | 独立决定重复执行授权、输入、间隔、并发、启动／停止和失败结果；TTL 不等于执行许可 |
| GitLab 提供方 | 查看分支的合并请求与 CI，先做手动只读查询 | 实际需求、权威字段、既有认证与仓库／分支／HEAD 身份，定义 GitLab 特有状态 |
| Gitee 提供方 | 查看分支的拉取请求与 CI，先做手动只读查询 | 实际需求、权威字段及提供方自己的认证／身份；仓库镜像是另一件事 |
| 服务状态 | 显示所选服务公开的状态及新鲜度 | 可靠来源，明确不可用／过期状态；全局服务状态不代表个人请求或网关健康 |
| Voice 配置提示 | 显示已观测的语音输入配置 | 验证配置优先级与可用性；配置启用不代表正在录音 |
| Sandbox 配置提示 | 显示已观测的沙箱配置 | 验证受管／CLI 覆盖与可用性；配置启用不代表实际隔离已生效 |

### 配套候选

| 候选 | 用户场景与最小切片 | 依据与进入条件 |
| --- | --- | --- |
| 贡献指南 | 帮助贡献者完成一次有界修改 | 可复现的模块职责、适用检查、翻译及生成资源路径，复用已有指南 |
| 普通问题／功能模板 | 收集预览反馈之外的可操作报告 | 最少的版本／环境／复现信息，明确区分缺陷与能力请求 |
| 迁移说明 | 帮助用户将已有配置映射到本产品 | 已验证的来源／目标版本、能力映射、手动步骤和恢复方法，不承诺无损自动转换 |

### 较远方向

| 候选 | 用户场景与最小切片 | 依据与进入条件 |
| --- | --- | --- |
| JJ | 为真实使用者的仓库显示 Jujutsu 状态 | 明确需求、可靠输出及可用性／身份语义，先选只读字段 |
| 其他客户端 | 在指定客户端复用选定能力 | 已验证的输入／生命周期契约及具体接入／支持边界 |
| 插件市场 | 发现和管理第三方组件 | 实际扩展使用情况及选定的分发、信任、兼容和生命周期模型 |
| 自动脚本下载 | 获取指定外部组件 | 单独选定来源、完整性、审阅、安装与移除设计 |
| 通用 Shell 模式 | 支持确实需要 Shell 解释的具体命令 | 在既有可执行文件／argv 来源之外，单独设计交互和执行授权 |

候选不分配版本或日期。列入候选池不启动开发，也不成为 M8–M13 的完成条件。仅在明确决定范围并更新对应工作包后升入主线，按独立用户需求与数据定义评估，不以组件数量排序。

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
| v3.7.0 | APPEARANCE-03、COMPOSITION-02、WORKFLOW-02、METRICS-01 | DONE | [图形、分组、刷新与速率](m4-m7-delivery.zh-CN.md) |

链接的记录保留源码／标签身份、校验值、CI 结果、渠道验证、恢复经过及交付时的限制。历史记录中对后续候选的表述保留原有语境；本页更新时的规划状态以上述阶段表为准。早期迁移里程碑由 [TypeScript 重构计划](typescript-migration.zh-CN.md)维护，发布说明在 [releases](../releases) 目录维护。

CI-01 已作为仓库维护完成，本次没有新产品版本；[验证与更新方法](ci-maintenance.zh-CN.md)记录最终 PR／main 矩阵、手动工作流检查及保留的失败历史。

<a id="maintenance"></a>

## 文档维护与交接

本路线图和[开发计划](development-plan.zh-CN.md)均维护英文与简体中文版本。本页更新阶段及状态，开发计划更新范围及验收，相关交付记录保存实际实现／发布证据。状态使用 `NOT_STARTED` → `IN_PROGRESS` → `VALIDATING` → `DONE`；文档修改不推进功能状态。

未来规划与稳定版使用说明分别维护。同步更新双语文档，保留工作包 ID 和章节锚点，说明范围或依赖的变化。新增对贡献者有用的记录时，在开发指南中补充入口。

执行 `npm run docs:check` 与 `git diff --check`，核对双语 ID、依赖、状态及已交付事实，并在仅含已提交文件的检出目录验证链接。本机规划归档与原始验收记录继续保留在本地，不作为公开文档的依赖。
