# 显示项与指标定义

[English](DISPLAY_ITEMS.md) | **简体中文**

当前源码目录包含 33 个主栏项、14 个子 Agent 项。下列独立项默认关闭，现有默认选择和组合 ID
继续可用；允许组合项与其独立项同时选择并自由排序。原有显示项和全部配置入口见[使用指南](USER_GUIDE.zh-CN.md)。

## 主栏显示项

| ID | 示例 | 定义与来源 |
| --- | --- | --- |
| `model` | `claude-opus` | 优先使用 `model.id`，缺失时使用 `model.display_name`。 |
| `effort` | `high` | 实时 `effort.level`；模型不支持或字段缺失时隐藏。 |
| `context-tokens` | `Context 54K / 200K` | `context_window.current_usage` 中普通输入、缓存写入和缓存读取之和／窗口容量，不含输出。若分项对象不存在，可用官方 `total_input_tokens`；压缩后明确为 null 时仍视为不可用。 |
| `five-hour-reset` | `5h reset 2h 13m` | 按 `rate_limits.five_hour.resets_at` 倒计时。 |
| `weekly-reset` | `weekly reset 6d 2h` | 按 `rate_limits.seven_day.resets_at` 倒计时。 |
| `session-cost` | `Cost $0.12` | 官方会话累计费用 `cost.total_cost_usd`。 |
| `session-duration` | `Session 12m 30s` | 官方会话累计运行时间 `cost.total_duration_ms`。 |
| `api-duration` | `API 1m 15s` | 官方累计 API 请求耗时 `cost.total_api_duration_ms`。 |
| `lines-changed` | `+156/-23` | `cost.total_lines_added` 与 `cost.total_lines_removed`，两者均须已观测。这是 Claude 的会话编辑统计，与 Git 文件数不同。 |

## 子 Agent 显示项

| ID | 示例 | 定义与来源 |
| --- | --- | --- |
| `model` | `sonnet-5` | 已解析的 `tasks.model`，沿用去除 `claude-` 前缀的子 Agent 格式。 |
| `effort` | `high` 或 `16000` | 明确配置的 `tasks.effort`，支持数值预算；继承主会话 effort 时字段缺失。不受模型支持的配置等级可能与实际执行值不同。需 Claude Code 2.1.214+。 |
| `context-tokens` | `Context 84K / 200K` | `tasks.tokenCount`／`tasks.contextWindowSize`。 |
| `context-window-size` | `200K window` | 已解析的 `tasks.contextWindowSize`。 |

子 Agent 独立行及上下文字段需 2.1.205+。每项使用自己的任务数据，不以主会话值填补缺失字段。
现有子 Agent `tokens` 表示上下文占用，不表示 API 累计消耗。

## 时钟、可用性与作用域

- 重置时间戳为 Unix **秒**。每次刷新共用一个时钟；不足一秒的未来期限向上取整，依次使用秒、
  分钟／秒、小时／分钟、天／小时显示。过期时旧额度及倒计时同时隐藏；没有时间戳的旧比例输入仍可读取。
- 倒计时遵循现有宿主刷新间隔；`event` 只在事件触发时更新，启用显示项不会修改刷新设置。
- 缺失、异常类型、负数和非有限数值视为不可用，不伪装成零；已观测的零费用、零耗时和零行数照常显示。
  新 token 数需为非负整数，窗口容量需大于零。
- `prompt-timer` 统计最近一次人的任务，包含子 Agent 和主 Agent 收尾；会话运行时间与累计 API 耗时是
  独立官方指标，新增项不改变计时状态机。
- 文本先净化再渲染。新项和固定样例预览沿用现有配色、分隔符、作用域标签及宽度处理。

字段定义依据 [Claude Code 官方状态栏说明](https://code.claude.com/docs/en/statusline)。
独立模型项与组合项的选择方式也参考 [Codex 官方状态栏配置](https://learn.chatgpt.com/docs/developer-commands?surface=cli#configure-footer-items-with-statusline)。

## 配置与降级

使用独立指标替换主栏选择的示例：

```text
claude-statusline config set-items model effort current-dir context-tokens five-hour-reset session-cost api-duration prompt-timer
```

CLI 列表与 JSON `describe` 返回共享目录；两个 TUI 和安装的向导统一消费它。显示 schema v2 与
JSON 协议 v1 不变。最低版本元数据表示已验证的功能边界，不表示实时数据已经到达；缺少证据的最低版本保持未知。

即使 schema 不变，旧包仍不认识新增 ID。降级前应使用新版本从两个作用域中移除新 ID，或恢复兼容的配置备份。
另行遵循[原生接入降级步骤](USER_GUIDE.zh-CN.md#升级)。
