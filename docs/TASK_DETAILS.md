# Read-only task details

**English** | [简体中文](TASK_DETAILS.zh-CN.md)

Inspect existing task timing, checklists, agents and source evidence. Choose the Native pane, standalone terminal viewer or noninteractive CLI; none starts collection.

## Open a task report

With the native editor installed, run `/statusline-task` in a supported Claude Code terminal. If the conversation input still has focus, use **Ctrl+X then Tab** to focus the pane or click a control. Click the report body to use report-reading keys.

The standalone terminal viewer needs neither the Native pane nor an installed configuration editor:

```sh
claude-statusline task view --session-id SESSION_ID
claude-statusline --language zh-CN task view --session-id SESSION_ID --prompt-id PROMPT_ID --config-dir "/path/to/config"
```

The external configuration editor also offers **Task details** in Settings. Enter the session ID and optional prompt ID, switch fields with Tab, then press Enter to read. Returning preserves the display draft, editing target and unresolved save state. Standalone `task view` requires a TTY; for noninteractive text/JSON, use:

```sh
claude-statusline task show --session-id SESSION_ID
claude-statusline task show --session-id SESSION_ID --prompt-id PROMPT_ID --json
claude-statusline task show --session-id SESSION_ID --config-dir "/path/to/config"
```

Session and prompt IDs come from your supplied statusline input or existing session metadata. Pass `--session-id` explicitly; the CLI does not read statusline stdin or search other sessions to guess an identity. Without `--prompt-id`, it uses an explicit current-task pointer from existing state. Conflicting pointers, missing tasks and ambiguous aliases remain unavailable.

Command descriptions and initial titles use the loaded interface language. Task-read failures retain that language; refresh/reopen reload preferences. The native pane and interactive `task view` show guidance and fall back to English when preferences are unreadable; `task show` returns English without a warning. Neither case blocks task reads. Tall panes reduce the visible page to fit host capacity while retaining the complete report for paging.

## Reading controls

| Action | Native pane controls | Report body / standalone terminal viewer |
| --- | --- | --- |
| Search names/IDs | G, or Enter when the default Search button has focus | `/` |
| Filter observed statuses | F | F |
| Show/hide evidence | E | E |
| Edit session/prompt identity | S | S; Tab switches fields |
| Select previous/next row | P/N | ↑/↓; Home/End select first/last row |
| Page up/down | K/J | Page Up/Down or K/J |
| Expand/collapse an agent | Z | ←/→ or Enter |
| Reread published state | R | R |
| Close | Q; Esc returns focus to Claude | Q; outside field editing, Esc or Ctrl+G closes; while editing a field, Esc or Ctrl+G cancels the field |

Native letter controls need pane focus; report-reading keys need body focus. After opening a native field, click it or press Ctrl+X then Tab. When the ⏎ submit hint appears, type or paste the complete value, including spaces, and press Enter. Tab to **Cancel**, then Enter, restores the previous value. Active fields handle their own input keys.

Refresh is manual. An empty prompt field selects the published current-task pointer. Summary and all statuses are the default. Search is case-insensitive, and matching children retain their parents as context. The external viewer does not infer host-only agent names.

Short panes reserve space for the selected report row and page by the actual body height; use S to inspect identities when the heading is compact. Refresh and resizing retain a selected row that still exists. Selecting another task resets task-specific reading state. Failed refreshes keep the previous report and its capture time.

## Read the evidence

- **Task total time** uses the existing lifecycle timer and frozen terminal duration.
- **Active time** is shown only when native execution and waiting coverage support it. Missing starts, incomplete waits or unreliable clocks do not become zero.
- **Checklist completed / total**, such as `3/5`, counts completed checklist tasks. It is not an agent ratio or a percentage of elapsed time.
- **Agents** includes only identities attributable to the selected task. Known parent relationships are shown; unknown parents and inconsistent cycles are disclosed.
- **Evidence** identifies each source, scope, observation time and freshness. The pane's read time is not substituted for a source observation time.

The native pane may read current agent names from the host on demand. Those names are joined only to already-attributed IDs, are identified as a supplied snapshot, and are not persisted. The CLI may therefore display IDs where the pane displays names. Stale states remain visibly stale; a heartbeat for another task does not refresh an older running record or advance its elapsed time. Completed tasks retain their frozen durations. A terminal state does not prove that all historical events were observed.

Heartbeats are labelled with session scope. Agent and checklist evidence retain their own timestamps and ages; future checklist counts are unavailable. Future native prompt or turn observations cannot supply current status or refresh task timing. Independently valid frozen history remains available. An observed terminal lifecycle event takes precedence over agent-list snapshots.

The response is a version-1 read model over existing task and live stores. Source files are independent snapshots, so this is neither an atomic cross-file snapshot nor a complete task history. Data pruned from the existing bounded stores cannot be reconstructed here.

## Boundaries and troubleshooting

Inspection reads bounded known files. It does not scan transcripts, reconcile or repair stores, perform network queries, make model calls, enable collectors or change timing/attribution rules. Existing collector opt-outs remain effective. Disabled or missing collection may leave parts of the report unavailable.

Reinstall after upgrading to register the additional native command. If the native editor is disabled or the host cannot place the pane, use the CLI. Native UI support is validated per fixed terminal host; it is not inferred for web, mobile or other Claude clients.

For renderer visibility or supplied-input association, use [input diagnosis](DIAGNOSTICS.md). For status and reason codes in `task show`, see the [CLI task output](reference/cli.md#task-show) and [live-state views](development/live.md#state-views). For display schemes and project selection, see [profiles](PROFILES.md).
