# 开发计划

[English](development-plan.md) | **简体中文** · [路线总览](roadmap.zh-CN.md) · [开发指南](README.zh-CN.md)

本计划说明如何定义工作包的范围、依赖、实施切片和功能验收。[路线图](roadmap.zh-CN.md)维护优先级与状态，[历史索引](history/README.zh-CN.md#delivery-records)汇集实现、发布和验证证据。现行用法见[使用指南](../USER_GUIDE.zh-CN.md)，语言维护见[翻译指南](i18n.zh-CN.md)。

<a id="work-index"></a>

## 工作包索引

- **现行规划** · [未选候选与进入条件](roadmap.zh-CN.md#candidates) · [共同设计约定](#design-rules) · [验收矩阵](#acceptance-matrix) · [交接](#handoff)
- **已交付工作** · [原始设计](history/work-package-designs.zh-CN.md#completed-designs) · [交付与验证记录](history/README.zh-CN.md#delivery-records)

<a id="design-rules"></a>

## 共同设计约定

- **保持定位：**状态栏负责清楚呈现任务、代理、项目和用量；详情与解释使用既有按需入口。保留真实零值及缺失、过期、部分、不支持等不同状态，不推断没有证据的任务结果。
- **共享实现：**core 保存纯配置、目录、Unicode、布局与解释规则；platform 负责文件、进程和终端；cli 编排服务；tui 与原生 Mod 适配交互。复用既有事务和任务存储。[当前架构](architecture.zh-CN.md)。
- **配置边界：**界面语言立即保存，显示语言和外观随显示 Save 保存，Claude 宿主偏好独立 Apply。预览、导入审阅和方案选择只产生候选草稿。用户级默认、命名方案和项目编辑目标始终可辨认。[方案语义](../PROFILES.zh-CN.md)。
- **兼容：**各接口独立演进，当前版本见[共享契约](contracts.zh-CN.md)。先列明新增字段和旧数据解释，再决定具体版本。旧文件只读加载，实际迁移沿用备份和恢复机制。
- **扩展授权：**默认使用宿主输入及本地状态。外部文件源、联网提供方和命令分别启用，按用户配置登记。显示方案可以引用来源，但导入、预设选择和项目绑定不能授予执行或联网能力。
- **范围界限：**从路线图选定具体工作包，再确定其实施范围。既有 setup、选择性导入、静态组件渐变、显式行对齐、GitHub 自动刷新及 CLI 版本管理保持已交付。其他提供方、数据及较远方向按[候选池](roadmap.zh-CN.md#candidates)进入条件另行决定。全局外观复用沿用既有导入，组件样式与组复用归 IMPORT-02。
- **未来接口：**先写清配置意图、数据流与兼容，再分配未来 schema／协议版本或公开命令名称。复用组件能力目录及生成的编辑器资源；新增选项须贯穿预览、保存／重开、方案选择、导入导出与冲突处理，读取旧配置不会开启新行为。
- **本地化：**遵循[状态、发布及复用规则](i18n-workflow.zh-CN.md)：开发保持 A 完整，B 可安全回退当前英文，公开发布 A/B 全部完成。保留绑定译文的验收、共享消息来源、独立界面／输出持久化及 Native 边界。
- **Native 展示：**保留 v3.9.1 的宿主持有完整状态及有界可见帧。新管理器、任务详情、历史和预览分别约束输出 props、外层 Pane 与 Client 树，包括直接使用 Pane 的路径。保留分页、选中内容、完整字素和彩色预览，缩减展示而不裁剪存储配置。恢复入口位于可能被拒绝的树之外，保留草稿并区分保存成功、进行中和未知结果。沿用既有[容量与恢复](native-capacity.zh-CN.md)规则及适用的实际宿主覆盖。
- **两端能力：**双编辑器共享业务规则和主要能力，布局与控件按平台适配。长列表／详情分页，库、候选草稿和撤销历史留在宿主。只读页面和审阅保留各自的无副作用边界。
- **针对性验证：**按受影响规则选择变更用户流程与相邻组合，扩充现有套件，不要求每个切片新增完整流程、独立 PR 或笛卡尔积矩阵。Ready 产品 PR 与候选晋级沿用当前 [CI 要求](ci-maintenance.zh-CN.md)，本次规划不修改验收策略。

<a id="acceptance-matrix"></a>

## 功能验收矩阵

| 验收面 | 适用范围 | 完成依据 |
| --- | --- | --- |
| 用户流程 | 受影响的用户可见流程 | 相关入口／操作／结果及取消／错误路径，涉及保存／重开或恢复时补充对应检查，复用既有流程 |
| 双编辑器与 CLI | 配置和组件工作 | 同一输入和配置得到一致的规则、选项与解释 |
| 注册语言与终端 | 界面、显示与说明 | `en/zh-CN/zh-TW/zh-HK/ja/ko/es/fr/de/pt-BR/ru/id`；主栏／子代理 40／80／120 列；原生最小 32×12、外部最小 64×18 及尺寸不足处理 |
| 翻译生命周期 | I18N-02 | 四类源变更、绑定译文的接受、安全确定回退及真实搜索；全部官方语言的严格发布就绪及兼容的原证据复用 |
| 数据来源 | 扩展、任务与诊断 | 样例／真实、来源／作用域、零／缺失／过期／部分／错误分别可辨 |
| 保存与恢复 | 安装和持久配置 | 旧配置、实例身份、项目绑定、并发 revision、迁移备份、取消及故障恢复 |
| 外部能力 | EXTENSIONS-01／WORKFLOW-01／COMMAND-01 | 默认关闭、显式启用、可独立停用；导入与预览不会执行或联网 |
| 图形／分组／速率 | APPEARANCE-03／COMPOSITION-02／METRICS-01 | 默认不变、逐实例明确选择、数据含义可信、联动隐藏及有效配置往返 |
| 自动生命周期 | FIX-03／COMMAND-02／SOURCES-01；既有 WORKFLOW-02 | 使用者独立释放、显式整任务取消、自动许可分离、活跃续租、修订／上下文隔离及迟到结果拒绝 |
| Windows 预览一致性 | TERMINAL-01 及相关外观／演示 | 同一产物／配置覆盖 setup、configure 和 slash 路径，包含真实控制台证据、显式能力覆盖及终端恢复 |
| 持久安装与版本切换 | SETUP-02／UPDATE-01 | 审阅精确版本／prefix、持久绑定、不自动提权、明确各阶段结果，分别恢复包与配置 |
| 选择性复用 | IMPORT-01 及后续显示选项 | 两片均通过，未选状态保留，引用闭包／ID 映射有效，不导入来源授权，预览／保存／重开一致 |
| 渐变与对齐 | APPEARANCE-04／COMPOSITION-03 | 前景和背景均验证，警告及分组边缘正确，显式主栏行关系、窄行拟合和终端回退正确 |
| 平台与宿主 | 有平台／宿主影响的功能 | 沿用 Node 22／24、既有支持平台和适用宿主验证；缺口按原状态披露 |
| 成品与展示 | 功能交付和 SHOWCASE-01 | 原十八个正式后续工作包及全部切片验收后再演示，匹配安装包可复现，版本／输入／出处明确 |
| Native 容量／恢复 | 所有新增或修改的 Native 页面，含任务详情 | 独立约束 props、Pane 和 Client 树，使用生产规模数据、大／高面板、分页／缩放及草稿／保存结果恢复，纳入适用实际宿主套件 |
| 针对性组合 | 相关受影响规则 | 条形 × 标签／图标；渐变 × 分组／隐藏／spacer／对齐；来源执行 × 使用者／取消／修订；升级 × 未存草稿／中断／旧资源；导入 × 绑定／引用／冲突；任务 × 身份／陈旧／刷新／阅读位置 |

在现有套件选择上方针对性组合，不将全部维度展开为笛卡尔积，也不要求每个切片额外运行完整验收。既有 Ready PR 门禁与已验证 main／tag 晋级继续遵守 [CI 维护](ci-maintenance.zh-CN.md)。

功能测试使用隔离目录与合成或已脱敏输入，不读写使用者真实配置；联网验证及实际工具执行遵循对应开发任务的明确范围。采用当时适用的[测试指南](testing.zh-CN.md)与[发布流程](../RELEASING.zh-CN.md)。自动检查、PTY 重建、代理画面观察和真人验收分别记录。#96 的六项既有缺口继续保留，包括 v3.7.0 在内的限定接受不视为未来版本已验证。

<a id="handoff"></a>

## 实施交接与文档维护

开始具体工作包时记录：当时 main、选定范围、涉及模块、配置／协议决定和首个可交付切片。每个工作包保留用户问题、预期流程、首版边界、模块职责、接口／兼容影响、切片及完成证据。实施中的范围变化回写本计划和路线图的中英两版；新功能的使用文档与实现同步维护，不提前宣称可用。

交接记录至少包含：工作包及状态、已完成切片、剩余问题、源码／PR 身份、验证命令和结果、下一步。状态顺序为 `NOT_STARTED` → `IN_PROGRESS` → `VALIDATING` → `DONE`；工作包完成与版本发布分别记录，已合并的小切片不代表整包完成。版本发布时再附产物及渠道证据。

[路线图](roadmap.zh-CN.md)维护优先级与状态，本计划维护范围与验收。两者均为公开仓库文档，并维护完整中英对照；本地历史快照与原始校验记录分别保留，公开导航不能依赖这些文件。迁移阶段状态继续由[重构计划](typescript-migration.zh-CN.md)维护，功能交付证据由对应的实现记录维护。

文档验收核对双语规划／索引文件及所链接翻译指南／工作流的任务 ID、顺序、依赖、路线图维护的状态、切片覆盖及导航，核对已交付事实、链接与锚点。早期 I18N-02 设计文档更新涵盖五组文件，将拟议行为与当时指南分开；实现和发布现已有独立链接证据。执行 `npm run docs:check` 和 `git diff --check`，并在仅含已提交文件的检出目录执行文档检查。文档检查不建立功能验收；后续纯文档维护继续与运行时修改分开。

<a id="completed-designs"></a>

## 已交付设计

原始设计、排期和验收要求收录于[工作包设计档案](history/work-package-designs.zh-CN.md#completed-designs)。下方链接直达各节。

| 原章节 | 原始设计 |
| --- | --- |
| <a id="review-baseline"></a><a id="审查基线与证据边界"></a>审查基线与证据边界 | [归档章节](history/work-package-designs.zh-CN.md#review-baseline) |
| <a id="原工作包排期"></a>原工作包排期 | [归档章节](history/work-package-designs.zh-CN.md#原工作包排期) |
| <a id="candidate-boundaries"></a><a id="候选边界"></a>候选边界 | [归档章节](history/work-package-designs.zh-CN.md#candidate-boundaries) |
| <a id="future-work"></a><a id="主线产品与维护工作包"></a><a id="已交付后续工作包"></a>已交付后续工作包 | [归档章节](history/work-package-designs.zh-CN.md#主线产品与维护工作包) |
| <a id="delivered-mainline"></a><a id="已交付主线设计"></a>已交付主线设计 | [归档章节](history/work-package-designs.zh-CN.md#delivered-mainline) |
| <a id="delivered-designs"></a><a id="既有设计与保留的演示工作包"></a>既有设计与保留的演示工作包 | [归档章节](history/work-package-designs.zh-CN.md#delivered-designs) |

<details>
<summary>展开兼容旧链接的工作包索引</summary>

| 工作包／入口 | 归档 |
| --- | --- |
| <a id="后续工作"></a><a id="后续工作包排期"></a>后续工作包排期 | [原始设计](history/work-package-designs.zh-CN.md#后续工作) |
| <a id="已交付工作"></a><a id="早期里程碑和维护排期"></a>早期里程碑和维护排期 | [原始设计](history/work-package-designs.zh-CN.md#已交付工作) |
| <a id="i18n-02"></a><a id="i18n-02-增量多语言开发与发布就绪"></a>I18N-02 增量多语言开发与发布就绪 | [原始设计](history/work-package-designs.zh-CN.md#i18n-02) |
| <a id="fix-01"></a><a id="fix-01-保存未知态的草稿保护"></a>FIX-01 | [原始设计](history/work-package-designs.zh-CN.md#fix-01) |
| <a id="fix-02"></a><a id="fix-02-进度条与标签统一组合"></a>FIX-02 | [原始设计](history/work-package-designs.zh-CN.md#fix-02) |
| <a id="fix-03"></a><a id="fix-03-刷新执行与等待使用者分离"></a>FIX-03 | [原始设计](history/work-package-designs.zh-CN.md#fix-03) |
| <a id="fix-04"></a><a id="fix-04-扩展诊断的时间与代理适用性"></a>FIX-04 | [原始设计](history/work-package-designs.zh-CN.md#fix-04) |
| <a id="i18n-01"></a><a id="i18n-01-独立初始化任务详情语言"></a>I18N-01 独立初始化任务详情语言 | [原始设计](history/work-package-designs.zh-CN.md#i18n-01) |
| <a id="appearance-05"></a><a id="appearance-05-扩充主题与渐变选择"></a>APPEARANCE-05 | [原始设计](history/work-package-designs.zh-CN.md#appearance-05) |
| <a id="preview-01"></a><a id="preview-01-可选择的样例场景"></a>PREVIEW-01 | [原始设计](history/work-package-designs.zh-CN.md#preview-01) |
| <a id="explain-02"></a><a id="explain-02-解释未生效配置与显式输入"></a>EXPLAIN-02 | [原始设计](history/work-package-designs.zh-CN.md#explain-02) |
| <a id="task-02"></a><a id="task-02-外部只读交互任务详情"></a>TASK-02 | [原始设计](history/work-package-designs.zh-CN.md#task-02) |
| <a id="update-02"></a><a id="update-02-版本审核执行与受保护历史"></a>UPDATE-02 | [原始设计](history/work-package-designs.zh-CN.md#update-02) |
| <a id="sources-01"></a><a id="sources-01-可读来源操作与绑定维护"></a>SOURCES-01 | [原始设计](history/work-package-designs.zh-CN.md#sources-01) |
| <a id="command-02"></a><a id="command-02-活跃会话内的命令定时执行"></a>COMMAND-02 | [原始设计](history/work-package-designs.zh-CN.md#command-02) |
| <a id="appearance-06"></a><a id="appearance-06-行内跨色块连续背景"></a>APPEARANCE-06 | [原始设计](history/work-package-designs.zh-CN.md#appearance-06) |
| <a id="appearance-07"></a><a id="appearance-07-保留数字含义的自适应进度条"></a>APPEARANCE-07 | [原始设计](history/work-package-designs.zh-CN.md#appearance-07) |
| <a id="ux-03"></a><a id="ux-03-共享草稿历史与外部恢复"></a>UX-03 | [原始设计](history/work-package-designs.zh-CN.md#ux-03) |
| <a id="import-02"></a><a id="import-02-样式与完整组复用"></a>IMPORT-02 | [原始设计](history/work-package-designs.zh-CN.md#import-02) |
| <a id="composition-04"></a><a id="composition-04-审阅结构编辑中的对齐调整"></a>COMPOSITION-04 | [原始设计](history/work-package-designs.zh-CN.md#composition-04) |
| <a id="profile-02"></a><a id="profile-02-使用已交付能力的场景方案"></a>PROFILE-02 | [原始设计](history/work-package-designs.zh-CN.md#profile-02) |
| <a id="git-01"></a><a id="git-01-git-调用核查与必要防护"></a>GIT-01 | [原始设计](history/work-package-designs.zh-CN.md#git-01) |
| <a id="terminal-01"></a><a id="terminal-01-windows-预览一致性"></a>TERMINAL-01 | [原始设计](history/work-package-designs.zh-CN.md#terminal-01) |
| <a id="setup-02"></a><a id="setup-02-首次入口与持久安装"></a>SETUP-02 | [原始设计](history/work-package-designs.zh-CN.md#setup-02) |
| <a id="update-01"></a><a id="update-01-显式升级与回滚"></a>UPDATE-01 | [原始设计](history/work-package-designs.zh-CN.md#update-01) |
| <a id="import-01"></a><a id="import-01-选择性配置复用"></a>IMPORT-01 | [原始设计](history/work-package-designs.zh-CN.md#import-01) |
| <a id="appearance-04"></a><a id="appearance-04-静态前景与-powerline-背景渐变"></a>APPEARANCE-04 | [原始设计](history/work-package-designs.zh-CN.md#appearance-04) |
| <a id="composition-03"></a><a id="composition-03-主栏显式多行对齐"></a>COMPOSITION-03 | [原始设计](history/work-package-designs.zh-CN.md#composition-03) |
| <a id="appearance-03"></a><a id="appearance-03-上下文与额度图形指标"></a>APPEARANCE-03 | [原始设计](history/work-package-designs.zh-CN.md#appearance-03) |
| <a id="composition-02"></a><a id="composition-02-组件分组与联动隐藏"></a>COMPOSITION-02 | [原始设计](history/work-package-designs.zh-CN.md#composition-02) |
| <a id="workflow-02"></a><a id="workflow-02-可选-github-prci-自动刷新"></a>WORKFLOW-02 | [原始设计](history/work-package-designs.zh-CN.md#workflow-02) |
| <a id="metrics-01"></a><a id="metrics-01-会话费用速率"></a>METRICS-01 | [原始设计](history/work-package-designs.zh-CN.md#metrics-01) |
| <a id="setup-01"></a><a id="setup-01-首次使用与配置入口"></a>SETUP-01 | [原始设计](history/work-package-designs.zh-CN.md#setup-01) |
| <a id="appearance-01"></a><a id="appearance-01-成套显示方案"></a>APPEARANCE-01 | [原始设计](history/work-package-designs.zh-CN.md#appearance-01) |
| <a id="appearance-02"></a><a id="appearance-02-外观控制与边界处理"></a>APPEARANCE-02 | [原始设计](history/work-package-designs.zh-CN.md#appearance-02) |
| <a id="showcase-01"></a><a id="showcase-01-首页与使用演示"></a>SHOWCASE-01 | [原始设计](history/work-package-designs.zh-CN.md#showcase-01) |
| <a id="extensions-01"></a><a id="extensions-01-本地-json-数据基础"></a>EXTENSIONS-01 | [原始设计](history/work-package-designs.zh-CN.md#extensions-01) |
| <a id="links-01"></a><a id="links-01-可点击文本"></a>LINKS-01 | [原始设计](history/work-package-designs.zh-CN.md#links-01) |
| <a id="workflow-01"></a><a id="workflow-01-可选-github-pr-与-ci-查询"></a>WORKFLOW-01 | [原始设计](history/work-package-designs.zh-CN.md#workflow-01) |
| <a id="command-01"></a><a id="command-01-用户显式配置的命令组件"></a>COMMAND-01 | [原始设计](history/work-package-designs.zh-CN.md#command-01) |
| <a id="capabilities-01"></a><a id="capabilities-01-组件能力说明"></a>CAPABILITIES-01 | [原始设计](history/work-package-designs.zh-CN.md#capabilities-01) |
| <a id="ci-01"></a><a id="ci-01-actions-引用固定"></a>CI-01 | [原始设计](history/work-package-designs.zh-CN.md#ci-01) |

</details>
