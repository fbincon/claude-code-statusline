# 已交付路线阶段与原始规划基线

[English](roadmap-milestones.md) | **简体中文** · [现行指南](../roadmap.zh-CN.md)

本页保留 v3.16.0 规划快照、参考项目和已交付阶段的工作包状态及依赖。实际交付与验收见[开发历史索引](README.zh-CN.md#delivery-records)。

<a id="baseline"></a>

<a id="当前基线与产品方向"></a>

## 规划基线与产品方向

**2026-10-30**（Asia/Shanghai）的规划快照采用 [v3.16.0](deliveries/language-expansion.zh-CN.md#final-release) 作为产品基线；2026-10-28 的审查使用产品 v3.9.1 的源 `0f5638f613c8ffc9588a50d30ebc51f14549b1fb`。

下表记录以 v3.16.0 为基线时用于规划的能力。现行操作见[使用指南](../../USER_GUIDE.zh-CN.md)，基线之后的变化见[变更日志](../../../CHANGELOG.zh-CN.md)。

| 方面 | 已交付能力 | 后续规划依据 |
| --- | --- | --- |
| 配置入口 | 首次设置向导、会话内编辑器、外部 TUI、CLI、对话指南及 Quick setup | 无参数持久安装审核及显式升级／回退／恢复已交付 |
| 显示组合 | 六种既有预设、八套完整方案、组件实例、复制／排序、文字、spacer、导入审阅、颜色、六项 Powerline 控制、可选／自适应百分比短条、联动分组、选择性导入、静态前景／Powerline 背景渐变、最终显示行连续背景及主栏显式行对齐 | 扩充主题、渐变及复用能力，保留既有显示选择 |
| 外观审阅 | 八主题、十一渐变预设、可视选色、十四样例场景、会话宽度及使用未保存草稿的显式文件诊断 | 扩展复用时保留来源授权边界 |
| 任务与项目 | 任务计时、子代理独立行、双编辑器只读任务浏览、命名方案及项目根目录绑定 | 扩展配置复用时保持证据归属 |
| 语言 | `en`、`zh-CN`、`zh-TW`、`zh-HK`、`ja`、`ko`、`es`、`fr`、`de`、`pt-BR`、`ru`、`id`；界面语言与输出语言独立 | I18N-02 提供增量维护、A 开发完整及全部官方语言的严格公开发布就绪 |
| 显示目录 | 主栏 65 个指标、子代理 15 个指标；加上文字与留白后为 67／17 个类型 | 新增显示项时保留现有 ID 与指标口径 |
| 已有数据 | 宿主 `pr` 编号／评审状态、linked worktree 回退、prompt-cache 命中率／写入量、缓存状态／到期／miss 原因及最新请求输出速率 | 考虑新指标时保留已有作用域与口径 |
| 扩展数据 | 本机 JSON、GitHub PR／CI 与命令源；可读状态、检查分页、引用保护的绑定及独立审核的活跃会话自动刷新；可选 OSC 8 链接 | 授权与显示方案分离，仅被导入部分清除本机绑定 |
| Native 展示 | 宿主保留编辑状态、有界可见帧、独立容量检查及可恢复保存结果 | 所有新页面遵守这些边界；见[容量与恢复](../native-capacity.zh-CN.md) |
| 接口 | 显示 schema 17、编辑器协议 31、来源注册表 3／任务 4、观测 1、runtime 3、lifecycle 4、portable 1、UI preferences 1；方案集合／导出 1；[当前版本](../../reference/cli.zh-CN.md#协议与-schema-版本) | 分别说明每个接口的兼容路径 |
| 支持边界 | Linux／WSL、Windows、macOS；产品运行时 Node 22／24 | 保留支持范围，记录实际验证结果 |

[审查基线](work-package-designs.zh-CN.md#review-baseline)区分隔离复现、源码确认和拟新增能力。上一份规划快照为 `f68d26eeddda98ab4041d2b9e873ade556fa1909`。相关定义与证据见[目录源码](../../../packages/core/src/config/catalog-data.ts)、[编辑器协议](../../../packages/core/src/contracts/ui.ts)、[架构](../architecture.zh-CN.md)和[交付索引](README.zh-CN.md#delivery-records)。

默认能力使用 Claude 输入与本地状态。联网查询和自定义命令分别显式启用，导入显示方案、绑定项目或选择预设不会启用这些能力。

[Issue #96](https://github.com/fbincon/claude-code-statusline/issues/96) 记录的六项既有缺口继续为**未验证**。包括 [v3.9.2 专项决定](../../releases/approvals/v3.9.2.json)在内的限定版本接受，记录的是允许带这些缺口发布，不代表缺失检查已通过，也不豁免新增失败。

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

以下记录已交付阶段的状态、原始依赖和排期依据。版本与证据见[交付历史](../roadmap.zh-CN.md#delivery-history)。

<a id="后续主线"></a>

### 已交付主线

<details>
<summary>查看已交付主线的工作包、依赖和排期</summary>

| 批次 | 工作包 | 用户可见结果 | 实现依赖 | 状态 |
| --- | --- | --- | --- | --- |
| 语言工作流 | [I18N-02](work-package-designs.zh-CN.md#i18n-02) | 开发使用当前源语言回退，发布保证六语完整 | 三个切片、兼容 PR／main／tag 核验及公开交付均完成；[v3.15.0 证据](deliveries/i18n-02-delivery.zh-CN.md#final-release) | DONE |
| 1 正确性 | [FIX-01](work-package-designs.zh-CN.md#fix-01) | 保存结果未知时保护全部显示草稿修改 | 既有保存／核对状态与共享编辑动作 | DONE |
| 1 正确性 | [FIX-02](work-package-designs.zh-CN.md#fix-02) | 进度条与隐藏、短、自定义标签一致 | 共享图形指标及文字修饰规则 | DONE |
| 1 正确性 | [FIX-03](work-package-designs.zh-CN.md#fix-03) | 离开一个刷新入口不影响其他使用者 | 共享来源任务、编辑器关闭与 CLI 取消 | DONE |
| 1 维护 | [FIX-04](work-package-designs.zh-CN.md#fix-04) | 扩展诊断时间适用，保留每个代理证据 | 既有诊断与来源观测契约 | DONE |
| 1 维护 | [I18N-01](work-package-designs.zh-CN.md#i18n-01) | 任务详情首次打开、失败及重试使用正确语言 | 既有 UI 偏好与任务窗格 | DONE |
| 2 外观 | [APPEARANCE-05](work-package-designs.zh-CN.md#appearance-05) | 更多主题／渐变预设、可见色带与渐变编辑 | 既有外观规则；共享主题登记 | DONE |
| 2 理解 | [PREVIEW-01](work-package-designs.zh-CN.md#preview-01) | 可选择的样例状态，审阅外观与布局 | 注入观测的生产渲染器 | DONE |
| 2 理解 | [EXPLAIN-02](work-package-designs.zh-CN.md#explain-02) | 解释未生效的样式／来源，并显式诊断输入文件 | 既有解释／诊断；扩展证据可信性依赖 FIX-04 | DONE |
| 3 任务入口 | [TASK-02](work-package-designs.zh-CN.md#task-02) | 外部只读任务浏览，再完善两端阅读控制 | 既有任务模型／服务与 I18N-01 语言处理 | DONE |
| 3／4／后续 版本 | [UPDATE-02](work-package-designs.zh-CN.md#update-02) | 状态／审核、执行／恢复及受保护历史清理 | 既有 UPDATE-01；执行依赖审核及安全的草稿／进程交接 | DONE |
| 4 来源操作 | [SOURCES-01](work-package-designs.zh-CN.md#sources-01) | 可读状态、已保存 GitHub 检查分页、兼容绑定复用及受保护清理 | 既有来源服务；FIX-03 生命周期规则 | DONE |
| 4 调度 | [COMMAND-02](work-package-designs.zh-CN.md#command-02) | 适用活跃会话内单独审核的命令定时执行 | FIX-03；既有命令执行与活跃会话续租 | DONE |
| 5 连续色彩 | [APPEARANCE-06](work-package-designs.zh-CN.md#appearance-06) | 同一实际显示行内相邻色块背景连续渐变 | 既有拟合、分组、对齐与 Powerline 边缘颜色 | DONE |
| 后续，可穿插 | [APPEARANCE-07](work-package-designs.zh-CN.md#appearance-07) | 可选窄栏进度条，保留数字含义 | FIX-02 与既有拟合／优先级 | DONE |
| 后续，可穿插 | [UX-03](work-package-designs.zh-CN.md#ux-03) | 共享撤销／重做、变更审阅及外部冲突恢复 | FIX-01 与既有 revision 保存／重载／导出 | DONE |
| 后续，可穿插 | [IMPORT-02](work-package-designs.zh-CN.md#import-02) | 样式复制、完整组复用及显式本机来源重绑 | 既有 IMPORT-01 与引用校验 | DONE |
| 后续，可穿插 | [COMPOSITION-04](work-package-designs.zh-CN.md#composition-04) | 审阅并原子调整受影响对齐引用 | 既有分组／对齐约束与共享编辑 | DONE |
| 后续，可穿插 | [PROFILE-02](work-package-designs.zh-CN.md#profile-02) | 展示已交付新能力的场景方案 | 仅依赖各方案实际使用的外观／组合能力 | DONE |
| 最终演示 | [SHOWCASE-01](work-package-designs.zh-CN.md#showcase-01) | 双语演示、配置和可复现流程 | 原十八个后续工作包及全部切片验收，匹配的安装产物 | DONE |

批次表示交付偏好，不额外增加技术依赖。主题、任务浏览与版本审核可在各自前置条件满足后独立推进。UPDATE-02、SOURCES-01 跨批次保留同一工作包身份，各切片可独立交付，整包须全部切片验收才算完成。后续工作可按各自依赖穿插，保留已交付的绑定与历史保护规则。

SHOWCASE-01 保留历史 ID。按维护者决定，原 M13 排期改为等待原十八个正式工作包及全部切片，包括后续完善。I18N-02 单独排期，不增加 SHOWCASE-01 的前置条件；剩余候选也不增加其前置条件。M1–M12 保留历史编号与交付证据。

SHOWCASE-01 已使用公开 v3.16.0 包及非 Powerline 演示交付。[前置条件、采集和分开验收记录](../showcase.zh-CN.md)保留原产品／证据身份；[用户走查](../../SHOWCASE.zh-CN.md)负责可复现用法。

GIT-01、TERMINAL-01 保持已交付；相关 Windows 预览及共享 Git 策略沿用 [M8–M9 交付](deliveries/m8-m9-delivery.zh-CN.md)，Native 保留 [v3.9.1](../native-capacity.zh-CN.md) 确立的边界。现行验证路径仍由 [CI 维护](../ci-maintenance.zh-CN.md)定义。

</details>

### 已交付阶段

<details>
<summary>查看早期里程碑及独立维护工作</summary>

| 阶段 | 工作包 | 用户可见结果 | 实现依赖 | 状态 |
| --- | --- | --- | --- | --- |
| M1 首次使用 | [SETUP-01](work-package-designs.zh-CN.md#setup-01) | 从检查到配置、接入和下一步指引的一体化流程 | 既有安装事务与 Quick setup | DONE |
| M2 外观 | [APPEARANCE-01](work-package-designs.zh-CN.md#appearance-01) | 日常开发、多代理、额度监控三套完整方案 | 已有预设与方案管理 | DONE |
| M2 外观 | [APPEARANCE-02](work-package-designs.zh-CN.md#appearance-02) | 可配置内边距、分隔及首尾装饰 | APPEARANCE-01 的具体场景 | DONE |
| M3 扩展 | [EXTENSIONS-01](work-package-designs.zh-CN.md#extensions-01) | 显式启用的本机 JSON 数据组件及来源契约 | 既有诊断与组件实例 | DONE |
| M3 扩展 | [LINKS-01](work-package-designs.zh-CN.md#links-01) | 可点击 PR／目录等文本及普通文本回退 | 既有文本和布局规则 | DONE |
| M3 扩展 | [WORKFLOW-01](work-package-designs.zh-CN.md#workflow-01) | 可选 GitHub PR 查询与 CI 状态 | EXTENSIONS-01；LINKS-01 可选 | DONE |
| M3 扩展 | [COMMAND-01](work-package-designs.zh-CN.md#command-01) | 用户明确配置的外部命令组件 | EXTENSIONS-01 | DONE |
| M4 图形指标 | [APPEARANCE-03](work-package-designs.zh-CN.md#appearance-03) | 上下文／额度可选短进度条及可读文字回退 | 既有已观测百分比、组件选项和布局 | DONE |
| M5 组件分组 | [COMPOSITION-02](work-package-designs.zh-CN.md#composition-02) | 装饰随指标隐藏，可合并 Powerline 色块 | 既有实例、条件显示与 Powerline | DONE |
| M6 GitHub 刷新 | [WORKFLOW-02](work-package-designs.zh-CN.md#workflow-02) | 独立启用的 PR／CI 自动刷新，状态及停止操作明确 | 已交付 EXTENSIONS-01、WORKFLOW-01 | DONE |
| M7 派生指标 | [METRICS-01](work-package-designs.zh-CN.md#metrics-01) | 明确按会话／API 时间折算的每小时费用 | 既有已观测会话费用与耗时字段 | DONE |
| 独立维护 | [GIT-01](work-package-designs.zh-CN.md#git-01) | 核实直接／间接 Git 调用及必要防护，保留受支持过滤器兼容性 | 既有 Git 采集、来源身份与进程适配 | DONE |
| 独立维护 | [TERMINAL-01](work-package-designs.zh-CN.md#terminal-01) | setup、configure、slash 入口的 Windows 预览颜色一致或差异有明确解释 | 既有终端探测／启动路径；[Issue #130](https://github.com/fbincon/claude-code-statusline/issues/130) | DONE |
| M8 首次入口 | [SETUP-02](work-package-designs.zh-CN.md#setup-02) | 无参数／npx 入口串联 npm 全局安装、持久绑定和已有 setup | 已交付 SETUP-01 及安装／恢复机制 | DONE |
| M9 版本管理 | [UPDATE-01](work-package-designs.zh-CN.md#update-01) | 显式版本检查、升级、回退及失败恢复 | SETUP-02 的安装身份及既有兼容／恢复规则 | DONE |
| M10 配置复用 | [IMPORT-01](work-package-designs.zh-CN.md#import-01) | 先选择全局外观，再选择完整主栏／子代理分区导入 | 既有导入审阅、实例、分组、布局与方案事务 | DONE |
| M11 渐变 | [APPEARANCE-04](work-package-designs.zh-CN.md#appearance-04) | 预设及自定义的静态组件前景、Powerline 背景渐变 | 既有颜色、Powerline、分组及编辑规则 | DONE |
| M12 跨行对齐 | [COMPOSITION-03](work-package-designs.zh-CN.md#composition-03) | 主栏显式多行对齐，明确隐藏／分组／spacer／窄行行为 | 既有显式布局、分组、Unicode 宽度与拟合 | DONE |
| 按需工程支持 | [CAPABILITIES-01](work-package-designs.zh-CN.md#capabilities-01) | 组件支持选项与说明一致 | 外观或扩展暴露的具体元数据需求 | DONE |
| 独立维护 | [CI-01](work-package-designs.zh-CN.md#ci-01) | Actions 引用固定、可核查更新 | 当前工作流清单 | DONE |

M1 → M2 → M3 → M4–M7 记录历史交付顺序，保留已完成 ID 及证据。SHOWCASE-01 曾列于 M2、M8 和 M13，最终前置条件见已交付主线。CI-01 已作为独立维护完成，其 Dependabot 每周更新提议及验证记录在 [CI 维护](../ci-maintenance.zh-CN.md)。

</details>
