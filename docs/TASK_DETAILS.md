# Read-only task details

**English** | [简体中文](TASK_DETAILS.zh-CN.md)

Use `/statusline-task` in a supported Claude Code terminal with the native editor installed. The separate pane shows the current task, attributable agents, known state, checklist counts and timing evidence. **R / Refresh** rereads published state; **J/K** page down/up; **Q / Close** closes it. There is no background polling.

The CLI works without the native pane:

```sh
claude-statusline task show --session-id SESSION_ID
claude-statusline task show --session-id SESSION_ID --prompt-id PROMPT_ID --json
claude-statusline task show --session-id SESSION_ID --config-dir "/path/to/config"
```

Session and prompt IDs come from your supplied statusline input or existing session metadata. The CLI does not search other sessions to guess an identity. Without `--prompt-id`, it uses an explicit current-task pointer from existing state. Conflicting pointers, missing tasks and ambiguous aliases remain unavailable.

Command descriptions and initial titles use the loaded interface language. Task-read failures retain that language; refresh/reopen reload preferences. Unreadable preferences fall back to English with guidance without blocking task reads. Tall panes reduce the visible page to fit host capacity while retaining the complete report for paging.

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
