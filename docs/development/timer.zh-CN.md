# 计时指标与生命周期证据

[English](timer.md) | **简体中文**

`prompt-timer` 测量用户任务。使用过子 Agent 的任务包含提交/排队、全部 Agent 工作与主 Agent 收尾，只由主 Agent 最终 `Stop` 确认完成；失败和中断各自具有终态证据。超时不伪造完成。

## 独立指标

| 指标 | 来源 | v1.1.1 中的用途 |
| --- | --- | --- |
| 任务耗时 | 最早可信提交与已接受终态的时钟 | 多 Agent、失败及中断任务的冻结结果 |
| 原生单轮耗时 | transcript 的 `turn_duration.durationMs` | 普通成功单轮满足条件时校准一次 |
| 会话运行时间 | `cost.total_duration_ms` | 现有复合 `cost` 条目中的时间 |
| API 累计等待时间 | `cost.total_api_duration_ms` | 独立定义，当前 `cost` 不显示 |

会话运行时间跨恢复累计，不包含会话未运行的间隔；API 等待时间是等待 API 响应的时间，见 [官方状态栏字段](https://code.claude.com/docs/en/statusline)。

## 证据优先级

| 优先级 | 证据 |
| --- | --- |
| 100 | `StopFailure` |
| 95 | 按时间归属的 transcript 中断，或运行中会话的 `SessionEnd` |
| 90 | 主 Agent 最终 `Stop` |
| 60 | 可靠归属的普通原生 duration |
| 50 | 本地命令排除 |
| 40 / 30 | 已核验进程的 registry 完成 / 撤回 |
| 20 / 10 | 恢复/启动时未知结束 / 新 prompt 替换 |

修改任何终态字段前，先检查归属与适用条件。较弱证据不修改状态、时长或错误；重复同优先级终态保持幂等。中断时间落在该任务内时，可替换较早到达的弱推断完成；最终失败可覆盖较弱成功证据。

原生校准是普通成功且无子 Agent 历史任务的有限例外：只修改一次 duration，保留最终 Stop 时间戳，不校准失败、中断或经历过 Agent 的任务。升级时，已有 duration 的旧普通成功记录视为已经校准。

## 子 Agent 阶段与冻结时钟

主 Stop 时仍有普通 Agent 则进入 `waiting_subagents`，最后一个子 Agent Stop 后进入 `resuming_main`。真实主 assistant 活动可使阶段回到 `main`，但持久 `had_subagents` 仍阻止 duration、idle 和撤回推断。即使缺少 start hook，`SubagentStop` 也能证明 Agent 历史。孤立或 Agent 内部事件不创建新的主任务。

迟到的 Agent start 只可重新打开 native/registry 推断完成，并清除校准，不会重新打开主 Stop、失败或中断等强终态。Stop 快照可修正缺少或重复的 Agent hook。Claude Code 会为结构化 Agent 结果通知触发新的 `UserPromptSubmit` ID。已知 Agent ID 将这些宿主 ID 关联到最初的人类任务；待交付报告阻止第一条通知的 Stop 在剩余报告和收尾前结束任务。经确认且此前尚未交付的新报告可继续一个表面上已 Stop 的任务；重复报告、失败和中断仍保持冻结。Shell/server/monitor/workflow 不进入 Agent 计时。

接受终态前，先从已写入的 transcript 核对一次匹配的真实用户提交；后续扫描不改写强终态已冻结的起点。接受终态时，优先使用匹配且包含睡眠时间的起止时钟，否则使用墙钟，冻结纳秒耗时。重启后的刷新不重新解释冻结值。未知结束仍显示为下界。旧记录中被缩短的多 Agent 或中断时长，可从已存起止证据恢复。

## Prompt 归属

Hook ID 标识所属主 prompt。增量 transcript 解析保留最近已确认的真实 prompt，与当前 hook prompt 独立，防止提前到达的排队 hook 抢走旧 duration。明确的 observation ID 优先。完整扫描重置解析上下文；重放旧 prompt 不替换更新的当前任务。本地命令不成为计时任务。

缺少 ID 或可信 transcript 上下文时，不把 duration 默认关联到当前 prompt。内部 reducer 为旧直接调用保留只有一条记录时的 fallback；真实解析事件会显式携带缺失归属，禁用此 fallback。缺少 prompt ID 的 Agent 事件须有已知所属关系或唯一无歧义任务。

计时扫描版本 5 会重新读取旧 transcript 元数据。显示 schema v2、feature schema v1、运行镜像 schema 1 与生命周期 schema 3 保持兼容；`duration_source`、已知 `agent_ids`、`prompt_aliases` 和 `pending_agent_reports` 为可选元数据。Agent 历史与续接 ID 各限制为每任务 256 项。

## 回归示例

第 1 秒提交，第 2 秒启动 Agent，第 3 秒主 Stop，第 4 秒 Agent Stop，第 9 秒最终主 Stop。迟到的 `durationMs=1000` 到达前后，任务都保持 `✓ 0m 08s`。测试覆盖恢复为 main、并行/重复 hooks、排队 prompt、本地命令、中断/失败顺序、有限 duration 校验和重启后的时钟回退。

真实会话证据及视觉验收边界见 [测试](testing.zh-CN.md)，面向用户的标记见 [使用指南](../reference/cli.zh-CN.md#prompt-计时标记)。
