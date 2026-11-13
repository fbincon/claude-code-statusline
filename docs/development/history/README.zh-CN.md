# 开发历史

[English](README.md) | **简体中文**

按主题或版本查找原始设计、各版交付记录、迁移阶段和验证证据。现行流程见[开发指南](../README.zh-CN.md)、[测试与验收](../testing.zh-CN.md)及[发布指南](../../RELEASING.zh-CN.md#current-typescript-publication)。

<a id="completed-work-designs"></a>

## 已交付工作包设计

[工作包设计档案](work-package-designs.zh-CN.md#completed-designs)保留原始范围、切片及验收要求。[已交付阶段](roadmap-milestones.zh-CN.md#milestones)记录工作包状态和依赖。对应实现与验证结果见下方交付记录。

<a id="delivery-records"></a>

## 按主题查找交付记录

各记录保留功能引入版本、源码身份、检查结果与交付限制。

现行指南位于 [`docs/development`](../)。本目录保存冻结的交付记录；旧开发路径上的短文件是兼容存根，用于保留历史链接与章节锚点。

| 领域 | 交付记录 |
| --- | --- |
| 文档维护 | [按阅读顺序整理内容及双语核对](deliveries/documentation-content-organization.zh-CN.md) · [内容更正、完整来源流程及定向回归检查](deliveries/documentation-content-validation.zh-CN.md) · [CLI 参考覆盖、目标与回归检查](deliveries/cli-reference-maintenance.zh-CN.md) · [使用指南入门与编辑器操作](deliveries/user-guide-onboarding.zh-CN.md) · [根目录文档准确性与编排](deliveries/root-documentation-audit.zh-CN.md) · [根目录文档结构与版本归属](deliveries/root-docs-structure.zh-CN.md) · [开发文档事实修正与历史记录冻结](deliveries/development-docs-corrections.zh-CN.md) · [开发文档归档与导航刷新](deliveries/development-docs-archive-refresh.zh-CN.md) · [开发文档内容检查与登记](deliveries/development-content-checks.zh-CN.md) · [文档内容回归校验修复](deliveries/docs-content-check-fixes.zh-CN.md) · [图片索引整理与 Python 时代归档](deliveries/docs-images-organization.zh-CN.md) |
| v3.16.3 配置技能 | [问答分页、范围与回退流程](deliveries/skill-workflows.zh-CN.md#final-release) |
| v3.16.2 编辑器操控 | [快捷键、草稿保护与发布核验](deliveries/editor-input-delivery.zh-CN.md#final-release) |
| v3.16.1 正确性修复 | [运行身份、来源超时与保存冲突](deliveries/runtime-source-save-fixes.zh-CN.md#final-release) |
| 语言 | [十二语言扩展](deliveries/language-expansion.zh-CN.md) · [I18N-02 生命周期](deliveries/i18n-02-delivery.zh-CN.md) · [Node 与地区语言](deliveries/node-regional-languages.zh-CN.md) |
| CI 维护 | [Issue #157 实测](deliveries/ci-maintenance-delivery.zh-CN.md#ci-rollout) · [CI-01 固定 Actions](deliveries/ci-maintenance-delivery.zh-CN.md#ci-01) |
| 外观、草稿与复用 | [自适应行与场景](deliveries/adaptive-row-scenarios.zh-CN.md) · [草稿历史与复用](deliveries/draft-history-and-reuse.zh-CN.md) · [外观／预览／诊断](deliveries/appearance-preview-diagnosis.zh-CN.md) |
| 任务、来源与软件包 | [任务／版本审阅](deliveries/task-version-review.zh-CN.md) · [来源／命令／包执行](deliveries/source-command-package-management.zh-CN.md) · [扩展交付](deliveries/extensions.zh-CN.md#已完成的验收与交付) |
| 设置与配置 | [首次设置／完整方案](deliveries/setup-appearance.zh-CN.md) · [配置体验](deliveries/configuration-experience.zh-CN.md) · [方案／项目／任务](deliveries/profiles-projects-tasks.zh-CN.md) · [真实输入诊断](deliveries/real-input-diagnostics.zh-CN.md) |
| 早期里程碑及修复 | [M4–M7](deliveries/m4-m7-delivery.zh-CN.md) · [M8–M9](deliveries/m8-m9-delivery.zh-CN.md) · [M10–M12](deliveries/m10-m12-delivery.zh-CN.md) · [正确性维护](deliveries/correctness-maintenance.zh-CN.md) |
| 迁移后审查 | [问题盘点](migration/post-migration-review.zh-CN.md) · [修复](migration/post-migration-fixes.zh-CN.md) · [外部 TUI 一致性](migration/external-tui-parity.zh-CN.md) · [外部 TUI 回归](migration/external-tui-regressions.zh-CN.md) |
| 性能 | [按版本查找报告](#performance-reports) |
| 展示交付 | [SHOWCASE-01](deliveries/showcase.zh-CN.md#delivery) |

<a id="delivery-by-version"></a>

## 按版本查找工作包

<details>
<summary>展开 v3.2.0 至 v3.16.0 的交付映射</summary>

| 版本 | 工作包 | 状态 | 实现与交付记录 |
| --- | --- | --- | --- |
| v3.2.0 | UX-01、UX-02、EXPLAIN-01 | DONE | [配置体验](deliveries/configuration-experience.zh-CN.md) |
| v3.3.0 | DIAG-01、INPUT-01 | DONE | [真实输入诊断](deliveries/real-input-diagnostics.zh-CN.md) |
| v3.4.0 | PROFILE-01、PROJECT-01、TASK-01 | DONE | [方案、项目与任务详情](deliveries/profiles-projects-tasks.zh-CN.md) |
| v3.5.0 | SETUP-01、APPEARANCE-01、APPEARANCE-02 | DONE | [首次设置与完整外观](deliveries/setup-appearance.zh-CN.md) |
| v3.6.0 | EXTENSIONS-01、LINKS-01、WORKFLOW-01、COMMAND-01、CAPABILITIES-01 | DONE | [扩展与工作流](deliveries/extensions.zh-CN.md) |
| v3.7.0 | APPEARANCE-03、COMPOSITION-02、WORKFLOW-02、METRICS-01 | DONE | [图形、分组、刷新与速率](deliveries/m4-m7-delivery.zh-CN.md) |
| v3.8.0 | GIT-01、TERMINAL-01、SETUP-02、UPDATE-01 | DONE | [Git、终端与 M8–M9](deliveries/m8-m9-delivery.zh-CN.md) |
| v3.9.0 | IMPORT-01、APPEARANCE-04、COMPOSITION-03 | DONE | [选择性导入、渐变与对齐](deliveries/m10-m12-delivery.zh-CN.md) |
| v3.9.1 | #154 传输容量、#155 绘制树容量及保存结果恢复 | DONE | [Native 容量交付](deliveries/native-capacity-v3.9.1.zh-CN.md#最终稳定版交付) |
| v3.9.2 | FIX-01～FIX-04、I18N-01：草稿、进度条、刷新消费者、历史诊断及任务语言 | DONE | [正确性修复与发布](deliveries/correctness-maintenance.zh-CN.md) |
| v3.10.0 | APPEARANCE-05、PREVIEW-01、EXPLAIN-02：主题、可视选色、样例场景及文件诊断 | DONE | [外观、预览与诊断交付](deliveries/appearance-preview-diagnosis.zh-CN.md) |
| v3.11.0 | TASK-02、UPDATE-02 第一片 | DONE | [任务浏览与版本审核](deliveries/task-version-review.zh-CN.md) |
| v3.12.0 | SOURCES-01、COMMAND-02、UPDATE-02 第二／三片；#173 | DONE | [v3.12.0 交付](deliveries/source-command-package-management.zh-CN.md#v3120-交付记录) |
| v3.13.0 | UX-03、COMPOSITION-04、IMPORT-02 全部切片 | DONE | [草稿历史、修复与复用交付](deliveries/draft-history-and-reuse.zh-CN.md) |
| v3.14.0 | APPEARANCE-07、APPEARANCE-06、PROFILE-02；#178／#180 | DONE | [自适应、连续背景与场景交付](deliveries/adaptive-row-scenarios.zh-CN.md) |
| v3.15.0 | I18N-02 三个切片；六语言增量维护 | DONE | [增量语言工作流交付](deliveries/i18n-02-delivery.zh-CN.md#final-release) |
| v3.16.0 | 新增六种界面／状态栏语言；编辑器协议 31 | DONE | [十二语言交付](deliveries/language-expansion.zh-CN.md#final-release) |

</details>

<a id="附有交付记录的技术参考"></a>

## 现行技术参考

[开发指南](../README.zh-CN.md)列出现行技术入口，包括[原生容量与恢复](../native-capacity.zh-CN.md#展示边界)、[CI 维护](../ci-maintenance.zh-CN.md)及[扩展职责与契约](../extensions.zh-CN.md#职责与契约)。

## TypeScript 迁移阶段

[TypeScript 迁移计划](migration/typescript-migration.zh-CN.md)链接已完成阶段：[TS-01 参考](../typescript-migration/ts-01/README.zh-CN.md)、[TS-02 探针](../typescript-migration/ts-02/README.zh-CN.md)、[TS-03 核心／后端](../typescript-migration/ts-03/README.zh-CN.md)、[TS-04 编辑器／恢复](../typescript-migration/ts-04/README.zh-CN.md)、[TS-05 候选](../typescript-migration/ts-05/README.zh-CN.md)、[TS-06 发布](../typescript-migration/ts-06/README.zh-CN.md)。原 [TS-04 候选](../typescript-migration/ts-04/candidate.zh-CN.md)、[恢复](../typescript-migration/ts-04/recovery.zh-CN.md)和 [Linux 实机／延期验收](../typescript-migration/ts-02/LINUX-20261014.zh-CN.md)保留为历史证据。

<a id="performance-reports"></a>

## 按版本查找性能报告

| 版本 | 实现 | 报告 |
| --- | --- | --- |
| v3.1.4 | TypeScript | [PERF-01 迁移后性能](performance/perf-01.zh-CN.md) |
| v2.0.0 | Python | [组件实例渲染](performance/performance-v2.0.0.zh-CN.md) |
| v1.13.0 | Python | [多语言与搜索性能](performance/performance-v1.13.0.zh-CN.md) |
| v1.12.0 | Python | [渲染与可选功能开销](performance/performance-v1.12.0.zh-CN.md) |
| v1.11.0 | Python | [渲染性能对照](performance/performance-v1.11.0.zh-CN.md) |

## 历史流程与证据

- [发布流程](release-procedures.zh-CN.md)保留历次发布步骤、TS-06 首发和 Python/PyPI 发布。
- [验收记录](acceptance-records.zh-CN.md)保留 Python 与迁移阶段的命令、结果和限制。
- [Python 实现说明](python-implementation.zh-CN.md)保留[历史架构](python-implementation.zh-CN.md#python-architecture)、文件安全、启动器及组件布局。
- [冻结的 Python 归档](../../../archive/python/README.zh-CN.md)提供固定源码及独立验证流程。
