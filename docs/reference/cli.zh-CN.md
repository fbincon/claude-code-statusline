# CLI 参考

[English](cli.md) | **简体中文**

本页说明命令语法、选项、显示字段、配置格式及当前接口版本。操作流程见[使用指南](../USER_GUIDE.zh-CN.md)和[使用演示](../SHOWCASE.zh-CN.md)。下列值域描述当前软件包，历史交付记录保留原始版本。

无子命令的交互调用打开经审阅的[持久安装流程](../SETUP.zh-CN.md#首次入口与-npm-持久安装)，支持 `--prefix`、`--config-dir`、`--dry-run`；普通非 TTY 入口不进行变更。

## 文档导航

- [CLI 总览](#cli-总览)
- [语言设置](#语言设置)
- [安装与诊断](#安装与诊断)
- [配置命令详解](#配置命令详解)
- [方案与项目](#方案与项目)
- [导入、导出与复用](#导入导出与复用)
- [数据源管理](#数据源管理)
- [诊断与任务查看](#诊断与任务查看)
- [外观与显示选项](#外观与显示选项)
- [显示项与数据作用域](#显示项与数据作用域)
- [配置文件](#配置文件)
- [协议与 schema 版本](#协议与-schema-版本)
- [自定义配置目录与环境变量](#自定义配置目录与环境变量)
- [退出码](#退出码)

[方案与项目](../PROFILES.zh-CN.md) · [完整方案](../SCHEMES.zh-CN.md) · [草稿历史与复用](../DRAFT_HISTORY.zh-CN.md) · [输入诊断](../DIAGNOSTICS.zh-CN.md) · [版本管理](../PACKAGE_MANAGEMENT.zh-CN.md)

## CLI 总览

方括号表示可选参数，`A|B` 表示从中选择一项，`...` 表示重复；`PATH`、`ITEM`、`ID`、`LANGUAGE` 等大写名称是占位符。含空格的路径和文本需加引号，不要原样输入语法记号。

```text
claude-statusline [--language LANGUAGE] COMMAND ...
claude-statusline [--language LANGUAGE] [--prefix PATH] [--config-dir PATH] [--dry-run]
claude-statusline --help
claude-statusline --version
```

Windows PowerShell 使用 `claude-statusline.cmd`，命令参数和输出格式相同。根选项 `--language` 放在命令前。无子命令形式用于审阅持久安装；普通非 TTY 入口退出码为 2，不修改安装或配置。

### 命令索引

| 命令 | 参考 | 用途 |
| --- | --- | --- |
| `setup / install / uninstall / configure` | [安装与诊断](#安装与诊断) | 安装、接入与编辑器入口 |
| `update / rollback / recover` | [包管理与恢复](#包管理与恢复) | 包审阅、替换及三种恢复形式 |
| `config show / list-items / set-items / enable / disable / order / subagents / set / apply / preset / reset` | [配置命令详解](#配置命令详解) | 用户默认显示及宿主设置 |
| `config instance / group / layout / alignment / item` | [配置命令详解](#配置命令详解) | 实例、布局组合及逐项选项 |
| `config profile / project` | [方案与项目](#方案与项目) | 命名显示方案及项目绑定 |
| `config import / export` | [导入导出与复用](#导入导出与复用) | 完整／选择性传输、样式及分组复用 |
| `source` | [数据源管理](#数据源管理) | 本机数据源许可、绑定及刷新 |
| `doctor / diagnose / task show / task view` | [诊断与任务查看](#诊断与任务查看) | 安装检查、输入诊断及已有任务证据 |
| `config language / --language` | [语言设置](#语言设置) | 界面与显示语言选择 |

内部 `render`、`render-subagents`、`hook`、`slash-hook`、`ui`、`runtime` 接口见[内部命令附录](../development/README.zh-CN.md#附录内部命令)。

### 配置目录与帮助

配置目录按显式 `--config-dir PATH`、`CLAUDE_CONFIG_DIR`、`~/.claude` 的顺序选择，参数位置取决于命令：

| 命令族 | `--config-dir PATH` 的位置 |
| --- | --- |
| `config`, `source` | 紧跟命令，位于动作之前 |
| `configure` | 紧跟命令，位于目标选项之前 |
| `setup`, `install`, `uninstall`, `doctor`, `update`, `rollback`, `recover`, `diagnose`, `task show/view` | 位于该命令的选项中 |

```text
claude-statusline config --config-dir "/path/to/claude config" show
claude-statusline source --config-dir "/path/to/claude config" list
claude-statusline configure --config-dir "/path/to/claude config" --user
```

`--help` 可用于 `config set --help` 等命令路径，但当前实现返回共享的 `config` 总览，不提供动作专属参数帮助；完整语法以本页对应章节为准。

### 操作目标、前置条件与效果

| 操作 | 目标与前置条件 |
| --- | --- |
| `config show / list-items` | 读取用户默认及安装身份，不解析项目实际选择的 Profile；支持 `--json`。 |
| `config set-items / enable / disable / order / item / instance / group / layout / alignment / set` | 编辑用户默认。显示修改不要求主栏安装归属，宿主字段要求归属；项目绑定还可能协调归属本工具的子代理接入，保留对第三方渲染器的保护。 |
| `config apply / preset / import` | 完整应用包含宿主设置并要求安装归属；受支持的 `--dry-run` 形式只预演，不保存。 |
| `configure` | 要求交互终端、有效配置及安装归属；默认编辑工作目录解析出的方案，可用 `--user`、`--profile`、`--project` 选择目标。 |
| `config import --select / --style-from / --groups` | 默认以用户配置为目标，可明确选择用户／Profile／项目；目标写入沿用已有归属与修订检查。 |
| `source` | 注册、启用、绑定、手动刷新及自动策略分别生效；显示保存／导入不能授予来源执行许可。 |
| `diagnose / task show` | 非交互报告使用明确输入或已有证据，不启动采集；缺少证据可以成功返回不可用报告。 |

不保存显示设置不等于完全没有文件系统活动：部分读取使用锁，包预演使用临时 staging／npm 缓存，已启用 JSON 源可以发布观测缓存。以各命令说明的边界为准。操作成功通常退出 0，已处理的参数／配置错误退出 2；doctor、setup 及信号另有[退出码](#退出码)。

## 语言设置

### 界面语言

兼容别名 `zh-Hant` 在所有语言参数与旧配置中映射为 `zh-TW`；读取不改写文件，显式保存／导出使用规范代码。地区选项为 `zh-TW`（台湾）和 `zh-HK`（香港）。

`config language show [--json]` 读取共享偏好；JSON 为 `{"schema_version":1,"ui_language":"en"}`，其中 `ui_language` 为所选受支持代码。`set en|zh-CN|zh-TW|zh-HK|ja|ko|es|fr|de|pt-BR|ru|id` 和 `reset` 显式保存，reset 选择英文。根选项 `--language en|zh-CN|zh-TW|zh-HK|ja|ko|es|fr|de|pt-BR|ru|id` 放在子命令前，优先用于本次调用，不修改文件；用于 `configure` 时控制初始界面语言。

帮助正文／分组、参数错误和管理输出使用所选语言。命令名称、参数值、退出码、目录 JSON 保持稳定；实际状态栏采用独立显示语言。支持的宿主上 `/statusline-config language show|set|reset` 也可本地执行。详见[语言行为与恢复](../USER_GUIDE.zh-CN.md#界面语言)。

### 状态栏语言

`config set statusline-language en|zh-CN|zh-TW|zh-HK|ja|ko|es|fr|de|pt-BR|ru|id` 保存显示语言。`config apply --statusline-language en|zh-CN|zh-TW|zh-HK|ja|ko|es|fr|de|pt-BR|ru|id` 与其他答案一起原子保存，省略时保留当前值。两个编辑器立即预览草稿语言，保存／取消控制实际输出。`config language` 及根参数 `--language` 仅控制界面。

当前显示 schema 必须包含 `statusline_language`；当前版本与读取范围见[协议与 schema 版本](#协议与-schema-版本)。读取／导入历史 v1–v5 补为英文，预设保留它，导出包含它，reset 恢复英文。旧版向导读取界面偏好，将翻译答案映射到稳定代码后一次 apply。见[用法与降级恢复](../USER_GUIDE.zh-CN.md#状态栏语言)。

## 安装与诊断

```text
claude-statusline setup [--config-dir PATH] [--dry-run]
claude-statusline install [--config-dir PATH] [--dry-run] [--force]
  [--native-editor | --no-native-editor]
  [--experimental-slash-tui | --no-experimental-slash-tui]
  [--native-timing | --no-native-timing] [--live-metrics | --no-live-metrics]
claude-statusline uninstall [--config-dir PATH] [--dry-run]
claude-statusline configure [--config-dir PATH] [--user | --profile NAME_OR_ID | --project PATH]
```

安装 npm 软件包后，可通过 `setup` 向导预览显示并审阅 Claude Code 接入。`install` 用于直接配置接入。参见[首次设置](#首次设置与完整方案)。

| 命令 | 行为 |
| --- | --- |
| `install` | 合并归属本工具的 Claude 接入，实际修改前备份 |
| `install --dry-run` | 预览修改，不安装资源、不写入文件 |
| `install --force` | 允许替换冲突的主栏、子 Agent 设置或同名 skill；原生插件身份冲突仍需解决归属 |
| `uninstall [--dry-run]` | 移除或预览移除本工具接入，保留显示文件、偏好、状态和备份 |
| `doctor` | 诊断安装，不重写配置、不打开编辑器 |
| `configure` | 在当前终端打开 Node 终端编辑器，要求配置有效、接入归属正确、输入输出为 TTY、尺寸至少 64×18 |

各命令均可在命令名后使用 `--config-dir PATH`。`install` 的四组独立偏好参数为：

- `--native-editor` / `--no-native-editor`：会话内 Client，需 Claude Code 2.1.287+。
- `--experimental-slash-tui` / `--no-experimental-slash-tui`：外部入口，需 2.1.258+。
- `--native-timing` / `--no-native-timing`：原生计时元数据，需 2.1.289+。
- `--live-metrics` / `--no-live-metrics`：高级实时采集，需 2.1.289+。

每组参数互斥。显式参数优先于已保存值，已保存值优先于默认值；编辑器默认启用，原生计时和高级实时指标默认关闭。`--no-live-metrics` 保留同时关闭计时和高级采集的旧语义，同一命令中的显式计时参数可单独决定计时部分。不兼容或未知宿主暂挂请求的接入并保留偏好，宿主中主动禁用的插件保持禁用。接入变化后重启 Claude Code。详见[安装](../USER_GUIDE.zh-CN.md#安装与接入)、[备份](../USER_GUIDE.zh-CN.md#备份与回滚)和[卸载](../USER_GUIDE.zh-CN.md#卸载)。

### 首次设置与完整方案

`setup` 串联检查、候选预览与明确的显示／接入提交。`--dry-run` 为只读且无需 TTY，普通非 TTY 调用退出码为 2，详见[设置向导](../SETUP.zh-CN.md)。八套完整方案定义布局及全局外观；原六种预设保留原有全局外观行为。参见[方案文件与分享](../SCHEMES.zh-CN.md)。

### slash 命令支持范围

`/statusline-config` 参数解析委托给共享配置解析器，支持以下十九项顶层动作：

| 动作 | 范围 |
| --- | --- |
| `show`、`list-items`、`set-items`、`enable`、`disable`、`order` | 查看或修改用户默认主栏条目 |
| `subagents` | `list-items`、`set-items`、`enable`、`disable`、`order` |
| `set`、`apply`、`item` | 显示／宿主选项、一次组合保存或指定范围条目选项 |
| `instance`、`group`、`alignment`、`layout` | 明确的组合操作，包括受支持的结构 dry-run／审阅参数 |
| `preset`、`import`、`export` | 应用或传输配置，支持与对应终端动作相同的参数 |
| `language`、`reset` | 界面语言偏好或用户默认配置重置 |

Claude Code 2.1.258+ 且 hooks 启用时本地执行；旧版、未知版本或 hook 被禁用时，通过 skill 使用模型回合。无参数问答向导始终使用模型回合。传入单个动作的字面参数；shell 操作符和任意终端命令不是受支持的执行接口。前置 `--config-dir` 是终端选项，不是 slash 动作。

`config profile`／`config project` 管理仍使用终端 CLI 或编辑器。普通 slash 显示修改和向导修改用户默认配置，项目绑定仍可能选择命名方案。`/statusline-configure` 不接受配置参数；`help`、`-h`、`--help` 显示用法。详见[入口选择](../USER_GUIDE.zh-CN.md#选择配置入口)。

### 包管理与恢复

```text
claude-statusline update [--version EXACT | --channel latest|beta] [--check | --dry-run]
  [--prefix PATH] [--config-dir PATH] [--yes] [--json]
claude-statusline rollback [--version EXACT] [--prefix PATH] [--config-dir PATH]
  [--dry-run] [--yes] [--json]
claude-statusline recover [--config-dir PATH] [--dry-run]
claude-statusline recover --package [--version EXACT] [--prefix PATH] [--config-dir PATH]
  [--dry-run] [--yes] [--json]
claude-statusline recover --restore-config BACKUP_ID [--prefix PATH] [--config-dir PATH]
  [--dry-run] [--yes] [--json]
```

| 形式 | 用途及限制 |
| --- | --- |
| `update` | 默认沿用记录的渠道或 `latest`；指定精确版本不能降级。`--check` 仅审阅元数据，`--dry-run` 还暂存并验证软件包。 |
| `rollback` | 省略版本时选择该 prefix／配置目录的上一成功产物；明确指定的版本必须更旧。 |
| `recover` | 恢复未完成的文件／插件事务，不接受包、版本或 JSON 选项；先预演再应用。 |
| `recover --package` | 审阅并继续保留的包事务，检查实际安装产物及执行器存活状态。 |
| `recover --restore-config` | 单独还原所选包备份的显示／Profile 配置；`BACKUP_ID` 使用实际返回的 `pkg-` 加 UUID 标识符。拒绝 `--version`，来源执行许可保持当前值。 |

包管理的 `--json` 要求同时使用 `--check` 或 `--dry-run`。非交互包替换要求精确 `--version`、明确 `--prefix` 和 `--yes`；配置还原则使用备份 ID，并要求 `--prefix` 与 `--yes`。交互写入展示审阅并要求确认，除非已传入 `--yes`。`--prefix` 选择持久 npm 安装，与 `--config-dir` 独立。

<!-- docs-example: cli-recover -->
```text
claude-statusline recover --dry-run
```

这一普通恢复预演报告保留的事务或“无未完成事务”，不应用恢复。包检查可能访问 registry／网络及普通 npm 缓存；预演不修改目标安装／配置。[完整审阅与恢复流程](../PACKAGE_MANAGEMENT.zh-CN.md)。

## 配置命令详解

[slash 命令支持范围](#slash-命令支持范围)列出的操作可在 Claude Code 中使用 `/statusline-config`；方案／项目管理使用终端 CLI 或编辑器。例如：

```bash
claude-statusline config set colors off
```

等价于：

```text
/statusline-config set colors off
```

### `config show`

显示当前**用户默认有效配置**，不表示项目实际采用的 Profile，包括显示配置、Claude Code 宿主配置、配置文件路径、当前 `statusLine.command` 是否属于这个可执行文件，以及子 Agent 行的 期望启用状态（enabled）、installed 和所有权状态。

```bash
claude-statusline config show
```

自定义五项显示、使用英文界面时的示例输出：

```text
Scope: user
Config: /home/user/.claude/claude-statusline.json
Installed: yes
Items: model-with-effort, current-dir, git, context-remaining, task-timer
Colors: on
Palette: default
Theme: classic
Powerline separator: ascii
Directory style: home
Separator style: classic
Scope labels: when-subagents
Statusline language: en
Subagent items: status-elapsed, name, model-with-effort, context-remaining, task
Custom subagent rows: on
Subagent statusline: owned
Padding: 0
Refresh interval: 1
Hide Vim mode indicator: no
```

“有效配置”不等于“磁盘上一定存在显示配置文件”：如果 `claude-statusline.json` 尚未创建，`show` 会展示内建默认值。

脚本或自动化应使用 JSON 输出：

```bash
claude-statusline config show --json
```

JSON 顶层的 `installed` 表示 `settings.json/statusLine.command` 是否为当前调用后端入口所拥有的渲染绑定，而非仅表示 npm 包存在。`subagent_statusline` 另含 `enabled`、`installed` 和 `state`；`state` 只会是 `owned`、`absent`、`foreign`、`unsupported`。

### `config list-items`

列出全部支持的显示项及当前启用状态：

```bash
claude-statusline config list-items
```

输出中的 `[x]` 表示已启用，`[ ]` 表示已禁用。列表按固定目录顺序显示，不代表当前渲染顺序；当前渲染顺序请看 `config show` 的 `Items`。

机器可读形式：

```bash
claude-statusline config list-items --json
```

每个 JSON 条目包含：

- `id`：传给其他命令的稳定标识符。
- `description`：显示项说明。
- `default_enabled`：主栏十个默认指标为 `true`，其他目录类型为 `false`，需主动选择。
- `enabled`：该类型是否至少有一个已启用实例。
- `position`：该类型恰有一个启用实例时，返回从 0 开始的位置；否则为 `null`。

共享目录还返回 `scope`、`label`、`group`、`sources`、`examples`、`default_position`、`minimum_version`、`minimum_version_status`、`format_options`、`excludes`、`unavailable_reasons`。版本元数据表示能力门槛，不代表数据已到达。子代理目录有 15 个指标及文本、留白两种类型，默认启用五个指标。

### `config set-items [ITEM...]`

一次性替换整个启用集合，同时把参数顺序保存为显示顺序：

```bash
claude-statusline config set-items model-with-effort current-dir git task-timer
```

执行后，未列出的所有条目都会被禁用。它适合从头定义一条精简状态栏。

对于按类型配置的显示，不传条目会清空主栏选择。

```bash
claude-statusline config set-items
```

接入、hooks 和子 Agent 选择均保留。需要清空子 Agent 选择时，使用 `config subagents set-items`。可用 `enable` 或新的 `set-items` 恢复主栏选择。

未知条目和重复条目都会被拒绝，且不会写入文件：

```bash
# 错误：clock 不是受支持的条目
claude-statusline config set-items model-with-effort clock

# 错误：git 重复出现
claude-statusline config set-items git git
```

### `config enable ITEM...`

启用一个或多个条目，并按参数顺序把此前未启用的条目追加到当前列表末尾：

```bash
claude-statusline config enable tokens task-timer
```

已经启用的条目不会重复，也不会因此移动位置。因此 `enable` 适合增量添加，不适合排序。

### `config disable ITEM...`

禁用一个或多个条目，其余条目的相对顺序保持不变：

```bash
claude-statusline config disable spend-limit tokens
```

禁用本来就未启用的合法条目是幂等操作，不会影响其他条目。

### `config order [ITEM...]`

只改变顺序，不改变启用集合：

<!-- docs-example: cli-order -->
```text
claude-statusline config set-items model-with-effort current-dir git task-timer
claude-statusline config order git current-dir model-with-effort task-timer
```

参数必须恰好包含当前已启用的每一个条目，并且每个条目只出现一次。少一个、多一个、加入尚未启用的条目或重复条目都会失败。

推荐先查看当前集合，再排序：

```bash
claude-statusline config set-items model-with-effort current-dir git context-remaining task-timer
claude-statusline config show
claude-statusline config order model-with-effort git current-dir context-remaining task-timer
```

如果当前启用集合为空，空参数的 `config order` 才是合法排序：

```bash
claude-statusline config order
```

### `config subagents ...`

子 Agent 行有一套独立的条目命令，语义与主栏的 `list-items`、`set-items`、`enable`、`disable`、`order` 相同：

```bash
claude-statusline config subagents list-items --json
claude-statusline config subagents set-items status-elapsed name model-with-effort context-remaining task
claude-statusline config subagents enable tokens current-dir
claude-statusline config subagents disable task
claude-statusline config subagents order status-elapsed name model-with-effort context-remaining tokens current-dir
```

子代理无启用实例时，`render-subagents` 仍为每个有效 task ID 输出合法 NDJSON，但 `content` 为空，Claude Code 因而隐藏相应自定义行。

`status-elapsed` 与 `status`、`elapsed` 互斥：`set-items`/`enable`/`apply` 组合非法时直接报错（例如已启用 `status` 的旧配置执行 `enable status-elapsed` 会失败，需先 `disable status elapsed`）；交互向导勾选其一时自动取消冲突项。

### 实例管理

`config instance main|subagent` 提供 `list [--json]`、`add TYPE_ID [--after ID] [--text TEXT]`、`copy ID`、`remove ID`、`enable ID`、`disable ID`、`move ID --before|--after ANCHOR` 和 `set ID OPTION VALUE`。新增与复制返回新 ID。`config layout --by-instance explicit ROW...` 以逗号分隔的实例 ID 指定行，包含全部已配置实例（含禁用项），顺序必须一致。

旧 `item`／启禁用命令仅在类型唯一时解析；旧批量选择、排序及布局操作遇到重复类型、文本或留白时拒绝，不选择首个匹配项，不删除实例。类型目录 JSON 增加 `instance_ids`、`enabled_instance_ids`、`instance_only`。完整示例见[组件与布局](../COMPOSITION.zh-CN.md)。

在显式布局或组件组合中切换唯一指标时，保留其位置及留白左右关系。简单自动布局的旧类型选择仍保留启用时追加到末尾的行为；使用 `config instance ... enable|disable` 可始终保留位置。

### 分组操作

`config group main|subagent list|create|set|copy|move|ungroup` 管理连续实例分组。创建要求 `ID --members ID,ID --primary ID`，可选 `--linked on|off` 与 `--powerline on|off`。移动要求 `--before ID` 或 `--after ID` 二选一。[示例与约束](../COMPOSITION.zh-CN.md#组件分组)。

```text
claude-statusline config group main|subagent list [--json]
claude-statusline config group main|subagent create ID --members ID,ID --primary ID
  [--linked on|off] [--powerline on|off]
claude-statusline config group main|subagent set ID members|primary|linked|powerline VALUE
claude-statusline config group main|subagent copy ID
claude-statusline config group main|subagent move ID (--before ID | --after ID)
claude-statusline config group main|subagent ungroup ID
```

`members` 使用逗号分隔实例 ID，`primary` 使用一个成员 ID，`linked`／`powerline` 使用 `on|off`。组成员必须连续。修改面向用户默认，受支持的结构审阅参数见对齐说明。

### `config layout auto|explicit [ROW...]`

自动模式沿用折行。保存的显式行按配置顺序包含全部实例 ID，包括禁用实例。输入也可仅按当前启用顺序列出全部启用实例，兼容路径会把省略的禁用实例补入保存的分行结构。下例先选择三个类型，再使用这一兼容输入。存在启用实例时，省略行参数会创建包含全部配置实例的单行。

<!-- docs-example: cli-layout -->
```text
claude-statusline config set-items model current-dir context-used
claude-statusline config layout explicit model,current-dir context-used
claude-statusline config layout auto
```

显式布局先按最大宽度截短，再隐藏低优先级项，同级先隐藏右侧项，不增加续行。调整项目顺序会维护分行结构。

### 主行对应列对齐

使用 `config alignment list`、`config alignment set ID --columns 'instance:A,instance:B;group:C,group:D'` 和 `config alignment remove ID` 管理稳定引用。逗号连接同列成员，分号分隔列。实例／分组／布局结构命令默认拒绝未经接受的对齐修复。先使用 `--dry-run` 审阅有效候选，再携带其 `--expected-revision` 和准确的逗号分隔 `--accept-alignments` ID 重复操作。候选无效、修订变化或接受列表不匹配时，保留已保存配置。[示例](../COMPOSITION.zh-CN.md#显式主行的对应列对齐) · [编辑器审阅与取消](../DRAFT_HISTORY.zh-CN.md#结构调整与对齐)。

### `config set OPTION VALUE`

只修改一个显示选项或 Claude Code 宿主选项：

```bash
claude-statusline config set colors off
claude-statusline config set palette ansi
claude-statusline config set directory-style project-relative
claude-statusline config set separator-style compact
claude-statusline config set padding 2
claude-statusline config set refresh-interval 5
claude-statusline config set hide-vim-mode-indicator on
claude-statusline config set subagent-statusline off
claude-statusline config set scope-labels when-subagents
claude-statusline config set statusline-language zh-CN
```

显示选项可以在安装 statusline 之前预先配置。宿主选项 `padding`、`refresh-interval` 和 `hide-vim-mode-indicator` 会修改 `settings.json/statusLine`，因此只在当前 statusline 已由这个 `claude-statusline` 可执行文件接管时允许修改。否则命令会拒绝写入，避免误改其他 statusline。

`subagent-statusline` 保存期望的启用状态。关闭时 `render-subagents` 不输出覆盖结果，保留宿主默认行；重跑 `install` 会进一步移除 owned `subagentStatusLine`。重新启用并运行 `install` 会在兼容版本上恢复接入。这个分离使 `config set subagent-statusline off` 可以在不触碰第三方设置的前提下解除安装冲突。

所有 `set` 的合法值见[显示与宿主选项](#显示与宿主选项)。

### `config item main|subagent ID OPTION VALUE`

修改已知作用域内的条目，包括当前未启用的条目：

```text
claude-statusline config item main model label Model
claude-statusline config item main model priority 100
claude-statusline config item main current-dir max-width 32
claude-statusline config item subagent task max-width none
```

`label`、`icon` 接受不含控制字符的最多 256 码点文本，`inherit` 清除覆盖，空字符串隐藏标签或图标。`priority` 为 0–100，默认 50；`max-width` 为 2–10000 或 `none`。七种格式键仅对兼容组件类型接受取值或 `inherit`；详见[逐项选项表](#逐项实例选项)。宽度按终端列计算，包括 CJK 与组合字符。

`foreground`／`background` 接受 `inherit`、`default`、`ansi:0`–`ansi:255` 或加引号的 `#RRGGBB`。`visibility` 接受 `always` 及该作用域项目支持的规则；`visibility-threshold` 为 0–100 整数，默认 70，仅对用量规则生效。条件按原始已用比例判定，独立于告警颜色。详见[适用规则与颜色优先级](../APPEARANCE.zh-CN.md)。

### `config apply`

一次提交完整的显示配置和宿主配置。无参数向导在收集完全部答案后使用该命令；也可以用于脚本化部署：

Linux / WSL / macOS（Bash）：

```bash
claude-statusline config apply \
  --items model-with-effort current-dir git context-remaining task-timer \
  --subagent-items status-elapsed name model-with-effort context-remaining task \
  --subagent-statusline on \
  --scope-labels when-subagents \
  --statusline-language en \
  --colors on \
  --palette default \
  --directory-style home \
  --separator-style classic \
  --padding 0 \
  --refresh-interval 1 \
  --hide-vim-mode-indicator off
```

Windows PowerShell：

```powershell
claude-statusline.cmd config apply `
  --items model-with-effort current-dir git context-remaining task-timer `
  --subagent-items status-elapsed name model-with-effort context-remaining task `
  --subagent-statusline on `
  --scope-labels when-subagents `
  --statusline-language en `
  --colors on `
  --palette default `
  --directory-style home `
  --separator-style classic `
  --padding 0 `
  --refresh-interval 1 `
  --hide-vim-mode-indicator off
```

`--items` 以及颜色、调色板、目录、分隔符和三个宿主设置参数均为必填。`--subagent-items`、`--subagent-statusline`、`--scope-labels` 可选，省略时保留当前值；TUI 和配置向导会提交全部字段。`--items` 与 `--subagent-items` 的条目列表都可为空。命令会先完整验证所有值，再在同一个锁和同一份备份下更新 `claude-statusline.json` 与 `settings.json`；任一后续写入失败时会尝试事务回滚。

因为 `apply` 包含宿主设置，所以必须先运行 `claude-statusline install`。

### `config preset NAME [--dry-run]`

六种原有预设名为 `minimal`、`developer`、`monitoring`、`multi-agent`、`left-right`、`repeated-metrics`。预设替换显示选择、布局、子 Agent 默认条目和逐项覆盖，使用模型简称、紧凑数字及递减的逐项优先级；保留颜色、调色板、主题、Powerline 字形、目录及分隔符、作用域标签、刷新与宿主设置，以及当前子 Agent 启用状态。Multi-agent 另隐藏 completed，限制六行，任务宽度 48。

```text
claude-statusline config preset developer --dry-run
claude-statusline config preset developer
```

同一命令也接受八套[完整方案](../SCHEMES.zh-CN.md)，它们还会设置全局外观。所有选择均保留输出语言及独立的采集／来源授权。

`--dry-run` 校验并输出草稿，不保存。实际应用包含宿主设置，需要当前 CLI 拥有安装接入。

### `config reset`

恢复本工具的默认显示和宿主设置：

```bash
claude-statusline config reset
```

它会：

- 删除 `claude-statusline.json`，让 renderer 使用内建默认显示配置。
- 如果本工具当前已安装，恢复 `padding=0`、`refreshInterval=1` 和 `hideVimModeIndicator=false`。值为默认值的可省略字段会从 `settings.json` 中移除。
- 保留 `statusLine.command`、所有本工具 hooks、personal skill、运行状态和缓存。

`reset` 也能处理损坏的 `claude-statusline.json`，因此它是配置文件 JSON 无法解析时最直接的恢复方法。

`reset` 仅修改用户默认显示及适用的宿主字段，保留 Profile 库、项目绑定和独立来源许可。因此，绑定项目在重置后仍可能渲染命名方案；可用 `config project resolve PATH --json` 核对。

## 方案与项目

`--config-dir PATH` 位于 `config` 后、`profile`／`project` 前。下列形式均支持 `--json`。`NAME_OR_ID` 解析已有 Profile；保存、重命名及新导入使用可读名称。

```text
claude-statusline config profile list [--json]
claude-statusline config profile save NAME [--overwrite] [--bind PATH] [--json]
claude-statusline config profile rename NAME_OR_ID NEW_NAME [--json]
claude-statusline config profile delete NAME_OR_ID [--json]
claude-statusline config profile preview NAME_OR_ID [--width N] [--scenario SCENARIO] [--json]
claude-statusline config profile activate NAME_OR_ID [--json]
claude-statusline config profile import PATH [--name NAME] [--overwrite] [--dry-run] [--json]
claude-statusline config profile export NAME_OR_ID PATH [--overwrite] [--json]
claude-statusline config project list [--json]
claude-statusline config project bind PATH NAME_OR_ID [--overwrite] [--json]
claude-statusline config project unbind PATH [--json]
claude-statusline config project resolve [PATH] [--json]
```

`save` 复制已保存的用户默认；`activate` 将 Profile 复制为用户默认，不创建项目绑定。名称区分大小写，去除首尾空白并作 NFC 规范化，允许 1–128 个 Unicode 码点且不含控制字符。覆盖同名方案、项目绑定或导出目标要求 `--overwrite`；已绑定方案不能删除。`resolve` 默认使用工作目录，选择最深匹配根并解释回退原因。修改保留锁、备份、修订及接入归属检查。

预览只读，宽度默认 120，范围 2–10000；场景默认 `normal`，可选 `normal`、`warning`、`critical`、`zero`、`missing`、`source-stale`、`source-failed`、`long-content`、`git-clean`、`git-modified`、`git-conflicted`、`no-agents`、`few-agents`、`many-agents`。完整 Profile 导入创建命名副本，选择性／样式／分组导入则按下文规则修改所选目标。

在新的示例方案库中，将 `/absolute/project` 替换为已有项目目录。以下示例展示用户默认修改及重置不会改变绑定的 Profile：

<!-- docs-example: cli-profile-target -->
```text
claude-statusline config set-items model
claude-statusline config profile save Work
claude-statusline config project bind /absolute/project Work
claude-statusline config set-items current-dir
claude-statusline config show --json
claude-statusline config project resolve /absolute/project --json
claude-statusline config reset
claude-statusline config project resolve /absolute/project --json
```

首次 `show` 的启用项为 `current-dir`；两次解析均选择 `Work`，其启用选择仍为 `model`。[编辑目标、共享与恢复](../PROFILES.zh-CN.md)。

## 导入、导出与复用

<a id="portable-import-export"></a>

### `config import PATH [--dry-run]` / `config export PATH [--overwrite]`

```text
claude-statusline config export ./statusline.json
claude-statusline config import ./statusline.json --dry-run
claude-statusline config import ./statusline.json
```

可移植格式恰好包含 `format: "claude-code-statusline"`、`version: 1` 和含 `display`、`host` 的 `draft`，不含安装、路径、revision、运行状态、编辑器及实时偏好、Claude 外观及行为偏好。导入也接受当前显示读取范围内的仅显示文件，此时保留现有宿主设置。实际导入要求安装归属，并原子保存已验证草稿。

文件采用 UTF-8，导入接受 BOM，上限 1 MiB；重复字段、非有限数字、错误字段及类型、不支持版本均拒绝。相对路径以当前工作目录为基准，`~` 展开。导出校验并写文件，不修改配置；目标已存在时拒绝，除非明确传入 `--overwrite`，该参数仍不能覆盖实时配置和归属本工具的插件或运行资源。编辑器导入只替换未保存草稿，导出包含当前未保存修改。

向受保护的配置路径导出会被拒绝，返回配置错误和退出码 2，保护目标不被修改。使用独立导出路径，脚本将任何非零结果作为失败处理。

### 选择性复用显示设置

`config import` 与 `config profile import` 支持 `--select FIELDS`、`--user | --profile NAME_OR_ID | --project PATH` 和 `--dry-run`。参见[选择键、目标规则与来源隔离](../PROFILES.zh-CN.md#选择性导入)。不传 `--select` 时保留原有完整导入行为。

### 样式与分组复用

```text
claude-statusline config import PATH --style-from SCOPE:ID --style-to SCOPE:ID[,SCOPE:ID...]
  --style-fields FIELD,... [--user | --profile NAME_OR_ID | --project PATH]
  [--profile-file] [--dry-run | --expected-revision TARGET_REV --source-revision SOURCE_REV]
claude-statusline config import PATH --groups SCOPE:ID[,SCOPE:ID...]
  [--references review|expand|exclude] [--explicit-layout]
  [--user | --profile NAME_OR_ID | --project PATH] [--profile-file]
  [--dry-run | --expected-revision TARGET_REV --source-revision SOURCE_REV]
```

`SCOPE` 为 `main` 或 `subagent`，样式目标须同作用域，所选分组也须同作用域。Profile 文件使用 `--profile-file`，或改用 `config profile import` 并省略该参数。复用不能与 `--select`、`--name`、`--overwrite` 混用。目标默认是用户配置，最多指定一个明确目标。

样式字段为 `foreground`、`background`、`foreground_gradient`、`background_gradient`、`label`、`icon` 及兼容的 `formatting.KEY` 覆盖；数据身份、来源绑定、内容、顺序、优先级、宽度和可见性保留。分组引用处理默认 `review`，`expand` 扩选依赖，`exclude` 排除组外对齐引用；需要由自动转显式布局时，另用 `--explicit-layout` 允许。

下例替换用户默认选择并创建新的 `source.json`；使用独立导出路径，开始时不要存在同名分组。先准备可移植来源，再审阅，并用返回的 `expected_revision`／`source_revision` 替换 `TARGET_REV`／`SOURCE_REV` 后重复同一选择。来源或目标修订变化、依赖未解决时拒绝保存。

<!-- docs-example: cli-style-reuse -->
```text
claude-statusline config set-items model current-dir
claude-statusline config item main model foreground '#123456'
claude-statusline config export source.json
claude-statusline config item main model foreground inherit
claude-statusline config import source.json --style-from main:model --style-to main:current-dir --style-fields foreground --dry-run
claude-statusline config import source.json --style-from main:model --style-to main:current-dir --style-fields foreground --expected-revision TARGET_REV --source-revision SOURCE_REV
```

目标目录实例仅取得来源模型实例导出的前景色。以下为独立的分组示例，若 `source.json` 已存在，请另选导出目标：

<!-- docs-example: cli-group-reuse -->
```text
claude-statusline config set-items model current-dir
claude-statusline config group main create context --members model,current-dir --primary model
claude-statusline config export source.json
claude-statusline config group main ungroup context
claude-statusline config import source.json --groups main:context --references expand --explicit-layout --dry-run
claude-statusline config import source.json --groups main:context --references expand --explicit-layout --expected-revision TARGET_REV --source-revision SOURCE_REV
```

分组复用追加新实例／分组身份并清除导入的本地来源绑定，不授予执行许可。审阅结果包含候选差异、引用及 ID 映射。[复用详细规则](../DRAFT_HISTORY.zh-CN.md)。

## 数据源管理

详细示例见[扩展指南](../EXTENSIONS.zh-CN.md)。

```text
claude-statusline source [--config-dir PATH] list [--json]
claude-statusline source add|edit ID --file DEFINITION.json [--json]
claude-statusline source review ID [--json]
claude-statusline source enable ID --review REVIEW_REVISION [--json]
claude-statusline source disable|remove ID [--json]
claude-statusline source auto-on ID --review REVIEW_REVISION [--interval SECONDS] [--json]
claude-statusline source auto-off ID [--json]
claude-statusline source bind ID --instance INSTANCE --scope main|subagent [--profile NAME | --project PATH] [--json]
claude-statusline source unbind ID --binding BINDING_ID [--json]
claude-statusline source refresh ID [--project PATH] [--session ID] [--agent ID] [--no-wait] [--json]
claude-statusline source status|cancel JOB_ID [--json]
claude-statusline source diagnose ID [--offset N] [--project PATH] [--session ID] [--agent ID] [--json]
```

所有数据源动作的 `--config-dir PATH` 均紧跟 `source`。绑定会保存所选用户／Profile／项目显示目标，并要求安装归属；注册及执行许可仍独立。`list`、`diagnose` 默认输出可读文本，传入 `--json` 时输出 JSON，其余动作返回结构化 JSON；`--json` 也要求已处理错误使用结构化结果。链接外观见[逐项实例选项](#逐项实例选项)。


刷新等待被中断时仅释放该 CLI 的消费者，其他消费者／适用自动租约继续执行。`--no-wait` 保留需求到完成或原 deadline；`source cancel JOB_ID` 明确取消整项任务。

创建与编辑均保存为停用状态；启用需要所审查的精确修订。刷新默认等待，失败或取消返回退出码 2。导入不能授权或自动绑定本机数据源。

### 来源绑定维护

```text
claude-statusline source bindings [--offset N] [--json]
claude-statusline source cleanup-bindings BINDING_ID --review REVISION [--json]
claude-statusline source release-draft OWNER [--json]
```

`source diagnose ID` 显示共享可读摘要；`--json` 提供高级已保存检查详情。命令自动执行单独审核，默认 300 秒，允许 60–86400 秒，与 TTL 独立。绑定清理重新检查引用和修订；仅释放明确放弃或已恢复的草稿 owner。参见[来源操作](../EXTENSIONS.zh-CN.md)及[包执行](../PACKAGE_MANAGEMENT.zh-CN.md)。

## 诊断与任务查看

### `doctor` / `diagnose`

```text
claude-statusline doctor [--config-dir PATH]
claude-statusline diagnose --input FILE|- [--scope main|subagent] [--width N]
  [--observed-at ISO_TIME] [--input-only] [--json] [--config-dir PATH]
```

`doctor` 检查安装及本地策略，输出文本诊断行，存在 ERROR 时退出 1，不修复设置。`diagnose` 必须明确提供状态栏 JSON（文件或表示 stdin 的 `-`）；作用域默认 `main`，宽度默认 120，范围 2–10000。`--observed-at` 必须是含时区的已知输入采集时间，不使用文件修改时间。输入接受 UTF-8／BOM，须为不超过 32 MiB 的单个对象，拒绝重复键及非有限常量。

诊断使用输入项目解析出的已保存显示及匹配的已有本地观测；`--input-only` 排除本地观测存储及本机主机名，仍读取配置、接入及采集器选择。不启动采集、来源执行、网络查询、修复或缓存发布。`--json` 返回结构化证据／原因码，失败时返回 `error` 对象。退出 0 表示生成了报告，证据不可用或陈旧也可能成功；输入、参数或读取错误退出 2。

将 `input.json` 替换为已捕获的输入文件：

<!-- docs-example: cli-diagnose -->
```text
claude-statusline diagnose --input input.json --input-only --json
```

[输入格式、报告解读及限制](../DIAGNOSTICS.zh-CN.md)。

### `task show`

使用实际会话 ID，省略 `--prompt-id` 时仅采用已发布的当前任务指针。读取已有有界证据，不扫描 transcript、不猜测其他会话、不采集、不初始化安装。JSON 为任务详情读取模型，缺失证据表示不可用。有效报告退出 0；无效身份／参数或已处理失败退出 2，`--json` 下提供 `error` 对象。

```text
claude-statusline task show --session-id SESSION_ID [--prompt-id PROMPT_ID] [--config-dir PATH] [--json]
```

<!-- docs-example: cli-task -->
```text
claude-statusline task show --session-id SESSION_ID --json
```

### 交互任务查看器

```sh
claude-statusline task view --session-id ID [--prompt-id ID] [--config-dir PATH]
```

要求交互终端和显式会话身份，沿用全局 `--language`。省略任务 ID 时读取已发布的当前任务指针，`--json` 仅用于 `task show`。查看器不初始化安装／配置，也不运行采集。[控件与证据](../TASK_DETAILS.zh-CN.md)。

## 外观与显示选项

### 显示与宿主选项

使用 `config set OPTION VALUE` 修改用户默认。三个宿主选项要求安装归属，其余为显示选项；Powerline 控制用于 Powerline 渲染。语言代码及预设 ID 等是稳定参数值。

<!-- cli-set-options:start -->
| OPTION | VALUE | 默认值 | 说明 |
| --- | --- | --- | --- |
| `statusline-language` | `en`、`zh-CN`、`zh-TW`、`zh-HK`、`ja`、`ko`、`es`、`fr`、`de`、`pt-BR`、`ru`、`id` | `en` | 独立控制主栏／子代理输出语言；预览立即更新，随显示设置保存 |
| `colors` | `on`、`off` | `on` | 是否输出 ANSI 颜色控制码 |
| `palette` | `default`、`ansi` | `default` | `default` 使用项目的 24 位 RGB 色值；`ansi` 使用标准终端色 |
| `directory-style` | `full`、`home`、`project-relative`、`basename` | `full` | 工作目录的缩写方式 |
| `separator-style` | `classic`、`compact`、`powerline` | `classic` | 顶层条目的分隔方式 |
| `theme` | `classic`、`dark`、`light`、`terminal`、`ocean`、`ember`、`slate`、`blossom` | `classic` | 状态栏颜色角色；保留逐项覆盖与 Claude 宿主外观 |
| `powerline-glyph` | `ascii`、`powerline` | `ascii` | Powerline 边界使用 ASCII `>` 或可选的字体相关箭头 |
| `scope-labels` | `off`、`when-subagents`、`always` | `when-subagents` | 主栏是否前置本地化的主会话作用域标签 |
| `subagent-statusline` | `on`、`off` | `on` | 是否希望安装并渲染自定义子 Agent 行 |
| `padding` | `0`–`32` | `0` | Claude Code 在状态栏内容前增加的水平空白字符数 |
| `refresh-interval` | `event`、`1`–`3600` | `1` | 除事件刷新外，按指定秒数定时重跑 renderer；`event` 表示只按事件刷新 |
| `hide-vim-mode-indicator` | `on`、`off` | `off` | `on` 隐藏 Claude Code 内建的 Vim 模式文字 |
| `branch-diff-base` | `auto` 或安全的本地 Git ref | `auto` | 已提交分支比较基准，不 fetch |
| `model-name` | `original`、`short` | `original` | 原模型名或简称 |
| `number-format` | `legacy`、`compact`、`full`、`grouped` | `legacy` | 沿用字段默认、紧凑后缀、完整整数或分组数字 |
| `labels` | `legacy`、`short`、`off` | `legacy` | 语义标签样式 |
| `icons` | `legacy`、`unicode`、`ascii`、`off` | `legacy` | 内置图标，无需专用字体 |
| `allowance` | `remaining`、`used` | `remaining` | 显示剩余额度或使用比例 |
| `reset-format` | `countdown`、`time`、`datetime` | `countdown` | 额度重置时间样式 |
| `reset-timezone` | `local`、`UTC` | `local` | 重置时间显示时区 |
| `threshold-colors` | `on`、`off` | `off` | 按实际使用比例着色，包括显示剩余额度时 |
| `warning-threshold` | `0`–`100`，低于严重值 | `70` | 警告使用百分比 |
| `critical-threshold` | `0`–`100`，高于警告值 | `90` | 严重使用百分比 |
| `subagent-visibility` | `all`、`running` | `all` | 代理可见性筛选 |
| `subagent-hide-completed` | `on`、`off` | `off` | 隐藏 completed，失败行仍受其他筛选控制 |
| `subagent-row-limit` | `none`、`0`–`10000` | `none` | 最大可见行数，零隐藏所有自定义行 |
| `subagent-task-max-width` | `none`、`2`–`10000` | `none` | 任务文字最大终端列数 |
| `powerline-padding` | `none`, `left`, `right`, `both` | `both` | 色块内边距，与宿主 padding 独立 |
| `powerline-separator` | `arrow`, `slash`, `bar`, `none` | `arrow` | Powerline 边界形状 |
| `powerline-start-cap` | `on`, `off` | `off` | Powerline 行首端帽 |
| `powerline-end-cap` | `on`, `off` | `on` | Powerline 行尾端帽 |
| `powerline-color-mode` | `semantic`, `continuous`, `restart` | `semantic` | 语义角色、连续序列或逐行重启 |
| `powerline-row-background-gradient` | `off`、PRESET 或 2–5 个逗号分隔的 `#RRGGBB` 颜色 | `off` | 连续 Powerline 行背景，与实例使用相同渐变预设 |
<!-- cli-set-options:end -->

#### 颜色

- `colors off` 会完全禁用本工具输出的 ANSI 颜色码。
- `palette` 在颜色关闭时仍会被保存，但暂时不影响输出；以后重新打开颜色会继续使用该 palette。
- `default` 需要终端支持 24 位颜色；兼容性优先时可使用 `ansi`。

#### 目录格式

假设用户 home 是 `/home/user`，项目根目录是 `/home/user/code/repo`，当前目录是 `/home/user/code/repo/src/api`：

| 样式 | 示例输出 |
| --- | --- |
| `full` | `/home/user/code/repo/src/api` |
| `home` | `~/code/repo/src/api` |
| `project-relative` | `src/api`；位于项目根时显示 `.` |
| `basename` | `api` |

`home` 只缩写真实位于当前用户 home 下的路径。`project-relative` 在当前目录不属于 Claude Code 提供的项目根目录时退回完整路径。

Windows drive path、含空格或中文的路径、UNC path 与大小写归一都使用原生 Windows 路径语义。`full` 始终保留 payload 原始的 `/` 或 `\`；`home` 与 `project-relative` 为紧凑显示统一输出 `/`。

#### 分隔符和语义分组

`classic` 使用 ` | ` 分隔顶层条目；`compact` 对所有顶层条目使用 ` · `。`powerline` 将每个可见项目作为独立色块，内边距和边界计入宽度；详见[基础 Powerline](../APPEARANCE.zh-CN.md#基础-powerline)。普通分隔符继续遵循下面的语义分组。

以下条目在相邻时属于同一语义组，并用 ` · ` 连接；下列颜色描述默认 classic 主题，主题和逐项覆盖可改变颜色：

- `model-with-effort`、`fast-mode` 与 `thinking`（模型组，象牙白）
- `current-dir`、`project-name` 与 `hostname`（位置组，绿色）
- `git`、`pr` 与 `repo`（仓库组，紫）
- `tokens` 与 `prompt-cache`（用量组，粉）
- `context-remaining`、`context-used` 与 `context-window-size`
- `five-hour-limit`、`weekly-limit` 与 `spend-limit`

`version`、`session`、`cost`、`agent`、`vim-mode`、`worktree` 各自独立，不与相邻条目合并。条目目录按组排列（模型组 → 位置组 → 仓库组 → 上下文 → 限额 → 用量组 → 计时 → 独立项），但 `enable` 只按参数顺序把新条目追加到当前列表末尾。需要把同组条目放在一起时，使用 `order`、`set-items` 或 TUI 调整顺序。如果通过排序把同组条目分开，它们会恢复为独立顶层条目。`tokens` 内部的 `hit`、`miss`、`out`，`cost` 内部的金额、时长、增删行，以及 `prompt-cache` 内部的命中率、写入 token 始终使用 ` · `。

#### 刷新间隔

Claude Code 会在相关 UI 或会话事件发生时重跑 statusline。`refresh-interval N` 会在此基础上每 N 秒额外刷新，适合持续更新 `task-timer`，或在主会话空闲时观察后台产生的变化。

```bash
# 默认：每秒刷新
claude-statusline config set refresh-interval 1

# 降低刷新频率
claude-statusline config set refresh-interval 5

# 只在 Claude Code 事件发生时刷新
claude-statusline config set refresh-interval event
```

使用 `event` 时，运行中的 `task-timer` 不会按秒连续变化，只会在下一个状态事件触发后更新。

### 条件显示与外观

使用 `config set theme classic|dark|light|terminal|ocean|ember|slate|blossom`、`config set separator-style classic|compact|powerline` 和 `config set powerline-glyph ascii|powerline`。作用域 `config item` 新增 `foreground`、`background`、`visibility`、`visibility-threshold`。详见[语法、适用项目及恢复](../APPEARANCE.zh-CN.md)。

`config set powerline-padding none|left|right|both`、`powerline-separator arrow|slash|bar|none`、`powerline-start-cap on|off`、`powerline-end-cap on|off`、`powerline-color-mode semantic|continuous|restart` 共用校验规则，控制 Powerline 色块，与宿主 padding 独立。[外观控制](../APPEARANCE.zh-CN.md)。

### 图形指标

对支持的实例使用 `config instance main|subagent set ID presentation numeric|bar|adaptive`、`bar-width 4..20`、`bar-style auto|unicode|ascii`。[指南](../APPEARANCE.zh-CN.md#图形指标)。

### 渐变

`config instance main|subagent set ID foreground-gradient|background-gradient VALUE` 接受 `off`、十一种预设（`ocean`、`sunset`、`aurora`、`glacier`、`lagoon`、`flame`、`copper`、`steel`、`sage`、`petal`、`twilight`），或 2–5 个逗号分隔的 `#RRGGBB` 颜色。预设在保存前展开为颜色。[静态渐变](../APPEARANCE.zh-CN.md#静态组件渐变)。

### 自适应指标与连续背景

```text
claude-statusline config instance main set context-remaining presentation adaptive
claude-statusline config set powerline-row-background-gradient lagoon
claude-statusline config set powerline-row-background-gradient off
```

渲染规则与兼容方案参见[布局指南](../COMPOSITION.zh-CN.md#自适应指标与连续背景)。

### 会话费用速率

可选 `session-cost-rate` 组件支持 `config instance main set INSTANCE cost-rate-basis session|api`。省略使用会话时长，两种分母均至少要求一分钟。详见[费用速率定义](../DISPLAY_ITEMS.zh-CN.md#会话费用速率)。

### 逐项实例选项

已有实例使用 `config instance main|subagent set INSTANCE OPTION VALUE`。旧 `config item main|subagent TYPE OPTION VALUE` 解析唯一类型，也可配置禁用／尚未放置的指标；重复类型须用实例形式。`text`、`spacer` 仅用于实例，留白不提供逐项外观字段。不支持的组合会拒绝且不保存。

| OPTION | 取值／默认值 | 适用范围 |
| --- | --- | --- |
| `label / icon` | `inherit`、空文本或不含控制字符的最多 256 码点文本；默认继承 | 指标及文本 |
| `foreground / background` | `inherit`、`default`、`ansi:0`–`ansi:255`、加引号的 `#RRGGBB`；默认继承 | 指标及文本 |
| `foreground-gradient / background-gradient` | `off`、十一种预设或 2–5 个颜色；默认关闭 | 指标及文本 |
| `priority / max-width` | 0–100（50）／2–10000 或 `none`（`none`） | 指标及文本；宽度为终端列 |
| `model-name` | `original`、`short`、`inherit`；默认继承 | 模型相关指标 |
| `number-format` | `legacy`、`compact`、`full`、`grouped`、`inherit`；默认继承 | 兼容的数值指标，不适用于 `current-dir` |
| `labels / icons` | 全局取值或 `inherit`；默认继承 | 兼容指标 |
| `allowance` | `remaining`、`used`、`inherit`；默认继承 | 主栏额度限制指标 |
| `reset-format / reset-timezone` | 全局取值或 `inherit`；默认继承 | 主栏重置时间指标 |
| `visibility / visibility-threshold` | `always` 或支持的规则／0–100（70） | 规则依作用域／类型，阈值仅用于用量规则 |
| `presentation / bar-width / bar-style` | 默认 `numeric`／4–20（8）／`auto`；值域见图形指标 | 支持的用量／上下文指标 |
| `cost-rate-basis` | `session`、`api`；默认 `session` | 主栏 `session-cost-rate` |
| `link` | `off`、`auto`、`on`；默认 `off` | 仅支持链接的组件 |
| `text` | 最多 256 码点的字面文本；新增时默认空，除非指定 `--text` | 文本实例，仅实例形式 |

目录 JSON 提供类型的 `capabilities` 和支持的 `format_options`，脚本设置覆盖前应先查询。例如 `config item main current-dir number-format compact` 会被拒绝。[外观指南](../APPEARANCE.zh-CN.md)维护具体可见性／链接适用范围、颜色优先级及渲染规则。

## 显示项与数据作用域

### 可配置显示项

使用 `config list-items --json` 和 `config subagents list-items --json` 查询各作用域的完整 ID。用 `config enable` 启用主栏 ID，或用 `config subagents enable` 启用子 Agent ID。

```bash
claude-statusline config enable project-name hostname context-used
```

默认条目、宿主版本和缺值规则见[指标定义](../DISPLAY_ITEMS.zh-CN.md)。

### 主状态栏显示含义

#### Git 标记

参见指标定义中的 [Git 标记及采集范围](../DISPLAY_ITEMS.zh-CN.md#git-markers)。

#### Token 含义

参见指标定义中的 [Token 字段及作用域](../DISPLAY_ITEMS.zh-CN.md#token-fields)。

<a id="prompt-计时标记"></a>

#### 任务计时标记

任务总耗时、执行耗时和显示标记见[指标定义](../DISPLAY_ITEMS.zh-CN.md#timer-definitions)。启用步骤见[使用指南](../USER_GUIDE.zh-CN.md#任务总耗时与执行耗时)。

### 子 Agent 行与三种作用域

Claude Code 2.1.205+ 会把官方 `subagentStatusLine` payload 交给 `claude-statusline render-subagents`。renderer 保持 `tasks` 输入顺序、忽略重复 ID 的后续项，并为每个有效非空字符串 ID 输出一行 `{"id":"...","content":"..."}` NDJSON。普通 payload 指标不扫描 transcript 或查询网络；已完成代理计时可能读取已有本地结束证据。明确启用并绑定的外部值可以读取选定 JSON 文件、检查本地 Git 身份并发布观测缓存；命令／GitHub 值在渲染时读取已发布结果，不执行 provider。这些来源效果要求明确的本机启用／绑定，与纯行格式化器分离。

宽度直接使用 payload 中的正整数 `columns`，无效时回退 80 列。每行使用完整宽度预算，输入文本中的换行、制表符和控制字符会被清理。

普通行拟合先截短任务文本，再按 `current-dir → tokens → context-window-size → context-tokens → context-used → context-remaining → model-with-effort → effort → model → task` 的顺序省略可选字段。启用的状态字段优先保留，极窄时 `status-elapsed` 可能只显示图标。使用组、自适应指标、Powerline 或自定义优先级时，拟合由对应的布局和优先级规则决定。各路径均按可见终端单元格限制单行宽度。

字段含义、默认选择与数据作用域见[指标定义](../DISPLAY_ITEMS.zh-CN.md#display-scopes)。

## 配置文件

下列文件均位于选定的 Claude 配置目录。JSON 格式彼此独立，可移植导出不等于复制整个目录。

| 文件 | 职责及修改入口 |
| --- | --- |
| `claude-statusline.json` | 当前显示 schema 的用户默认显示；普通显示命令 |
| `claude-statusline-profiles.json` | 当前格式的 Profile 库及项目绑定；`config profile/project` |
| `claude-statusline-sources.json` | 当前格式的本机来源定义、许可及绑定；`source` |
| `statusline-ui.json` | 当前偏好 schema 的界面语言；`config language` |
| `claude-statusline-features.json / claude-statusline-native.json` | 当前偏好 schema 的编辑器偏好；显式安装参数 |
| `claude-statusline-runtime.json` | 当前偏好 schema 的采集偏好；显式安装参数 |
| `settings.json` | Claude 设置及合并的接入／宿主选项；安装、卸载及有归属的宿主写入 |

当前版本数字与包读取范围见[协议与 schema 版本](#协议与-schema-版本)。

Profile 存储限制及恢复见[方案指南](../PROFILES.zh-CN.md#文件冲突与恢复)，本机来源记录及观测缓存见[扩展指南](../EXTENSIONS.zh-CN.md)。普通重置／卸载保留 Profile 库及来源注册。

### 显示配置

显示项与样式保存在：

```text
<CLAUDE_CONFIG_DIR>/claude-statusline.json
```

以下为使用当前显示 schema、只保留一个主栏模型实例和一个子代理名称实例的完整示例。使用 `config export PATH` 获取自己的完整配置；默认仍启用十个主栏指标和五个子代理指标。

<!-- docs-example: display-config -->
```json
{
  "schema_version": 17,
  "groups": [],
  "use_colors": true,
  "palette": "default",
  "directory_style": "full",
  "separator_style": "classic",
  "scope_labels": "when-subagents",
  "statusline_language": "en",
  "theme": "classic",
  "powerline_glyph": "ascii",
  "powerline": {
    "padding": "both",
    "separator": "arrow",
    "start_cap": false,
    "end_cap": true,
    "color_mode": "semantic"
  },
  "subagents": {
    "enabled": true,
    "visibility": "all",
    "hide_completed": false,
    "row_limit": null,
    "task_max_width": null,
    "instances": [
      {
        "id": "name",
        "type_id": "name",
        "enabled": true,
        "options": {
          "label": null,
          "icon": null,
          "priority": 50,
          "max_width": null,
          "formatting": {},
          "foreground": null,
          "background": null,
          "visibility": "always",
          "visibility_threshold": 70
        },
        "text": null
      }
    ],
    "groups": []
  },
  "formatting": {
    "model_name": "original",
    "number_format": "legacy",
    "labels": "legacy",
    "icons": "legacy",
    "allowance": "remaining",
    "reset_format": "countdown",
    "reset_timezone": "local",
    "thresholds": {
      "enabled": false,
      "warning": 70,
      "critical": 90
    }
  },
  "layout": {
    "mode": "auto",
    "rows": []
  },
  "metrics": {
    "branch_diff_base_ref": null
  },
  "instances": [
    {
      "id": "model-with-effort",
      "type_id": "model-with-effort",
      "enabled": true,
      "options": {
        "label": null,
        "icon": null,
        "priority": 50,
        "max_width": null,
        "formatting": {},
        "foreground": null,
        "background": null,
        "visibility": "always",
        "visibility_threshold": 70
      },
      "text": null
    }
  ]
}
```

这是严格 JSON：不接受注释、尾随逗号、未知字段、缺失字段、未知条目或重复条目。建议使用配置命令修改，而不是手工编辑。

目录提供类型定义；`instances` 保存已配置位置。禁用实例及其选项继续保留，直到明确移除。两个作用域分别管理实例身份。

配置更新会备份修改前的内容，并通过原子替换与文件锁保护写入；详见[备份与回滚](../USER_GUIDE.zh-CN.md#备份与回滚)及[当前架构](../development/architecture.zh-CN.md#当前-typescript-workspace)。

当前与历史显示 schema 及读取范围见[协议与 schema 版本](#协议与-schema-版本)。历史文件可读取，首次实际配置保存时备份并写为当前 schema。版本转换与降级恢复见[版本兼容](../USER_GUIDE.zh-CN.md#版本兼容)。

如果显示配置损坏：

- 用户默认文件无效时，两个 renderer 静默使用内建用户默认设置；之后仍可选择有效的项目 Profile。
- `config show`、普通配置写命令和 `doctor` 会明确报告错误。
- `config reset` 可以删除损坏配置并恢复默认值。

`instances: []` 是合法配置，表示主栏不输出内容；即使范围标签为 `always`，也不会单独制造空主栏。`subagents.instances: []` 同样合法，表示每个有效子任务返回空 content。

<a id="实验功能偏好"></a>

### 共享界面偏好

`<CLAUDE_CONFIG_DIR>/statusline-ui.json` 使用独立 schema，示例如下：

```json
{"schema_version": 1, "ui_language": "zh-CN"}
```

接受 `en`、`zh-CN`、`zh-TW`、`zh-HK`、`ja`、`ko`、`es`、`fr`、`de`、`pt-BR`、`ru` 和 `id`。缺失／无效读取返回英文，可能提示警告，但不修复。显式 set/reset 使用锁、备份及原子写入；未来 schema 拒绝覆盖，写入失败保留原有效选择。此文件与显示 revision、接入偏好、预设和可移植文件独立，普通卸载保留。

### 编辑器启用偏好

两个独立文件均使用相同的偏好 schema：

```text
<CLAUDE_CONFIG_DIR>/claude-statusline-features.json
<CLAUDE_CONFIG_DIR>/claude-statusline-native.json
```

```json
{"schema_version": 1, "experimental_slash_tui": false}
```

```json
{"schema_version": 1, "native_editor": false}
```

布尔值分别控制外部入口和会话内 Client，当前包缺失文件时默认启用。显式启用或关闭保存 true/false，不兼容宿主只暂挂而不改写偏好。重装及卸载保留偏好；关闭外部入口保存 false，不删除文件。

严格校验字段、类型、重复项及 schema；错误由 install／doctor 报告，不自行猜测。显式参数可备份并修复对应偏好。Linux/macOS 文件权限为 0600；Windows 使用继承 ACL。

### 实时采集偏好

`<CLAUDE_CONFIG_DIR>/claude-statusline-runtime.json` 使用独立 schema，示例如下：

```json
{"schema_version": 2, "native_timing": false, "live_metrics": false}
```

文件缺失时原生计时和高级实时指标均默认关闭。`install --native-timing`／`--no-native-timing` 独立控制计时；`install --live-metrics` 开启完整采集，`--no-live-metrics` 保留旧全部关闭语义，明确的计时选项可覆盖计时部分；重装保留偏好，不兼容宿主保留偏好但暂挂采集。详见[启用采集与显示](../USER_GUIDE.zh-CN.md#可选实时状态)。

### Claude Code 宿主配置

以下设置保存在用户级 `settings.json` 的 `statusLine` 对象中，而不是 `claude-statusline.json`：

- `command`
- `padding`
- `refreshInterval`
- `hideVimModeIndicator`

其中 `command` 由安装器管理；后三项可以使用 `config set` 或向导修改。设置为默认行为时，某些字段会从 JSON 中省略，例如 `padding 0`、`refresh-interval event` 和 `hide-vim-mode-indicator off`。

兼容版本还会在 `settings.json` 写入独立的 `subagentStatusLine`，严格只含 `type: "command"` 和指向 `render-subagents` 的 `command`；Claude 的该 schema 不接受 `refreshInterval`，本工具不会写入。`subagents.enabled=false` 时重跑 `install` 只移除本工具拥有的这一设置，第三方设置不受影响；两个子 Agent 生命周期 hooks 仍保留用于端到端计时。

## 协议与 schema 版本

本章是接口与存储格式当前版本的唯一来源；根目录功能指南链接到本章，不再重复当前数字；开发文档保留行为细节，并通过本章查询版本。历史引入版本保留在[协议与格式演进索引](../development/contracts.zh-CN.md#协议与格式演进索引)。软件包版本、tag 和发布产物与这些接口版本相互独立。

### 当前接口版本

| 接口或格式 | 当前版本 | 读取与保存兼容性 | 规范 |
| --- | --- | --- | --- |
| 编辑器 UI 协议 | `编辑器协议 31` | 前后端资源必须来自同一软件包；不匹配时拒绝。 | [共享契约](../development/contracts.zh-CN.md#传输与操作)；`packages/core/src/contracts/ui.ts` |
| 显示配置 | `显示 schema 17` | 读取 1–16 时在内存中迁移，不改写文件；显式保存先备份旧字节，再写当前 schema。 | `packages/core/src/config/display.ts`；[显示配置](#显示配置) |
| 运行时观测协议 | 3 | 保留 v1/v2 `observe`/`read`；`source_lifecycle` 要求版本 3。 | [实时采集](../development/live.zh-CN.md)；`packages/core/src/contracts/runtime.ts` |
| 任务生命周期 | 4 | 保留 schema-1 兼容镜像。 | `packages/core/src/runtime/tasks/model.ts`；[计时契约](../development/timer.zh-CN.md) |
| 任务详情读取模型 | 1 | `task_details` 响应；缺失证据表示为不可用，不推测。 | [共享契约](../development/contracts.zh-CN.md#操作清单) |
| 可移植配置外层 | 1 | 导入也接受当前显示读取范围内的仅显示文件。 | `packages/core/src/config/transfer.ts`；[导入、导出与复用](#导入导出与复用) |
| Profile 集合与单方案导出 | 各 1 | 集合与导出独立演进。 | `packages/core/src/config/profiles.ts`；[方案与项目](../PROFILES.zh-CN.md#文件冲突与恢复) |
| UI 偏好 | 1 | 未来 schema 拒绝覆盖。 | [共享界面偏好](#共享界面偏好) |
| 原生与外部编辑器偏好 | 各 1 | 独立文件；不支持的宿主暂停但不改写。 | [编辑器启用偏好](#编辑器启用偏好) |
| 运行时偏好 | 2 | 文件缺失时原生计时和实时指标均关闭。 | [实时采集偏好](#实时采集偏好) |
| 数据源注册表 | 2；存在命令源自动策略时为 3 | 读取 1–3；旧注册表只读，不授予新权限。 | `packages/core/src/extensions/model.ts`；[数据源管理](#数据源管理) |
| 数据源任务 | 4 | 读取 1–3；缺失执行诊断视为未知。 | [数据源管理](#数据源管理) |
| 数据源观测 | 1 | 可选 checks 与 execution 字段。 | [扩展指南](../EXTENSIONS.zh-CN.md#新鲜度分享与链接) |
| 命令源输出协议 | 1 | JSON 对象，状态为 `valid`、`missing`、`partial`、`error` 或 `unsupported`。 | [命令数据源](../EXTENSIONS.zh-CN.md#命令数据源) |
| 包审核任务 | 1 | 资源匹配；取消绑定 owner。 | [版本管理](../PACKAGE_MANAGEMENT.zh-CN.md) |
| 包执行记录 | 1 | 与显示、UI 和运行时 wire schema 独立。 | [版本管理](../PACKAGE_MANAGEMENT.zh-CN.md) |
| 包兼容记录 | 1 | 声明读取范围及要求的编辑器／运行时协议。 | `packages/core/src/management/compatibility.ts`；[包操作诊断](../PACKAGE_MANAGEMENT.zh-CN.md#包操作诊断) |

### 读取范围与包兼容记录

`statuslineCompatibility` 记录 schema 1 声明以下配置读取范围：

| 配置格式 | `read` 范围 |
| --- | --- |
| 显示配置（`display`） | `[1, 17]` |
| Profile 集合（`profiles`） | `[1, 1]` |
| 数据源注册表（`sources`） | `[1, 3]` |
| 运行时偏好（`runtime_preferences`） | `[1, 2]` |
| 原生偏好（`native_preferences`） | `[1, 1]` |
| 外部偏好（`external_preferences`） | `[1, 1]` |
| UI 偏好（`ui_preferences`） | `[1, 1]` |

该记录还声明 `editor_protocol` 31、`runtime_protocol` 3、`minimum_host` 2.1.205、支持的 Node 主版本及目标。协议值必须与上表当前版本一致。权威声明位于 `packages/core/src/management/compatibility.ts`；包审核与恢复行为见[包操作诊断](../PACKAGE_MANAGEMENT.zh-CN.md#包操作诊断)。

### 未版本化与宿主所有的接口

| 接口 | 归属与契约 |
| --- | --- |
| 状态栏输入 payload（`statusLine`） | schema 由 Claude Code 拥有；本包读取提供的字段，不为 payload 定义版本。 |
| 子代理状态栏输入与 NDJSON 输出 | 输入由 Claude Code 拥有；本包为每个有效非空 ID 输出一行 `{"id","content"}`，不定义 NDJSON 版本。 |
| Hook payload | 由 Claude Code 拥有；hook 处理器防御性读取已观测字段，不写入版本化 hook 契约。 |
| `settings.json` 宿主配置 | Claude 拥有的 schema；本包只编辑自有字段并合并无关设置。 |
| CLI 人类可读输出与退出码 | 软件包行为，不是版本化 wire 协议；各命令的 JSON 结构随命令文档记录。 |
| 私有运行时缓存（usage、Git） | 实现细节；不是兼容契约，可在不迁移的情况下变化。 |

### 规范来源

权威类型与校验位于上表链接的源文件。封装、操作、事务与错误行为见[共享契约](../development/contracts.zh-CN.md)；字段语义见[指标定义](../DISPLAY_ITEMS.zh-CN.md)、[组合](../COMPOSITION.zh-CN.md)和[外观](../APPEARANCE.zh-CN.md)。本章拥有版本数字；功能指南链接到本章，不再重复。

## 自定义配置目录与环境变量

工具遵循 Claude Code 的 `CLAUDE_CONFIG_DIR`：

```bash
CLAUDE_CONFIG_DIR=/path/to/claude-config claude-statusline install
CLAUDE_CONFIG_DIR=/path/to/claude-config claude-statusline configure
CLAUDE_CONFIG_DIR=/path/to/claude-config claude-statusline config show
```

Windows PowerShell：

```powershell
$env:CLAUDE_CONFIG_DIR = 'C:\Path With Spaces\Claude 配置'
claude-statusline.cmd install
claude-statusline.cmd configure
claude-statusline.cmd config show
```

管理命令也支持显式 `--config-dir PATH`。显式参数优先于环境变量。

还支持以下运行状态位置覆盖：

- `CLAUDE_STATUSLINE_RUNTIME_DIR`：覆盖 token、Git 缓存和逐轮状态使用的运行目录。
- `CLAUDE_STATUSLINE_SESSIONS_DIR`：覆盖 Claude Code 会话注册信息目录。

通常不需要设置后两个变量。修改它们可能让已有会话状态暂时不可见，但不会改变显示配置本身。

## 退出码

管理命令遵循以下约定：

- `0`：命令成功；`doctor` 没有 ERROR。
- `1`：`doctor` 至少发现一个 ERROR，或设置预检阻止了所请求的接入。
- `2`：参数解析失败，或已捕获的配置、所有权、安装操作校验失败。
- `130`：交互式 TUI 收到 Ctrl+C/SIGINT，终端已恢复且配置未保存。
- `128 + signal`：交互式 TUI 收到当前平台实际提供的终止信号，终端已恢复且配置未保存。

高频内部命令 `render`、`render-subagents`、`hook` 和 `slash-hook` 对损坏或无关输入采用静默容错，避免自身错误阻塞 Claude Code。
