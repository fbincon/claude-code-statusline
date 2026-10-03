# Claude Code Statusline

**English** | [简体中文](README.zh-CN.md)

A Claude Code status line for Linux, WSL, Windows, and macOS. It shows model and reasoning effort, working directory, Git, context, rate limits, tokens, and per-turn timing. Individual subagent rows are supported. Configure items, order, and styles through a terminal UI (TUI), a wizard inside Claude Code, or the command line.

[Quick installation](#quick-installation) · [Common configuration](#common-configuration) · [User guide](docs/USER_GUIDE.md) · [Troubleshooting](docs/USER_GUIDE.md#troubleshooting) · [Report an issue](https://github.com/fbincon/claude-code-statusline/issues)

<a id="界面预览"></a>

## Screenshots

These screenshots show actual Linux, macOS, and Windows terminals. The main status line shows session data; the configuration UI's Preview uses fixed sample data. Fonts, colors, and character widths depend on terminal settings.

**Linux main status line**

![Claude Code main status line: model and effort, directory, Git, context, tokens, and per-turn timing](docs/images/statusline.png)

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

<a id="支持范围"></a>

## Supported platforms

- Native Linux and WSL: Python 3.10+.
- Native Windows 10/11: CPython 3.10–3.14, x86/x64; automatically installs `windows-curses>=2.4.2`.
- macOS 14+: CPython 3.10–3.14, Intel / Apple Silicon. Core functionality and the standalone TUI are supported; the experimental configuration entry point prefers tmux popup, otherwise local Terminal.app.
- Claude Code CLI: 2.1.205+ supports individual subagent rows; 2.1.258+ supports local execution of configuration commands with arguments and the experimental TUI launcher. Older or unrecognized versions can still use the main status line and configuration wizard.
- Git information requires `git` on the system.

The current stable release is [**v1.2.0**](https://github.com/fbincon/claude-code-statusline/releases/tag/v1.2.0), with the same wheel for all these platforms. Native Windows ARM64 Python is not currently guaranteed; ARM devices should use x64 Python emulation. See [requirements](docs/USER_GUIDE.md#requirements) for feature-specific version thresholds.

<a id="快速安装"></a>

## Quick installation

Prepare Python, Claude Code CLI, and [pipx](https://pipx.pypa.io/latest/how-to/install-pipx.html). Stable v1.2.0 is available for Linux / WSL / macOS / Windows. See the [user guide](docs/USER_GUIDE.md#install-the-python-package) for installation sources and file verification.

<a id="从-release-安装推荐"></a>

### Install from a Release (recommended)

Install the [v1.2.0 wheel](https://github.com/fbincon/claude-code-statusline/releases/tag/v1.2.0) directly in Bash / Zsh or PowerShell:

```text
pipx install "https://github.com/fbincon/claude-code-statusline/releases/download/v1.2.0/claude_code_statusline-1.2.0-py3-none-any.whl"
pipx ensurepath
```

You can also download the wheel before installing; see the [user guide](docs/USER_GUIDE.md#install-the-python-package).

<a id="从固定标签源码安装"></a>

### Install source at a fixed tag

Requires `git`, without manually cloning or building:

```text
pipx install "git+https://github.com/fbincon/claude-code-statusline.git@v1.2.0"
pipx ensurepath
```

<a id="从当前源码安装"></a>

### Install current source

To follow development changes, install current default-branch source with Git in Bash / Zsh / PowerShell. `main` changes during development; use the Release or fixed tag above when you need a pinned version:

```text
pipx install "git+https://github.com/fbincon/claude-code-statusline.git@main"
pipx ensurepath
```

For a local checkout, run `pipx install .` in the project root. See [building and installing from source](docs/USER_GUIDE.md#build-and-install-from-source) to build your own wheel, and [macOS installation notes](docs/USER_GUIDE.md#macos-installation-and-validation-boundaries) for terminal requirements.

<a id="接入-claude-code"></a>

### Integrate with Claude Code

After installing the package, **reopen your terminal** so the `PATH` changes from `pipx ensurepath` take effect. Confirm that `--version` prints `claude-statusline 1.2.0` before integrating with Claude Code.

Linux / WSL / macOS (Bash / Zsh):

```bash
claude-statusline --version
claude-statusline install --dry-run
claude-statusline install
claude-statusline doctor
```

Windows (PowerShell):

```powershell
claude-statusline.exe --version
claude-statusline.exe install --dry-run
claude-statusline.exe install
claude-statusline.exe doctor
```

`pipx install` installs the Python package; `claude-statusline install` integrates the status line and configuration entry points with Claude Code. The installer reports conflicts with another tool's status line or a skill with the same name. See [conflict handling](docs/USER_GUIDE.md#handle-an-existing-status-line-or-skill-with-the-same-name) when you intend to take ownership.

<a id="常用配置"></a>

## Common configuration

After installation, run `claude-statusline configure` in a terminal; on Windows, use `claude-statusline.exe configure`. The TUI opens in the current terminal, requires at least `64×18`, and supports item selection, ordering, and sample previews. Outside numeric editing, Enter saves all changes and Esc cancels; Ctrl+C interrupts without saving.

| Entry point | Purpose |
| --- | --- |
| `claude-statusline configure` | Configure main line, subagent rows, and styles through the TUI |
| `/statusline-config` inside Claude Code | Use the question-based wizard, or execute configuration commands with arguments |
| `claude-statusline config ...` | Inspect configuration, set exact order, or use scripts in a terminal |
| Experimental `/statusline-configure` | Launch the TUI in an external terminal from Claude Code; disabled by default; see [enabling instructions](docs/USER_GUIDE.md#experimental-statusline-configure-entry-point) |

For example, set a minimal status line on Linux / WSL / macOS:

```bash
claude-statusline config set-items model-with-effort current-dir git context-remaining prompt-timer
claude-statusline config set directory-style home
claude-statusline config show
```

On Windows, replace the command name with `claude-statusline.exe`. `set-items` replaces the entire enabled set; use `enable` and `disable` for incremental changes. See [configuration recipes](docs/USER_GUIDE.md#configuration-recipes) for more examples.

Configuration applies per user. Display preferences are stored in `claude-statusline.json` inside the Claude configuration directory. See [configuration files](docs/USER_GUIDE.md#configuration-files) for directory selection, defaults, and historical-format compatibility.

<a id="升级与卸载"></a>

## Upgrading and uninstalling

To upgrade to v1.2.0, replace the Python package (Bash / Zsh / PowerShell):

```text
pipx install --force "https://github.com/fbincon/claude-code-statusline/releases/download/v1.2.0/claude_code_statusline-1.2.0-py3-none-any.whl"
```

Then rerun `claude-statusline install` and `claude-statusline doctor`; on Windows, use `claude-statusline.exe`. Upgrades preserve display preferences and runtime state in the Claude configuration directory. See the [upgrade guide](docs/USER_GUIDE.md#upgrading) for local wheels, source installs, and version compatibility.

To uninstall, remove the Claude Code integration first, then the Python package.

Linux / WSL / macOS:

```bash
claude-statusline uninstall --dry-run
claude-statusline uninstall
pipx uninstall claude-code-statusline
```

Windows:

```powershell
claude-statusline.exe uninstall --dry-run
claude-statusline.exe uninstall
pipx uninstall claude-code-statusline
```

Display preferences, caches, backups, and experimental feature preferences remain. See [uninstallation](docs/USER_GUIDE.md#uninstalling).

<a id="文档与帮助"></a>


## Native configuration editor

[Captured native pages and provenance](docs/images/README.md#native-editor-captures).

v1.2.0 bundles a matching native Mod and prefers it by default on compatible Claude Code 2.1.287+ hosts. Explicit native disablement and external plugin disablement remain respected. The installation above already performs this integration; use the commands below to explicitly enable or diagnose it.

```bash
pipx install --force "https://github.com/fbincon/claude-code-statusline/releases/download/v1.2.0/claude_code_statusline-1.2.0-py3-none-any.whl"
claude-statusline install --native-editor
claude-statusline doctor
```

Restart Claude Code 2.1.287+ in a trusted terminal, then run `/statusline-configure` or its alias `/statusline-configure-native`. Main/Subagents support selections, ordering and sample preview; Settings contains the nine existing tool settings and separate theme/verbose host preferences. `1/2/3` switch pages, Tab/Enter operate host controls, `s` saves tool configuration and leaves the pane open, `a` applies host preferences, and Esc/`q` discard pending changes. Esc first exits an input. See [native editor behavior](docs/development/native.md).

Stable installs prefer native; prereleases require explicit enablement. `install --no-native-editor` persists a disabled preference and removes owned native integration. The compatibility `/statusline-configure` launcher is restored only if its experimental preference is enabled. The wizard `/statusline-config` and standalone `claude-statusline configure` remain available. Installation failures retain compatibility configuration and report the actual native state; retry after checking doctor. The maintainer confirmed the full native human checklist on Linux, Windows 11 and macOS 14.5. Architecture/terminal metadata was not supplied for Windows/macOS; see the recorded acceptance limits in the native guide.

## Documentation and help

- [User guide](docs/USER_GUIDE.md): installation, TUI, CLI, display items, and configuration reference.
- [Diagnostics and troubleshooting](docs/USER_GUIDE.md#troubleshooting): start with `doctor`, then follow the relevant symptom.
- [Development and testing](docs/USER_GUIDE.md#appendix-development-and-testing) · [Release guide](docs/RELEASING.md) · [Changelog](CHANGELOG.md).
- [Architecture](docs/development/architecture.md) · [Validation](docs/development/testing.md) · [Timer metrics and evidence](docs/development/timer.md).
- [Native configuration editor](docs/development/native.md): source Main/Subagents/Settings pages, revision-protected saves and separate host preferences; human acceptance confirmed on Linux, Windows 11 and macOS 14.5.
- [Shared configuration protocol](docs/development/contracts.md): item catalog and internal JSON describe/read/preview/apply contracts for source development.
- [GitHub Issues](https://github.com/fbincon/claude-code-statusline/issues): include your OS, Python/Claude Code/tool versions, reproduction steps, and diagnostic output with private paths and session content removed.

<a id="许可证"></a>

## License

This project uses the [MIT License](LICENSE). Copyright (c) 2026 [fbincon](https://github.com/fbincon).
