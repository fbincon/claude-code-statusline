# CLI reference

**English** | [简体中文](cli.zh-CN.md)

Use this page for command syntax, options, display fields, configuration formats and current interface versions. Step-by-step workflows are in the [user guide](../USER_GUIDE.md) and [usage demonstrations](../SHOWCASE.md). Values below describe the current package; historical delivery records retain their original versions.

With no subcommand, an interactive invocation opens the reviewed [persistent-installation flow](../SETUP.md#first-entry-and-persistent-npm-installation). It accepts `--prefix`, `--config-dir` and `--dry-run`; ordinary non-TTY entry exits without mutation.

## Contents

- [CLI overview](#cli-overview)
- [Languages](#languages)
- [Installation and diagnostics](#installation-and-diagnostics)
- [Configuration command reference](#configuration-command-reference)
- [Profiles and projects](#profiles-and-projects)
- [Import, export and reuse](#import-export-and-reuse)
- [Source management](#source-management)
- [Diagnosis and task inspection](#diagnosis-and-task-inspection)
- [Appearance and display options](#appearance-and-display-options)
- [Display items and scopes](#display-items-and-scopes)
- [Configuration files](#configuration-files)
- [Protocol and schema versions](#protocol-and-schema-versions)
- [Custom configuration directory and environment variables](#custom-configuration-directory-and-environment-variables)
- [Exit codes](#exit-codes)

[Profiles and projects](../PROFILES.md) · [Complete schemes](../SCHEMES.md) · [Draft history and reuse](../DRAFT_HISTORY.md) · [Input diagnosis](../DIAGNOSTICS.md) · [Package management](../PACKAGE_MANAGEMENT.md)

<a id="cli-总览"></a>

## CLI overview

Brackets mark optional arguments; `A|B` means choose one alternative, and `...` means repetition. Uppercase words such as `PATH`, `ITEM`, `ID` and `LANGUAGE` are placeholders. Quote paths and text containing spaces; do not type the syntax markers literally.

```text
claude-statusline [--language LANGUAGE] COMMAND ...
claude-statusline [--language LANGUAGE] [--prefix PATH] [--config-dir PATH] [--dry-run]
claude-statusline --help
claude-statusline --version
```

In Windows PowerShell use `claude-statusline.cmd`; command arguments and output formats are the same. Root `--language` precedes the command. The no-subcommand form reviews persistent installation; ordinary non-TTY entry exits 2 without changing installation or configuration.

### Command index

| Commands | Reference | Purpose |
| --- | --- | --- |
| `setup / install / uninstall / configure` | [Installation and diagnostics](#installation-and-diagnostics) | Installation, integration and editor entry |
| `update / rollback / recover` | [Package management and recovery](#package-management-and-recovery) | Package review, replacement and three recovery forms |
| `config show / list-items / set-items / enable / disable / order / subagents / set / apply / preset / reset` | [Configuration command reference](#configuration-command-reference) | User-default display and host settings |
| `config instance / group / layout / alignment / item` | [Configuration command reference](#configuration-command-reference) | Instances, composition and scoped options |
| `config profile / project` | [Profiles and projects](#profiles-and-projects) | Named displays and project bindings |
| `config import / export` | [Import, export and reuse](#import-export-and-reuse) | Full/selective transfer, styles and groups |
| `source` | [Source management](#source-management) | Local source permissions, bindings and refreshes |
| `doctor / diagnose / task show / task view` | [Diagnosis and task inspection](#diagnosis-and-task-inspection) | Installation checks, input diagnosis and saved task evidence |
| `config language / --language` | [Languages](#languages) | Interface and display language choices |

Internal `render`, `render-subagents`, `hook`, `slash-hook`, `ui` and `runtime` interfaces are documented in the [internal commands appendix](../development/README.md#appendix-internal-commands).

### Directory selection and help

An explicit `--config-dir PATH` selects storage before `CLAUDE_CONFIG_DIR`, then `~/.claude`. Its placement depends on the command:

| Command family | Position of `--config-dir PATH` |
| --- | --- |
| `config`, `source` | Immediately after the command, before its action |
| `configure` | Immediately after the command, before target options |
| `setup`, `install`, `uninstall`, `doctor`, `update`, `rollback`, `recover`, `diagnose`, `task show/view` | Among that command's options |

```text
claude-statusline config --config-dir "/path/to/claude config" show
claude-statusline source --config-dir "/path/to/claude config" list
claude-statusline configure --config-dir "/path/to/claude config" --user
```

`--help` is accepted at command paths such as `config set --help`, but the current implementation returns the shared `config` overview, not action-specific parameter help. Use the sections below for complete syntax.

### Targets, prerequisites and effects

| Operations | Target and prerequisites |
| --- | --- |
| `config show / list-items` | Read the user default and installation identity, not the project-selected Profile; `--json` is available. |
| `config set-items / enable / disable / order / item / instance / group / layout / alignment / set` | Edit the user default. Display edits need no owned main installation; host fields require ownership. Project bindings can also coordinate owned subagent integration, protecting foreign renderers. |
| `config apply / preset / import` | Full application includes host settings and requires owned installation. Supported `--dry-run` forms preview without saving. |
| `configure` | Requires an interactive terminal, valid configuration and owned installation. Defaults to the working directory's resolved Profile; `--user`, `--profile` or `--project` selects the target. |
| `config import --select / --style-from / --groups` | Defaults to the user target; supports explicit user/Profile/project targets. Target writes use the existing ownership and revision rules. |
| `source` | Registration, enablement, binding, manual refresh and automatic policy are separate effects. Display saves/imports cannot grant source execution permissions. |
| `diagnose / task show` | Noninteractive reports use supplied input or existing saved evidence; they do not start collection. Missing evidence can be a successful unavailable report. |

A command that does not save display settings is not a promise of zero filesystem activity: some reads use locks, package dry-runs use temporary staging/npm caches, and enabled JSON sources can publish observation caches. See each command's boundary. Successful operations normally exit 0; handled argument/configuration errors exit 2. Doctor/setup and signals have [specific exit codes](#exit-codes).

## Languages

### Interface language

The compatibility alias `zh-Hant` resolves to `zh-TW` in every language argument and old configuration. Reads do not rewrite files; explicit saves/exports use canonical codes. Regional choices are `zh-TW` (Taiwan) and `zh-HK` (Hong Kong).

`config language show [--json]` reads the shared preference; JSON is `{"schema_version":1,"ui_language":"en"}`, with `ui_language` set to a supported code. `set en|zh-CN|zh-TW|zh-HK|ja|ko|es|fr|de|pt-BR|ru|id` and `reset` save explicitly; reset selects English. The root `--language en|zh-CN|zh-TW|zh-HK|ja|ko|es|fr|de|pt-BR|ru|id` option goes before the command and takes precedence for that invocation without changing storage. With `configure` it controls the initial editor language.

Help text/groups, argument errors and administrative output use the selected language. Command names, argument values, exit codes, catalog JSON remain stable; actual output uses the separate display language. `/statusline-config language show|set|reset` also executes locally on supported hosts. See [language behavior and recovery](../USER_GUIDE.md#interface-language).

### Statusline language

`config set statusline-language en|zh-CN|zh-TW|zh-HK|ja|ko|es|fr|de|pt-BR|ru|id` persists the display language. `config apply --statusline-language en|zh-CN|zh-TW|zh-HK|ja|ko|es|fr|de|pt-BR|ru|id` saves it atomically with other answers, preserving the current value when omitted. Both editors preview draft changes immediately; Save/Cancel governs output language. `config language` and root `--language` control interfaces only.

The current display schema includes required `statusline_language`; current versions and read ranges are in [protocol and schema versions](#protocol-and-schema-versions). Historical v1–v5 reads/imports default to English; presets retain it, export includes it, reset selects English. The legacy wizard reads the current UI preference and maps localized answers to stable codes before one apply. See [usage and downgrade recovery](../USER_GUIDE.md#statusline-language).

## Installation and diagnostics

```text
claude-statusline setup [--config-dir PATH] [--dry-run]
claude-statusline install [--config-dir PATH] [--dry-run] [--force]
  [--native-editor | --no-native-editor]
  [--experimental-slash-tui | --no-experimental-slash-tui]
  [--native-timing | --no-native-timing] [--live-metrics | --no-live-metrics]
claude-statusline uninstall [--config-dir PATH] [--dry-run]
claude-statusline configure [--config-dir PATH] [--user | --profile NAME_OR_ID | --project PATH]
```

After installing the npm package, use `setup` to preview a display and review Claude Code integration in a guided flow. Use `install` to configure that integration directly. [First-use setup](#first-use-setup-and-complete-schemes).

| Command | Behavior |
| --- | --- |
| `install` | Merge owned integration into Claude settings; back up actual changes |
| `install --dry-run` | Report planned changes without installing resources or writing files |
| `install --force` | Permit replacement of conflicting main/subagent settings or same-name skills; native plugin identity conflicts still require resolving ownership |
| `uninstall [--dry-run]` | Remove or preview removal of owned integration; retain display settings, preferences, state, and backups |
| `doctor` | Diagnose installation without rewriting settings or opening an editor |
| `configure` | Open the Node terminal editor in the current terminal; requires valid settings, installation ownership, TTY input/output, and at least 64×18 |

All commands accept `--config-dir PATH` after the command name. The four independent `install` preference pairs are:

- `--native-editor` / `--no-native-editor`: in-session Client, Claude Code 2.1.287+.
- `--experimental-slash-tui` / `--no-experimental-slash-tui`: external entry, 2.1.258+.
- `--native-timing` / `--no-native-timing`: native timing metadata, 2.1.289+.
- `--live-metrics` / `--no-live-metrics`: advanced live collection, 2.1.289+.

Each pair is mutually exclusive. Explicit flags override saved values, which override defaults. Editors default on; native timing and advanced live metrics default off. `--no-live-metrics` retains the legacy choice to disable both timing and advanced collection; an explicit timing flag in the same command controls timing separately. Incompatible or unknown hosts suspend requested integration without discarding its preference. Host-disabled plugins remain disabled. Restart Claude Code after changing integration. See [installation](../USER_GUIDE.md#installation-and-integration), [backups](../USER_GUIDE.md#backups-and-rollback), and [uninstalling](../USER_GUIDE.md#uninstalling).

### First-use setup and complete schemes

`setup` connects checks, candidate preview and explicit display/integration commits. `--dry-run` is read-only and works without a TTY; normal non-TTY use exits 2. See [setup](../SETUP.md). Eight complete schemes define global appearance as well as layout; the six original presets preserve their existing global appearance behavior. See [scheme files and sharing](../SCHEMES.md).

### Slash-command support

The `/statusline-config` argument parser delegates to the shared configuration parser and supports these 19 top-level actions:

| Actions | Scope |
| --- | --- |
| `show`, `list-items`, `set-items`, `enable`, `disable`, `order` | Inspect or change user-default main items |
| `subagents` | `list-items`, `set-items`, `enable`, `disable`, `order` |
| `set`, `apply`, `item` | Display/host options, one combined save or scoped item options |
| `instance`, `group`, `alignment`, `layout` | Explicit composition, including supported structural dry-run/review flags |
| `preset`, `import`, `export` | Apply or transfer configuration with the same supported flags as the terminal action |
| `language`, `reset` | Interface-language preference or user-default configuration reset |

On Claude Code 2.1.258+ with hooks enabled, these execute locally. Older/unknown hosts or a disabled hook use the skill in a model turn. The no-argument wizard always uses model turns. Pass one action's literal arguments; shell operators and arbitrary terminal commands are not a supported execution interface. A leading `--config-dir` is a terminal option, not a slash action.

`config profile` and `config project` management remain terminal CLI/editor operations. Ordinary slash display changes and the wizard edit the user default; a project binding can still select a named profile instead. `/statusline-configure` accepts no configuration arguments; `help`, `-h`, and `--help` show usage. [Choosing an entry point](../USER_GUIDE.md#choose-a-configuration-entry-point).

### Package management and recovery

```text
claude-statusline update [--version EXACT | --channel latest|beta] [--check | --dry-run]
  [--prefix PATH] [--config-dir PATH] [--yes] [--json]
claude-statusline rollback [--version EXACT] [--prefix PATH] [--config-dir PATH]
  [--dry-run] [--yes] [--json]
claude-statusline recover [--config-dir PATH] [--dry-run]
claude-statusline recover --package [--version EXACT] [--prefix PATH] [--config-dir PATH]
  [--dry-run] [--yes] [--json]
claude-statusline recover --restore-config BACKUP_ID [--prefix PATH] [--config-dir PATH]
  [--dry-run] [--yes] [--json]
```

| Form | Purpose and restrictions |
| --- | --- |
| `update` | Defaults to the recorded channel or `latest`; exact versions cannot downgrade. `--check` reviews metadata only; `--dry-run` additionally stages and verifies the package. |
| `rollback` | Selects the previous successful artifact for this prefix/config directory when version is omitted; a specified version must be older. |
| `recover` | Recovers unfinished file/plugin transactions; takes no package/version/JSON options. Preview before applying. |
| `recover --package` | Reviews and resumes a retained package transaction, checking actual installed bytes and executor liveness. |
| `recover --restore-config` | Restores a selected package backup's display/Profile configuration separately; `BACKUP_ID` is the actual `pkg-` plus UUID identifier. Rejects `--version`; source execution permissions stay current. |

Package `--json` requires `--check` or `--dry-run`. Noninteractive package replacement requires exact `--version`, explicit `--prefix` and `--yes`; configuration restore instead requires `--prefix` and `--yes`, with its backup ID. Interactive writes present a review and require confirmation unless `--yes` is supplied. `--prefix` selects the persistent npm installation, independently of `--config-dir`.

<!-- docs-example: cli-recover -->
```text
claude-statusline recover --dry-run
```

This ordinary recovery preview reports retained transactions, or that none exist, without applying recovery. Package checks may use registry/network access and normal npm caches; dry-run does not change the target installation/configuration. [Full review and recovery workflows](../PACKAGE_MANAGEMENT.md).

<a id="配置命令详解"></a>

## Configuration command reference

The operations listed in [slash-command support](#slash-command-support) also accept `/statusline-config` in Claude Code; profile/project management uses the terminal CLI or editor. For example:

```bash
claude-statusline config set colors off
```

is equivalent to:

```text
/statusline-config set colors off
```

### `config show`

Shows the **effective user-default configuration**, not the Profile selected for a project: display configuration, Claude Code host configuration, file paths, whether the current executable owns `statusLine.command`, and the desired enabled state, installed state, and ownership of subagent rows.

```bash
claude-statusline config show
```

Example output for a customized five-item display with an English interface:

```text
Scope: user
Config: /home/user/.claude/claude-statusline.json
Installed: yes
Items: model-with-effort, current-dir, git, context-remaining, task-timer
Colors: on
Palette: default
Theme: classic
Powerline separator: ascii
Directory style: home
Separator style: classic
Scope labels: when-subagents
Statusline language: en
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

The top-level JSON `installed` indicates whether `settings.json/statusLine.command` is an owned render binding for the invoked backend entry, not merely whether the npm package exists. `subagent_statusline` separately contains `enabled`, `installed`, and `state`; `state` is one of `owned`, `absent`, `foreign`, or `unsupported`.

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
- `default_enabled`: ten main metrics are `true`; other catalog types are `false` (opt-in).
- `enabled`: whether at least one instance of this type is enabled.
- `position`: the zero-based position when exactly one instance of this type is enabled, otherwise `null`.

The shared catalog also returns `scope`, `label`, `group`, `sources`, `examples`, `default_position`, `minimum_version`, `minimum_version_status`, `format_options`, `excludes`, and `unavailable_reasons`. Version metadata identifies a capability, not evidence of received data. The subagent catalog has 15 metrics plus text and spacer types, with five metrics enabled by default.

### `config set-items [ITEM...]`

Replace the entire enabled set at once and save argument order as display order:

```bash
claude-statusline config set-items model-with-effort current-dir git task-timer
```

All items not listed become disabled. This is useful for defining a minimal status line from scratch.

For a type-based display, an empty item list clears the main selection.

```bash
claude-statusline config set-items
```

The integration, hooks and subagent selection remain in place. Use `config subagents set-items` to clear the subagent selection. Restore the main selection with `enable` or another `set-items`.

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
claude-statusline config enable tokens task-timer
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

<!-- docs-example: cli-order -->
```text
claude-statusline config set-items model-with-effort current-dir git task-timer
claude-statusline config order git current-dir model-with-effort task-timer
```

Arguments must contain every currently enabled item exactly once. Missing or extra items, currently disabled items, and duplicates all cause failure.

Inspect the current set before reordering:

```bash
claude-statusline config set-items model-with-effort current-dir git context-remaining task-timer
claude-statusline config show
claude-statusline config order model-with-effort git current-dir context-remaining task-timer
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

With no enabled subagent instances, `render-subagents` still emits valid NDJSON for every valid task ID, but with empty `content`, causing Claude Code to hide the custom row.

`status-elapsed` is mutually exclusive with `status` and `elapsed`. Invalid combinations in `set-items`/`enable`/`apply` fail directly: for example, `enable status-elapsed` fails on an old configuration with `status` enabled; run `disable status elapsed` first. The type-based wizard resolves mutually exclusive choices; the instance editors reject conflicting edits and preserve the draft.

### Instance management

`config instance main|subagent` supports `list [--json]`, `add TYPE_ID [--after ID] [--text TEXT]`, `copy ID`, `remove ID`, `enable ID`, `disable ID`, `move ID --before|--after ANCHOR`, and `set ID OPTION VALUE`. Add/copy return the new ID. `config layout --by-instance explicit ROW...` uses comma-separated instance IDs, including all configured disabled instances, in exactly the configured order.

Legacy item/enable/disable commands resolve a type only when unique. Legacy bulk selection/order/layout operations reject repeated types, text and spacers without choosing the first match or deleting instances. Type-catalog JSON adds `instance_ids`, `enabled_instance_ids`, and `instance_only`. See [composition](../COMPOSITION.md) for complete examples.

When a unique metric is toggled in an explicit layout or a composition, its position and spacer side are retained. Historical append-on-enable order applies to simple automatic type selections. Use `config instance ... enable|disable` to preserve positions consistently.

### Group operations

`config group main|subagent list|create|set|copy|move|ungroup` manages continuous instance groups. Create requires `ID --members ID,ID --primary ID`; optional `--linked on|off` and `--powerline on|off` select presentation. Move requires one of `--before ID` or `--after ID`. [Examples and invariants](../COMPOSITION.md#component-groups).

```text
claude-statusline config group main|subagent list [--json]
claude-statusline config group main|subagent create ID --members ID,ID --primary ID
  [--linked on|off] [--powerline on|off]
claude-statusline config group main|subagent set ID members|primary|linked|powerline VALUE
claude-statusline config group main|subagent copy ID
claude-statusline config group main|subagent move ID (--before ID | --after ID)
claude-statusline config group main|subagent ungroup ID
```

`members` uses comma-separated instance IDs, `primary` one member ID, and `linked`/`powerline` use `on|off`. Groups must remain continuous. Mutations use the user default; supported structural review flags are described under alignment.

### `config layout auto|explicit [ROW...]`

Automatic mode wraps as before. Saved explicit rows contain all configured instance IDs, including disabled instances, in configured order. Input may also list exactly the enabled instances in their current order: the compatibility path appends omitted disabled instances into the saved partition. The example below uses that path after selecting three types. With enabled instances present, omitting rows creates one explicit row containing all configured instances.

<!-- docs-example: cli-layout -->
```text
claude-statusline config set-items model current-dir context-used
claude-statusline config layout explicit model,current-dir context-used
claude-statusline config layout auto
```

Explicit layout truncates to maximum item widths, then hides lower-priority items (rightmost first on ties); it adds no continuation rows. Changing item order maintains the partition.

### Main-row alignment

`config alignment list`, `config alignment set ID --columns 'instance:A,instance:B;group:C,group:D'`, and `config alignment remove ID` manage stable corresponding-column references. Commas join one column, semicolons separate columns. Structural instance/group/layout commands refuse unapproved alignment repairs. Run `--dry-run`, inspect the valid candidate, then repeat with its `--expected-revision` and exact comma-separated `--accept-alignments` IDs. Invalid candidates, changed revisions and mismatched approvals leave saved configuration unchanged. [Example](../COMPOSITION.md#align-corresponding-columns-across-main-rows) · [Editor review and cancellation](../DRAFT_HISTORY.md#structural-edits-and-alignment).

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
claude-statusline config set statusline-language zh-CN
```

Display options can be configured before installing the status line. Host options `padding`, `refresh-interval`, and `hide-vim-mode-indicator` modify `settings.json/statusLine`, so they require the current status line to be managed by this `claude-statusline` executable. Otherwise, writes are rejected to protect other implementations.

`subagent-statusline` saves the desired enabled state. With it off, `render-subagents` emits no overrides, preserving the host's default rows; rerunning `install` also removes the owned `subagentStatusLine`. Enabling and rerunning `install` restores it on compatible versions. This separation lets `config set subagent-statusline off` resolve an installation conflict without touching third-party settings.

See [display and host options](#display-and-host-options) for all valid `set` values.

### `config item main|subagent ID OPTION VALUE`

Edit one known scoped item, including a currently disabled item:

```text
claude-statusline config item main model label Model
claude-statusline config item main model priority 100
claude-statusline config item main current-dir max-width 32
claude-statusline config item subagent task max-width none
```

`label`/`icon` accept text up to 256 code points without control characters; `inherit` clears an override and an empty string suppresses the label/icon. `priority` accepts 0–100 (default 50); `max-width` accepts 2–10000 or `none`. The seven formatting keys accept values or `inherit` only on compatible component types; see the [scoped option table](#scoped-instance-options). Width counts terminal columns, including CJK and combining characters.

`foreground`/`background` accept `inherit`, `default`, `ansi:0`–`ansi:255`, or quoted `#RRGGBB`. `visibility` accepts `always` plus the rule supported by that scoped item; `visibility-threshold` is an integer 0–100 (default 70) and applies only to usage rules. Conditions use raw used percentages independently of warning colors. See [supported rules and color precedence](../APPEARANCE.md).

### `config apply`

Submit the complete display and host configuration together. The no-argument wizard uses this after collecting all answers; it is also useful for scripted deployment:

Linux / WSL / macOS (Bash):

```bash
claude-statusline config apply \
  --items model-with-effort current-dir git context-remaining task-timer \
  --subagent-items status-elapsed name model-with-effort context-remaining task \
  --subagent-statusline on \
  --scope-labels when-subagents \
  --statusline-language en \
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
claude-statusline.cmd config apply `
  --items model-with-effort current-dir git context-remaining task-timer `
  --subagent-items status-elapsed name model-with-effort context-remaining task `
  --subagent-statusline on `
  --scope-labels when-subagents `
  --statusline-language en `
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

### `config preset NAME [--dry-run]`

The six original presets are `minimal`, `developer`, `monitoring`, `multi-agent`, `left-right`, and `repeated-metrics`. These presets replace the selected items, layout, subagent item defaults and item overrides, set short model/compact number formats, and assign descending item priorities. They preserve colors, palette, theme, Powerline glyph, directory/separator styles, scope labels, refresh/host choices, and current subagent enablement. Multi-agent also hides completed rows, limits rows to six, and task width to 48.

```text
claude-statusline config preset developer --dry-run
claude-statusline config preset developer
```

The same command accepts the eight [complete schemes](../SCHEMES.md), which also set global appearance. All choices retain output language and independent collector/source permissions.

`--dry-run` validates and prints a draft without saving. Actual preset application includes host settings, so requires the current CLI to own installation.

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

`reset` changes only the user-default display and applicable host fields. It preserves the Profile library, project bindings and independent source permissions. A bound project can therefore keep rendering its named Profile after a reset; inspect it with `config project resolve PATH --json`.

## Profiles and projects

Place `--config-dir PATH` after `config` and before `profile`/`project`. All forms below accept `--json`. `NAME_OR_ID` resolves an existing Profile; a save/rename/new-import name is a human name.

```text
claude-statusline config profile list [--json]
claude-statusline config profile save NAME [--overwrite] [--bind PATH] [--json]
claude-statusline config profile rename NAME_OR_ID NEW_NAME [--json]
claude-statusline config profile delete NAME_OR_ID [--json]
claude-statusline config profile preview NAME_OR_ID [--width N] [--scenario SCENARIO] [--json]
claude-statusline config profile activate NAME_OR_ID [--json]
claude-statusline config profile import PATH [--name NAME] [--overwrite] [--dry-run] [--json]
claude-statusline config profile export NAME_OR_ID PATH [--overwrite] [--json]
claude-statusline config project list [--json]
claude-statusline config project bind PATH NAME_OR_ID [--overwrite] [--json]
claude-statusline config project unbind PATH [--json]
claude-statusline config project resolve [PATH] [--json]
```

`save` copies the saved user default; `activate` copies a Profile into that default without creating a project binding. Names are case-sensitive, trimmed/NFC-normalized, 1–128 Unicode code points, without controls. Overwriting a name, binding or export destination requires `--overwrite`; bound Profiles cannot be deleted. `resolve` defaults to the working directory, selects the deepest matching registered root and explains fallback. Mutations retain locks, backups, revision and integration-ownership checks.

Preview is read-only: width defaults to 120, range 2–10000; scenario defaults to `normal`. Choices are `normal`, `warning`, `critical`, `zero`, `missing`, `source-stale`, `source-failed`, `long-content`, `git-clean`, `git-modified`, `git-conflicted`, `no-agents`, `few-agents`, `many-agents`. Full Profile import creates a named copy; selective/style/group import instead edits a selected target as described below.

In a fresh example library, replace `/absolute/project` with an existing project directory. This demonstrates that user-default changes and reset do not change the bound Profile:

<!-- docs-example: cli-profile-target -->
```text
claude-statusline config set-items model
claude-statusline config profile save Work
claude-statusline config project bind /absolute/project Work
claude-statusline config set-items current-dir
claude-statusline config show --json
claude-statusline config project resolve /absolute/project --json
claude-statusline config reset
claude-statusline config project resolve /absolute/project --json
```

The first `show` enables `current-dir`; both resolutions select `Work`, whose enabled selection remains `model`. [Targets, sharing and recovery](../PROFILES.md).

## Import, export and reuse

<a id="portable-import-export"></a>

### `config import PATH [--dry-run]` / `config export PATH [--overwrite]`

```text
claude-statusline config export ./statusline.json
claude-statusline config import ./statusline.json --dry-run
claude-statusline config import ./statusline.json
```

The portable envelope contains exactly `format: "claude-code-statusline"`, `version: 1`, and `draft` with `display`/`host`. It excludes installation, paths, revisions, runtime state, editor/live preferences and Claude appearance/behavior preferences. Imports also accept display-only files within the current display read range, preserving current host settings in that case. Actual import requires installation ownership and atomically saves the validated draft.

Files are UTF-8 (a BOM is accepted on import), limited to 1 MiB, and reject duplicate keys, non-finite numbers, invalid fields/types, and unsupported versions. Relative paths use the current working directory; `~` expands. Export validates and writes configuration without changing settings. Existing destinations are refused unless `--overwrite` is set; live configuration and owned plugin/runtime resources remain protected even with that flag. In editors, import replaces only the unsaved draft and export includes current unsaved edits.

Exporting to a protected configuration path is rejected with a configuration error and exit code 2, leaving the protected file unchanged. Choose a separate export destination; scripts should treat any nonzero result as failure.

### Selective display reuse

`config import` and `config profile import` accept `--select FIELDS`, `--user | --profile NAME_OR_ID | --project PATH`, and `--dry-run`. See [selection keys, target rules and source isolation](../PROFILES.md#selective-import). Without `--select`, existing full-import behavior is unchanged.

### Style and group reuse

```text
claude-statusline config import PATH --style-from SCOPE:ID --style-to SCOPE:ID[,SCOPE:ID...]
  --style-fields FIELD,... [--user | --profile NAME_OR_ID | --project PATH]
  [--profile-file] [--dry-run | --expected-revision TARGET_REV --source-revision SOURCE_REV]
claude-statusline config import PATH --groups SCOPE:ID[,SCOPE:ID...]
  [--references review|expand|exclude] [--explicit-layout]
  [--user | --profile NAME_OR_ID | --project PATH] [--profile-file]
  [--dry-run | --expected-revision TARGET_REV --source-revision SOURCE_REV]
```

`SCOPE` is `main` or `subagent`; style destinations share one scope, as do selected groups. Use `--profile-file` for a Profile envelope, or replace `config import` with `config profile import` and omit that flag. Do not combine reuse with `--select`, `--name` or `--overwrite`. Targets default to the user; at most one explicit target is allowed.

Style fields are `foreground`, `background`, `foreground_gradient`, `background_gradient`, `label`, `icon`, and compatible `formatting.KEY` overrides. Data identity, source binding, content, order, priority, widths and visibility remain unchanged. Group reference handling defaults to `review`; `expand` includes dependencies and `exclude` drops external alignment references. `--explicit-layout` separately permits a needed auto-to-explicit transition.

The following examples overwrite the user-default selection and create a new `source.json`; use a separate export path and begin without a same-name group. First prepare a portable source, then review and repeat exactly with the returned `expected_revision`/`source_revision` substituted for `TARGET_REV`/`SOURCE_REV`. Changed source or target revisions and unresolved dependencies block saving.

<!-- docs-example: cli-style-reuse -->
```text
claude-statusline config set-items model current-dir
claude-statusline config item main model foreground '#123456'
claude-statusline config export source.json
claude-statusline config item main model foreground inherit
claude-statusline config import source.json --style-from main:model --style-to main:current-dir --style-fields foreground --dry-run
claude-statusline config import source.json --style-from main:model --style-to main:current-dir --style-fields foreground --expected-revision TARGET_REV --source-revision SOURCE_REV
```

The destination directory instance receives the model's exported foreground only. For the independent group example, choose a new export destination if `source.json` already exists:

<!-- docs-example: cli-group-reuse -->
```text
claude-statusline config set-items model current-dir
claude-statusline config group main create context --members model,current-dir --primary model
claude-statusline config export source.json
claude-statusline config group main ungroup context
claude-statusline config import source.json --groups main:context --references expand --explicit-layout --dry-run
claude-statusline config import source.json --groups main:context --references expand --explicit-layout --expected-revision TARGET_REV --source-revision SOURCE_REV
```

Group reuse appends new instance/group identities and clears imported local source bindings; it cannot authorize execution. Review output includes candidate differences, references and ID mappings. [Detailed reuse rules](../DRAFT_HISTORY.md).

## Source management

See the [extensions guide](../EXTENSIONS.md) for complete examples.

```text
claude-statusline source [--config-dir PATH] list [--json]
claude-statusline source add|edit ID --file DEFINITION.json [--json]
claude-statusline source review ID [--json]
claude-statusline source enable ID --review REVIEW_REVISION [--json]
claude-statusline source disable|remove ID [--json]
claude-statusline source auto-on ID --review REVIEW_REVISION [--interval SECONDS] [--json]
claude-statusline source auto-off ID [--json]
claude-statusline source bind ID --instance INSTANCE --scope main|subagent [--profile NAME | --project PATH] [--json]
claude-statusline source unbind ID --binding BINDING_ID [--json]
claude-statusline source refresh ID [--project PATH] [--session ID] [--agent ID] [--no-wait] [--json]
claude-statusline source status|cancel JOB_ID [--json]
claude-statusline source diagnose ID [--offset N] [--project PATH] [--session ID] [--agent ID] [--json]
```

For every source action, put `--config-dir PATH` immediately after `source`. Binding saves the selected user/Profile/project display target and requires installation ownership; registration and execution permissions remain separate. `list` and `diagnose` use readable text unless `--json` is supplied; other actions return structured JSON. `--json` also requests structured handled errors. Link appearance is listed under [scoped instance options](#scoped-instance-options).


Interrupting a waiting refresh releases only that CLI consumer; other consumers/applicable automatic leases continue. `--no-wait` retains interest until completion or the original deadline. `source cancel JOB_ID` explicitly cancels the whole job.

Add/edit save a disabled source; enable requires the exact reviewed revision. Refresh waits by default; failed or cancelled jobs return exit code 2. Imports cannot authorize or automatically bind local sources.

### Source binding maintenance

```text
claude-statusline source bindings [--offset N] [--json]
claude-statusline source cleanup-bindings BINDING_ID --review REVISION [--json]
claude-statusline source release-draft OWNER [--json]
```

`source diagnose ID` displays the shared readable summary; `--json` includes advanced saved check details. Automatic commands require separate approval, default to 300 seconds and accept 60–86400 seconds independently of TTL. Binding cleanup rechecks references and revision; release only an explicitly abandoned/recovered draft owner. See [source operations](../EXTENSIONS.md) and [package execution](../PACKAGE_MANAGEMENT.md).

## Diagnosis and task inspection

### `doctor` / `diagnose`

```text
claude-statusline doctor [--config-dir PATH]
claude-statusline diagnose --input FILE|- [--scope main|subagent] [--width N]
  [--observed-at ISO_TIME] [--input-only] [--json] [--config-dir PATH]
```

`doctor` checks installation and local policy, reports text rows and exits 1 if any row is ERROR. It does not repair settings. `diagnose` requires supplied statusline JSON (a file or `-` for stdin); scope defaults to `main`, width to 120 with range 2–10000. `--observed-at` must be a known input capture time including a timezone, never a file mtime. UTF-8/BOM is accepted; input must be one object, at most 32 MiB, without duplicate keys or non-finite constants.

Diagnosis uses the saved display resolved for the input project and matching existing local observations; `--input-only` excludes local observation stores and the local hostname but still reads configuration/installation/collector choices. No collection, source execution, network, repair or cache publication is started. `--json` returns structured evidence/reason codes, or an `error` object on failure. Exit 0 means a report was generated, including unavailable/stale evidence; malformed input, arguments and read failures exit 2.

Replace `input.json` with your captured input file:

<!-- docs-example: cli-diagnose -->
```text
claude-statusline diagnose --input input.json --input-only --json
```

[Input format, interpretation and limitations](../DIAGNOSTICS.md).

### `task show`

Supply the actual session ID; omitting `--prompt-id` uses only the published current-task pointer. This reads existing bounded evidence without scanning transcripts, guessing another session, collection or installation initialization. JSON contains the task detail read model; absent evidence is represented as unavailable. A valid report exits 0; invalid identities/arguments or handled failures exit 2, with an `error` object under `--json`.

```text
claude-statusline task show --session-id SESSION_ID [--prompt-id PROMPT_ID] [--config-dir PATH] [--json]
```

<!-- docs-example: cli-task -->
```text
claude-statusline task show --session-id SESSION_ID --json
```

### Interactive task viewer

```sh
claude-statusline task view --session-id ID [--prompt-id ID] [--config-dir PATH]
```

Requires a terminal and explicit session identity; global `--language` remains available. Omitting the prompt uses the published current-task pointer. `--json` belongs to `task show`. The viewer does not initialize installation/configuration or run collection. [Controls and evidence](../TASK_DETAILS.md).

## Appearance and display options

<a id="显示与宿主选项"></a>

### Display and host options

Use `config set OPTION VALUE` on the user default. The three host options require owned installation; other entries are display options. Powerline controls affect Powerline rendering. Values such as language codes and preset IDs are stable arguments.

<!-- cli-set-options:start -->
| OPTION | VALUE | Default | Description |
| --- | --- | --- | --- |
| `statusline-language` | `en`, `zh-CN`, `zh-TW`, `zh-HK`, `ja`, `ko`, `es`, `fr`, `de`, `pt-BR`, `ru`, `id` | `en` | Independent main/subagent output language; preview immediately, save with display settings |
| `colors` | `on`, `off` | `on` | Whether to output ANSI color codes |
| `palette` | `default`, `ansi` | `default` | `default` uses this project's 24-bit RGB colors; `ansi` uses standard terminal colors |
| `directory-style` | `full`, `home`, `project-relative`, `basename` | `full` | How to abbreviate the working directory |
| `separator-style` | `classic`, `compact`, `powerline` | `classic` | How to separate top-level items |
| `theme` | `classic`, `dark`, `light`, `terminal`, `ocean`, `ember`, `slate`, `blossom` | `classic` | Statusline color roles; preserves item overrides and Claude host appearance |
| `powerline-glyph` | `ascii`, `powerline` | `ascii` | ASCII `>` or optional font-dependent arrow for Powerline boundaries |
| `scope-labels` | `off`, `when-subagents`, `always` | `when-subagents` | Whether to prepend the localized main/session scope label to the main line |
| `subagent-statusline` | `on`, `off` | `on` | Whether custom subagent rows should be installed and rendered |
| `padding` | `0`–`32` | `0` | Horizontal whitespace added by Claude Code before status-line content |
| `refresh-interval` | `event`, `1`–`3600` | `1` | Rerun the renderer every specified number of seconds in addition to event refreshes; `event` means events only |
| `hide-vim-mode-indicator` | `on`, `off` | `off` | `on` hides Claude Code's built-in Vim mode text |
| `branch-diff-base` | `auto` or safe local Git ref | `auto` | Base for committed branch comparison; no fetch |
| `model-name` | `original`, `short` | `original` | Full model name or abbreviation |
| `number-format` | `legacy`, `compact`, `full`, `grouped` | `legacy` | Preserve field defaults, compact suffixes, full integers, or grouped digits |
| `labels` | `legacy`, `short`, `off` | `legacy` | Semantic label style |
| `icons` | `legacy`, `unicode`, `ascii`, `off` | `legacy` | Built-in icons; no special font required |
| `allowance` | `remaining`, `used` | `remaining` | Display allowance balance or utilization |
| `reset-format` | `countdown`, `time`, `datetime` | `countdown` | Allowance reset display |
| `reset-timezone` | `local`, `UTC` | `local` | Reset display timezone |
| `threshold-colors` | `on`, `off` | `off` | Color by actual utilization, also when showing remaining balance |
| `warning-threshold` | `0`–`100`, below critical | `70` | Warning utilization percentage |
| `critical-threshold` | `0`–`100`, above warning | `90` | Critical utilization percentage |
| `subagent-visibility` | `all`, `running` | `all` | Agent visibility filter |
| `subagent-hide-completed` | `on`, `off` | `off` | Hide completed rows; failures remain subject to other filters |
| `subagent-row-limit` | `none`, `0`–`10000` | `none` | Maximum visible rows; zero suppresses all custom rows |
| `subagent-task-max-width` | `none`, `2`–`10000` | `none` | Limit task text width in terminal columns |
| `powerline-padding` | `none`, `left`, `right`, `both` | `both` | Block padding; independent of host padding |
| `powerline-separator` | `arrow`, `slash`, `bar`, `none` | `arrow` | Powerline boundary shape |
| `powerline-start-cap` | `on`, `off` | `off` | Leading cap for Powerline rows |
| `powerline-end-cap` | `on`, `off` | `on` | Trailing cap for Powerline rows |
| `powerline-color-mode` | `semantic`, `continuous`, `restart` | `semantic` | Semantic roles, continuous sequence, or per-row restart |
| `powerline-row-background-gradient` | `off`, PRESET, or 2–5 comma-separated `#RRGGBB` colors | `off` | Continuous Powerline row background; same gradient presets as instances |
<!-- cli-set-options:end -->

<a id="颜色"></a>

#### Colors

- `colors off` disables all ANSI color codes output by this tool.
- `palette` is saved even with colors off, but affects output only after colors are reenabled.
- `default` requires 24-bit color support; use `ansi` when terminal compatibility is the priority.

<a id="目录格式"></a>

#### Directory formats

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

#### Separators and semantic groups

`classic` separates top-level items with ` | `; `compact` uses ` · ` for all top-level items. `powerline` treats every visible item as a separate block; padding and boundaries count toward width. See [Powerline behavior](../APPEARANCE.md#basic-powerline).

With the ordinary separators, adjacent items in the following semantic groups join with ` · `. Color names below describe the default classic theme; themes and item overrides can change them:

- `model-with-effort`, `fast-mode`, and `thinking` (model group, ivory)
- `current-dir`, `project-name`, and `hostname` (location group, green)
- `git`, `pr`, and `repo` (repository group, purple)
- `tokens` and `prompt-cache` (usage group, pink)
- `context-remaining`, `context-used`, and `context-window-size`
- `five-hour-limit`, `weekly-limit`, and `spend-limit`

`version`, `session`, `cost`, `agent`, `vim-mode`, and `worktree` remain independent and do not merge with neighbors. The catalog is grouped as model → location → repository → context → limits → usage → timer → independent items, but `enable` simply appends new items in argument order. Use `order`, `set-items`, or the TUI to place group members together. Separating them through reordering restores independent top-level items. Internal fields in `tokens` (`hit`, `miss`, `out`), `cost` (amount, duration, line changes), and `prompt-cache` (hit rate, written tokens) always use ` · `.

<a id="刷新间隔"></a>

#### Refresh interval

Claude Code reruns the status line on relevant UI or session events. `refresh-interval N` adds refreshes every N seconds, useful for continuously updating `task-timer` or observing background changes while the main session is idle.

```bash
# Default: refresh every second
claude-statusline config set refresh-interval 1

# Refresh less frequently
claude-statusline config set refresh-interval 5

# Refresh only on Claude Code events
claude-statusline config set refresh-interval event
```

With `event`, an active `task-timer` does not advance visibly every second; it updates only on the next status event.

### Conditional visibility and appearance

Use `config set theme classic|dark|light|terminal|ocean|ember|slate|blossom`, `config set separator-style classic|compact|powerline`, and `config set powerline-glyph ascii|powerline`. Scoped `config item` options include `foreground`, `background`, `visibility` and `visibility-threshold`. See [syntax, supported items and recovery](../APPEARANCE.md).

`config set powerline-padding none|left|right|both`, `powerline-separator arrow|slash|bar|none`, `powerline-start-cap on|off`, `powerline-end-cap on|off`, and `powerline-color-mode semantic|continuous|restart` use shared validation. These affect Powerline blocks, independently of host padding. [Appearance controls](../APPEARANCE.md).

### Graphical indicators

Use `config instance main|subagent set ID presentation numeric|bar|adaptive`, `bar-width 4..20`, and `bar-style auto|unicode|ascii` for eligible instances. [Guide](../APPEARANCE.md#graphical-indicators).

### Gradients

`config instance main|subagent set ID foreground-gradient|background-gradient VALUE` accepts `off`, all eleven presets (`ocean`, `sunset`, `aurora`, `glacier`, `lagoon`, `flame`, `copper`, `steel`, `sage`, `petal`, `twilight`), or 2–5 comma-separated `#RRGGBB` colors. Presets expand into colors before saving. [Static gradients](../APPEARANCE.md#static-component-gradients).

### Adaptive indicators and continuous backgrounds

```text
claude-statusline config instance main set context-remaining presentation adaptive
claude-statusline config set powerline-row-background-gradient lagoon
claude-statusline config set powerline-row-background-gradient off
```

See the [composition guide](../COMPOSITION.md#adaptive-indicators-and-continuous-backgrounds) for rendering rules and compatible schemes.

### Session cost rate

The optional `session-cost-rate` component accepts `config instance main set INSTANCE cost-rate-basis session|api`. Omission selects session duration; either basis requires at least one minute. See [cost rate definitions](../DISPLAY_ITEMS.md#session-cost-rate).

### Scoped instance options

Use `config instance main|subagent set INSTANCE OPTION VALUE` for an existing instance. Legacy `config item main|subagent TYPE OPTION VALUE` resolves a unique type (and can configure a disabled/absent metric); repeated types require the instance form. `text` and `spacer` are instance-only, and spacers expose no item appearance fields. Unsupported combinations fail without saving.

| OPTION | Values / default | Applies to |
| --- | --- | --- |
| `label / icon` | `inherit`, empty text, or ≤256 code points without controls; default inherited | Metrics and text |
| `foreground / background` | `inherit`, `default`, `ansi:0`–`ansi:255`, quoted `#RRGGBB`; default inherited | Metrics and text |
| `foreground-gradient / background-gradient` | `off`, eleven presets or 2–5 colors; default off | Metrics and text |
| `priority / max-width` | 0–100 (50) / 2–10000 or `none` (`none`) | Metrics and text; width uses terminal cells |
| `model-name` | `original`, `short`, `inherit`; inherited | Model-bearing metrics |
| `number-format` | `legacy`, `compact`, `full`, `grouped`, `inherit`; inherited | Compatible numeric metrics; not `current-dir` |
| `labels / icons` | Global choices or `inherit`; inherited | Compatible metrics |
| `allowance` | `remaining`, `used`, `inherit`; inherited | Main allowance limits |
| `reset-format / reset-timezone` | Global choices or `inherit`; inherited | Main reset-time metrics |
| `visibility / visibility-threshold` | `always` or supported rule / 0–100 (70) | Rules are scope/type-specific; threshold only for usage rules |
| `presentation / bar-width / bar-style` | `numeric` / 4–20 (8) / `auto` by default; see graphical indicators | Eligible usage/context indicators |
| `cost-rate-basis` | `session`, `api`; `session` | Main `session-cost-rate` |
| `link` | `off`, `auto`, `on`; `off` | Link-capable components only |
| `text` | Literal text, ≤256 code points; empty on add unless `--text` supplied | Text instances, instance form only |

The catalog JSON exposes each type's `capabilities` and supported `format_options`; consult it before scripting an override. For example, `config item main current-dir number-format compact` is rejected. The [appearance guide](../APPEARANCE.md) owns exact visibility/link eligibility, color precedence and rendering rules.

## Display items and scopes

<a id="可配置显示项"></a>

### Configurable display items

Use `config list-items --json` and `config subagents list-items --json` for the full catalog in each scope. Use `config enable` for main IDs and `config subagents enable` for subagent IDs.

```bash
claude-statusline config enable project-name hostname context-used
```

See [metric definitions](../DISPLAY_ITEMS.md) for defaults, host requirements and unavailable values.

<a id="主状态栏显示含义"></a>

### Main status line fields

<a id="git-标记"></a>

#### Git markers

See [Git markers and collection scope](../DISPLAY_ITEMS.md#git-markers) for the displayed fields.

<a id="token-含义"></a>

#### Token fields

See [token fields and scope](../DISPLAY_ITEMS.md#token-fields) for definitions.

<a id="prompt-计时标记"></a>

<a id="prompt-timer-markers"></a>

<a id="prompt-timing-markers"></a>

#### Task timing markers

See the [metric definitions](../DISPLAY_ITEMS.md#timer-definitions) for task clocks and their output markers, and the [user guide](../USER_GUIDE.md#task-total-and-execution-time) for enablement.

### Subagent rows and the three scopes

On Claude Code 2.1.205+, the official `subagentStatusLine` payload is passed to `claude-statusline render-subagents`. The renderer preserves `tasks` input order, ignores later duplicate IDs, and emits one `{"id":"...","content":"..."}` NDJSON line per valid nonempty string ID. Ordinary payload metrics do not scan transcripts or query the network. Completed-agent timing may read existing local end evidence. Enabled, bound external values can read their selected JSON files, inspect local Git identity and publish observation caches; command/GitHub values read published results without executing the provider during rendering. These source effects require explicit local enablement/binding and are separate from the pure row formatter.

The renderer uses the positive integer `columns` from the payload, with a fallback of 80. It uses the full width for the row and sanitizes newlines, tabs and control characters in input text.

Basic fitting shortens task text, then omits optional fields in the order `current-dir → tokens → context-window-size → context-tokens → context-used → context-remaining → model-with-effort → effort → model → task`. It prioritizes enabled status fields, and very narrow widths may reduce `status-elapsed` to its icon. Groups, adaptive indicators, Powerline and custom priorities use their respective fitting rules. Each path fits a single row by visible terminal cells.

See the [metric definitions](../DISPLAY_ITEMS.md#display-scopes) for field meanings, defaults and data scopes.

<a id="配置文件"></a>

## Configuration files

All files below are relative to the selected Claude configuration directory. JSON formats are separate; a portable export is not a copy of this entire directory.

| File | Role and write entry |
| --- | --- |
| `claude-statusline.json` | User-default display in the current display schema; ordinary display commands |
| `claude-statusline-profiles.json` | Profile library and project bindings in the current profile format; `config profile/project` |
| `claude-statusline-sources.json` | Local source definitions, permissions and bindings in the current source-registry format; `source` |
| `statusline-ui.json` | UI language in the current preferences schema; `config language` |
| `claude-statusline-features.json / claude-statusline-native.json` | Editor preferences in the current preferences schema; explicit install flags |
| `claude-statusline-runtime.json` | Collector preferences in the current preferences schema; explicit install flags |
| `settings.json` | Claude-owned settings with merged integration and host options; install/uninstall and owned host writes |

Current version numbers and package read ranges are in [protocol and schema versions](#protocol-and-schema-versions).

Profile storage limits and recovery are in [Profiles](../PROFILES.md#files-conflicts-and-recovery); local source records and observation caches are in [Extensions](../EXTENSIONS.md). Ordinary reset/uninstall preserve the Profile library and source registry.

<a id="显示配置"></a>

### Display configuration

Display items and styles are saved in:

```text
<CLAUDE_CONFIG_DIR>/claude-statusline.json
```

This complete example uses the current display schema and keeps one main model instance and one subagent name instance. Use `config export PATH` for your complete configuration. Defaults still enable ten main metrics and five subagent metrics.

<!-- docs-example: display-config -->
```json
{
  "schema_version": 17,
  "groups": [],
  "use_colors": true,
  "palette": "default",
  "directory_style": "full",
  "separator_style": "classic",
  "scope_labels": "when-subagents",
  "statusline_language": "en",
  "theme": "classic",
  "powerline_glyph": "ascii",
  "powerline": {
    "padding": "both",
    "separator": "arrow",
    "start_cap": false,
    "end_cap": true,
    "color_mode": "semantic"
  },
  "subagents": {
    "enabled": true,
    "visibility": "all",
    "hide_completed": false,
    "row_limit": null,
    "task_max_width": null,
    "instances": [
      {
        "id": "name",
        "type_id": "name",
        "enabled": true,
        "options": {
          "label": null,
          "icon": null,
          "priority": 50,
          "max_width": null,
          "formatting": {},
          "foreground": null,
          "background": null,
          "visibility": "always",
          "visibility_threshold": 70
        },
        "text": null
      }
    ],
    "groups": []
  },
  "formatting": {
    "model_name": "original",
    "number_format": "legacy",
    "labels": "legacy",
    "icons": "legacy",
    "allowance": "remaining",
    "reset_format": "countdown",
    "reset_timezone": "local",
    "thresholds": {
      "enabled": false,
      "warning": 70,
      "critical": 90
    }
  },
  "layout": {
    "mode": "auto",
    "rows": []
  },
  "metrics": {
    "branch_diff_base_ref": null
  },
  "instances": [
    {
      "id": "model-with-effort",
      "type_id": "model-with-effort",
      "enabled": true,
      "options": {
        "label": null,
        "icon": null,
        "priority": 50,
        "max_width": null,
        "formatting": {},
        "foreground": null,
        "background": null,
        "visibility": "always",
        "visibility_threshold": 70
      },
      "text": null
    }
  ]
}
```

This is strict JSON: comments, trailing commas, unknown or missing fields, unknown items, and duplicates are rejected. Use configuration commands rather than editing it manually.

The catalog is a list of types; `instances` stores configured placements. Disabled instances and their options remain configured until removed. Each scope has its own identity namespace.

Updates back up the previous contents and protect writes with atomic replacement and file locks. See [backups and rollback](../USER_GUIDE.md#backups-and-rollback) and [current architecture](../development/architecture.md#current-typescript-workspace).

Current and historical display schemas and read ranges are in [protocol and schema versions](#protocol-and-schema-versions). Historical files are readable and are backed up and written with the current schema on the first actual configuration save. See [version compatibility](../USER_GUIDE.md#version-compatibility) for conversion and downgrade recovery.

If display configuration is corrupted:

- Both renderers silently use built-in user-default settings when the default file is invalid; a valid project Profile can still be selected afterward.
- `config show`, normal configuration writes, and `doctor` report an explicit error.
- `config reset` removes the corrupted configuration and restores defaults.

`instances: []` is valid and suppresses main-line content; even scope labels set to `always` do not create an otherwise empty main line. `subagents.instances: []` is also valid and returns empty content for each valid subtask.

<a id="实验功能偏好"></a>

<a id="experimental-feature-preferences"></a>

### Shared interface preference

`<CLAUDE_CONFIG_DIR>/statusline-ui.json` uses its own schema, shown in the example:

```json
{"schema_version": 1, "ui_language": "zh-CN"}
```

Accepted codes are `en`, `zh-CN`, `zh-TW`, `zh-HK`, `ja`, `ko`, `es`, `fr`, `de`, `pt-BR`, `ru` and `id`. Missing/invalid reads return English and may report a warning without repair. Explicit set/reset locks, backs up and atomically writes; a future schema refuses overwrite and write failures preserve the previous effective choice. This file is independent of display revisions, installation preferences, presets and portable files, and survives ordinary uninstall.

### Editor enablement preferences

Both independent files use the same preferences schema:

```text
<CLAUDE_CONFIG_DIR>/claude-statusline-features.json
<CLAUDE_CONFIG_DIR>/claude-statusline-native.json
```

```json
{"schema_version": 1, "experimental_slash_tui": false}
```

```json
{"schema_version": 1, "native_editor": false}
```

These booleans independently control external and in-session editors. Missing files default on in the current package. Explicit flags record true/false; unsupported hosts suspend without rewriting preferences. Reinstall and uninstall preserve them; external disablement records false instead of deleting the file.

Fields, types, duplicate keys and schema are strictly validated; install/doctor report invalid preferences rather than guessing. Explicit flags back up and repair the corresponding preference. Linux/macOS use 0600 permissions; Windows uses inherited ACLs.

### Live-collection preference

`<CLAUDE_CONFIG_DIR>/claude-statusline-runtime.json` uses its own schema, shown in the example:

```json
{"schema_version": 2, "native_timing": false, "live_metrics": false}
```

A missing file defaults to both native timing and advanced metrics off. `install --native-timing` / `install --no-native-timing` controls timing independently; `--live-metrics` enables complete collection and `--no-live-metrics` retains the legacy all-off choice. An explicit timing flag overrides the timing part. Reinstall preserves saved preferences; unsupported hosts retain them but suspend collection. [Enabling collection and display](../USER_GUIDE.md#opt-in-live-state).

<a id="claude-code-宿主配置"></a>

### Claude Code host configuration

The following settings belong to the `statusLine` object in user-level `settings.json`, not `claude-statusline.json`:

- `command`
- `padding`
- `refreshInterval`
- `hideVimModeIndicator`

The installer manages `command`; the other three fields can be changed with `config set` or the wizard. Some fields are omitted from JSON when set to default behavior, such as `padding 0`, `refresh-interval event`, and `hide-vim-mode-indicator off`.

Compatible versions also receive an independent `subagentStatusLine` in `settings.json`, containing strictly `type: "command"` and a `command` pointing to `render-subagents`. Claude's schema does not accept `refreshInterval`, so this tool does not write it. With `subagents.enabled=false`, rerunning `install` removes only the owned entry, preserving third-party settings. Both subagent lifecycle hooks remain for end-to-end timing.

## Protocol and schema versions

This chapter is the current source of truth for interface and stored-format versions. Root feature guides link here instead of restating current numbers; development documentation keeps behavior-specific detail and links here for the registry. Historical introduction versions remain in [protocol and schema history](../development/contracts.md#protocol-and-schema-history). Package versions, tags and release artifacts are separate from these interface versions.

### Current interface versions

| Interface or format | Current version | Read and save compatibility | Specification |
| --- | --- | --- | --- |
| Editor UI protocol | `editor protocol 31` | Frontend and backend resources must come from the same package; mismatches are refused. | [Shared contracts](../development/contracts.md#transport-and-response-envelopes); `packages/core/src/contracts/ui.ts` |
| Display configuration | `display schema 17` | Reads schemas 1–16 in memory without rewriting; an explicit save backs up the old bytes and writes the current schema. | `packages/core/src/config/display.ts`; [display configuration](#display-configuration) |
| Runtime observation protocol | 3 | Retains v1/v2 `observe`/`read`; `source_lifecycle` requires version 3. | [Live collection](../development/live.md); `packages/core/src/contracts/runtime.ts` |
| Task lifecycle | 4 | Retains the schema-1 compatibility mirror. | `packages/core/src/runtime/tasks/model.ts`; [timer contracts](../development/timer.md) |
| Task detail read model | 1 | `task_details` response; missing evidence is unavailable rather than invented. | [Shared contracts](../development/contracts.md#operation-inventory) |
| Portable configuration envelope | 1 | Import also accepts display-only files within the current display read range. | `packages/core/src/config/transfer.ts`; [import, export and reuse](#import-export-and-reuse) |
| Profile collection and single-profile export | 1 each | Collection and export evolve independently. | `packages/core/src/config/profiles.ts`; [Profiles and projects](../PROFILES.md#files-conflicts-and-recovery) |
| UI preferences | 1 | Future schemas refuse overwrite. | [Shared interface preference](#shared-interface-preference) |
| Native and external editor preferences | 1 each | Separate files; unsupported hosts suspend without rewriting. | [Editor enablement preferences](#editor-enablement-preferences) |
| Runtime preferences | 2 | Missing file defaults native timing and live metrics off. | [Live-collection preference](#live-collection-preference) |
| Source registry | 2; 3 with command-source automatic policies | Reads registries 1–3; older registries are read-only and grant no new permission. | `packages/core/src/extensions/model.ts`; [source management](#source-management) |
| Source jobs | 4 | Reads jobs 1–3; missing execution diagnostics are unknown. | [Source management](#source-management) |
| Source observations | 1 | Optional checks and execution fields. | [Extensions](../EXTENSIONS.md#freshness-sharing-and-links) |
| Command source output protocol | 1 | JSON object with `valid`, `missing`, `partial`, `error` or `unsupported` states. | [Command sources](../EXTENSIONS.md#command-sources) |
| Package review jobs | 1 | Matching resources; owner-bound cancellation. | [Package management](../PACKAGE_MANAGEMENT.md) |
| Package execution records | 1 | Independent of display, UI and runtime wire schemas. | [Package management](../PACKAGE_MANAGEMENT.md) |
| Package compatibility record | 1 | Declares read ranges and required editor/runtime protocols. | `packages/core/src/management/compatibility.ts`; [package operation diagnosis](../PACKAGE_MANAGEMENT.md#package-operation-diagnosis) |

### Read ranges and package compatibility

The `statuslineCompatibility` record schema 1 declares these configuration read ranges:

| Configuration format | `read` range |
| --- | --- |
| Display configuration (`display`) | `[1, 17]` |
| Profile collection (`profiles`) | `[1, 1]` |
| Source registry (`sources`) | `[1, 3]` |
| Runtime preferences (`runtime_preferences`) | `[1, 2]` |
| Native preferences (`native_preferences`) | `[1, 1]` |
| External preferences (`external_preferences`) | `[1, 1]` |
| UI preferences (`ui_preferences`) | `[1, 1]` |

The record also declares `editor_protocol` 31, `runtime_protocol` 3, `minimum_host` 2.1.205, supported Node majors and targets. The protocol values must match the current versions above. Canonical declarations are in `packages/core/src/management/compatibility.ts`; package review and recovery behavior are in [package operation diagnosis](../PACKAGE_MANAGEMENT.md#package-operation-diagnosis).

### Unversioned and host-owned interfaces

| Interface | Owner and contract |
| --- | --- |
| Statusline input payload (`statusLine`) | Claude Code owns the schema; this package reads supplied fields and does not version the payload. |
| Subagent statusline input and NDJSON output | Claude Code owns the input; this package emits one `{"id","content"}` line per valid nonempty ID and defines no NDJSON version. |
| Hook payloads | Claude Code owns the payload; hook handlers accept observed fields defensively and write no versioned hook contract. |
| `settings.json` host configuration | Claude-owned schema; this package edits only owned fields and merges unrelated settings. |
| CLI human output and exit codes | Package behavior, not a versioned wire protocol; command-specific JSON shapes remain documented with each command. |
| Private runtime caches (usage, Git) | Implementation details; not compatibility contracts and may change without migration. |

### Specification sources

Canonical types and validation live in the linked source files. Envelope, operation, transaction and error behavior are in [shared contracts](../development/contracts.md); field semantics are in [metric definitions](../DISPLAY_ITEMS.md), [composition](../COMPOSITION.md) and [appearance](../APPEARANCE.md). This chapter owns the version numbers; feature guides link here instead of restating them.

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
claude-statusline.cmd install
claude-statusline.cmd configure
claude-statusline.cmd config show
```

Management commands also accept explicit `--config-dir PATH`, which takes precedence over the environment variable.

The following runtime-location overrides are also supported:

- `CLAUDE_STATUSLINE_RUNTIME_DIR`: overrides the runtime directory for token and Git caches and per-turn state.
- `CLAUDE_STATUSLINE_SESSIONS_DIR`: overrides the Claude Code session registry directory.

These last two variables are usually unnecessary. Changing them may temporarily hide existing session state, without changing display configuration itself.

<a id="退出码"></a>

## Exit codes

Management commands follow these conventions:

- `0`: success; `doctor` found no ERROR.
- `1`: `doctor` found at least one ERROR, or setup preflight checks blocked the requested integration.
- `2`: argument parsing or handled configuration, ownership, or installation validation failed.
- `130`: interactive TUI received Ctrl+C/SIGINT; the terminal is restored and configuration is not saved.
- `128 + signal`: interactive TUI received a termination signal available on the current platform; the terminal is restored and configuration is not saved.

Frequent internal commands `render`, `render-subagents`, `hook`, and `slash-hook` silently tolerate corrupted or unrelated input to avoid blocking Claude Code with their own errors.
