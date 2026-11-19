# 任务时钟与生命周期证据

[English](timer.md) | **简体中文**

[v3.1.3 修复记录](history/migration/post-migration-fixes.zh-CN.md)保留了计时证据、精确重放去重及缓存兼容的原始改动。

`task-timer` 从最早可信的人类提交开始，覆盖排队、Agent 工作与主 Agent 收尾。`prompt-timer` 保留为输入兼容别名。可选的 `task-active-timer` 从执行开始计时，扣除已核验的用户等待。原生单轮耗时、会话运行时间和累计 API 耗时分别保存。

## 职责结构

`packages/core/src/timing` 提供纯逻辑、可持久恢复的 TypeScript 计时核心。累计时间、暂停与恢复的设计参考 [Codex StatusTimer](https://github.com/openai/codex/blob/823ea830c0fd418b09ff02d36cad9a1fff66465b/codex-rs/tui/src/status_indicator_widget/timer.rs)，并增加启动域时钟样本及重叠等待身份。

`packages/core/src/runtime/tasks` 负责纯任务身份、转换、原生适配及指标视图；`packages/cli/src/runtime/tasks` 通过平台适配器协调提交索引和原子存储。采集与归并先于格式化；预览使用固定快照，不访问运行数据。Python 模块别名属于[冻结归档](../../archive/python/README.zh-CN.md)。

## 完成判定

传统 `Stop` 是停止尝试。没有进一步确认时显示 `? <耗时>+`，表示已知下界。可信续跑撤销候选，不重置提交时钟；没有新活动的重复停止尝试保持幂等。

匹配的主线程 `turn.complete` 确认单轮结束，不一定代表整个任务完成。按 Agent 身份对账活跃工作与待收报告；同步 Agent 的停止不会产生待报项。新的权威快照可清理只由旧快照支持的条目，不会清掉已证实的后台 Agent 应交付的报告。

从传统 hook 与可归属的 transcript user 行读取已交付通知，也识别排队命令附件；附件可结清报告，但不证明主 Agent 已续跑。不从 API 请求正文提取报告。未知或多重归属的通知不会被当成本地命令；等待明确绑定或唯一归属。

首次可归属的交付，或更新且已绑定的主回合活动，可续跑同一人类任务而不重置起点。仅入队、重复交付、迟到的子 Agent 启动或单独的 `Stop` 不会重开已完成任务。缺少显式身份的结束证据只归到已观测的执行上下文，不落到最新的排队提交。

即使缺少 `Stop`，可靠归属的 transcript 终态或核验过进程身份的 idle registry 也能结束任务。陈旧的 idle 时间戳不能结束较新的活动。`/statusline-configure` 的 expansion 返回阻止决定时，主动隐藏自己的计时，不结束上一个人类任务，也不依赖 registry。epoch 序号缺口、旧 epoch 和有歧义的身份保持不完整。超时和心跳过期不伪造完成。

失败与用户中断冻结已接受结果。原生终态若明确发生于随后会话退出之前，可以修正退出时的推断；迟到批次不会将正常完成的 print 会话误记为中断。强失败证据仍优先于成功声明。

## 独立耗时

任务耗时优先使用相同启动域、包含睡眠时间的起止样本，缺失时退化到经过校验的墙钟。Linux 使用 `CLOCK_BOOTTIME` 和 boot ID；macOS 使用连续时钟与启动 UUID；Windows 使用 uptime 和启动 GUID，不再从墙钟估计启动分钟。时钟或 API 不可用时记录退化；冻结值不会因重启或刷新改变。

原生 `durationMs` 独立记录，始终不校准任务总耗时。8 秒任务在收到 1.5 秒原生单轮耗时后仍为 8 秒。

执行耗时使用独立的累计／恢复时钟。并行工作不相加，主 Agent 等待仍在工作的 Agent 时继续执行。等待请求具有独立身份，重叠等待不会提前恢复。当前宿主并非在所有权限、问题和 MCP 等待中提供准确起止，因此这些任务隐藏执行耗时并报告 `wait_coverage_missing`；不能证明并行等待及依赖覆盖时报告 `incomplete`。缺失观测不当作零等待。

## 存储与兼容

保留原存储位置和 schema-1 镜像。生命周期 v4 读取 v2/v3；旧冻结值保留为当时记录的历史，不重新解释成新指标。缺少执行证据时保持不可用。读取与预览不迁移文件，写入由会话锁保护并原子发布。

提交证据按 transcript 身份和完整行游标建立索引，仅保留有界 prompt ID。追加刷新只读新尾部，未变化文件不全量扫描；截断或重写使索引失效。已核验提交供终态 hook 复用，后续重放不改写强终态的冻结起点。

`diagnose` 报告已匹配任务的阶段、活跃数、待报数、等待原因与最近结束证据；如果已记录核验过进程身份的 registry 观测，也显示该观测。诊断不扫描 transcript、不重新核验进程、不修改任务存储。

另见[运行契约](live.zh-CN.md)、[测试](testing.zh-CN.md)和[用户计时标记](../reference/cli.zh-CN.md#prompt-计时标记)。
