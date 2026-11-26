# Task clocks and lifecycle evidence

**English** | [简体中文](timer.zh-CN.md)

The [v3.1.3 repair record](history/migration/post-migration-fixes.md) documents the original changes to timing provenance, exact replay deduplication and cache compatibility.

`task-timer` measures the latest human task from its earliest trusted submission through queueing, agent work and main-agent wrap-up. `prompt-timer` remains an input alias. `task-active-timer` is optional and measures execution after it starts, excluding verified user waits. Native turn duration, session runtime and cumulative API duration are separate quantities.

## Structure

`packages/core/src/timing` contains the pure, persistent TypeScript elapsed clock. Its accumulated-time, pause and resume design follows [Codex StatusTimer](https://github.com/openai/codex/blob/823ea830c0fd418b09ff02d36cad9a1fff66465b/codex-rs/tui/src/status_indicator_widget/timer.rs), adding boot-domain samples and overlapping wait identities.

`packages/core/src/runtime/tasks` owns pure task identity, transitions, native adaptation and metric views. `packages/cli/src/runtime/tasks` coordinates submission indexing and atomic storage through platform adapters. Collection/reconciliation precedes formatting; preview uses fixed snapshots without runtime I/O. Python module aliases belong to the [frozen archive](../../archive/python/README.md).

A main-session human transcript row can link its `promptId` and message `uuid` even when the host skips classic and telemetry hooks. Apply that link before processing activity or endings. The same task keeps its earliest trusted running start and its accepted terminal duration. Ambiguous pairs, configuration prompts and background reports retain their own identities.

## Completion

A classic `Stop` is an attempted ending. Without further confirmation it shows `? <elapsed>+`, the known lower bound. Verified continuation clears that candidate without resetting the submission clock. Duplicate attempts without new activity remain idempotent.

A matched main `turn.complete` confirms a turn, not necessarily the whole task. Reconcile active work and expected reports by agent identity; an inline agent's stop does not create a report requirement. A fresh authoritative snapshot can retire entries supported only by an older snapshot. It does not clear a report owed by a corroborated background agent.

Read delivered notifications from the classic hook and attributed transcript user rows. Also recognize queued-command attachments, which can settle a report without proving that the main agent resumed. Never take report evidence from API request bodies. A notification does not become a local command when its owner is missing or ambiguous; wait for an explicit binding or a unique owner.

A first attributable delivery or newer bound main activity can resume the same human task without resetting its start. An enqueue, duplicate delivery, delayed child start, or a bare `Stop` cannot reopen a completed task. Scope implicit ending evidence to the observed execution context, not the newest queued submission.

A correctly attributed transcript ending or process-verified idle registry can finish a task without a `Stop`. An old idle stamp cannot end newer work. The blocked `/statusline-configure` expansion explicitly hides its own clock when the editor exits; it does not end the previous human task or depend on registry availability. Epoch gaps, old epochs and ambiguous identities remain incomplete. No timeout or expired heartbeat fabricates completion.

Failures and user interruptions freeze the accepted result. A native ending demonstrably recorded before a subsequent session exit can correct a session-exit inference; a late batch must not turn a normally completed print-mode run into an interruption. Strong failure evidence still wins over a success claim.

## Independent clock values

Task elapsed uses matching suspend-aware start/end samples when available, otherwise validated wall time. Linux uses `CLOCK_BOOTTIME` and the boot ID; macOS uses continuous time and a boot-session UUID; Windows uses uptime and a boot GUID rather than a wall-derived boot minute. Clock/API failure degrades availability. Frozen values do not change after a reboot or refresh.

The native turn's reported `durationMs` is recorded independently and never calibrates task elapsed. In particular, an 8-second task stays 8 seconds when a 1.5-second native turn arrives.

Execution time uses its own accumulated/resume clock. Parallel work is not added twice. Main-agent waiting while an agent executes remains execution time. Waiting requests have independent identities so overlapping waits cannot resume early. The current host does not expose precise permission/question/MCP wait boundaries in every case; such tasks hide the execution metric and report `wait_coverage_missing`. Parallel wait/dependency coverage that cannot be proved reports `incomplete`. Missing data is never treated as zero user wait.

## Persistence and compatibility

The lifecycle scan advances its own complete-line cursor after the task-store update. Enabling live items alone uses this cursor for the main transcript. A one-time backfill links older task records and preserves settled durations. When only the old task ledger is available, a task superseded by a newer prompt can yield the timer display to a newer verified current task. Selection leaves both stored records intact.

The storage location and schema-1 mirror remain unchanged. Lifecycle v4 reads v2/v3; old frozen values remain recorded history rather than being reinterpreted into a new metric. Missing execution evidence stays unavailable. Reads and previews do not migrate files; writes occur under the session lock and atomically publish normalized state.

Submission evidence is indexed by transcript identity and complete-line cursor, retaining a bounded set of prompt IDs. Append-only refreshes read the new tail; unchanged files do not trigger a full scan. Truncation/rewrite invalidates the index. A verified submission is reused by ending hooks, and strong frozen starts are not rewritten by later transcript replay.

`diagnose` reports the matched task's phase, active and pending counts, wait reason and last ending evidence. It includes the last process-verified registry observation when one was retained. Diagnosis never scans a transcript, rechecks a process, or changes the task store.

See [runtime contracts](live.md), [testing](testing.md) and [user-facing timer markers](../reference/cli.md#prompt-timer-markers).
