# Timer metrics and lifecycle evidence

**English** | [简体中文](timer.zh-CN.md)

`prompt-timer` measures a user task. A task that has used subagents includes submission/queuing, all agent work and main-agent wrap-up. It completes only on the final main `Stop`; failure and interruption provide their own terminal evidence. No timeout fabricates completion.

## Separate metrics

| Metric | Source | Role in v1.1.1 |
| --- | --- | --- |
| Task elapsed | Earliest trusted submit and accepted ending clocks | Frozen result for multi-agent tasks, failures and interruptions |
| Native turn duration | Transcript `turn_duration.durationMs` | One eligible calibration for an ordinary successful single turn |
| Session runtime | `cost.total_duration_ms` | Duration in the existing compound `cost` item |
| Cumulative API wait | `cost.total_api_duration_ms` | Defined separately; not displayed by `cost` |

Session runtime accumulates across resumes and excludes periods when the session is not running; API wait is the time spent waiting for API responses. See the [official status-line fields](https://code.claude.com/docs/en/statusline).

## Evidence priority

| Priority | Evidence |
| --- | --- |
| 100 | `StopFailure` |
| 95 | Chronologically matched transcript interruption or running-session `SessionEnd` |
| 90 | Final main `Stop` |
| 60 | Reliably attributed ordinary native duration |
| 50 | Local command exclusion |
| 40 / 30 | Process-verified registry completion / withdrawal |
| 20 / 10 | Resume/startup unknown ending / replacement by a new prompt |

Ownership and eligibility are checked before changing any terminal fields. Weaker evidence cannot change status, duration or errors; repeated equal-priority endings are idempotent. Interruption can replace an earlier weak inferred completion when its timestamp falls within that task. A final failure can supersede weaker success evidence.

Native calibration is a narrow exception for a successful task without subagent history. It changes the duration once while retaining the final Stop timestamp. It never calibrates a failed, interrupted or agent-backed task. An old successful record already containing a duration is treated as previously calibrated when upgrading.

## Subagent phases and frozen clocks

A main Stop with in-flight ordinary agents enters `waiting_subagents`; the final subagent stop enters `resuming_main`. Genuine main-assistant activity can return the phase to `main`, but the persistent `had_subagents` flag still blocks duration, idle and withdrawal inference. `SubagentStop` also establishes agent history when its start hook was missing. Orphan/internal events do not create a new main task.

A late agent start may reopen only native/registry inferred completion, clearing its calibration. It cannot reopen a strong main Stop, failure or interruption. A Stop snapshot can reconcile missing or duplicate agent hooks. Claude Code can issue a new `UserPromptSubmit` ID for a structured agent-result notification. Known agent IDs associate those host IDs with the original human task; pending reports prevent the first notification's Stop from ending the task before the remaining report and wrap-up. A verified, previously undelivered report can continue an apparent Stop, while duplicate reports, failure and interruption stay frozen. Shell/server/monitor/workflow tasks are excluded.

Before accepting an ending, resolve the matching real user submission from the already-written transcript once. Strong frozen starts are not revised by later transcript scans. When accepting an ending, freeze elapsed nanoseconds using matching suspend-aware start/end clocks, otherwise wall clocks. Refreshing after reboot does not reinterpret the frozen value. Unknown endings remain marked as a lower bound. Old shortened multi-agent or interrupted durations are reconstructed from persisted start/end evidence.

## Prompt ownership

Hook IDs identify their main prompt. The incremental transcript parser retains its last confirmed real prompt independently of the current hook prompt, so an early queued hook cannot steal an older duration. Explicit observation IDs take precedence. Full scans reset parsing context; replaying an older prompt does not replace a newer current task. Local commands never become the timed task.

Without an ID or trustworthy transcript context, duration observations are not assigned to the current prompt. The internal reducer retains a single-record fallback for older direct callers; real parsed records explicitly carry absent ownership to disable that fallback. Subagent events without prompt IDs require existing ownership or a single unambiguous task.

Timing scan version 5 refreshes old transcript metadata. Display schema v2, feature schema v1, runtime mirror schema 1 and lifecycle schema 3 remain compatible; `duration_source`, known `agent_ids`, `prompt_aliases` and `pending_agent_reports` are optional metadata. Agent history and continuation IDs are bounded to 256 per task.

## Regression example

Submit at second 1, start an agent at 2, main Stop at 3, agent Stop at 4 and final main Stop at 9. Both before and after a later `durationMs=1000`, the task remains `✓ 0m 08s`. Tests cover main resumption, parallel/duplicate hooks, queued prompts, local commands, interruption/failure ordering, finite duration validation and clock reboot fallback.

For real-session evidence and its visual boundaries, see [testing](testing.md). User-facing markers are documented in the [user guide](../USER_GUIDE.md#prompt-timing-markers).
