# Claude Code Statusline 使用指南

本指南覆盖安装、配置、升级、诊断和开发。首次使用可先阅读[项目首页](../README.md)；发布版本的操作见[发布指南](RELEASING.md)。

配置按用户生效，对该用户的所有 Claude Code 项目生效。状态栏渲染读取 Claude Code 输入、本机名、transcript（会话记录）、本地 Git 和状态文件，不自行发起网络请求或消耗模型 token。问答配置向导由 Claude 驱动，会使用模型回合；带参数命令的执行路径见[执行方式](#statusline-config-的执行方式)。

本文将终端交互界面简称 TUI，将模型思考强度记为 effort，保留 hook、skill、命令名和 JSON 字段的原样拼写。通用单行 CLI 示例以 `claude-statusline` 为命令名，Windows 使用 `claude-statusline.exe`；标注 Bash 的续行、环境变量赋值和管道示例须按对应 PowerShell 示例执行。

文中 `<CLAUDE_CONFIG_DIR>` 表示 Claude 配置目录：设置环境变量 `CLAUDE_CONFIG_DIR` 时使用其值，否则为当前用户主目录下的 `.claude`。该记号是路径占位符，不是要原样输入的命令。管理命令的 `--config-dir` 可以显式指定该目录。

## 文档导航

- [功能概览](#功能概览)
- [运行要求](#运行要求)
- [安装与接入](#安装与接入)
- [独立交互式 TUI](#独立交互式-tui)
- [`/statusline-config` 问答向导](#statusline-config-问答向导)
- [常用配置配方](#常用配置配方)
- [实验入口 `/statusline-configure`](#实验入口-statusline-configure)
- [`/statusline-config` 的执行方式](#statusline-config-的执行方式)
- [CLI 总览](#cli-总览)
- [配置命令详解](#配置命令详解)
- [可配置显示项](#可配置显示项)
- [主状态栏显示含义](#主状态栏显示含义)
- [子 Agent 行与三种作用域](#子-agent-行与三种作用域)
- [显示与宿主选项](#显示与宿主选项)
- [配置文件](#配置文件)
- [自定义配置目录与环境变量](#自定义配置目录与环境变量)
- [升级](#升级)
- [卸载](#卸载)
- [备份与回滚](#备份与回滚)
- [`doctor` 诊断](#doctor-诊断)
- [故障排查](#故障排查)
- [退出码](#退出码)
- [当前边界](#当前边界)
- [附录：开发与测试](#附录开发与测试)
- [附录：内部命令](#附录内部命令)
- [附录：实现说明](#附录实现说明)
- [相关文档](#相关文档)

## 功能概览

- 按用户选择显示或隐藏状态项：默认 10 项，另有 14 个可选条目（项目名、本机名、上下文用量、版本、会话、cost、prompt-cache、运行模式、PR/worktree 等）。
- 按配置文件中的顺序渲染状态项。
- 支持 24 位 RGB 配色、终端 ANSI 配色或完全关闭颜色。
- 支持完整路径、`~` 路径、项目相对路径和目录 basename。
- 支持经典 ` | ` 分隔符和紧凑 ` · ` 分隔符。
- 支持 Claude Code 原生的 padding、定时刷新和 Vim 模式指示器设置。
- Claude Code 2.1.205+ 默认安装官方 `subagentStatusLine`，每个子 Agent 独立显示状态、模型/effort、上下文占比、用时与任务。
- `prompt-timer` 覆盖从用户提交到主 Agent 最终 `Stop` 的完整任务；等待子 Agent 和主 Agent 收尾期间持续计时。
- 主栏在当前 prompt 曾启动子 Agent 时显示固定的 `Main/Session` 范围提示，避免与每个子 Agent 行的口径混淆。
- 提供独立全屏 TUI，可用键盘筛选、勾选、排序并按键级预览完整草稿。
- 可选安装 `/statusline-configure`：Linux 从 tmux popup 或 GNOME Terminal 新标签页启动，macOS 预览从 tmux popup 启动，Windows 从系统新控制台启动同一个 TUI。
- 在窄终端中自动换行，不截断长字段；长路径优先在 `/` 或 `\` 处分行。
- Git 查询和 transcript 汇总按需执行：隐藏相应显示项后，不再做不必要的采集。
- 安装、配置和卸载均使用跨平台文件锁、备份及原子替换，避免并发写入、丢失更新或半写入配置。

原生 Linux 上，主状态栏的纯文本结构示例（目录样式设为 `home`，当前轮未启动子 Agent）：

```text
claude-model high | ~/code/project | Git main ↑1● 2~1 | Context 73% left · 1M window | 5h 82% left · weekly 64% left | hit 125K · miss 18.4K · out 7.2K | ⏱ 1m 09s
```

Windows 和 WSL 使用无空格的 staged 标记：

```text
claude-model high | ~/code/project | Git main ↑1●2~1 | Context 73% left · 1M window | 5h 82% left · weekly 64% left | hit 125K · miss 18.4K · out 7.2K | ⏱ 1m 09s
```

某项数据不可用时，该项会被省略，不会显示空占位符。例如，当前目录不在 Git 仓库中时不会显示 Git 分支；Claude Code 没有提供某个限额窗口时也不会显示该限额。

## 运行要求

- Linux 原生或 WSL，Python 3.10+；Windows 10/11 原生、CPython 3.10–3.14、x86/x64；macOS 预览、CPython 3.10–3.14、Intel / Apple Silicon，CI 覆盖 macOS 15/26。
- Claude Code CLI。
- [`pipx`](https://pipx.pypa.io/latest/how-to/install-pipx.html)，用于隔离安装 Release wheel 或 GitHub 源码。
- `build`，仅在从源码构建时需要。
- `git`，用于从 GitHub 源码安装或显示 Git 信息；从 Release wheel 安装且不显示 Git 信息时不需要。
- Linux 的 tmux 或 GNOME Terminal、macOS 的 tmux 仅供实验性 `/statusline-configure` 使用；Windows 使用系统 `CREATE_NEW_CONSOLE`，无需额外终端程序。

已发布的 v1.0.0 wheel 与固定标签源码不包含 macOS 支持；macOS 使用 v1.1.0a1 预览包，详见[预览安装与验证边界](#macos-预览安装与验证边界)。Windows ARM64 原生 Python 暂不承诺；ARM 设备可使用 x64 Python 仿真。Windows 会从包元数据自动安装 [`windows-curses>=2.4.2`](https://pypi.org/project/windows-curses/)。

| 功能 | Claude Code 版本条件 |
| --- | --- |
| 主状态栏、CLI、独立 TUI 与配置向导 | 旧版或版本无法识别时仍可使用；缺少的数据项会省略 |
| 子 Agent 独立行及生命周期 hooks | 2.1.205+；每个任务的 effort 显示需要 2.1.214+ |
| 带参数 `/statusline-config` 的本地执行、实验性 `/statusline-configure` | 2.1.258+ |

跨过上述功能门槛升级或降级时，应重新运行 `install` 和 `doctor`，详见[版本兼容](#版本兼容)。

## 安装与接入

### 安装 Python 包

Linux / WSL / Windows 用户可从以下方式中任选一种，安装稳定版 v1.0.0。macOS 使用后面的 [v1.1.0a1 预览安装步骤](#macos-预览安装与验证边界)；其他平台也可按该步骤试用新版。开发分支可能包含尚未发布的改动。

**Release URL（推荐，Bash / PowerShell 通用）：**

```text
pipx install "https://github.com/fbincon/claude-code-statusline/releases/download/v1.0.0/claude_code_statusline-1.0.0-py3-none-any.whl"
pipx ensurepath
```

**下载后安装：** 在 [v1.0.0 Release](https://github.com/fbincon/claude-code-statusline/releases/tag/v1.0.0) 下载 wheel，并在下载目录执行。

Linux / WSL（Bash）：

```bash
pipx install ./claude_code_statusline-1.0.0-py3-none-any.whl
pipx ensurepath
```

Windows（PowerShell）：

```powershell
pipx install .\claude_code_statusline-1.0.0-py3-none-any.whl
pipx ensurepath
```

Release 同时提供源码包和 `SHA256SUMS`。需要校验时，在包含下载文件的目录运行 `sha256sum 文件名`（Linux / WSL）或 `Get-FileHash 文件名 -Algorithm SHA256`（PowerShell），与 `SHA256SUMS` 中对应文件的值比较。

**固定标签源码（需要 Git，Bash / PowerShell 通用）：**

```text
pipx install "git+https://github.com/fbincon/claude-code-statusline.git@v1.0.0"
pipx ensurepath
```

**开发分支源码：** 如需默认分支的当前代码，使用以下命令；该来源不固定为 v1.0.0。

```text
pipx install "git+https://github.com/fbincon/claude-code-statusline.git"
pipx ensurepath
```

已有本地源码时，可在项目根目录执行 `pipx install .` 和 `pipx ensurepath`。需要自己构建 wheel 时，见[从源码构建与安装](#从源码构建与安装)。

### macOS 预览安装与验证边界

在 Bash / Zsh 中直接安装 [v1.1.0a1 预发布 wheel](https://github.com/fbincon/claude-code-statusline/releases/tag/v1.1.0a1)：

```bash
pipx install "https://github.com/fbincon/claude-code-statusline/releases/download/v1.1.0a1/claude_code_statusline-1.1.0a1-py3-none-any.whl"
pipx ensurepath
```

也可以下载该 Release 的 wheel 后执行 `pipx install ./claude_code_statusline-1.1.0a1-py3-none-any.whl`。校验文件时，macOS 使用 `shasum -a 256 文件名`，与附件 `SHA256SUMS` 比较；Linux / WSL 使用 `sha256sum 文件名`。

固定标签源码安装（需要 Git）：

```bash
pipx install "git+https://github.com/fbincon/claude-code-statusline.git@v1.1.0a1"
pipx ensurepath
```

已有安装时，在选定的 `pipx install` 命令中加入 `--force`。重新打开 Bash / Zsh 终端后，运行 `claude-statusline --version` 确认显示 `1.1.0a1`，再运行 `claude-statusline install --dry-run`、`claude-statusline install` 和 `claude-statusline doctor`。独立配置界面使用 `claude-statusline configure`。Python 需提供 `curses`；预览没有额外 Python 运行依赖。

**v1.0.0 Release wheel、源码包和标签不包含 macOS 改动**。v1.1.0a1 单独作为预发布提供，GitHub 的最新稳定版入口仍指向 v1.0.0。

自动验证覆盖 macOS 15/26 的 Intel 与 Apple Silicon、Python 3.10/3.14。ARM64 的 Python 3.10 下界固定测试 3.10.11；其余组合使用对应可用的补丁版本，实际版本记录在 CI 平台报告中。自动测试使用临时配置与合成 payload，包含文件锁、权限、原子写入、真实系统接口、PTY 和 tmux popup。

没有 macOS 本地机器时，GitHub 托管 runner 可以完成上述自动验证；实际 Claude 会话的视觉效果、字体/字符宽度、真实睡眠恢复和桌面终端体验尚未人工验收，因此当前采用预览声明。macOS 实验入口仅支持有效 tmux 会话；Terminal.app / iTerm2 自动启动留作后续扩展。

### 接入 Claude Code

`pipx install` 安装包与命令入口；`claude-statusline install` 才会接入 Claude Code。执行 `pipx ensurepath` 后先重新打开终端，再继续。

Linux / WSL / macOS 预览：

```bash
claude-statusline install --dry-run
claude-statusline install
claude-statusline doctor
```

Windows PowerShell：

```powershell
claude-statusline.exe install --dry-run
claude-statusline.exe install
claude-statusline.exe doctor
```

Windows 要求 `claude-statusline.exe` 能从 `PATH` 解析；找不到命令时，先检查 pipx 的路径设置。自定义配置目录见[环境变量说明](#自定义配置目录与环境变量)。

### `install` 会做什么

`claude-statusline install` 会：

1. 在用户级 `settings.json` 中安装 `statusLine.command`，指向当前 `claude-statusline render` 可执行文件。
2. 安装 `SessionStart`、`UserPromptSubmit`、`Stop`、`StopFailure` 和 `SessionEnd` 生命周期 hooks，用于维护 prompt 计时状态。
3. Claude Code 2.1.205+ 默认安装只含 `type`、`command` 的 `subagentStatusLine`，并安装 `SubagentStart`、`SubagentStop` hooks；旧版或未知版本会暂挂这三项而不影响主栏。
4. 安装用户级 personal skill：`<CLAUDE_CONFIG_DIR>/skills/statusline-config/SKILL.md`。
5. 在 Claude Code 2.1.258 及以上版本中安装 `UserPromptExpansion` hook，让带参数的 `/statusline-config` 在本地执行。
6. 按持久 feature 偏好安装或暂挂实验性 `/statusline-configure` skill 与 600 秒 hook；首次安装默认关闭。
7. 在发生实际修改前创建备份，再以原子方式写入文件。

安装器会合并而不是整体覆盖 `settings.json`，并保留无关设置和无关 hooks。重复运行 `install` 是幂等的：配置已经正确时不会重复添加 hooks，也不会创建无意义备份。

首次安装新的 `statusLine` 时，默认设置为每 1 秒刷新一次。重新安装本工具时，会保留现有且合法的 `padding`、`refreshInterval` 和 `hideVimModeIndicator`。

### 安装前预览

```bash
claude-statusline install --dry-run
```

`--dry-run` 只列出是否需要修改以及涉及哪些文件，不写入文件，也不创建备份。

### 处理已有 statusline 或同名 skill

如果已经存在不属于本工具的 `statusLine`、`subagentStatusLine`，或者存在没有本工具所有权标记的 `/statusline-config`、`/statusline-configure` skill，安装器会在备份和写入前拒绝整次操作。确认要替换这些内容时才使用：

```bash
claude-statusline install --force
```

`--force` 同时允许替换冲突的主栏、子 Agent 行或 skill，并仍会先备份原文件。若只想保留第三方 `subagentStatusLine`，先运行 `claude-statusline config set subagent-statusline off`，再运行普通 `install`。

## 独立交互式 TUI

在 Claude Code 外的真实终端中运行稳定的独立入口：

```bash
claude-statusline configure
claude-statusline configure --config-dir /path/to/claude-config
```

Windows PowerShell 使用同一界面：

```powershell
claude-statusline.exe configure
claude-statusline.exe configure --config-dir 'C:\Path With Spaces\Claude 配置'
```

独立 TUI 使用当前终端。Linux/macOS 使用 Python 标准库的 `curses` 接口，Windows 使用条件依赖 `windows-curses>=2.4.2`（PDCurses）；三个平台提供相同的 Main/Subagents/Settings 页签。启动条件如下：

- stdin 和 stdout 都必须是 TTY。
- 当前终端必须能初始化 curses。
- 当前配置不能损坏。
- `statusLine.command` 必须已经由当前 `claude-statusline` 可执行文件接管；否则先运行 `claude-statusline install`。

界面最小尺寸为 `64x18`。窗口更小时，界面会显示所需尺寸和当前尺寸并等待放大；此时 Esc 与 Ctrl+C 仍可退出。终端 resize 后会重新计算列表滚动、样例预览高度与换行；Windows 同时兼容 PDCurses 的 `KEY_RESIZE` 行为。

界面包含 Main、Subagents 和 Settings 三个页签，固定底部区域标记为 `Preview (sample data)`。常用全局按键为：

| 按键 | 行为 |
| --- | --- |
| Tab / Shift+Tab | 在 Main、Subagents、Settings 间循环；数字编辑期间不切换 |
| Enter | 非数字编辑状态下一次性保存整个草稿 |
| Esc | 非数字编辑状态下取消并退出，不写入配置 |
| Ctrl+C | 恢复终端并以 130 退出，不保存 |

Main 和 Subagents 页分别维护自己的选择、搜索、滚动、启用集合与排序，并支持：

| 按键 | 行为 |
| --- | --- |
| Space | 切换高亮条目的启用状态，位置不变 |
| Up / Down | 移动高亮项并保持可见 |
| PageUp / PageDown | 按当前内容区高度翻页 |
| Home / End | 跳到第一个或最后一个可见条目 |
| Left / Right | 向前或向后移动条目，边界不循环 |
| 可打印字符 | 追加到大小写不敏感的搜索串，同时匹配条目 ID 和说明 |
| Backspace / Ctrl+U | 删除一个搜索字符 / 清空搜索 |

每页初始完整顺序都是“当前启用项的原顺序 + 尚未启用项的目录顺序”。筛选期间，左右键以相邻的可见搜索结果为移动目标，隐藏条目的相对顺序不变。没有搜索结果时显示 `No matching items`，切换和移动键不执行操作。保存时 Main 写入 `items`，Subagents 写入 `subagents.items`；禁用项的临时位置不会进入 schema。

Settings 页固定包含：

| 设置 | 值域与操作 |
| --- | --- |
| Use colors | `on/off`；Space 或 Left/Right 切换 |
| Palette | `default/ansi`；Left/Right 循环；colors 关闭时仍可编辑和保存 |
| Directory style | `full/home/project-relative/basename`；Left/Right 循环 |
| Separator style | `classic/compact`；Left/Right 循环 |
| Padding | `0–32`；Left/Right 增减 1；数字键进入编辑 |
| Refresh interval | `event` 或 `1–3600`；Left/Right 在 `event, 1, 2, 5, 10, 30, 60, 300, 600, 3600` 间循环，`e` 设为 event，数字键进入编辑 |
| Built-in Vim indicator | `show/hide`；Space 或 Left/Right 切换，并映射到 `hideVimModeIndicator` |
| Scope labels | `off/when-subagents/always`；Left/Right 循环 |
| Custom subagent rows | `on/off`；Space 或 Left/Right 切换 |

当前刷新值若不在预设中，会按数值位置临时加入循环，不会仅因打开界面而改变。数字编辑时，第一个数字建立新缓冲区，后续数字追加，Backspace 删除；Enter 校验并接受字段值但不保存整个界面，再按一次 Enter 才全局保存。非法或越界值会保留编辑状态并显示内联错误；Esc 先取消数字编辑并恢复原字段值。

预览使用固定样例值并复用生产 renderer。Main 与 Settings 页模拟“当前 prompt 曾启动子 Agent”，因此可预览条件范围标签；Subagents 页固定显示一条 running 和一条 completed 样例。预览不会读取当前 Claude payload，不会扫描 Git 或 transcript，不会访问网络，也不会创建 token、Git、timer 运行状态或缓存。预览最多占 5 行、至少占 2 行，溢出时最后一行显示剩余行数；padding 会显示为主栏左侧空格并从内容宽度扣除。256 色终端会把 RGB 映射到最近的 xterm-256 色，8/16 色终端降级到基础色，无颜色终端保留文本。

保存前会检查编辑期间的外部修改，冲突时拒绝写入。无变化不创建备份；修改会统一保存，并在失败时尝试回滚。详见[配置写入与并发](#配置写入与并发)。

Esc 退出后 stdout 输出 `Status line configuration unchanged.`，退出码为 0。参数、TTY、配置、安装归属、终端初始化或并发冲突错误返回 2 且不显示 traceback。程序只注册当前平台实际提供的信号；Linux/macOS 的 SIGHUP/SIGTERM 和 Windows 可用的中断路径都会先恢复终端，再返回标准中断结果。

独立 TUI 没有自动超时；实验性启动入口的超时规则见[实验入口](#实验入口-statusline-configure)。

## `/statusline-config` 问答向导

安装完成后，在 Claude Code 中输入：

```text
/statusline-config
```

该命令会启动英文多选问答向导，依次询问：

- Identity / Repo：模型、当前目录、项目名、本机名和 Git。
- Context：上下文剩余百分比、已用百分比和窗口大小。
- Limits：5 小时、每周和 spend 限额。
- Usage：token 统计、prompt 计时器、cost 和 prompt-cache。
- Session：Claude Code 版本和会话名称/ID。
- Modes：fast mode、agent、vim mode 和 thinking 指示器。
- Repository：当前分支的 open PR/MR、worktree 名称和远程仓库 `owner/name`。
- Subagents：子 Agent 行的条目集合与顺序。
- 自定义子 Agent 行开关，以及 `off/when-subagents/always` 范围标签。
- 颜色、palette、目录格式、分隔符、padding、刷新间隔和 Vim 指示器。

Session、Modes、Repository 组的条目以及 `project-name`、`hostname`、`context-used`、`cost`、`prompt-cache` 默认禁用；在向导中勾选即启用。

向导会保留仍然启用的条目的相对顺序，并按默认目录顺序把新启用的条目追加到末尾。完成全部选择后，它只调用一次原子 `config apply`；中途取消不会写入任何配置。

这个向导使用 Claude Code 提供的问答组件，不会启动 curses，也不是 Claude Code 原生嵌入式状态栏弹窗。需要 Space 勾选、方向键排序和实时预览时，使用[独立 TUI](#独立交互式-tui)；需要脚本化排序时，使用 `order` 子命令。

例如，先把状态栏缩减到五项，再精确排序：

```text
/statusline-config set-items model-with-effort current-dir git context-remaining prompt-timer
/statusline-config order model-with-effort git current-dir context-remaining prompt-timer
```

随时检查当前有效配置：

```text
/statusline-config show
```

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

### 显示项目、本机和两种上下文百分比

```bash
claude-statusline config enable project-name hostname context-used
```

保留默认上下文条目时会同时显示 `Context N% left`、`Context N% used` 和窗口大小；如只需要其中一种，可独立 `disable context-remaining` 或 `disable context-used`。

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

## 实验入口 `/statusline-configure`

该入口需要 Claude Code 2.1.258+，首次安装默认关闭。启用后在 Claude Code 输入 `/statusline-configure`，即可启动与独立命令相同的 TUI。

### 启用与关闭

实验入口首次安装默认关闭，必须显式启用：

Linux / WSL / macOS 预览：

```bash
claude-statusline install --experimental-slash-tui
```

Windows PowerShell：

```powershell
claude-statusline.exe install --experimental-slash-tui
```

启用偏好保存在 `<CLAUDE_CONFIG_DIR>/claude-statusline-features.json`，卸载 Python 包或运行 `uninstall` 后仍保留。兼容版本上再次运行普通 `install` 会自动恢复入口。永久关闭并删除本工具拥有的活动 skill/hook：

Linux / WSL / macOS 预览：

```bash
claude-statusline install --no-experimental-slash-tui
```

Windows PowerShell：

```powershell
claude-statusline.exe install --no-experimental-slash-tui
```

两个参数互斥，都不传时保留此前偏好。它们都可与 `--dry-run`、`--force` 组合；`--dry-run` 不创建 feature、skill、runtime 或备份目录。显式启用要求可识别的 Claude Code 2.1.258 或更高版本，否则整个操作在写文件前失败。

### 使用方式

```text
/statusline-configure
```

- Linux 优先在当前 tmux 中打开弹窗；tmux 不可用时尝试 GNOME Terminal 新标签页。
- macOS 预览仅在有效 tmux 会话中打开 popup；先在 tmux 中启动 Claude。
- Windows 打开由系统默认终端承载的新控制台。
- Linux 两种启动方式均不可用，或 macOS 没有有效 tmux 时，会提示在真实终端运行 `claude-statusline configure`，或改用 `/statusline-config`。
- TUI 在 570 秒后自动取消且不保存；保存、取消或错误会返回到原 Claude 对话。

该入口只接受空参数；`help`、`-h`、`--help` 返回用法，其他参数会被拒绝。它通过外部终端承载 TUI。启动选择、结果回传及 hooks 被禁用时的处理见[实验启动器与结果回传](#实验启动器与结果回传)。

## `/statusline-config` 的执行方式

无参数和带参数的调用使用不同路径：

| 调用方式 | Claude Code 2.1.258+ | 较旧版本或版本无法识别时 |
| --- | --- | --- |
| `/statusline-config` | 进入 skill，由 Claude 驱动问答向导 | 相同 |
| `/statusline-config show` 等带参数命令 | 由本地 hook 直接执行，阻止 prompt 进入模型 | 由 skill 在一个 Claude 回合中执行相同 CLI |

带参数的本地快路径是确定性的：它只解析本文档列出的配置命令，输出结果后终止这次 slash command 展开。未知参数会显示错误或用法，且不会修改配置。

Windows 使用 `claude-statusline.exe config ...`。skill 的命令权限和平台执行方式见[平台执行与文件安全](#平台执行与文件安全)。

Claude Code 升级或降级跨过 2.1.258 时，重新运行：

```bash
claude-statusline install
claude-statusline doctor
```

安装器会据当前版本增加或移除本地快捷 hook。版本降级只影响带参数命令是否需要模型回合，不影响配置功能本身。

> 不要使用 Claude Code 内建的 `/statusline` 来重新生成本工具的脚本。内建命令可能把 `settings.json` 中的 `statusLine.command` 替换为另一个实现。配置本工具请使用 `/statusline-config`。

## CLI 总览

```text
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
claude-statusline config [--config-dir PATH] reset
claude-statusline install [--dry-run] [--force]
  [--experimental-slash-tui | --no-experimental-slash-tui]
  [--config-dir PATH]
claude-statusline uninstall [--dry-run] [--config-dir PATH]
claude-statusline doctor [--config-dir PATH]
claude-statusline --version
```

Windows PowerShell 中把命令名替换为 `claude-statusline.exe`；参数和输出格式相同。上面的方括号和省略号是语法记号，不是要原样输入的参数。供 Claude Code 调用的命令见[内部命令附录](#附录内部命令)。

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

显示当前**有效配置**，包括显示配置、Claude Code 宿主配置、配置文件路径、当前 `statusLine.command` 是否属于这个可执行文件，以及子 Agent 行的 期望启用状态（enabled）、installed 和所有权状态。

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
Scope labels: when-subagents
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
- `default_enabled`：默认是否启用。默认启用的 10 个条目为 `true`；`project-name`、`hostname`、`context-used`、`version`、`session`、`cost`、`prompt-cache`、`fast-mode`、`agent`、`vim-mode`、`thinking`、`pr`、`worktree`、`repo` 为 `false`（opt-in）。
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
```

显示选项可以在安装 statusline 之前预先配置。宿主选项 `padding`、`refresh-interval` 和 `hide-vim-mode-indicator` 会修改 `settings.json/statusLine`，因此只在当前 statusline 已由这个 `claude-statusline` 可执行文件接管时允许修改。否则命令会拒绝写入，避免误改其他 statusline。

`subagent-statusline` 保存期望的启用状态。已有 owned renderer 时关闭会立即返回空 content；重跑 `install` 会进一步移除 owned `subagentStatusLine`，打开则在兼容版本上恢复它。这个分离使 `config set subagent-statusline off` 可以在不触碰第三方设置的前提下解除安装冲突。

所有 `set` 的合法值见[显示与宿主选项](#显示与宿主选项)。

### `config apply`

一次提交完整的显示配置和宿主配置。无参数向导在收集完全部答案后使用该命令；也可以用于脚本化部署：

Linux / WSL（Bash）：

```bash
claude-statusline config apply \
  --items model-with-effort current-dir git context-remaining prompt-timer \
  --subagent-items status-elapsed name model-with-effort context-remaining task \
  --subagent-statusline on \
  --scope-labels when-subagents \
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
  --items model-with-effort current-dir git context-remaining prompt-timer `
  --subagent-items status-elapsed name model-with-effort context-remaining task `
  --subagent-statusline on `
  --scope-labels when-subagents `
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
| `git` | `Git ` 前缀 + 分支、上游差异和工作树变更，如原生 Linux/macOS 的 `Git main ↑1● 2` 或 Windows/WSL 的 `Git main ↑1●2` | 非 Git 目录时省略；Git 查询异常时显示 `Git!` |
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
| `session` | `Session ` 前缀 + 会话名称（`/rename` 设置后），否则会话 ID 前 8 位，如 `Session explain prompt-cache` | 没有会话 ID 时省略 |
| `cost` | 会话金额、API 时长与增删行数，例如 `Total $0.12 · 12m 30s · +156/-23`；金额恒显示（无数据时为 `Total $0.00`），时长为 0 或增删行均为 0 时省略对应部分 | 没有 cost 字段时省略 |
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

### Prompt 计时标记

| 标记 | 含义 |
| --- | --- |
| `⏱` | prompt 正在运行，时间持续增长 |
| `✓` | prompt 正常完成 |
| `■` | prompt 被中断或会话结束 |
| `✗` | Claude Code 报告执行失败 |
| `?` | 上一次运行没有可确认的结束事件；时间后会带 `+` |

子 Agent 会话增加两个运行阶段：

```text
⏱ 4m 12s
⏳ 2 agents · 4m 12s
⏳ main wrap-up · 4m 12s
✓ 4m 35s
```

计时始终从最早的用户提交证据开始，到主 Agent 最终 `Stop` 为止。主 Agent 首次 `Stop` 若仍有普通 subagent task，就进入等待；最后一个 Agent 结束后进入 `main wrap-up`，不会因 registry idle、transcript duration 或超时自行完成。后台 shell、server、monitor 和 workflow 不进入 Agent ledger。最终 `Stop` 缺失时保持运行；`StopFailure`、用户中断和 `SessionEnd` 仍立即产生终态。

`/statusline-config show` 之类的本地快捷命令不会被当作新的计时 prompt。即使隐藏 `tokens` 但保留 `prompt-timer`，计时器仍会读取所需 transcript 状态并正常工作。

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

宽度直接使用 payload 中的正整数 `columns`，无效时回退 80，不扣主栏 margin。输入文本中的换行、制表符和控制字符会被清理。超宽时先截断任务文本，再按 `current-dir → tokens → context-used → context-remaining → model-with-effort → task` 删除可选段；`status` 与 `status-elapsed` 始终保留（启用 `status` 时 `name`、`elapsed` 也最后保留），极窄时 `status-elapsed` 退化为只显示状态图标。ASCII、CJK、emoji、组合字符和 ANSI 路径都保证可见宽度不超过 `columns` 且不换行。

三种作用域必须区分：

- 全局底栏属于主 Agent；`scope-labels=when-subagents` 在当前 prompt 曾启动子 Agent 后前置固定的 `Main/Session`。
- 主栏 `tokens` 是 session 累计，继续包含可发现的主与子 Agent transcript。
- 每个官方子 Agent 行只描述自己的 task，并只使用 `tasks[]` 字段。

Claude Code 没有提供 `focused_agent` 或 `viewing_task_id`。切到子 Agent transcript 后，最底部全局栏不会读取或猜测当前焦点，也不会通过 transcript mtime、进程内存或键盘事件推断；`Main/Session` 正是对这一边界的明确标注。

## 显示与宿主选项

| OPTION | VALUE | 默认值 | 说明 |
| --- | --- | --- | --- |
| `colors` | `on`、`off` | `on` | 是否输出 ANSI 颜色控制码 |
| `palette` | `default`、`ansi` | `default` | `default` 使用项目的 24 位 RGB 色值；`ansi` 使用标准终端色 |
| `directory-style` | `full`、`home`、`project-relative`、`basename` | `full` | 工作目录的缩写方式 |
| `separator-style` | `classic`、`compact` | `classic` | 顶层条目的分隔方式 |
| `scope-labels` | `off`、`when-subagents`、`always` | `when-subagents` | 主栏是否前置固定的 `Main/Session` |
| `subagent-statusline` | `on`、`off` | `on` | 是否希望安装并渲染自定义子 Agent 行 |
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
<CLAUDE_CONFIG_DIR>/claude-statusline.json
```

默认配置等价于：

```json
{
  "schema_version": 2,
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
    ]
  }
}
```

这是严格 JSON：不接受注释、尾随逗号、未知字段、缺失字段、未知条目或重复条目。建议使用配置命令修改，而不是手工编辑。

上例中的 10 个条目是默认启用集合。`project-name`、`hostname`、`context-used`、`version`、`session`、`cost`、`prompt-cache`、`fast-mode`、`agent`、`vim-mode`、`thinking`、`pr`、`worktree`、`repo` 是可选条目，默认不包含在内；使用 `config enable` 或在向导中勾选后才会写入 `items`。

配置更新会备份修改前的内容，并通过原子替换与文件锁保护写入；详见[备份与回滚](#备份与回滚)及[配置写入与并发](#配置写入与并发)。

当前显示配置使用 schema v2；历史 schema v1 可读取，首次实际配置保存时会备份并写为 v2。版本转换与降级恢复见[版本兼容](#版本兼容)。

如果显示配置损坏：

- 两个 renderer 都会静默回退到内建默认显示，避免破坏 Claude Code 主界面。
- `config show`、普通配置写命令和 `doctor` 会明确报告错误。
- `config reset` 可以删除损坏配置并恢复默认值。

`items: []` 是合法配置，表示主栏不输出内容；即使范围标签为 `always`，也不会单独制造空主栏。`subagents.items: []` 同样合法，表示每个有效子任务返回空 content。

### 实验功能偏好

`/statusline-configure` 的持久偏好保存在：

```text
<CLAUDE_CONFIG_DIR>/claude-statusline-features.json
```

文件不存在表示关闭；启用时内容固定为：

```json
{
  "schema_version": 1,
  "experimental_slash_tui": true
}
```

该文件使用严格 schema；Linux/macOS 权限为 `0600`，Windows 使用继承 ACL。布尔值 `false` 也会按关闭状态读取，但本工具的关闭命令会直接删除文件。普通 `install` 遇到未知字段、缺失字段、错误类型、未知 schema 或损坏 JSON 时拒绝修改；显式 `--experimental-slash-tui` 会先备份再修复，显式 `--no-experimental-slash-tui` 会先备份再删除。

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

## 升级

先选择目标版本的包，再同步 Claude Code 接入。下面分别给出稳定版 v1.0.0 和预览版 v1.1.0a1 的入口；macOS 需选择预览版。以后升级时将版本标签和 wheel 文件名一起替换为已发布的目标版本。

### 替换 Python 包

以下来源任选一种。Release URL 与 Git URL 命令在 Bash / PowerShell 中通用。

**稳定版 Release URL（Linux / WSL / Windows）：**

```text
pipx install --force "https://github.com/fbincon/claude-code-statusline/releases/download/v1.0.0/claude_code_statusline-1.0.0-py3-none-any.whl"
```

**预览版 Release URL（含 macOS）：**

```text
pipx install --force "https://github.com/fbincon/claude-code-statusline/releases/download/v1.1.0a1/claude_code_statusline-1.1.0a1-py3-none-any.whl"
```

**本地 wheel：** 从 Release 下载目标 wheel 后，在下载目录执行。以下以稳定版为例；预览版把文件名中的 `1.0.0` 替换为 `1.1.0a1`。

```bash
pipx install --force ./claude_code_statusline-1.0.0-py3-none-any.whl
```

Windows PowerShell：

```powershell
pipx install --force .\claude_code_statusline-1.0.0-py3-none-any.whl
```

自行构建的 wheel 位于项目的 `dist/` 下，相应使用 `dist/文件名.whl` 或 `.\dist\文件名.whl`。

**固定标签源码：**

```text
pipx install --force "git+https://github.com/fbincon/claude-code-statusline.git@v1.0.0"
```

预览版把标签改为 `@v1.1.0a1`。跟踪默认分支时使用不带版本标签的 Git URL；升级本地源码时，先更新源码，再在项目根目录执行 `pipx install --force .`。这些来源获取的是相应分支或目录中的代码。

### 同步 Claude Code 接入

Linux / WSL / macOS 预览：

```bash
claude-statusline install
claude-statusline doctor
claude-statusline config show
```

Windows PowerShell：

```powershell
claude-statusline.exe install
claude-statusline.exe doctor
claude-statusline.exe config show
```

必须重新运行 `install`，以同步 skill 模板、命令路径、hooks 和版本兼容设置；重复执行不会重复添加 hooks。显示偏好、实验功能偏好、token 汇总、Git 缓存和逐轮计时状态位于 Claude 配置目录，不会随 Python 包升级而删除。

### 版本兼容

显示配置格式与实验功能偏好格式各自独立：当前分别为 schema v2 和 schema v1。升级到本工具 1.0.0 或 1.1.0a1 不新增配置格式转换；已有 schema v2 文件可继续使用。对于更早版本留下的 schema v1 显示配置，适用以下规则：

schema v1 仍可读取：原有主 items、顺序、颜色、palette、目录和分隔符保持不变，内存中补齐 v2 默认字段。单纯 `render`、`render-subagents`、`doctor` 或 `install` 不重写 v1；第一次真实配置保存会在同一事务中备份原字节，并写出 规范的 schema v2。schema v2 严格拒绝未知/缺失字段、重复条目和错误类型，高于 v2 的 schema 拒绝读取。降级到 0.5.0 时旧程序会回退默认显示；要继续编辑旧 schema，需恢复升级前备份。

Claude Code 的功能门槛独立于本工具版本：

如果已启用实验入口后将 Claude Code 降级到 2.1.258 以下，或暂时无法识别其版本，普通 `install` 会保留偏好、移除活动入口并将其暂挂；升级后再次运行 `install` 即恢复。跨过该版本阈值后应始终运行 `install` 和 `doctor`。

子 Agent 支持使用独立的 2.1.205 版本门槛。2.1.205–2.1.213 缺少 per-task effort 时只省略 effort，2.1.214+ 显示完整模型/effort。跨过 2.1.205 升级或降级时也应重跑 `install`：降级会只移除本工具拥有的 `subagentStatusLine` 和两个子 Agent hooks，升级会按 `subagents.enabled` 自动恢复。

带参数 `/statusline-config` 的本地 hook 以 Claude Code 2.1.258 为门槛，重跑 `install` 后按版本增加或移除。低于该版本时由 skill 在模型回合中执行配置命令。历史功能变更见[变更记录](../CHANGELOG.md)。

## 卸载

先移除本工具写入 Claude Code 的配置，再卸载 pipx 包：

```bash
claude-statusline uninstall
pipx uninstall claude-code-statusline
```

Windows PowerShell：

```powershell
claude-statusline.exe uninstall
pipx uninstall claude-code-statusline
```

可以先预览：

```bash
claude-statusline uninstall --dry-run
```

Windows 对应命令为 `claude-statusline.exe uninstall --dry-run`。

卸载器只移除：

- 指向本工具的 `statusLine`。
- 当前或通用命令匹配本工具的 `subagentStatusLine`。
- 本工具的生命周期 hooks 和斜杠命令的本地快捷 hook。
- 本工具拥有的 `/statusline-config`、`/statusline-configure` skill 及所有权标记。

卸载器会保留：

- 其他工具或用户定义的 hooks。
- 第三方 `subagentStatusLine`。
- `claude-statusline.json` 显示偏好。
- `claude-statusline-features.json` 实验启用偏好；之后兼容版本上的普通 `install` 会恢复入口。
- token、Git 和计时运行状态。
- 安装器创建的备份。

因此以后重新安装时可以继续使用原有显示偏好。若要永久关闭实验入口，先运行 `claude-statusline install --no-experimental-slash-tui`。如需彻底清除其他保留数据，请先确认具体文件路径后再手工处理。

## 备份与回滚

安装、卸载和配置更新产生的备份位于：

```text
<CLAUDE_CONFIG_DIR>/backups/statusline/cli-<action>-<timestamp>/
```

只有实际发生修改时才创建备份。一次事务可能同时记录 `settings.json`、`claude-statusline.json`、feature 文件、两个 skill 和所有权标记的修改前内容。

每个备份目录中的 `metadata.json` 记录：

- 产生备份的 action。
- 创建时间。
- 每个原始文件的绝对路径。
- 修改前状态是 `before` 还是 `absent`。

`*.before` 包含修改前的原始字节；`*.absent` 表示修改前该文件不存在。手工回滚前先退出相关 Claude Code 会话，根据 `metadata.json` 把 `*.before` 恢复到对应路径；对于 `absent` 条目，回滚含义是让对应目标恢复为不存在。

正常写入过程中如果后一步失败，工具会自动尝试事务内回滚；备份仍会保留，便于检查。

## `doctor` 诊断

```bash
claude-statusline doctor
```

`doctor` 不改写配置文件；macOS 会尝试同步已有配置父目录以报告文件系统能力。它会检查：

- 当前平台和 Python 版本。
- `claude-statusline` 是否位于 PATH 且可执行；Windows 要求实际 `.exe` 入口。
- Git 是否可用。
- `settings.json` 是否有效及其安全模型；Linux/macOS 检查 POSIX mode，Windows 说明 mode 不适用并依赖继承 ACL。
- `statusLine.command` 和三个宿主字段是否合法。
- 五个主生命周期 hook 是否各自恰好存在一个。
- Claude Code 是否满足 2.1.205 子 Agent 门槛、期望的启用状态、`subagentStatusLine` 是 owned/absent/foreign/unsupported，以及两个子 Agent hook 是否精确去重。
- `/statusline-config` skill 及所有权标记是否正确。
- 实验 feature 文件是否合法；Linux/macOS 检查 `0600`，Windows 不产生伪权限错误。
- `/statusline-configure` 是 `disabled`、`enabled` 还是因版本不兼容而 `suspended`；启用时 skill、owner marker、唯一 matcher 和 600 秒 hook 是否完整。
- Linux 启用实验入口时是否至少安装了 tmux 或 GNOME Terminal；macOS 是否安装 tmux；Windows 是否具备系统新控制台能力。
- macOS 预览架构、系统版本、curses、进程启动标识、包含睡眠时间的时钟与父目录同步能力；不可用的进程、时钟或目录同步以 WARN 说明降级。
- Windows 的 `windows-curses` 后端、x86/x64 架构契约与系统新控制台启动器。
- 显示配置 JSON、schema v1 可迁移状态及其权限是否正确。
- 当前 Claude Code 版本是否应安装斜杠命令的本地快捷 hook。
- 运行状态目录是否可写。

诊断级别与退出码：

- `[OK]`：检查通过。
- `[WARN]`：功能可继续使用，但存在降级，例如缺少 Git，或旧版 Claude Code 只能由模型回合执行配置命令。只有 WARN 时退出码仍为 0。
- `[ERROR]`：安装或配置不完整；只要存在 ERROR，`doctor` 的退出码就是 1。

一般修复流程：

```bash
claude-statusline install
claude-statusline doctor
```

如果 `install` 报告冲突，先检查它指出的现有配置；只有确认替换符合预期后才加 `--force`。

## 故障排查

### 状态栏不显示

1. 运行 `claude-statusline doctor`。
2. 确认 `claude-statusline` 位于 PATH。
3. 确认没有通过 `config set-items` 把 `items` 设为空。
4. 查看 `settings.json` 中是否存在指向本工具的 `statusLine.command`。
5. 如果 Claude Code 提示 statusline 因 trust 被跳过，重启 Claude Code 并接受对应信任提示。
6. 检查是否启用了会统一禁用 hooks/statusline 的 Claude Code 设置。

### 子 Agent 行不显示或发生所有权冲突

先运行 `claude --version` 和 `claude-statusline doctor`。Claude Code 低于 2.1.205 或版本不可识别时，主栏可用但子 Agent 设置/hooks 会暂挂；升级并重跑 `claude-statusline install`。如果 `doctor` 报告 `foreign`，选择其一：

```bash
# 明确接管第三方子 Agent 行
claude-statusline install --force

# 保留第三方实现，只关闭本工具的自定义行目标
claude-statusline config set subagent-statusline off
claude-statusline install
```

若 `subagents.items` 为空或 `subagents.enabled` 为 false，本工具的 renderer 会按协议返回空 content。进入子 Agent transcript 后底部全局栏仍属于主 Agent/session，这是 Claude 未提供当前焦点 ID 的既定边界。

### `/statusline-config` 不可见

```bash
claude-statusline install
claude-statusline doctor
```

确认 doctor 中 `/statusline-config skill` 为 OK。若安装是在当前 Claude Code 会话启动后完成，可新开一个会话再次检查命令发现情况。

### `/statusline-configure` 不可见或显示 suspended

先确认已经显式启用，并同步当前 Claude Code 版本：

```bash
claude --version
claude-statusline install --experimental-slash-tui
claude-statusline doctor
```

版本低于 2.1.258 或无法识别时，显式启用会在写入前失败。已启用后发生降级时，普通 `install` 保留偏好但暂挂并移除活动 skill/hook，所以 slash 菜单中不会显示该命令。升级到兼容版本后重新运行普通 `install`，再新开 Claude Code 会话。

### 实验入口无法打开新终端

tmux 路径要求 hook 环境中同时存在有效的 `TMUX`、形如 `%<数字>` 的 `TMUX_PANE`，且 2 秒预检查 能访问目标 server/pane。Linux 目标失效时会尝试 GNOME；macOS 不选择 GNOME，直接提示独立命令。若已成功选择 tmux，popup 内失败不会二次启动其他终端。

GNOME 路径要求 `DISPLAY` 或 `WAYLAND_DISPLAY`、可执行的 `gnome-terminal` 和可用的用户 D-Bus/图形会话。D-Bus 启动错误会作为短错误返回原 Claude 对话。Linux 两种启动器都不可用，或 macOS 没有有效 tmux 时，直接在终端运行：

```bash
claude-statusline configure
```

Windows 使用系统默认终端承载 `CREATE_NEW_CONSOLE`。若关窗、子进程异常退出或未生成可信结果，原对话会立即收到错误；直接排查时在 PowerShell 中运行 `claude-statusline.exe configure`。确认 `doctor` 的 `windows-curses backend` 与 `Windows system new-console launcher` 均为 OK。

若 hook 在 600 秒结束，TUI 通常应已在 570 秒自行超时。检查 `<CLAUDE_CONFIG_DIR>/statusline_runtime/slash_tui/` 时，不要手工跟随或删除不明符号链接；工具只自动清理超过 24 小时、符合自身命名前缀且不含符号链接的残留。

若启用了 `disableAllHooks`，本地启动器不会运行。回退 skill 会提示这一点，并禁止 Bash/PowerShell 自行启动 curses；该例外可能产生一个极短模型回合。重新启用 hooks 后新开会话再试。

### 带参数的 slash 命令仍进入模型

这通常表示 Claude Code 版本低于 2.1.258、版本无法识别，或本地快捷 hook 未同步。检查：

```bash
claude --version
claude-statusline doctor
claude-statusline install
```

旧版由模型回合执行配置命令是预期的兼容行为，不会改变命令语义。

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

### Git 信息缺失或显示 `Git!`

Linux / WSL：

```bash
command -v git
git -C /path/to/project status --porcelain=v2 --branch --ahead-behind
```

Windows PowerShell：

```powershell
Get-Command git
git -C 'C:\Path With Spaces\project' status --porcelain=v2 --branch --ahead-behind
```

非 Git 目录不显示 Git 项是正常行为。`Git!` 表示 Git 调用缺失、超时或结果无法解析。禁用 `git` 后 renderer 不再执行 Git 查询：

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
- `130`：交互式 TUI 收到 Ctrl+C/SIGINT，终端已恢复且配置未保存。
- `128 + signal`：交互式 TUI 收到当前平台实际提供的终止信号，终端已恢复且配置未保存。

高频内部命令 `render`、`render-subagents`、`hook` 和 `slash-hook` 对损坏或无关输入采用静默容错，避免自身错误阻塞 Claude Code。

## 当前边界

- 支持 Linux/WSL Python 3.10+，以及 Windows 10/11 上 CPython 3.10–3.14 x86/x64；macOS 为 v1.1.0a1 中的预览支持，CI 覆盖 15/26、Intel / Apple Silicon 和 Python 3.10/3.14。
- macOS 其他系统版本、实际 Claude 视觉效果、真实睡眠恢复和桌面终端体验尚未人工验收；Terminal.app / iTerm2 自动启动不在本次预览范围内。
- Windows ARM64 原生 Python 暂不承诺；ARM 设备使用 x64 Python 仿真。
- 配置仅为用户全局，不提供项目级配置。
- 除本地 `socket.gethostname()` 提供的可选 hostname 外，不增加 Claude Code payload、本地 Git 和 transcript 之外的新指标。
- 不跟随 Claude Code `/theme`；`default` palette 使用本项目固定 RGB 色值。
- 不提供 Claude Code 原生 TUI 扩展；Linux 实验入口使用 tmux/GNOME，macOS 仅使用 tmux，Windows 使用系统新控制台，并复用同一独立 TUI。
- Linux/macOS 不访问 `/dev/tty`；三个平台都不向 Claude pane 写 CSI/alternate-screen 序列，不绕过 hook stdio，不缓存当前会话 payload，也不持久化禁用条目的排序。
- 不承诺在 IDE、`claude -p`、远程 Web、全局禁用 hooks，或平台所列启动器之外的终端环境 中打开实验 TUI。
- 不提供鼠标、拖拽或自定义键位。
- 计时完成判定只纳入普通 Agent 类 task 的生命周期；后台 shell、server、monitor、workflow 和 agent-team 专用账本不纳入完成阻塞。
- 不提供 per-agent 历史账本、Git、cache hit/miss/out 或 session 聚合；子 Agent 行只显示 Claude 当前 payload。
- 不猜测当前焦点 Agent；全局底栏始终是主 Agent/session 范围。

## 附录：开发与测试

### 准备开发环境

先克隆仓库并进入项目根目录（Bash / PowerShell 通用）：

```text
git clone https://github.com/fbincon/claude-code-statusline.git
cd claude-code-statusline
```

已有源码时直接进入项目根目录。开发环境与 pipx 的用户安装相互独立。

Linux / WSL：

```bash
python3 -m venv .venv-dev
source .venv-dev/bin/activate
python -m pip install -e . ruff build
```

Windows PowerShell（使用已安装的受支持 Python；此处以 3.10 为例）：

```powershell
py -3.10 -m venv .venv-dev
.\.venv-dev\Scripts\python.exe -m pip install -e . ruff build
```

### 运行检查

Linux / WSL 在已激活的开发环境中执行：

```bash
python -m unittest discover -s tests -v
python -m ruff check --select F,E9 src tests
python -m build
```

Windows PowerShell 直接使用虚拟环境的解释器，无需执行激活脚本：

```powershell
.\.venv-dev\Scripts\python.exe -m unittest discover -s tests -v
.\.venv-dev\Scripts\python.exe -m ruff check --select F,E9 src tests
.\.venv-dev\Scripts\python.exe -m build
```

GitHub Actions 保留 `ubuntu-latest`、`windows-latest`，并增加 `macos-15-intel`、`macos-15`、`macos-26-intel`、`macos-26`，均覆盖 Python 3.10/3.14；显式选择原生架构，ARM64 的 3.10 固定为 3.10.11。Windows 检查 `windows-curses` 并执行 PowerShell/Git Bash smoke；Linux/macOS 准备 tmux，实际执行 PTY/popup 集成和安装包 CLI smoke。macOS 检查原生进程、时钟与跨进程重启标识。POSIX 任务上传包含实际系统、架构、Python 版本和 smoke 结果的 `validation-*` JSON artifact。独立构建任务检查版本、macOS classifier、条件依赖、两个 skill 模板与平台模块是否进入分发包。

### 从源码构建与安装

在项目根目录执行；如果只需要构建包，可使用独立构建环境。

Linux / WSL / macOS 预览：

```bash
python3 -m venv .venv-build
source .venv-build/bin/activate
python -m pip install --upgrade build
python -m build
pipx install dist/claude_code_statusline-1.1.0a1-py3-none-any.whl
pipx ensurepath
```

Windows PowerShell：

```powershell
py -3.10 -m venv .venv-build
.\.venv-build\Scripts\python.exe -m pip install --upgrade build
.\.venv-build\Scripts\python.exe -m build
pipx install .\dist\claude_code_statusline-1.1.0a1-py3-none-any.whl
pipx ensurepath
```

上述文件名对应当前 1.1.0a1；构建其他版本时使用实际生成的文件名。已有安装按[升级步骤](#升级)替换包。执行 `pipx ensurepath` 后重新打开终端，再完成[接入 Claude Code](#接入-claude-code)。

可在已激活的构建环境中用 `python -m zipfile -l dist/claude_code_statusline-1.1.0a1-py3-none-any.whl` 检查 wheel；Windows 使用 `.\.venv-build\Scripts\python.exe`。确认包含 `_platform.py` 及 `resources/statusline-config/SKILL.md`、`resources/statusline-configure/SKILL.md`。源码包还应包含本指南、发布指南和 `images/` 截图，完整发布步骤见[发布指南](RELEASING.md)。

### 隔离测试与人工验收

自动验收应先对临时 `CLAUDE_CONFIG_DIR` 执行 install dry-run、install、doctor、幂等重装、冲突回滚和 uninstall，绝不触碰真实配置。代码和安装事务通过后，再由用户决定是否把 wheel 安装到真实配置。

真实多 Agent 视觉检查会产生模型费用，工具不会自动发起。用户参与的最终人工验收 应检查：默认由本工具管理的 `subagentStatusLine` 和两个唯一 hooks；无子 Agent 时主栏显示正确；两个不同模型/effort 的并行 Agent 各自显示正确行；主栏计时器 依次显示 Agent 数量和 `main wrap-up`；最终主 `Stop` 冻结完整用时；进入子 Agent transcript 时全局栏只声明 `Main/Session`；最后运行 `doctor`，并确认 `uninstall --dry-run` 只命中本工具拥有的配置。

## 附录：内部命令

以下四个命令主要由 Claude Code 调用，不是日常配置接口：

### `render`

从 stdin 读取 Claude Code statusline JSON，根据当前配置向 stdout 输出一行或多行状态栏文本。无效输入时保持静默，以免错误内容污染 Claude Code UI。

可以使用模拟输入做基础排查。Linux / WSL（按 120 列渲染）：

```bash
printf '%s\n' '{"model":{"id":"test-model"},"effort":{"level":"high"},"workspace":{"current_dir":"/tmp"}}' \
  | COLUMNS=120 claude-statusline render
```

Windows PowerShell：

```powershell
'{"model":{"id":"test-model"},"effort":{"level":"high"},"workspace":{"current_dir":"C:\\demo"}}' | claude-statusline.exe render
```

这些示例会读取当前配置目录中的 `claude-statusline.json`，输出取决于当前启用项。自动化检查应将 `CLAUDE_CONFIG_DIR` 指向临时目录。

### `render-subagents`

从 stdin 读取 Claude Code 官方 `subagentStatusLine` JSON，并把每个有效 task 渲染为一行 `{"id":"...","content":"..."}` NDJSON。顶层 JSON、`tasks` 或单项字段损坏时静默降级且退出码仍为 0；stdout 只包含协议结果，renderer 不扫描 transcript、Git、网络或运行状态。

Linux / WSL：

```bash
printf '%s\n' '{"columns":80,"tasks":[{"id":"demo","name":"Explore","type":"local_agent","status":"running","startTime":1788400000000,"model":"claude-sonnet-5","tokenCount":84000,"contextWindowSize":200000}]}' \
  | claude-statusline render-subagents
```

Windows PowerShell：

```powershell
'{"columns":80,"tasks":[{"id":"demo","name":"Explore","type":"local_agent","status":"running","startTime":1788400000000,"model":"claude-sonnet-5","tokenCount":84000,"contextWindowSize":200000}]}' | claude-statusline.exe render-subagents
```

### `hook`

从 stdin 读取 Claude Code 生命周期事件，静默更新本地 prompt 计时状态。它被设计为即使输入损坏也不阻塞 Claude Code 回合。

### `slash-hook`

从 stdin 读取 `UserPromptExpansion` 事件。它处理名为 `statusline-config` 且带参数的本地快捷命令，也处理已启用的无参数 `statusline-configure` 启动请求。前者无参数时放行给问答 skill；后者一经识别始终输出一个 `decision: "block"` JSON，子进程退出码只转换为结果文本。无关事件和损坏输入会静默放行。

## 附录：实现说明

### 平台执行与文件安全

Linux/macOS 安装器向 Claude Code 设置写入带 POSIX 引号的绝对可执行文件路径。Windows 写入可由 Git Bash 与 PowerShell 执行的命令名，因此必须能从 `PATH` 解析 `claude-statusline.exe`：

```text
claude-statusline.exe render
claude-statusline.exe render-subagents
claude-statusline.exe hook
claude-statusline.exe slash-hook
```

Windows skill 使用 `claude-statusline.exe config ...`，只预授权 `Bash(claude-statusline.exe config *)` 与 `PowerShell(claude-statusline.exe config *)`；Linux/macOS skill 仅预授权安装时绝对路径对应的 Bash 命令。Claude Code 在 Windows 上优先通过 Git Bash、缺失时通过 PowerShell 执行 statusline 命令，所以 settings 中四个内部命令统一使用裸 `.exe`，不写入会被 Git Bash 解释为转义符的反斜杠绝对路径。参见 [Claude Code Statusline 的 Windows 约定](https://code.claude.com/docs/en/statusline)。

Windows 的 NTFS `st_mode` 不是可靠的 POSIX 权限信息，`doctor` 会报告 mode 检查不适用；文件安全依赖用户 Claude 配置目录继承的 Windows ACL。结果回传仍会拒绝符号链接、junction、其他 reparse point、越界路径、非普通文件和超过 16 KiB 的结果。

### 配置写入与并发

配置、token 缓存、Git 缓存与逐轮状态写入使用同目录临时文件、文件 `fsync` 和原子替换。Linux/macOS 应用 `0600/0700`、同步父目录，并使用 `fcntl.flock`；Windows 使用继承的用户 ACL、`msvcrt` 固定字节锁，并对短暂 sharing violation/access denied 做有上限的重试。多个并发配置命令共享同一把跨平台文件锁，避免后写入者丢失先写入者的变更。

macOS 文件系统对父目录同步返回 `EINVAL`、`ENOTSUP/EOPNOTSUPP` 时，保留文件 `fsync` 与原子替换并由 `doctor` 和 CI 报告降级；其他 I/O 或权限错误继续传播。预览不额外调用 `F_FULLFSYNC`。

macOS 的会话进程标识使用 `/bin/ps -o lstart= -p PID`，固定 `LC_ALL=C` 与 `TZ=UTC`，保留输出内部空格；先筛选匹配会话再查询进程，超时 1 秒或查询失败时不信任该注册记录。计时使用 LibSystem 的 `mach_continuous_time()` 与 `mach_timebase_info()` 整数换算，结合 `kern.bootsessionuuid` 检查跨进程重启；任一接口不可用时整组回退墙钟。实际睡眠恢复尚未人工验收。

全局 Enter 只调用一次现有原子配置事务。无变化不会创建备份；有变化时仍使用单次备份、双文件写入与失败回滚。TUI 启动时记录语义基准，保存时在同一安装锁内检查 display、host 和安装归属；编辑期间如被其他进程修改，会在创建备份和写文件前拒绝。`settings.json` 中与 statusline 无关的字段变化不构成冲突，并会基于锁内最新文件合并保留。

### 实验启动器与结果回传

这不是 Claude Code 原生 TUI 扩展，也没有绕过 hook 的终端隔离。Claude Code 2.1.259 的 command hook 在没有控制终端的新 session 中执行，hook 及其子进程不能打开 `/dev/tty`，`terminalSequence` 也不能绘制 curses 界面。因此本工具只把 slash command 用作本地启动器，并在另一个受支持的终端环境 中运行已经存在的 `claude-statusline configure`；状态机、样例预览、并发检测和原子保存没有复制实现。

Linux 启动器按以下顺序选择：

1. `TMUX` 与形如 `%<数字>` 的 `TMUX_PANE` 都有效、`tmux` 可执行，且最长 2 秒的只读预检查 能在当前 server 中解析该 pane 时，在当前客户端打开标题为 `Configure Status Line` 的 `90% × 90%` popup。popup 存在期间 tmux 暂停底层 pane 更新，子进程退出后自动关闭。
2. tmux 不可用或 预检查失败，但存在 `DISPLAY`/`WAYLAND_DISPLAY` 且可执行 `gnome-terminal` 时，在最近使用的 GNOME Terminal 窗口打开活动新标签页；没有现存窗口时 GNOME 可以创建窗口。命令使用 `--wait` 等待标签页中的 TUI 退出。
3. 两者都不可用时阻断 slash expansion，不调用模型，并提示在终端运行 `claude-statusline configure` 或改用 `/statusline-config`。

macOS 仅复用上述第一条 tmux 路径；缺少有效 server/pane 或预检查失败时，直接提示独立命令或配置向导。即使设置了 `DISPLAY` / `WAYLAND_DISPLAY`，也不会选择 GNOME。

Windows 不探测 tmux/GNOME。它使用当前虚拟环境的 `sys.executable -m claude_statusline configure --config-dir ...`，并通过 [`CREATE_NEW_CONSOLE`](https://learn.microsoft.com/en-us/windows/console/creation-of-a-console) 创建实际 Python 子进程；不重定向 stdin/stdout/stderr，使 curses 获得真实控制台。系统当前默认终端负责承载这个新控制台，Windows Terminal 设为默认终端时会自然接管。启动器保留子进程句柄，因此关窗或异常退出会立即返回错误，超时会终止并回收子进程。

只有 tmux popup 接近“同 pane 弹窗”；GNOME 路径明确是新标签页。当前版本不适配 `x-terminal-emulator`、Konsole、Kitty 或 WezTerm。hook payload 的 `cwd` 只有在它是存在的绝对目录时才作为启动目录，否则使用用户 home。启动器不拼接 command 参数或 cwd 到未转义 shell 文本。

`/statusline-configure` 只接受空参数。`help`、`-h`、`--help` 只返回 `Usage: /statusline-configure`；其他参数会被拒绝，均不启动 TUI、不写配置且不调用模型。

每次运行在 Claude 配置目录的 `statusline_runtime/slash_tui/` 下创建一个随机调用目录。Linux/macOS 验证目录 `0700` 和结果 `0600`；Windows 不解释伪 POSIX mode，而是验证精确父子关系、普通文件、16 KiB 上限，并拒绝路径链中的 symlink、junction 和其他 reparse point。读取后只清理本次调用。Linux/macOS 终端 client 的 stdout/stderr 会被 hook 捕获并限长；Windows 新控制台不重定向这些流。

Claude hook timeout 为 600 秒。桥接 TUI 在 570 秒主动超时且不保存，启动器最长等待 585 秒，为结果校验和 hook 返回预留时间。保存、无变化、取消、信号中断、超时和错误都会在原 Claude 对话区显示一条短结果。tmux 一旦选中，即使 popup 内部失败也不会再打开 GNOME 标签页。

如果全局 `disableAllHooks` 等设置阻止本地 hook，回退 skill 只会说明 hook 未运行，并提示独立命令或 `/statusline-config`；它同时禁止通过 Bash 和 PowerShell 启动 curses。此时可能仍消耗一个极短模型回合，这是插件侧无法避免的例外。

## 相关文档

- [项目首页](../README.md)：项目介绍、界面预览和快速安装。
- [Claude Code：Customize your status line](https://code.claude.com/docs/en/statusline)
- [Claude Code：Hooks reference](https://code.claude.com/docs/en/hooks)
- [Claude Code：Automate workflows with hooks](https://code.claude.com/docs/en/hooks-guide)
