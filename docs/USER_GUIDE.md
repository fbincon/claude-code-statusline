# Claude Code Statusline User Guide

**English** | [简体中文](USER_GUIDE.zh-CN.md)

<a id="claude-code-statusline-使用指南"></a>

This guide covers installation, configuration, upgrades, diagnostics, and development. New users can start with the [project README](../README.md); maintainers should follow the [release guide](RELEASING.md).

Configuration applies to all Claude Code projects for the current user. Rendering reads Claude Code input, the local hostname, transcripts, local Git data, and state files; it makes no network requests and consumes no model tokens. The question-based configuration wizard is driven by Claude and uses model turns. See [execution paths](#statusline-config-execution-paths) for commands with arguments.

This guide uses TUI for the terminal user interface and effort for model reasoning intensity. Hook and skill names, commands, and JSON fields retain their original spelling. Generic single-line CLI examples use `claude-statusline`; on Windows, use `claude-statusline.exe`. For Bash examples with line continuations, environment assignments, or pipelines, use the corresponding PowerShell examples on Windows.

`<CLAUDE_CONFIG_DIR>` denotes the Claude configuration directory: the value of the `CLAUDE_CONFIG_DIR` environment variable when set, otherwise `.claude` in the current user's home directory. It is a path placeholder, not a literal command argument. Management commands also accept `--config-dir` to select this directory explicitly.

<a id="文档导航"></a>

## Contents

- [Feature overview](#feature-overview)
- [Requirements](#requirements)
- [Installation and integration](#installation-and-integration)
- [Standalone interactive TUI](#standalone-interactive-tui)
- [`/statusline-config` wizard](#statusline-config-wizard)
- [Configuration recipes](#configuration-recipes)
- [Experimental `/statusline-configure` entry point](#experimental-statusline-configure-entry-point)
- [`/statusline-config` execution paths](#statusline-config-execution-paths)
- [CLI overview](#cli-overview)
- [Configuration command reference](#configuration-command-reference)
- [Configurable display items](#configurable-display-items)
- [Main status line fields](#main-status-line-fields)
- [Subagent rows and the three scopes](#subagent-rows-and-the-three-scopes)
- [Display and host options](#display-and-host-options)
- [Configuration files](#configuration-files)
- [Custom configuration directory and environment variables](#custom-configuration-directory-and-environment-variables)
- [Upgrading](#upgrading)
- [Uninstalling](#uninstalling)
- [Backups and rollback](#backups-and-rollback)
- [`doctor` diagnostics](#doctor-diagnostics)
- [Troubleshooting](#troubleshooting)
- [Exit codes](#exit-codes)
- [Current limitations](#current-limitations)
- [Appendix: development and testing](#appendix-development-and-testing)
- [Appendix: internal commands](#appendix-internal-commands)
- [Appendix: implementation notes](#appendix-implementation-notes)
- [Related documentation](#related-documentation)

<a id="功能概览"></a>

## Feature overview

- Choose which status items to show: 10 defaults and 14 optional items, including project name, hostname, context usage, version, session, cost, prompt-cache, modes, and PR/worktree information.
- Render items in the order specified by the configuration file.
- Use 24-bit RGB colors, terminal ANSI colors, or no colors.
- Show full paths, `~` paths, project-relative paths, or directory basenames.
- Use the classic ` | ` separator or the compact ` · ` separator.
- Configure Claude Code's native padding, timed refresh, and Vim mode indicator.
- On Claude Code 2.1.205+, install the official `subagentStatusLine` by default, giving each subagent its own status, model/effort, context percentage, elapsed time, and task.
- Time the full task with `prompt-timer`, from user submission to the main agent's final `Stop`, including time spent waiting for subagents and main-agent wrap-up.
- Show a fixed `Main/Session` scope label on the main line when the current prompt has launched subagents, distinguishing its measurements from individual subagent rows.
- Use a standalone full-screen TUI to filter, select, reorder, and preview the complete draft after every keystroke.
- Optionally install `/statusline-configure` to launch the same TUI from a tmux popup or GNOME Terminal tab on Linux, a tmux popup or Terminal.app on macOS, or a new system console on Windows.
- Wrap automatically in narrow terminals without truncating long fields; prefer `/` or `\` as break points in long paths.
- Query Git and aggregate transcripts only when needed; hiding the corresponding items avoids unnecessary data collection.
- Use cross-platform file locks, backups, and atomic replacement for installation, configuration, and uninstallation to prevent concurrent writes, lost updates, and partially written configuration.

Example plain-text main status line on native Linux and macOS, with directory style `home` and no subagents launched in the current turn:

```text
claude-model high | ~/code/project | Git main ↑1● 2~1 | Context 73% left · 1M window | 5h 82% left · weekly 64% left | hit 125K · miss 18.4K · out 7.2K | ⏱ 1m 09s
```

Windows and WSL omit the space in the staged marker:

```text
claude-model high | ~/code/project | Git main ↑1●2~1 | Context 73% left · 1M window | 5h 82% left · weekly 64% left | hit 125K · miss 18.4K · out 7.2K | ⏱ 1m 09s
```

Unavailable items are omitted rather than replaced with empty placeholders. For example, a directory outside a Git repository has no branch field, and a rate-limit window not provided by Claude Code is not displayed.

<a id="运行要求"></a>

## Requirements

- Native Linux or WSL with Python 3.10+; native Windows 10/11 with CPython 3.10–3.14, x86/x64; or macOS 14+ with CPython 3.10–3.14, Intel / Apple Silicon.
- Claude Code CLI.
- [`pipx`](https://pipx.pypa.io/latest/how-to/install-pipx.html) for isolated installation of a Release wheel or GitHub source.
- `build`, only when building from source.
- `git` for installation from GitHub source or displaying Git information. It is not needed when installing a Release wheel without displaying Git information.
- tmux or GNOME Terminal on Linux, or tmux or the system Terminal.app on macOS, only for the experimental `/statusline-configure` entry point. Windows uses the system `CREATE_NEW_CONSOLE` facility and needs no additional terminal application.

The current stable release, [v1.2.0](https://github.com/fbincon/claude-code-statusline/releases/tag/v1.2.0), provides the same pure-Python wheel for all these platforms. See [macOS installation and validation boundaries](#macos-installation-and-validation-boundaries) for terminal requirements. Native Windows ARM64 Python is not currently guaranteed; ARM devices can use x64 Python emulation. Windows automatically installs [`windows-curses>=2.4.2`](https://pypi.org/project/windows-curses/) from package metadata.

| Feature | Claude Code version requirement |
| --- | --- |
| Main status line, CLI, standalone TUI, and configuration wizard | Available on older or unrecognized versions; unavailable fields are omitted |
| Individual subagent rows and lifecycle hooks | 2.1.205+; per-task effort requires 2.1.214+ |
| Local execution of `/statusline-config` with arguments, experimental `/statusline-configure` | 2.1.258+ |

After upgrading or downgrading across these feature thresholds, rerun `install` and `doctor`. See [version compatibility](#version-compatibility).

<a id="安装与接入"></a>

## Installation and integration

<a id="安装-python-包"></a>

### Install the Python package

Linux / WSL / macOS / Windows users can choose any of the following methods to install stable v1.2.0. The Release wheel and fixed tag provide the same version; default-branch source changes as development continues.

**Release URL (recommended; Bash / Zsh / PowerShell):**

```text
pipx install "https://github.com/fbincon/claude-code-statusline/releases/download/v1.2.0/claude_code_statusline-1.2.0-py3-none-any.whl"
pipx ensurepath
```

**Download first:** Download the wheel from the [v1.2.0 Release](https://github.com/fbincon/claude-code-statusline/releases/tag/v1.2.0), then run the following from the download directory.

Linux / WSL / macOS (Bash / Zsh):

```bash
pipx install ./claude_code_statusline-1.2.0-py3-none-any.whl
pipx ensurepath
```

Windows (PowerShell):

```powershell
pipx install .\claude_code_statusline-1.2.0-py3-none-any.whl
pipx ensurepath
```

**Verify downloads:** The Release also includes a source distribution and `SHA256SUMS`. Download the wheel, source distribution, and checksum file into the same directory, then run:

```bash
# Linux / WSL
sha256sum -c SHA256SUMS

# macOS
shasum -a 256 -c SHA256SUMS
```

In Windows PowerShell, run the following and compare each digest with its entry in `SHA256SUMS`; hexadecimal letter case does not affect the comparison:

```powershell
Get-FileHash .\claude_code_statusline-1.2.0-py3-none-any.whl -Algorithm SHA256
Get-FileHash .\claude_code_statusline-1.2.0.tar.gz -Algorithm SHA256
Get-Content .\SHA256SUMS
```

If you download only the wheel, verify its digest individually with `sha256sum filename` on Linux / WSL, `shasum -a 256 filename` on macOS, or `Get-FileHash` on Windows.

**Source at a fixed tag (requires Git; Bash / Zsh / PowerShell):**

```text
pipx install "git+https://github.com/fbincon/claude-code-statusline.git@v1.2.0"
pipx ensurepath
```

**Development source:** Use the following for the current default-branch code. This source is not pinned to v1.2.0.

```text
pipx install "git+https://github.com/fbincon/claude-code-statusline.git@main"
pipx ensurepath
```

If you already have a local checkout, run `pipx install .` and `pipx ensurepath` in the project root. To build your own wheel, see [building and installing from source](#build-and-install-from-source).

<a id="macos-安装与验证边界"></a>

### macOS installation and validation boundaries

On macOS 14+, use CPython 3.10–3.14 with `curses`. Intel and Apple Silicon use the same v1.2.0 Release wheel, with no additional macOS Python runtime dependencies. Follow the general installation steps above; for an existing installation, replace the Python package using the [upgrade steps](#upgrading).

Reopen Bash / Zsh, run `claude-statusline --version`, and confirm that it prints `claude-statusline 1.2.0` before proceeding with integration below.

Run `claude-statusline configure` for the standalone interface. After explicitly enabling the experimental entry point, `/statusline-configure` prefers a tmux popup that passes preflight checks; without valid tmux, it uses Terminal.app in a local graphical session. Window closure or retention follows Terminal's preferences. Over SSH or without a graphical session, use the standalone command in the current terminal or the configuration wizard.

See the [project README](../README.md#screenshots) and [image index](images/README.md) for the macOS main status line and all three configuration pages.

**Historical releases:** [v1.1.0a1](https://github.com/fbincon/claude-code-statusline/releases/tag/v1.1.0a1) is the macOS preview, with core functionality, the standalone TUI, and the tmux entry point, but no Terminal.app launcher. The [v1.0.0](https://github.com/fbincon/claude-code-statusline/releases/tag/v1.0.0) wheel, source distribution, and tag do not support macOS. Use the corresponding Release or fixed tag to reproduce historical behavior; use v1.2.0 for everyday installation.

<a id="接入-claude-code"></a>

### Integrate with Claude Code

`pipx install` installs the package and command entry point; `claude-statusline install` integrates it with Claude Code. After `pipx ensurepath`, reopen your terminal before continuing.

Linux / WSL / macOS:

```bash
claude-statusline --version
claude-statusline install --dry-run
claude-statusline install
claude-statusline doctor
```

Windows PowerShell:

```powershell
claude-statusline.exe --version
claude-statusline.exe install --dry-run
claude-statusline.exe install
claude-statusline.exe doctor
```

On Windows, `claude-statusline.exe` must resolve from `PATH`. If the command is not found, check pipx's path configuration first. See [environment variables](#custom-configuration-directory-and-environment-variables) for a custom configuration directory.

<a id="install-会做什么"></a>

### What `install` does

`claude-statusline install`:

1. Installs `statusLine.command` in user-level `settings.json`, pointing to the current `claude-statusline render` executable.
2. Installs `SessionStart`, `UserPromptSubmit`, `Stop`, `StopFailure`, and `SessionEnd` lifecycle hooks to maintain prompt timing state.
3. On Claude Code 2.1.205+, installs `subagentStatusLine` with only `type` and `command`, plus `SubagentStart` and `SubagentStop` hooks. These three entries are suspended on older or unknown versions without affecting the main line.
4. Installs the user-level personal skill at `<CLAUDE_CONFIG_DIR>/skills/statusline-config/SKILL.md`.
5. On Claude Code 2.1.258+, installs a `UserPromptExpansion` hook to execute `/statusline-config` commands with arguments locally.
6. Installs or suspends the experimental `/statusline-configure` skill and 600-second hook according to persistent feature preferences; it is disabled on first installation.
7. Creates backups before actual changes, then writes files atomically.

The installer merges into `settings.json`, preserving unrelated settings and hooks. Repeated `install` calls are idempotent: correct configuration does not result in duplicate hooks or unnecessary backups.

A newly installed `statusLine` refreshes once every 1 second by default. Reinstalling this tool preserves existing valid `padding`, `refreshInterval`, and `hideVimModeIndicator` values.

<a id="安装前预览"></a>

### Preview installation

```bash
claude-statusline install --dry-run
```

`--dry-run` reports whether changes are needed and which files are involved, without writing files or creating backups.

<a id="处理已有-statusline-或同名-skill"></a>

### Handle an existing status line or skill with the same name

If `statusLine` or `subagentStatusLine` belongs to another tool, or a `/statusline-config` or `/statusline-configure` skill lacks this tool's ownership marker, the installer rejects the entire operation before backup or writing. Only use the following when you intend to replace those entries:

```bash
claude-statusline install --force
```

`--force` allows replacement of conflicting main lines, subagent rows, or skills, while still backing up the original files first. To retain a third-party `subagentStatusLine`, run `claude-statusline config set subagent-statusline off` before a normal `install`.

<a id="独立交互式-tui"></a>

## Standalone interactive TUI

Run the stable standalone entry point in a real terminal outside Claude Code:

```bash
claude-statusline configure
claude-statusline configure --config-dir /path/to/claude-config
```

Windows PowerShell uses the same interface:

```powershell
claude-statusline.exe configure
claude-statusline.exe configure --config-dir 'C:\Path With Spaces\Claude 配置'
```

The standalone TUI uses the current terminal. Linux/macOS use Python's standard-library `curses`; Windows uses the conditional dependency `windows-curses>=2.4.2` (PDCurses). All three platforms provide the same Main/Subagents/Settings tabs. Startup requires:

- Both stdin and stdout to be TTYs.
- A terminal capable of initializing curses.
- Valid configuration.
- `statusLine.command` already managed by the current `claude-statusline` executable; otherwise, run `claude-statusline install` first.

The minimum terminal size is `64x18`. Smaller windows show the required and current dimensions and wait for resizing; Esc and Ctrl+C still exit. Resizing recalculates list scrolling, sample-preview height, and wrapping. Windows also supports PDCurses `KEY_RESIZE` behavior.

The interface has Main, Subagents, and Settings tabs, with a fixed footer labeled `Preview (sample data)`. Common global keys:

| Key | Action |
| --- | --- |
| Tab / Shift+Tab | Cycle through Main, Subagents, and Settings; disabled during numeric editing |
| Enter | Save the entire draft at once when not editing a number |
| Esc | Cancel and exit without writing configuration when not editing a number |
| Ctrl+C | Restore the terminal and exit with 130, without saving |

The Main and Subagents pages each maintain their own selection, search, scroll position, enabled items, and order, and support:

| Key | Action |
| --- | --- |
| Space | Toggle the highlighted item without moving it |
| Up / Down | Move the highlight and keep it visible |
| PageUp / PageDown | Scroll by the current content-area height |
| Home / End | Jump to the first or last visible item |
| Left / Right | Move an item earlier or later, without wrapping at the ends |
| Printable characters | Append to a case-insensitive search matching item IDs and descriptions |
| Backspace / Ctrl+U | Delete one search character / clear the search |

Each page starts with the currently enabled items in their existing order, followed by disabled items in catalog order. While filtering, Left/Right moves relative to adjacent visible search results and preserves the relative order of hidden items. With no results, `No matching items` is shown, and toggle/move keys have no effect. Saving writes Main to `items` and Subagents to `subagents.items`; temporary positions of disabled items are not persisted in the schema.

The Settings page contains:

| Setting | Values and controls |
| --- | --- |
| Use colors | `on/off`; toggle with Space or Left/Right |
| Palette | `default/ansi`; cycle with Left/Right; editable and saved even when colors are off |
| Directory style | `full/home/project-relative/basename`; cycle with Left/Right |
| Separator style | `classic/compact`; cycle with Left/Right |
| Padding | `0–32`; change by 1 with Left/Right; number keys start editing |
| Refresh interval | `event` or `1–3600`; Left/Right cycles through `event, 1, 2, 5, 10, 30, 60, 300, 600, 3600`; `e` selects event; number keys start editing |
| Built-in Vim indicator | `show/hide`; toggle with Space or Left/Right; maps to `hideVimModeIndicator` |
| Scope labels | `off/when-subagents/always`; cycle with Left/Right |
| Custom subagent rows | `on/off`; toggle with Space or Left/Right |

A refresh value outside the presets is temporarily inserted at its numeric position in the cycle; opening the interface does not change it. During numeric editing, the first digit starts a new buffer, subsequent digits append, and Backspace deletes. Enter validates and accepts the field without saving the entire interface; a second Enter performs the global save. Invalid or out-of-range values keep editing active and show an inline error. Esc cancels numeric editing and restores the previous field value.

The preview uses fixed samples and the production renderer. Main and Settings simulate a prompt that has launched subagents, allowing conditional scope labels to be previewed. Subagents always shows one running and one completed sample. The preview does not read the current Claude payload, scan Git or transcripts, access the network, or create token, Git, or timer state or caches. It occupies 2–5 lines; on overflow, the last line reports the remaining line count. Padding appears as spaces to the left of the main line and is deducted from available width. On 256-color terminals, RGB maps to the nearest xterm-256 color; 8/16-color terminals use basic colors, and terminals without color retain the text.

Saving checks for external changes made during editing and rejects conflicting writes. No changes means no backup; changes are saved together, with rollback attempted on failure. See [configuration writes and concurrency](#configuration-writes-and-concurrency).

Exiting with Esc prints `Status line configuration unchanged.` to stdout and returns 0. Argument, TTY, configuration, installation ownership, terminal initialization, or concurrency errors return 2 without a traceback. Only signals available on the current platform are registered. SIGHUP/SIGTERM on Linux/macOS and supported Windows interruption paths restore the terminal before returning the standard interruption result.

The standalone TUI has no automatic timeout. See the [experimental entry point](#experimental-statusline-configure-entry-point) for launcher timeouts.

<a id="statusline-config-问答向导"></a>

## `/statusline-config` wizard

After installation, enter the following in Claude Code:

```text
/statusline-config
```

This starts an English multiple-choice wizard asking about:

- Identity / Repo: model, current directory, project name, hostname, and Git.
- Context: remaining percentage, used percentage, and window size.
- Limits: 5-hour, weekly, and spend limits.
- Usage: token statistics, prompt timer, cost, and prompt-cache.
- Session: Claude Code version and session name/ID.
- Modes: fast mode, agent, vim mode, and thinking indicators.
- Repository: the current branch's open PR/MR, worktree name, and remote `owner/name`.
- Subagents: the enabled items and order of subagent rows.
- Whether custom subagent rows are enabled, and `off/when-subagents/always` scope labels.
- Colors, palette, directory format, separator, padding, refresh interval, and Vim indicator.

The Session, Modes, and Repository groups, plus `project-name`, `hostname`, `context-used`, `cost`, and `prompt-cache`, are disabled by default; selecting them in the wizard enables them.

The wizard preserves the relative order of items that remain enabled, then appends newly enabled items in default catalog order. After all choices, it calls atomic `config apply` once; cancelling partway through writes no configuration.

The wizard uses Claude Code's question components. It does not launch curses or provide a native embedded status-line popup. For Space selection, arrow-key reordering, and live previews, use the [standalone TUI](#standalone-interactive-tui). For scripted ordering, use the `order` subcommand.

For example, reduce the status line to five items, then set their exact order:

```text
/statusline-config set-items model-with-effort current-dir git context-remaining prompt-timer
/statusline-config order model-with-effort git current-dir context-remaining prompt-timer
```

Inspect the current effective configuration at any time:

```text
/statusline-config show
```

<a id="常用配置配方"></a>

## Configuration recipes

<a id="精简开发视图"></a>

### Minimal development view

```bash
claude-statusline config set-items model-with-effort current-dir git context-remaining prompt-timer
claude-statusline config set directory-style home
claude-statusline config set separator-style compact
```

<a id="只保留限额与-token"></a>

### Keep only limits and tokens

```bash
claude-statusline config set-items five-hour-limit weekly-limit spend-limit tokens
```

<a id="显示项目本机和两种上下文百分比"></a>

### Show project, hostname, and both context percentages

```bash
claude-statusline config enable project-name hostname context-used
```

Keeping the default context items displays `Context N% left`, `Context N% used`, and window size together. To show only one percentage, independently use `disable context-remaining` or `disable context-used`.

<a id="关闭颜色适配基础终端或日志录制"></a>

### Disable colors for basic terminals or log recording

```bash
claude-statusline config set colors off
```

<a id="使用标准-ansi-色而不是-24-位-rgb"></a>

### Use standard ANSI colors instead of 24-bit RGB

```bash
claude-statusline config set colors on
claude-statusline config set palette ansi
```

<a id="临时隐藏一个条目之后追加恢复"></a>

### Temporarily hide an item and append it again later

```bash
claude-statusline config disable tokens
claude-statusline config enable tokens
```

The second command appends `tokens` to the end rather than restoring its previous position. Use `order` or rerun `set-items` to restore an exact position.

<a id="恢复出厂显示配置但保留安装"></a>

### Reset display defaults while keeping the installation

```bash
claude-statusline config reset
claude-statusline config show
```

<a id="实验入口-statusline-configure"></a>

## Experimental `/statusline-configure` entry point

This entry point requires Claude Code 2.1.258+ and is disabled on first installation. Once enabled, enter `/statusline-configure` in Claude Code to launch the same TUI as the standalone command.

<a id="启用与关闭"></a>

### Enable and disable

The experimental entry point is disabled on first installation and must be explicitly enabled:

Linux / WSL / macOS:

```bash
claude-statusline install --experimental-slash-tui
```

Windows PowerShell:

```powershell
claude-statusline.exe install --experimental-slash-tui
```

The preference is stored in `<CLAUDE_CONFIG_DIR>/claude-statusline-features.json` and survives uninstalling the Python package or running `uninstall`. Running a normal `install` again on a compatible version restores the entry point. To disable it permanently and remove this tool's active skill/hook:

Linux / WSL / macOS:

```bash
claude-statusline install --no-experimental-slash-tui
```

Windows PowerShell:

```powershell
claude-statusline.exe install --no-experimental-slash-tui
```

These two flags are mutually exclusive; omitting both retains the previous preference. Either can be combined with `--dry-run` or `--force`. `--dry-run` creates no feature, skill, runtime, or backup directories. Explicit enabling requires a recognized Claude Code 2.1.258+; otherwise, the whole operation fails before writing files.

<a id="使用方式"></a>

### Usage

```text
/statusline-configure
```

- Linux prefers a popup in the current tmux session; without tmux, it tries a new GNOME Terminal tab.
- macOS prefers a popup in a valid tmux session; otherwise, it uses Terminal.app in a local graphical session. Window handling follows Terminal's preferences.
- Windows opens a new console hosted by the system's default terminal.
- If neither Linux launcher is available, or macOS has neither valid tmux nor the conditions for local Terminal.app, the command suggests running `claude-statusline configure` in a real terminal or using `/statusline-config`.
- The TUI cancels automatically after 570 seconds without saving; save, cancellation, or error results return to the original Claude conversation.

This entry point accepts no arguments. `help`, `-h`, and `--help` return usage; other arguments are rejected. An external terminal hosts the TUI. See [experimental launchers and result bridging](#experimental-launchers-and-result-bridging) for launcher selection, result handling, and behavior when hooks are disabled.

<a id="statusline-config-的执行方式"></a>

## `/statusline-config` execution paths

Calls with and without arguments use different paths:

| Invocation | Claude Code 2.1.258+ | Older or unrecognized version |
| --- | --- | --- |
| `/statusline-config` | Enters the skill; Claude drives the configuration wizard | Same |
| Commands with arguments, such as `/statusline-config show` | Executed directly by a local hook, preventing the prompt from entering the model | The skill runs the same CLI in a Claude turn |

The local path for arguments is deterministic: it parses only the configuration commands documented here, outputs the result, and stops this slash-command expansion. Unknown arguments return an error or usage without modifying configuration.

Windows uses `claude-statusline.exe config ...`. See [platform execution and file safety](#platform-execution-and-file-safety) for skill permissions and execution details.

After upgrading or downgrading Claude Code across 2.1.258, rerun:

```bash
claude-statusline install
claude-statusline doctor
```

The installer adds or removes the local shortcut hook according to the current version. A downgrade changes only whether commands with arguments require a model turn, not the configuration capability itself.

> Do not use Claude Code's built-in `/statusline` to regenerate this tool's script. It may replace `statusLine.command` in `settings.json` with another implementation. Use `/statusline-config` to configure this tool.

<a id="cli-总览"></a>

## CLI overview

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

In Windows PowerShell, replace the command name with `claude-statusline.exe`; arguments and output formats are identical. Brackets and ellipses above indicate syntax, not literal arguments. See the [internal commands appendix](#appendix-internal-commands) for commands called by Claude Code.

View built-in help at any level:

```bash
claude-statusline --help
claude-statusline config --help
claude-statusline config set --help
claude-statusline config apply --help
```

For `config`, `--config-dir` comes before the action:

```bash
claude-statusline config --config-dir /path/to/claude-config show
```

For `configure`, `install`, `uninstall`, and `doctor`, options follow the command directly:

```bash
claude-statusline configure --config-dir /path/to/claude-config
claude-statusline doctor --config-dir /path/to/claude-config
```

<a id="配置命令详解"></a>

## Configuration command reference

For each local CLI command below, you can replace the leading `claude-statusline config` with `/statusline-config` in Claude Code. For example:

```bash
claude-statusline config set colors off
```

is equivalent to:

```text
/statusline-config set colors off
```

### `config show`

Shows the current **effective configuration**: display configuration, Claude Code host configuration, file paths, whether the current executable owns `statusLine.command`, and the desired enabled state, installed state, and ownership of subagent rows.

```bash
claude-statusline config show
```

Example output:

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

Effective configuration does not require a display configuration file to exist on disk: if `claude-statusline.json` has not been created, `show` displays the built-in defaults.

Use JSON output for scripts or automation:

```bash
claude-statusline config show --json
```

The top-level JSON `installed` still indicates only whether `settings.json/statusLine.command` points exactly to the current `claude-statusline render` on PATH, not whether the Python package exists. `subagent_statusline` separately contains `enabled`, `installed`, and `state`; `state` is one of `owned`, `absent`, `foreign`, or `unsupported`.

### `config list-items`

List all supported display items and their current enabled state:

```bash
claude-statusline config list-items
```

`[x]` means enabled and `[ ]` means disabled. The list follows fixed catalog order, not current rendering order; see `Items` in `config show` for rendering order.

Machine-readable output:

```bash
claude-statusline config list-items --json
```

Each JSON item contains:

- `id`: the stable identifier passed to other commands.
- `description`: a description of the display item.
- `default_enabled`: whether it is enabled by default. The 10 default items are `true`; `project-name`, `hostname`, `context-used`, `version`, `session`, `cost`, `prompt-cache`, `fast-mode`, `agent`, `vim-mode`, `thinking`, `pr`, `worktree`, and `repo` are `false` (opt-in).
- `enabled`: whether it is currently enabled.
- `position`: its current zero-based position, or `null` when disabled.

### `config set-items [ITEM...]`

Replace the entire enabled set at once and save argument order as display order:

```bash
claude-statusline config set-items model-with-effort current-dir git prompt-timer
```

All items not listed become disabled. This is useful for defining a minimal status line from scratch.

An empty item list is valid and disables all rendered content:

```bash
claude-statusline config set-items
```

The tool remains installed, with hooks and configuration intact; the renderer simply outputs no status-line text. Restore the display with `enable`, another `set-items`, or `reset`.

Unknown and duplicate items are rejected without writing files:

```bash
# Error: clock is not a supported item
claude-statusline config set-items model-with-effort clock

# Error: git appears twice
claude-statusline config set-items git git
```

### `config enable ITEM...`

Enable one or more items, appending previously disabled items in argument order:

```bash
claude-statusline config enable tokens prompt-timer
```

Already enabled items are neither duplicated nor moved. Use `enable` for incremental additions, not reordering.

### `config disable ITEM...`

Disable one or more items, preserving the relative order of the remaining items:

```bash
claude-statusline config disable spend-limit tokens
```

Disabling a valid item that is already disabled is idempotent and does not affect other items.

### `config order [ITEM...]`

Change only the order, retaining the enabled set:

```bash
claude-statusline config order git current-dir model-with-effort prompt-timer
```

Arguments must contain every currently enabled item exactly once. Missing or extra items, currently disabled items, and duplicates all cause failure.

Inspect the current set before reordering:

```bash
claude-statusline config show
claude-statusline config order model-with-effort git current-dir context-remaining prompt-timer
```

An empty `config order` argument list is valid only when the enabled set is empty:

```bash
claude-statusline config order
```

### `config subagents ...`

Subagent rows have independent item commands with the same semantics as the main line's `list-items`, `set-items`, `enable`, `disable`, and `order`:

```bash
claude-statusline config subagents list-items --json
claude-statusline config subagents set-items status-elapsed name model-with-effort context-remaining task
claude-statusline config subagents enable tokens current-dir
claude-statusline config subagents disable task
claude-statusline config subagents order status-elapsed name model-with-effort context-remaining tokens current-dir
```

With `subagents.items=[]`, `render-subagents` still emits valid NDJSON for every valid task ID, but with empty `content`, causing Claude Code to hide the custom row.

`status-elapsed` is mutually exclusive with `status` and `elapsed`. Invalid combinations in `set-items`/`enable`/`apply` fail directly: for example, `enable status-elapsed` fails on an old configuration with `status` enabled; run `disable status elapsed` first. The interactive wizard automatically deselects conflicting items when one is selected.

### `config set OPTION VALUE`

Change a single display or Claude Code host option:

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

Display options can be configured before installing the status line. Host options `padding`, `refresh-interval`, and `hide-vim-mode-indicator` modify `settings.json/statusLine`, so they require the current status line to be managed by this `claude-statusline` executable. Otherwise, writes are rejected to protect other implementations.

`subagent-statusline` saves the desired enabled state. Disabling an owned renderer immediately returns empty content; rerunning `install` also removes the owned `subagentStatusLine`. Enabling restores it on compatible versions. This separation lets `config set subagent-statusline off` resolve an installation conflict without touching third-party settings.

See [display and host options](#display-and-host-options) for all valid `set` values.

### `config apply`

Submit the complete display and host configuration together. The no-argument wizard uses this after collecting all answers; it is also useful for scripted deployment:

Linux / WSL / macOS (Bash):

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

Windows PowerShell:

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

`--items`, color, palette, directory, separator, and all three host-setting arguments are required. `--subagent-items`, `--subagent-statusline`, and `--scope-labels` are optional and retain current values when omitted; the TUI and wizard submit all fields. Both `--items` and `--subagent-items` accept empty lists. The command validates all values first, then updates `claude-statusline.json` and `settings.json` under the same lock and backup; it attempts transaction rollback if any later write fails.

Because `apply` includes host settings, run `claude-statusline install` first.

### `config reset`

Restore this tool's default display and host settings:

```bash
claude-statusline config reset
```

This command:

- Deletes `claude-statusline.json`, allowing the renderer to use built-in display defaults.
- If this tool is installed, restores `padding=0`, `refreshInterval=1`, and `hideVimModeIndicator=false`. Optional fields set to defaults are removed from `settings.json`.
- Preserves `statusLine.command`, this tool's hooks, the personal skill, runtime state, and caches.

`reset` also handles corrupted `claude-statusline.json`, making it the simplest recovery when configuration JSON cannot be parsed.

<a id="可配置显示项"></a>

## Configurable display items

All the following items are enabled by default; table order is also the initial display order:

| ID | Display | Behavior when data is unavailable |
| --- | --- | --- |
| `model-with-effort` | Current model ID, falling back to display name; appends effort level when present | Omitted without model fields |
| `current-dir` | Claude Code's current working directory | Omitted without a directory field |
| `git` | `Git ` plus branch, upstream differences, and working-tree changes, such as `Git main ↑1● 2` on native Linux/macOS or `Git main ↑1●2` on Windows/WSL | Omitted outside Git repositories; displays `Git!` on query errors |
| `context-remaining` | `Context N% left` | Omitted when Claude Code provides no percentage |
| `context-window-size` | Total context window, such as `1M window` | Omitted when Claude Code provides no window size |
| `five-hour-limit` | Remaining percentage of the 5-hour window | Omitted without this window |
| `weekly-limit` | Remaining percentage of the 7-day window, labeled `weekly` | Omitted without this window |
| `spend-limit` | Remaining percentage of the gateway spend limit | Omitted without this window |
| `tokens` | Cumulative session `hit · miss · out` | Omitted without session/transcript information |
| `prompt-timer` | Duration and result of the current or latest real prompt | Omitted until a prompt can be identified |

Limit percentages are calculated from Claude Code's `used_percentage`. This tool does not query account-limit services; available windows depend on the Claude Code version, account, and current status-line payload.

The following items come from the public status-line payload in Claude Code 2.1.258+ and are **disabled by default**. Enable them with `/statusline-config enable`:

| ID | Display | Behavior when data is unavailable |
| --- | --- | --- |
| `version` | Claude Code version, such as `v2.1.258` | Omitted without a version |
| `session` | `Session ` plus the session name set with `/rename`, otherwise the first 8 characters of its ID, such as `Session explain prompt-cache` | Omitted without a session ID |
| `cost` | Session cost, session runtime, and added/deleted lines, such as `Total $0.12 · 12m 30s · +156/-23`; cost always appears (`Total $0.00` without data), while zero duration or both zero line counts are omitted | Omitted without the cost field |
| `prompt-cache` | Cache hit rate and written tokens, such as `cache 91% · 352K w` | Omitted without prompt_cache, which is absent before the first API response; out-of-range hit rates leave only tokens |
| `fast-mode` | `fast` when fast mode is enabled | Omitted when disabled |
| `agent` | Agent name in a `--agent` session, such as `Agent orchestrator` | Omitted without the agent field |
| `vim-mode` | Current mode when vim mode is enabled, such as `vim NORMAL` | Omitted without the vim field |
| `thinking` | `thinking` when extended thinking is enabled | Omitted when disabled |
| `pr` | Current branch's open PR/MR, such as `PR #1234 · approved`; GitLab merge requests appear as `MR !1234` | Omitted without an open PR/MR on the current branch |
| `worktree` | Worktree name in a `--worktree` session, such as `Worktree feat-x` | Omitted without the worktree field |
| `repo` | `Repo ` plus the origin remote repository, such as `Repo acme/widget` | Omitted without a remote identity |

The `cost` amount comes from Claude Code's `total_cost_usd`; with third-party API endpoints, such as a DeepSeek proxy, it is an estimate using default model rates and is for reference only. `prompt-cache` and `tokens` measure different usage: the former comes from the status-line payload and excludes subagent traffic; the latter aggregates transcripts, including discoverable subagent transcripts.

The following three optional items show context usage, project directory name, and hostname, and are also **disabled by default**:

| ID | Display | Source | Behavior when data is unavailable |
| --- | --- | --- | --- |
| `context-used` | `Context N% used`, rounded with `round()` | `context_window.used_percentage` in Claude's official status-line payload | Omitted for missing, boolean, nonnumeric, nonfinite, or out-of-range values outside `0–100` |
| `project-name` | `Project NAME` | Final directory component of Claude's launch directory `workspace.project_dir`, using platform path semantics; string processing only, without filesystem access | Omitted for invalid, empty, sanitized-empty, or root-directory values; no fallback to `workspace.repo.name` or `current-dir` |
| `hostname` | `Host NAME` | Local Python standard-library `socket.gethostname()`; not a Claude Code 2.1.258+ payload field | Omitted on `OSError` or an empty result after removing newlines, control characters, and ANSI injection; no external commands or network access |

Enable all three together:

```bash
claude-statusline config enable project-name hostname context-used
```

Main-line `context-used` and `context-remaining` are independent options; enable either or both. Adjacent context items follow configured order and use internal dot separators, such as `Context 73% left · Context 27% used · 200K window`.

<a id="主状态栏显示含义"></a>

## Main status line fields

<a id="git-标记"></a>

### Git markers

The `git` item uses these compact markers:

| Marker | Meaning |
| --- | --- |
| `↑N` | Current branch is N commits ahead of upstream |
| `↓N` | Current branch is N commits behind upstream |
| `[gone]` | Configured upstream no longer exists |
| `● N` / `●N` | Staged file count; native Linux/macOS use the former, Windows/WSL the latter |
| `~N` | Unstaged file count |
| `!N` | Conflicted file count |
| `?N` | Untracked file count |
| `Git!` | Git command missing, timed out, or returned unparseable results |

A clean repository synchronized with upstream shows only its branch name. Detached HEAD appears as `HEAD@` followed by a 7-character commit ID.

<a id="token-含义"></a>

### Token fields

`tokens` reports cumulative API usage for the current Claude Code session, including discoverable subagent transcripts:

- `hit`:cache read input tokens.
- `miss`: ordinary input tokens plus cache creation input tokens.
- `out`:output tokens.

Counts use compact notation, such as `950`, `12.4K`, or `1.05M`. They do not indicate remaining context or rate-limit usage; separate items show those metrics.

<a id="prompt-计时标记"></a>

### Prompt timing markers

| Marker | Meaning |
| --- | --- |
| `⏱` | Prompt is running; time continues increasing |
| `✓` | Prompt completed normally |
| `■` | Prompt was interrupted or the session ended |
| `✗` | Claude Code reported execution failure |
| `?` | Previous run has no confirmed ending event; time is followed by `+` |

Sessions with subagents add two running phases:

```text
⏱ 4m 12s
⏳ 2 agents · 4m 12s
⏳ main wrap-up · 4m 12s
✓ 4m 35s
```

Timing starts from the earliest evidence of user submission and ends at the main agent's final `Stop`. If ordinary subagent tasks remain at the main agent's first `Stop`, the timer waits; after the final agent ends, it enters `main wrap-up`. Registry idle state, transcript duration, or a timeout do not complete it automatically. Background shell, server, monitor, and workflow tasks are excluded from the agent ledger. Without the final `Stop`, timing remains active; `StopFailure`, user interruption, and `SessionEnd` still produce immediate terminal states.

The subagent history remains authoritative after the main agent resumes. A delayed native `turn_duration` cannot shorten a multi-agent task or turn failure/interruption into success. Accepted terminal times are frozen; duplicate hooks and later refreshes do not extend them. An ordinary successful single turn can be calibrated once with its matching native duration. Events without reliable prompt ownership are ignored rather than attached to a newer prompt.

| Time metric | Meaning and source |
| --- | --- |
| Task duration | `prompt-timer`: earliest user submission to final main `Stop`, or a confirmed failure/interruption; includes queuing, subagents and wrap-up |
| Native turn duration | Transcript `turn_duration.durationMs`; a single native response, used only for eligible single-turn calibration |
| Session runtime | `cost.total_duration_ms`; cumulative time the CLI session runs, excluding time between runs/resumes |
| API wait time | `cost.total_api_duration_ms`; cumulative waiting for API responses; not currently displayed by `cost` |

See the [official status-line fields](https://code.claude.com/docs/en/statusline) for the session and API definitions.

Background-agent result notifications can have different host prompt IDs; known agent ownership keeps them in the same user task until every report and main-agent wrap-up finishes. Submission evidence is checked before freezing, so later transcript refreshes do not revise terminal values.

Local shortcut commands such as `/statusline-config show` do not start a new timed prompt. Hiding `tokens` while retaining `prompt-timer` still lets the timer read the necessary transcript state and work normally.

<a id="子-agent-行与三种作用域"></a>

## Subagent rows and the three scopes

On Claude Code 2.1.205+, the official `subagentStatusLine` payload is passed to `claude-statusline render-subagents`. The renderer preserves `tasks` input order, ignores later duplicate IDs, and emits one NDJSON line per valid nonempty string ID. It does not scan transcripts, run Git, access the network, or write runtime state; tokens come only from the current task's `tokenCount`.

A default subagent row looks like:

```text
⏱ 1m 18s · Explore · sonnet-5/high · Context 58% left · searching auth flow
```

Sortable items and defaults:

| ID | Default | Content |
| --- | --- | --- |
| `status-elapsed` | On | Status icon plus duration, such as `⏱ 1m 18s`; only the icon when `startTime` is missing or invalid. Mutually exclusive with `status` and `elapsed` |
| `status` | Off | `pending …`, `running ⏱`, `completed ✓`, `failed ✗`, `killed ■`, `paused/waiting ⏳`; unknown status uses `?` |
| `name` | On | `name`, otherwise normalized `type`, otherwise `Agent` |
| `model-with-effort` | On | Model ID without the `claude-` prefix, followed by `/effort` when available |
| `context-remaining` | On | `Context N% left`, calculated as 100 minus the rounded used percentage and clamped to 0–100 |
| `context-used` | Off | `Context N% used`, from `tokenCount / contextWindowSize` rounded to a percentage |
| `elapsed` | Off | Duration from the task's epoch-millisecond `startTime`; future timestamps count as 0 seconds |
| `task` | On | `label`, otherwise `description`; omitted when identical to the name |
| `tokens` | Off | Compact token count for the current task |
| `current-dir` | Off | Task `cwd`, respecting directory style |

Width uses the payload's positive integer `columns` directly, falling back to 80 when invalid, without the main-line margin. Input newlines, tabs, and control characters are sanitized. Overflow first truncates task text, then drops optional segments in the order `current-dir → tokens → context-used → context-remaining → model-with-effort → task`. `status` and `status-elapsed` are always retained; with `status` enabled, `name` and `elapsed` are also retained until last. At extreme widths, `status-elapsed` becomes an icon only. ASCII, CJK, emoji, combining characters, and ANSI paths all stay within `columns` of visible width without wrapping.

Keep these three scopes distinct:

- The global bottom line belongs to the main agent; `scope-labels=when-subagents` prepends fixed `Main/Session` after the current prompt has launched subagents.
- Main-line `tokens` is cumulative session usage, still including discoverable main and subagent transcripts.
- Each official subagent row describes only its own task, using only `tasks[]` fields.

Claude Code provides neither `focused_agent` nor `viewing_task_id`. After switching to a subagent transcript, the global bottom line neither reads nor guesses focus using transcript mtime, process memory, or keyboard events. `Main/Session` explicitly identifies this boundary.

<a id="显示与宿主选项"></a>

## Display and host options

| OPTION | VALUE | Default | Description |
| --- | --- | --- | --- |
| `colors` | `on`, `off` | `on` | Whether to output ANSI color codes |
| `palette` | `default`, `ansi` | `default` | `default` uses this project's 24-bit RGB colors; `ansi` uses standard terminal colors |
| `directory-style` | `full`, `home`, `project-relative`, `basename` | `full` | How to abbreviate the working directory |
| `separator-style` | `classic`, `compact` | `classic` | How to separate top-level items |
| `scope-labels` | `off`, `when-subagents`, `always` | `when-subagents` | Whether to prepend fixed `Main/Session` to the main line |
| `subagent-statusline` | `on`, `off` | `on` | Whether custom subagent rows should be installed and rendered |
| `padding` | `0`–`32` | `0` | Horizontal whitespace added by Claude Code before status-line content |
| `refresh-interval` | `event`, `1`–`3600` | `1` | Rerun the renderer every specified number of seconds in addition to event refreshes; `event` means events only |
| `hide-vim-mode-indicator` | `on`, `off` | `off` | `on` hides Claude Code's built-in Vim mode text |

<a id="颜色"></a>

### Colors

- `colors off` disables all ANSI color codes output by this tool.
- `palette` is saved even with colors off, but affects output only after colors are reenabled.
- `default` requires 24-bit color support; use `ansi` when terminal compatibility is the priority.

<a id="目录格式"></a>

### Directory formats

Assume the user's home is `/home/user`, the project root is `/home/user/code/repo`, and the current directory is `/home/user/code/repo/src/api`:

| Style | Example output |
| --- | --- |
| `full` | `/home/user/code/repo/src/api` |
| `home` | `~/code/repo/src/api` |
| `project-relative` | `src/api`; `.` at the project root |
| `basename` | `api` |

`home` abbreviates only paths actually within the current user's home. `project-relative` falls back to a full path when the current directory is outside the project root provided by Claude Code.

Windows drive paths, paths with spaces or Chinese characters, UNC paths, and case normalization use native Windows path semantics. `full` preserves the payload's original `/` or `\`; `home` and `project-relative` use `/` for compact display.

<a id="分隔符和语义分组"></a>

### Separators and semantic groups

`classic` separates top-level items with ` | `; `compact` uses ` · ` for all top-level items.

Adjacent items in the following semantic groups join with ` · ` and share the same color:

- `model-with-effort`, `fast-mode`, and `thinking` (model group, ivory)
- `current-dir`, `project-name`, and `hostname` (location group, green)
- `git`, `pr`, and `repo` (repository group, purple)
- `tokens` and `prompt-cache` (usage group, pink)
- `context-remaining`, `context-used`, and `context-window-size`
- `five-hour-limit`, `weekly-limit`, and `spend-limit`

`version`, `session`, `cost`, `agent`, `vim-mode`, and `worktree` remain independent and do not merge with neighbors. The catalog is grouped as model → location → repository → context → limits → usage → timer → independent items, but `enable` simply appends new items in argument order. Use `order`, `set-items`, or the TUI to place group members together. Separating them through reordering restores independent top-level items. Internal fields in `tokens` (`hit`, `miss`, `out`), `cost` (amount, duration, line changes), and `prompt-cache` (hit rate, written tokens) always use ` · `.

<a id="刷新间隔"></a>

### Refresh interval

Claude Code reruns the status line on relevant UI or session events. `refresh-interval N` adds refreshes every N seconds, useful for continuously updating `prompt-timer` or observing background changes while the main session is idle.

```bash
# Default: refresh every second
claude-statusline config set refresh-interval 1

# Refresh less frequently
claude-statusline config set refresh-interval 5

# Refresh only on Claude Code events
claude-statusline config set refresh-interval event
```

With `event`, an active `prompt-timer` does not advance visibly every second; it updates only on the next status event.

<a id="配置文件"></a>

## Configuration files

<a id="显示配置"></a>

### Display configuration

Display items and styles are saved in:

```text
<CLAUDE_CONFIG_DIR>/claude-statusline.json
```

The default configuration is equivalent to:

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

This is strict JSON: comments, trailing commas, unknown or missing fields, unknown items, and duplicates are rejected. Use configuration commands rather than editing it manually.

The 10 items above form the default enabled set. `project-name`, `hostname`, `context-used`, `version`, `session`, `cost`, `prompt-cache`, `fast-mode`, `agent`, `vim-mode`, `thinking`, `pr`, `worktree`, and `repo` are optional and excluded by default; they enter `items` only after `config enable` or selection in the wizard.

Updates back up the previous contents and protect writes with atomic replacement and file locks. See [backups and rollback](#backups-and-rollback) and [configuration writes and concurrency](#configuration-writes-and-concurrency).

The current display schema is v2. Historical v1 is readable and is backed up and written as v2 on the first actual configuration save. See [version compatibility](#version-compatibility) for conversion and downgrade recovery.

If display configuration is corrupted:

- Both renderers silently fall back to built-in defaults to protect the Claude Code interface.
- `config show`, normal configuration writes, and `doctor` report an explicit error.
- `config reset` removes the corrupted configuration and restores defaults.

`items: []` is valid and suppresses main-line content; even scope labels set to `always` do not create an otherwise empty main line. `subagents.items: []` is also valid and returns empty content for each valid subtask.

<a id="实验功能偏好"></a>

### Experimental feature preferences

The persistent `/statusline-configure` preference is saved in:

```text
<CLAUDE_CONFIG_DIR>/claude-statusline-features.json
```

A missing file means disabled; when enabled, its contents are:

```json
{
  "schema_version": 1,
  "experimental_slash_tui": true
}
```

The file has a strict schema, `0600` permissions on Linux/macOS, and inherited ACLs on Windows. Boolean `false` is also read as disabled, but the disable command deletes the file. Normal `install` rejects unknown or missing fields, invalid types, unknown schemas, or malformed JSON. Explicit `--experimental-slash-tui` backs up and repairs it; explicit `--no-experimental-slash-tui` backs up and deletes it.

<a id="claude-code-宿主配置"></a>

### Claude Code host configuration

The following settings belong to the `statusLine` object in user-level `settings.json`, not `claude-statusline.json`:

- `command`
- `padding`
- `refreshInterval`
- `hideVimModeIndicator`

The installer manages `command`; the other three fields can be changed with `config set` or the wizard. Some fields are omitted from JSON when set to default behavior, such as `padding 0`, `refresh-interval event`, and `hide-vim-mode-indicator off`.

Compatible versions also receive an independent `subagentStatusLine` in `settings.json`, containing strictly `type: "command"` and a `command` pointing to `render-subagents`. Claude's schema does not accept `refreshInterval`, so this tool does not write it. With `subagents.enabled=false`, rerunning `install` removes only the owned entry, preserving third-party settings. Both subagent lifecycle hooks remain for end-to-end timing.

<a id="自定义配置目录与环境变量"></a>

## Custom configuration directory and environment variables

The tool respects Claude Code's `CLAUDE_CONFIG_DIR`:

```bash
CLAUDE_CONFIG_DIR=/path/to/claude-config claude-statusline install
CLAUDE_CONFIG_DIR=/path/to/claude-config claude-statusline configure
CLAUDE_CONFIG_DIR=/path/to/claude-config claude-statusline config show
```

Windows PowerShell:

```powershell
$env:CLAUDE_CONFIG_DIR = 'C:\Path With Spaces\Claude 配置'
claude-statusline.exe install
claude-statusline.exe configure
claude-statusline.exe config show
```

Management commands also accept explicit `--config-dir PATH`, which takes precedence over the environment variable.

The following runtime-location overrides are also supported:

- `CLAUDE_STATUSLINE_RUNTIME_DIR`: overrides the runtime directory for token and Git caches and per-turn state.
- `CLAUDE_STATUSLINE_SESSIONS_DIR`: overrides the Claude Code session registry directory.

These last two variables are usually unnecessary. Changing them may temporarily hide existing session state, without changing display configuration itself.

<a id="升级"></a>

## Upgrading

First upgrade the Python package to stable v1.2.0, then synchronize the Claude Code integration. Users of v1.0.0 or v1.1.0a1 follow the same steps.

<a id="替换-python-包"></a>

### Replace the Python package

Choose any one of these sources. Release URL and Git URL commands work in Bash / Zsh / PowerShell.

**Stable Release URL (recommended; all supported platforms):**

```text
pipx install --force "https://github.com/fbincon/claude-code-statusline/releases/download/v1.2.0/claude_code_statusline-1.2.0-py3-none-any.whl"
```

**Local wheel:** Download from the Release, [verify the files](#install-the-python-package), and run from the download directory.

```bash
pipx install --force ./claude_code_statusline-1.2.0-py3-none-any.whl
```

Windows PowerShell:

```powershell
pipx install --force .\claude_code_statusline-1.2.0-py3-none-any.whl
```

Locally built wheels are under the project's `dist/`; use `dist/filename.whl` or `.\dist\filename.whl` accordingly.

**Source at a fixed tag:**

```text
pipx install --force "git+https://github.com/fbincon/claude-code-statusline.git@v1.2.0"
```

To follow the default branch, replace the tag with `@main`. For local source upgrades, update the checkout first, then run `pipx install --force .` in the project root. Rebuild the wheel first when building yourself. These sources install code from the specified branch or directory; filenames must match the actual generated version.

<a id="同步-claude-code-接入"></a>

### Synchronize Claude Code integration

Linux / WSL / macOS:

```bash
claude-statusline --version
claude-statusline install
claude-statusline doctor
claude-statusline config show
```

Windows PowerShell:

```powershell
claude-statusline.exe --version
claude-statusline.exe install
claude-statusline.exe doctor
claude-statusline.exe config show
```

Rerun `install` to synchronize skill templates, command paths, hooks, and version-dependent settings; repeated calls do not duplicate hooks. Display and feature preferences, token summaries, Git caches, and per-turn timing state reside in the Claude configuration directory and survive Python package upgrades.

<a id="版本兼容"></a>

### Version compatibility

Display configuration and experimental feature preferences have independent formats, currently schema v2 and schema v1 respectively. Upgrading this tool to 1.0.0, 1.1.0a1, 1.1.1, 1.2.0, or 1.3.0a1 introduces no new format conversion; existing schema v2 files remain usable. Earlier schema v1 display configurations follow these rules:

Schema v1 remains readable: main items, order, colors, palette, directory, and separator remain intact, with v2 defaults supplied in memory. Simply running `render`, `render-subagents`, `doctor`, or `install` does not rewrite v1. The first actual configuration save backs up the original bytes in the same transaction and writes canonical schema v2. Schema v2 strictly rejects unknown/missing fields, duplicates, and incorrect types; schemas above v2 are rejected. Downgrading to 0.5.0 makes the old program fall back to defaults; restore the pre-upgrade backup to edit the old schema again.

Claude Code feature thresholds are independent of this tool's version:

If the experimental entry point is enabled and Claude Code is downgraded below 2.1.258, or its version becomes unrecognizable, a normal `install` retains the preference but removes and suspends the active entry point. After upgrading, rerun `install` to restore it. Always run `install` and `doctor` after crossing this threshold.

Subagent support has its own 2.1.205 threshold. Versions 2.1.205–2.1.213 omit only per-task effort when unavailable; 2.1.214+ shows full model/effort. Rerun `install` after crossing 2.1.205: downgrading removes only the owned `subagentStatusLine` and two subagent hooks, while upgrading restores them according to `subagents.enabled`.

The local hook for `/statusline-config` with arguments requires Claude Code 2.1.258. Rerunning `install` adds or removes it according to the version. Below this threshold, the skill executes configuration commands in a model turn. See the [changelog](../CHANGELOG.md) for historical changes.

<a id="卸载"></a>

## Uninstalling

Remove this tool's Claude Code integration before uninstalling the pipx package:

```bash
claude-statusline uninstall
pipx uninstall claude-code-statusline
```

Windows PowerShell:

```powershell
claude-statusline.exe uninstall
pipx uninstall claude-code-statusline
```

Preview first if desired:

```bash
claude-statusline uninstall --dry-run
```

On Windows, the corresponding command is `claude-statusline.exe uninstall --dry-run`.

The uninstaller removes only:

- `statusLine` pointing to this tool.
- `subagentStatusLine` matching this tool's current or canonical command.
- This tool's lifecycle hooks and local slash-command shortcut hook.
- Owned `/statusline-config` and `/statusline-configure` skills and ownership markers.

It preserves:

- Hooks defined by other tools or the user.
- Third-party `subagentStatusLine`.
- Display preferences in `claude-statusline.json`.
- Experimental preferences in `claude-statusline-features.json`; a later normal `install` on a compatible version restores the entry point.
- Token, Git, and timer runtime state.
- Backups created by the installer.

Reinstallation can therefore reuse existing display preferences. To disable the experimental entry point permanently, run `claude-statusline install --no-experimental-slash-tui` first. For complete removal of other retained data, verify the exact paths before deleting files manually.

<a id="备份与回滚"></a>

## Backups and rollback

Backups from installation, uninstallation, and configuration updates are stored in:

```text
<CLAUDE_CONFIG_DIR>/backups/statusline/cli-<action>-<timestamp>/
```

Backups are created only for actual changes. One transaction may capture previous contents of `settings.json`, `claude-statusline.json`, the feature file, both skills, and ownership markers.

Each backup directory's `metadata.json` records:

- The action that created the backup.
- Creation time.
- Each original file's absolute path.
- Whether its previous state was `before` or `absent`.

`*.before` contains the original bytes; `*.absent` means the file did not previously exist. Before manual rollback, exit relevant Claude Code sessions, then use `metadata.json` to restore each `*.before` to its target path. For `absent` entries, rollback means removing the corresponding target.

If a later step fails during normal writing, the tool automatically attempts transaction rollback. Backups remain available for inspection.

<a id="doctor-诊断"></a>

## `doctor` diagnostics

```bash
claude-statusline doctor
```

`doctor` does not rewrite configuration. On macOS, it attempts to sync the existing configuration parent directory to report filesystem capabilities. It checks:

- Current platform and Python version.
- Whether `claude-statusline` is executable and on PATH; Windows requires an actual `.exe` entry point.
- Git availability.
- `settings.json` validity and its security model: POSIX mode on Linux/macOS, inherited ACLs with mode marked inapplicable on Windows.
- Validity of `statusLine.command` and the three host fields.
- Exactly one of each of the five main lifecycle hooks.
- Claude Code's 2.1.205 subagent threshold, the desired enabled state, `subagentStatusLine` ownership state (`owned/absent/foreign/unsupported`), and exact deduplication of the two subagent hooks.
- Correct `/statusline-config` skill and ownership marker.
- Valid experimental feature file; `0600` on Linux/macOS, without false permission errors on Windows.
- Whether `/statusline-configure` is `disabled`, `enabled`, or `suspended` due to version incompatibility; when enabled, completeness of the skill, owner marker, unique matcher, and 600-second hook.
- At least tmux or GNOME Terminal for an enabled experimental entry point on Linux; local Terminal.app and graphical-session conditions plus tmux availability on macOS; system new-console capability on Windows. Diagnostics do not open desktop windows.
- macOS architecture, the 14+ OS range, curses, process start identity, sleep-inclusive clock, and parent-directory sync. Unavailable process, clock, or sync capabilities produce WARN degradation messages.
- Windows `windows-curses` backend, x86/x64 architecture contract, and system new-console launcher.
- Display JSON, schema v1 migration status, and permissions.
- Whether the current Claude Code version requires a local slash-command shortcut hook.
- Writable runtime-state directory.

Diagnostic levels and exit codes:

- `[OK]`: check passed.
- `[WARN]`: functionality remains usable with degradation, such as missing Git or an older Claude Code version requiring model turns for configuration commands. Warnings alone still return 0.
- `[ERROR]`: installation or configuration is incomplete; any ERROR makes `doctor` return 1.

Typical repair sequence:

```bash
claude-statusline install
claude-statusline doctor
```

If `install` reports a conflict, inspect the existing configuration it identifies; add `--force` only when replacement is intended.

<a id="故障排查"></a>

## Troubleshooting

<a id="状态栏不显示"></a>

### Status line does not appear

1. Run `claude-statusline doctor`.
2. Confirm that `claude-statusline` is on PATH.
3. Confirm that `config set-items` has not emptied `items`.
4. Check for `statusLine.command` pointing to this tool in `settings.json`.
5. If Claude Code skips the status line because of trust, restart Claude Code and accept the relevant trust prompt.
6. Check for Claude Code settings that disable hooks/status lines globally.

<a id="子-agent-行不显示或发生所有权冲突"></a>

### Subagent rows are missing or ownership conflicts occur

Run `claude --version` and `claude-statusline doctor` first. Below Claude Code 2.1.205 or with an unrecognized version, the main line works but subagent settings/hooks are suspended; upgrade and rerun `claude-statusline install`. If `doctor` reports `foreign`, choose one:

```bash
# Explicitly take over third-party subagent rows
claude-statusline install --force

# Keep the third-party implementation and disable only this tool's custom-row target
claude-statusline config set subagent-statusline off
claude-statusline install
```

If `subagents.items` is empty or `subagents.enabled` is false, this renderer returns empty content as required by the protocol. After entering a subagent transcript, the global bottom line still belongs to the main agent/session because Claude provides no current-focus ID.

<a id="statusline-config-不可见"></a>

### `/statusline-config` is missing

```bash
claude-statusline install
claude-statusline doctor
```

Confirm that `/statusline-config skill` is OK in doctor. If installation happened after the current Claude Code session started, open a new session and check command discovery again.

<a id="statusline-configure-不可见或显示-suspended"></a>

### `/statusline-configure` is missing or suspended

Confirm explicit enabling and synchronize with the current Claude Code version:

```bash
claude --version
claude-statusline install --experimental-slash-tui
claude-statusline doctor
```

Explicit enabling fails before writing below 2.1.258 or with an unrecognized version. After an enabled installation is downgraded, normal `install` retains the preference but suspends and removes the active skill/hook, hiding the command from the slash menu. Upgrade to a compatible version, rerun normal `install`, and open a new Claude Code session.

<a id="实验入口无法打开新终端"></a>

### Experimental entry point cannot open a terminal

The tmux path requires valid `TMUX`, `TMUX_PANE` shaped as `%<digits>`, and access to the target server/pane within a 2-second preflight check in the hook environment. An invalid Linux target falls back to GNOME; macOS checks the local graphical session and Terminal.app instead. Missing prerequisites lead to a standalone-command suggestion. Once tmux is selected successfully, failure inside the popup does not launch another terminal.

The macOS Terminal path requires a local graphical session, system Terminal.app, `/usr/bin/open`, and usable process start identity. No handshake within 30 seconds produces an error; first check whether a window opened and Python provides curses. `doctor` checks conditions without opening a window. Over SSH, use the standalone command. If Terminal retains its window after completion, adjust Terminal's window-closing preferences.

GNOME requires `DISPLAY` or `WAYLAND_DISPLAY`, executable `gnome-terminal`, and a usable user D-Bus/graphical session. D-Bus startup errors return a short error to the original Claude conversation. If neither Linux launcher is available, or macOS lacks valid tmux and local Terminal.app conditions, run directly in a terminal:

```bash
claude-statusline configure
```

Windows hosts `CREATE_NEW_CONSOLE` in the system default terminal. Closing the window, abnormal child exit, or absence of a trusted result immediately returns an error to the original conversation. Diagnose directly with `claude-statusline.exe configure` in PowerShell. Confirm that `windows-curses backend` and `Windows system new-console launcher` are both OK in `doctor`.

When the hook ends after 600 seconds, the TUI should normally already have timed out at 570 seconds. When inspecting `<CLAUDE_CONFIG_DIR>/statusline_runtime/slash_tui/`, do not manually follow or delete unknown symbolic links. Automatic cleanup handles only remnants older than 24 hours that match this tool's naming prefix and contain no symbolic links.

With `disableAllHooks`, the local launcher does not run. The fallback skill explains this and prohibits launching curses through Bash/PowerShell; this exception may use a very short model turn. Reenable hooks and try a new session.

<a id="带参数的-slash-命令仍进入模型"></a>

### Slash commands with arguments still enter the model

Usually Claude Code is below 2.1.258, its version is unrecognized, or the local shortcut hook is unsynchronized. Check:

```bash
claude --version
claude-statusline doctor
claude-statusline install
```

Execution through a model turn on older versions is expected compatibility behavior and does not change command semantics.

<a id="配置命令提示-statusline-不属于本工具"></a>

### Configuration commands report that statusLine belongs to another tool

`padding`, `refresh-interval`, `hide-vim-mode-indicator`, and full `apply` modify Claude Code's `settings.json`. To protect other status lines, these operations require `statusLine.command` to point to the current executable.

First inspect:

```bash
claude-statusline config show
claude-statusline doctor
```

If you intend this tool to manage the status line, run `claude-statusline install`. Display items, colors, palette, directory style, and separator can be configured before installation.

<a id="json-配置损坏"></a>

### Corrupted JSON configuration

The renderer continues with defaults, but diagnostics and normal writes report errors. Restore defaults:

```bash
claude-statusline config reset
claude-statusline doctor
```

To preserve manual edits, restore from the latest backup or repair the JSON before running doctor.

<a id="git-信息缺失或显示-git"></a>

### Git information is missing or shows `Git!`

Linux / WSL / macOS:

```bash
command -v git
git -C /path/to/project status --porcelain=v2 --branch --ahead-behind
```

Windows PowerShell:

```powershell
Get-Command git
git -C 'C:\Path With Spaces\project' status --porcelain=v2 --branch --ahead-behind
```

Omitting Git outside a repository is normal. `Git!` means the Git command is missing, timed out, or returned unparseable output. Disabling `git` stops renderer Git queries:

```bash
claude-statusline config disable git
```

<a id="token-或计时器暂时不显示"></a>

### Tokens or timer are temporarily missing

These items depend on Claude Code's session ID, transcript path, and lifecycle events. Temporary omission is normal before the first real model response, during special local commands, or before a transcript exists.

If the timer appears but does not advance continuously while running, check whether refresh is event-only:

```bash
claude-statusline config show
claude-statusline config set refresh-interval 1
```

<a id="输出在窄终端中换成多行"></a>

### Output wraps into multiple lines in narrow terminals

This is expected. The renderer packs segments within terminal `COLUMNS` after reserving 2 characters; narrow windows do not silently truncate fields. Increase width, use `compact` separators, choose a shorter directory style, or hide secondary items to reduce wrapping.

<a id="退出码"></a>

## Exit codes

Management commands follow these conventions:

- `0`: success; `doctor` found no ERROR.
- `1`: `doctor` found at least one ERROR.
- `2`: argument, configuration, ownership, or installation-operation validation failed.
- `130`: interactive TUI received Ctrl+C/SIGINT; the terminal is restored and configuration is not saved.
- `128 + signal`: interactive TUI received a termination signal available on the current platform; the terminal is restored and configuration is not saved.

Frequent internal commands `render`, `render-subagents`, `hook`, and `slash-hook` silently tolerate corrupted or unrelated input to avoid blocking Claude Code with their own errors.

<a id="当前边界"></a>

## Current limitations

- Current source supports Linux/WSL Python 3.10+, Windows 10/11 CPython 3.10–3.14 x86/x64, and macOS 14+ CPython 3.10–3.14 Intel / Apple Silicon.
- The macOS desktop launcher supports Terminal.app; other terminals can use standalone `configure` or tmux popup.
- Native Windows ARM64 Python is not currently guaranteed; use x64 Python emulation on ARM devices.
- Configuration is global per user; there is no project-level configuration.
- Apart from optional local hostname via `socket.gethostname()`, metrics come only from Claude Code payloads, local Git, and transcripts.
- Claude Code `/theme` is not followed; `default` palette uses this project's fixed RGB colors.
- There is no native Claude Code TUI extension. The experimental entry point uses tmux/GNOME on Linux, tmux/Terminal.app on macOS, and the system new console on Windows, reusing the standalone TUI.
- Linux/macOS do not access `/dev/tty`. None of the three platforms writes CSI/alternate-screen sequences to the Claude pane, bypasses hook stdio, caches the current session payload, or persists disabled-item ordering.
- Experimental TUI launching is not guaranteed in IDEs, `claude -p`, remote Web environments, globally disabled hooks, or terminal environments outside the listed platform launchers.
- Mouse, drag-and-drop, and custom keybindings are not provided.
- Completion timing includes only ordinary agent-task lifecycles; background shell, server, monitor, workflow, and agent-team-specific ledgers do not block completion.
- There is no per-agent historical ledger, Git, cache hit/miss/out, or session aggregation; subagent rows show only Claude's current payload.
- Agent focus is not inferred; the global bottom line always describes the main agent/session.

<a id="附录开发与测试"></a>

## Appendix: development and testing

<a id="准备开发环境"></a>

### Prepare a development environment

Clone the repository and enter the project root (Bash / PowerShell):

```text
git clone https://github.com/fbincon/claude-code-statusline.git
cd claude-code-statusline
```

For an existing checkout, enter its root directly. The development environment is independent of the user's pipx installation.

Linux / WSL / macOS:

```bash
python3 -m venv .venv-dev
source .venv-dev/bin/activate
python -m pip install -e . ruff build
```

Windows PowerShell, using an installed supported Python (3.10 here):

```powershell
py -3.10 -m venv .venv-dev
.\.venv-dev\Scripts\python.exe -m pip install -e . ruff build
```

<a id="运行检查"></a>

### Run checks

On Linux / WSL / macOS, run in the activated development environment:

```bash
python -m unittest discover -s tests -v
python -m ruff check --select F,E9 src tests
python -m build
```

On Windows PowerShell, call the virtual-environment interpreter directly without an activation script:

```powershell
.\.venv-dev\Scripts\python.exe -m unittest discover -s tests -v
.\.venv-dev\Scripts\python.exe -m ruff check --select F,E9 src tests
.\.venv-dev\Scripts\python.exe -m build
```

GitHub Actions runs on push and pull requests across `ubuntu-latest`, `windows-latest`, `macos-15-intel`, `macos-15`, `macos-26-intel`, and `macos-26`, covering Python 3.10/3.14 with explicit native architectures; ARM64 Python 3.10 is pinned to 3.10.11. Windows checks `windows-curses` and runs PowerShell/Git Bash smoke tests. Linux/macOS prepare tmux and run PTY/popup integration plus installed-package CLI smoke tests. macOS also runs native PTY lifecycle tests for the Terminal helper; desktop Terminal.app smoke is explicit and default tests do not open desktop windows. The build job checks versions, conditional dependencies, platform/Terminal modules, skills, and all platform screenshots. Refer to [Actions for the relevant commit](https://github.com/fbincon/claude-code-statusline/actions/workflows/ci.yml) for results.

<a id="从源码构建与安装"></a>

### Build and install from source

Run in the project root; an independent build environment is sufficient when only building packages.

Linux / WSL / macOS:

```bash
python3 -m venv .venv-build
source .venv-build/bin/activate
python -m pip install --upgrade build
python -m build
pipx install dist/claude_code_statusline-1.2.0-py3-none-any.whl
pipx ensurepath
```

Windows PowerShell:

```powershell
py -3.10 -m venv .venv-build
.\.venv-build\Scripts\python.exe -m pip install --upgrade build
.\.venv-build\Scripts\python.exe -m build
pipx install .\dist\claude_code_statusline-1.2.0-py3-none-any.whl
pipx ensurepath
```

These filenames correspond to stable v1.2.0; use the actual generated filenames for other versions. Replace existing packages using the [upgrade steps](#upgrading). After `pipx ensurepath`, reopen the terminal and complete [Claude Code integration](#integrate-with-claude-code).

In an activated build environment, inspect the wheel with `python -m zipfile -l dist/claude_code_statusline-1.2.0-py3-none-any.whl`; on Windows, use `.\.venv-build\Scripts\python.exe`. Confirm `_platform.py`, `macos_terminal.py`, `resources/statusline-config/SKILL.md`, and `resources/statusline-configure/SKILL.md`. The source distribution should also contain this guide, the release guide, and `images/` screenshots. See the [release guide](RELEASING.md) for the complete process.

<a id="隔离测试与人工验收"></a>

### Isolated testing and manual acceptance

On macOS, explicitly run the Terminal.app smoke test in a Python virtual environment with the current wheel installed:

```bash
.venv-wheel-check/bin/python tools/macos_terminal_smoke.py
```

This opens Terminal.app and uses temporary configuration with shortened deadlines in the production TUI to check terminal behavior, result bridging, and cleanup, without calling the Claude API.

Automated acceptance should run install dry-run, install, doctor, idempotent reinstall, conflict rollback, and uninstall against temporary `CLAUDE_CONFIG_DIR`, never real configuration. After code and installation transactions pass, the user decides whether to install the wheel into real configuration.

Real multi-agent visual checks incur model costs and are not started automatically. User-assisted final acceptance should verify: owned default `subagentStatusLine` and two unique hooks; correct main line without subagents; correct rows for two concurrent agents with distinct model/effort; timer progression through agent count and `main wrap-up`; final main `Stop` freezing total duration; global `Main/Session` scope when viewing a subagent transcript; final `doctor`; and `uninstall --dry-run` matching only owned configuration.

<a id="附录内部命令"></a>

## Appendix: internal commands

These four commands are mainly called by Claude Code and are not everyday configuration interfaces:

### `render`

Read Claude Code status-line JSON from stdin and output one or more status-line text rows to stdout using current configuration. Invalid input is silent so errors do not pollute the Claude Code UI.

Use simulated input for basic troubleshooting. Linux / WSL / macOS, rendered at 120 columns:

```bash
printf '%s\n' '{"model":{"id":"test-model"},"effort":{"level":"high"},"workspace":{"current_dir":"/tmp"}}' \
  | COLUMNS=120 claude-statusline render
```

Windows PowerShell:

```powershell
'{"model":{"id":"test-model"},"effort":{"level":"high"},"workspace":{"current_dir":"C:\\demo"}}' | claude-statusline.exe render
```

These examples read `claude-statusline.json` from the current configuration directory, so output depends on enabled items. Automated checks should point `CLAUDE_CONFIG_DIR` to a temporary directory.

### `render-subagents`

Read official Claude Code `subagentStatusLine` JSON from stdin and render each valid task as one `{"id":"...","content":"..."}` NDJSON line. Invalid top-level JSON, `tasks`, or individual fields degrade silently with exit code 0. Stdout contains only protocol results; the renderer does not scan transcripts, Git, the network, or runtime state.

Linux / WSL / macOS:

```bash
printf '%s\n' '{"columns":80,"tasks":[{"id":"demo","name":"Explore","type":"local_agent","status":"running","startTime":1788400000000,"model":"claude-sonnet-5","tokenCount":84000,"contextWindowSize":200000}]}' \
  | claude-statusline render-subagents
```

Windows PowerShell:

```powershell
'{"columns":80,"tasks":[{"id":"demo","name":"Explore","type":"local_agent","status":"running","startTime":1788400000000,"model":"claude-sonnet-5","tokenCount":84000,"contextWindowSize":200000}]}' | claude-statusline.exe render-subagents
```

### `hook`

Read Claude Code lifecycle events from stdin and silently update local prompt-timing state. Corrupted input is designed not to block Claude Code turns.

### `slash-hook`

Read `UserPromptExpansion` events from stdin. Handle local `statusline-config` shortcuts with arguments and enabled no-argument `statusline-configure` launch requests. No-argument `statusline-config` passes through to the wizard skill; recognized `statusline-configure` always emits a `decision: "block"` JSON, translating child exit codes only into result text. Unrelated events and corrupted input pass through silently.

<a id="附录实现说明"></a>

## Appendix: implementation notes

<a id="平台执行与文件安全"></a>

### Platform execution and file safety

On Linux/macOS, the installer writes absolute executable paths with POSIX quoting into Claude Code settings. Windows writes command names executable through both Git Bash and PowerShell, requiring `claude-statusline.exe` on `PATH`:

```text
claude-statusline.exe render
claude-statusline.exe render-subagents
claude-statusline.exe hook
claude-statusline.exe slash-hook
```

The Windows skill uses `claude-statusline.exe config ...`, preauthorizing only `Bash(claude-statusline.exe config *)` and `PowerShell(claude-statusline.exe config *)`. Linux/macOS authorize only Bash commands for the installed absolute path. Claude Code prefers Git Bash for Windows status-line commands and falls back to PowerShell, so all four internal commands use bare `.exe` names rather than backslash-containing absolute paths that Git Bash would interpret as escapes. See [Claude Code's Windows status-line conventions](https://code.claude.com/docs/en/statusline).

NTFS `st_mode` on Windows is not reliable POSIX permission information; `doctor` reports mode checks as inapplicable. File safety relies on inherited Windows ACLs in the user's Claude configuration directory. Result bridging still rejects symlinks, junctions, other reparse points, paths outside the expected directory, nonregular files, and results above 16 KiB.

<a id="配置写入与并发"></a>

### Configuration writes and concurrency

Configuration, token caches, Git caches, and per-turn state use same-directory temporary files, file `fsync`, and atomic replacement. Linux/macOS apply `0600/0700`, sync parent directories, and use `fcntl.flock`. Windows uses inherited user ACLs and `msvcrt` fixed-byte locks, with bounded retries for transient sharing violations/access denied. Concurrent configuration commands share one cross-platform lock to avoid lost updates.

If macOS parent-directory sync returns `EINVAL` or `ENOTSUP/EOPNOTSUPP`, file `fsync` and atomic replacement remain, and `doctor`/CI report degradation. Other I/O or permission errors propagate. No additional `F_FULLFSYNC` is used.

macOS session process identity uses `/bin/ps -o lstart= -p PID` with `LC_ALL=C` and `TZ=UTC`, preserving internal spaces. Matching sessions are filtered before process queries; a 1-second timeout or query failure makes the registry record untrusted. Timing uses integer conversion of LibSystem `mach_continuous_time()` and `mach_timebase_info()`, plus `kern.bootsessionuuid` for cross-process reboot detection. If any interface is unavailable, the whole group falls back to wall-clock time.

Global Enter calls the existing atomic configuration transaction once. No changes means no backup; changes use one backup, two-file writes, and rollback on failure. The TUI records a semantic baseline at startup and checks display, host, and installation ownership within the same installation lock before saving. External changes during editing are rejected before backup or writing. Unrelated `settings.json` changes do not conflict and are preserved by merging into the latest file under the lock.

<a id="实验启动器与结果回传"></a>

### Experimental launchers and result bridging

This is not a native Claude Code TUI extension and does not bypass hook terminal isolation. Claude Code 2.1.259 command hooks run in a new session without a controlling terminal: hooks and children cannot open `/dev/tty`, and `terminalSequence` cannot draw curses. The slash command therefore serves only as a local launcher for existing `claude-statusline configure` in another supported terminal. It reuses the existing state machine, sample preview, concurrency detection, and atomic save.

Linux chooses launchers in this order:

1. If `TMUX` and `TMUX_PANE` shaped as `%<digits>` are valid, `tmux` is executable, and a read-only preflight check resolves the pane in the current server within 2 seconds, open a `90% × 90%` popup titled `Configure Status Line` in the current client. tmux pauses underlying pane updates while the popup exists, and closes it automatically when the child exits.
2. If tmux is unavailable or preflight fails, but `DISPLAY`/`WAYLAND_DISPLAY` and executable `gnome-terminal` are available, open an active tab in the most recently used GNOME Terminal window. GNOME may create a window if none exists. `--wait` waits for the tab's TUI to exit.
3. If neither is available, block slash expansion without calling the model and suggest terminal `claude-statusline configure` or `/statusline-config`.

macOS prefers the same tmux path. Without a valid server/pane or after failed preflight, a read-only `launchctl print gui/<uid>` check with a 2-second limit verifies the local graphical session, alongside system Terminal.app and `open`. SSH does not launch desktop Terminal, and macOS never selects GNOME.

The Terminal path uses `/usr/bin/open -b com.apple.Terminal` to open a private `0700` `.command` file, which starts the current Python and the package's internal helper. Python, CLI, configuration directory, and working directory are absolute; PATH and package search paths are explicit, and all shell values are quoted. `open` returning success means only that the launch request was handled. A 30-second startup handshake verifies editor process identity, then the existing schema v1 result bridge waits for TUI completion. No AppleScript automation permission is required, and Terminal window preferences are not modified.

The editor periodically checks parent-call process identity, request file, and deadline, and rechecks them before saving under the configuration transaction lock. Window closure, interruption, parent-call exit, revocation, or timeout prevents further draft saves. Cleanup verifies PID and start identity and handles only this editor; after reading the result, it removes this call's script, request, handshake, and result files. Terminal's window closure or retention follows user preferences.

Windows does not probe tmux/GNOME. It starts an actual Python child with the current virtual environment's `sys.executable -m claude_statusline configure --config-dir ...` and [`CREATE_NEW_CONSOLE`](https://learn.microsoft.com/en-us/windows/console/creation-of-a-console), without redirecting stdin/stdout/stderr, so curses has a real console. The current system default terminal hosts it; Windows Terminal handles it naturally when set as default. The launcher retains the child handle, so window closure or abnormal exit immediately returns an error, and timeouts terminate and reap the child.

Only tmux popup resembles a popup in the same pane; GNOME uses a new tab. There are no automatic launchers for `x-terminal-emulator`, Konsole, Kitty, WezTerm, or iTerm2; use standalone `configure` there. Hook payload `cwd` is used only when it is an existing absolute directory, otherwise the user's home is used. Command arguments and cwd are never concatenated into unescaped shell text.

`/statusline-configure` accepts no arguments. `help`, `-h`, and `--help` return only `Usage: /statusline-configure`; other arguments are rejected. None of these argument cases starts a TUI, writes configuration, or calls the model.

Each call creates a random directory under `statusline_runtime/slash_tui/` in the Claude configuration directory. Linux/macOS verify directory `0700` and write results with `0600`; Windows does not interpret simulated POSIX mode. Result reads verify exact parent-child paths, regular files, and a 16 KiB limit, rejecting symlinks, junctions, and other reparse points throughout the path chain. Only the current call is cleaned up after reading. Hook-captured tmux/GNOME client stdout/stderr is length-limited; Terminal.app and Windows console TUIs use their own real terminal streams.

Claude's hook timeout is 600 seconds. The bridged TUI times out after 570 seconds without saving; the launcher waits at most 585 seconds, leaving time for validation and hook return. Saving, no changes, cancellation, signal interruption, timeout, and errors produce a short result in the original Claude conversation. Once tmux is chosen, failure inside its popup never starts another terminal.

If global `disableAllHooks` or similar settings prevent the local hook, the fallback skill explains that it did not run and suggests the standalone command or `/statusline-config`. It prohibits launching curses through both Bash and PowerShell. This exception may still use a very short model turn, which the plugin cannot avoid.

<a id="相关文档"></a>


<a id="native-editor-preview"></a>

## Native configuration editor

### v1.3.0a1 editor preview

The [v1.3.0a1 preview](https://github.com/fbincon/claude-code-statusline/releases/tag/v1.3.0a1) replaces the project dropdown with direct checked rows, horizontal tabs, paged content and a bounded bottom preview. Enter toggles the focused item; `p/n` page, `u/d` reorder, `s` saves and continues, and `f` saves and closes. Settings folds theme/verbose behind `h`; `a` applies them separately. The body needs at least 32 columns × 12 rows. Native Tab/arrows keep their host meanings. See the [complete controls and boundaries](development/native.md#editor-behavior).

```bash
pipx install --force "https://github.com/fbincon/claude-code-statusline/releases/download/v1.3.0a1/claude_code_statusline-1.3.0a1-py3-none-any.whl"
claude-statusline install --native-editor
claude-statusline doctor
```

Restart Claude Code in a trusted terminal. This preview requires explicit native enablement and leaves **v1.2.0 as the latest stable release**. New Linux/Windows/macOS human acceptance remains pending; the old UI's acceptance does not cover the redesign.

The standalone TUI and wizard remain available. Stable v1.2.0 still prefers the original native editor; `install --no-native-editor` disables native and restores the compatibility launcher only when its experimental preference is enabled.

## Related documentation

The [native configuration editor](development/native.md) provides Main, Subagents and Settings in a source-loaded Mod, with revision-protected saves and separate host preferences. Stable installation remains v1.2.0; native preview installation is opt-in and human editor acceptance remains a separate gate.

- [Project README](../README.md): introduction, screenshots, and quick installation.
- [Claude Code:Customize your status line](https://code.claude.com/docs/en/statusline)
- [Claude Code:Hooks reference](https://code.claude.com/docs/en/hooks)
- [Claude Code:Automate workflows with hooks](https://code.claude.com/docs/en/hooks-guide)
