# Read-only task details

**English** | [简体中文](TASK_DETAILS.zh-CN.md)

Open `/statusline-task` in a supported Claude Code terminal with the native editor installed. When the pane has focus, press **Enter** or **G** to search, **F** to filter status, **E** to show evidence and **S** to edit the session or task identity. **N/P** select the next/previous row, **J/K** page down/up, **Z** expands or collapses the selected agent, **R** rereads published state and **Q** closes the pane. Refresh is manual.

You can start with the keyboard. If the prompt still has focus, use **Ctrl+X then Tab** to move focus to the pane or click a control. Click anywhere in the report body to use the arrow keys, Page Up/Down, Home/End, Enter and `/` there. If a native field opens while the prompt holds a draft, click the field or press Ctrl+X then Tab. When the ⏎ submit hint appears, type or paste the complete value including spaces. **Enter** confirms the field. Use **Tab** to reach **Cancel**, then **Enter** to restore the previous value. Esc returns focus to Claude.

The standalone terminal viewer works without the native pane or an installed editor:

```sh
claude-statusline task view --session-id SESSION_ID
claude-statusline --language zh-CN task view --session-id SESSION_ID --prompt-id PROMPT_ID --config-dir "/path/to/config"
```

The external configuration editor's Settings page also offers **Task details**. Enter the session ID and optionally a prompt ID, use Tab to switch fields, then Enter to read. Returning preserves the display draft, editing target and unresolved save state. The independent `task view` command requires a TTY; use the existing noninteractive command for text/JSON:


```sh
claude-statusline task show --session-id SESSION_ID
claude-statusline task show --session-id SESSION_ID --prompt-id PROMPT_ID --json
claude-statusline task show --session-id SESSION_ID --config-dir "/path/to/config"
```

Session and prompt IDs come from your supplied statusline input or existing session metadata. The CLI does not search other sessions to guess an identity. Without `--prompt-id`, it uses an explicit current-task pointer from existing state. Conflicting pointers, missing tasks and ambiguous aliases remain unavailable.

Command descriptions and initial titles use the loaded interface language. Task-read failures retain that language; refresh/reopen reload preferences. Unreadable preferences fall back to English with guidance without blocking task reads. Tall panes reduce the visible page to fit host capacity while retaining the complete report for paging.

## Reading controls

Use arrows to select a row, Page Up/Down to page, `/` to search names/IDs, `F` to cycle observed agent statuses, left/right or Enter to collapse/expand a selected agent, and `E` to show/hide evidence. `S` edits session/task identity; an empty prompt selects the published current-task pointer. Search is case-insensitive, and matching children retain their parents as context. Summary and all statuses are the default. Native host-only names remain unavailable to the external viewer.

Short native panes reserve space for the selected report row and use the visible body height for paging. Open **S** to inspect the full identity when its heading is compact. Refresh and resizing keep the selected row when it still exists. Selecting another task resets task-specific reading state. Failed refreshes retain the previous report and its capture time. In the external viewer, Q closes the reading view and Esc or Ctrl+G cancels a field.

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

For renderer visibility or supplied-input association, use [input diagnosis](DIAGNOSTICS.md). For display schemes and project selection, see [profiles](PROFILES.md).
