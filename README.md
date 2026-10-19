# Claude Code Statusline

**English** | [简体中文](README.zh-CN.md)

[![CI](https://github.com/fbincon/claude-code-statusline/actions/workflows/ci.yml/badge.svg)](https://github.com/fbincon/claude-code-statusline/actions/workflows/ci.yml)
[npm](https://www.npmjs.com/package/@fbincon/claude-code-statusline)
[MIT License](LICENSE)

A Claude Code status line for Linux, WSL, Windows, and macOS. See model and reasoning effort, directory, Git, context, usage limits, tokens, and task timing at a glance. Configure the main line and individual subagent rows through an in-session editor, a terminal UI, a wizard, or the CLI.

[Features](#features) · [Screenshots](#screenshots) · [Quick installation](#quick-installation) · [Common configuration](#common-configuration) · [User guide](docs/USER_GUIDE.md) · [Troubleshooting](docs/USER_GUIDE.md#troubleshooting)

<a id="phase-4-in-stable-v150"></a>
<a id="phase-5-in-stable-v160"></a>
<a id="v161-clearer-external-tui-sections"></a>

## Features

- **Compose your statusline:** add, copy and arrange independent components, literal text and left/right alignment in either editor. [Composition guide](docs/COMPOSITION.md).
- **Control visibility and appearance:** hide confirmed empty/clean states, set usage thresholds, choose per-item foreground/background colors and themes, and opt into basic [Powerline](docs/APPEARANCE.md).
- **Choose your languages:** English, 简体中文, 繁體中文, 日本語 and 한국어 for interfaces and actual statusline output, independently; interface changes save immediately, output language saves with display settings. See [language examples](docs/images/languages/README.md).
- **Find what to show:** 60 main metrics and 14 subagent metrics, plus text and flexible spacers, with ranked multilingual search, category filters and source/requirement guidance.
- **Track the right scope:** session token totals, per-task subagent rows, and total task time covering queueing, agents and main-agent wrap-up; optional execution time excludes verified user waits.
- **Adjust presentation:** model and number formats, labels, built-in icons, colors, directory styles, and automatic or explicit rows with priorities and width limits.
- **Keep Unicode intact:** joined emoji, combining marks and CJK text stay together when rows wrap, clip or appear in previews.
- **Review configuration changes:** six editable presets and portable JSON, with import differences and candidate previews before accepting a draft and saving.
- **Choose an editor:** Main, Subagents, Settings, and Layout pages share the same configuration. Claude appearance and behavior preferences use a separate Apply action.
- **Follow Claude themes:** the in-session editor adapts text, keys and selection to the applied theme; sample previews retain production colors on a separately chosen light/dark background.
- **Follow terminal colors:** external TUI text and bold keys use terminal defaults, with cyan headings; previews show the selected palette on the current terminal background.
- **Enable optional live metrics:** runtime state, agent count, tool progress, request timing, and per-task usage are opt-in. Missing or partial observations stay distinguishable.

Rendering uses Claude Code input and local state without making network requests or using model tokens. The question-and-answer wizard uses Claude model turns. See [field definitions](docs/DISPLAY_ITEMS.md) for data sources and availability.

<a id="界面预览"></a>

## Screenshots

[Component instances, copies and left/right layout captures](docs/images/composition/README.md).

[Search, categories, source guidance and import review captures](docs/images/README.md#discovery-and-import-review).


The main status line at the bottom of session screenshots shows actual data; configuration Preview regions use fixed samples. Fonts, colors and widths depend on terminal settings. [Image sources and archive](docs/images/README.md).

<details>
<summary>English / 简体中文 configuration</summary>

Linux terminal captures show the shared language selector and Chinese interface. These are reconstructions of actual PTY cells with sample previews; [sources and all pages](docs/images/README.md#bilingual-terminal-captures).

![English native language selector](docs/images/tui/native/linux/languages/settings-en.png)

![简体中文 native language selector](docs/images/tui/native/linux/languages/settings-zh-CN.png)

![简体中文 external language selector](docs/images/typescript/external/linux/zh-CN/settings.png)

</details>

### In-session TUI

Run `/statusline-configure-native` inside the current Claude Code session, then click the Client region once before using the keyboard. The editor follows the Claude theme; choose the preview background to match the terminal and compare the selected palette. [Compare terminal/theme combinations](docs/development/native.md#terminal-background-previews).

**Linux: Main and the status line**

![Linux in-session TUI Main page and actual main status line](docs/images/tui/native/linux/main.png)

<details>
<summary>Linux: Subagents, Settings, Layout</summary>

**Subagents: choose items and ordering for individual agent rows.**

![Linux in-session TUI Subagents page with sample preview](docs/images/tui/native/linux/subagents.png)

**Settings: adjust appearance, refresh behavior and formatting.**

![Linux in-session TUI Settings page with sample preview](docs/images/tui/native/linux/settings.png)

**Layout: set rows, item priorities and maximum widths.**

![Linux in-session TUI Layout page with sample preview](docs/images/tui/native/linux/layout.png)

</details>

<details>
<summary>Linux: light and dark themes</summary>

Earlier theme captures used a dark preview surface; the current editor offers a separate light/dark preview choice. These images reconstruct real terminal cells. [Capture provenance](docs/images/README.md#theme-terminal-captures).

![Linux light theme native editor](docs/images/tui/native/linux/themes/main-light.png)

![Linux dark theme native editor](docs/images/tui/native/linux/themes/main-dark.png)

</details>

<details>
<summary>Windows: Main, Subagents, Settings, Layout</summary>

**Main: select and reorder main status line items.**

![Windows in-session TUI Main page with sample preview](docs/images/tui/native/windows/main.png)

**Subagents: choose items and ordering for individual agent rows.**

![Windows in-session TUI Subagents page with sample preview](docs/images/tui/native/windows/subagents.png)

**Settings: adjust appearance, refresh behavior and formatting.**

![Windows in-session TUI Settings page with sample preview](docs/images/tui/native/windows/settings.png)

**Layout: set rows, item priorities and maximum widths.**

![Windows in-session TUI Layout page with sample preview](docs/images/tui/native/windows/layout.png)

</details>

<details>
<summary>macOS: Main</summary>

Only Main was supplied for this batch. The existing interaction limitation and checks are documented in [macOS mouse reporting and Client focus](docs/USER_GUIDE.md#macos-mouse-reporting-and-client-focus).

**Main: select and reorder main status line items.**

![macOS in-session TUI Main page with sample preview](docs/images/tui/native/macos/main.png)

</details>

### External TUI

Run `/statusline-configure` in Claude Code, or `claude-statusline configure` in a standalone terminal.

<details>
<summary>Linux: light/dark backgrounds and palette comparison</summary>

Previews use the current terminal background and selected palette. Compare `ansi` in Settings when `default` looks faint. These are terminal-output reconstructions from dedicated GNOME profiles; [capture sources](docs/images/README.md#external-terminal-color-captures).

**Light background, Palette: default**

![Linux light terminal with default palette](docs/images/tui/external/linux/themes/main-light.png)

**Light background, Palette: ansi**

![Linux light terminal with ANSI palette](docs/images/tui/external/linux/themes/main-light-ansi.png)

**Dark background, Palette: default**

![Linux dark terminal with default palette](docs/images/tui/external/linux/themes/main-dark.png)

</details>

<details>
<summary>Linux: Main, Subagents, Settings, Layout</summary>

**Main: select and reorder main status line items.**

![Linux external TUI Main page with sample preview](docs/images/typescript/external/linux/en/main.png)

**Subagents: choose items and ordering for individual agent rows.**

![Linux external TUI Subagents page with sample preview](docs/images/typescript/external/linux/en/subagents.png)

**Settings: adjust appearance, refresh behavior and formatting.**

![Linux external TUI Settings page with sample preview](docs/images/typescript/external/linux/en/settings.png)

**Layout: set rows, item priorities and maximum widths.**

![Linux external TUI Layout page with sample preview](docs/images/typescript/external/linux/en/layout.png)

</details>

<details>
<summary>Windows: Main, Subagents, Settings, Layout</summary>

**Main: select and reorder main status line items.**

![Windows external TUI Main page with sample preview](docs/images/tui/external/windows/main.png)

**Subagents: choose items and ordering for individual agent rows.**

![Windows external TUI Subagents page with sample preview](docs/images/tui/external/windows/subagents.png)

**Settings: adjust appearance, refresh behavior and formatting.**

![Windows external TUI Settings page with sample preview](docs/images/tui/external/windows/settings.png)

**Layout: set rows, item priorities and maximum widths.**

![Windows external TUI Layout page with sample preview](docs/images/tui/external/windows/layout.png)

</details>

<details>
<summary>macOS: Main, Subagents, Settings, Layout</summary>

**Main: select and reorder main status line items.**

![macOS external TUI Main page with sample preview](docs/images/tui/external/macos/main.png)

**Subagents: choose items and ordering for individual agent rows.**

![macOS external TUI Subagents page with sample preview](docs/images/tui/external/macos/subagents.png)

**Settings: adjust appearance, refresh behavior and formatting.**

![macOS external TUI Settings page with sample preview](docs/images/tui/external/macos/settings.png)

**Layout: set rows, item priorities and maximum widths.**

![macOS external TUI Layout page with sample preview](docs/images/tui/external/macos/layout.png)

</details>

Earlier screenshots and terminal reconstructions remain in the [archive](docs/images/archive/README.md).

## Supported platforms

| Platform | Supported environment |
| --- | --- |
| Linux / WSL | Node 22.x or 24.x, x64 |
| Windows 10/11 | Node 22.x or 24.x, x64 |
| macOS 14+ | Node 22.x or 24.x, Intel / Apple Silicon |

Windows ARM devices use x64 Node under emulation; native Windows ARM64 and 32-bit runtimes are outside the current support contract. Git information requires `git`.

Claude Code feature requirements: subagent rows 2.1.205+; local argument-based configuration and external TUI entry 2.1.258+; in-session Client 2.1.287+; native timing and advanced live-metrics collection 2.1.289+. Unsupported or unknown host versions suspend the corresponding integration. See [requirements](docs/USER_GUIDE.md#requirements).

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

Install Node 22.x or 24.x with npm and Claude Code CLI. One npm package includes the supported native dependencies and needs no Python or compiler. [Existing Python installation and rollback](docs/USER_GUIDE.md#upgrading).

### Install the package

Bash, Zsh, and PowerShell:

```text
npm install --global --ignore-scripts @fbincon/claude-code-statusline
```

### Integrate with Claude Code

Ensure the npm command directory is on PATH, then run:

```text
claude-statusline --version
claude-statusline install --dry-run
claude-statusline install
claude-statusline doctor
```

On Windows, use `claude-statusline.cmd`, or invoke the installed JavaScript entry with Node. Restart Claude Code in a trusted terminal after integration.

Both editors default on for compatible hosts, respecting saved disablement preferences. Native timing and advanced live metrics both require explicit opt-in on compatible hosts; saved choices are preserved. Package installation and Claude integration are separate steps; `install` does not open an editor. Existing conflicting resources require [explicit handling](docs/USER_GUIDE.md#handle-an-existing-status-line-or-skill-with-the-same-name).

<details>
<summary>Other installation methods</summary>

Source development on main uses Node and TypeScript; follow the [source development guide](docs/development/README.md#build-and-install-from-source). Release attachments support offline npm installation; the installation guide covers fixed versions and Python recovery.

Download checksums and platform-specific instructions are in the [installation guide](docs/USER_GUIDE.md#installation-and-integration); source builds are in the [development guide](docs/development/README.md#build-and-install-from-source).

</details>

## Common configuration

In either editor, use **Ctrl+P** or **Settings → Quick setup** to choose a use case, appearance and sample before editing or saving. Text fields support grapheme cursor editing. Item details explain configuration, requirements and sample fitting. See [quick setup and explanation](docs/USER_GUIDE.md#quick-setup-and-explanation).

[Find items, understand their sources, and review imports](docs/USER_GUIDE.md#item-discovery-import-review).


| Entry point | Use |
| --- | --- |
| `/statusline-configure-native` | Client TUI in the current session; see [native editor](docs/USER_GUIDE.md#native-configuration-editor) |
| `/statusline-configure` | TUI in a supported external terminal; see [external entry](docs/USER_GUIDE.md#external-terminal-statusline-configure) |
| `claude-statusline configure` | Full TUI in the current standalone terminal |
| `/statusline-config` | Claude question-and-answer wizard; supported argument-based commands execute locally on compatible hosts |
| `claude-statusline config ...` | Inspect settings, set exact ordering, or configure from scripts |

<a id="v130a2-external-tui-and-in-session-client"></a>

### Interface language

Both editors have **Interface language (saved immediately)** in Settings, with choices **English / 简体中文 / 繁體中文（台灣） / 繁體中文（香港） / 日本語 / 한국어**. The default is English. Switching keeps your page, selection, search and unsaved display edits; cancelling display changes keeps the language choice. Other open windows read it when reopened or reloaded.

```text
claude-statusline config language set ja
claude-statusline config language show
claude-statusline config language reset
claude-statusline --language en --help
```

`--language en|zh-CN|zh-TW|zh-HK|ja|ko` precedes the command and affects only that invocation; for `configure` it sets the initial language. Commands, IDs, configuration values and custom text retain their values. Interface language does not change output language. See [language settings](docs/USER_GUIDE.md#interface-language).

### Statusline language

Choose **Statusline language (save with display settings)** → **English / 简体中文 / 繁體中文（台灣） / 繁體中文（香港） / 日本語 / 한국어** in either editor. Preview switches immediately; Save changes the actual main and subagent output on the next refresh, while Cancel discards the draft. English is the default.

```text
claude-statusline config set statusline-language zh-TW
claude-statusline config set statusline-language en
```

![English statusline output](docs/images/statusline/linux/en.png)

![Simplified Chinese statusline output](docs/images/statusline/linux/zh-CN.png)

These are [real CLI terminal captures with fixed input](docs/images/README.md#statusline-language-captures).

Built-in labels and known states are translated. Technical units, model names, branches, paths and custom text are preserved. See [output language](docs/USER_GUIDE.md#statusline-language).

### Native configuration editor

Click the Client region once. Use Tab to change pages, Space to toggle, arrows to select or reorder, Ctrl+E for item formatting and source guidance, `/` to search, and Ctrl+F for categories. Clear filters before reordering. `S` saves and stays, `F` saves and closes, and `Q` discards unsaved changes; lowercase letters work too. Footer controls follow the current page or input mode. Ctrl+G cancels input. Claude preferences apply separately.

### External and standalone terminal TUI

Use Tab to change pages, Space to toggle, and arrows to select or reorder. Ctrl+S saves after field input is finished; Enter saves on item and original settings rows, or edits/confirms advanced fields. Esc cancels input first, then cancels the editor; Ctrl+C interrupts without saving. The minimum terminal size is 64×18.

The external entry uses tmux or GNOME Terminal on Linux, tmux or Terminal.app on macOS, and the system's new-console launcher on Windows. For SSH or unavailable launchers, run `claude-statusline configure` in the current terminal.

Define a compact main line:

```text
claude-statusline config set-items model-with-effort current-dir git context-remaining task-timer
claude-statusline config set directory-style home
claude-statusline config show
```

Configuration is per user. `set-items` replaces the enabled set; `enable` and `disable` make incremental changes. See [recipes](docs/USER_GUIDE.md#configuration-recipes), [formatting and layouts](docs/USER_GUIDE.md#formatting-layout-presets), and the [CLI reference](docs/reference/cli.md).

<a id="upgrade-to-v161"></a>

## Upgrading and uninstalling

Upgrade the package, synchronize integration, then restart Claude Code:

```text
npm install --global --ignore-scripts @fbincon/claude-code-statusline
claude-statusline install
claude-statusline doctor
```

Existing Python installations should first follow the [migration and rollback procedure](docs/USER_GUIDE.md#migrate-the-previous-distribution-name). Saved display settings, runtime state, and integration preferences remain. For older display schemas or package downgrade, follow [version compatibility](docs/USER_GUIDE.md#version-compatibility).

Remove Claude integration before uninstalling the package:

```text
claude-statusline uninstall --dry-run
claude-statusline uninstall
npm uninstall --global @fbincon/claude-code-statusline
```

Display settings and backups remain available; see [uninstalling](docs/USER_GUIDE.md#uninstalling).

## Project structure

```text
claude-code-statusline/
├── .github/workflows/
│   ├── ci.yml                    # Candidate build, eight installations and thirteen hosts
│   └── reference.yml             # Manual historical Python verification
├── packages/                     # Four business packages
│   ├── core/src/                 # Configuration, protocols, pure state, rendering and Unicode
│   │   ├── editor/               # Shared drafts, cursor input, quick setup and explanations
│   │   ├── rendering/            # Rendering, fitting and optional explanation records
│   │   ├── contracts/            # Independently versioned editor/runtime interfaces
│   │   └── i18n/                 # Registry-generated languages; sources in core/resources
│   ├── platform/src/             # Files, locks, processes, clocks and terminal adapters
│   ├── cli/                      # Commands, integration, runtime and recovery
│   │   ├── src/                  # Installation and editor protocols
│   │   └── resources/            # Two configuration skill templates
│   └── tui/src/                  # Standalone terminal editor
├── mods/
│   ├── statusline-native/        # In-session editor: hooks, lib, ui, tests
│   └── statusline-runtime/       # Timing and optional live metrics
├── tests/fixtures/               # Shared contracts, Unicode and frozen reference data
├── tools/
│   ├── generation/               # Shared resource generation
│   ├── checks/                   # Documentation, archive and aggregate checks
│   ├── build/                    # Fixed sources, universal offline packaging and digests
│   ├── acceptance/               # Installation, Mods, terminals, power and budgeted acceptance
│   ├── benchmarks/               # Functional fixtures and optional descriptive measurement
│   ├── release/                  # Candidate evidence and release-note preparation
│   ├── migration/                # Stage ledgers, frozen references and compatibility tests
│   ├── testing/                  # Development-only test support package
│   ├── typescript/               # Runtime constraints and test entry points
│   └── unicode/                  # Pinned data, provenance and licenses
├── archive/python/               # Frozen Python implementation, tests, tools and publishing workflows
├── docs/                         # Usage, development, migration and historical releases
│   ├── reference/                # CLI and configuration reference
│   ├── development/              # Architecture, testing and stage records
│   ├── images/                   # UI screenshots and historical captures
│   └── releases/                 # Historical release notes
├── package.json / package-lock.json
├── tsconfig*.json / .node-version
├── README.md / README.zh-CN.md
├── CHANGELOG.md / CHANGELOG.zh-CN.md
└── LICENSE
```

## Documentation and help

- [User guide](docs/USER_GUIDE.md): installation, editors, recipes, upgrades, and troubleshooting.
- [CLI reference](docs/reference/cli.md): commands, options, fields, files, and exit codes.
- [Display items and metric definitions](docs/DISPLAY_ITEMS.md): scope, sources, and availability.
- [Development guide](docs/development/README.md) · [Release process](docs/RELEASING.md).
- [Changelog](CHANGELOG.md) · [GitHub Releases](https://github.com/fbincon/claude-code-statusline/releases).
- [GitHub Issues](https://github.com/fbincon/claude-code-statusline/issues): include versions, reproduction steps, and diagnostic results; remove private paths and session content.

## License

[MIT License](LICENSE). Copyright (c) 2026 [fbincon](https://github.com/fbincon).

Bundled Unicode data retains the [Unicode License v3](tools/unicode/UNICODE-LICENSE.txt) and the [wcwidth MIT notice](tools/unicode/WCWIDTH-LICENSE.txt).
