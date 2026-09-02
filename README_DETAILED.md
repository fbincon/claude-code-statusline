# Claude Code Statusline

这是一个面向 Linux 的、可配置且带会话状态的 Claude Code CLI 状态栏工具。它可以显示当前模型与 effort、实时工作目录、Git 状态、上下文余量、Claude 使用限额、会话 token，以及当前或最近一次 prompt 的耗时。

显示项、显示顺序和样式既可以在 Claude Code 中通过 `/statusline-config` 配置，也可以通过确定性的本地 CLI 配置。所有配置均为用户全局配置，对该用户的所有 Claude Code 项目生效。

运行时只使用 Python 标准库；Git 信息需要系统中存在 `git`。状态栏只读取 Claude Code 传入的数据、本地 transcript、Git 仓库和本地状态文件，不会自行发起网络请求，也不会因为渲染状态栏而消耗模型 token。

## 文档导航

- [功能概览](#功能概览)
- [从源码构建与安装](#从源码构建与安装)
- [快速开始](#快速开始)
- [`/statusline-config` 的执行方式](#statusline-config-的执行方式)
- [CLI 总览](#cli-总览)
- [配置命令详解](#配置命令详解)
- [可配置显示项](#可配置显示项)
- [显示与宿主选项](#显示与宿主选项)
- [配置文件](#配置文件)
- [常用配置配方](#常用配置配方)
- [`doctor` 诊断](#doctor-诊断)
- [升级](#升级)
- [卸载](#卸载)
- [备份与回滚](#备份与回滚)
- [故障排查](#故障排查)

## 功能概览

- 按用户选择显示或隐藏状态项：默认 10 项，另有 11 个可选条目（版本、会话、cost、prompt-cache、运行模式、PR/worktree 等）。
- 按配置文件中的顺序渲染状态项。
- 支持 24 位 RGB 配色、终端 ANSI 配色或完全关闭颜色。
- 支持完整路径、`~` 路径、项目相对路径和目录 basename。
- 支持经典 ` | ` 分隔符和紧凑 ` · ` 分隔符。
- 支持 Claude Code 原生的 padding、定时刷新和 Vim 模式指示器设置。
- 在窄终端中自动换行，不截断长字段；长路径优先在 `/` 处分行。
- Git 查询和 transcript 汇总按需执行：隐藏相应显示项后，不再做不必要的采集。
- 安装、配置和卸载均使用文件锁、备份及原子替换，避免并发写入或半写入配置。

默认状态栏的纯文本结构类似：

```text
claude-model high | ~/code/project | main ↑1● 2~1 | Context 73% left · 1M window | 5h 82% left · weekly 64% left | hit 125K · miss 18.4K · out 7.2K | ⏱ 1m 09s
```

某项数据不可用时，该项会被省略，不会显示空占位符。例如，当前目录不在 Git 仓库中时不会显示 Git 分支；Claude Code 没有提供某个限额窗口时也不会显示该限额。

## 运行要求

- Linux
- Python 3.10 或更高版本
- Claude Code CLI
- `pipx`，用于安装本地 wheel
- `uv`，仅在从源码构建时需要
- `git`，仅在启用 `git` 显示项时需要

先确认 `pipx` 安装的命令位于 `PATH`：

```bash
pipx ensurepath
command -v claude
command -v git
```

如果刚执行过 `pipx ensurepath`，可能需要重新打开终端，或重新加载 shell 配置。

## 从源码构建与安装

在仓库根目录执行：

```bash
uv build
pipx install dist/claude_code_statusline-0.3.0-py3-none-any.whl
claude-statusline install
claude-statusline doctor
```

如果 pipx 中已经安装了旧版本，使用覆盖安装：

```bash
uv build
pipx install --force dist/claude_code_statusline-0.3.0-py3-none-any.whl
claude-statusline install
claude-statusline doctor
```

`pipx install` 只安装 Python 包和 `claude-statusline` 可执行文件；`claude-statusline install` 才会把它接入 Claude Code。

### `install` 会做什么

`claude-statusline install` 会：

1. 在用户级 `settings.json` 中安装 `statusLine.command`，指向当前 `claude-statusline render` 可执行文件。
2. 安装 `SessionStart`、`UserPromptSubmit`、`Stop`、`StopFailure` 和 `SessionEnd` 生命周期 hooks，用于维护 prompt 计时状态。
3. 安装用户级 personal skill：`${CLAUDE_CONFIG_DIR:-~/.claude}/skills/statusline-config/SKILL.md`。
4. 在 Claude Code 2.1.258 及以上版本中安装 `UserPromptExpansion` hook，让带参数的 `/statusline-config` 在本地执行。
5. 在发生实际修改前创建备份，再以原子方式写入文件。

安装器会合并而不是整体覆盖 `settings.json`，并保留无关设置和无关 hooks。重复运行 `install` 是幂等的：配置已经正确时不会重复添加 hooks，也不会创建无意义备份。

首次安装新的 `statusLine` 时，默认设置为每 1 秒刷新一次。重新安装本工具时，会保留现有且合法的 `padding`、`refreshInterval` 和 `hideVimModeIndicator`。

### 安装前预览

```bash
claude-statusline install --dry-run
```

`--dry-run` 只列出是否需要修改以及涉及哪些文件，不写入文件，也不创建备份。

### 处理已有 statusline 或同名 skill

如果已经存在不属于本工具的 statusline，或者存在没有本工具所有权标记的 `/statusline-config` skill，安装器会拒绝覆盖并返回错误。确认要替换这些内容时才使用：

```bash
claude-statusline install --force
```

`--force` 仍会先备份原文件。它不是跳过校验的通用开关，只用于明确允许替换冲突的 statusline 或 skill。

## 快速开始

安装完成后，在 Claude Code 中输入：

```text
/statusline-config
```

该命令会启动英文多选问答向导，依次询问：

- Identity / Repo：模型、目录和 Git。
- Context：上下文剩余百分比和窗口大小。
- Limits：5 小时、每周和 spend 限额。
- Usage：token 统计、prompt 计时器、cost 和 prompt-cache。
- Session：Claude Code 版本和会话名称/ID。
- Modes：fast mode、agent、vim mode 和 thinking 指示器。
- Repository：当前分支的 open PR/MR、worktree 名称和远程仓库 `owner/name`。
- 颜色、palette、目录格式、分隔符、padding、刷新间隔和 Vim 指示器。

Session、Modes、Repository 组的条目以及 `cost`、`prompt-cache` 默认禁用；在向导中勾选即启用。

向导会保留仍然启用的条目的相对顺序，并按默认目录顺序把新启用的条目追加到末尾。完成全部选择后，它只调用一次原子 `config apply`；中途取消不会写入任何配置。

这个向导使用 Claude Code 提供的问答组件，但不是 Claude Code 原生的状态栏 picker，因此不提供 Space/方向键排序或实时预览。需要任意排序时，使用 `order` 子命令。

例如，先把状态栏缩减到五项，再精确排序：

```text
/statusline-config set-items model-with-effort current-dir git context-remaining prompt-timer
/statusline-config order model-with-effort git current-dir context-remaining prompt-timer
```

随时检查当前有效配置：

```text
/statusline-config show
```

## `/statusline-config` 的执行方式

无参数和带参数的调用使用不同路径：

| 调用方式 | Claude Code 2.1.258+ | 较旧版本或版本无法识别时 |
| --- | --- | --- |
| `/statusline-config` | 进入 skill，由 Claude 驱动问答向导 | 相同 |
| `/statusline-config show` 等带参数命令 | 由本地 hook 直接执行，阻止 prompt 进入模型 | 由 skill 在一个 Claude 回合中执行相同 CLI |

带参数的本地快路径是确定性的：它只解析本文档列出的配置命令，输出结果后终止这次 slash command 展开。未知参数会显示错误或用法，且不会修改配置。

Claude Code 升级或降级跨过 2.1.258 时，重新运行：

```bash
claude-statusline install
claude-statusline doctor
```

安装器会据当前版本增加或移除本地 fast hook。旧版降级只影响带参数命令是否需要模型回合，不影响配置功能本身。

> 不要使用 Claude Code 内建的 `/statusline` 来重新生成本工具的脚本。内建命令可能把 `settings.json` 中的 `statusLine.command` 替换为另一个实现。配置本工具请使用 `/statusline-config`。

## CLI 总览

```text
claude-statusline render
claude-statusline hook
claude-statusline slash-hook
claude-statusline config [--config-dir PATH] show [--json]
claude-statusline config [--config-dir PATH] list-items [--json]
claude-statusline config [--config-dir PATH] set-items [ITEM...]
claude-statusline config [--config-dir PATH] enable ITEM...
claude-statusline config [--config-dir PATH] disable ITEM...
claude-statusline config [--config-dir PATH] order [ITEM...]
claude-statusline config [--config-dir PATH] set OPTION VALUE
claude-statusline config [--config-dir PATH] apply ...
claude-statusline config [--config-dir PATH] reset
claude-statusline install [--dry-run] [--force] [--config-dir PATH]
claude-statusline uninstall [--dry-run] [--config-dir PATH]
claude-statusline doctor [--config-dir PATH]
claude-statusline --version
```

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

而 `install`、`uninstall` 和 `doctor` 的参数直接跟在命令之后：

```bash
claude-statusline doctor --config-dir /path/to/claude-config
```

## 配置命令详解

下列本地 CLI 命令均可把开头的 `claude-statusline config` 替换为 Claude Code 中的 `/statusline-config`。例如：

```bash
claude-statusline config set colors off
```

等价于：

```text
/statusline-config set colors off
```

### `config show`

显示当前**有效配置**，包括显示配置、Claude Code 宿主配置、配置文件路径，以及当前 `statusLine.command` 是否属于这个可执行文件。

```bash
claude-statusline config show
```

示例输出：

```text
Scope: user
Config: /home/user/.claude/claude-statusline.json
Installed: yes
Items: model-with-effort, current-dir, git, context-remaining, prompt-timer
Colors: on
Palette: default
Directory style: home
Separator style: classic
Padding: 0
Refresh interval: 1
Hide Vim mode indicator: no
```

“有效配置”不等于“磁盘上一定存在显示配置文件”：如果 `claude-statusline.json` 尚未创建，`show` 会展示内建默认值。

脚本或自动化应使用 JSON 输出：

```bash
claude-statusline config show --json
```

JSON 中的 `installed` 只说明当前 `settings.json/statusLine.command` 是否精确指向当前 PATH 中的 `claude-statusline render`，不表示 Python 包是否存在。

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
- `default_enabled`：默认是否启用。前 10 个原有条目为 `true`；`version`、`session`、`cost`、`prompt-cache`、`fast-mode`、`agent`、`vim-mode`、`thinking`、`pr`、`worktree`、`repo` 为 `false`（opt-in）。
- `enabled`：当前是否启用。
- `position`：当前从 0 开始的顺序；禁用时为 `null`。

### `config set-items [ITEM...]`

一次性替换整个启用集合，同时把参数顺序保存为显示顺序：

```bash
claude-statusline config set-items model-with-effort current-dir git prompt-timer
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
claude-statusline config enable tokens prompt-timer
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
claude-statusline config order git current-dir model-with-effort prompt-timer
```

参数必须恰好包含当前已启用的每一个条目，并且每个条目只出现一次。少一个、多一个、加入尚未启用的条目或重复条目都会失败。

推荐先查看当前集合，再排序：

```bash
claude-statusline config show
claude-statusline config order model-with-effort git current-dir context-remaining prompt-timer
```

如果当前启用集合为空，空参数的 `config order` 才是合法排序：

```bash
claude-statusline config order
```

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
```

显示选项可以在安装 statusline 之前预先配置。宿主选项 `padding`、`refresh-interval` 和 `hide-vim-mode-indicator` 会修改 `settings.json/statusLine`，因此只在当前 statusline 已由这个 `claude-statusline` 可执行文件接管时允许修改。否则命令会拒绝写入，避免误改其他 statusline。

所有 `set` 的合法值见[显示与宿主选项](#显示与宿主选项)。

### `config apply`

一次提交完整的显示配置和宿主配置。无参数向导在收集完全部答案后使用该命令；也可以用于脚本化部署：

```bash
claude-statusline config apply \
  --items model-with-effort current-dir git context-remaining prompt-timer \
  --colors on \
  --palette default \
  --directory-style home \
  --separator-style classic \
  --padding 0 \
  --refresh-interval 1 \
  --hide-vim-mode-indicator off
```

除 `--items` 后的条目列表可以为空外，其他选项全部必填。命令会先完整验证所有值，再在同一个锁和同一份备份下更新 `claude-statusline.json` 与 `settings.json`。任一后续写入失败时，会尝试把已写入的文件回滚到修改前状态。

因为 `apply` 包含宿主设置，所以必须先运行 `claude-statusline install`。

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

默认启用以下全部条目，表格顺序也是首次使用时的默认显示顺序：

| ID | 显示内容 | 数据不可用时的行为 |
| --- | --- | --- |
| `model-with-effort` | 当前模型 ID（缺失时使用 display name）；存在 effort 时追加 effort level | 没有模型字段时省略 |
| `current-dir` | Claude Code 当前实时工作目录 | 没有目录字段时省略 |
| `git` | 分支、上游差异和工作树变更 | 非 Git 目录时省略；Git 查询异常时显示 `git!` |
| `context-remaining` | `Context N% left` | Claude Code 未提供百分比时省略 |
| `context-window-size` | 总上下文窗口，例如 `1M window` | Claude Code 未提供窗口大小时省略 |
| `five-hour-limit` | 5 小时窗口的剩余百分比 | 未提供该窗口时省略 |
| `weekly-limit` | 7 天窗口的剩余百分比，显示为 `weekly` | 未提供该窗口时省略 |
| `spend-limit` | gateway spend 限额的剩余百分比 | 未提供该窗口时省略 |
| `tokens` | 当前会话累计的 `hit · miss · out` | 没有 session/transcript 信息时省略 |
| `prompt-timer` | 当前或最近一次真实 prompt 的耗时和结果 | 尚无可识别 prompt 时省略 |

限额百分比由 Claude Code 传入的 `used_percentage` 换算为剩余百分比。本工具不查询账号限额服务，因此实际能显示哪些窗口取决于当前 Claude Code 版本、账号和本次 statusline payload。

以下条目来自 Claude Code 2.1.258 及以上版本的公开 statusline payload，**默认不显示**，通过 `/statusline-config enable` 开启：

| ID | 显示内容 | 数据不可用时的行为 |
| --- | --- | --- |
| `version` | Claude Code 版本，例如 `v2.1.258` | 未提供版本时省略 |
| `session` | 会话名称（`/rename` 设置后），否则显示会话 ID 前 8 位 | 没有会话 ID 时省略 |
| `cost` | 会话金额、API 时长与增删行数，例如 `$0.12 · 12m 30s · +156/-23`；金额恒显示（无数据时为 `$0.00`），时长为 0 或增删行均为 0 时省略对应部分 | 没有 cost 字段时省略 |
| `prompt-cache` | 缓存命中率与写入 token，例如 `cache 91% · 352K w` | 没有 prompt_cache 字段时省略（首次 API 响应前不存在）；命中率越界时只显示 token 部分 |
| `fast-mode` | fast mode 开启时显示 `fast` | 未开启时省略 |
| `agent` | `--agent` 会话的 agent 名称，例如 `agent orchestrator` | 没有 agent 字段时省略 |
| `vim-mode` | vim mode 开启时的当前模式，例如 `vim NORMAL` | 没有 vim 字段时省略 |
| `thinking` | 扩展思考启用时显示 `thinking` | 未启用时省略 |
| `pr` | 当前分支的 open PR/MR，例如 `PR #1234 · approved`；GitLab 合并请求显示为 `MR !1234` | 当前分支没有 open PR/MR 时省略 |
| `worktree` | `--worktree` 会话的 worktree 名称，例如 `worktree feat-x` | 没有 worktree 字段时省略 |
| `repo` | origin remote 的仓库，例如 `acme/widget` | 没有 remote 身份时省略 |

`cost` 的金额来自 Claude Code 的 `total_cost_usd`；在第三方 API 端点（例如 DeepSeek 代理）下该值为按默认模型费率的估算，仅作参考。`prompt-cache` 与 `tokens` 的统计口径不同：前者来自 statusline payload 且不含 subagent 流量，后者从 transcript 累计并包含可发现的 subagent transcript。

### Git 标记

`git` 条目使用以下紧凑标记：

| 标记 | 含义 |
| --- | --- |
| `↑N` | 当前分支领先 upstream N 个提交 |
| `↓N` | 当前分支落后 upstream N 个提交 |
| `[gone]` | 已配置的 upstream 不再存在 |
| `● N` | staged 文件数 |
| `~N` | unstaged 文件数 |
| `!N` | 冲突文件数 |
| `?N` | untracked 文件数 |
| `git!` | Git 命令缺失、超时或返回了无法解析的结果 |

干净且与 upstream 同步的仓库只显示分支名。detached HEAD 显示为 `HEAD@` 加 7 位 commit ID。

### Token 含义

`tokens` 是当前 Claude Code 会话的累计 API 使用量，也会合并可发现的 subagent transcript：

- `hit`：cache read input tokens。
- `miss`：普通 input tokens 与 cache creation input tokens 之和。
- `out`：output tokens。

数值使用紧凑格式，例如 `950`、`12.4K`、`1.05M`。这不是剩余上下文，也不是限额用量；上下文与限额由各自条目显示。

### Prompt 计时标记

| 标记 | 含义 |
| --- | --- |
| `⏱` | prompt 正在运行，时间持续增长 |
| `✓` | prompt 正常完成 |
| `■` | prompt 被中断或会话结束 |
| `✗` | Claude Code 报告执行失败 |
| `?` | 上一次运行没有可确认的结束事件；时间后会带 `+` |

`/statusline-config show` 之类的本地快捷命令不会被当作新的计时 prompt。即使隐藏 `tokens` 但保留 `prompt-timer`，计时器仍会读取所需 transcript 状态并正常工作。

## 显示与宿主选项

| OPTION | VALUE | 默认值 | 说明 |
| --- | --- | --- | --- |
| `colors` | `on`、`off` | `on` | 是否输出 ANSI 颜色控制码 |
| `palette` | `default`、`ansi` | `default` | `default` 使用项目的 24 位 RGB 色值；`ansi` 使用标准终端色 |
| `directory-style` | `full`、`home`、`project-relative`、`basename` | `full` | 工作目录的缩写方式 |
| `separator-style` | `classic`、`compact` | `classic` | 顶层条目的分隔方式 |
| `padding` | `0`–`32` | `0` | Claude Code 在状态栏内容前增加的水平空白字符数 |
| `refresh-interval` | `event`、`1`–`3600` | `1` | 除事件刷新外，按指定秒数定时重跑 renderer；`event` 表示只按事件刷新 |
| `hide-vim-mode-indicator` | `on`、`off` | `off` | `on` 隐藏 Claude Code 内建的 Vim 模式文字 |

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

### 分隔符和语义分组

`classic` 使用 ` | ` 分隔顶层条目；`compact` 对所有顶层条目使用 ` · `。

以下条目在相邻时属于同一语义组，并用 ` · ` 连接：

- `context-remaining` 与 `context-window-size`
- `five-hour-limit`、`weekly-limit` 与 `spend-limit`
- `version` 与 `session`
- `fast-mode`、`agent`、`vim-mode` 与 `thinking`
- `cost` 与 `prompt-cache`
- `pr`、`worktree` 与 `repo`

如果通过排序把同组条目分开，它们会恢复为独立顶层条目。`tokens` 内部的 `hit`、`miss`、`out`，`cost` 内部的金额、时长、增删行，以及 `prompt-cache` 内部的命中率、写入 token 始终使用 ` · `。

### 刷新间隔

Claude Code 会在相关 UI 或会话事件发生时重跑 statusline。`refresh-interval N` 会在此基础上每 N 秒额外刷新，适合持续更新 `prompt-timer`，或在主会话空闲时观察后台产生的变化。

```bash
# 默认：每秒刷新
claude-statusline config set refresh-interval 1

# 降低刷新频率
claude-statusline config set refresh-interval 5

# 只在 Claude Code 事件发生时刷新
claude-statusline config set refresh-interval event
```

使用 `event` 时，运行中的 `prompt-timer` 不会按秒连续变化，只会在下一个状态事件触发后更新。

## 配置文件

### 显示配置

显示项与样式保存在：

```text
${CLAUDE_CONFIG_DIR:-~/.claude}/claude-statusline.json
```

默认配置等价于：

```json
{
  "schema_version": 1,
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
    "prompt-timer"
  ],
  "use_colors": true,
  "palette": "default",
  "directory_style": "full",
  "separator_style": "classic"
}
```

这是严格 JSON：不接受注释、尾随逗号、未知字段、缺失字段、未知条目或重复条目。建议使用配置命令修改，而不是手工编辑。

上例中的 10 个条目是默认启用集合。`version`、`session`、`cost`、`prompt-cache`、`fast-mode`、`agent`、`vim-mode`、`thinking`、`pr`、`worktree`、`repo` 是可选条目，默认不包含在内；使用 `config enable` 或在向导中勾选后才会写入 `items`。

配置更新采用 0600 文件权限、临时文件和原子替换。多个并发配置命令共享同一把文件锁，避免后写入者丢失先写入者的变更。

如果显示配置损坏：

- renderer 会静默回退到内建默认显示，避免破坏 Claude Code 主界面。
- `config show`、普通配置写命令和 `doctor` 会明确报告错误。
- `config reset` 可以删除损坏配置并恢复默认值。

`items: []` 是合法配置，表示不输出任何状态栏内容。

### Claude Code 宿主配置

以下设置保存在用户级 `settings.json` 的 `statusLine` 对象中，而不是 `claude-statusline.json`：

- `command`
- `padding`
- `refreshInterval`
- `hideVimModeIndicator`

其中 `command` 由安装器管理；后三项可以使用 `config set` 或向导修改。设置为默认行为时，某些字段会从 JSON 中省略，例如 `padding 0`、`refresh-interval event` 和 `hide-vim-mode-indicator off`。

## 常用配置配方

### 精简开发视图

```bash
claude-statusline config set-items model-with-effort current-dir git context-remaining prompt-timer
claude-statusline config set directory-style home
claude-statusline config set separator-style compact
```

### 只保留限额与 token

```bash
claude-statusline config set-items five-hour-limit weekly-limit spend-limit tokens
```

### 关闭颜色，适配基础终端或日志录制

```bash
claude-statusline config set colors off
```

### 使用标准 ANSI 色而不是 24 位 RGB

```bash
claude-statusline config set colors on
claude-statusline config set palette ansi
```

### 临时隐藏一个条目，之后追加恢复

```bash
claude-statusline config disable tokens
claude-statusline config enable tokens
```

注意第二条命令会把 `tokens` 追加到末尾，而不是恢复它之前的位置。需要恢复精确位置时使用 `order` 或重新运行 `set-items`。

### 恢复出厂显示配置但保留安装

```bash
claude-statusline config reset
claude-statusline config show
```

## `doctor` 诊断

```bash
claude-statusline doctor
```

`doctor` 是只读命令，会检查：

- 当前平台和 Python 版本。
- `claude-statusline` 是否位于 PATH 且可执行。
- Git 是否可用。
- `settings.json` 是否有效及其权限。
- `statusLine.command` 和三个宿主字段是否合法。
- 五个生命周期 hook 是否各自恰好存在一个。
- `/statusline-config` skill 及所有权标记是否正确。
- 显示配置 JSON 及其权限是否正确。
- 当前 Claude Code 版本是否应安装本地 slash fast hook。
- 运行状态目录是否可写。

诊断级别与退出码：

- `[OK]`：检查通过。
- `[WARN]`：功能可继续使用，但存在降级，例如缺少 Git，或旧版 Claude Code 只能使用 model fallback。只有 WARN 时退出码仍为 0。
- `[ERROR]`：安装或配置不完整；只要存在 ERROR，`doctor` 的退出码就是 1。

一般修复流程：

```bash
claude-statusline install
claude-statusline doctor
```

如果 `install` 报告冲突，先检查它指出的现有配置；只有确认替换符合预期后才加 `--force`。

## 升级

构建新版本 wheel 后，让 pipx 替换现有环境，再重新同步 Claude Code 配置：

```bash
uv build
pipx install --force dist/claude_code_statusline-0.3.0-py3-none-any.whl
claude-statusline install
claude-statusline doctor
claude-statusline config show
```

必须重复运行 `install`，因为新包可能更新 skill 模板、可执行文件路径、hooks 或版本兼容策略。

显示配置、token 汇总、Git 缓存和逐轮计时状态位于 Claude 配置目录中，不在 pipx 虚拟环境里，因此升级 Python 包不会删除它们。

## 卸载

先移除本工具写入 Claude Code 的配置，再卸载 pipx 包：

```bash
claude-statusline uninstall
pipx uninstall claude-code-statusline
```

可以先预览：

```bash
claude-statusline uninstall --dry-run
```

卸载器只移除：

- 指向本工具的 `statusLine`。
- 本工具的生命周期 hooks 和 slash fast hook。
- 本工具拥有的 `/statusline-config` skill 及所有权标记。

卸载器会保留：

- 其他工具或用户定义的 hooks。
- `claude-statusline.json` 显示偏好。
- token、Git 和计时运行状态。
- 安装器创建的备份。

因此以后重新安装时可以继续使用原有显示偏好。如需彻底清除这些保留数据，请先确认具体文件路径后再手工处理。

## 备份与回滚

安装、卸载和配置更新产生的备份位于：

```text
${CLAUDE_CONFIG_DIR:-~/.claude}/backups/statusline/cli-<action>-<timestamp>/
```

只有实际发生修改时才创建备份。一次事务可能同时记录 `settings.json`、`claude-statusline.json`、skill 和所有权标记的修改前内容。

每个备份目录中的 `metadata.json` 记录：

- 产生备份的 action。
- 创建时间。
- 每个原始文件的绝对路径。
- 修改前状态是 `before` 还是 `absent`。

`*.before` 包含修改前的原始字节；`*.absent` 表示修改前该文件不存在。手工回滚前先退出相关 Claude Code 会话，根据 `metadata.json` 把 `*.before` 恢复到对应路径；对于 `absent` 条目，回滚含义是让对应目标恢复为不存在。

正常写入过程中如果后一步失败，工具会自动尝试事务内回滚；备份仍会保留，便于检查。

## 自定义配置目录与环境变量

工具遵循 Claude Code 的 `CLAUDE_CONFIG_DIR`：

```bash
CLAUDE_CONFIG_DIR=/path/to/claude-config claude-statusline install
CLAUDE_CONFIG_DIR=/path/to/claude-config claude-statusline config show
```

管理命令也支持显式 `--config-dir PATH`。显式参数优先于环境变量。

还支持原实现的运行状态位置覆盖：

- `CLAUDE_STATUSLINE_RUNTIME_DIR`：覆盖 token、Git 缓存和逐轮状态使用的运行目录。
- `CLAUDE_STATUSLINE_SESSIONS_DIR`：覆盖 Claude Code 会话注册信息目录。

通常不需要设置后两个变量。修改它们可能让已有会话状态暂时不可见，但不会改变显示配置本身。

## 内部命令

以下三个命令主要由 Claude Code 调用，不是日常配置接口：

### `render`

从 stdin 读取 Claude Code statusline JSON，根据当前配置向 stdout 输出一行或多行状态栏文本。无效输入时保持静默，以免错误内容污染 Claude Code UI。

可以使用模拟输入做基础排查：

```bash
printf '%s\n' '{"model":{"id":"test-model"},"effort":{"level":"high"},"workspace":{"current_dir":"/tmp"}}' \
  | COLUMNS=120 claude-statusline render
```

该测试仍会读取当前用户的 `claude-statusline.json`，所以输出取决于当前启用项。

### `hook`

从 stdin 读取 Claude Code 生命周期事件，静默更新本地 prompt 计时状态。它被设计为即使输入损坏也不阻塞 Claude Code 回合。

### `slash-hook`

从 stdin 读取 `UserPromptExpansion` 事件。它只处理名为 `statusline-config` 且带参数的直接 slash command；无参数调用会放行给问答 skill，无关事件和损坏输入会静默放行。

## 故障排查

### 状态栏不显示

1. 运行 `claude-statusline doctor`。
2. 确认 `claude-statusline` 位于 PATH。
3. 确认没有通过 `config set-items` 把 `items` 设为空。
4. 查看 `settings.json` 中是否存在指向本工具的 `statusLine.command`。
5. 如果 Claude Code 提示 statusline 因 trust 被跳过，重启 Claude Code 并接受对应信任提示。
6. 检查是否启用了会统一禁用 hooks/statusline 的 Claude Code 设置。

### `/statusline-config` 不可见

```bash
claude-statusline install
claude-statusline doctor
```

确认 doctor 中 `/statusline-config skill` 为 OK。若安装是在当前 Claude Code 会话启动后完成，可新开一个会话再次检查命令发现情况。

### 带参数的 slash 命令仍进入模型

这通常表示 Claude Code 版本低于 2.1.258、版本无法识别，或 fast hook 未同步。检查：

```bash
claude --version
claude-statusline doctor
claude-statusline install
```

旧版的 model fallback 是预期降级，不会改变命令语义。

### 配置命令提示 statusLine 不属于本工具

`padding`、`refresh-interval`、`hide-vim-mode-indicator` 和完整 `apply` 需要修改 Claude Code 的 `settings.json`。为保护其他 statusline，这些操作要求当前 `statusLine.command` 指向当前可执行文件。

先检查：

```bash
claude-statusline config show
claude-statusline doctor
```

如果确实要让本工具接管 statusline，再运行 `claude-statusline install`。显示项、颜色、palette、目录和分隔符则可以在安装前配置。

### JSON 配置损坏

renderer 会继续使用默认显示，但诊断和普通写命令会报错。恢复默认配置：

```bash
claude-statusline config reset
claude-statusline doctor
```

如需保留手工配置内容，先从最近的备份中恢复或修正 JSON，再运行 doctor。

### Git 信息缺失或显示 `git!`

```bash
command -v git
git -C /path/to/project status --porcelain=v2 --branch --ahead-behind
```

非 Git 目录不显示 Git 项是正常行为。`git!` 表示 Git 调用缺失、超时或结果无法解析。禁用 `git` 后 renderer 不再执行 Git 查询：

```bash
claude-statusline config disable git
```

### Token 或计时器暂时不显示

这些条目依赖 Claude Code 提供的 session ID、transcript 路径和生命周期事件。在第一次真实模型响应前、特殊本地命令期间或 transcript 尚未产生时，暂时省略是正常行为。

若计时器存在但运行中数字不连续变化，检查是否使用了事件刷新：

```bash
claude-statusline config show
claude-statusline config set refresh-interval 1
```

### 输出在窄终端中换成多行

这是预期行为。renderer 使用终端的 `COLUMNS`，预留 2 个字符后打包各段；字段不会因为窗口过窄而被静默截断。增大终端宽度、使用 `compact` 分隔符、选择更短的目录样式，或隐藏次要条目可以减少换行。

## 退出码

管理命令遵循以下约定：

- `0`：命令成功；`doctor` 没有 ERROR。
- `1`：`doctor` 至少发现一个 ERROR。
- `2`：参数、配置、所有权或安装操作校验失败。

高频内部命令 `render`、`hook` 和 `slash-hook` 对损坏或无关输入采用静默容错，避免自身错误阻塞 Claude Code。

## 开发与测试

运行完整测试：

```bash
PYTHONPATH=src PYTHONDONTWRITEBYTECODE=1 \
  python3 -m unittest discover -s tests -v
```

运行基础静态检查并构建分发包：

```bash
ruff check --select F,E9 src tests
uv build
```

确认 wheel 包含 personal skill 模板：

```bash
python3 -m zipfile -l dist/claude_code_statusline-0.3.0-py3-none-any.whl
```

## 当前边界

- 仅支持 Linux 和 Python 3.10+。
- 配置仅为用户全局，不提供项目级配置。
- 不增加 Claude Code payload、本地 Git 和 transcript 之外的新指标。
- 不跟随 Claude Code `/theme`；`default` palette 使用本项目固定 RGB 色值。
- 不提供原生 Space/方向键排序、拖拽排序或实时预览。
- 只配置主 Claude Code statusline，不配置 `subagentStatusLine`。

## 相关文档

- [README.md](README.md)：精简版，只包含安装与常用配置的最小步骤。
- [Claude Code：Customize your status line](https://code.claude.com/docs/en/statusline)
- [Claude Code：Hooks reference](https://code.claude.com/docs/en/hooks)
- [Claude Code：Automate workflows with hooks](https://code.claude.com/docs/en/hooks-guide)
