# Claude Code Statusline User Guide

**English** | [简体中文](USER_GUIDE.zh-CN.md) · [Documentation index](README.md)

This guide covers installation, editor use, everyday configuration, optional live metrics and recovery. Start with the [usage demonstrations](SHOWCASE.md) for a complete workflow; use the [CLI reference](reference/cli.md) for exact syntax and file formats.

| Task | Detailed guide |
| --- | --- |
| Install and connect Claude Code | [Installation and integration](#installation-and-integration) · [First-use setup](SETUP.md) |
| First run | [Quick start](#quick-start) · [First-use setup](SETUP.md) |
| Choose a configuration method | [Editors, wizard and CLI](#choose-a-configuration-entry-point) |
| Start with a scheme or recipe | [Complete schemes](SCHEMES.md) · [Configuration recipes](#configuration-recipes) |
| Layout, colors and reusable drafts | [Composition](COMPOSITION.md) · [Appearance](APPEARANCE.md) · [Draft history and reuse](DRAFT_HISTORY.md) |
| Share settings across projects | [Profiles and project bindings](PROFILES.md) |
| Understand tasks and measurements | [Task details](TASK_DETAILS.md) · [Metric definitions](DISPLAY_ITEMS.md) |
| Add sources | [Extensions](EXTENSIONS.md) |
| Diagnose setup or output | [Troubleshooting](#troubleshooting) · [Input diagnosis](DIAGNOSTICS.md) |
| Upgrade, roll back or recover | [Package management](PACKAGE_MANAGEMENT.md) |

Configuration is stored for the current user; project bindings can select named display schemes. Rendering reads Claude input, local Git, transcripts and state without network requests or model tokens. Explicit source refresh is separate. The question-and-answer wizard uses model turns.

Single-line CLI examples work in Bash, Zsh and PowerShell. Windows uses `claude-statusline.cmd`, or Node with the absolute installed JavaScript entry. `<CLAUDE_CONFIG_DIR>` means the value of `CLAUDE_CONFIG_DIR`, or `~/.claude` if unset; it is a placeholder, not a literal argument.

The current distribution is the TypeScript npm package. Python installations can be retained for explicit rollback; see [upgrading](#upgrading). Development and build instructions are in the [development guide](development/README.md).

## Contents

- **Getting started**
  - [Feature overview](#feature-overview)
  - [Requirements](#requirements)
  - [Installation and integration](#installation-and-integration)
  - [Choose a configuration entry point](#choose-a-configuration-entry-point)
  - [Quick start](#quick-start)
  - [Language and save behavior](#language-and-save-behavior)
- **Configure**
  - [Configuration recipes](#configuration-recipes)
  - [Terminal editor](#terminal-editor)
  - [In-session editor (Client)](#native-configuration-editor)
  - [`/statusline-config` wizard](#statusline-config-wizard)
  - [Find items and review imports](#find-items-and-review-imports)
  - [Component composition](#component-composition)
  - [Formatting, layouts and presets](#formatting-layouts-and-presets)
  - [Quick setup, text editing and explanation](#quick-setup-text-editing-and-explanation)
  - [Unicode text and terminal widths](#unicode-text-and-terminal-widths)
  - [Settings and configuration files](#settings-and-configuration-files)
- **Understand and diagnose**
  - [Understand displayed data](#understand-displayed-data)
  - [`doctor` diagnostics](#doctor-diagnostics)
  - [Troubleshooting](#troubleshooting)
  - [Exit codes](#exit-codes)
  - [Current limitations](#current-limitations)
- **Maintain**
  - [Upgrading](#upgrading)
  - [Uninstalling](#uninstalling)
  - [Backups and rollback](#backups-and-rollback)
- **Appendix**
  - [Related documentation](#related-documentation)

## Feature overview

[Conditional visibility, item colors, themes and Powerline](APPEARANCE.md) explains the shared controls, raw-observation rules and migration recovery.

Choose from 65 main metrics and 15 subagent metrics, plus text and flexible spacers in both scopes. Defaults enable 10 main items and 5 subagent items. The terminal editor and in-session editor (Client) provide Main, Subagents, Settings, and Layout pages, fixed sample previews, formatting, eight complete display schemes and six original presets, and portable JSON files.

The main line reports main/session data; each subagent row reports its own task. Task timing includes subagent work and main-agent wrap-up. [Display definitions](DISPLAY_ITEMS.md) explain sources, scope, missing observations, and metric limits.

## Requirements

| Platform | Environment |
| --- | --- |
| Linux / WSL | Node 22.x or 24.x, x64 |
| Windows 10/11 | Node 22.x or 24.x, x64 |
| macOS 14+ | Node 22.x or 24.x, Intel / Apple Silicon |

Install Claude Code CLI and npm; the pinned validation toolchain uses npm 11.19.0. Git is needed for Git fields and source builds. Windows ARM devices use x64 Node emulation; native Windows ARM64 and 32-bit runtimes are outside the support contract. The package bundles native dependencies and needs no Python or compiler.

The six known validation gaps remain unverified; accepted scope and historical release decisions are recorded in [testing and acceptance](development/testing.md#known-validation-gaps).

| Feature | Claude Code requirement |
| --- | --- |
| Main line, CLI, terminal editor, wizard | Available on older/unknown hosts; unavailable data is omitted |
| Subagent rows and lifecycle hooks | 2.1.205+; per-task effort 2.1.214+ |
| Local argument-based slash commands, external entry | 2.1.258+ |
| In-session Client editor | 2.1.287+ |
| Native timing and advanced live-metrics collection | 2.1.289+ |

The external launcher uses tmux or GNOME Terminal on Linux, tmux or Terminal.app on macOS, and a system new console on Windows. In other terminal environments, run the terminal editor directly. After crossing a host-version requirement, rerun `install` and `doctor`.

## Installation and integration

### Install the npm package

```text
npm install --global --ignore-scripts @fbincon/claude-code-statusline
```

To install an exact stable version from npm, append `@VERSION` to the package name, using the release tag without the leading `v`. Package installation and Claude integration are separate steps. Ensure the npm command directory is on PATH. Windows npm wrappers are `.cmd` and `.ps1`. Claude integration binds the absolute Node executable and JavaScript entry.

### Offline installation

Choose the exact stable tag from the release list. Download the four attachments for that tag into one directory. These are `fbincon-claude-code-statusline-VERSION.tgz`, the rebuildable `claude-code-statusline-VERSION-source.tar.gz`, `build-manifest.json` and `SHA256SUMS`. Verify the three files listed in `SHA256SUMS` before installing. [GitHub Releases](https://github.com/fbincon/claude-code-statusline/releases) · [Gitee Releases](https://gitee.com/fbincon/claude-code-statusline/releases)

In the Linux or WSL example, replace `VERSION` with the version from the selected tag.

```bash
sha256sum -c SHA256SUMS &&
  npm install --global --offline --ignore-scripts "./fbincon-claude-code-statusline-VERSION.tgz"
```

On macOS, use `shasum -a 256 -c SHA256SUMS` for the checksum step. In PowerShell, use `Get-FileHash -Algorithm SHA256 -LiteralPath FILE` for each listed file and compare the hashes with `SHA256SUMS`. Once they match, run the same npm command for the verified local tgz. For source builds, use the attached rebuildable archive. [Build from source](development/README.md#build-and-install-from-source)

### Integrate with Claude Code

After confirming the npm command directory is on PATH, choose the guided first-use path or direct integration.

For guided setup:

```text
claude-statusline setup --dry-run
claude-statusline setup
```

`setup --dry-run` is read-only and prints the checks and planned steps. Interactive `setup` previews a display, reviews Claude integration and commits display and integration separately; it needs a TTY, while `--dry-run` does not. `install` remains the direct alternative.

For direct integration:

```text
claude-statusline --version
claude-statusline install --dry-run
claude-statusline install
claude-statusline doctor
```

Windows uses `claude-statusline.cmd` or the explicit Node/JavaScript entry. Restart Claude Code in a trusted terminal to load the installed plugins and commands. For a guided display preview and integration review, use [first-use setup](SETUP.md).

### What `install` does

The installer merges owned status-line commands, timing/subagent hooks, configuration skills, and compatible editor integrations into the user configuration. It preserves unrelated settings and hooks, backs up actual changes, and uses atomic writes. Repeated installation is idempotent.

The two editor entries default on when there is no saved preference. Explicit parameters override saved preferences; saved preferences override defaults. Unsupported integrations suspend without losing the preference. Native timing and advanced collection have independent preferences; fresh installs default to both collectors off. Enable timing explicitly with `install --native-timing` or complete collection with `install --live-metrics`. Existing valid padding, refresh, and Vim-indicator choices remain; a new installation refreshes once per second.

### Preview installation

`claude-statusline install --dry-run` reports whether files would change without writing settings, resources, or backups.

### Handle an existing status line or skill with the same name

The installer rejects conflicting third-party status-line settings or same-name skills before changing files. Inspect the reported conflict; use `claude-statusline install --force` only when replacing those resources is intended. Native command/plugin identity conflicts require resolving ownership rather than forcing takeover.

To preserve a third-party subagent renderer, run `claude-statusline config set subagent-statusline off`, then ordinary `install`. Installation flags and ownership behavior are in the [CLI reference](reference/cli.md#installation-and-diagnostics).

### macOS installation and validation boundaries

macOS uses the same npm package and installation flow, with Intel and Apple Silicon native dependencies bundled. Terminal.app is the supported desktop external launcher; tmux popup is preferred when available. SSH and sessions without a graphical desktop should use the terminal editor or CLI.

For a reproducible workflow and versioned captures, see the [showcase](SHOWCASE.md) and [image index](images/README.md). For the known macOS Client input limitation, see the [focus checks](#macos-mouse-reporting-and-client-focus).

## Choose a configuration entry point

| Entry | Best suited to |
| --- | --- |
| `claude-statusline setup [--dry-run]` | [Guided display preview and integration review](SETUP.md) |
| `/statusline-configure-native` | [Configure inside the current Claude session](#native-configuration-editor) |
| `/statusline-configure` | [Launch a separate supported terminal from Claude](#external-terminal-statusline-configure) |
| `claude-statusline configure` | [Configure in the current terminal, including SSH](#standalone-interactive-tui) |
| `/statusline-config` | [Answer guided questions using Claude model turns](#statusline-config-wizard) |
| `claude-statusline config ...` | [Set exact values or automate configuration](reference/cli.md#configuration-command-reference) |

All entries share user settings. Two open editors keep separate drafts; a stale draft cannot overwrite a newer saved revision.

## Quick start

For a new installation, install the package, preview the guided setup, run it, then check diagnostics:

```text
npm install --global --ignore-scripts @fbincon/claude-code-statusline
claude-statusline setup --dry-run
claude-statusline setup
# Restart Claude Code in a trusted terminal, then:
claude-statusline doctor
```

`setup --dry-run` is read-only and prints the checks and planned steps. Interactive `setup` previews a display, reviews Claude integration and commits display and integration separately; it needs a TTY, while `--dry-run` does not. `install` remains the direct alternative. In an interactive terminal, `npx @fbincon/claude-code-statusline` installs a persistent package and then opens setup. After `setup` or `install`, restart Claude Code in a trusted terminal so the new slash commands load; editor and session checks require the restarted session. See [Installation and integration](#installation-and-integration), [First-use setup](SETUP.md) and [Choose a configuration entry point](#choose-a-configuration-entry-point).

Open the in-session editor with `/statusline-configure-native`, or run `claude-statusline configure` in a terminal. Press Ctrl+P or choose **Settings → Quick setup**, select a complete scheme or preset, inspect Preview, then Save.

## Language and save behavior

| Setting | Affects | When saved | Cancelled with the display draft? |
| --- | --- | --- | --- |
| Interface language | CLI, editor and wizard messages | Immediately in Settings; `--language` overrides one invocation | No |
| Statusline language | Built-in output labels, known states and samples | With display Save in an editor; explicit writes in CLI | Yes, for unsaved display changes |
| Claude host preferences | Claude's own appearance and behavior | Separate Apply | No |

<a id="native-editor-preview"></a>

<a id="v130a2-external-tui-and-in-session-client"></a>

### Interface language

Supported codes are `en` (English), `zh-CN` (Simplified Chinese), `zh-TW` (Traditional Chinese, Taiwan), `zh-HK` (Traditional Chinese, Hong Kong), `ja` (Japanese), `ko` (Korean), `es` (Spanish), `fr` (French), `de` (German), `pt-BR` (Brazilian Portuguese), `ru` (Russian), and `id` (Indonesian). Selection is explicit; system locale settings do not change it. Codes are case-sensitive; `pt-BR` is supported, while `pt` and `pt-br` are not aliases. Use Left/Right to cycle through this order. Existing `zh-Hant` arguments and saved preferences remain accepted as Taiwan. Reads leave files untouched; explicit saves and exports write `zh-TW`.

The product runtime range is `^22.0.0 || ^24.0.0`; source development and reproducible release builds still use Node 24.21.0/npm 11.19.0. After upgrading, rerun `claude-statusline install` and restart Claude Code to update editor protocol 31 and matching resources. Before downgrading, restore a compatible pre-upgrade display backup through the current package’s recovery flow. If the older version lacks a selected language, reset both interface and output languages to English before restoring that backup.

The CLI, terminal editor and in-session Client default to English. In Settings choose **Interface language (saved immediately)** → **English / 简体中文 / 繁體中文（台灣） / 繁體中文（香港） / 日本語 / 한국어 / Español / Français / Deutsch / Português (Brasil) / Русский / Bahasa Indonesia**. The language is shared across both editors and CLI, independent of Claude's own theme and language settings.

```text
claude-statusline config language show
claude-statusline config language show --json
claude-statusline config language set zh-CN
claude-statusline config language set en
claude-statusline config language reset
claude-statusline --language zh-CN configure
claude-statusline --language en config --help
```

The first two lines read the saved preference; `--json` emits the stable preference object. `reset` saves English. Put the optional `--language` before the command; it overrides the saved preference for that invocation without writing it. An editor opened with that override can still save a new language through Settings. For an isolated directory use `claude-statusline config --config-dir /path/to/config language set zh-CN`.

A switch saves immediately and preserves the current page, selected field, search, input and display draft. It recomputes terminal layout and redraws translated text. Save/cancel continues to govern display changes only; a failed language write keeps the previous language and reports the error. Other open windows read the new preference when reopened or through their existing reload action. Search matches IDs, names and descriptions in all twelve languages, and custom labels in any interface language.

The preference is `<CLAUDE_CONFIG_DIR>/statusline-ui.json`, schema v1. Missing or invalid preferences fall back to English; reading never repairs the file. Explicit set/reset backs up and repairs corrupt preferences, but refuses a newer schema. Reinstall, upgrades, ordinary uninstall, display reset, presets and portable import/export preserve this independent preference.

Interface language does not change actual statusline samples/output. Model names, paths, branches, commands, IDs, configuration values and custom labels retain their identity. The model-based wizard reads the interface preference on each invocation and uses localized CLI descriptions; JSON catalogs retain English metadata and stable IDs.

### Statusline language

The independent display option defaults to `en`. Choose **Statusline language (save with display settings)** in either editor; options always use **English / 简体中文 / 繁體中文（台灣） / 繁體中文（香港） / 日本語 / 한국어 / Español / Français / Deutsch / Português (Brasil) / Русский / Bahasa Indonesia**. Preview uses the draft language immediately. Save persists it with other display settings; Cancel discards it. Actual output changes on the next refresh, without restarting Claude.

For example, keep the interface in Spanish and use Brazilian Portuguese for output. These explicit CLI writes save each setting independently:

<!-- docs-example: guide-language -->

```text
claude-statusline config language set es
claude-statusline config set statusline-language pt-BR
claude-statusline config show --json
```

This applies to the main line and all custom subagent rows. Translate built-in phrases and known lifecycle/permission/effort/cache/review values; preserve unknown values, user labels/icons, model names, paths, branches and task/tool names. Keep numbers, currency, `K/M`, `d/h/m/s`, `tok/s`, Git, PR and other technical units. A null label inherits a localized default; an empty label suppresses it; custom labels take precedence.

`statusline_language` lives in display schema v17 and participates in revisions, previews and portable exports. Historical v1–v5 reads/imports default to English without rewriting files; explicit saves back up and migrate. Presets preserve the language. Full imports use the file's language; selective imports change it only when the display-language option is selected. Display reset restores English. `--statusline-language` is optional only within a complete `config apply` invocation, which also supplies the item selection and requires this tool to own the installed status line; omitting it preserves the current value. For a standalone language change, use `claude-statusline config set statusline-language <code>` (see the [statusline language reference](reference/cli.md#statusline-language)). Interface preferences and runtime observations remain independent.

Before downgrading to a release that lacks a selected language, set both languages to `en` with `config language reset` and `config set statusline-language en`. Then follow the steps for compatible configuration and matching native resources. [Version compatibility](#version-compatibility) · [Backups](#backups-and-rollback)

<a id="常用配置配方"></a>

## Configuration recipes

`config set-items` replaces the complete enabled selection; `config enable` and `config disable` add or remove individual items without rewriting the others. Enabling a previously disabled item in a simple automatic layout appends it, so use `order` or `set-items` to restore an exact order.

<a id="精简开发视图"></a>

### Minimal development view

<!-- docs-example: guide-recipes -->

```bash
claude-statusline config set-items model-with-effort current-dir git context-remaining task-timer
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

<!-- docs-example: guide-context -->

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

<a id="reset-display-defaults-while-keeping-the-installation"></a>
<a id="恢复出厂显示配置但保留安装"></a>

### Reset display and host defaults while keeping the installation

`config reset` restores display defaults and, when this tool owns the installation, resets host padding, refresh and Vim-indicator values to defaults.

```bash
claude-statusline config reset
claude-statusline config show
```

<a id="terminal-editor"></a>

## Terminal editor

The terminal editor is the shared TUI opened by `claude-statusline configure` or `/statusline-configure`. The standalone entry runs in the current terminal; the external entry launches a supported terminal from Claude. Both share configuration, keys and save behavior.

<a id="standalone-interactive-tui"></a>

### Standalone entry: `claude-statusline configure`

In a real terminal outside Claude Code, run:

```text
claude-statusline configure
```

Windows uses `claude-statusline.cmd configure`. Both stdin and stdout must be TTYs, ANSI/VT terminal initialization must succeed, configuration must be valid, and the current CLI must own the installed status line. The minimum size is 64×18; a smaller window waits for resizing and still permits cancellation.

| Key | Action |
| --- | --- |
| Tab / Shift+Tab | Cycle Main, Subagents, Settings, Layout outside field input |
| Space | Toggle the selected item |
| ↑ / ↓; PgUp / PgDn; Home / End | Select, page, first/last item |
| ← / → | Reorder items or adjust a setting |
| Printable text; Backspace / Ctrl+U | Filter item IDs/descriptions; delete/clear search |
| Ctrl+E / Ctrl+G | Open item formatting / leave its form or cancel input |
| Enter | Save on item/original settings rows; edit or confirm advanced fields |
| Ctrl+S | Save the full draft outside field input |
| Ctrl+K | Check saved state while the save outcome is unknown |
| Esc | Cancel the active field. At the top level, close a clean draft or confirm whether to discard unsaved changes. The default keeps editing. |
| Ctrl+C | Restore the terminal, exit 130, and discard |

Each page retains its draft, selection, search, and scroll during page changes and resize. Filtering preserves hidden items' relative order. A save checks the current revision before writing; unchanged settings create no backup.

<a id="external-terminal-statusline-configure"></a>

### External entry: `/statusline-configure`

Run `/statusline-configure` without arguments inside Claude Code. This entry requires 2.1.258+ and opens the same terminal TUI in tmux popup, GNOME Terminal, Terminal.app, or a Windows new console according to platform.

The external entry and in-session Client have independent preferences. Enable or disable just the external entry with:

```text
claude-statusline install --experimental-slash-tui
claude-statusline install --no-experimental-slash-tui
```

These are alternative commands. Omitting both flags preserves the saved preference; a missing preference defaults on. Restart Claude Code after integration changes.

Save, cancellation and errors return a short result to the original conversation. The launched TUI cancels without saving after 570 seconds. The standalone entry has no automatic timeout. `help`, `-h`, and `--help` return usage. The launcher rejects other arguments. If launchers are unavailable, use `claude-statusline configure` or the wizard. [TypeScript launcher and result contract](development/contracts.md#typescript-backend-binding)

<a id="external-tui-sections"></a>
<a id="external-tui-sections-and-page-hierarchy"></a>

### Terminal editor sections and page hierarchy

Content and `Preview (sample data)` are separate regions; Main/Subagents show `ON`, `ITEM`, `DESCRIPTION`, while settings and forms show `OPTION`, `VALUE`. The footer follows the current input context. See [terminal editor page regions and footer](development/native.md#external-terminal-editor-page-regions-and-footer).

<a id="external-terminal-colors"></a>

### Terminal editor colors

The terminal editor uses terminal-default foreground/background, ANSI cyan headings and reverse selection. `NO_COLOR`, monochrome `TERM`, explicit `TERM`/`COLORTERM` and Windows VT detection select capability; unknown capability falls back to 16 colors and non-TTY output has none. See [terminal color capability](APPEARANCE.md#terminal-color-capability).

<a id="native-configuration-editor"></a>

## In-session editor (Client)

`/statusline-configure-native` opens Client inside the current Claude Code session without another terminal. It shares configuration, directory, catalog, exclusion rules and atomic saves with external `/statusline-configure`, while each editor keeps its draft. Stable defaults both entries on; restart Claude Code in a trusted terminal after installation.

### Opening, navigation and editing

```text
/statusline-configure-native
```

Click the Client region once before keyboard operation. Reexecuting the command focuses the existing pane and retains its draft. Esc belongs to the host: it typically leaves region focus before closing the pane. Use Ctrl+G to cancel input.

| Key | Action |
| --- | --- |
| Tab / Shift+Tab; 1 / 2 / 3 / 4 | Switch Main, Subagents, Settings, Layout |
| Ctrl+E / Ctrl+G | Open selected item format / return from the form |
| ↑ / ↓; PgUp / PgDn; Home / End | Select, page, first/last item |
| ← / → | Reorder items or adjust a setting |
| Space / Enter | Toggle items, operate settings or enter/confirm numeric editing |
| `/`; Ctrl+U; Ctrl+G | Enter search; clear input; cancel and restore its prior state |
| `S` / `F` / `Q` | Save/continue; save/finish; discard/close |
| `H` / `A` | Unfold advanced Claude preferences / Apply separately |
| `R` / `K` / `V` | Discard/reload; check saved state; retry preview |

During search or field editing printable characters are input and character shortcuts pause; refresh accepts a number or `event`. Enabled and disabled items can move. Search/category filters disable reordering; clear the query and choose All categories to restore it. Page changes, resizing and preview refresh retain selection and draft; only enabled ordering is persisted.

Settings groups appearance, refresh/display behavior, Git metrics, formatting, risk colors, subagent visibility, presets/portable files and advanced Claude preferences. Minimum body is 32×12; at 64×20 or larger grouped borders separate regions, with titled separators in compact space. Preview uses fixed samples without collecting live Git, transcripts or model information.

### Saving, conflicts and recovery

Both editors may remain open. The first save wins; an older revision is rejected without overwriting newer configuration. Client retains conflicting drafts; `R` explicitly discards and reloads before editing again. Saving or an unknown result blocks ordinary closure. Use `K` to check saved state before retrying or closing. Retry/Close buttons outside Client recover failures while retaining the host's received draft.

Advanced Claude preferences have separate Apply; Save/Finish does not implicitly apply them. Closing returns to the original session. See [native development and acceptance](development/native.md).

On macOS, in-session Client interaction remains unverified; see [mouse reporting and Client focus](#macos-mouse-reporting-and-client-focus).

### Page hierarchy and pagination

Footer shortcuts, hint wrapping and field pagination follow pane size and input state; resizing retains the draft, selected field and input buffer. See [Client page hierarchy, footer and pagination](development/native.md#client-page-hierarchy-footer-and-pagination).

### Preview background and colors

The Client follows Claude's applied theme. **Preview background (UI only)** selects `light` or `dark` (`#ffffff`/`#17191e`) independently of the display draft and Palette; compare `default` and `ansi` if a color is unreadable. See [theme rendering](development/native.md#theme-rendering).

### Editor installation combinations and compatibility

Without recorded preferences, `claude-statusline install` defaults both entries on. Choose an explicit combination:

| Combination | Command |
| --- | --- |
| Both entries | `claude-statusline install --native-editor --experimental-slash-tui` |
| In-session Client only | `claude-statusline install --native-editor --no-experimental-slash-tui` |
| Terminal editor only | `claude-statusline install --no-native-editor --experimental-slash-tui` |
| Basic integration without either editor entry | `claude-statusline install --no-native-editor --no-experimental-slash-tui` |

On Windows use `claude-statusline.cmd`. The two flag pairs are independent; the historical `--experimental-slash-tui` name remains. Explicit flags override recorded preferences, which override defaults. Plugins explicitly disabled through the host remain disabled.

| Claude Code version | External `/statusline-configure` | In-session `/statusline-configure-native` |
| --- | --- | --- |
| 2.1.287+ | Default on | Default on |
| 2.1.258–2.1.286 | Default on | Suspended |
| Older or unrecognized | Suspended | Suspended |

Defaults apply only to entries without recorded disablement. Unsupported entries do not block basic integration or the other entry; explicit enabling also retains the preference and suspends the affected entry. Rerun `install` and `doctor` after host upgrades/downgrades. Support restores the entry according to preference; only tool-recorded suspension is automatically reenabled. Meanwhile use `claude-statusline configure`, `claude-statusline config ...` or the `/statusline-config` wizard, which uses model turns.

## `/statusline-config` wizard

Run `/statusline-config` without arguments to answer questions about main/subagent items and display options. The wizard uses Claude model turns, preserves the relative order of retained items, appends newly enabled items, and submits one atomic `config apply` after all questions are complete. Cancelling midway does not save settings.

Paging and the save-time reread described below are available from package v3.16.3. After upgrading, rerun `claude-statusline install` and restart Claude Code to load the matching skill. [v3.16.3 release notes](releases/v3.16.3.md)

The wizard edits the user-default configuration in the selected Claude configuration directory. Projects bound to named profiles keep their own display; host settings remain shared within that directory. Use an editor's target selector or terminal `config profile` / `config project` commands to manage profiles and bindings. The wizard reads saved interface language, current settings and both catalogs first. It starts from the current values, splits larger choices into bounded question pages and preserves answers across pages. A page's “None” choice clears only that page's items; explicit “Keep current” choices retain the saved value. Cancellation or an unresolved answer prevents the final save.

Repeated metrics, text/spacer instances, groups or main-row alignment rules need the instance-aware editors or explicit instance/group/alignment commands. The wizard detects these structures before asking questions and stops without modifying them. It also stops if the integration is absent or another tool owns the subagent renderer. It preserves appearance fields outside the guided form; discover current theme and advanced appearance choices through command help or either editor.

Before saving, the wizard rereads the display, host and ownership state. If that state changed during the questions, restart the wizard after reviewing the change. This recheck is best effort: the final `config apply` does not accept a revision argument, so a change between that read and the write remains possible.

Supported argument-based operations are `show`, `list-items`, `set-items`, `enable`, `disable`, `order`, `subagents`, `set`, `apply`, `item`, `instance`, `group`, `alignment`, `layout`, `preset`, `import`, `export`, `language`, and `reset`:

```text
/statusline-config set-items model-with-effort current-dir git context-remaining task-timer
/statusline-config show
```

On 2.1.258+ the local hook handles these operations without a model turn, when hooks are enabled. Older/unknown hosts or a disabled hook use the skill in a model turn. The slash parser shares these operations with the terminal CLI, including their supported dry runs and structural review flags. `profile` and `project` management remain terminal CLI/editor operations; slash commands do not accept arbitrary terminal commands or a leading `--config-dir`. See [slash execution](reference/cli.md#slash-command-support).

Use this tool's configuration commands; Claude's built-in `/statusline` may replace `statusLine.command` with a different implementation.

<a id="item-discovery-import-review"></a>

## Find items and review imports

Press `/` on Main/Subagents to enter a query; Enter accepts it, Ctrl+U clears it, and Ctrl+G restores the previous query. The terminal editor also accepts direct typing and Esc cancels explicit search input. Search matches IDs, names and descriptions in all twelve languages, custom labels and categories in any interface language. Exact matches rank before prefixes, English initials (for example `mwe`), substrings and ordered subsequences; equal ranks preserve the existing order. Highlighted text identifies the actual match, including an alternate-language snippet when needed.

Ctrl+F opens the category picker. Select with arrows and accept with Enter; choose All categories to remove the category filter. Query and category combine and stay local to the editor session. While filtered, items can be toggled or formatted; ordering is disabled. Clearing filters restores the full order and neither filter is exported or saved.

For an item's source and conditions, press Ctrl+E, select **Sources and requirements** at the start of the form, then Enter. Scroll with arrows or Page Up/Down and return with Ctrl+G (Esc also works in the terminal editor). This page explains measurement scope, source fields, verified host requirements, optional collectors and possible unavailable reasons. It does not inspect current data or enable anything. An unobserved item remains selectable and its preview stays a fixed sample.

Import from Settings opens a review against the current **unsaved draft**. Sections cover selection, retained-item order, formatting/overrides, layout, statusline language and statusline host settings. Enter expands the selected section, arrows select sections, Page Up/Down scrolls and Tab switches the candidate preview between Main/Subagents. **A accepts only into the draft; saving is a separate action.** Cancelling or invalid input retains the previous draft. Acceptance uses the already-read candidate even if the source file changes, and keeps the original save revision; a concurrent-save conflict retains the current draft. The complete-import entry retains full replacement. Selective import starts with nothing selected and accepts supported global options, the complete main section and/or the complete subagent section; unselected settings and their local bindings remain unchanged. See [selection and targets](PROFILES.md#selective-import).

Interface language, collector switches and independent Claude preferences stay outside portable files. The programmatic `config import` command retains its existing explicit-write and `--dry-run` behavior; the interactive review is available in both editors.

## Component composition

Main and Subagents show configured instances. In-session A (or terminal-editor Ctrl+A) opens the type picker; in-session D (or terminal-editor Ctrl+D) copies; in-session X (or terminal-editor Ctrl+X) removes. Each copy has independent formatting, colors and conditions. Text and flexible spacers support symbols and left/right layouts; defaults remain unchanged. See [components and layout](COMPOSITION.md) for keys, instance CLI, migration and downgrade recovery.

<a id="formatting-layout-presets"></a>

<a id="formatting-layouts-and-presets-v160"></a>

## Formatting, layouts and presets

Defaults retain the existing appearance. Use global Settings choices for consistent formatting and Ctrl+E item forms for specific overrides; inspect Preview before saving.

Settings covers model names, numbers, labels, icons, allowance balance/utilization, reset-time styles, and risk colors. All accepted values and defaults are in the [display option reference](reference/cli.md#display-and-host-options).

Warning defaults to 70, critical to 90; thresholds default off. Set warning-threshold and critical-threshold with warning below critical.

```bash
claude-statusline config set model-name short
claude-statusline config set number-format grouped
claude-statusline config set threshold-colors on
```

Risk colors default off, with warning 70% and critical 90%. Colors use actual utilization even when an allowance displays remaining balance. Missing observations stay unavailable, zero remains zero, and expired allowance/reset data is suppressed. Preset fields become normal editable configuration; colors, palette, directory/separator style, refresh and current subagent enablement are retained.

### Explicit layout and subagent visibility

`config layout auto` retains legacy wrapping. Explicit comma-separated rows must flatten to the current item selection in order. `config item main|subagent ID OPTION VALUE` changes label, icon, priority (0–100), max-width (2–10000 or none), or a formatting choice; inherit clears a text/format override. Explicit rows truncate item widths before dropping low priorities, rightmost first on ties, and never add continuation rows.

```bash
claude-statusline config set-items model current-dir context-used
claude-statusline config layout explicit model,current-dir context-used
claude-statusline config item main model priority 100
claude-statusline config item main current-dir max-width 32
claude-statusline config set subagent-hide-completed on
claude-statusline config set subagent-row-limit 6
claude-statusline config set subagent-task-max-width 48
```

subagent-visibility accepts all/running. Row/task limits accept none to restore their defaults; row limit 0 hides all custom rows. Hiding completed does not hide failures. Filtering/limits retain host input order and emit empty content for suppressed IDs; omitting an ID would restore its host default.

### Presets and portable configuration

| Preset | Choose it for | Main layout | Subagent defaults |
| --- | --- | --- | --- |
| `minimal` | A compact everyday view | Auto: model/effort, directory, context remaining, task timer | Existing five items |
| `developer` | Git, cumulative usage and session cost | Two rows: model/directory/Git; context remaining/tokens/timer/cost | Existing five items |
| `monitoring` | Quotas, resets, cache and session accounting | Three rows: context/allowances; resets/cache/TTL; cost/duration/API duration/requests/cache misses | Existing five items |
| `multi-agent` | Bounded agent rows and task labels | Two rows: model/directory/Git; context remaining/tokens/timer | Existing five items, hide completed, up to six rows, task width 48 |
| `left-right` | Left/right placement | One row: model/effort, Git, spacer, context remaining | status, name, spacer, elapsed |
| `repeated-metrics` | Comparing two formats of one metric | Two input-token instances, full and compact | Existing five items |

These are the six original presets. The [eight complete schemes](SCHEMES.md) also set global appearance. Both expand into editable configuration; optional data may remain unavailable.

Presets change display drafts, not collector enablement. They preserve output/interface language and host settings, rebuild item overrides, and remain editable before saving.

Presets minimal/developer/monitoring/multi-agent expand to editable drafts. They use short models and compact numbers, preserve colors/palette/directory style and refresh options, and rebuild item overrides with descending priorities in preset order. `--dry-run` prints a validated draft without saving. Imports accept portable envelopes or compatible display-only files; display-only files retain current refresh options.

Real `config preset` and `config import` writes save host settings as part of the draft, so they require this tool to own the installed status line; run `claude-statusline install` first. `--dry-run` variants and `config export` do not require ownership.

<!-- docs-example: guide-preset-import -->

```bash
claude-statusline config preset developer --dry-run
claude-statusline config export statusline.json
claude-statusline config import statusline.json --dry-run
```

After `install` establishes ownership, omit `--dry-run` to save the preset or import:

```bash
claude-statusline config preset developer
claude-statusline config import statusline.json
```

Portable files share display settings and tool-managed padding/refresh/Vim options, excluding installation, runtime state, integration preferences, and Claude appearance/behavior preferences. Export to a separate file, validate an import with `--dry-run`, then import it. Existing export files are refused unless CLI `--overwrite` is explicit. [Transfer formats, validation, and protected destinations](reference/cli.md#portable-import-export).

### Editing formats and layouts in either editor

On Main/Subagents select an item and press Ctrl+E. Edit its label, icon, priority, maximum width and inherited format choices; Ctrl+G returns to the item list. Enter opens or accepts text/integer input. `inherit` clears an override, an empty label/icon suppresses it, and `none` clears an optional width/limit. Unicode/ASCII icon modes use built-in characters and need no special font.

Layout chooses auto/explicit and sets “New row before” boundaries for all configured main instances, including disabled instances. Larger priorities are retained first (default 50); maximum widths count terminal columns, including CJK and combining text. Editing the item order keeps the row partition valid. Scope decoration yields to real items when an explicit row is too narrow. Explicit layout removes empty rows and never adds continuation lines; auto keeps wrapping.

Settings contains global format choices, risk thresholds, subagent visibility and portable operations. Choose a Preset, then activate Expand selected preset. Import accepts a path and opens a differences review. Enter expands a section; A accepts the complete candidate into the draft, then Save persists it. Ctrl+G or Q cancels the native review; Esc or Ctrl+G cancels the external review. Export writes the current draft, including unsaved edits, to a new file; it does not save settings. Relative paths resolve in the host/terminal working directory and `~` expands to the home directory. Errors retain the current draft. Existing export files are refused in both editors; choose a new path or use CLI `--overwrite` for a deliberate replacement.

While a save is pending or unknown, both editors block display-draft mutations, including already-open source/profile managers. Ctrl+K in the terminal editor and K in the in-session editor check the submitted snapshot without saving again. Definitive results unlock editing; conflict retains the draft. Read-only source inspection remains available. See [save recovery](development/correctness-maintenance.md#shared-draft-protection--fix-01).

Client uses `S` to Save/continue, `F` to Save/finish and `Q` to discard. In the terminal editor, Ctrl+S saves the editable draft outside read-only guidance/review; legacy Enter still saves from the item pages and the original settings, while Enter on a new field edits/accepts that field. In the new forms Ctrl+U clears input and Ctrl+G cancels it. Backspace edits padding/refresh numbers and Esc restores the previous value. At the top level, Esc asks before discarding unsaved changes. Select **Discard changes and close** and press Enter to leave. During field/path editing ordinary characters, including s/f/q, remain input.

### Claude preferences apply separately

In Client Settings press `H` (Claude preferences) to show or hide Claude appearance, time/title and behavior groups. Theme, verbose, turn duration, reduced motion, tips, progress and notification controls use the current host's actual rows. Available time/title rows are included; missing rows show official guidance. Model, reasoning effort, thinking and fast mode change Claude behavior and have their own group. They are independent of similarly named status-line display switches.

Edit the offered row type/choices and press `A` to Apply. Each row reports its result, including host refusal, locks, external changes and partial success. Tool Save/Finish and portable files do not apply these preferences. Reload explicitly discards pending edits; click the restored Client region before continuing with the keyboard. The host may expose a different type or omit a row; use the indicated official entry such as `/config`, `/model`, `/effort` or `/fast` in that case. The terminal editor manages tool configuration and has no Claude host API.

<a id="phase-5-preview-installation"></a>
<a id="phase-5-stable-installation"></a>

<a id="quick-setup-and-explanation"></a>

## Quick setup, text editing and explanation

### Quick setup

In `/statusline-configure-native` or `claude-statusline configure`, press **Ctrl+P** or choose **Settings → Quick setup**. The [scheme guide](SCHEMES.md#editor-quick-setup) covers choosing, previewing, saving and cancelling a candidate.

### Text input

Text, search, numeric and file-path inputs support Left/Right, Home/End, insertion, Backspace and forward Delete, with horizontal scrolling. `▏` marks the caret. Grapheme deletion preserves combining sequences and complete emoji. Ctrl+U clears, Enter accepts, Ctrl+G cancels; native Esc returns focus to the host. Text/search allow 256 codepoints, paths 4096 and numeric edit buffers 32. Oversized or control-containing insertions are rejected with a message rather than truncating the original value.

External bracketed paste and recognizable native multi-character text cannot execute shortcuts. The native Client single-key API has no paste-origin flag: host-split single-character paste cannot reliably be distinguished from typing. Enter a field before pasting; this interface cannot remove that host limitation.

### Sample explanation

Select a configured component, press Ctrl+E, then choose **Configuration and sample explanation**. The view separates draft enablement, known local installation/collector requirements and sample condition hiding, clipping or width omission. Repeated types resolve by instance ID; agent sample rows have separate outcomes. Actual session input is not read, so live PR, cache, task and field availability remain unknown. Preview-panel overflow is distinct from renderer omission. Scroll with arrows or PgUp/PgDn and return with Ctrl+G.

Explanation does not write files, create locks, scan transcripts or start collection. Save conflicts and write failures keep the editor and draft open for inspection or cancellation; they never automatically overwrite another editor's changes.

## Unicode text and terminal widths

Wrapping, truncation and editor previews keep extended grapheme clusters together, including combining accents and joined emoji. Ambiguous characters use one column; ordinary CJK and emoji clusters use two. The layout policy is fixed across supported runtimes and editors. Actual glyph appearance still depends on your terminal and fonts.

Truncation ends at a complete grapheme boundary and appends `…`; saved labels, icons and paths remain intact. Backspace removes a complete text cluster. Palette changes belong to the display draft; the native light/dark preview background remains an independent UI preference. See [Unicode text and terminal widths](COMPOSITION.md#unicode-text-and-terminal-widths).

## Settings and configuration files

### Display and host options

Use Settings or `config set OPTION VALUE` for appearance, directory styles, separators, scope labels, refresh, and subagent visibility. Host options `padding`, `refresh-interval`, and `hide-vim-mode-indicator` require installation ownership. Full values and defaults are in the [option reference](reference/cli.md#display-and-host-options).

`refresh-interval event` refreshes only on Claude events; a running timer will not change each second. Restore continuous updates with `claude-statusline config set refresh-interval 1`.

### Configuration files

Use the CLI or an editor to change the active configuration. Display choices and the in-session Client preference use separate files, including `claude-statusline.json` and `claude-statusline-native.json`. For paths, schemas and the complete file list, use the [configuration reference](reference/cli.md#configuration-files). Before restoring an older file, check the [version compatibility steps](#version-compatibility).

### Custom configuration directory and environment variables

For management commands use `--config-dir`; with `config`, put it before the action:

```text
claude-statusline config --config-dir /path/to/claude-config show
claude-statusline configure --config-dir /path/to/claude-config
```

The explicit directory takes precedence over `CLAUDE_CONFIG_DIR`, then the default `~/.claude`. Use the same directory when starting Claude Code and managing the integration. [Environment variables and shell examples](reference/cli.md#custom-configuration-directory-and-environment-variables).

## Understand displayed data

### Configurable display items

Use the catalog to inspect supported IDs and current enablement:

```text
claude-statusline config list-items
claude-statusline config subagents list-items
```

Select items in an editor or enable them by ID. These optional main items cover common needs.

| Group | Optional IDs |
| --- | --- |
| Identity and session | `project-name`, `hostname`, `version`, `session`, `agent` |
| Modes | `fast-mode`, `thinking`, `vim-mode` |
| Repository | `pr`, `repo`, `worktree` |
| Context and usage | `context-used`, `cost`, `prompt-cache` |

For defaults, host requirements and unavailable data, see the [main items](DISPLAY_ITEMS.md#main-items) and [subagent items](DISPLAY_ITEMS.md#subagent-items). For scripting, see [catalog commands](reference/cli.md#configurable-display-items).

### Main status line fields

To interpret the main line, see [Git markers](DISPLAY_ITEMS.md#git-markers) and [token fields](DISPLAY_ITEMS.md#token-fields). To investigate `Git!`, use the [Git troubleshooting steps](#git-information-is-missing-or-shows-git).

<a id="task-timing-preview"></a>
<a id="task-timing"></a>
<a id="prompt-timing-markers"></a>
<a id="prompt-计时标记"></a>

#### Task total and execution time

Use `task-timer` for total task time and `task-active-timer` for execution time. See the [clock definitions, markers and availability](DISPLAY_ITEMS.md#timer-definitions).

To show execution time, run these commands with Claude Code 2.1.289 or later.

```text
claude-statusline install --native-timing
claude-statusline config enable task-active-timer
claude-statusline doctor
```

Restart Claude Code after changing collector integration. If execution time is still missing, check the integration result in `doctor` and the [observation requirements](DISPLAY_ITEMS.md#timer-definitions).

<a id="子-agent-行与三种作用域"></a>

### Subagent rows and the three scopes

Each subagent row shows one task. See [display scopes](DISPLAY_ITEMS.md#display-scopes) for how fields with the same name differ between the main line and subagent rows. For missing rows or a third-party override, see [subagent troubleshooting](#subagent-rows-are-missing-or-ownership-conflicts-occur).

### Opt-in live state

Collection and display selection are separate steps. Enable the independent collector, then select the fields you want:

```text
claude-statusline install --live-metrics
claude-statusline config enable run-state permission-mode active-agents task-progress last-tool
claude-statusline doctor
```

Restart Claude Code to load collection. Additional collected items are `ttft`, `output-rate`, `prompt-input-tokens`, `prompt-output-tokens`, and `prompt-cost`. Use either editor or `config enable` to select them. They are all off in the default item selection; live collection requires Claude Code 2.1.289+ and does not turn on with an editor alone.

`claude-statusline install --no-live-metrics` preserves the legacy choice to disable both timing and advanced collection. Add `--native-timing` to retain timing metadata. Ordinary reinstall preserves saved choices. Missing live observations show `—`; limited coverage or recent observations can carry `*`. [Metric definitions](DISPLAY_ITEMS.md#live-state-items) explain per-field collection and request coverage; [runtime diagnostics](development/live.md) cover collection problems.

`branch-diff` is a separate default-off item backed by local Git and works without the native collector. Select it with `claude-statusline config enable branch-diff`, and configure committed branch comparison with `claude-statusline config set branch-diff-base auto` or a safe local Git ref. It excludes uncommitted worktree edits and does not fetch remotes. [Branch and ended-agent definitions](DISPLAY_ITEMS.md#branch-base-and-ended-agents).

## `doctor` diagnostics

```text
claude-statusline doctor
```

Doctor checks platform/Node, PATH, configuration validity, command ownership, hooks, editor preferences/resources, host compatibility, launch prerequisites, runtime collection, and writable state. Skill checks compare the complete installed body with the current bundled template; host checks validate padding, refresh interval and Vim-indicator types/ranges. Runtime writability uses a private temporary probe that is removed immediately. It does not rewrite configuration or open editor windows; macOS may check parent-directory synchronization capability. Passing diagnostics does not independently verify GUI focus or human interaction.

`[OK]` passes; `[WARN]` describes degradation and still allows exit 0; any `[ERROR]` makes exit 1. For stale integration, run `install`, rerun `doctor`, then restart Claude Code. Resolve ownership conflicts before using `--force`.

For an existing display configuration file, the schema check reports the supported version, currently `[OK] display config schema: v17`. A valid older file instead reports, for example:

```text
[WARN] display config schema v4 is valid and will migrate to v17 on the next configuration save
```

This warning does not migrate the file: diagnosis and reads preserve its bytes; an actual configuration save backs up and migrates it. The display schema is independent of configuration protocol v31 and runtime protocol v3.

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

If `subagents.instances` is empty or `subagents.enabled` is false, this renderer returns empty content as required by the protocol. After entering a subagent transcript, the global bottom line still belongs to the main agent/session because Claude provides no current-focus ID.

<a id="statusline-config-不可见"></a>

### `/statusline-config` is missing

```bash
claude-statusline install
claude-statusline doctor
```

Confirm that `/statusline-config skill` is OK in doctor. If installation happened after the current Claude Code session started, open a new session and check command discovery again.

<a id="statusline-configure-不可见或显示-suspended"></a>

### `/statusline-configure-native` is missing, ignores keys or cannot save

1. Run `claude-statusline doctor` to check host 2.1.287+, resources and backend binding. Suspension on an older host is compatibility handling.
2. Check recorded disablement, host plugin disablement, safe/bare mode and policy. If needed, run `install --native-editor` and restart Claude Code in a trusted terminal.
3. Click the Client region once before keyboard use. On macOS, follow [mouse reporting and Client focus checks](#macos-mouse-reporting-and-client-focus); the latest reported macOS configuration remains unverified. Ctrl+G cancels input; Esc remains host-owned.
4. For a save conflict, use `R` to discard the draft and reload when ready. Use `K` to check an unknown save outcome and Retry/Close for failures.
5. For a version or resource mismatch, reinstall the matching npm package in the same prefix. Run `claude-statusline install` and `claude-statusline doctor` using that entry, then restart Claude Code. [Install a verified package](#offline-installation)

### `/statusline-configure` is missing or suspended

Check the host version and recorded preference. Stable defaults this entry on; explicitly restore it with:

```bash
claude --version
claude-statusline install --experimental-slash-tui
claude-statusline doctor
```

Explicit enabling below 2.1.258 or on an unrecognized host retains the preference and suspends the entry without blocking basic installation. After an enabled installation is downgraded, normal `install` retains the preference but suspends and removes the active skill/hook, hiding the command from the slash menu. Upgrade to a compatible version, rerun normal `install`, and open a new Claude Code session.

<a id="实验入口无法打开新终端"></a>

<a id="experimental-entry-point-cannot-open-a-terminal"></a>

### External entry point cannot open a terminal

The tmux path requires valid `TMUX`, `TMUX_PANE` shaped as `%<digits>`, and access to the target server/pane within a 2-second preflight check in the hook environment. An invalid Linux target falls back to GNOME; macOS checks the local graphical session and Terminal.app instead. Missing prerequisites lead to a standalone-command suggestion. Once tmux is selected successfully, failure inside the popup does not launch another terminal.

The macOS Terminal path requires a local graphical session, system Terminal.app, `/usr/bin/open`, and usable process start identity. No handshake within 30 seconds produces an error; first check whether a window opened and the installed Node entry can run `configure` in that terminal. `doctor` checks conditions without opening a window. Over SSH, use the standalone command. If Terminal retains its window after completion, adjust Terminal's window-closing preferences.

GNOME requires `DISPLAY` or `WAYLAND_DISPLAY`, executable `gnome-terminal`, and a usable user D-Bus/graphical session. D-Bus startup errors return a short error to the original Claude conversation. If neither Linux launcher is available, or macOS lacks valid tmux and local Terminal.app conditions, run directly in a terminal:

```bash
claude-statusline configure
```

Windows hosts `CREATE_NEW_CONSOLE` in the system default terminal. Closing the window, abnormal child exit, or absence of a trusted result immediately returns an error to the original conversation. Diagnose directly with `claude-statusline.cmd configure` in PowerShell. The editor uses Node raw TTY/VT input and output. Check that the installed entry runs in a real console and that `doctor` reports valid resources, bindings and a writable runtime directory; it does not print the retired curses diagnostic rows.

When the hook ends after 600 seconds, the TUI should normally already have timed out at 570 seconds. When inspecting `<CLAUDE_CONFIG_DIR>/statusline_runtime/slash_tui/`, do not manually follow or delete unknown symbolic links. Automatic cleanup handles only remnants older than 24 hours that match this tool's naming prefix and contain no symbolic links.

With `disableAllHooks`, the local launcher does not run. If local interception is unavailable, the fallback skill reports that it could not launch the editor and suggests `claude-statusline configure` in a terminal (`claude-statusline.cmd configure` on Windows) or `/statusline-config`. It prohibits starting a terminal interface through Bash/PowerShell or another model tool; this exception may use a very short model turn. Check the hook settings and try a new session.

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

`padding`, `refresh-interval`, `hide-vim-mode-indicator`, full `apply`, and real `preset`/`import` writes save Claude Code host settings. To protect other status lines, these operations require `statusLine.command` to point to the current executable; otherwise they report an uninstalled or foreign status line. Their `--dry-run` forms do not write.

First inspect:

```bash
claude-statusline config show
claude-statusline doctor
```

If you intend this tool to manage the status line, run `claude-statusline install`. Display items, colors, palette, directory style, and separator can be configured before installation.

<a id="json-配置损坏"></a>

### Corrupted JSON configuration

An invalid user-default display file falls back to built-in user-default settings during rendering; a valid project Profile can still be selected. Diagnostics and normal writes report the invalid file. Restore the user default without deleting Profiles or project bindings:

```bash
claude-statusline config reset
claude-statusline doctor
```

To preserve manual edits, restore from the latest backup or repair the JSON before running doctor.

<a id="git-信息缺失或显示-git"></a>

### Git information is missing or shows `Git!`

Check whether Git is on PATH with `command -v git` on Linux, WSL or macOS, or `Get-Command git` in PowerShell. Outside a repository the worktree status items are omitted. `Git!` indicates a failed worktree status observation, which can include a collection policy refusal. Run `claude-statusline doctor` from the project directory to inspect the filter policy. [Git collection policy](DIAGNOSTICS.md#git-collection-policy)

To stop the renderer's built-in Git queries, disable the compound, its independent status items and the committed branch comparison. Use this command for a type-based user-default display.

```bash
claude-statusline config disable git git-branch git-changes git-ahead-behind branch-diff
```

If the project uses a named scheme or the display contains repeated instances, select the corresponding target in an editor and disable every enabled copy of those items.

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

Automatic layout wraps to fit the terminal; explicit layout truncates to maximum widths and hides lower-priority items without adding continuation rows. Increase width, use `compact` separators, choose a shorter directory style, or hide secondary items to reduce wrapping.

### macOS mouse reporting and Client focus

On macOS, the in-session Client pane may open without reliable mouse or keyboard focus; this remains unverified. The main status line and terminal editor remain available. See the [acceptance record](development/native.md#claude-code-21289-interaction-report).

For Terminal.app, try these checks:

1. In the Terminal window running Claude Code, choose **View → Allow Mouse Reporting** and confirm the menu item is checked. Apple documents this option as selected by default in new windows, so inspect its actual state. See [Apple's mouse reporting guide](https://support.apple.com/guide/terminal/turn-on-mouse-reporting-trmlc69728a5/mac).
2. Run `/statusline-configure-native`, then click inside the **Client content region** once. Check that Tab changes pages, the arrow keys move selection and Space toggles an item. If keys still go to the conversation input, Client focus has not been established. Use `Q` to discard test edits once Client input works.
3. If interaction still fails, record the macOS version, terminal name/version, output of `claude --version`, whether tmux or SSH is involved, and which clicks/keys fail. Run `claude-statusline doctor` to check integration and backend binding. These diagnostics do not verify mouse delivery or Client focus. Use `claude-statusline configure` in a standalone terminal, or `claude-statusline config ...`, while troubleshooting the session entry.

**These are suggested checks, not a verified fix for the reported macOS environment.** Apple explains that Allow Mouse Reporting permits events to reach an application; the application must also enable mouse reporting. The menu setting alone does not activate that behavior or guarantee Client focus. Apple also lists Command+R as a [toggle for this setting](https://support.apple.com/guide/terminal/keyboard-shortcuts-trmlshtcts/mac); check the menu state after using it.

If using **iTerm2**, check **Settings → Profiles → Terminal → Enable mouse reporting** and **Report mouse clicks & drags**. The latter must permit clicks to reach applications for a click-based focus check. Holding Option temporarily bypasses mouse reporting, so test with a plain click. See [iTerm2's official terminal profile documentation](https://iterm2.com/documentation-preferences-profiles-terminal.html). These iTerm2 checks have not been validated against the maintainer's reported problem.

## Exit codes

Management commands generally use 0 for success and 2 for argument/configuration/ownership errors; `doctor` errors and blocked setup checks use 1. See the [command-specific exit-code reference](reference/cli.md#exit-codes). TUI interruption uses 130 or `128 + signal`, with the terminal restored and the draft unsaved.

## Current limitations

- Settings and project bindings are stored per user. [Project bindings](PROFILES.md) select named display schemes; repository files do not supply executable configuration. Drag-and-drop and custom key bindings are not provided.
- The macOS in-session Client interaction issue remains recorded. The terminal editor and CLI are available alternatives.
- Desktop external launchers support the listed platform terminals. Other terminals can use `claude-statusline configure` or tmux; IDE, print mode, web sessions, and globally disabled hooks do not guarantee a terminal editor.
- Optional live fields require independent collection and valid observations; they do not infer missing measurements or focused-agent identity.
- Subagent rows expose current task fields rather than a historical ledger or per-agent Git/cache/session aggregation.
- Task completion requires confirmed ending evidence plus resolved agents, reports and main wrap-up; no timeout or heartbeat fabricates completion. See [timer definitions](DISPLAY_ITEMS.md#timer-definitions).
- Status-line output colors use the configured project palette; in-session editor text and controls follow Claude's applied theme.

## Upgrading

### Reviewed package changes

Use **Settings → Version and installation** in either editor or start a CLI metadata review with `claude-statusline update --check`. Package rollback and configuration restoration have separate reviews. [Upgrade, rollback and recovery steps](PACKAGE_MANAGEMENT.md)

### Manual npm replacement

Repeat the [npm installation steps](#install-the-npm-package) or [offline installation steps](#offline-installation) for the desired version, using the same global or explicit prefix. Then synchronize the integration.

### Synchronize Claude Code integration

```text
claude-statusline --version
claude-statusline install
claude-statusline doctor
claude-statusline config show
```

Restart Claude Code. Installation synchronizes command paths, skill templates, hooks, plugins, and compatibility. Display settings, independent preferences, caches, and task state remain. Historical external disablement could remove the preference file; if the preference is missing, use `--no-experimental-slash-tui` to explicitly keep that entry off.

### Version compatibility

Display schema 17 stores instance IDs in ordering and rows. Reads of supported older formats convert in memory. A save or installation that migrates the file first backs up the old bytes. Use matching editor resources and backend, and check the target package's format and item support before switching versions. [Configuration formats](reference/cli.md#configuration-files) · [Composition migration and recovery](COMPOSITION.md#migration-transfer-and-recovery)

Before downgrading, use the newer package to disable/remove integrations that the older package cannot manage, including live collection and the in-session editor (Client) as applicable. Restore a compatible display backup using its `metadata.json`, or remove unsupported item IDs where schema compatibility permits. Then install the old package, run `install` and `doctor`, and restart Claude Code. A portable export can separately retain current display choices for later reuse.

Crossing a Claude host-version requirement independently suspends or restores the corresponding integration according to saved preferences. Explicit disablement and user-disabled plugins remain disabled. [Historical changes](../CHANGELOG.md).

<a id="migrate-the-previous-distribution-name"></a>

### Migrate from Python

Stop active Claude sessions and back up the configuration directory before switching writers. Record the Python executable's absolute path and version and keep that environment for rollback. Choose an exact stable npm release and verify its attachments using the [offline installation steps](#offline-installation). From a directory you will keep, install the verified tgz into a separate prefix and use its Node entry even if the Python command is still on PATH. Replace `VERSION` with the verified version.

```text
npm install --prefix ./statusline-node --offline --ignore-scripts "./fbincon-claude-code-statusline-VERSION.tgz"
node ./statusline-node/node_modules/@fbincon/claude-code-statusline/bin/claude-statusline.js --version
node ./statusline-node/node_modules/@fbincon/claude-code-statusline/bin/claude-statusline.js install --dry-run
node ./statusline-node/node_modules/@fbincon/claude-code-statusline/bin/claude-statusline.js install
node ./statusline-node/node_modules/@fbincon/claude-code-statusline/bin/claude-statusline.js doctor
```

Run these commands from a durable installation directory and keep that directory and Node executable in place while integrated. To use temporary Claude configuration, pass the same explicit `--config-dir` to every command. Existing display settings, saved collector/editor choices and unrelated settings are preserved; a missing collector preference now means both off. Do not overwrite a foreign PATH command with npm `--force`. Historical Python distribution-name instructions remain in the [v2.0.0 guide](https://github.com/fbincon/claude-code-statusline/blob/v2.0.0/docs/USER_GUIDE.md).

For rollback, stop Claude, use the Node entry to run `install --no-native-timing --no-live-metrics` and `uninstall`, restore the pre-cutover compatible configuration/absence from backup, then run the retained Python entry's `install` and `doctor`. Restore any former PATH selection deliberately; npm does not remove the retained Python environment.

## Uninstalling

Remove integration while the CLI is still installed:

```text
claude-statusline uninstall --dry-run
claude-statusline uninstall
npm uninstall --global @fbincon/claude-code-statusline
```

Windows uses `claude-statusline.cmd`, or Node with the absolute installed JavaScript entry. The uninstaller removes only owned commands, hooks, skills, plugins, and resources; third-party settings remain. Display files, editor/live preferences, caches, task state, and backups remain for reuse. Keep integrations disabled across a later reinstall by explicitly saving the corresponding `install --no-...` preferences first.

## Backups and rollback

Actual installation, removal, and configuration changes create backups in:

```text
<CLAUDE_CONFIG_DIR>/backups/statusline/cli-<action>-<timestamp>/
```

`metadata.json` records action, time, original absolute paths, and whether each file existed. A `.before` file holds the original bytes; `.absent` means the target previously did not exist. Before manual rollback, exit the affected Claude sessions and editors. Restore `.before` to its recorded target; restore an `absent` target to absence. A failed transaction attempts rollback and retains the backup.

## Related documentation

- [Project README](../README.md) and [screenshot index](images/README.md).
- [CLI reference](reference/cli.md) and [display/metric definitions](DISPLAY_ITEMS.md).
- [Development guide](development/README.md), [testing](development/testing.md), and [release guide](RELEASING.md).
- [Claude Code status-line documentation](https://code.claude.com/docs/en/statusline) and [hooks reference](https://code.claude.com/docs/en/hooks).

<details>
<summary>Previous section links and detailed references</summary>

<a id="cli-overview"></a>
<a id="cli-总览"></a>

[CLI overview](reference/cli.md#cli-overview)

<a id="config-apply"></a>
<a id="config-disable-item"></a>
<a id="config-enable-item"></a>
<a id="config-list-items"></a>
<a id="config-order-item"></a>
<a id="config-reset"></a>
<a id="config-set-items-item"></a>
<a id="config-set-option-value"></a>
<a id="config-show"></a>
<a id="config-subagents-"></a>
<a id="configuration-command-reference"></a>
<a id="error-clock-is-not-a-supported-item"></a>
<a id="error-git-appears-twice"></a>
<a id="配置命令详解"></a>

[Configuration command reference](reference/cli.md#configuration-command-reference)

<a id="可配置显示项"></a>

[Configurable display items](reference/cli.md#configurable-display-items)

<a id="git-markers"></a>
<a id="git-标记"></a>
<a id="token-fields"></a>
<a id="token-含义"></a>
<a id="主状态栏显示含义"></a>

[Main status line fields](reference/cli.md#main-status-line-fields)

<a id="colors"></a>
<a id="default-refresh-every-second"></a>
<a id="directory-formats"></a>
<a id="refresh-interval"></a>
<a id="refresh-less-frequently"></a>
<a id="refresh-only-on-claude-code-events"></a>
<a id="separators-and-semantic-groups"></a>
<a id="分隔符和语义分组"></a>
<a id="刷新间隔"></a>
<a id="显示与宿主选项"></a>
<a id="目录格式"></a>
<a id="颜色"></a>

[Display and host options](reference/cli.md#display-and-host-options)

<a id="claude-code-host-configuration"></a>
<a id="claude-code-宿主配置"></a>
<a id="display-configuration"></a>
<a id="editor-enablement-preferences"></a>
<a id="experimental-feature-preferences"></a>
<a id="实验功能偏好"></a>
<a id="显示配置"></a>
<a id="配置文件"></a>

[Configuration files](reference/cli.md#configuration-files)

<a id="自定义配置目录与环境变量"></a>

[Custom configuration directory and environment variables](reference/cli.md#custom-configuration-directory-and-environment-variables)

<a id="退出码"></a>

[Exit codes](reference/cli.md#exit-codes)

<a id="appendix-development-and-testing"></a>
<a id="build-and-install-from-source"></a>
<a id="isolated-testing-and-manual-acceptance"></a>
<a id="prepare-a-development-environment"></a>
<a id="run-checks"></a>
<a id="从源码构建与安装"></a>
<a id="准备开发环境"></a>
<a id="运行检查"></a>
<a id="附录开发与测试"></a>
<a id="隔离测试与人工验收"></a>

[Appendix: development and testing](development/README.md#appendix-development-and-testing)

<a id="appendix-internal-commands"></a>
<a id="hook"></a>
<a id="render"></a>
<a id="render-subagents"></a>
<a id="slash-hook"></a>
<a id="附录内部命令"></a>

[Appendix: internal commands](development/README.md#appendix-internal-commands)

<a id="appendix-implementation-notes"></a>
<a id="configuration-writes-and-concurrency"></a>
<a id="experimental-launchers-and-result-bridging"></a>
<a id="external-launchers-and-result-bridging"></a>
<a id="platform-execution-and-file-safety"></a>
<a id="实验启动器与结果回传"></a>
<a id="平台执行与文件安全"></a>
<a id="配置写入与并发"></a>
<a id="附录实现说明"></a>

[Appendix: implementation notes](development/README.md#appendix-implementation-notes)

<a id="claude-code-statusline-使用指南"></a>
<a id="doctor-诊断"></a>
<a id="enable-and-disable"></a>
<a id="experimental-statusline-configure-entry-point"></a>
<a id="external-tui-sections-and-page-hierarchy-v161"></a>
<a id="formatting-layouts-and-presets-v161"></a>
<a id="install-会做什么"></a>
<a id="macos-安装与验证边界"></a>
<a id="statusline-config-execution-paths"></a>
<a id="statusline-config-的执行方式"></a>
<a id="statusline-config-问答向导"></a>
<a id="usage"></a>
<a id="使用方式"></a>
<a id="功能概览"></a>
<a id="升级"></a>
<a id="卸载"></a>
<a id="同步-claude-code-接入"></a>
<a id="启用与关闭"></a>
<a id="处理已有-statusline-或同名-skill"></a>
<a id="备份与回滚"></a>
<a id="安装-python-包"></a>
<a id="安装与接入"></a>
<a id="安装前预览"></a>
<a id="实验入口-statusline-configure"></a>
<a id="当前边界"></a>
<a id="接入-claude-code"></a>
<a id="文档导航"></a>
<a id="替换-python-包"></a>
<a id="版本兼容"></a>
<a id="独立交互式-tui"></a>
<a id="相关文档"></a>
<a id="运行要求"></a>

[Current configuration and compatibility](#version-compatibility).

</details>
