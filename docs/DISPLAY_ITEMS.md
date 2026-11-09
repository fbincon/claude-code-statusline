# Display items and metric definitions

**English** | [简体中文](DISPLAY_ITEMS.zh-CN.md)

Current timing provenance, transcript replacement, exact replay deduplication and legacy-cache availability are documented in [post-migration repairs](development/history/migration/post-migration-fixes.md).

The catalog contains 65 main metrics and 15 subagent metrics. The tables list defaults and common definitions. Use `config list-items --json` and `config subagents list-items --json` for all IDs. `prompt-timer` is a compatibility alias for `task-timer`. Main compounds can coexist with independent items. Subagent `status-elapsed` excludes `status` and `elapsed`. [Configure display items](USER_GUIDE.md#configurable-display-items)

Examples below use English output. `statusline-language=zh-CN` localizes built-in phrases and known values without changing metric definitions, IDs, raw observations, numbers or technical units. User text and unknown values remain intact. See [output language](USER_GUIDE.md#statusline-language).

## Main items

### Default main items

Enabled in the order shown. Remaining limits are calculated from the host's `used_percentage`. Available windows depend on the host, account and current payload.

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
| `task-timer` | Elapsed time and outcome of the latest human task, including queueing, user waits, owned agents and wrap-up | Omitted until a task can be identified |

### Common optional main items

These items are optional. Select `context-used` and `context-remaining` independently. Adjacent context items follow the configured order and use internal dots. Cost display uses the value supplied by the host. Consult the provider's billing record for actual charges.

| ID | Display | Behavior when data is unavailable |
| --- | --- | --- |
| `version` | Claude Code version, such as `v2.1.258` | Omitted without a version |
| `session` | Session name or the first eight characters of `session_id` | Omitted when both values are unavailable |
| `cost` | Session cost, runtime and line changes, for example `Total $0.12 · 12m 30s · +156/-23` | Omitted unless `cost.total_cost_usd` is finite. An observed zero amount displays as zero. The duration appears when positive and the line counts appear when at least one is nonzero. |
| `prompt-cache` | Main-conversation cache hit ratio and written tokens. Requires Claude Code 2.1.251+. | The ratio must be in 0–1 and the write count is shown when nonzero. The item is omitted when neither value can be shown. |
| `fast-mode` | `fast` when fast mode is enabled | Omitted when disabled |
| `agent` | Agent name in a `--agent` session, such as `Agent orchestrator` | Omitted without the agent field |
| `vim-mode` | Current mode when vim mode is enabled, such as `vim NORMAL` | Omitted without the vim field |
| `thinking` | `thinking` when extended thinking is enabled | Omitted when disabled |
| `pr` | Host `pr.number` and optional `pr.review_state`. A GitLab merge request appears as `MR !1234`. | Omitted without a valid number |
| `repo` | Host `workspace.repo.owner` and `workspace.repo.name`, for example `Repo acme/widget` | Omitted when either field is missing |

| ID | Display | Source | Behavior when data is unavailable |
| --- | --- | --- | --- |
| `context-used` | `Context N% used`, rounded with `round()` | `context_window.used_percentage` in Claude's official status-line payload | Omitted for missing, boolean, nonnumeric, nonfinite, or out-of-range values outside `0–100` |
| `project-name` | `Project NAME` | Final directory component of Claude's launch directory `workspace.project_dir`, using platform path semantics; string processing only, without filesystem access | Omitted for invalid, empty, sanitized-empty, or root-directory values; no fallback to `workspace.repo.name` or `current-dir` |
| `hostname` | `Host NAME` | Local Node `os.hostname()`; provided by the local runtime | Omitted if the local hostname lookup fails or returns an empty result after removing newlines, control characters, and ANSI injection; no external commands or network access |

### Independent and live main items

| ID | Example | Definition and source |
| --- | --- | --- |
| `task-active-timer` | `Active 1m 30s` | Optional execution time; hidden when native user-wait coverage is incomplete. |
| `model` | `claude-opus` | `model.id`, falling back to `model.display_name`. |
| `effort` | `high` | Live `effort.level`; no value when unsupported or absent. |
| `context-tokens` | `Context 54K / 200K` | Current input plus cache creation/read tokens from `context_window.current_usage`, divided by window capacity. Output tokens are excluded. If the component object is absent, use the official `total_input_tokens`; an explicit null after compaction remains unavailable. |
| `five-hour-reset` | `5h reset 2h 13m` | Countdown from `rate_limits.five_hour.resets_at`. |
| `weekly-reset` | `weekly reset 6d 2h` | Countdown from `rate_limits.seven_day.resets_at`. |
| `session-cost-rate` | `Rate ~$0.58/h (session)` | Derived hourly estimate from official cost and selected session/API time; details below. |
| `session-cost` | `Cost $0.12` | Official cumulative `cost.total_cost_usd`. |
| `session-duration` | `Session 12m 30s` | Official `cost.total_duration_ms`, the cumulative session runtime. |
| `api-duration` | `API 1m 15s` | Official `cost.total_api_duration_ms`, the cumulative API request duration. |
| `lines-changed` | `+156/-23` | `cost.total_lines_added` and `cost.total_lines_removed`; both must be observed. This is Claude's session edit accounting, not Git file counts. |
| `cache-state` | `Cache warm` | Official main-conversation `prompt_cache.warm`, `caching_observed` and `expires_at`: warm only before expiry; cold after expiry; unobserved caching is distinct. |
| `cache-expires` | `Cache TTL 4m 20s` | Remaining TTL only while the observed main cache is warm. Requires a valid future `expires_at`. |
| `cache-misses` | `Cache miss 2` | Official `prompt_cache.misses`, excluding `expected_rebuilds` after compaction or clearing. |
| `cache-miss-reason` | `Cache cause? tools changed` | Off by default. Host-reported likely causes of the latest main-conversation miss, from `prompt_cache.last_miss_cause.causes`; requires 2.1.260+. Unknown codes remain readable. Counts and timing are in [diagnosis](DIAGNOSTICS.md). |
| `worktree` | `Git worktree feature-x` | Prefers `worktree.name` for Claude worktree sessions; otherwise `workspace.git_worktree` identifies the current linked Git worktree. |
| `api-requests` | `API requests 14` | Official main-conversation `prompt_cache.requests`; excludes subagent calls. |
| `session-name` | `Session demo-session` | Observed `session_name`, without an ID fallback. |
| `session-id` | `ID demo-session` | Full observed `session_id`. |
| `session-id-short` | `ID demo-ses` | First eight characters of `session_id`. Existing `session` still prefers the name, otherwise the short ID. |
| `output-style` | `Style Default` | Official `output_style.name`. |
| `git-branch` | `Git main` | Existing local Git branch collection, including `HEAD@<hash>` while detached. |
| `git-changes` | `Git ~2 ?1` | Staged, unstaged, conflicted and untracked file counts; a known clean worktree shows `Git clean`. |
| `git-ahead-behind` | `Git ↑1 ↓0` | Difference from configured upstream; synchronized upstream shows zeros, missing upstream hides the item and removed upstream shows `[gone]`. |
| `spend-amount` | `Spend $31.50 / $350.00` | Optional estimated gateway `used_usd` / `limit_usd`; both must be available. |
| `spend-period` | `Spend monthly` | Optional gateway `period`: daily, weekly or monthly. |
| `input-tokens` | `in 1.29M` | Recorded cumulative uncached input + cache writes + cache reads, using raw integers from the same main/subagent session statistics as `tokens`. |
| `output-tokens` | `out 22.4K` | Recorded cumulative output from the same all-session statistics. |
| `run-state` | `State waiting agents` | Verified main execution, agent wait, wrap-up and terminal state of the user task. Reliable lifecycle evidence wins; expired or ambiguous sources render `—`. |
| `permission-mode` | `Mode plan*` | Actual event mode. Hook snapshots are marked `*` as recent observations and expire after 15 seconds; settings defaults are never treated as live mode. |
| `active-agents` | `Agents 2` | Verified active agents owned by this task, nested agents included and IDs deduplicated. Excludes background shells/servers/workflows. Uncertain ownership marks the known subtotal `*`. |
| `task-progress` | `Tasks 3/5` | Completed/total entries from successful structured Task/Todo operations; complete snapshots win. This is not elapsed-task percentage. Partial coverage is marked `*`. |
| `last-tool` | `Tool Read success` | Most recently started main-thread tool and its observed success, error, denial or interruption. |
| `branch-diff` | `Diff 3 files +42/-7` | Committed files/additions/deletions from `merge-base(base, HEAD)` to HEAD; binary files only increment files. Auto base: origin/HEAD, local main, then master. No fetch; 2-second total timeout and cache by repository/HEAD/base commit. |
| `ttft` | `TTFT(host) 0.420s` | Latest main request: host observation from entry into turn.step to the first real text/thinking/tool block. Missing or synthetic streams and invalid clocks remain unavailable. |
| `output-rate` | `Rate 36.5 tok/s` | Official output tokens / complete observed latest main request duration, including first-content wait. This is not a generation-only rate. |
| `prompt-input-tokens` | `Prompt in 48K*` | Raw uncached input + cache creation + cache read from deduplicated requests owned by the human task, including verified nested agents and main wrap-up. |
| `prompt-output-tokens` | `Prompt out 2K*` | Deduplicated official output tokens of that same task. Turn totals are reconciliation evidence, not additional requests. |
| `prompt-cost` | `Prompt cost $0.0123*` | Attributed official api_request estimates only. Exporters are never enabled or redirected. Missing cost is unavailable; an unjoined official subtotal is marked partial. |

## Subagent items

Subagent rows require Claude Code 2.1.205+. Each field uses the current task's data. Bound external values are described below.

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
| `model` | Off | Resolved `tasks.model`, using the existing agent format without the `claude-` prefix. |
| `effort` | Off | Explicit configured `tasks.effort`, including numeric budgets. Absent when inherited; unsupported configured levels may differ from effective effort. Requires Claude Code 2.1.214+. |
| `context-tokens` | Off | `tasks.tokenCount` versus `tasks.contextWindowSize`. |
| `context-window-size` | Off | Resolved `tasks.contextWindowSize`. |

## Git markers

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
| `Git!` | Worktree status unavailable, for example when Git is missing, times out, returns unparseable output or is blocked by collection policy |

A clean repository synchronized with upstream shows only its branch name. Detached HEAD appears as `HEAD@` followed by a 7-character commit ID.

The `git` compound and `git-branch`, `git-changes` and `git-ahead-behind` share a worktree observation. `branch-diff` queries committed branch differences separately. Inspect `doctor` for the filter-policy result when collection is blocked. [Git collection policy](DIAGNOSTICS.md#git-collection-policy)

## Token fields

`tokens` breaks cumulative API usage in the [session scope](#display-scopes) into three counts.

- `hit`: cache read input tokens.
- `miss`: ordinary input tokens plus cache creation input tokens.
- `out`: output tokens.

Counts use compact notation, such as `950`, `12.4K`, or `1.05M`. Separate items show context occupancy and rate-limit usage.

The host payload's `prompt-cache` hit ratio and write count describe the main conversation.

<a id="display-scopes"></a>

## Main, session and subagent scope

A default subagent row looks like this.

```text
⏱ 1m 18s · Explore · sonnet-5/high · Context 58% left · searching auth flow
```

| Scope | Data shown |
| --- | --- |
| Main line | The global bottom line keeps the main session scope. With `scope-labels=when-subagents`, it displays a scope label such as `Main/Session` or `主会话` after the task is observed to have launched subagents. |
| Session usage | Main-line `tokens` reports cumulative API usage for the session, including discoverable main and subagent transcripts. |
| Individual subagent | Host fields come from the corresponding task in `tasks[]`. The row's `tokens` uses that task's `tokenCount` and describes its current context occupancy. |

When you view a subagent transcript, the host payload omits `focused_agent` and `viewing_task_id`. Rendering uses the supplied session and task identities. See [subagent items](#subagent-items) for field defaults and [ended agents](#branch-base-and-ended-agents) for frozen durations.

<a id="timer-definitions"></a>

## Task clocks and markers

`task-timer` is enabled by default and shows the latest human task’s total time and outcome. These markers describe the available states.

| Marker | Meaning |
| --- | --- |
| `⏱` | Task is running; time continues increasing |
| `✓` | Task completion is reliably confirmed |
| `■` | Task was interrupted or the session ended |
| `✗` | Claude Code reported execution failure |
| `? <elapsed>+` | A Stop candidate is unconfirmed or historical ending evidence is incomplete; shows the known elapsed lower bound |

The examples include two running phases for owned agents and main-agent wrap-up.

```text
⏱ 4m 12s
⏳ 2 agents · 4m 12s
⏳ main wrap-up · 4m 12s
? 4m 35s+
✓ 4m 35s
```

`task-timer` starts at the earliest trusted user submission and includes queueing, user waits, owned agents, required reports and main-agent wrap-up. A classic `Stop` is an ending candidate; verified continuation clears it without resetting the clock. Completion needs an attributed native ending or verified transcript/process-idle evidence, plus resolved agents, reports and wrap-up. No timeout or expired heartbeat fabricates completion. Background shell, server, monitor, workflow and agent-team ledgers do not block completion.

Reliable failures and user interruptions freeze the accepted terminal value; duplicate hooks and later refreshes do not extend it. Native single-turn duration is recorded independently and never calibrates task clocks. Events without reliable ownership do not attach to a newer task. Configuration commands and imports accept the `prompt-timer` alias, and saved configuration uses `task-timer`.

| Time metric | Meaning and source |
| --- | --- |
| Task total time | `task-timer`: earliest trusted submission to confirmed completion, failure or interruption, including queueing, waits, agents and wrap-up |
| Task execution time | `task-active-timer` accumulates time after execution starts. It excludes verified user waits and counts overlapping work once. |
| Native turn duration | Transcript `turn_duration.durationMs` or an attributed native completion report; recorded separately and cannot replace task total time |
| Session runtime | `cost.total_duration_ms`; cumulative time the CLI session runs, excluding time between runs/resumes |
| API wait time | `cost.total_api_duration_ms`; cumulative waiting for API responses, shown by the independent `api-duration` item |

`task-active-timer` starts unselected and requires Claude Code 2.1.289 or later with native timing enabled. New installations default to native timing off. Reinstalling respects saved choices, and advanced live metrics are independent. See [enabling task clocks](USER_GUIDE.md#task-total-and-execution-time).

Execution time is omitted when task or wait observations are incomplete, wait boundaries are unknown, the state is stale or the clock is untrusted. See the [timing contract](development/timer.md) and the [official session and API fields](https://code.claude.com/docs/en/statusline).

Background-agent reports can have different host prompt IDs; explicit ownership retains the original human task. Local shortcuts such as `/statusline-config show` do not start a new timed task. Hiding `tokens` still permits task timing.

## Clocks, availability and scope

Gateway dollar/period fields require both Claude Code and gateway 2.1.284+. They can be absent, including when nonessential traffic is disabled. Amounts are estimates collected separately, potentially about five minutes behind percentage updates; never derive one from the other. Expired windows hide all their fields.

Cumulative input/output use the existing cost-state snapshot plus transcript deltas, message-ID deduplication and main/nested-agent scope. They sum integers before abbreviation; current-context fields are not cumulative counters. No valid recorded usage means unavailable; an observed all-zero response shows zero. The formatted collector interface remains unchanged; raw snapshots require no additional I/O.

Input and output availability are independent: an output-only observation does not imply zero input. Partial cumulative snapshots retain the other counter's known total and apply each counter's subsequent main/subagent delta from its own snapshot. Older cached sessions recover availability once from available transcripts without recounting message IDs.

Main-conversation cache statistics include requests and misses. Cache warmth describes the local TTL observation. The server determines whether the next request hits. Hosts from 2.1.260 can provide detailed miss reasons.

- Reset timestamps are Unix epoch **seconds**. A refresh captures one clock for
  all countdowns. Future fractions round up to a second; displays use seconds,
  minutes/seconds, hours/minutes or days/hours. At expiry the old allowance and
  its countdown disappear. Legacy percentage payloads without timestamps remain readable.
- Countdown updates follow the host's existing refresh interval. `event` refresh
  updates on events rather than continuously; enabling an item does not change that setting.
- Missing, malformed, negative and non-finite values are unavailable, not zero.
  Observed zero cost, duration or line counts render explicitly. New token counts
  require nonnegative integers and window capacities must be positive.
- Text is sanitized before terminal rendering. Existing palettes, separators,
  scope labels and width handling apply to the new items and deterministic previews.

Definitions follow the [official Claude Code statusline fields](https://code.claude.com/docs/en/statusline).
Independent and compound model selections also follow the useful selection pattern
documented in [Codex's status-line picker](https://learn.chatgpt.com/docs/developer-commands?surface=cli#configure-footer-items-with-statusline).

## Configuration and downgrade

For example, replace the main selection with independent metrics:

```text
claude-statusline config set-items model effort current-dir context-tokens five-hour-reset session-cost api-duration task-timer
```

CLI listings and JSON `describe` return the shared catalog. Minimum-version metadata records verified host boundaries. Field availability also depends on the payload. Before downgrading, check the target package's item and format support and prepare a compatible backup. [Configuration formats](reference/cli.md#configuration-files) · [Version compatibility](USER_GUIDE.md#version-compatibility)

## Live state items

The five Phase 5 items default unselected. Collection uses the independent `install --live-metrics` switch on verified Claude Code 2.1.289 hosts. Missing observations render `—`, observed zero renders `0`, and partial coverage adds `*`. Runtime `read` returns source, time and specific reasons. Queued prompts, old epochs and agent events do not overwrite a new main task; terminal history is retained separately from heartbeat freshness. Previews use deterministic fixtures without live I/O. See [runtime contracts](development/live.md).

## Branch base and ended agents

Use `config set branch-diff-base auto` or `config set branch-diff-base REF`. Both editors expose the same nullable Metrics field. Missing refs or merge-bases, unavailable shallow history and timeouts display `Diff —`.

Running subagent elapsed values grow. Completed/failed/killed rows freeze at reliable native or existing lifecycle-hook end evidence; if it is absent, retain the status marker without an invented duration. End history works with live collection disabled. Task timing uses the lifecycle evidence described in [timer contracts](development/timer.md).

## Request coverage and SDK fallback

All request items default unselected. Missing observations render `—`; exact zero remains visible and incomplete task coverage adds `*`. A native ref-bearing content block supplies TTFT. Successful requests require official stop usage; synthesized chunks without engine references cannot supply counters. Running totals are partial until completion, sequence coverage and each turn reconciliation agree.

Claude Code 2.1.289 headless paths may omit prompt identity events. Only one completed existing lifecycle interval containing a main turn start can bind it; overlapping or unfinished windows remain unowned. Spawn identities then resolve nested loops, without writing timer state or matching prompt text. SDK live state may stay unavailable until this evidence arrives. Without existing collector telemetry, prompt-cost remains unavailable; no model-price or session-cost delta fallback is used.

## Composition components

Both scopes also offer `text` (literal user text) and `spacer` (remaining row width).
These two composition types bring the catalog to 67 main and 17 subagent types;
the 65 main and 15 subagent observation types and existing defaults are retained.
Add them with the instance controls or `config instance main add text --text "Project"`.
Main spacers require explicit rows; each main row and subagent template accepts one spacer.

## Optional external components

Register and enable sources locally using the [extensions guide](EXTENSIONS.md). None is selected by default.

| ID | Scope | Meaning |
| --- | --- | --- |
| `external-value` | Main / subagent | Scalar from an explicitly bound JSON or command source, with freshness and failure markers. |
| `github-pr` | Main | Explicitly refreshed GitHub PR; separate from host `pr`. |
| `github-ci` | Main | GitHub check summary; no checks or unknown results do not mean success. |

## Session cost rate

`session-cost-rate` is optional and unselected by default. Choose its **Cost rate denominator** in either editor: session time (default) or cumulative API time. The CLI uses:

```bash
claude-statusline config enable session-cost-rate
claude-statusline config instance main set session-cost-rate cost-rate-basis api
```

For an instance created with Add/Copy, substitute its returned instance ID. Each copy retains its own denominator. The formula is `total_cost_usd / (duration_ms / 3600000)`, using `cost.total_duration_ms` or `cost.total_api_duration_ms`. The chosen duration must be at least 60,000 ms. Missing, negative, nonfinite values, zero duration and shorter windows hide the rate; zero observed cost over sufficient time displays zero. Only the chosen duration is required.

For $2 over one session hour or ten API minutes, the respective estimates are `~$2.00/h (session)` and `~$12.00/h (API)`. The estimate marker and denominator remain in the value when labels are disabled. API time is cumulative request duration, independent of `task-active-timer`. This is a derived session estimate, not an invoice or prediction. It needs no additional collector, price table or network source. Preview uses fixed observations; saves, copies, profiles and portable exports retain the selected basis.
