# Claude Code Statusline User Guide

**English** | [简体中文](USER_GUIDE.zh-CN.md)

This guide walks through installation, editor use, common configuration, optional live metrics, and recovery. Complete command and file details are in the [CLI reference](reference/cli.md); development and build instructions are in the [development guide](development/README.md).

Settings apply to the current user's Claude Code projects. Rendering reads Claude input, local Git, transcripts, and state without network requests or model tokens. The question-and-answer wizard uses model turns.

Single-line CLI examples work in Bash, Zsh, and PowerShell. Windows uses `claude-statusline.exe`. `<CLAUDE_CONFIG_DIR>` means the value of `CLAUDE_CONFIG_DIR`, or `~/.claude` if unset; it is a placeholder, not a literal argument.

## Contents

- [Feature overview](#feature-overview)
- [Requirements](#requirements)
- [Installation and integration](#installation-and-integration)
- [Choose a configuration entry point](#choose-a-configuration-entry-point)
- [Interface language](#interface-language)
- [Statusline language](#statusline-language)
- [Native configuration editor](#native-configuration-editor)
- [Standalone interactive TUI](#standalone-interactive-tui)
- [External terminal `/statusline-configure`](#external-terminal-statusline-configure)
- [`/statusline-config` wizard](#statusline-config-wizard)
- [Configuration recipes](#configuration-recipes)
- [Formatting, layouts and presets](#formatting-layouts-and-presets)
- [Opt-in live state](#opt-in-live-state)
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
- [Related documentation](#related-documentation)

## Feature overview

[Conditional visibility, item colors, themes and Powerline](APPEARANCE.md) explains the shared controls, raw-observation rules and migration recovery.

Choose from 60 main-line items and 14 subagent items. Defaults enable 10 main items and five subagent items. Both editors provide Main, Subagents, Settings, and Layout pages, fixed sample previews, formatting, four editable presets, and portable JSON files.

The main line reports main/session data; each subagent row reports its own task. Task timing includes subagent work and main-agent wrap-up. [Display definitions](DISPLAY_ITEMS.md) explain sources, scope, missing observations, and metric limits.

## Requirements

| Platform | Environment |
| --- | --- |
| Linux / WSL | Python 3.10+ |
| Windows 10/11 | CPython 3.10–3.14, x86/x64; conditional `windows-curses>=2.4.2` dependency |
| macOS 14+ | CPython 3.10–3.14 with curses, Intel / Apple Silicon |

Install Claude Code CLI and [pipx](https://pipx.pypa.io/latest/how-to/install-pipx.html). Git is needed for Git fields and source installation. Windows ARM devices can use x64 Python emulation; native ARM64 Python is outside the support contract.

| Feature | Claude Code requirement |
| --- | --- |
| Main line, CLI, standalone TUI, wizard | Available on older/unknown hosts; unavailable data is omitted |
| Subagent rows and lifecycle hooks | 2.1.205+; per-task effort 2.1.214+ |
| Local argument-based slash commands, external TUI entry | 2.1.258+ |
| In-session Client editor | 2.1.287+ |
| Native timing and advanced live-metrics collection | 2.1.289+ |

The external launcher uses tmux or GNOME Terminal on Linux, tmux or Terminal.app on macOS, and a system new console on Windows. In other terminal environments, run the standalone editor directly. After crossing a host-version requirement, rerun `install` and `doctor`.

## Installation and integration

### Install the Python package

Install the stable package from [PyPI](https://pypi.org/project/fbincon-claude-code-statusline/):

```text
pipx install fbincon-claude-code-statusline
pipx ensurepath
```

The distribution name is `fbincon-claude-code-statusline`; the command remains `claude-statusline` and the Python import remains `claude_statusline`. Previous installations from this repository use the [migration procedure](#migrate-the-previous-distribution-name). The [v1.11.0 Release](https://github.com/fbincon/claude-code-statusline/releases/tag/v1.11.0) provides the same wheel and source distribution.

Alternatively download the wheel, source archive, and `SHA256SUMS` from that release. Compare the downloaded file's SHA-256 with the corresponding entry:

```bash
# Linux / WSL
sha256sum fbincon_claude_code_statusline-1.11.0-py3-none-any.whl
# macOS
shasum -a 256 fbincon_claude_code_statusline-1.11.0-py3-none-any.whl
```

```powershell
Get-FileHash .\fbincon_claude_code_statusline-1.11.0-py3-none-any.whl -Algorithm SHA256
Get-Content .\SHA256SUMS
```

With all listed assets downloaded, use `sha256sum -c SHA256SUMS` on Linux/WSL or `shasum -a 256 -c SHA256SUMS` on macOS. Install a local wheel with `pipx install ./fbincon_claude_code_statusline-1.11.0-py3-none-any.whl` (PowerShell: `.\fbincon_claude_code_statusline-1.11.0-py3-none-any.whl`).

Fixed-tag source installation requires Git:

```text
pipx install "git+https://github.com/fbincon/claude-code-statusline.git@v1.11.0"
pipx ensurepath
```

Use `@main` for development source or `pipx install .` for a local checkout. Build instructions are in the [development guide](development/README.md#build-and-install-from-source).

### Integrate with Claude Code

Reopen the terminal after `pipx ensurepath`, then run:

```text
claude-statusline --version
claude-statusline install --dry-run
claude-statusline install
claude-statusline doctor
```

Windows uses `claude-statusline.exe` and requires that executable on PATH. Restart Claude Code in a trusted terminal to load the installed plugins and commands.

### What `install` does

The installer merges owned status-line commands, timing/subagent hooks, configuration skills, and compatible editor integrations into the user configuration. It preserves unrelated settings and hooks, backs up actual changes, and uses atomic writes. Repeated installation is idempotent.

The two editor entries default on when there is no saved preference. Explicit parameters override saved preferences; saved preferences override defaults. Unsupported integrations suspend without losing the preference. Native timing and advanced collection have independent preferences; compatible fresh installs default to timing metadata on and advanced metrics off. Existing valid padding, refresh, and Vim-indicator choices remain; a new installation refreshes once per second.

### Preview installation

`claude-statusline install --dry-run` reports whether files would change without writing settings, resources, or backups.

### Handle an existing status line or skill with the same name

The installer rejects conflicting third-party status-line settings or same-name skills before changing files. Inspect the reported conflict; use `claude-statusline install --force` only when replacing those resources is intended. Native command/plugin identity conflicts require resolving ownership rather than forcing takeover.

To preserve a third-party subagent renderer, run `claude-statusline config set subagent-statusline off`, then ordinary `install`. Installation flags and ownership behavior are in the [CLI reference](reference/cli.md#installation-and-diagnostics).

### macOS installation and validation boundaries

macOS uses the same wheel and installation flow. CPython must provide curses. Terminal.app is the supported desktop external launcher; tmux popup is preferred when available. SSH and sessions without a graphical desktop should use the standalone editor or CLI.

Current layouts are in the [README gallery](../README.md#screenshots) and [image index](images/README.md). The known in-session Client input limitation is separate from the main line and external editor; see [focus checks](#macos-mouse-reporting-and-client-focus).

## Choose a configuration entry point

| Entry | Best suited to |
| --- | --- |
| `/statusline-configure-native` | Configuring inside the current Claude session |
| `/statusline-configure` | A separate supported terminal, launched from Claude |
| `claude-statusline configure` | Configuring directly in the current terminal, including SSH |
| `/statusline-config` | Guided questions using Claude model turns |
| `claude-statusline config ...` | Exact settings, automation, and scripts |

All entries share user settings. Two open editors keep separate drafts; a stale draft cannot overwrite a newer saved revision.

<a id="native-editor-preview"></a>

<a id="v130a2-external-tui-and-in-session-client"></a>

## Interface language

The CLI, external/standalone curses editor and in-session Client default to English. In Settings choose **Interface language (saved immediately)** → **English / 简体中文**. The language is shared across both editors and CLI, independent of Claude's own theme and language settings.

```text
claude-statusline config language show [--json]
claude-statusline config language set zh-CN
claude-statusline config language set en
claude-statusline config language reset
claude-statusline --language zh-CN configure
claude-statusline --language en config --help
```

Omit the square brackets when using `--json`. `reset` saves English. Put the optional `--language` before the command; it overrides the saved preference for that invocation without writing it. An editor opened with that override can still save a new language through Settings. For an isolated directory use `claude-statusline config --config-dir /path/to/config language set zh-CN`.

A switch saves immediately and preserves the current page, selected field, search, input and display draft. It recomputes terminal layout and redraws translated text. Save/cancel continues to govern display changes only; a failed language write keeps the previous language and reports the error. Other open windows read the new preference when reopened or through their existing reload action. Search matches IDs, English/Chinese names and descriptions, and custom labels in either language.

The preference is `<CLAUDE_CONFIG_DIR>/statusline-ui.json`, schema v1. Missing or invalid preferences fall back to English; reading never repairs the file. Explicit set/reset backs up and repairs corrupt preferences, but refuses a newer schema. Reinstall, upgrades, ordinary uninstall, display reset, presets and portable import/export preserve this independent preference.

Interface language does not change actual statusline samples/output. Model names, paths, branches, commands, IDs, configuration values and custom labels retain their identity. The model-based wizard reads the interface preference on each invocation and uses localized CLI descriptions; JSON catalogs retain English metadata and stable IDs.

<a id="item-discovery-import-review"></a>

## Find items and review imports

Press `/` on Main/Subagents to enter a query; Enter accepts it, Ctrl+U clears it, and Ctrl+G restores the previous query. Curses also accepts direct typing and Esc cancels explicit search input. Search matches IDs, English/Chinese names and descriptions, custom labels and categories in either interface language. Exact matches rank before prefixes, English initials (for example `mwe`), substrings and ordered subsequences; equal ranks preserve the existing order. Highlighted text identifies the actual match, including an alternate-language snippet when needed.

Ctrl+F opens the category picker. Select with arrows and accept with Enter; choose All categories to remove the category filter. Query and category combine and stay local to the editor session. While filtered, items can be toggled or formatted; ordering is disabled. Clearing filters restores the full order and neither filter is exported or saved.

For an item's source and conditions, press Ctrl+E, select **Sources and requirements** at the start of the form, then Enter. Scroll with arrows or Page Up/Down and return with Ctrl+G (Esc also works in curses). This page explains measurement scope, source fields, verified host requirements, optional collectors and possible unavailable reasons. It does not inspect current data or enable anything. An unobserved item remains selectable and its preview stays a fixed sample.

Import from Settings opens a review against the current **unsaved draft**. Sections cover selection, retained-item order, formatting/overrides, layout, statusline language and statusline host settings. Enter expands the selected section, arrows select sections, Page Up/Down scrolls and Tab switches the candidate preview between Main/Subagents. **A accepts only into the draft; saving is a separate action.** Cancelling or invalid input retains the previous draft. Acceptance uses the already-read candidate even if the source file changes, and keeps the original save revision; a concurrent-save conflict retains the current draft. The first version replaces the complete draft rather than merging individual fields.

Interface language, collector switches and independent Claude preferences stay outside portable files. The programmatic `config import` command retains its existing explicit-write and `--dry-run` behavior; the interactive review is available in both editors.

## Statusline language

The independent display option defaults to `en`. Choose **Statusline language (save with display settings)** in either editor; options always use **English / 简体中文**. Preview uses the draft language immediately. Save persists it with other display settings; Cancel discards it. Actual output changes on the next refresh, without restarting Claude.

```text
claude-statusline config set statusline-language zh-CN
claude-statusline config set statusline-language en
claude-statusline config show --json
```

This applies to the main line and all custom subagent rows. Translate built-in phrases and known lifecycle/permission/effort/cache/review values; preserve unknown values, user labels/icons, model names, paths, branches and task/tool names. Keep numbers, currency, `K/M`, `d/h/m/s`, `tok/s`, Git, PR and other technical units. A null label inherits a localized default; an empty label suppresses it; custom labels take precedence.

`statusline_language` lives in display schema v6 and participates in revisions, previews and portable exports. Historical v1–v5 reads/imports default to English without rewriting files; explicit saves back up and migrate. Presets preserve the language, new imports use the file's language, and display reset restores English. `config apply --statusline-language en|zh-CN` is optional; omission preserves the current value. Interface preferences and runtime observations remain independent.

Before downgrading to a package that supports only schema v5, use the newer package to remove its native integration, preserve a portable export, and restore a compatible `.before` display backup according to `metadata.json`. If the previous file was absent, restore absence. Then install the older package and refresh integration; do not pass a v6 draft to an older backend. See [backups](#backups-and-rollback).

## Native configuration editor

`/statusline-configure-native` opens Client inside the current Claude Code session without another terminal. It shares configuration, directory, catalog, exclusion rules and atomic saves with external `/statusline-configure`, while each editor keeps its draft. Stable defaults both entries on; restart Claude Code in a trusted terminal after installation.

The editor follows Claude’s applied theme, including light/dark variants, color-blind themes and host-supported auto/custom themes. In Settings, set **Preview background (UI only)** to `light` or `dark` to match your terminal’s background type; this choice is independent of the Claude theme and is remembered immediately, even when you discard configuration edits. It defaults to the previous dark surface. The presets are `#ffffff` and `#17191e`; the editor does not query the terminal’s exact RGB background. Uncolored text uses the terminal foreground. The title shows the selected background and Palette or Colors: off. Compare `default` and `ansi` if a color is hard to read: production RGB colors and terminal ANSI slots are preserved, and saving applies only the selected display configuration to the actual status line. Theme edits in Claude preferences still use the separate Apply action.

### Page hierarchy and pagination

The theme-accent **Configure Status Line** heading matches the Content and Preview titles. Larger panes place section titles on the frame; smaller panes use compact headings. Active tabs, group headings and selected fields have distinct styles. Shortcut keys use the current theme’s primary text color and bold weight; action descriptions are lowercase, use the theme’s inactive color and regular weight. Keys are judged by readability, not a fixed color. Letter shortcuts display uppercase and accept either case outside input editing.

Page shortcuts appear in the footer, following the separate save/finish/close/preview group. Every page starts with `Tab page`:

| Page | Footer order |
| --- | --- |
| Main / Subagents | `Tab page · Space toggle · ↑↓ select · ←→ order · Ctrl+E format · / search` |
| Settings | `Tab page · ↑↓ select · ←→ adjust · Enter edit · H show/hide preferences · A apply separately · R reload` |
| Layout | `Tab page · ↑↓ select · ←→ adjust · Enter edit` |
| Item format | `Tab page · ↑↓ select · ←→ adjust · Enter edit · Ctrl+G back` |

Settings offers H outside editing and A only while Claude preferences are expanded. `/ search` remains beside Filter and also appears in the footer on idle item pages. Editing replaces ordinary shortcuts with accept/cancel/clear/delete; Esc remains a host focus action. Busy operations and unknown saves show their applicable controls. Complete hints wrap without splitting a key from its description. At 32×12, compact descriptions and fewer detail rows preserve selection, basic controls and a sample preview; secondary preview/reload/focus hints may be omitted.

Settings, Layout and item-format details fill each page using the actual field and group-heading rows. Arrow keys select fields only. PageUp/PageDown move between pages while retaining the field offset where possible; Home/End select the first/last field. Resizing recomputes pages and retains the draft, selected field and input buffer. Layout groups mode, row boundaries and item fitting consecutively.

### Editor installation combinations and compatibility

Without recorded preferences, `claude-statusline install` defaults both entries on. Choose an explicit combination:

| Combination | Command |
| --- | --- |
| Both entries | `claude-statusline install --native-editor --experimental-slash-tui` |
| In-session Client only | `claude-statusline install --native-editor --no-experimental-slash-tui` |
| External TUI only | `claude-statusline install --no-native-editor --experimental-slash-tui` |
| Basic integration without either TUI entry | `claude-statusline install --no-native-editor --no-experimental-slash-tui` |

On Windows use `claude-statusline.exe`. The two flag pairs are independent; the historical `--experimental-slash-tui` name remains. Explicit flags override recorded preferences, which override defaults. Plugins explicitly disabled through the host remain disabled.

| Claude Code version | External `/statusline-configure` | In-session `/statusline-configure-native` |
| --- | --- | --- |
| 2.1.287+ | Default on | Default on |
| 2.1.258–2.1.286 | Default on | Suspended |
| Older or unrecognized | Suspended | Suspended |

Defaults apply only to entries without recorded disablement. Unsupported entries do not block basic integration or the other entry; explicit enabling also retains the preference and suspends the affected entry. Rerun `install` and `doctor` after host upgrades/downgrades. Support restores the entry according to preference; only tool-recorded suspension is automatically reenabled. Meanwhile use `claude-statusline configure`, `claude-statusline config ...` or the `/statusline-config` wizard, which uses model turns.

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

### macOS mouse reporting and Client focus

On 2026-10-04 the maintainer supplied screenshots showing Claude Code 2.1.289 and reported normal in-session Client interaction on Linux and Windows. On macOS the pane opens but interaction does not work correctly; a working mouse configuration has not been verified. This feedback concerns `/statusline-configure-native`. The main status line and standalone configuration entries remain available. See the [screenshots](images/archive/README.md#in-session-client-screenshots) and [acceptance record](development/native.md#claude-code-21289-interaction-report).

For Terminal.app, try these checks:

1. In the Terminal window running Claude Code, choose **View → Allow Mouse Reporting** and confirm the menu item is checked. Apple documents this option as selected by default in new windows, so inspect its actual state. See [Apple's mouse reporting guide](https://support.apple.com/guide/terminal/turn-on-mouse-reporting-trmlc69728a5/mac).
2. Run `/statusline-configure-native`, then click inside the **Client content region** once. Check that Tab changes pages, the arrow keys move selection and Space toggles an item. If keys still go to the conversation input, Client focus has not been established. Use `Q` to discard test edits once Client input works.
3. If interaction still fails, record the macOS version, terminal name/version, output of `claude --version`, whether tmux or SSH is involved, and which clicks/keys fail. Run `claude-statusline doctor` to check integration and backend binding. These diagnostics do not verify mouse delivery or Client focus. Use `claude-statusline configure` in a standalone terminal, or `claude-statusline config ...`, while troubleshooting the session entry.

**These are suggested checks, not a verified fix for the reported macOS environment.** Apple explains that Allow Mouse Reporting permits events to reach an application; the application must also enable mouse reporting. The menu setting alone does not activate that behavior or guarantee Client focus. Apple also lists Command+R as a [toggle for this setting](https://support.apple.com/guide/terminal/keyboard-shortcuts-trmlshtcts/mac); check the menu state after using it.

If using **iTerm2**, check **Settings → Profiles → Terminal → Enable mouse reporting** and **Report mouse clicks & drags**. The latter must permit clicks to reach applications for a click-based focus check. Holding Option temporarily bypasses mouse reporting, so test with a plain click. See [iTerm2's official terminal profile documentation](https://iterm2.com/documentation-preferences-profiles-terminal.html). These iTerm2 checks have not been validated against the maintainer's reported problem.

### Saving, conflicts and recovery

Both editors may remain open. The first save wins; an older revision is rejected without overwriting newer configuration. Client retains conflicting drafts; `R` explicitly discards and reloads before editing again. Saving or an unknown result blocks ordinary closure. Use `K` to check saved state before retrying or closing. Retry/Close buttons outside Client recover failures while retaining the host's received draft.

Advanced Claude preferences have separate Apply; Save/Finish does not implicitly apply them. Closing returns to the original session. See [native development and acceptance](development/native.md).

## Standalone interactive TUI

In a real terminal outside Claude Code, run:

```text
claude-statusline configure
```

Windows uses `claude-statusline.exe configure`. Both stdin and stdout must be TTYs, curses must initialize, configuration must be valid, and the current CLI must own the installed status line. The minimum size is 64×18; a smaller window waits for resizing and still permits cancellation.

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
| Esc | Cancel current input first; otherwise discard and close |
| Ctrl+C | Restore the terminal, exit 130, and discard |

Each page retains its draft, selection, search, and scroll during page changes and resize. Filtering preserves hidden items' relative order. A save checks the current revision before writing; unchanged settings create no backup.

<a id="external-tui-sections"></a>

### External TUI sections and page hierarchy

Content and `Preview (sample data)` are separate regions: frames at 64×20 and above, compact separators at 64×18–19. Main/Subagents show `ON`, `ITEM`, `DESCRIPTION`; settings and forms show `OPTION`, `VALUE`.

Settings groups appearance, refresh/behavior, Git metrics, formatting, risk colors, subagent visibility, and presets/portable files. Layout groups mode, row boundaries, and item fitting. Group titles are not selectable. The fixed-sample preview uses production rendering and does not inspect live Git or transcripts. [Current page screenshots](images/README.md#current-images).

### External terminal colors

The external editor uses the terminal's default foreground and background. Headings and shortcut keys are bold; descriptions use regular text. Active tabs and selected rows reverse the default colors and retain their selection markers. This follows light/dark terminal profiles independently of Claude's applied theme.

Sample previews use the current terminal background and the selected `Palette`, shown in the preview title. Uncolored text, resets, empty rows and trailing spaces use terminal defaults. Curses quantizes RGB samples to the available terminal palette; ANSI samples use the terminal’s configured ANSI colors. If `Palette: default` looks faint on a light terminal, compare `Palette: ansi` in Settings; changes preview immediately and affect the actual status line after saving. Preview colors are preserved so the comparison reflects the terminal’s real appearance. Unsupported default colors, monochrome terminals and failed/exhausted sample pairs fall back to default text.


## External terminal `/statusline-configure`

Run `/statusline-configure` without arguments inside Claude Code. This entry requires 2.1.258+ and opens the same curses TUI in tmux popup, GNOME Terminal, Terminal.app, or a Windows new console according to platform.

The external entry and in-session Client have independent preferences. Enable or disable just the external entry with:

```text
claude-statusline install --experimental-slash-tui
claude-statusline install --no-experimental-slash-tui
```

These are alternative commands. Omitting both flags preserves the saved preference; a missing preference defaults on. Restart Claude Code after integration changes.

Save, cancellation, and errors return a short result to the original conversation. The launched TUI cancels without saving after 570 seconds; standalone `configure` has no automatic timeout. `help`, `-h`, and `--help` return usage; other arguments are rejected. If launchers are unavailable, use standalone `configure` or the wizard. [Launcher implementation](development/README.md#external-launchers-and-result-bridging).

## `/statusline-config` wizard

Run `/statusline-config` without arguments to answer questions about main/subagent items and display options. The wizard uses Claude model turns, preserves the relative order of retained items, appends newly enabled items, and submits one atomic `config apply` after all questions are complete. Cancelling midway does not save settings.

Supported argument-based operations are `show`, `list-items`, `set-items`, `enable`, `disable`, `order`, `subagents`, `set`, `apply`, and `reset`:

```text
/statusline-config set-items model-with-effort current-dir git context-remaining task-timer
/statusline-config show
```

On 2.1.258+ the local hook handles these operations without a model turn, when hooks are enabled. Older/unknown hosts use the skill in a model turn. Advanced `preset`, `import`, `export`, `item`, and `layout` commands require the terminal CLI or editor. See [slash execution](reference/cli.md#slash-command-support).

Use this tool's configuration commands; Claude's built-in `/statusline` may replace `statusLine.command` with a different implementation.

<a id="常用配置配方"></a>

## Configuration recipes

<a id="精简开发视图"></a>

### Minimal development view

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

<a id="formatting-layout-presets"></a>

<a id="formatting-layouts-and-presets-v150"></a>

## Formatting, layouts and presets

Defaults retain the existing appearance. Use global Settings choices for consistent formatting and Ctrl+E item forms for specific overrides; inspect Preview before saving.

Settings covers model names, numbers, labels, icons, allowance balance/utilization, reset-time styles, and risk colors. All accepted values and defaults are in the [display option reference](reference/cli.md#display-and-host-options).

Warning defaults to 70, critical to 90; thresholds default off. Set warning-threshold and critical-threshold with warning below critical.

```bash
claude-statusline config set model-name short
claude-statusline config set number-format grouped
claude-statusline config set threshold-colors on
```

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

| Preset | Intended use |
| --- | --- |
| minimal | A compact everyday view with model, directory, context and task time. |
| developer | Repository work with Git, cumulative tokens, task time and session cost. |
| monitoring | Inspect quota/reset windows, cache state and session accounting; optional source fields may remain unavailable. |
| multi-agent | Multi-agent work with bounded agent rows and task labels; hide completed rows while retaining failures. |

Presets change display drafts, not collector enablement. They preserve output/interface language and host settings, rebuild item overrides, and remain editable before saving.


Presets minimal/developer/monitoring/multi-agent expand to editable drafts. They use short models and compact numbers, preserve colors/palette/directory style and refresh options, and rebuild item overrides with descending priorities in preset order. `--dry-run` prints a validated draft without saving. Imports accept portable envelopes or compatible display-only files; display-only files retain current refresh options.

```bash
claude-statusline config preset developer --dry-run
claude-statusline config preset developer
claude-statusline config export ./statusline.json
claude-statusline config import ./statusline.json --dry-run
claude-statusline config import ./statusline.json
```

Portable files share display settings and tool-managed padding/refresh/Vim options, excluding installation, runtime state, integration preferences, and Claude appearance/behavior preferences. Export to a separate file, validate an import with `--dry-run`, then import it. Existing export files are refused unless CLI `--overwrite` is explicit. [Transfer formats, validation, and protected destinations](reference/cli.md#portable-import-export).

### Editing formats and layouts in either editor

On Main/Subagents select an item and press Ctrl+E. Edit its label, icon, priority, maximum width and inherited format choices; Ctrl+G returns to the item list. Enter opens or accepts text/integer input. `inherit` clears an override, an empty label/icon suppresses it, and `none` clears an optional width/limit. Unicode/ASCII icon modes use built-in characters and need no special font.

Layout chooses auto/explicit and sets “New row before” boundaries for enabled main items. Larger priorities are retained first (default 50); maximum widths count terminal columns, including CJK and combining text. Editing the item order keeps the row partition valid. Scope decoration yields to real items when an explicit row is too narrow. Explicit layout removes empty rows and never adds continuation lines; auto keeps wrapping.

Settings contains global format choices, risk thresholds, subagent visibility and portable operations. Choose a Preset, then activate Expand selected preset. Import accepts a path and opens a differences review. Enter expands a section; A accepts the complete candidate into the draft, then Save persists it. Ctrl+G or Q cancels the native review; Esc or Ctrl+G cancels the external review. Export writes the current draft, including unsaved edits, to a new file; it does not save settings. Relative paths resolve in the host/terminal working directory and `~` expands to the home directory. Errors retain the current draft. Existing export files are refused in both editors; choose a new path or use CLI `--overwrite` for a deliberate replacement.

Client uses `S` to Save/continue, `F` to Save/finish and `Q` to discard. In curses, Ctrl+S saves the editable draft outside read-only guidance/review; legacy Enter still saves from the item pages and the original settings, while Enter on a new field edits/accepts that field. In the new forms Ctrl+U clears input and Ctrl+G cancels it. Legacy padding/refresh numeric editing keeps Backspace deletion and Esc restoration; Esc outside editing discards the curses editor. During field/path editing ordinary characters, including s/f/q, remain input.

| Preset | Main layout | Subagent defaults |
| --- | --- | --- |
| minimal | Auto: model/effort, directory, context remaining, task timer | Existing five items |
| developer | Two rows: model/directory/Git; context remaining/tokens/timer/session cost | Existing five items |
| monitoring | Three rows: context/three allowances; two resets/cache state/TTL; session cost/duration/API duration/requests/cache misses | Existing five items |
| multi-agent | Two rows: model/directory/Git; context remaining/tokens/timer | Existing five items, hide completed, up to six host rows, task width 48 |

Risk colors default off, with warning 70% and critical 90%. Colors use actual utilization even when an allowance displays remaining balance. Missing observations stay unavailable, zero remains zero, and expired allowance/reset data is suppressed. Preset fields become normal editable configuration; colors, palette, directory/separator style, refresh and current subagent enablement are retained.

### Claude preferences apply separately

In Client Settings press `H` (Claude preferences) to show or hide Claude appearance, time/title and behavior groups. Theme, verbose, turn duration, reduced motion, tips, progress and notification controls use the current host's actual rows. Available time/title rows are included; missing rows show official guidance. Model, reasoning effort, thinking and fast mode change Claude behavior and have their own group. They are independent of similarly named status-line display switches.

Edit the offered row type/choices and press `A` to Apply. Each row reports its result, including host refusal, locks, external changes and partial success. Tool Save/Finish and portable files do not apply these preferences. Reload explicitly discards pending edits; click the restored Client region before continuing with the keyboard. The host may expose a different type or omit a row; use the indicated official entry such as `/config`, `/model`, `/effort` or `/fast` in that case. The standalone editor manages tool configuration and has no Claude host API.

<a id="phase-5-preview-installation"></a>
<a id="phase-5-stable-installation"></a>

## Opt-in live state

Collection and display selection are separate steps. Enable the independent collector, then select the fields you want:

```text
claude-statusline install --live-metrics
claude-statusline config enable run-state permission-mode active-agents task-progress last-tool
claude-statusline doctor
```

Restart Claude Code to load collection. Additional collected items are `ttft`, `output-rate`, `prompt-input-tokens`, `prompt-output-tokens`, and `prompt-cost`. Use either editor or `config enable` to select them. They are all off in the default item selection; live collection requires Claude Code 2.1.289+ and does not turn on with an editor alone.

`claude-statusline install --no-live-metrics` preserves the legacy choice to disable both timing and advanced collection. Add `--native-timing` to retain timing metadata. Ordinary reinstall preserves saved choices. Missing live observations show `—`; limited coverage or recent observations can carry `*`. [Metric definitions](DISPLAY_ITEMS.md#live-state-items) explain per-field collection and request coverage; [runtime diagnostics](development/live.md) cover collection problems.

`branch-diff` is a separate default-off item backed by local Git and works without the native collector. Select it with `claude-statusline config enable branch-diff`, and configure committed branch comparison with `claude-statusline config set branch-diff-base auto` or a safe local Git ref. It excludes uncommitted worktree edits and does not fetch remotes. [Branch and ended-agent definitions](DISPLAY_ITEMS.md#branch-base-and-ended-agents).

## Configurable display items

Use the catalog to inspect supported IDs and current enablement:

```text
claude-statusline config list-items
claude-statusline config subagents list-items
```

The main catalog contains 60 items, ten enabled by default: `model-with-effort`, `current-dir`, `git`, `context-remaining`, `context-window-size`, `five-hour-limit`, `weekly-limit`, `spend-limit`, `tokens`, and `task-timer`.

Common optional items are grouped below; enable them by ID or select them in an editor.

| Group | Optional IDs |
| --- | --- |
| Identity and session | `project-name`, `hostname`, `version`, `session`, `agent` |
| Modes | `fast-mode`, `thinking`, `vim-mode` |
| Repository | `pr`, `repo`, `worktree` |
| Context and usage | `context-used`, `cost`, `prompt-cache` |

The subagent catalog contains 14 items, five enabled by default: `status-elapsed`, `name`, `model-with-effort`, `context-remaining`, and `task`. Composite `status-elapsed` excludes separate `status`/`elapsed`. See [field reference](reference/cli.md#configurable-display-items) and [metric definitions](DISPLAY_ITEMS.md) for the full catalog and unavailable-data behavior.

## Main status line fields

Git uses `↑N`/`↓N` for upstream divergence, `● N` (Linux/macOS) or `●N` (Windows/WSL) for staged files, `~N` for unstaged, `!N` for conflicts, and `?N` for untracked. `Git!` reports a failed Git query; non-Git directories omit the field.

Tokens show session totals: `hit` is cache-read input, `miss` is ordinary input plus cache creation, and `out` is output. This includes discoverable subagent transcripts and is separate from context occupancy or rate limits.

### Task total and execution time

`task-timer` measures the latest human task from its earliest trusted submission, including queueing, user waits, owned subagents and main-agent wrap-up. It is enabled by default. `prompt-timer` remains a compatibility alias accepted by configuration commands and imports; saved configuration uses `task-timer`.

The timer shows `⏱` while running, `✓` on success, `■` on interruption, `✗` on failure, and `? <elapsed>+` when an ending is unconfirmed. With agents it can show `⏳ 2 agents · <elapsed>` or `⏳ main wrap-up · <elapsed>`. A classic `Stop` is an ending candidate; verified continuation retains the same task and clock. Completion requires reliable ending evidence, resolved owned agents and required reports, and finished main-agent wrap-up. Accepted terminal values freeze. [Detailed markers and timing scope](reference/cli.md#prompt-timer-markers).

`task-active-timer` is optional and unselected by default. It measures execution after work starts, excluding verified user waits; concurrent work is not counted twice. It requires native timing on Claude Code 2.1.289+ and complete task/wait observations. Enable it with:

```text
claude-statusline install --native-timing
claude-statusline config enable task-active-timer
claude-statusline doctor
```

Restart Claude Code after changing collector integration. Compatible fresh installs already default to native timing on; explicit saved disablement remains respected. Advanced live metrics are independent and need not be enabled for this timer. Missing observations, incomplete wait coverage, stale state or an untrusted clock hide execution time rather than assuming zero waiting. Native single-turn duration, session runtime and cumulative API duration are separate quantities and do not calibrate either task clock. See the [timing contract](development/timer.md).

## Subagent rows and the three scopes

```text
⏱ 1m 18s · Explore · sonnet-5/high · Context 58% left · searching auth flow
```

- The global bottom line describes the main/session scope; `Main/Session` can label it after a task has launched agents.
- Main `tokens` aggregates the session, including discoverable agent usage.
- Each agent row describes its own task; its `tokens` field is context occupancy, not cumulative API usage.

Viewing an agent transcript does not change the global line's scope: Claude Code does not supply a focused-agent identifier. Completed agent elapsed values freeze when an end can be established. [Row fields and width rules](reference/cli.md#subagent-rows-and-the-three-scopes).

## Display and host options

Use Settings or `config set OPTION VALUE` for appearance, directory styles, separators, scope labels, refresh, and subagent visibility. Host options `padding`, `refresh-interval`, and `hide-vim-mode-indicator` require installation ownership. Full values and defaults are in the [option reference](reference/cli.md#display-and-host-options).

`refresh-interval event` refreshes only on Claude events; a running timer will not change each second. Restore continuous updates with `claude-statusline config set refresh-interval 1`.

## Configuration files

| File in `<CLAUDE_CONFIG_DIR>` | Purpose |
| --- | --- |
| `claude-statusline.json` | Display settings, item order, formats, layouts, subagent visibility |
| `claude-statusline-features.json` | Independent external-editor preference |
| `claude-statusline-native.json` | Independent in-session Client preference |
| `claude-statusline-runtime.json` | Independent native timing and advanced collection preferences |
| `settings.json` | Owned Claude commands, hooks, and host status-line settings |

Use the CLI or editors to update these files. Display schema v6 reads supported old schemas without writing; an actual save backs up and migrates them. Strict JSON rejects unknown fields, duplicate keys, invalid values, and unsupported versions. [File formats](reference/cli.md#configuration-files).

## Custom configuration directory and environment variables

For management commands use `--config-dir`; with `config`, put it before the action:

```text
claude-statusline config --config-dir /path/to/claude-config show
claude-statusline configure --config-dir /path/to/claude-config
```

The explicit directory takes precedence over `CLAUDE_CONFIG_DIR`, then the default `~/.claude`. Use the same directory when starting Claude Code and managing the integration. [Environment variables and shell examples](reference/cli.md#custom-configuration-directory-and-environment-variables).

## Upgrading

### Migrate the previous distribution name

Versions through 1.7.3 used the distribution name `claude-code-statusline` for this repository’s Release wheels. That name on PyPI belongs to another project. Check `pipx list --json` and `claude-statusline --version` to confirm the existing installation came from this repository before removing it. Use the new name for index installations and future upgrades.

Close Claude Code during migration. Remove the old pipx environment, install the new distribution and refresh integration:

```text
pipx uninstall claude-code-statusline
pipx install fbincon-claude-code-statusline
claude-statusline install --dry-run
claude-statusline install
claude-statusline doctor
```

The pipx package removal preserves Claude display configuration, integration preferences, runtime state and backups. Reinstallation updates command paths and Mod backend bindings; restart Claude Code afterward. The configuration ownership marker and portable export format remain unchanged. Confirm `claude-statusline --version` reports 1.11.0 and `pipx list` contains only the new distribution for this tool. If migration cannot finish, reinstall the verified original wheel from this repository and rerun `install` and `doctor`.

### Replace the Python package

```text
pipx upgrade fbincon-claude-code-statusline
```

For local wheels or source installations, use `pipx install --force` with the original file, fixed-tag Git URL, or local checkout after updating/building it.

### Synchronize Claude Code integration

```text
claude-statusline --version
claude-statusline install
claude-statusline doctor
claude-statusline config show
```

Restart Claude Code. Installation synchronizes command paths, skill templates, hooks, plugins, and compatibility. Display settings, independent preferences, caches, and task state remain. Historical external disablement could remove the preference file; if the preference is missing, use `--no-experimental-slash-tui` to explicitly keep that entry off.

### Version compatibility

Current display schema v6, configuration protocol v6, and independent runtime protocol v2 require matching resources and backend. Supported display v1/v2/v3/v4/v5 files are read without rewriting; an actual save backs up the old bytes and migrates to v6. Unsupported newer schemas or invalid content are rejected. Older packages cannot necessarily understand newer schemas or item IDs.

Before downgrading, use the newer package to disable/remove integrations that the older package cannot manage, including live collection and the native editor as applicable. Restore a compatible display backup using its `metadata.json`, or remove unsupported item IDs where schema compatibility permits. Then install the old package, run `install` and `doctor`, and restart Claude Code. A portable export can separately retain current display choices for later reuse.

Crossing a Claude host-version requirement independently suspends or restores the corresponding integration according to saved preferences. Explicit disablement and user-disabled plugins remain disabled. [Historical changes](../CHANGELOG.md).

## Uninstalling

Remove integration while the CLI is still installed:

```text
claude-statusline uninstall --dry-run
claude-statusline uninstall
pipx uninstall fbincon-claude-code-statusline
```

Windows uses `claude-statusline.exe`. The uninstaller removes only owned commands, hooks, skills, plugins, and resources; third-party settings remain. Display files, editor/live preferences, caches, task state, and backups remain for reuse. Keep integrations disabled across a later reinstall by explicitly saving the corresponding `install --no-...` preferences first.

## Backups and rollback

Actual installation, removal, and configuration changes create backups in:

```text
<CLAUDE_CONFIG_DIR>/backups/statusline/cli-<action>-<timestamp>/
```

`metadata.json` records action, time, original absolute paths, and whether each file existed. A `.before` file holds the original bytes; `.absent` means the target previously did not exist. Before manual rollback, exit the affected Claude sessions and editors. Restore `.before` to its recorded target; restore an `absent` target to absence. A failed transaction attempts rollback and retains the backup.

## `doctor` diagnostics

```text
claude-statusline doctor
```

Doctor checks platform/Python, PATH, configuration validity, command ownership, hooks, editor preferences/resources, host compatibility, launch prerequisites, runtime collection, and writable state. It does not rewrite configuration or open editor windows; macOS may check parent-directory synchronization capability. Passing diagnostics does not independently verify GUI focus or human interaction.

`[OK]` passes; `[WARN]` describes degradation and still allows exit 0; any `[ERROR]` makes exit 1. For stale integration, run `install`, rerun `doctor`, then restart Claude Code. Resolve ownership conflicts before using `--force`.

For an existing display configuration file, the schema check reports the supported version, currently `[OK] display config schema: v6`. A valid older file instead reports, for example:

```text
[WARN] display config schema v4 is valid and will migrate to v6 on the next configuration save
```

This warning does not migrate the file: diagnosis and reads preserve its bytes; an actual configuration save backs up and migrates it. The display schema is independent of configuration protocol v6 and runtime protocol v2.

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

### `/statusline-configure-native` is missing, ignores keys or cannot save

1. Run `claude-statusline doctor` to check host 2.1.287+, resources and backend binding. Suspension on an older host is compatibility handling.
2. Check recorded disablement, host plugin disablement, safe/bare mode and policy. If needed, run `install --native-editor` and restart Claude Code in a trusted terminal.
3. Click the Client region once before keyboard use. On macOS, follow [mouse reporting and Client focus checks](#macos-mouse-reporting-and-client-focus); the latest reported macOS configuration remains unverified. Ctrl+G cancels input; Esc remains host-owned.
4. Conflicts retain the draft; `R` explicitly discards/reloads. Use `K` to check unknown save outcomes and Retry/Close for failures. Reinstall the matching wheel/integration for version or resource mismatch; do not adopt foreign caches manually.

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

Automatic layout wraps to fit the terminal; explicit layout truncates to maximum widths and hides lower-priority items without adding continuation rows. Increase width, use `compact` separators, choose a shorter directory style, or hide secondary items to reduce wrapping.

## Exit codes

Management commands use 0 for success, 1 for doctor errors, and 2 for handled argument/configuration/ownership errors. Some uncaught CLI errors also exit 1; see the [exit-code reference](reference/cli.md#exit-codes). TUI interruption uses 130 or `128 + signal`, with the terminal restored and the draft unsaved.

## Current limitations

- Settings are per user; project-specific overrides, drag-and-drop, and custom key bindings are not provided.
- The macOS in-session Client interaction issue remains recorded. Standalone TUI and CLI are available alternatives.
- Desktop external launchers support the listed platform terminals. Other terminals can use standalone `configure` or tmux; IDE, print mode, web sessions, and globally disabled hooks do not guarantee an external editor.
- Optional live fields require independent collection and valid observations; they do not infer missing measurements or focused-agent identity.
- Subagent rows expose current task fields rather than a historical ledger or per-agent Git/cache/session aggregation.
- Task completion requires confirmed ending evidence and resolved ordinary agent tasks/reports and main wrap-up. A classic Stop alone is a candidate; no timeout or expired heartbeat fabricates completion. Background shell/server/monitor/workflow and agent-team ledgers do not block completion.
- Status-line output colors use the configured project palette; in-session editor text and controls follow Claude's applied theme.

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
<a id="prompt-timing-markers"></a>
<a id="prompt-计时标记"></a>
<a id="token-fields"></a>
<a id="token-含义"></a>
<a id="主状态栏显示含义"></a>

[Main status line fields](reference/cli.md#main-status-line-fields)

<a id="子-agent-行与三种作用域"></a>

[Subagent rows and the three scopes](reference/cli.md#subagent-rows-and-the-three-scopes)

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

<a id="task-timing-preview"></a>

## Task timing

Task timing is included in [v1.7.0](https://github.com/fbincon/claude-code-statusline/releases/tag/v1.7.0). Upgrade the stable package:

```bash
pipx upgrade fbincon-claude-code-statusline
claude-statusline install
claude-statusline config enable task-active-timer
```

`task-timer` is the default total task clock; `prompt-timer` remains accepted by existing commands and old configuration files. `task-active-timer` is optional and only appears with complete native execution/wait evidence. A raw Stop shows a lower bound (`? ...+`) until an ending is confirmed; a verified continuation resumes the same task. Native turn duration never shortens total elapsed. Session and API durations remain separate.

On compatible hosts, fresh installations collect timing metadata by default; advanced metrics still require `install --live-metrics`. Use `install --no-native-timing` to disable native timing or `install --no-live-metrics` to preserve the previous all-off behavior. For timing-only mode explicitly use `install --no-live-metrics --native-timing`. Old explicit disabled preferences and disabled plugins remain disabled. The current host can leave execution time unavailable for approval, question or MCP waits; `doctor` explains coverage.

Before downgrading, run `claude-statusline install --no-native-timing --no-live-metrics`, remove the native editor if the old version cannot manage it, and restore the display/runtime preference backups from before migration. Reinstall the older package and integrations. Reading does not rewrite an old schema; an actual save uses schema 6 and retains a backup. Coverage limitations and validation evidence are recorded in the Release and [timer contracts](development/timer.md).

## Unicode text and terminal widths

Wrapping, truncation and editor previews keep extended grapheme clusters together, including combining accents and joined emoji. Ambiguous characters use one column; ordinary CJK and emoji clusters use two. The layout policy is fixed across Python versions and editors. Actual glyph appearance still depends on your terminal and fonts.

On ANSI/VT-capable terminals, the external editor paints complete text runs. Older backends use a width-preserving placeholder for clusters they cannot safely draw; saved labels, icons and paths remain intact. Backspace removes a complete text cluster. Palette changes still belong to the display draft; the native light/dark preview background remains an independent UI preference.
