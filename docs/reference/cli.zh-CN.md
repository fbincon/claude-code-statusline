# CLI 参考

[English](cli.md) | **简体中文**

本页提供完整命令语法、选项、显示字段和配置文件参考。安装步骤与日常操作见[使用指南](../USER_GUIDE.zh-CN.md)。以下值域与示例按当前软件包整理，不作为历史版本说明。

## 文档导航

- [CLI 总览](#cli-总览)
- [安装与诊断](#安装与诊断)
- [slash 命令支持范围](#slash-命令支持范围)
- [配置命令详解](#配置命令详解)
- [可配置显示项](#可配置显示项)
- [主状态栏显示含义](#主状态栏显示含义)
- [子 Agent 行与三种作用域](#子-agent-行与三种作用域)
- [显示与宿主选项](#显示与宿主选项)
- [配置文件](#配置文件)
- [自定义配置目录与环境变量](#自定义配置目录与环境变量)
- [退出码](#退出码)

## CLI 总览

```text
claude-statusline [--language en|zh-CN] COMMAND ...
claude-statusline configure [--config-dir PATH]
claude-statusline config [--config-dir PATH] show [--json]
claude-statusline config [--config-dir PATH] list-items [--json]
claude-statusline config [--config-dir PATH] set-items [ITEM...]
claude-statusline config [--config-dir PATH] enable ITEM...
claude-statusline config [--config-dir PATH] disable ITEM...
claude-statusline config [--config-dir PATH] order [ITEM...]
claude-statusline config [--config-dir PATH] subagents list-items [--json]
claude-statusline config [--config-dir PATH] subagents set-items [ITEM...]
claude-statusline config [--config-dir PATH] subagents enable ITEM...
claude-statusline config [--config-dir PATH] subagents disable ITEM...
claude-statusline config [--config-dir PATH] subagents order [ITEM...]
claude-statusline config [--config-dir PATH] set OPTION VALUE
claude-statusline config [--config-dir PATH] apply ...
claude-statusline config [--config-dir PATH] preset NAME [--dry-run]
claude-statusline config [--config-dir PATH] import PATH [--dry-run]
claude-statusline config [--config-dir PATH] export PATH [--overwrite]
claude-statusline config [--config-dir PATH] item main|subagent ID OPTION VALUE
claude-statusline config [--config-dir PATH] layout auto|explicit [ROW...]
claude-statusline config [--config-dir PATH] language show [--json]
claude-statusline config [--config-dir PATH] language set en|zh-CN
claude-statusline config [--config-dir PATH] language reset
claude-statusline config [--config-dir PATH] reset
claude-statusline install [--dry-run] [--force]
  [--experimental-slash-tui | --no-experimental-slash-tui]
  [--native-editor | --no-native-editor]
  [--live-metrics | --no-live-metrics]
  [--config-dir PATH]
claude-statusline uninstall [--dry-run] [--config-dir PATH]
claude-statusline doctor [--config-dir PATH]
claude-statusline --version
```

Windows PowerShell 中把命令名替换为 `claude-statusline.exe`；参数和输出格式相同。上面的方括号和省略号是语法记号，不是要原样输入的参数。供 Claude Code 调用的命令见[内部命令附录](../development/README.zh-CN.md#附录内部命令)。

查看任意层级的内建帮助：

```bash
claude-statusline --help
claude-statusline config --help
claude-statusline config set --help
claude-statusline config apply --help
```

注意 `config` 的 `--config-dir` 位于具体动作之前：

```bash
claude-statusline config --config-dir /path/to/claude-config show
```

而 `configure`、`install`、`uninstall` 和 `doctor` 的参数直接跟在命令之后：

```bash
claude-statusline configure --config-dir /path/to/claude-config
claude-statusline doctor --config-dir /path/to/claude-config
```

## 界面语言

`config language show [--json]` 读取共享偏好；JSON 为 `{"schema_version":1,"ui_language":"en"}` 或 `"zh-CN"`。`set en|zh-CN` 和 `reset` 显式保存，reset 选择英文。根选项 `--language en|zh-CN` 放在子命令前，优先用于本次调用，不修改文件；用于 `configure` 时控制初始界面语言。

帮助正文／分组、argparse 参数错误和管理输出使用所选语言。命令名称、参数值、退出码、目录 JSON 保持稳定；实际状态栏采用独立显示语言。支持的宿主上 `/statusline-config language show|set|reset` 也可本地执行。详见[语言行为与恢复](../USER_GUIDE.zh-CN.md#界面语言)。

## 状态栏语言

`config set statusline-language en|zh-CN` 保存显示语言。`config apply --statusline-language en|zh-CN` 与其他答案一起原子保存，省略时保留当前值。两个编辑器立即预览草稿语言，保存／取消控制实际输出。`config language` 及根参数 `--language` 仅控制界面。

显示 schema v6 必须包含 `statusline_language`。读取／导入历史 v1–v5 补为英文，预设保留它，导出包含它，reset 恢复英文。旧版向导读取界面偏好，将翻译答案映射到稳定代码后一次 apply。见[用法与降级恢复](../USER_GUIDE.zh-CN.md#状态栏语言)。

## 安装与诊断

| 命令 | 行为 |
| --- | --- |
| `install` | 合并归属本工具的 Claude 接入，实际修改前备份 |
| `install --dry-run` | 预览修改，不安装资源、不写入文件 |
| `install --force` | 允许替换冲突的主栏、子 Agent 设置或同名 skill；原生插件身份冲突仍需解决归属 |
| `uninstall [--dry-run]` | 移除或预览移除本工具接入，保留显示文件、偏好、状态和备份 |
| `doctor` | 诊断安装，不重写配置、不打开编辑器 |
| `configure` | 在当前终端打开 curses，要求配置有效、接入归属正确、输入输出为 TTY、尺寸至少 64×18 |

各命令均可在命令名后使用 `--config-dir PATH`。`install` 的四组独立偏好参数为：

- `--native-editor` / `--no-native-editor`：会话内 Client，需 Claude Code 2.1.287+。
- `--experimental-slash-tui` / `--no-experimental-slash-tui`：外部入口，需 2.1.258+。
- `--native-timing` / `--no-native-timing`：原生计时元数据，需 2.1.289+。
- `--live-metrics` / `--no-live-metrics`：高级实时采集，需 2.1.289+。

每组参数互斥。显式参数优先于已保存值，已保存值优先于默认值；编辑器和原生计时默认启用，高级实时指标默认关闭。`--no-live-metrics` 保留同时关闭计时和高级采集的旧语义，同一命令中的显式计时参数可单独决定计时部分。不兼容或未知宿主暂挂请求的接入并保留偏好，宿主中主动禁用的插件保持禁用。接入变化后重启 Claude Code。详见[安装](../USER_GUIDE.zh-CN.md#安装与接入)、[备份](../USER_GUIDE.zh-CN.md#备份与回滚)和[卸载](../USER_GUIDE.zh-CN.md#卸载)。

## slash 命令支持范围

`/statusline-config` 参数解析器支持 `show`、`list-items`、`set-items`、`enable`、`disable`、`order`、`subagents`、`set`、`apply`、`language`、`reset`，其中子 Agent 操作为 `list-items`、`set-items`、`enable`、`disable`、`order`。Claude Code 2.1.258+ 且 hooks 启用时本地执行，旧版或未知版本使用模型回合；无参数问答向导始终使用模型回合。

`preset`、`import`、`export`、`item`、`layout` 使用终端 CLI 或编辑器，本地 slash 解析器拒绝这些操作。`/statusline-configure` 不接受配置参数，详见[入口选择](../USER_GUIDE.zh-CN.md#选择配置入口)。

## 配置命令详解

[slash 命令支持范围](#slash-命令支持范围)列出的基础操作可在 Claude Code 中使用 `/statusline-config`，高级操作使用终端 CLI 或编辑器。例如：

```bash
claude-statusline config set colors off
```

等价于：

```text
/statusline-config set colors off
```

### `config show`

显示当前**有效配置**，包括显示配置、Claude Code 宿主配置、配置文件路径、当前 `statusLine.command` 是否属于这个可执行文件，以及子 Agent 行的 期望启用状态（enabled）、installed 和所有权状态。

```bash
claude-statusline config show
```

示例输出：

```text
Scope: user
Config: /home/user/.claude/claude-statusline.json
Installed: yes
Items: model-with-effort, current-dir, git, context-remaining, task-timer
Colors: on
Palette: default
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

JSON 顶层的 `installed` 仍只说明当前 `settings.json/statusLine.command` 是否精确指向当前 PATH 中的 `claude-statusline render`，不表示 Python 包是否存在。`subagent_statusline` 另含 `enabled`、`installed` 和 `state`；`state` 只会是 `owned`、`absent`、`foreign`、`unsupported`。

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
- `default_enabled`：主栏十个默认项为 `true`，其余 49 项为 `false`，需主动选择。
- `enabled`：当前是否启用。
- `position`：当前从 0 开始的顺序；禁用时为 `null`。

共享目录还返回 `scope`、`label`、`group`、`sources`、`examples`、`default_position`、`minimum_version`、`minimum_version_status`、`format_options`、`excludes`、`unavailable_reasons`。版本元数据表示能力门槛，不代表数据已到达。子 Agent 目录共 14 项，默认启用 5 项。

### `config set-items [ITEM...]`

一次性替换整个启用集合，同时把参数顺序保存为显示顺序：

```bash
claude-statusline config set-items model-with-effort current-dir git task-timer
```

执行后，未列出的所有条目都会被禁用。它适合从头定义一条精简状态栏。

不传任何条目是合法操作，会关闭全部渲染内容：

```bash
claude-statusline config set-items
```

此时工具仍然安装，hooks 和配置仍然存在，只是 renderer 不输出任何状态栏文本。可通过 `enable`、新的 `set-items` 或 `reset` 恢复显示。

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

```bash
claude-statusline config order git current-dir model-with-effort task-timer
```

参数必须恰好包含当前已启用的每一个条目，并且每个条目只出现一次。少一个、多一个、加入尚未启用的条目或重复条目都会失败。

推荐先查看当前集合，再排序：

```bash
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

`subagents.items=[]` 时，`render-subagents` 仍为每个有效 task ID 输出合法 NDJSON，但 `content` 为空，Claude Code 因而隐藏相应自定义行。

`status-elapsed` 与 `status`、`elapsed` 互斥：`set-items`/`enable`/`apply` 组合非法时直接报错（例如已启用 `status` 的旧配置执行 `enable status-elapsed` 会失败，需先 `disable status elapsed`）；交互向导勾选其一时自动取消冲突项。

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

`subagent-statusline` 保存期望的启用状态。已有 owned renderer 时关闭会立即返回空 content；重跑 `install` 会进一步移除 owned `subagentStatusLine`，打开则在兼容版本上恢复它。这个分离使 `config set subagent-statusline off` 可以在不触碰第三方设置的前提下解除安装冲突。

所有 `set` 的合法值见[显示与宿主选项](#显示与宿主选项)。

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
claude-statusline.exe config apply `
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

### `config layout auto|explicit [ROW...]`

自动模式沿用折行。显式模式使用逗号分隔行，按顺序展平后必须恰好等于已启用的主栏项；省略行参数时将全部启用项放入同一显式行。

```text
claude-statusline config set-items model current-dir context-used
claude-statusline config layout explicit model,current-dir context-used
claude-statusline config layout auto
```

显式布局先按最大宽度截短，再隐藏低优先级项，同级先隐藏右侧项，不增加续行。调整项目顺序会维护分行结构。

### `config item main|subagent ID OPTION VALUE`

修改已知作用域内的条目，包括当前未启用的条目：

```text
claude-statusline config item main model label Model
claude-statusline config item main model priority 100
claude-statusline config item main current-dir max-width 32
claude-statusline config item subagent task max-width none
```

`label`、`icon` 接受不含控制字符的最多 256 码点文本，`inherit` 清除覆盖，空字符串隐藏标签或图标。`priority` 为 0–100，默认 50；`max-width` 为 2–10000 或 `none`。[显示选项](#显示与宿主选项)中的七种格式选项可设值，或用 `inherit` 清除逐项覆盖。宽度按终端列计算，包括 CJK 与组合字符。

### `config preset NAME [--dry-run]`

预设名为 `minimal`、`developer`、`monitoring`、`multi-agent`。预设替换显示选择、布局、子 Agent 默认条目和逐项覆盖，使用模型简称、紧凑数字及递减的逐项优先级；保留颜色、调色板、目录及分隔符、作用域标签、刷新与宿主设置，以及当前子 Agent 启用状态。Multi-agent 另隐藏 completed，限制六行，任务宽度 48。

```text
claude-statusline config preset developer --dry-run
claude-statusline config preset developer
```

`--dry-run` 校验并输出草稿，不保存。实际应用包含宿主设置，需要当前 CLI 拥有安装接入。

<a id="portable-import-export"></a>

### `config import PATH [--dry-run]` / `config export PATH [--overwrite]`

```text
claude-statusline config export ./statusline.json
claude-statusline config import ./statusline.json --dry-run
claude-statusline config import ./statusline.json
```

可移植格式 v1 恰好包含 `format: "claude-code-statusline"`、`version: 1` 和含 `display`、`host` 的 `draft`，不含安装、路径、revision、运行状态、编辑器及实时偏好、Claude 外观及行为偏好。导入也接受兼容的仅显示 schema v1–v5 文件，此时保留现有宿主设置。实际导入要求安装归属，并原子保存已验证草稿。

文件采用 UTF-8，导入接受 BOM，上限 1 MiB；重复字段、非有限数字、错误字段及类型、不支持版本均拒绝。相对路径以当前工作目录为基准，`~` 展开。导出校验并写文件，不修改配置；目标已存在时拒绝，除非明确传入 `--overwrite`，该参数仍不能覆盖实时配置和归属本工具的插件或运行资源。编辑器导入只替换未保存草稿，导出包含当前未保存修改。

当前 CLI 边界：向受保护的配置路径导出会产生未捕获的校验异常，以 1 退出并输出 traceback，但保护目标不被修改。使用独立导出路径，脚本将任何非零结果作为失败处理。

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

## 可配置显示项

主栏目录共有 60 项，下表列出默认项和常用可选项。完整 ID 使用 `config list-items --json` 查询，独立指标与实时项见[指标定义](../DISPLAY_ITEMS.zh-CN.md)。

默认启用以下全部条目，表格顺序也是首次使用时的默认显示顺序：

| ID | 显示内容 | 数据不可用时的行为 |
| --- | --- | --- |
| `model-with-effort` | 当前模型 ID（缺失时使用 display name）；存在 effort 时追加 effort level | 没有模型字段时省略 |
| `current-dir` | Claude Code 当前实时工作目录 | 没有目录字段时省略 |
| `git` | `Git ` 前缀 + 分支、上游差异和工作树变更，如原生 Linux/macOS 的 `Git main ↑1● 2` 或 Windows/WSL 的 `Git main ↑1●2` | 非 Git 目录时省略；Git 查询异常时显示 `Git!` |
| `context-remaining` | `Context N% left` | Claude Code 未提供百分比时省略 |
| `context-window-size` | 总上下文窗口，例如 `1M window` | Claude Code 未提供窗口大小时省略 |
| `five-hour-limit` | 5 小时窗口的剩余百分比 | 未提供该窗口时省略 |
| `weekly-limit` | 7 天窗口的剩余百分比，显示为 `weekly` | 未提供该窗口时省略 |
| `spend-limit` | gateway spend 限额的剩余百分比 | 未提供该窗口时省略 |
| `tokens` | 当前会话累计的 `hit · miss · out` | 没有 session/transcript 信息时省略 |
| `task-timer` | 当前或最近一次真实 prompt 的耗时和结果 | 尚无可识别 prompt 时省略 |

限额百分比由 Claude Code 传入的 `used_percentage` 换算为剩余百分比。本工具不查询账号限额服务，因此实际能显示哪些窗口取决于当前 Claude Code 版本、账号和本次 statusline payload。

以下条目来自 Claude Code 2.1.258 及以上版本的公开 statusline payload，**默认不显示**，通过 `/statusline-config enable` 开启：

| ID | 显示内容 | 数据不可用时的行为 |
| --- | --- | --- |
| `version` | Claude Code 版本，例如 `v2.1.258` | 未提供版本时省略 |
| `session` | `Session ` 前缀 + 会话名称（`/rename` 设置后），否则会话 ID 前 8 位，如 `Session explain prompt-cache` | 没有会话 ID 时省略 |
| `cost` | 会话金额、会话运行时间与增删行数，例如 `Total $0.12 · 12m 30s · +156/-23`；金额恒显示（无数据时为 `Total $0.00`），时长为 0 或增删行均为 0 时省略对应部分 | 没有 cost 字段时省略 |
| `prompt-cache` | 缓存命中率与写入 token，例如 `cache 91% · 352K w` | 没有 prompt_cache 字段时省略（首次 API 响应前不存在）；命中率越界时只显示 token 部分 |
| `fast-mode` | fast mode 开启时显示 `fast` | 未开启时省略 |
| `agent` | `--agent` 会话的 agent 名称，例如 `Agent orchestrator` | 没有 agent 字段时省略 |
| `vim-mode` | vim mode 开启时的当前模式，例如 `vim NORMAL` | 没有 vim 字段时省略 |
| `thinking` | 扩展思考启用时显示 `thinking` | 未启用时省略 |
| `pr` | 当前分支的 open PR/MR，例如 `PR #1234 · approved`；GitLab 合并请求显示为 `MR !1234` | 当前分支没有 open PR/MR 时省略 |
| `worktree` | `--worktree` 会话的 worktree 名称，例如 `Worktree feat-x` | 没有 worktree 字段时省略 |
| `repo` | `Repo ` 前缀 + origin remote 的仓库，例如 `Repo acme/widget` | 没有 remote 身份时省略 |

`cost` 的金额来自 Claude Code 的 `total_cost_usd`；在第三方 API 端点（例如 DeepSeek 代理）下该值为按默认模型费率的估算，仅作参考。`prompt-cache` 与 `tokens` 的统计口径不同：前者来自 statusline payload 且不含 subagent 流量，后者从 transcript 累计并包含可发现的 subagent transcript。

以下三个可选条目提供上下文用量、项目目录名和本机名，也都**默认不显示**：

| ID | 显示内容 | 数据来源 | 数据不可用时的行为 |
| --- | --- | --- | --- |
| `context-used` | `Context N% used`，使用 `round()` 取整 | Claude 官方 statusline payload 的 `context_window.used_percentage` | 字段缺失、bool、非数字、非有限数或超出闭区间 `0–100` 时省略 |
| `project-name` | `Project NAME` | Claude 启动目录 `workspace.project_dir` 按当前平台路径语义取得的末级目录名；只处理字符串，不访问文件系统 | 字段无效、为空、清理后为空或表示根目录时省略；不回退到 `workspace.repo.name` 或 `current-dir` |
| `hostname` | `Host NAME` | 本机 Python 标准库的 `socket.gethostname()`；不是 Claude Code 2.1.258+ payload 字段 | 调用抛出 `OSError`，或清理换行、控制字符和 ANSI 注入后为空时省略；不执行外部命令、不访问网络 |

可一次启用这三项：

```bash
claude-statusline config enable project-name hostname context-used
```

主栏的 `context-used` 与 `context-remaining` 是彼此独立的配置项，可单独开启或同时保留。三项上下文条目相邻时按配置顺序使用内部圆点连接，例如 `Context 73% left · Context 27% used · 200K window`。

## 主状态栏显示含义

### Git 标记

`git` 条目使用以下紧凑标记：

| 标记 | 含义 |
| --- | --- |
| `↑N` | 当前分支领先 upstream N 个提交 |
| `↓N` | 当前分支落后 upstream N 个提交 |
| `[gone]` | 已配置的 upstream 不再存在 |
| `● N` / `●N` | staged 文件数；原生 Linux/macOS 使用前者，Windows/WSL 使用后者 |
| `~N` | unstaged 文件数 |
| `!N` | 冲突文件数 |
| `?N` | untracked 文件数 |
| `Git!` | Git 命令缺失、超时或返回了无法解析的结果 |

干净且与 upstream 同步的仓库只显示分支名。detached HEAD 显示为 `HEAD@` 加 7 位 commit ID。

### Token 含义

`tokens` 是当前 Claude Code 会话的累计 API 使用量，也会合并可发现的 subagent transcript：

- `hit`：cache read input tokens。
- `miss`：普通 input tokens 与 cache creation input tokens 之和。
- `out`：output tokens。

数值使用紧凑格式，例如 `950`、`12.4K`、`1.05M`。这不是剩余上下文，也不是限额用量；上下文与限额由各自条目显示。

<a id="prompt-计时标记"></a>

### 任务计时标记

| 标记 | 含义 |
| --- | --- |
| `⏱` | 任务正在运行，时间持续增长 |
| `✓` | 任务已可靠确认完成 |
| `■` | 任务被中断或会话结束 |
| `✗` | Claude Code 报告执行失败 |
| `? <elapsed>+` | Stop 候选尚未确认，或历史结束证据不完整；显示已知耗时下界 |

所属代理和主 Agent 收尾有两个运行阶段：

```text
⏱ 4m 12s
⏳ 2 agents · 4m 12s
⏳ main wrap-up · 4m 12s
? 4m 35s+
✓ 4m 35s
```

`task-timer` 从最早可信用户提交开始，包含排队、用户等待、所属代理、必要报告和主 Agent 收尾。传统 `Stop` 是结束候选，可信继续活动取消候选并沿用原时钟。完成需要可归属的原生完成或已核验的 transcript／进程 idle 结束证据，以及代理、报告和收尾均已处理；超时或心跳过期不会推定完成。后台 shell、server、monitor、workflow 和 agent-team 账本不阻塞完成。

可靠失败或用户中断冻结已接受的终态值，重复 hook 和后续刷新不延长结果。原生单轮耗时独立保存，不校准任务时钟；无可靠归属的事件不会关联到更新的任务。旧配置和命令中的 `prompt-timer` 是 `task-timer` 别名，不另计为目录项。

| 时间指标 | 含义与来源 |
| --- | --- |
| 任务总耗时 | `task-timer`：最早可信提交至已确认完成、失败或中断，包含排队、等待、代理及收尾 |
| 任务执行耗时 | `task-active-timer`：开始执行后的累计耗时，排除已核实的用户等待；完整原生覆盖才显示 |
| 原生单轮耗时 | transcript 的 `turn_duration.durationMs` 或所属原生完成报告；独立记录，不能替代任务总耗时 |
| 会话运行时间 | `cost.total_duration_ms`；CLI 会话累计运行时间，不包含两次运行／恢复之间的间隔 |
| API 等待时间 | `cost.total_api_duration_ms`；累计等待 API 响应的时间，由独立 `api-duration` 项显示 |

会话与 API 指标定义见[官方状态栏字段](https://code.claude.com/docs/en/statusline)。执行耗时默认未选中，需要 Claude Code 2.1.289+ 原生计时；覆盖不完整、等待边界未知、状态过期或时钟异常时隐藏，不假设等待为零。启用步骤见[用户指南](../USER_GUIDE.zh-CN.md#任务总耗时与执行耗时)，归属与结束规则见[计时契约](../development/timer.zh-CN.md)。

后台代理报告可能具有不同宿主 prompt ID，明确所属关系使其继续属于原人类任务。本地 `/statusline-config show` 等快捷命令不启动新计时任务；隐藏 `tokens` 后仍可保留任务计时。

## 子 Agent 行与三种作用域

Claude Code 2.1.205+ 会把官方 `subagentStatusLine` payload 交给 `claude-statusline render-subagents`。renderer 保持 `tasks` 输入顺序、忽略重复 ID 的后续项，并为每个有效非空字符串 ID 输出一行 NDJSON。它不扫描 transcript、不执行 Git、不访问网络，也不写运行状态；token 只使用当前 task 的 `tokenCount`。

默认子 Agent 行类似：

```text
⏱ 1m 18s · Explore · sonnet-5/high · Context 58% left · searching auth flow
```

可排序条目及默认状态：

| ID | 默认 | 内容 |
| --- | --- | --- |
| `status-elapsed` | 开 | 状态图标 + 用时，如 `⏱ 1m 18s`；缺失或非法 `startTime` 时只显示图标。与 `status`、`elapsed` 互斥 |
| `status` | 关 | `pending …`、`running ⏱`、`completed ✓`、`failed ✗`、`killed ■`、`paused/waiting ⏳`，未知状态为 `?` |
| `name` | 开 | `name`，否则规范化 `type`，再否则 `Agent` |
| `model-with-effort` | 开 | 移除 `claude-` 前缀的模型 ID，并在存在时追加 `/effort` |
| `context-remaining` | 开 | `Context N% left`，按 `100 − 已用百分比`（先四舍五入）计算并截断到 0–100 |
| `context-used` | 关 | `Context N% used`，`tokenCount / contextWindowSize` 四舍五入为百分比 |
| `elapsed` | 关 | 从 task 的 epoch 毫秒 `startTime` 计算；未来时间按 0 秒 |
| `task` | 开 | 优先 `label`，否则 `description`；与名称重复时省略 |
| `tokens` | 关 | 当前 task 的紧凑 token 数 |
| `current-dir` | 关 | task 的 `cwd`，遵守目录样式 |
| `model` | 关 | 当前任务的独立模型 ID |
| `effort` | 关 | 明确配置的任务 effort 或数值预算，需 2.1.214+ |
| `context-tokens` | 关 | 当前任务 token 数与上下文容量 |
| `context-window-size` | 关 | 当前任务模型的上下文容量 |

宽度直接使用 payload 中的正整数 `columns`，无效时回退 80，不扣主栏 margin。输入文本中的换行、制表符和控制字符会被清理。超宽时先截断任务文本，再按 `current-dir → tokens → context-used → context-remaining → model-with-effort → task` 删除可选段；`status` 与 `status-elapsed` 始终保留（启用 `status` 时 `name`、`elapsed` 也最后保留），极窄时 `status-elapsed` 退化为只显示状态图标。ASCII、CJK、emoji、组合字符和 ANSI 路径都保证可见宽度不超过 `columns` 且不换行。

三种作用域必须区分：

- 全局底栏属于主 Agent；`scope-labels=when-subagents` 在当前 prompt 曾启动子 Agent 后前置固定的 `Main/Session`。
- 主栏 `tokens` 是 session 累计，继续包含可发现的主与子 Agent transcript。
- 每个官方子 Agent 行只描述自己的 task，并只使用 `tasks[]` 字段。

Claude Code 没有提供 `focused_agent` 或 `viewing_task_id`。切到子 Agent transcript 后，最底部全局栏不会读取或猜测当前焦点，也不会通过 transcript mtime、进程内存或键盘事件推断；`Main/Session` 正是对这一边界的明确标注。

## 显示与宿主选项

| OPTION | VALUE | 默认值 | 说明 |
| --- | --- | --- | --- |
| `statusline-language` | `en`、`zh-CN` | `en` | 独立控制主栏／子代理输出语言；预览立即更新，随显示设置保存 |
| `colors` | `on`、`off` | `on` | 是否输出 ANSI 颜色控制码 |
| `palette` | `default`、`ansi` | `default` | `default` 使用项目的 24 位 RGB 色值；`ansi` 使用标准终端色 |
| `directory-style` | `full`、`home`、`project-relative`、`basename` | `full` | 工作目录的缩写方式 |
| `separator-style` | `classic`、`compact` | `classic` | 顶层条目的分隔方式 |
| `scope-labels` | `off`、`when-subagents`、`always` | `when-subagents` | 主栏是否前置固定的 `Main/Session` |
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

### 颜色

- `colors off` 会完全禁用本工具输出的 ANSI 颜色码。
- `palette` 在颜色关闭时仍会被保存，但暂时不影响输出；以后重新打开颜色会继续使用该 palette。
- `default` 需要终端支持 24 位颜色；兼容性优先时可使用 `ansi`。

### 目录格式

假设用户 home 是 `/home/user`，项目根目录是 `/home/user/code/repo`，当前目录是 `/home/user/code/repo/src/api`：

| 样式 | 示例输出 |
| --- | --- |
| `full` | `/home/user/code/repo/src/api` |
| `home` | `~/code/repo/src/api` |
| `project-relative` | `src/api`；位于项目根时显示 `.` |
| `basename` | `api` |

`home` 只缩写真实位于当前用户 home 下的路径。`project-relative` 在当前目录不属于 Claude Code 提供的项目根目录时退回完整路径。

Windows drive path、含空格或中文的路径、UNC path 与大小写归一都使用原生 Windows 路径语义。`full` 始终保留 payload 原始的 `/` 或 `\`；`home` 与 `project-relative` 为紧凑显示统一输出 `/`。

### 分隔符和语义分组

`classic` 使用 ` | ` 分隔顶层条目；`compact` 对所有顶层条目使用 ` · `。

以下条目在相邻时属于同一语义组，并用 ` · ` 连接；同组条目使用相同颜色：

- `model-with-effort`、`fast-mode` 与 `thinking`（模型组，象牙白）
- `current-dir`、`project-name` 与 `hostname`（位置组，绿色）
- `git`、`pr` 与 `repo`（仓库组，紫）
- `tokens` 与 `prompt-cache`（用量组，粉）
- `context-remaining`、`context-used` 与 `context-window-size`
- `five-hour-limit`、`weekly-limit` 与 `spend-limit`

`version`、`session`、`cost`、`agent`、`vim-mode`、`worktree` 各自独立，不与相邻条目合并。条目目录按组排列（模型组 → 位置组 → 仓库组 → 上下文 → 限额 → 用量组 → 计时 → 独立项），但 `enable` 只按参数顺序把新条目追加到当前列表末尾。需要把同组条目放在一起时，使用 `order`、`set-items` 或 TUI 调整顺序。如果通过排序把同组条目分开，它们会恢复为独立顶层条目。`tokens` 内部的 `hit`、`miss`、`out`，`cost` 内部的金额、时长、增删行，以及 `prompt-cache` 内部的命中率、写入 token 始终使用 ` · `。

### 刷新间隔

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

## 配置文件

### 显示配置

显示项与样式保存在：

```text
<CLAUDE_CONFIG_DIR>/claude-statusline.json
```

默认配置等价于：

```json
{
  "schema_version": 6,
  "statusline_language": "en",
  "items": [
    "model-with-effort",
    "current-dir",
    "git",
    "context-remaining",
    "context-window-size",
    "five-hour-limit",
    "weekly-limit",
    "spend-limit",
    "tokens",
    "task-timer"
  ],
  "use_colors": true,
  "palette": "default",
  "directory_style": "full",
  "separator_style": "classic",
  "scope_labels": "when-subagents",
  "subagents": {
    "enabled": true,
    "items": [
      "status-elapsed",
      "name",
      "model-with-effort",
      "context-remaining",
      "task"
    ],
    "item_options": {},
    "visibility": "all",
    "hide_completed": false,
    "row_limit": null,
    "task_max_width": null
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
  "item_options": {},
  "layout": {
    "mode": "auto",
    "rows": []
  },
  "metrics": {
    "branch_diff_base_ref": null
  }
}
```

这是严格 JSON：不接受注释、尾随逗号、未知字段、缺失字段、未知条目或重复条目。建议使用配置命令修改，而不是手工编辑。

上例中的十个条目是默认启用集合，其余 50 个主栏项通过 CLI、向导或编辑器明确选择后才会写入 `items`。

配置更新会备份修改前的内容，并通过原子替换与文件锁保护写入；详见[备份与回滚](../USER_GUIDE.zh-CN.md#备份与回滚)及[配置写入与并发](../development/README.zh-CN.md#配置写入与并发)。

当前源码显示配置使用 schema v6；历史 v1/v2/v3/v4/v5 可读取，首次实际配置保存时备份并写为 v6。版本转换与降级恢复见[版本兼容](../USER_GUIDE.zh-CN.md#版本兼容)。

如果显示配置损坏：

- 两个 renderer 都会静默回退到内建默认显示，避免破坏 Claude Code 主界面。
- `config show`、普通配置写命令和 `doctor` 会明确报告错误。
- `config reset` 可以删除损坏配置并恢复默认值。

`items: []` 是合法配置，表示主栏不输出内容；即使范围标签为 `always`，也不会单独制造空主栏。`subagents.items: []` 同样合法，表示每个有效子任务返回空 content。

<a id="实验功能偏好"></a>

### 共享界面偏好

`<CLAUDE_CONFIG_DIR>/statusline-ui.json` 使用独立 schema v1：

```json
{"schema_version": 1, "ui_language": "zh-CN"}
```

仅接受 `en` 与 `zh-CN`。缺失／无效读取返回英文，可能提示警告，但不修复。显式 set/reset 使用锁、备份及原子写入；未来 schema 拒绝覆盖，写入失败保留原有效选择。此文件与显示 revision、接入偏好、预设和可移植文件独立，普通卸载保留。

### 编辑器启用偏好

两个独立文件均使用 schema v1：

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

`<CLAUDE_CONFIG_DIR>/claude-statusline-runtime.json` 使用独立 schema v2：

```json
{"schema_version": 2, "native_timing": true, "live_metrics": false}
```

文件缺失时原生计时默认开启、高级实时指标默认关闭。`install --native-timing`／`--no-native-timing` 独立控制计时；`install --live-metrics` 开启完整采集，`--no-live-metrics` 保留旧全部关闭语义，明确的计时选项可覆盖计时部分；重装保留偏好，不兼容宿主保留偏好但暂挂采集。详见[启用采集与显示](../USER_GUIDE.zh-CN.md#可选实时状态)。

### Claude Code 宿主配置

以下设置保存在用户级 `settings.json` 的 `statusLine` 对象中，而不是 `claude-statusline.json`：

- `command`
- `padding`
- `refreshInterval`
- `hideVimModeIndicator`

其中 `command` 由安装器管理；后三项可以使用 `config set` 或向导修改。设置为默认行为时，某些字段会从 JSON 中省略，例如 `padding 0`、`refresh-interval event` 和 `hide-vim-mode-indicator off`。

兼容版本还会在 `settings.json` 写入独立的 `subagentStatusLine`，严格只含 `type: "command"` 和指向 `render-subagents` 的 `command`；Claude 的该 schema 不接受 `refreshInterval`，本工具不会写入。`subagents.enabled=false` 时重跑 `install` 只移除本工具拥有的这一设置，第三方设置不受影响；两个子 Agent 生命周期 hooks 仍保留用于端到端计时。

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
claude-statusline.exe install
claude-statusline.exe configure
claude-statusline.exe config show
```

管理命令也支持显式 `--config-dir PATH`。显式参数优先于环境变量。

还支持以下运行状态位置覆盖：

- `CLAUDE_STATUSLINE_RUNTIME_DIR`：覆盖 token、Git 缓存和逐轮状态使用的运行目录。
- `CLAUDE_STATUSLINE_SESSIONS_DIR`：覆盖 Claude Code 会话注册信息目录。

通常不需要设置后两个变量。修改它们可能让已有会话状态暂时不可见，但不会改变显示配置本身。

## 退出码

管理命令遵循以下约定：

- `0`：命令成功；`doctor` 没有 ERROR。
- `1`：`doctor` 至少发现一个 ERROR；未捕获 CLI 异常也可返回 1，包括上方受保护路径导出问题。
- `2`：参数解析失败，或已捕获的配置、所有权、安装操作校验失败。
- `130`：交互式 TUI 收到 Ctrl+C/SIGINT，终端已恢复且配置未保存。
- `128 + signal`：交互式 TUI 收到当前平台实际提供的终止信号，终端已恢复且配置未保存。

高频内部命令 `render`、`render-subagents`、`hook` 和 `slash-hook` 对损坏或无关输入采用静默容错，避免自身错误阻塞 Claude Code。
