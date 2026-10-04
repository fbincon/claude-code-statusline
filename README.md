# Claude Code Statusline

**English** | [简体中文](README.zh-CN.md)

A Claude Code status line for Linux, WSL, Windows, and macOS. It shows model and reasoning effort, working directory, Git, context, rate limits, tokens, and per-turn timing. Individual subagent rows are supported. Configure items, order, and styles through a terminal UI (TUI), a wizard inside Claude Code, or the command line.

[Quick installation](#quick-installation) · [Common configuration](#common-configuration) · [User guide](docs/USER_GUIDE.md) · [Troubleshooting](docs/USER_GUIDE.md#troubleshooting) · [Report an issue](https://github.com/fbincon/claude-code-statusline/issues)

<a id="界面预览"></a>

## Screenshots

The actual terminal screenshots below show Linux, macOS, and Windows sessions. The main status line shows session data; the configuration UI's Preview uses fixed sample data. Historical Linux Client captures are terminal-cell reconstructions, with provenance in the image index. Fonts, colors, and character widths depend on terminal settings.

**Linux main status line**

![Claude Code main status line: model and effort, directory, Git, context, tokens, and per-turn timing](docs/images/statusline.png)

<details>
<summary>In-session configuration TUI: Linux, Windows, and macOS (actual terminal screenshots)</summary>

Use `/statusline-configure-native` to open the Client TUI inside the current Claude Code session. These screenshots show Claude Code 2.1.289; the configuration Preview uses sample data.

**Linux: the maintainer reports normal interaction.**

![Linux Claude Code session with the conversation and in-session Client Main configuration page](docs/images/client-session-linux.png)

**Windows: the maintainer reports normal interaction.**

![Windows Claude Code session with the conversation and in-session Client Main configuration page](docs/images/client-session-windows.png)

**macOS: the pane opens, but the maintainer reports interaction problems; a working configuration has not been verified.**

![macOS Claude Code session with the Client Main configuration page open inline](docs/images/client-session-macos.png)

See [macOS mouse reporting and Client focus](docs/USER_GUIDE.md#macos-mouse-reporting-and-client-focus) for suggested checks and [screenshot provenance](docs/images/README.md#in-session-client-screenshots) for the supplied images and their limits.

</details>

<details>
<summary>Linux: Main, Subagents, and Settings configuration pages</summary>

**Main: select main status line items and change their order.**

![Main configuration page: main status line items and sample preview](docs/images/configure-main.png)

**Subagents: configure subagent row items and order.**

![Subagents configuration page: subagent items and sample preview](docs/images/configure-subagents.png)

**Settings: change colors, directory style, separators, refresh interval, and other options.**

![Settings configuration page: display styles and Claude Code host options](docs/images/configure-settings.png)

</details>

<details>
<summary>macOS: main status line and all three configuration pages in Terminal.app</summary>

**Main status line**

![Claude Code main status line in macOS Terminal.app](docs/images/statusline-macos.png)

**Main: main status line items and sample preview**

![macOS Main configuration page](docs/images/configure-main-macos.png)

**Subagents: subagent rows and sample preview**

![macOS Subagents configuration page](docs/images/configure-subagents-macos.png)

**Settings: display styles and host settings**

![macOS Settings configuration page](docs/images/configure-settings-macos.png)

</details>

<details>
<summary>Windows: main status line and all three configuration pages in Windows Terminal</summary>

**Main status line**

![Claude Code main status line in Windows Terminal](docs/images/statusline-windows.png)

**Main: main status line items and sample preview**

![Windows Main configuration page](docs/images/configure-main-windows.png)

**Subagents: subagent rows and sample preview**

![Windows Subagents configuration page](docs/images/configure-subagents-windows.png)

**Settings: display styles and host settings**

![Windows Settings configuration page](docs/images/configure-settings-windows.png)

</details>

[Image file index](docs/images/README.md)

<details>
<summary>In-session Client: Main, Subagents, Settings (reconstructed a2 captures; stable keeps the same interaction)</summary>

![Client Main: grouped items and sample preview](docs/images/client-main-v1.3.0a2-linux.png)

![Client Subagents page](docs/images/client-subagents-v1.3.0a2-linux.png)

![Client Settings: grouped and aligned columns](docs/images/client-settings-v1.3.0a2-linux.png)

[Capture provenance and human acceptance](docs/images/README.md#v130a2-client-captures).

</details>


<a id="支持范围"></a>

## Supported platforms

- Native Linux and WSL: Python 3.10+.
- Native Windows 10/11: CPython 3.10–3.14, x86/x64; installs `windows-curses>=2.4.2` automatically. ARM devices can use x64 Python emulation.
- macOS 14+: CPython 3.10–3.14, Intel / Apple Silicon.
- Claude Code 2.1.205+ supports subagent rows; 2.1.258+ supports the external TUI entry and local configuration commands with arguments; 2.1.287+ supports the in-session Client.
- Unsupported or unrecognized hosts suspend the affected entries; the main status line, standalone TUI, wizard and CLI remain available. Git information requires `git`.

The current stable release is [**v1.3.0**](https://github.com/fbincon/claude-code-statusline/releases/tag/v1.3.0), using the same wheel across platforms. At stable promotion, the maintainer confirmed v1.3.0a2 human acceptance on Linux, Windows and macOS; stable retains that Client interaction. A later report with Claude Code 2.1.289 confirms normal Linux/Windows interaction but unresolved macOS input problems; see [macOS checks](docs/USER_GUIDE.md#macos-mouse-reporting-and-client-focus) and [requirements](docs/USER_GUIDE.md#requirements).

<a id="快速安装"></a>

## Quick installation

Prepare Python, Claude Code CLI and [pipx](https://pipx.pypa.io/latest/how-to/install-pipx.html). Download verification, platform steps and builds are in the [user guide](docs/USER_GUIDE.md#install-the-python-package).

<a id="从-release-安装推荐"></a>

### Install from a Release (recommended)

Bash / Zsh / PowerShell:

```text
pipx install "https://github.com/fbincon/claude-code-statusline/releases/download/v1.3.0/claude_code_statusline-1.3.0-py3-none-any.whl"
pipx ensurepath
```

<a id="从固定标签源码安装"></a>

### Install source at a fixed tag

Requires Git:

```text
pipx install "git+https://github.com/fbincon/claude-code-statusline.git@v1.3.0"
pipx ensurepath
```

<a id="从当前源码安装"></a>

### Install current source

`main` changes during development; for a local checkout run `pipx install .` in its root:

```text
pipx install "git+https://github.com/fbincon/claude-code-statusline.git@main"
pipx ensurepath
```

<a id="接入-claude-code"></a>

### Integrate with Claude Code

Reopen the terminal for PATH changes and confirm `claude-statusline 1.3.0`:

```text
claude-statusline --version
claude-statusline install --dry-run
claude-statusline install
claude-statusline doctor
```

On Windows use `claude-statusline.exe`. Package installation and Claude integration are separate steps. Restart Claude Code in a trusted terminal afterward to load the plugin and commands. Stable defaults both entries on, preserving recorded disablement; unsupported hosts suspend them independently. Installation opens neither an editor nor another terminal. Foreign resources are checked by entry ownership; see [conflict handling](docs/USER_GUIDE.md#handle-an-existing-status-line-or-skill-with-the-same-name).

<a id="常用配置"></a>

## Common configuration

| Entry point | Purpose |
| --- | --- |
| `/statusline-configure-native` | Client TUI inside the current Claude Code session; default on, requires 2.1.287+; see [Native configuration editor](docs/USER_GUIDE.md#native-configuration-editor) |
| `/statusline-configure` | Existing TUI in a platform terminal; default on, requires 2.1.258+; see [external terminal entry](docs/USER_GUIDE.md#external-terminal-statusline-configure) |
| `claude-statusline configure` | Complete TUI in the current standalone terminal; Windows uses `claude-statusline.exe configure` |
| `/statusline-config` | Claude-driven wizard; arguments execute locally or in a model turn according to host capabilities |
| `claude-statusline config ...` | Inspect configuration, set exact order or run scripts |

<a id="v130a2-external-tui-and-in-session-client"></a>

### Native configuration editor

Run `/statusline-configure-native`, **click the Client region once**, then use Tab for pages, arrows for selection/order, Space for toggles, `/` for search and Ctrl+G to cancel input. `s` saves/continues, `f` saves/finishes and `q` discards/closes; Esc belongs to the host. Settings groups appearance, refresh/display behavior and advanced Claude preferences; preferences have a separate Apply. Minimum pane body: 32×12.

For macOS Terminal.app, check **View → Allow Mouse Reporting** before clicking the Client region. This permits mouse events; the running application must also enable mouse reporting. This suggested setup has not been verified as a fix for the reported macOS problem. See [macOS mouse reporting and Client focus](docs/USER_GUIDE.md#macos-mouse-reporting-and-client-focus) for the official references, iTerm2 checks and alternative configuration entry points.

### External and standalone terminal TUI

`/statusline-configure` retains Linux tmux / GNOME Terminal, macOS tmux / Terminal.app and Windows system-console launchers. `claude-statusline configure` uses the current terminal; minimum size is 64×18. Outside numeric editing Enter saves, Esc cancels and Ctrl+C interrupts without saving.

Both editors may open concurrently; revision checks reject stale saves rather than overwriting newer configuration. Reopening Native retains its draft; `r` explicitly discards/reloads after a conflict, and `k` checks an unknown save outcome first.

See [installation combinations and compatibility](docs/USER_GUIDE.md#editor-installation-combinations-and-compatibility) for defaults, all four modes and host downgrades. Disable independently:

```text
claude-statusline install --no-native-editor
claude-statusline install --no-experimental-slash-tui
```

The historical `--experimental-slash-tui` flag continues to control the external entry independently of `--native-editor`. Example minimal main line:

```text
claude-statusline config set-items model-with-effort current-dir git context-remaining prompt-timer
claude-statusline config set directory-style home
claude-statusline config show
```

Configuration applies per user. `set-items` replaces the enabled set; `enable` / `disable` make incremental changes. See [recipes](docs/USER_GUIDE.md#configuration-recipes).

<a id="升级与卸载"></a>

## Upgrading and uninstalling

Upgrade to v1.3.0:

```text
pipx install --force "https://github.com/fbincon/claude-code-statusline/releases/download/v1.3.0/claude_code_statusline-1.3.0-py3-none-any.whl"
claude-statusline install
claude-statusline doctor
```

On Windows use `claude-statusline.exe`, then restart Claude Code. Display configuration, runtime state and recorded independent preferences persist. Older external disable commands deleted the preference file: absence now follows the stable enabled default. Pass `--no-experimental-slash-tui` again to keep that entry off. See [upgrading](docs/USER_GUIDE.md#upgrading).

Remove Claude integration before the Python package:

```text
claude-statusline uninstall --dry-run
claude-statusline uninstall
pipx uninstall claude-code-statusline
```

Display preferences, feature preferences, caches and backups remain; see [uninstallation](docs/USER_GUIDE.md#uninstalling).

<a id="文档与帮助"></a>

## Documentation and help

- [User guide](docs/USER_GUIDE.md) · [Troubleshooting](docs/USER_GUIDE.md#troubleshooting) · [Changelog](CHANGELOG.md).
- [Native editor development and acceptance](docs/development/native.md) · [Architecture](docs/development/architecture.md) · [Shared protocol](docs/development/contracts.md).
- [Testing and acceptance](docs/development/testing.md) · [Timer metrics](docs/development/timer.md) · [Release guide](docs/RELEASING.md).
- [GitHub Issues](https://github.com/fbincon/claude-code-statusline/issues): include OS/versions, reproduction and diagnostics with private paths and session content removed.

<a id="许可证"></a>

## License

[MIT License](LICENSE). Copyright (c) 2026 [fbincon](https://github.com/fbincon).
