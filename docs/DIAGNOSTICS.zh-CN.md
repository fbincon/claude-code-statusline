# 诊断指定的状态栏输入

[English](DIAGNOSTICS.md) | **简体中文**


外部数据源的注册、授权、刷新、诊断及分享边界见[扩展指南](EXTENSIONS.zh-CN.md)。

命名显示方案、用户侧项目绑定和只读任务详情，分别参见[方案管理](PROFILES.zh-CN.md)和[任务详情](TASK_DETAILS.zh-CN.md)。

`doctor` 检查安装，`diagnose` 解释你显式提供的状态栏 JSON，使用已保存的显示配置，并默认补充匹配的已有本地观测。命令只输出报告，不保存或采集数据。两个编辑器的 Explain 面板仍解释**示例**，不代表实时会话。

## 运行诊断

使用你已经从 Claude Code 状态栏 stdin 捕获的 JSON：

```bash
claude-statusline diagnose --input statusline-input.json
claude-statusline diagnose --input statusline-input.json --width 80 --json
cat statusline-input.json | claude-statusline diagnose --input - --input-only
claude-statusline --language zh-CN diagnose --input statusline-input.json
claude-statusline diagnose --input subagent-input.json --scope subagent --width 40
```

文件必须包含一个 JSON 对象，不是编辑器草稿、诊断报告或运行时事件封装。子代理诊断使用宿主包含 `tasks` 的输入对象。支持 UTF-8 和开头的 BOM；拒绝重复键、非有限 JSON 常量、非对象根节点及超过 32 MiB 的输入。未知宿主字段允许存在；缺失字段保持未知，无效的已知字段在报告中标出。

| 参数 | 含义 |
| --- | --- |
| `--input FILE` / `--input -` | 必填：文件或标准输入，不自动寻找最近一次输入。 |
| `--scope main\|subagent` | 默认 `main`。 |
| `--width N` | 默认 120，整数范围 2–10000。主栏在此宽度内应用已保存的 host padding；子代理使用该宽度代替输入的 `columns`。 |
| `--json` | 输出含稳定原因码和样式文本片段的结构化结果；错误对象含 `error` 成员。 |
| `--input-only` | 排除本地观测存储和本机主机名；仍读取显示、安装和采集器设置以解释配置。 |
| `--observed-at ISO_TIME` | 可选的已知输入采集时间，须含时区，例如 `2026-10-19T20:00:00+08:00`；绝不从文件修改时间推断。 |
| `--config-dir PATH` | 选择 Claude 配置目录，仍支持既有环境变量规则。 |

退出码 `0` 表示已生成报告，包括证据不可用或陈旧的报告；参数、输入或文件读取错误返回 `2`。成功生成报告不代表安装健康或实时观测完整。

## 阅读报告

报告分别说明配置、输入字段、本地观测和布局结果。每个实例保留自己的 ID，因此相同指标的重复实例可有不同条件、优先级及宽度。区分配置关闭、行或条件隐藏、字段缺失／无效、来源不可用、身份不符、零值、部分覆盖、陈旧、新鲜度未知、截断及宽度省略。

`output` 是**给定输入与可用证据下的拟合输出**，不是实时终端录制。真实诊断的 JSON 为 `sample:false`，示例解释 `explain` 仍为 `sample:true`。宿主能力以输入的 `version` 为依据，本机安装和采集器设置独立呈现。

输入采集时间、诊断时间和各来源的已知观测时间分别记录。没有采集时间时，输入字段的新鲜度未知；仅有时间戳也不能证明数据仍新鲜。运行时和 Git 缓存沿用已有时效规则，终态任务证据可以描述历史。晚于指定输入时间的观测被排除，不使用较新的存储重建过去状态。

## 已有本地观测

- 会话用量只读取既有用量缓存，严格匹配会话和缓存中记录的转录路径，不读取转录本身。旧缓存没有采集时间，因此新鲜度未知，也不能用于重建指定 `--observed-at` 时刻的历史。
- 任务和请求数据要求匹配 session、prompt 或既有无歧义别名。缺少 prompt 时绝不选择最近任务。已有任务证据不要求先采集用量。
- 运行时指标只使用已保存的绑定和请求／费用关联，诊断不执行协调；关联不完整时保持部分覆盖或不可用。
- 子代理结束证据匹配 session、prompt 和 agent。没有可靠结束证据时不编造耗时。
- Git 状态缓存匹配会话键、目录和有效期，不运行 Git 命令。提交差异缓存在不额外检查的情况下无法可靠关联，因此在此模式中保持不可用。

诊断不执行网络查询、模型调用、转录扫描、后台快照、建锁、修复、缓存更新或清理。配置文件绕过管理事务锁读取；各文件是独立有效快照，不保证并发写入时跨文件全局原子一致。损坏或不可读的存储只报告问题，不修复。

## 工作树和缓存未命中

`worktree` 保留 Claude 工作树会话 `worktree.name` 的优先级；缺失时使用 `workspace.git_worktree`，显示 `Git 工作树 NAME`。诊断列出两个名称及实际采用的来源，字段缺失不会触发 Git 采集。

可在任一编辑器启用可选原因组件，也可运行：

```bash
claude-statusline config enable cache-miss-reason
```

`cache-miss-reason` 默认关闭，显示宿主判断的主会话最近一次缓存未命中的**可能原因**。已知原因本地化，未知原因码保持可读并移除控制字符。诊断还展示存在的 `last_miss_at`、`tools_added`、`tools_removed` 和可为负数的 `system_char_delta`。已诊断未命中次数为零、宿主未识别原因及字段缺失分别处理；多个原因可同时存在。

来源为[官方状态栏契约](https://code.claude.com/docs/en/statusline)，缓存原因需要 Claude Code 2.1.260+。既有 `prompt-cache` 保持官方主会话命中率：分母含全部输入 token，不含子代理流量；PR/MR 行为不变。

显示 schema 保持 8。旧包不认识 `cache-miss-reason`，降级前应移除该组件或恢复旧配置备份。诊断不自动迁移或改写配置。

另见[后端契约](development/contracts.zh-CN.md)、[指标定义](DISPLAY_ITEMS.zh-CN.md)及[实现与验收](development/real-input-diagnostics.zh-CN.md)。
