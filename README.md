# Claude Code Statusline

**English** | [简体中文](https://github.com/fbincon/claude-code-statusline/blob/main/README.zh-CN.md)

[![CI](https://github.com/fbincon/claude-code-statusline/actions/workflows/ci.yml/badge.svg)](https://github.com/fbincon/claude-code-statusline/actions/workflows/ci.yml)
[![Native Mod](https://github.com/fbincon/claude-code-statusline/actions/workflows/native.yml/badge.svg)](https://github.com/fbincon/claude-code-statusline/actions/workflows/native.yml)
[PyPI](https://pypi.org/project/fbincon-claude-code-statusline/)
[MIT License](https://github.com/fbincon/claude-code-statusline/blob/main/LICENSE)

A Claude Code status line for Linux, WSL, Windows, and macOS. See model and reasoning effort, directory, Git, context, usage limits, tokens, and task timing at a glance. Configure the main line and individual subagent rows through an in-session editor, a terminal UI, a wizard, or the CLI.

[Features](https://github.com/fbincon/claude-code-statusline/blob/main/README.md#features) · [Screenshots](https://github.com/fbincon/claude-code-statusline/blob/main/README.md#screenshots) · [Quick installation](https://github.com/fbincon/claude-code-statusline/blob/main/README.md#quick-installation) · [Common configuration](https://github.com/fbincon/claude-code-statusline/blob/main/README.md#common-configuration) · [User guide](https://github.com/fbincon/claude-code-statusline/blob/main/docs/USER_GUIDE.md) · [Troubleshooting](https://github.com/fbincon/claude-code-statusline/blob/main/docs/USER_GUIDE.md#troubleshooting)

<a id="phase-4-in-stable-v150"></a>
<a id="phase-5-in-stable-v160"></a>
<a id="v161-clearer-external-tui-sections"></a>

## Features

- **Choose what to show:** 60 main-line items and 14 subagent items; enable, hide, search, and reorder them.
- **Track the right scope:** session token totals, per-task subagent rows, and total task time covering queueing, agents and main-agent wrap-up; optional execution time excludes verified user waits.
- **Adjust presentation:** model and number formats, labels, built-in icons, colors, directory styles, and automatic or explicit rows with priorities and width limits.
- **Start from a preset:** minimal, developer, monitoring, and multi-agent presets expand into editable settings; import and export portable JSON.
- **Choose an editor:** Main, Subagents, Settings, and Layout pages share the same configuration. Claude appearance and behavior preferences use a separate Apply action.
- **Enable optional live metrics:** runtime state, agent count, tool progress, request timing, and per-task usage are opt-in. Missing or partial observations stay distinguishable.

Rendering uses Claude Code input and local state without making network requests or using model tokens. The question-and-answer wizard uses Claude model turns. See [field definitions](https://github.com/fbincon/claude-code-statusline/blob/main/docs/DISPLAY_ITEMS.md) for data sources and availability.

<a id="界面预览"></a>

## Screenshots

The main status line at the bottom of session screenshots shows actual data; configuration Preview regions use fixed samples. Fonts, colors and widths depend on terminal settings. [Image sources and archive](https://github.com/fbincon/claude-code-statusline/blob/main/docs/images/README.md).

### In-session TUI

Run `/statusline-configure-native` inside the current Claude Code session, then click the Client region once before using the keyboard.

**Linux: Main and the status line**

![Linux in-session TUI Main page and actual main status line](https://raw.githubusercontent.com/fbincon/claude-code-statusline/main/docs/images/tui/native/linux/main.png)

<details>
<summary>Linux: Subagents, Settings, Layout</summary>

**Subagents: choose items and ordering for individual agent rows.**

![Linux in-session TUI Subagents page with sample preview](https://raw.githubusercontent.com/fbincon/claude-code-statusline/main/docs/images/tui/native/linux/subagents.png)

**Settings: adjust appearance, refresh behavior and formatting.**

![Linux in-session TUI Settings page with sample preview](https://raw.githubusercontent.com/fbincon/claude-code-statusline/main/docs/images/tui/native/linux/settings.png)

**Layout: set rows, item priorities and maximum widths.**

![Linux in-session TUI Layout page with sample preview](https://raw.githubusercontent.com/fbincon/claude-code-statusline/main/docs/images/tui/native/linux/layout.png)

</details>

<details>
<summary>Windows: Main, Subagents, Settings, Layout</summary>

**Main: select and reorder main status line items.**

![Windows in-session TUI Main page with sample preview](https://raw.githubusercontent.com/fbincon/claude-code-statusline/main/docs/images/tui/native/windows/main.png)

**Subagents: choose items and ordering for individual agent rows.**

![Windows in-session TUI Subagents page with sample preview](https://raw.githubusercontent.com/fbincon/claude-code-statusline/main/docs/images/tui/native/windows/subagents.png)

**Settings: adjust appearance, refresh behavior and formatting.**

![Windows in-session TUI Settings page with sample preview](https://raw.githubusercontent.com/fbincon/claude-code-statusline/main/docs/images/tui/native/windows/settings.png)

**Layout: set rows, item priorities and maximum widths.**

![Windows in-session TUI Layout page with sample preview](https://raw.githubusercontent.com/fbincon/claude-code-statusline/main/docs/images/tui/native/windows/layout.png)

</details>

<details>
<summary>macOS: Main</summary>

Only Main was supplied for this batch. The existing interaction limitation and checks are documented in [macOS mouse reporting and Client focus](https://github.com/fbincon/claude-code-statusline/blob/main/docs/USER_GUIDE.md#macos-mouse-reporting-and-client-focus).

**Main: select and reorder main status line items.**

![macOS in-session TUI Main page with sample preview](https://raw.githubusercontent.com/fbincon/claude-code-statusline/main/docs/images/tui/native/macos/main.png)

</details>

### External TUI

Run `/statusline-configure` in Claude Code, or `claude-statusline configure` in a standalone terminal.

<details>
<summary>Linux: Main, Subagents, Settings, Layout</summary>

**Main: select and reorder main status line items.**

![Linux external TUI Main page with sample preview](https://raw.githubusercontent.com/fbincon/claude-code-statusline/main/docs/images/tui/external/linux/main.png)

**Subagents: choose items and ordering for individual agent rows.**

![Linux external TUI Subagents page with sample preview](https://raw.githubusercontent.com/fbincon/claude-code-statusline/main/docs/images/tui/external/linux/subagents.png)

**Settings: adjust appearance, refresh behavior and formatting.**

![Linux external TUI Settings page with sample preview](https://raw.githubusercontent.com/fbincon/claude-code-statusline/main/docs/images/tui/external/linux/settings.png)

**Layout: set rows, item priorities and maximum widths.**

![Linux external TUI Layout page with sample preview](https://raw.githubusercontent.com/fbincon/claude-code-statusline/main/docs/images/tui/external/linux/layout.png)

</details>

<details>
<summary>Windows: Main, Subagents, Settings, Layout</summary>

**Main: select and reorder main status line items.**

![Windows external TUI Main page with sample preview](https://raw.githubusercontent.com/fbincon/claude-code-statusline/main/docs/images/tui/external/windows/main.png)

**Subagents: choose items and ordering for individual agent rows.**

![Windows external TUI Subagents page with sample preview](https://raw.githubusercontent.com/fbincon/claude-code-statusline/main/docs/images/tui/external/windows/subagents.png)

**Settings: adjust appearance, refresh behavior and formatting.**

![Windows external TUI Settings page with sample preview](https://raw.githubusercontent.com/fbincon/claude-code-statusline/main/docs/images/tui/external/windows/settings.png)

**Layout: set rows, item priorities and maximum widths.**

![Windows external TUI Layout page with sample preview](https://raw.githubusercontent.com/fbincon/claude-code-statusline/main/docs/images/tui/external/windows/layout.png)

</details>

<details>
<summary>macOS: Main, Subagents, Settings, Layout</summary>

**Main: select and reorder main status line items.**

![macOS external TUI Main page with sample preview](https://raw.githubusercontent.com/fbincon/claude-code-statusline/main/docs/images/tui/external/macos/main.png)

**Subagents: choose items and ordering for individual agent rows.**

![macOS external TUI Subagents page with sample preview](https://raw.githubusercontent.com/fbincon/claude-code-statusline/main/docs/images/tui/external/macos/subagents.png)

**Settings: adjust appearance, refresh behavior and formatting.**

![macOS external TUI Settings page with sample preview](https://raw.githubusercontent.com/fbincon/claude-code-statusline/main/docs/images/tui/external/macos/settings.png)

**Layout: set rows, item priorities and maximum widths.**

![macOS external TUI Layout page with sample preview](https://raw.githubusercontent.com/fbincon/claude-code-statusline/main/docs/images/tui/external/macos/layout.png)

</details>

Earlier screenshots and terminal reconstructions remain in the [archive](https://github.com/fbincon/claude-code-statusline/blob/main/docs/images/archive/README.md).

## Supported platforms

| Platform | Supported environment |
| --- | --- |
| Linux / WSL | Python 3.10+ |
| Windows 10/11 | CPython 3.10–3.14, x86/x64; `windows-curses>=2.4.2` installs automatically |
| macOS 14+ | CPython 3.10–3.14, Intel / Apple Silicon |

Windows ARM devices can use x64 Python emulation; native ARM64 Python is outside the current support contract. Git information requires `git`.

Claude Code feature requirements: subagent rows 2.1.205+; local argument-based configuration and external TUI entry 2.1.258+; in-session Client 2.1.287+; native timing and advanced live-metrics collection 2.1.289+. Unsupported or unknown host versions suspend the corresponding integration. See [requirements](https://github.com/fbincon/claude-code-statusline/blob/main/docs/USER_GUIDE.md#requirements).

<a id="install-current-source"></a>
<a id="install-from-a-release-recommended"></a>
<a id="install-source-at-a-fixed-tag"></a>
<a id="从-release-安装推荐"></a>
<a id="从固定标签源码安装"></a>
<a id="从当前源码安装"></a>
<a id="升级与卸载"></a>
<a id="常用配置"></a>
<a id="快速安装"></a>
<a id="接入-claude-code"></a>
<a id="支持范围"></a>
<a id="文档与帮助"></a>
<a id="许可证"></a>

## Quick installation

Install Python, Claude Code CLI, and [pipx](https://pipx.pypa.io/latest/how-to/install-pipx.html). All supported platforms use the same wheel.

### Install the package

Bash, Zsh, and PowerShell:

```text
pipx install fbincon-claude-code-statusline
pipx ensurepath
```

### Integrate with Claude Code

Reopen the terminal so PATH changes take effect, then run:

```text
claude-statusline --version
claude-statusline install --dry-run
claude-statusline install
claude-statusline doctor
```

On Windows, use `claude-statusline.exe`. Restart Claude Code in a trusted terminal after integration.

Both editors default on for compatible hosts, respecting saved disablement preferences. Native timing metadata defaults on for Claude Code 2.1.289+; advanced live metrics remain opt-in. Package installation and Claude integration are separate steps; `install` does not open an editor. Existing conflicting resources require [explicit handling](https://github.com/fbincon/claude-code-statusline/blob/main/docs/USER_GUIDE.md#handle-an-existing-status-line-or-skill-with-the-same-name).

<details>
<summary>Other installation methods</summary>

Install the development source (requires Git):

```text
pipx install "git+https://github.com/fbincon/claude-code-statusline.git@main"
```

Run `pipx install .` from a local checkout. Fixed-tag installation and verified Release wheels are covered in the installation guide. Then run `pipx ensurepath` and complete integration above.

Download checksums and platform-specific instructions are in the [installation guide](https://github.com/fbincon/claude-code-statusline/blob/main/docs/USER_GUIDE.md#installation-and-integration); source builds are in the [development guide](https://github.com/fbincon/claude-code-statusline/blob/main/docs/development/README.md#build-and-install-from-source).

</details>

## Common configuration

| Entry point | Use |
| --- | --- |
| `/statusline-configure-native` | Client TUI in the current session; see [native editor](https://github.com/fbincon/claude-code-statusline/blob/main/docs/USER_GUIDE.md#native-configuration-editor) |
| `/statusline-configure` | TUI in a supported external terminal; see [external entry](https://github.com/fbincon/claude-code-statusline/blob/main/docs/USER_GUIDE.md#external-terminal-statusline-configure) |
| `claude-statusline configure` | Full TUI in the current standalone terminal |
| `/statusline-config` | Claude question-and-answer wizard; supported argument-based commands execute locally on compatible hosts |
| `claude-statusline config ...` | Inspect settings, set exact ordering, or configure from scripts |

<a id="v130a2-external-tui-and-in-session-client"></a>

### Native configuration editor

Click the Client region once. Use Tab to change pages, Space to toggle, arrows to select or reorder, Ctrl+E for item formatting, and `/` to search. `S` saves and stays, `F` saves and closes, and `Q` discards unsaved changes; lowercase letters work too. Footer controls follow the current page or input mode. Ctrl+G cancels input. Claude preferences apply separately.

### External and standalone terminal TUI

Use Tab to change pages, Space to toggle, and arrows to select or reorder. Ctrl+S saves after field input is finished; Enter saves on item and original settings rows, or edits/confirms advanced fields. Esc cancels input first, then cancels the editor; Ctrl+C interrupts without saving. The minimum terminal size is 64×18.

The external entry uses tmux or GNOME Terminal on Linux, tmux or Terminal.app on macOS, and the system's new-console launcher on Windows. For SSH or unavailable launchers, run `claude-statusline configure` in the current terminal.

Define a compact main line:

```text
claude-statusline config set-items model-with-effort current-dir git context-remaining task-timer
claude-statusline config set directory-style home
claude-statusline config show
```

Configuration is per user. `set-items` replaces the enabled set; `enable` and `disable` make incremental changes. See [recipes](https://github.com/fbincon/claude-code-statusline/blob/main/docs/USER_GUIDE.md#configuration-recipes), [formatting and layouts](https://github.com/fbincon/claude-code-statusline/blob/main/docs/USER_GUIDE.md#formatting-layout-presets), and the [CLI reference](https://github.com/fbincon/claude-code-statusline/blob/main/docs/reference/cli.md).

<a id="upgrade-to-v161"></a>

## Upgrading and uninstalling

Upgrade the package, synchronize integration, then restart Claude Code:

```text
pipx upgrade fbincon-claude-code-statusline
claude-statusline install
claude-statusline doctor
```

Existing wheel installations from this repository should first follow the [package-name migration](https://github.com/fbincon/claude-code-statusline/blob/main/docs/USER_GUIDE.md#migrate-the-previous-distribution-name). Saved display settings, runtime state, and integration preferences remain. For older display schemas or package downgrade, follow [version compatibility](https://github.com/fbincon/claude-code-statusline/blob/main/docs/USER_GUIDE.md#version-compatibility).

Remove Claude integration before uninstalling the package:

```text
claude-statusline uninstall --dry-run
claude-statusline uninstall
pipx uninstall fbincon-claude-code-statusline
```

Display settings and backups remain available; see [uninstalling](https://github.com/fbincon/claude-code-statusline/blob/main/docs/USER_GUIDE.md#uninstalling).

## Project structure

```text
claude-code-statusline/
├── .github/workflows/
│   ├── ci.yml
│   ├── native.yml
│   └── publish.yml
├── README.md / README.zh-CN.md
├── CHANGELOG.md / CHANGELOG.zh-CN.md
├── LICENSE
├── MANIFEST.in
├── pyproject.toml
├── docs/
│   ├── USER_GUIDE.md / USER_GUIDE.zh-CN.md
│   ├── reference/                  # CLI and configuration reference
│   ├── images/                     # Current screenshots and archive
│   │   ├── tui/
│   │   │   ├── native/
│   │   │   └── external/
│   │   └── archive/
│   ├── development/                # Setup, architecture and validation
│   └── releases/                   # Historical release notes
├── src/
│   ├── build_native.py
│   └── claude_statusline/
│       ├── config/
│       ├── integration/
│       ├── platforms/
│       ├── rendering/
│       ├── runtime/
│       │   ├── live/
│       │   ├── tasks/
│       │   ├── timing/
│       │   └── turns/
│       ├── resources/
│       └── ui/
├── mods/
│   ├── statusline-native/
│   └── statusline-runtime/
├── tests/
│   ├── config/
│   ├── integration/
│   ├── platforms/
│   ├── rendering/
│   ├── runtime/
│   └── ui/
└── tools/
    ├── inspect_dist.py
    ├── publish_package.py
    └── check_docs.py
```

## Documentation and help

- [User guide](https://github.com/fbincon/claude-code-statusline/blob/main/docs/USER_GUIDE.md): installation, editors, recipes, upgrades, and troubleshooting.
- [CLI reference](https://github.com/fbincon/claude-code-statusline/blob/main/docs/reference/cli.md): commands, options, fields, files, and exit codes.
- [Display items and metric definitions](https://github.com/fbincon/claude-code-statusline/blob/main/docs/DISPLAY_ITEMS.md): scope, sources, and availability.
- [Development guide](https://github.com/fbincon/claude-code-statusline/blob/main/docs/development/README.md) · [Release process](https://github.com/fbincon/claude-code-statusline/blob/main/docs/RELEASING.md).
- [Changelog](https://github.com/fbincon/claude-code-statusline/blob/main/CHANGELOG.md) · [Releases](https://github.com/fbincon/claude-code-statusline/releases).
- [GitHub Issues](https://github.com/fbincon/claude-code-statusline/issues): include versions, reproduction steps, and diagnostic results; remove private paths and session content.

## License

[MIT License](https://github.com/fbincon/claude-code-statusline/blob/main/LICENSE). Copyright (c) 2026 [fbincon](https://github.com/fbincon).
