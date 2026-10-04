# Display items and metric definitions

**English** | [简体中文](DISPLAY_ITEMS.zh-CN.md)

The current source catalog contains 48 main and 14 subagent items. The independent
items below are opt-in. Existing defaults and compound IDs remain available,
and compounds may be selected alongside their individual components in any order.
See the [user guide](USER_GUIDE.md) for the original items and all configuration entry points.

## Main items

| ID | Example | Definition and source |
| --- | --- | --- |
| `model` | `claude-opus` | `model.id`, falling back to `model.display_name`. |
| `effort` | `high` | Live `effort.level`; no value when unsupported or absent. |
| `context-tokens` | `Context 54K / 200K` | Current input plus cache creation/read tokens from `context_window.current_usage`, divided by window capacity. Output tokens are excluded. If the component object is absent, use the official `total_input_tokens`; an explicit null after compaction remains unavailable. |
| `five-hour-reset` | `5h reset 2h 13m` | Countdown from `rate_limits.five_hour.resets_at`. |
| `weekly-reset` | `weekly reset 6d 2h` | Countdown from `rate_limits.seven_day.resets_at`. |
| `session-cost` | `Cost $0.12` | Official cumulative `cost.total_cost_usd`. |
| `session-duration` | `Session 12m 30s` | Official `cost.total_duration_ms`, the cumulative session runtime. |
| `api-duration` | `API 1m 15s` | Official `cost.total_api_duration_ms`, the cumulative API request duration. |
| `lines-changed` | `+156/-23` | `cost.total_lines_added` and `cost.total_lines_removed`; both must be observed. This is Claude's session edit accounting, not Git file counts. |
| `cache-state` | `Cache warm` | Official main-conversation `prompt_cache.warm`, `caching_observed` and `expires_at`: warm only before expiry; cold after expiry; unobserved caching is distinct. |
| `cache-expires` | `Cache TTL 4m 20s` | Remaining TTL only while the observed main cache is warm. Requires a valid future `expires_at`. |
| `cache-misses` | `Cache miss 2` | Official `prompt_cache.misses`, excluding `expected_rebuilds` after compaction or clearing. |
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

## Subagent items

| ID | Example | Definition and source |
| --- | --- | --- |
| `model` | `sonnet-5` | Resolved `tasks.model`, using the existing agent format without the `claude-` prefix. |
| `effort` | `high` or `16000` | Explicit configured `tasks.effort`, including numeric budgets. Absent when inherited; unsupported configured levels may differ from effective effort. Requires Claude Code 2.1.214+. |
| `context-tokens` | `Context 84K / 200K` | `tasks.tokenCount` versus `tasks.contextWindowSize`. |
| `context-window-size` | `200K window` | Resolved `tasks.contextWindowSize`. |

Subagent rows and the context fields require 2.1.205+. Each item uses its task's
data; main-session values do not fill missing agent fields. Existing agent
`tokens` means context occupancy, not cumulative API consumption.

## Clocks, availability and scope

Gateway dollar/period fields require both Claude Code and gateway 2.1.284+. They can be absent, including when nonessential traffic is disabled. Amounts are estimates collected separately, potentially about five minutes behind percentage updates; never derive one from the other. Expired windows hide all their fields.

Cumulative input/output use the existing cost-state snapshot plus transcript deltas, message-ID deduplication and main/nested-agent scope. They sum integers before abbreviation; current-context fields are not cumulative counters. No valid recorded usage means unavailable; an observed all-zero response shows zero. The formatted collector interface remains unchanged; raw snapshots require no additional I/O.

Input and output availability are independent: an output-only observation does not imply zero input. Partial cumulative snapshots retain the other counter's known total and apply each counter's subsequent main/subagent delta from its own snapshot. Older cached sessions recover availability once from available transcripts without recounting message IDs.

Cache fields require Claude Code 2.1.251+. Cache warmth reports local TTL, not a guarantee of the next server cache hit; request/miss statistics cover only the main conversation. Detailed miss causes remain a later extension. Git components and the compound reuse one cached collector result per refresh.

- Reset timestamps are Unix epoch **seconds**. A refresh captures one clock for
  all countdowns. Future fractions round up to a second; displays use seconds,
  minutes/seconds, hours/minutes or days/hours. At expiry the old allowance and
  its countdown disappear. Legacy percentage payloads without timestamps remain readable.
- Countdown updates follow the host's existing refresh interval. `event` refresh
  updates on events rather than continuously; enabling an item does not change that setting.
- Missing, malformed, negative and non-finite values are unavailable, not zero.
  Observed zero cost, duration or line counts render explicitly. New token counts
  require nonnegative integers and window capacities must be positive.
- `prompt-timer` measures the latest human task, including agents and final
  wrap-up. Session runtime and cumulative API duration are separate official
  quantities; adding these items does not alter the timer reducer.
- Text is sanitized before terminal rendering. Existing palettes, separators,
  scope labels and width handling apply to the new items and deterministic previews.

Definitions follow the [official Claude Code statusline fields](https://code.claude.com/docs/en/statusline).
Independent and compound model selections also follow the useful selection pattern
documented in [Codex's status-line picker](https://learn.chatgpt.com/docs/developer-commands?surface=cli#configure-footer-items-with-statusline).

## Configuration and downgrade

For example, replace the main selection with independent metrics:

```text
claude-statusline config set-items model effort current-dir context-tokens five-hour-reset session-cost api-duration prompt-timer
```

The shared catalog is returned by CLI listings and JSON `describe`. Both TUI
editors and the installed wizard consume it. Display schema v2 and JSON protocol
v1 are unchanged; minimum-version metadata describes verified boundaries, not
whether live data has arrived. Unverified field minima remain unknown.

Older packages do not recognize newly selected IDs even though the schema is
unchanged. Before downgrading, use the newer package to remove new IDs from both
scopes or restore a compatible configuration backup. Follow the existing
[native integration downgrade procedure](USER_GUIDE.md#upgrading) separately.
