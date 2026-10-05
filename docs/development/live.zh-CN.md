# 实时观测契约

[English](live.md) | **简体中文**

随包 `statusline-runtime` Mod 支持已核验的 Claude Code 2.1.289+ 宿主。原生任务计时默认开启，高级实时指标仍按需启用；偏好与编辑器及显示项选择独立。

`claude-statusline-runtime.json` 使用 schema 2：缺省 `native_timing=true`、`live_metrics=false`。旧 schema 1 的显式 false 保留为两者关闭，true 保留为两者启用；重装保留选择。`install --native-timing`／`--no-native-timing` 控制原生计时，`--live-metrics` 开启完整观测，`--no-live-metrics` 保留原先的全部关闭行为；同一命令明确给出的计时选项独立控制计时。不兼容或未知宿主暂挂 Mod，不改写偏好。

## 运行传输

`claude-statusline runtime --config-dir PATH` 接收一个 UTF-8 JSON 对象并返回一个 JSON
响应。运行协议 **2** 与配置协议独立演进；stdout 仅含 `{protocol_version,result}`
或 `{protocol_version,error}`，成功退出 0，拒绝退出 2。重复字段、不安全身份、非有限／
负数、未知字段及超过 1 MiB 的请求均被拒绝。`observe` 在写入前校验整批记录。

| 操作 | 载荷 | 行为 |
| --- | --- | --- |
| `observe` | `{observations:[...]}` | 最多 256 条严格记录；返回接收／忽略计数和后端版本。关闭采集时不持久化。 |
| `read` | `{session_id,prompt_id}` | 会话隔离状态、当前 prompt、时效与不可用原因；不修复或写入文件。`prompt_id` 可为 null。 |

每条观测包含 `session_id`、`epoch`、`seq`、`observed_at_ms`、`source`、`kind`、
可空的 `prompt_id`／`turn_id`／`agent_id`／`parent_agent_id`／`request_id`，以及按 kind
定义的 `payload`。Python 负责校验，`tools/generate_runtime_contracts.py` 生成 TypeScript
定义，前端不手工维护另一份契约。基础观测包括心跳、失效、prompt、权限快照与代理起止。
只有验证的变更来源可声明实时权限值；hook 快照表示当时的观测，不代表设置中的
`defaultMode`，也不能证明模式此后没有变化。

## 归属与持久化

每个会话使用 `statusline_runtime/live` 下的哈希文件名；设置
`CLAUDE_STATUSLINE_RUNTIME_DIR` 后改用其下的 `live`。固定会话锁覆盖读取、归并与原子
发布；POSIX 文件使用私有权限。最多保留 100 个会话、32 个 epoch、32 个 prompt 和
256 个代理。每个 epoch 保留 4096 个序号的去重窗口，拒绝窗口下界以前的序号。
序号缺口标记覆盖不完整；缺失或含糊归属不会自动附加给当前 prompt。

native 心跳建立 epoch，每 5 秒更新，超过 15 秒失效，时钟倒退保持不可用。新的加载
重建实时绑定并将未完成覆盖标记不完整；旧 epoch 可保留明确归属的历史，不能覆盖当前
观测。恢复、清空和结束使实时状态失效；Mod 在这些边界后重新核实会话绑定。

观测 hook 原样传递输入与结果。有界队列在常规事件处理外批量发布，拒绝后按原身份重试，
溢出仍保留初始化心跳。采集故障不改变模型请求或计时完成状态，原生计时观测归并到同一任务存储；高级指标仍只维护派生视图。安装器不会启用或重定向遥测导出，也不在状态文件中保留 prompt、回复或
任意工具参数。

## 验证

运行 Python 运行协议／存储、独立安装回归、生成契约校验、精确宿主声明、严格官方验证、
官方 Mod 测试和 TypeScript。`tools/runtime_install_smoke.py --report PATH` 在临时配置中
验证实际安装、两 Mod 共存、read／observe、重复安装、旧宿主暂挂／恢复、独立关闭和卸载，
不调用模型。native CI 保留旧编辑器任务，Linux 2.1.289 之外新增 Windows／macOS 2.1.289。
安装成功和模拟心跳不构成真实会话加载或人工交互验收。

另见[架构](architecture.zh-CN.md)、[测试](testing.zh-CN.md)、
[官方 Mods 事件](https://code.claude.com/docs/en/plugins/mods/reference)和
[官方遥测](https://code.claude.com/docs/en/monitoring-usage)。

## 状态视图

Turn ID 将主线程工具及代理启动绑定到执行中的任务，不受新排队 prompt 影响。Native 启动结果建立父子归属，未知 loop ID 保持不可用。Task/Todo 快照和更新按 prompt 保存，重载时清空。成功的空快照表示 0/0，与无观测不同。最近开始的主线程工具优先，即使更早的并行工具稍后才结束。心跳过期后仍可读取终止历史，未结束的实时观测不继续显示。

## 请求

独立运行协议 v1 新增 request_start/first/end、turn_usage 和 request_cost。本地请求 ID 包含 turn、agent、step；官方费用使用独立服务端请求 ID 去重。用量要求四项非负整数。宿主引用区分真实与合成流，迭代器 next/return/throw、块和结果原样传递，观测失败独立降级。

Python 保存未归属的 turn、请求、启动和工具；只用唯一已结束生命周期区间和明确父级启动身份核对。高级指标不写生命周期状态。无归属 workflow/fork 排除；任务 token 包含已验证嵌套代理和主线程收尾，turn.complete 总量仅核对覆盖。冲突重复令请求不可用；缺失用量未知，零值是真实观测。TTFT 和输出率对应最新主请求，拒绝倒退或零耗时时钟。已有 api_request collector 记录可提供可靠归属费用估算小计，未关联覆盖仍标为部分。

官方 user_prompt 遥测以 prompt.id 和 message.uuid 明确关联；不同 UUID 或延迟费用不通过文本／token 数匹配。只有关联消息属于已验证的执行／结束任务后，未归属费用才可显示。

## v1.6.0 正式版验收

2026-10-05，维护者确认 v1.6.0a1 在 Linux、Windows、macOS 验收通过；未提供具体 OS、架构、终端和宿主版本。这是新增的 Phase 5 验收记录，与历史编辑器确认及自动／headless／PTY 证据分开记录。已有 macOS Client 输入限制继续保留。正式 v1.6.0 沿用已验收运行实现、显示 schema v4、配置协议 v3 和运行协议 v1；兼容宿主的编辑器默认启用并保留明确 false，实时采集继续独立默认关闭并保留偏好。

## 任务计时接入

运行协议 v2 增加原生报告耗时、等待起止和明确覆盖元数据。兼容接收 v1，但 v1 不证明精确执行耗时。仅计时模式抑制高级数据持久化，仍追踪序号连续性。锁顺序为运行观测锁后任务锁；任务写入不获取运行观测锁。重试保留身份并保持幂等。

print／SDK 未发出 session.append 时，官方 prompt ID／消息 UUID 关联可将唯一已核验生命周期归属提升为原生身份。无归属 turn 保持无归属。发生于会话退出之前的原生完成不因批次迟到而误记中断；消息别名与后台报告别名独立。详见[任务时钟](timer.zh-CN.md)。

`runtime read` 包含 `task-active-timer`；不可用原因包括 `native_timing_disabled`、`wait_coverage_missing`、`incomplete`、`stale`、`abnormal_clock`。当前宿主不能核验权限／问题／MCP 等待的准确起止时，保守隐藏执行耗时。
