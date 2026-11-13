# 开发路线

[English](roadmap.md) | **简体中文**

本页维护产品方向、优先级和工作包状态。[开发计划](development-plan.zh-CN.md#work-index)说明如何定义范围、依赖、切片和验收，[历史索引](history/README.zh-CN.md#delivery-records)汇集实现与发布证据。

[当前状态](#status) · [候选方向](#candidates) · [阶段依赖](#milestones)

<a id="status"></a>

## 当前开发状态

M1–M12 和选定的十八个后续工作包均已交付。[SHOWCASE-01](showcase.zh-CN.md#delivery)使用已发布的 v3.16.0 软件包展示这些流程。后续版本及修复见[发布说明](../releases/README.zh-CN.md)。

<a id="delivery-history"></a><a id="已交付工作与历史证据"></a>

[版本与工作包对照](history/README.zh-CN.md#delivery-by-version)记录各阶段交付，[专题索引](history/README.zh-CN.md#delivery-records)汇集实现与验证证据。

- <a id="规划基线与产品方向"></a><a id="baseline"></a><a id="当前基线与产品方向"></a>[规划基线与产品方向](history/roadmap-milestones.zh-CN.md#baseline)
- <a id="参考项目与致谢"></a><a id="reference"></a>[参考项目与致谢](history/roadmap-milestones.zh-CN.md#reference)

<a id="candidates"></a>

## 候选池与进入条件

[已交付主线](history/roadmap-milestones.zh-CN.md#后续主线)覆盖上一轮选定的完善方向，包括 [COMMAND-02](history/work-package-designs.zh-CN.md#command-02) 的命令自动刷新。既有 IMPORT-01、APPEARANCE-04、COMPOSITION-03 保持已交付；下表仅保留未选定方向。

### 功能候选

| 候选 | 用户场景与最小切片 | 依据与进入条件 |
| --- | --- | --- |
| 新的 token 速率视图 | 查看已观测会话或近期窗口的 token 吞吐，先选一种作用域 | 定义耗时、token 包含范围、重放去重及主／子代理归属；保留已有最新请求 `output-rate` 的含义 |
| 新的缓存视图 | 查看选定请求／会话范围内的读写量或比率 | 已有 `prompt-cache` 提供命中率／写入量；要求独立需求、权威字段和明确分母 |
| 每日剩余预算 | 显示已验证的每日额度剩余或明确标识的用户预算 | 可靠金额、币种、新鲜度、完整周期边界及时区；仅有 `monthly` 标签不足以推算 |
| 配额消耗节奏与时间游标 | 对照额度消耗与已验证的窗口进度 | 明确窗口边界、经过时间含义及未知时行为，区分倒计时、消耗和估算 |
| GitLab 提供方 | 查看分支的合并请求与 CI，先做手动只读查询 | 实际需求、权威字段、既有认证与仓库／分支／HEAD 身份，定义 GitLab 特有状态 |
| Gitee 提供方 | 查看分支的拉取请求与 CI，先做手动只读查询 | 实际需求、权威字段及提供方自己的认证／身份；仓库镜像是另一件事 |
| 服务状态 | 显示所选服务公开的状态及新鲜度 | 可靠来源，明确不可用／过期状态；全局服务状态不代表个人请求或网关健康 |
| Voice 配置提示 | 显示已观测的语音输入配置 | 验证配置优先级与可用性；配置启用不代表正在录音 |
| Sandbox 配置提示 | 显示已观测的沙箱配置 | 验证受管／CLI 覆盖与可用性；配置启用不代表实际隔离已生效 |

### 配套候选

| 候选 | 用户场景与最小切片 | 依据与进入条件 |
| --- | --- | --- |
| 迁移说明 | 帮助用户将已有配置映射到本产品 | 已验证的来源／目标版本、能力映射、手动步骤和恢复方法，不承诺无损自动转换 |

[贡献指南](../../CONTRIBUTING.zh-CN.md)、[双语 Bug 表单](../../.github/ISSUE_TEMPLATE/bug_report.yml)及空白问题／功能 Issue 已可使用，见[仓库维护](repository-governance.zh-CN.md)。这些属于既有入口维护，不再作为新增开发候选。

### 较远方向

| 候选 | 用户场景与最小切片 | 依据与进入条件 |
| --- | --- | --- |
| JJ | 为真实使用者的仓库显示 Jujutsu 状态 | 明确需求、可靠输出及可用性／身份语义，先选只读字段 |
| 其他客户端 | 在指定客户端复用选定能力 | 已验证的输入／生命周期契约及具体接入／支持边界 |
| 插件市场 | 发现和管理第三方组件 | 实际扩展使用情况及选定的分发、信任、兼容和生命周期模型 |
| 自动脚本下载 | 获取指定外部组件 | 单独选定来源、完整性、审阅、安装与移除设计 |
| 通用 Shell 模式 | 支持确实需要 Shell 解释的具体命令 | 在既有可执行文件／argv 来源之外，单独设计交互和执行授权 |

候选不分配版本或日期。列入候选池不启动开发，也不成为正式工作包或 SHOWCASE-01 的前置条件。仅在明确决定范围并更新对应工作包后升入主线，按独立用户需求与数据定义评估，不以组件数量排序。

<a id="milestones"></a>

## 阶段路线与依赖

M1 → M2 → M3 → M4–M7 记录早期交付顺序。SHOWCASE-01 在原十八个正式后续工作包及其全部切片验收后交付。I18N-02 单独排期。原始依赖与排期见[历史里程碑与依赖](history/roadmap-milestones.zh-CN.md#milestones)。

选定候选方向后，从当时最新的 `main` 开始，核对进入条件，并在工作包中明确依赖和交付范围。使用 `NOT_STARTED` → `IN_PROGRESS` → `VALIDATING` → `DONE` 记录进度，并分别记录功能合并、包完成和版本发布。

- <a id="已交付主线"></a><a id="后续主线"></a>[已交付主线](history/roadmap-milestones.zh-CN.md#后续主线)
- <a id="已交付阶段"></a>[已交付阶段](history/roadmap-milestones.zh-CN.md#已交付阶段)
- <a id="packages"></a><a id="工作包使用方式"></a>[工作包范围与切片](development-plan.zh-CN.md#work-index)
- <a id="acceptance"></a><a id="阶段完成要求"></a>[功能验收矩阵](development-plan.zh-CN.md#acceptance-matrix) · [测试与验收](testing.zh-CN.md)
- <a id="maintenance"></a><a id="文档维护与交接"></a>[文档更新责任](README.zh-CN.md#documentation-ownership) · [工作包交接](development-plan.zh-CN.md#handoff)
