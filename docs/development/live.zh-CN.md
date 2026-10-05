# 实时观测契约

[English](live.md) | **简体中文**

Phase 5 源码开发新增独立、默认关闭的 `statusline-runtime` Mod，要求经过固定构建验证的
Claude Code 2.1.289，不依赖 native 编辑器偏好。`install --live-metrics` 启用，
`--no-live-metrics` 保存明确关闭选择；预览与正式版本在偏好缺失时均默认关闭。
独立 schema 1 文件 `claude-statusline-runtime.json` 不随显示配置导入导出。
官方安装、所有权检查、备份、回滚、版本暂挂与移除复用参数化的编辑器安装实现。

## 运行传输

`claude-statusline runtime --config-dir PATH` 接收一个 UTF-8 JSON 对象并返回一个 JSON
响应。运行协议 **1** 与配置协议独立演进；stdout 仅含 `{protocol_version,result}`
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
溢出仍保留初始化心跳。采集故障不改变模型请求或计时完成状态，`runtime/live` 不写入
`runtime/turns`。安装器不会启用或重定向遥测导出，也不在状态文件中保留 prompt、回复或
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
