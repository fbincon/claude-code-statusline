# Task clocks and lifecycle evidence

**English** | [简体中文](timer.zh-CN.md)

`task-timer` measures the latest human task from its earliest trusted submission through queueing, agent work and main-agent wrap-up. `prompt-timer` remains an input alias. `task-active-timer` is optional and measures execution after it starts, excluding verified user waits. Native turn duration, session runtime and cumulative API duration are separate quantities.

## Structure

`runtime/timing` contains a pure, persistent elapsed clock. Its accumulated-time, pause and resume design follows [Codex StatusTimer](https://github.com/openai/codex/blob/823ea830c0fd418b09ff02d36cad9a1fff66465b/codex-rs/tui/src/status_indicator_widget/timer.rs); this project implements the design in Python and adds boot-domain samples and overlapping wait identities.

`runtime/tasks` owns task identity, lifecycle transitions, indexed submission evidence, atomic storage, native adaptation and read-only metric views. `runtime/turns` and the original Python entry points alias the same canonical modules. Collection/reconciliation precedes formatting; preview uses fixed snapshots without runtime I/O.

## Completion

A classic `Stop` is an attempted ending. Without further confirmation it shows `? <elapsed>+`, the known lower bound. Verified continuation clears that candidate without resetting the submission clock. Duplicate attempts without new activity remain idempotent.

A matched main `turn.complete` confirms a turn. A task completes only when its owned agents and required reports are resolved and the main agent has finished wrap-up. Known background-agent notifications retain the original human task through explicit aliases. Human-message UUID aliases and report aliases are tracked separately: ordinary synchronous agents do not require a background notification.

Compatible fallback evidence includes a correctly attributed transcript ending or process-verified idle registry. Unowned native turns never attach to the current task. Epoch sequence gaps, old epochs and ambiguous queued identities remain incomplete. No timeout or expired heartbeat fabricates completion.

Failures and user interruptions freeze the accepted result. A native ending demonstrably recorded before a subsequent session exit can correct a session-exit inference; a late batch must not turn a normally completed print-mode run into an interruption. Strong failure evidence still wins over a success claim.

## Independent clock values

Task elapsed uses matching suspend-aware start/end samples when available, otherwise validated wall time. Linux uses `CLOCK_BOOTTIME` and the boot ID; macOS uses continuous time and a boot-session UUID; Windows uses uptime and a boot GUID rather than a wall-derived boot minute. Clock/API failure degrades availability. Frozen values do not change after a reboot or refresh.

The native turn's reported `durationMs` is recorded independently and never calibrates task elapsed. In particular, an 8-second task stays 8 seconds when a 1.5-second native turn arrives.

Execution time uses its own accumulated/resume clock. Parallel work is not added twice. Main-agent waiting while an agent executes remains execution time. Waiting requests have independent identities so overlapping waits cannot resume early. The current host does not expose precise permission/question/MCP wait boundaries in every case; such tasks hide the execution metric and report `wait_coverage_missing`. Parallel wait/dependency coverage that cannot be proved reports `incomplete`. Missing data is never treated as zero user wait.

## Persistence and compatibility

The storage location and schema-1 mirror remain unchanged. Lifecycle v4 reads v2/v3; old frozen values remain recorded history rather than being reinterpreted into a new metric. Missing execution evidence stays unavailable. Reads and previews do not migrate files; writes occur under the session lock and atomically publish normalized state.

Submission evidence is indexed by transcript identity and complete-line cursor, retaining a bounded set of prompt IDs. Append-only refreshes read the new tail; unchanged files do not trigger a full scan. Truncation/rewrite invalidates the index. A verified submission is reused by ending hooks, and strong frozen starts are not rewritten by later transcript replay.

See [runtime contracts](live.md), [testing](testing.md) and [user-facing timer markers](../reference/cli.md#prompt-timer-markers).
