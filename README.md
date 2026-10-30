# Claude Code Statusline

**English** | [简体中文](README.zh-CN.md)

[![CI](https://github.com/fbincon/claude-code-statusline/actions/workflows/ci.yml/badge.svg)](https://github.com/fbincon/claude-code-statusline/actions/workflows/ci.yml)
[npm](https://www.npmjs.com/package/@fbincon/claude-code-statusline) · [MIT License](LICENSE)

A configurable Claude Code status line for Linux, WSL, Windows and macOS. See model and reasoning effort, project, Git, context, usage and task timing at a glance. Configure the main line and individual subagent rows in the current Claude session, a terminal editor or the CLI.

[Demonstrations](docs/SHOWCASE.md) · [Quick installation](#quick-installation) · [Common configuration](#common-configuration) · [User guide](docs/USER_GUIDE.md) · [Troubleshooting](docs/USER_GUIDE.md#troubleshooting)

<a id="phase-4-in-stable-v150"></a>
<a id="phase-5-in-stable-v160"></a>
<a id="v161-clearer-external-tui-sections"></a>

## Features

- **Choose what to see:** 65 main metrics and 15 subagent metrics, plus text and flexible spacers. Search names, IDs and descriptions across twelve languages. [Metric definitions](docs/DISPLAY_ITEMS.md).
- **Compose a readable display:** independent component copies, linked groups, explicit rows, left/right layout, conditional visibility, colors, gradients and adaptive percentage indicators. [Composition](docs/COMPOSITION.md) · [Appearance](docs/APPEARANCE.md).
- **Start from a scheme:** eight complete display schemes and six original presets remain editable. Save named schemes, bind projects and reuse selected styles or whole groups. [Schemes](docs/SCHEMES.md) · [Project bindings](docs/PROFILES.md).
- **Review before saving:** sample scenarios, width previews, import differences, shared undo/redo and current-file comparison help inspect a draft. [Draft history and reuse](docs/DRAFT_HISTORY.md).
- **Follow tasks and agents:** separate session and per-agent metrics, task timing through agent work and main wrap-up, and a searchable task-evidence viewer. [Task details](docs/TASK_DETAILS.md).
- **Add explicit data sources:** local JSON, GitHub checks and command values, with separately reviewed activation, refresh and optional links. [Extensions](docs/EXTENSIONS.md).
- **Choose interface and output languages independently:** English, 简体中文, 繁體中文（台灣）, 繁體中文（香港）, 日本語, 한국어, Español, Français, Deutsch, Português (Brasil), Русский and Bahasa Indonesia.
- **Diagnose and recover:** inspect supplied input, review package changes and restore compatible configuration backups explicitly. [Input diagnosis](docs/DIAGNOSTICS.md) · [Package management](docs/PACKAGE_MANAGEMENT.md).

Rendering reads Claude Code input and local state without network requests or model tokens. Optional source refresh is separate; the question-and-answer wizard uses Claude model turns. Missing observations remain distinguishable from zero.

<a id="界面预览"></a>

## Screenshots

The [complete demonstrations](docs/SHOWCASE.md) pair scene configurations with reproducible steps for setup, editing, tasks, sources and version review. The featured scenes use compact separators without Powerline. Each asset's package, input and capture type is recorded in the [showcase image index](docs/images/showcase/README.md); fixed samples are identified separately from live session observations.

![Daily development statusline with compact separators](docs/images/showcase/en/daily.png)

![Configuration workflow with preview and reviewed changes](docs/images/showcase/en/configure.gif)

### In-session TUI

Run `/statusline-configure-native` inside Claude Code and click the Client region once before using the keyboard. [Editor workflow](docs/USER_GUIDE.md#native-configuration-editor).

### External TUI

Run `claude-statusline configure` in a terminal, or `/statusline-configure` from Claude Code to open a supported external terminal. [Terminal workflow](docs/USER_GUIDE.md#standalone-interactive-tui).

[All current and historical images](docs/images/README.md) retain their original provenance. Historical cross-platform screenshots do not establish acceptance of a newer package; the six existing [issue #96 gaps](https://github.com/fbincon/claude-code-statusline/issues/96) remain unverified.

<a id="支持范围"></a>

## Supported platforms

| Platform | Supported environment |
| --- | --- |
| Linux / WSL | Node 22.x or 24.x, x64 |
| Windows 10/11 | Node 22.x or 24.x, x64 |
| macOS 14+ | Node 22.x or 24.x, Intel / Apple Silicon |

Windows ARM devices use x64 Node under emulation; native Windows ARM64 and 32-bit runtimes are outside the support contract. Git fields require Git. Claude Code requirements vary by feature: subagent rows 2.1.205+, local slash arguments/external entry 2.1.258+, in-session editor 2.1.287+, native timing/live metrics 2.1.289+. [Requirements and limitations](docs/USER_GUIDE.md#requirements).

<a id="install-current-source"></a>
<a id="install-from-a-release-recommended"></a>
<a id="install-source-at-a-fixed-tag"></a>
<a id="从-release-安装推荐"></a>
<a id="从固定标签源码安装"></a>
<a id="从当前源码安装"></a>
<a id="快速安装"></a>
<a id="接入-claude-code"></a>

## Quick installation

Install Node 22.x or 24.x with npm and Claude Code CLI. The package bundles its supported native dependencies and needs no Python or compiler.

### Install the package

In an interactive terminal, `npx @fbincon/claude-code-statusline` reviews a persistent installation before opening setup. Alternatively, install the package explicitly:

```text
npm install --global --ignore-scripts @fbincon/claude-code-statusline
```

### Integrate with Claude Code

Ensure the npm command directory is on PATH, then run:

```text
claude-statusline --version
claude-statusline setup --dry-run
claude-statusline setup
claude-statusline doctor
```

On Windows, use `claude-statusline.cmd`, or invoke the installed JavaScript entry with Node. Restart Claude Code in a trusted terminal after integration. Package installation, display Save and Claude integration are separate stages; setup reports partial completion if a later stage fails.

Both editors default on for compatible hosts and preserve saved choices. Native timing and advanced live metrics require explicit opt-in. See [first-use setup](docs/SETUP.md), [offline/fixed-version installation](docs/USER_GUIDE.md#installation-and-integration), [conflict handling](docs/USER_GUIDE.md#handle-an-existing-status-line-or-skill-with-the-same-name) and [Python migration](docs/USER_GUIDE.md#migrate-from-python).

<a id="常用配置"></a>

## Common configuration

| Entry point | Use |
| --- | --- |
| `/statusline-configure-native` | Edit in the current Claude session |
| `/statusline-configure` | Launch an editor in a supported external terminal |
| `claude-statusline configure` | Edit in the current terminal, including SSH |
| `/statusline-config` | Claude question-and-answer wizard; supported argument commands run locally |
| `claude-statusline config ...` | Inspect settings or set exact values from scripts |

In either editor, **Ctrl+P** opens Quick setup to select a scheme, inspect requirements and preview the draft. Save applies it to the displayed user/profile/project target; cancel discards pending display changes. [Walkthroughs and reusable scenes](docs/SHOWCASE.md) · [All schemes](docs/SCHEMES.md).

<a id="v130a2-external-tui-and-in-session-client"></a>

### Interface language

Set the shared interface preference, or override it for one invocation:

```text
claude-statusline config language set zh-CN
claude-statusline --language en configure
```

An interface-language change saves immediately and survives cancellation of display edits. [Language choices](docs/USER_GUIDE.md#interface-language).

### Statusline language

Set output language independently:

```text
claude-statusline config set statusline-language zh-CN
```

In an editor, this choice changes the preview and takes effect in the actual main/subagent output only after display Save. Technical IDs, paths and custom text retain their values. [Output language](docs/USER_GUIDE.md#statusline-language).

### Native configuration editor

Click the Client region once. Tab changes pages, Space toggles, Ctrl+E opens item details, `/` searches and Ctrl+F filters categories. `S` saves and stays, `F` saves and closes, and `Q` discards the draft. Ctrl+G cancels field input. [Controls and recovery](docs/USER_GUIDE.md#native-configuration-editor).

### External and standalone terminal TUI

Tab changes pages, Space toggles, and Ctrl+S saves after field input is finished. Esc cancels a field first, then the editor; Ctrl+C interrupts without saving. The minimum size is 64×18. [Controls and terminal launchers](docs/USER_GUIDE.md#standalone-interactive-tui).

For a compact user-default display:

```text
claude-statusline config preset daily-development --dry-run
claude-statusline config preset daily-development
claude-statusline config set separator-style compact
```

Review before applying: a preset replaces display selections and layout. [Recipes](docs/USER_GUIDE.md#configuration-recipes) · [CLI reference](docs/reference/cli.md).

<a id="升级与卸载"></a>
<a id="upgrade-to-v161"></a>

## Upgrading and uninstalling

Review and apply a package change, then restart Claude Code:

```text
claude-statusline update --check
claude-statusline update
claude-statusline doctor
```

[Package management](docs/PACKAGE_MANAGEMENT.md) explains exact versions, prefixes, rollback and separate configuration restoration. Remove Claude integration before uninstalling the package:

```text
claude-statusline uninstall --dry-run
claude-statusline uninstall
npm uninstall --global @fbincon/claude-code-statusline
```

Display settings and backups remain. [Uninstalling](docs/USER_GUIDE.md#uninstalling).

## Project structure

The TypeScript workspace separates pure rules (`packages/core`), platform effects (`packages/platform`), application services (`packages/cli`) and the terminal editor (`packages/tui`). `mods` contains the official-host integrations; `tools` contains generation, packaging and acceptance tooling. `archive/python` preserves the frozen historical implementation. [Architecture](docs/development/architecture.md) · [Development setup](docs/development/README.md).

<a id="文档与帮助"></a>

## Documentation and help

| Goal | Start here |
| --- | --- |
| Try a complete workflow | [Demonstrations](docs/SHOWCASE.md) · [First-use setup](docs/SETUP.md) |
| Configure a display | [User guide](docs/USER_GUIDE.md) · [Schemes](docs/SCHEMES.md) · [Appearance](docs/APPEARANCE.md) · [Composition](docs/COMPOSITION.md) |
| Reuse settings | [Profiles and projects](docs/PROFILES.md) · [Draft history and reuse](docs/DRAFT_HISTORY.md) |
| Understand data | [Metric definitions](docs/DISPLAY_ITEMS.md) · [Task details](docs/TASK_DETAILS.md) · [Extensions](docs/EXTENSIONS.md) |
| Diagnose or automate | [Troubleshooting](docs/USER_GUIDE.md#troubleshooting) · [Input diagnosis](docs/DIAGNOSTICS.md) · [CLI reference](docs/reference/cli.md) |
| Develop or review evidence | [Development guide](docs/development/README.md) · [Image provenance](docs/images/README.md) |
| Follow plans or releases | [Roadmap](docs/development/roadmap.md) · [Development plan](docs/development/development-plan.md) · [Changelog](CHANGELOG.md) |

[GitHub Issues](https://github.com/fbincon/claude-code-statusline/issues) accepts reproducible bugs, questions and feature ideas. Include versions, steps and relevant diagnostics; remove private paths and session content.

## Contributing and security

See [Contributing](CONTRIBUTING.md) for development, translations and feedback. Report vulnerabilities privately through the [security policy](SECURITY.md).

<a id="许可证"></a>

## License

[MIT License](LICENSE). Copyright (c) 2026 [fbincon](https://github.com/fbincon).

Bundled Unicode data retains the [Unicode License v3](tools/unicode/UNICODE-LICENSE.txt) and the [wcwidth MIT notice](tools/unicode/WCWIDTH-LICENSE.txt).
