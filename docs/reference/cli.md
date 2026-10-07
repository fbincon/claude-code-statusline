# CLI reference

**English** | [简体中文](cli.zh-CN.md)

Complete command syntax, supported options, display fields and configuration files. For installation and step-by-step workflows, read the [user guide](../USER_GUIDE.md). Values and examples below describe the current package, not historical release announcements.

## Contents

- [CLI overview](#cli-overview)
- [Installation and diagnostics](#installation-and-diagnostics)
- [Slash-command support](#slash-command-support)
- [Configuration command reference](#configuration-command-reference)
- [Configurable display items](#configurable-display-items)
- [Main status line fields](#main-status-line-fields)
- [Subagent rows and the three scopes](#subagent-rows-and-the-three-scopes)
- [Display and host options](#display-and-host-options)
- [Configuration files](#configuration-files)
- [Custom configuration directory and environment variables](#custom-configuration-directory-and-environment-variables)
- [Exit codes](#exit-codes)

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
claude-statusline config [--config-dir PATH] preset NAME [--dry-run]
claude-statusline config [--config-dir PATH] import PATH [--dry-run]
claude-statusline config [--config-dir PATH] export PATH [--overwrite]
claude-statusline config [--config-dir PATH] item main|subagent ID OPTION VALUE
claude-statusline config [--config-dir PATH] layout auto|explicit [ROW...]
claude-statusline config [--config-dir PATH] reset
claude-statusline install [--dry-run] [--force]
  [--experimental-slash-tui | --no-experimental-slash-tui]
  [--native-editor | --no-native-editor]
  [--live-metrics | --no-live-metrics]
  [--config-dir PATH]
claude-statusline uninstall [--dry-run] [--config-dir PATH]
claude-statusline doctor [--config-dir PATH]
claude-statusline --version
```

In Windows PowerShell, replace the command name with `claude-statusline.exe`; arguments and output formats are identical. Brackets and ellipses above indicate syntax, not literal arguments. See the [internal commands appendix](../development/README.md#appendix-internal-commands) for commands called by Claude Code.

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

## Installation and diagnostics

| Command | Behavior |
| --- | --- |
| `install` | Merge owned integration into Claude settings; back up actual changes |
| `install --dry-run` | Report planned changes without installing resources or writing files |
| `install --force` | Permit replacement of conflicting main/subagent settings or same-name skills; native plugin identity conflicts still require resolving ownership |
| `uninstall [--dry-run]` | Remove or preview removal of owned integration; retain display settings, preferences, state, and backups |
| `doctor` | Diagnose installation without rewriting settings or opening an editor |
| `configure` | Open curses in the current terminal; requires valid settings, installation ownership, TTY input/output, and at least 64×18 |

All commands accept `--config-dir PATH` after the command name. The four independent `install` preference pairs are:

- `--native-editor` / `--no-native-editor`: in-session Client, Claude Code 2.1.287+.
- `--experimental-slash-tui` / `--no-experimental-slash-tui`: external entry, 2.1.258+.
- `--native-timing` / `--no-native-timing`: native timing metadata, 2.1.289+.
- `--live-metrics` / `--no-live-metrics`: advanced live collection, 2.1.289+.

Each pair is mutually exclusive. Explicit flags override saved values, which override defaults. Editors and native timing default on; advanced live metrics default off. `--no-live-metrics` retains the legacy choice to disable both timing and advanced collection; an explicit timing flag in the same command controls timing separately. Incompatible or unknown hosts suspend requested integration without discarding its preference. Host-disabled plugins remain disabled. Restart Claude Code after changing integration. See [installation](../USER_GUIDE.md#installation-and-integration), [backups](../USER_GUIDE.md#backups-and-rollback), and [uninstalling](../USER_GUIDE.md#uninstalling).

## Slash-command support

The `/statusline-config` argument parser supports `show`, `list-items`, `set-items`, `enable`, `disable`, `order`, `subagents`, `set`, `apply`, and `reset`. Its subagent operations are `list-items`, `set-items`, `enable`, `disable`, and `order`. On Claude Code 2.1.258+ with hooks enabled, these execute locally; older/unknown hosts use a model turn. The no-argument wizard always uses a model turn.

`preset`, `import`, `export`, `item`, and `layout` are terminal CLI/editor operations; the local slash parser rejects them. `/statusline-configure` accepts no configuration arguments. [Choosing an entry point](../USER_GUIDE.md#choose-a-configuration-entry-point).

<a id="配置命令详解"></a>

## Configuration command reference

The basic operations listed in [slash-command support](#slash-command-support) also accept `/statusline-config` in Claude Code. Advanced operations use the terminal CLI or editor. For example:

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
Items: model-with-effort, current-dir, git, context-remaining, task-timer
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
- `default_enabled`: ten main items are `true`; the other 50 main items are `false` (opt-in).
- `enabled`: whether it is currently enabled.
- `position`: its current zero-based position, or `null` when disabled.

The shared catalog also returns `scope`, `label`, `group`, `sources`, `examples`, `default_position`, `minimum_version`, `minimum_version_status`, `format_options`, `excludes`, and `unavailable_reasons`. Version metadata identifies a capability, not evidence of received data. The subagent catalog has 14 items, five enabled by default.

### `config set-items [ITEM...]`

Replace the entire enabled set at once and save argument order as display order:

```bash
claude-statusline config set-items model-with-effort current-dir git task-timer
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

```bash
claude-statusline config order git current-dir model-with-effort task-timer
```

Arguments must contain every currently enabled item exactly once. Missing or extra items, currently disabled items, and duplicates all cause failure.

Inspect the current set before reordering:

```bash
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
  --items model-with-effort current-dir git context-remaining task-timer \
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
  --items model-with-effort current-dir git context-remaining task-timer `
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

### `config layout auto|explicit [ROW...]`

Automatic mode wraps as before. Explicit mode accepts comma-separated rows whose flattened items must exactly equal the enabled main-item order; omitted rows put all enabled items into one explicit row.

```text
claude-statusline config set-items model current-dir context-used
claude-statusline config layout explicit model,current-dir context-used
claude-statusline config layout auto
```

Explicit layout truncates to maximum item widths, then hides lower-priority items (rightmost first on ties); it adds no continuation rows. Changing item order maintains the partition.

### `config item main|subagent ID OPTION VALUE`

Edit one known scoped item, including a currently disabled item:

```text
claude-statusline config item main model label Model
claude-statusline config item main model priority 100
claude-statusline config item main current-dir max-width 32
claude-statusline config item subagent task max-width none
```

`label`/`icon` accept text up to 256 code points without control characters; `inherit` clears an override and an empty string suppresses the label/icon. `priority` accepts 0–100 (default 50); `max-width` accepts 2–10000 or `none`. The seven formatting choices in [display options](#display-and-host-options) accept a value or `inherit` to remove the per-item override. Width counts terminal columns, including CJK and combining characters.

### `config preset NAME [--dry-run]`

Names are `minimal`, `developer`, `monitoring`, and `multi-agent`. A preset replaces the selected items, layout, subagent item defaults and item overrides, sets short model/compact number formats, and assigns descending item priorities. It preserves colors, palette, directory/separator styles, scope labels, refresh/host choices, and current subagent enablement. Multi-agent also hides completed rows, limits rows to six, and task width to 48.

```text
claude-statusline config preset developer --dry-run
claude-statusline config preset developer
```

`--dry-run` validates and prints a draft without saving. Actual preset application includes host settings, so requires the current CLI to own installation.

<a id="portable-import-export"></a>

### `config import PATH [--dry-run]` / `config export PATH [--overwrite]`

```text
claude-statusline config export ./statusline.json
claude-statusline config import ./statusline.json --dry-run
claude-statusline config import ./statusline.json
```

Portable version 1 contains exactly `format: "claude-code-statusline"`, `version: 1`, and `draft` with `display`/`host`. It excludes installation, paths, revisions, runtime state, editor/live preferences and Claude appearance/behavior preferences. Imports also accept compatible display-only schema v1–v5 files, preserving current host settings in that case. Actual import requires installation ownership and atomically saves the validated draft.

Files are UTF-8 (a BOM is accepted on import), limited to 1 MiB, and reject duplicate keys, non-finite numbers, invalid fields/types, and unsupported versions. Relative paths use the current working directory; `~` expands. Export validates and writes configuration without changing settings. Existing destinations are refused unless `--overwrite` is set; live configuration and owned plugin/runtime resources remain protected even with that flag. In editors, import replaces only the unsaved draft and export includes current unsaved edits.

Current CLI limitation: exporting to a protected configuration path raises an uncaught validation error, exits 1, and prints a traceback. The protected file is unchanged. Choose a separate export destination; scripts should treat any nonzero result as failure.

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

The main catalog has 60 items. The tables below cover defaults and common optional fields. Use `config list-items --json` for all IDs; [metric definitions](../DISPLAY_ITEMS.md) cover independent and live fields.

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
| `task-timer` | Duration and result of the current or latest real prompt | Omitted until a prompt can be identified |

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

<a id="prompt-timer-markers"></a>

<a id="prompt-timing-markers"></a>

### Task timing markers

| Marker | Meaning |
| --- | --- |
| `⏱` | Task is running; time continues increasing |
| `✓` | Task completion is reliably confirmed |
| `■` | Task was interrupted or the session ended |
| `✗` | Claude Code reported execution failure |
| `? <elapsed>+` | A Stop candidate is unconfirmed or historical ending evidence is incomplete; shows the known elapsed lower bound |

Owned agents and main-agent wrap-up add two running phases:

```text
⏱ 4m 12s
⏳ 2 agents · 4m 12s
⏳ main wrap-up · 4m 12s
? 4m 35s+
✓ 4m 35s
```

`task-timer` starts at the earliest trusted user submission and includes queueing, user waits, owned agents, required reports and main-agent wrap-up. A classic `Stop` is an ending candidate; verified continuation clears it without resetting the clock. Completion needs an attributed native ending or verified transcript/process-idle evidence, plus resolved agents, reports and wrap-up. No timeout or expired heartbeat fabricates completion. Background shell, server, monitor, workflow and agent-team ledgers do not block completion.

Reliable failures and user interruptions freeze the accepted terminal value; duplicate hooks and later refreshes do not extend it. Native single-turn duration is recorded independently and never calibrates task clocks. Events without reliable ownership do not attach to a newer task. `prompt-timer` in old configuration or commands is an alias of `task-timer`, not an extra catalog item.

| Time metric | Meaning and source |
| --- | --- |
| Task total time | `task-timer`: earliest trusted submission to confirmed completion, failure or interruption, including queueing, waits, agents and wrap-up |
| Task execution time | `task-active-timer`: accumulated time after execution starts, excluding verified user waits; shown only with complete native coverage |
| Native turn duration | Transcript `turn_duration.durationMs` or an attributed native completion report; recorded separately and cannot replace task total time |
| Session runtime | `cost.total_duration_ms`; cumulative time the CLI session runs, excluding time between runs/resumes |
| API wait time | `cost.total_api_duration_ms`; cumulative waiting for API responses, shown by the independent `api-duration` item |

See the [official status-line fields](https://code.claude.com/docs/en/statusline) for session and API definitions. Execution time defaults unselected and requires native timing on Claude Code 2.1.289+. Incomplete coverage, unknown wait boundaries, stale state or abnormal clocks hide it instead of assuming zero waiting. See [enabling task clocks](../USER_GUIDE.md#task-total-and-execution-time) and the [timing contract](../development/timer.md).

Background-agent reports can have different host prompt IDs; explicit ownership retains the original human task. Local shortcuts such as `/statusline-config show` do not start a new timed task. Hiding `tokens` still permits task timing.

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
| `model` | Off | Independent task model identifier |
| `effort` | Off | Explicit task effort or numeric budget; 2.1.214+ |
| `context-tokens` | Off | Task token count versus context capacity |
| `context-window-size` | Off | Context capacity for the task model |

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
  "schema_version": 5,
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
    "task-timer"
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
    ],
    "item_options": {},
    "visibility": "all",
    "hide_completed": false,
    "row_limit": null,
    "task_max_width": null
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
  "item_options": {},
  "layout": {
    "mode": "auto",
    "rows": []
  },
  "metrics": {
    "branch_diff_base_ref": null
  }
}
```

This is strict JSON: comments, trailing commas, unknown or missing fields, unknown items, and duplicates are rejected. Use configuration commands rather than editing it manually.

The ten items above form the default enabled set. The other 50 main items enter `items` only after explicit selection in CLI, wizard, or an editor.

Updates back up the previous contents and protect writes with atomic replacement and file locks. See [backups and rollback](../USER_GUIDE.md#backups-and-rollback) and [configuration writes and concurrency](../development/README.md#configuration-writes-and-concurrency).

The current source display schema is v5. Historical v1/v2/v3/v4 are readable and are backed up and written as v5 on the first actual configuration save. See [version compatibility](../USER_GUIDE.md#version-compatibility) for conversion and downgrade recovery.

If display configuration is corrupted:

- Both renderers silently fall back to built-in defaults to protect the Claude Code interface.
- `config show`, normal configuration writes, and `doctor` report an explicit error.
- `config reset` removes the corrupted configuration and restores defaults.

`items: []` is valid and suppresses main-line content; even scope labels set to `always` do not create an otherwise empty main line. `subagents.items: []` is also valid and returns empty content for each valid subtask.

<a id="实验功能偏好"></a>

<a id="experimental-feature-preferences"></a>

### Editor enablement preferences

Both independent files use schema v1:

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

`<CLAUDE_CONFIG_DIR>/claude-statusline-runtime.json` uses its own schema v2:

```json
{"schema_version": 2, "native_timing": true, "live_metrics": false}
```

A missing file defaults to native timing on and advanced metrics off. `install --native-timing` / `install --no-native-timing` controls timing independently; `--live-metrics` enables complete collection and `--no-live-metrics` retains the legacy all-off choice. An explicit timing flag overrides the timing part. Reinstall preserves saved preferences; unsupported hosts retain them but suspend collection. [Enabling collection and display](../USER_GUIDE.md#opt-in-live-state).

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

<a id="退出码"></a>

## Exit codes

Management commands follow these conventions:

- `0`: success; `doctor` found no ERROR.
- `1`: `doctor` found at least one ERROR; an uncaught CLI error can also exit 1, including the protected-export limitation above.
- `2`: argument parsing or handled configuration, ownership, or installation validation failed.
- `130`: interactive TUI received Ctrl+C/SIGINT; the terminal is restored and configuration is not saved.
- `128 + signal`: interactive TUI received a termination signal available on the current platform; the terminal is restored and configuration is not saved.

Frequent internal commands `render`, `render-subagents`, `hook`, and `slash-hook` silently tolerate corrupted or unrelated input to avoid blocking Claude Code with their own errors.
