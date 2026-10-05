# 显示项与指标定义

[English](DISPLAY_ITEMS.md) | **简体中文**

当前源码目录包含 53 个主栏项、14 个子 Agent 项。下列独立项默认关闭，现有默认选择和组合 ID
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
| `cache-state` | `Cache warm` | 主对话官方 `prompt_cache.warm`、`caching_observed`、`expires_at`：只有期限内显示 warm，过期为 cold，未观测缓存单独表示。 |
| `cache-expires` | `Cache TTL 4m 20s` | 仅在已观测主对话缓存仍 warm 时显示 TTL，需有效的未来 `expires_at`。 |
| `cache-misses` | `Cache miss 2` | 官方 `prompt_cache.misses`，不把压缩或清理后的 `expected_rebuilds` 当成 miss。 |
| `api-requests` | `API requests 14` | 官方主对话 `prompt_cache.requests`，不包含子 Agent 请求。 |
| `session-name` | `Session demo-session` | 已观测的 `session_name`，不以 ID 兜底。 |
| `session-id` | `ID demo-session` | 完整的 `session_id`。 |
| `session-id-short` | `ID demo-ses` | `session_id` 前八位；原有 `session` 仍优先名称，否则显示短 ID。 |
| `output-style` | `Style Default` | 官方 `output_style.name`。 |
| `git-branch` | `Git main` | 复用本地 Git 分支采集，游离 HEAD 显示 `HEAD@<hash>`。 |
| `git-changes` | `Git ~2 ?1` | 已暂存、未暂存、冲突及未跟踪文件数；确认干净时显示 `Git clean`。 |
| `git-ahead-behind` | `Git ↑1 ↓0` | 相对已配置上游的提交差距；同步时显示零，无上游时隐藏，上游已移除时显示 `[gone]`。 |
| `spend-amount` | `Spend $31.50 / $350.00` | 网关可选估算金额 `used_usd`／`limit_usd`，两者均须可用。 |
| `spend-period` | `Spend monthly` | 网关可选 `period`：daily、weekly 或 monthly。 |
| `input-tokens` | `in 1.29M` | 累计已记录的普通输入＋缓存写入＋缓存读取，从现有 `tokens` 同一主／子 Agent 会话统计读取原始整数。 |
| `output-tokens` | `out 22.4K` | 同一完整会话统计中累计已记录的输出。 |
| `run-state` | `State waiting agents` | 用户任务的主线程执行、等待代理、收尾及终止状态；来源失效或归属不明显示 `—`。 |
| `permission-mode` | `Mode plan*` | 事件实际观测的权限模式；hook 快照附 `*` 表示最近观测，15 秒后过期，不以设置默认值推断。 |
| `active-agents` | `Agents 2` | 本任务已验证的活跃代理数，包含嵌套代理并按 ID 去重；不统计后台 shell/server/workflow，归属不确定时标记已知小计 `*`。 |
| `task-progress` | `Tasks 3/5` | 成功的结构化 Task/Todo 操作维护的完成数/总数，完整快照优先；不是耗时百分比。有限覆盖附 `*`。 |
| `last-tool` | `Tool Read success` | 主线程最近开始的工具及成功、失败、拒绝或中断结果。 |

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

网关金额／周期字段要求 Claude Code 和网关同时为 2.1.284+；这些字段可缺失，关闭非必要流量时也可能没有。金额是独立采集的估算值，可能比比例晚约五分钟更新，不相互推算；窗口过期后隐藏全部所属字段。

累计输入／输出复用现有 cost-state 快照及 transcript 增量、消息 ID 去重、主与嵌套子 Agent 作用域；先相加整数再缩写，当前上下文字段不充当累计计数器。没有有效 usage 记录时不可用；已观测的全零响应显示零。原有格式化采集接口不变，原始整数快照不增加 I/O。

输入与输出的可用性独立判断：只观测到输出时，不推定输入为零。不完整的累计快照保留另一项的已知总量，各计数器从自己的快照位置继续叠加主／子 Agent 增量。旧会话缓存仅从可用 transcript 恢复一次可用性，不重复累计消息 ID。

缓存字段需 Claude Code 2.1.251+；warm 说明本地 TTL 有效，不保证下一次请求一定命中服务端缓存。请求／miss 统计仅覆盖主对话，详细 miss 原因留待后续。Git 分项与组合项每次刷新复用同一缓存采集结果。

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

CLI 列表与 JSON `describe` 返回共享目录；两个 TUI 和安装的向导统一消费它。显示 schema v3 与
JSON 协议 v2 为当前契约。最低版本元数据表示已验证的功能边界，不表示实时数据已经到达；缺少证据的最低版本保持未知。

即使 schema 不变，旧包仍不认识新增 ID。降级前应使用新版本从两个作用域中移除新 ID，或恢复兼容的配置备份。
另行遵循[原生接入降级步骤](USER_GUIDE.zh-CN.md#升级)。

## 实时状态项

以上五项默认不选中，采集使用独立的 `install --live-metrics` 开关，支持已验证的 Claude Code 2.1.289。缺少观测显示 `—`，真实零值显示 `0`，有限覆盖附 `*`。运行协议 `read` 返回来源、时间和具体原因。排队 prompt、旧 epoch 和代理事件不会覆盖新任务；终止历史独立于心跳保存。预览使用确定性样例，不读取实时状态。参见[运行契约](development/live.zh-CN.md)。
