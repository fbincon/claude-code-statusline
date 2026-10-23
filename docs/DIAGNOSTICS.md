# Diagnose supplied statusline input

**English** | [简体中文](DIAGNOSTICS.zh-CN.md)


For external source registration, authorization, refresh, diagnosis and sharing boundaries, see the [extensions guide](EXTENSIONS.md).

For named display schemes, user-side project bindings and read-only task inspection, see [profiles](PROFILES.md) and [task details](TASK_DETAILS.md).

`doctor` checks installation. `diagnose` explains a statusline JSON object that you explicitly supply, using your saved display configuration and, by default, matching existing local observations. It prints a report and does not save or collect anything. The editors' Explain panels continue to explain **samples**, not a live session.

## Run a diagnosis

Use a JSON payload that you already captured from Claude Code's statusline stdin:

```bash
claude-statusline diagnose --input statusline-input.json
claude-statusline diagnose --input statusline-input.json --width 80 --json
cat statusline-input.json | claude-statusline diagnose --input - --input-only
claude-statusline --language zh-CN diagnose --input statusline-input.json
claude-statusline diagnose --input subagent-input.json --scope subagent --width 40
```

The file must contain one JSON object, not an editor draft, diagnostic report or runtime event envelope. For subagent diagnosis, supply the host's object containing `tasks`. UTF-8 and a leading BOM are supported. Duplicate keys, non-finite JSON constants, non-object roots and inputs over 32 MiB are refused. Unknown host fields are allowed; missing fields remain unknown and invalid known fields are identified in the report.

| Option | Meaning |
| --- | --- |
| `--input FILE` / `--input -` | Required: a file or stdin. The command never discovers a recent payload automatically. |
| `--scope main\|subagent` | Defaults to `main`. |
| `--width N` | Defaults to 120; integer 2–10000. Main output applies saved host padding within this width; subagent output uses this width instead of payload `columns`. |
| `--json` | Machine-readable result with stable reason codes and styled text spans. Errors are JSON objects with an `error` member. |
| `--input-only` | Excludes local observation stores and local hostname. Still reads display, installation and collector settings to explain configuration. |
| `--observed-at ISO_TIME` | Optional known input capture time, including timezone, for example `2026-10-19T20:00:00+08:00`. Never inferred from file modification time. |
| `--config-dir PATH` | Uses the selected Claude configuration directory; ordinary environment selection still applies. |

Exit code `0` means a report was produced, including reports with unavailable or stale evidence. Invalid arguments/input and unreadable files return `2`. A successful report does not certify a healthy installation or complete live observation.

## Read the report

The report separates configuration, supplied fields, local observations and layout outcomes. Every instance keeps its own ID, so repeated metrics can have different conditions, priorities and widths. Results distinguish configured-off, hidden rows/conditions, missing/invalid fields, unavailable sources, identity mismatch, zero, partial coverage, stale data, unknown freshness, clipping and width omission.

`output` is the fitted output from **this input and available evidence**, not a recording of what a live terminal displayed. JSON results use `sample:false`; sample-only `explain` results continue to use `sample:true`. The input's `version` supplies host capability evidence. Installation and collector settings describe this local configuration independently.

Input capture time, diagnosis time and each source's known observation time are separate. Without capture time, freshness of supplied fields is unknown. A timestamp alone does not establish a freshness rule. Runtime and Git caches retain their existing freshness rules; terminal task evidence can describe history. Observations newer than a supplied capture time are excluded. The tool does not reconstruct an earlier state from newer stores.

## Existing local observations

- Session usage is read only from the existing usage cache for the exact session and recorded transcript path. The transcript itself is not read. Legacy cache entries do not record their capture time, so their freshness is unknown; they cannot reconstruct a historical `--observed-at` instant.
- Task/request data requires matching session and prompt identity, or a previously stored unambiguous alias. Missing prompt identity never selects the latest task. Existing task evidence can be inspected without collecting usage first.
- Runtime metrics use already-published bindings and request/cost joins. Diagnosis does not reconcile them. Incomplete joins remain partial or unavailable.
- Subagent end observations require matching session, prompt and agent identity. Missing reliable end evidence does not invent an elapsed duration.
- Existing Git status cache entries require matching session key, directory and age. No Git command runs. Commit-diff cache association cannot be established without further inspection, so it remains unavailable in this mode.

There is no network query, model call, transcript scan, background snapshot, lock creation, repair, cache update or pruning. Configuration files are read without the normal management transaction lock; they are individually valid snapshots, not a claim of a globally atomic snapshot across concurrent writers. Corrupt or inaccessible stores are reported without being repaired.

## Worktrees and cache misses

The `worktree` component preserves `worktree.name` precedence for Claude worktree sessions. Without it, `workspace.git_worktree` displays the current linked Git worktree as `Git worktree NAME`. Diagnostics show both names and the selected source. Missing metadata does not trigger Git collection.

Enable the optional cache cause component through either editor or:

```bash
claude-statusline config enable cache-miss-reason
```

`cache-miss-reason` is off by default. It shows the host's **likely** cause of the latest main-conversation cache miss. Known causes are localized; unknown codes remain readable and control characters are removed. Diagnosis also reports `last_miss_at`, `tools_added`, `tools_removed` and signed `system_char_delta` when supplied. Zero diagnosed misses, no cause identified and a missing cause field are distinct. Several causes can coexist.

The source is the [official statusline contract](https://code.claude.com/docs/en/statusline): cache causes require Claude Code 2.1.260+. Existing `prompt-cache` still uses the official main-conversation ratio, with all input tokens in its denominator, excluding subagent traffic. PR/MR behavior is unchanged.

Display schema remains 8. Older packages cannot recognize `cache-miss-reason`; remove that component or restore an earlier configuration backup before downgrading. No automatic migration or configuration rewrite occurs during diagnosis.

See [backend contracts](development/contracts.md), [metric definitions](DISPLAY_ITEMS.md) and [implementation and acceptance](development/real-input-diagnostics.md).
