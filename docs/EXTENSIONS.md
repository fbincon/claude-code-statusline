# Local sources, GitHub checks and links

**English** | [简体中文](EXTENSIONS.zh-CN.md)

Extensions are optional. A display component refers to a locally registered source;
adding a component, importing a scheme or selecting a project never enables a
source. External values do not contribute to task, token or cost totals.

## Configure with either editor

Open **Settings → Data sources**, or press **Ctrl+Y** outside a text field. Choose
**Add source**, select Local JSON, GitHub or Command, and fill in the form.
Tab/Enter advances between fields; Ctrl+S saves a disabled source. Arguments use a
JSON array and command input fields use a JSON object, so quoting is literal.

Select **Review and enable**, inspect the complete program/path, arguments,
working directory, input mapping, scope and expiration, then press Enter to
enable that exact revision. Editing a source disables it until another review.

Add an `external-value`, `github-pr` or `github-ci` component through the existing
Main/Subagents picker. **Bind to a component** selects an existing compatible
instance. Source definitions save independently; the new binding in the display
draft needs the usual **Save**. Cancelling the display draft leaves that draft
unsaved and does not undo separately saved source changes.

**Refresh now** starts one bounded job. **Refresh status**, **Cancel running
refresh** and **Inspect source and observations** expose its result. Closing the
editor cancels its unfinished jobs. Enablement is independent of refresh: it
never automatically launches a command or GitHub request.

## Local JSON

Create a local data file, for example:

```json
{"value":0,"observed_at":"2026-10-23T08:00:00Z"}
```

Create a source definition file, replacing the path with your own absolute path:

```json
{
  "kind": "json",
  "name": "Queue",
  "scope": {"project": null, "session": null, "agent": null},
  "ttl_seconds": 300,
  "settings": {
    "path": "/absolute/path/queue.json",
    "pointer": "/value",
    "observed_at_pointer": "/observed_at",
    "unit": "jobs"
  }
}
```

Register and review it:

```bash
claude-statusline source add queue --file queue-source.json --json
claude-statusline source review queue --json
claude-statusline source enable queue --review REVIEW_REVISION --json
claude-statusline config instance main add external-value
claude-statusline source bind queue --instance INSTANCE_ID --scope main --json
```

Use the actual `review_revision` and instance ID returned by the preceding
commands. `source bind` saves the selected display target; use `--profile NAME`
or `--project PATH` to select another target. `--config-dir PATH` belongs directly
after `source`. On Windows, escape backslashes in JSON paths, or use forward
slashes. Spaces and Unicode are supported.

JSON Pointer supports object keys and array indices, with `~0` for `~` and `~1`
for `/`. It has no expressions or script execution. Values must be a string,
finite number or boolean. Missing/null is distinct from `0`, `false` and an empty
string. Files are limited to 1 MiB; links, devices, FIFOs, malformed JSON and files
that change during reading are rejected. Producers should replace files
atomically. A present `version` must equal `1`; a present `source_id` or `scope`
must match the registered source and current context.

Only selected, enabled JSON sources are read during rendering. Duplicate
instances share an observation within the frame. Missing observation time means
unknown freshness; file modification time is not substituted. Successful values
are cached locally so a later read failure can retain the value with an explicit
error marker. Disabling a source stops subsequent external reads.

## GitHub PR and CI

Use existing `gh` authentication. Configure `kind: "github"`, an explicit project
or worktree scope, and settings such as:

```json
{
  "host": "github.com",
  "repository": "owner/repository",
  "branch": "feature/example",
  "account": "your-gh-login",
  "pr": null
}
```

The source queries only this host/repository/branch. It never switches accounts
or discovers a different forge. Set `pr` to an explicit number if several open
PRs match. Non-repositories, detached HEAD, mismatched local/remote HEAD,
authentication failures, denied access and unavailable checks have distinct
results. Existing host `pr` remains unchanged; `github-pr` and `github-ci` are
separate main-line components.

```bash
claude-statusline source refresh forge --project /absolute/project --json
claude-statusline source diagnose forge --project /absolute/project --json
```

Refresh is manual by default and has a 30-second total deadline. Rendering consumes cached
observations without running `gh`. Cache identity includes project/worktree,
account, host, repository, branch, HEAD and the local authentication context.
Changing identity invalidates the old result. Tokens remain with `gh`; source
configuration, exports and diagnostics contain no credentials.

Check aggregation distinguishes failed, pending, passed, cancelled, skipped,
unknown, no checks and no PR. A failure dominates pending checks. Success
requires at least one passing check and no failed, pending, cancelled or unknown
checks; an all-skipped result remains skipped. This summarizes observed checks,
not GitHub merge eligibility or branch protection.

## Automatic GitHub refresh

After **Review and enable**, select **Review automatic refresh** in either editor. Review the source identity and interval; ←/→ adjusts it by 60 seconds and Enter saves the local policy. Escape discards the pending choices. The default follows source expiration, clamped to 60–86400 seconds. CLI accepts any integer in that range:

```bash
claude-statusline source review forge --json
claude-statusline source auto-on forge --review REVIEW_REVISION --interval 300 --json
claude-statusline source diagnose forge --project /absolute/project --json
claude-statusline source auto-off forge --json
```

Use the returned review revision. The policy remains on locally until explicitly disabled. Policy saving is independent of display Save and host installation. Run `claude-statusline install` (or Apply host integration), then restart Claude if the runtime Mod has not been installed/configured for automatic refresh. Claude 2.1.289 or newer is required. Native timing, advanced live metrics and the native editor can remain disabled.

Supported active sessions renew a lease every five seconds; leases expire after 15 seconds without a heartbeat. Only matching project/session scope, branch and HEAD dispatch work. Session end closes its lease, and automatic work stops when no eligible lease remains. No persistent service is installed. Multiple sessions share one job for the same source/identity. A manual refresh takes ownership of an existing automatic job, so closing a session or turning automatic refresh off does not cancel that manual work.

Diagnosis reports off/waiting/running/backoff/paused, interval, next attempt, last attempt and last success. Failed network requests back off exponentially up to one day. Authentication, permission, account and identity failures pause automatic attempts until a successful manual retry or renewed review. Changes to local authentication require a new automatic review. Source edits revoke automatic review; disable/remove cancel work. **Disable automatic refresh** preserves the enabled source and cached observations. Cache freshness/error markers still apply; identity mismatches suppress old values.

Rendering, preview, imports and project bindings never dispatch refreshes. Command and JSON sources remain outside automatic scheduling. Local policies are not included in portable exports. A missing eligible session appears as `waiting/no_session`; unsupported hosts or missing runtime integration cannot renew a lease.

## Commands

Use `kind: "command"` with settings such as:

```json
{
  "executable": "node",
  "args": ["-p", "String(42)"],
  "cwd": "/absolute/project",
  "input": {},
  "output": "text",
  "timeout_ms": 5000
}
```

The executable is resolved when saving. Execution uses literal arguments without
a Shell. Unrecognized executable text fails instead of implicitly entering a Shell.
For scripts, specify their interpreter explicitly; Windows `.cmd`/`.bat`
files are not silently executed through `cmd.exe`. Review changes to executables,
arguments, paths or inputs before re-enabling.

Input is a JSON object on stdin containing only selected mappings. Available
context fields are `project`, `session`, `agent`, `branch` and `head`, for example
`{"working_project":"project"}`. The default object is empty. The child receives
only essential OS environment variables, not model or forge credentials.
Commands run with the current user's permissions; this is not an OS sandbox.

Text output is sanitized into one line and timestamped when execution finishes.
For `output: "json"`, emit exactly this independently versioned contract:

```json
{
  "version": 1,
  "source_id": "command-source-id",
  "scope": {"project": "/absolute/project", "session": null, "agent": null},
  "observed_at": "2026-10-23T08:00:00Z",
  "state": "valid",
  "value": 42,
  "unit": null
}
```

States are `valid`, `missing`, `partial`, `error` or `unsupported`; a valid result
requires a scalar value. `observed_at` may be null, making freshness unknown.
Timeout defaults to 5 seconds and is configurable from 100 ms to 30 seconds;
stdout and stderr together are capped at 1 MiB. Timeout, cancellation, nonzero
exit and oversized/invalid output remain different outcomes. Descendants are
terminated as well, including processes retaining output pipes.

`source refresh ID` waits for completion. `--no-wait` returns the job ID for
`source status JOB_ID` and `source cancel JOB_ID`. Command sources permit one running job per source. GitHub refreshes coalesce by source revision and context identity; an explicit manual refresh takes ownership of an automatic job. Disable, deletion or editing cancels old jobs, and revision/context checks reject late results.

## Freshness, sharing and links

Expiration defaults to 300 seconds and can be configured from 1 to 86400 seconds.
Old values may remain visible after expiration or failure, with a leading status
marker. Unknown time is also marked. Identity mismatch suppresses the old value.
Full observation times, scope and job reasons are available in source diagnosis.
Previews always use fixed samples and never read source files, query GitHub or
run commands.

Portable exports retain source hints, but remove machine binding IDs. Imports
always require a new explicit local binding, including when a same-named source
already exists. Source definitions are stored in `claude-statusline-sources.json`
under the selected Claude configuration directory; private observation/job files
are under `statusline_runtime/sources`. Normal configuration recovery also covers
the source registry. Do not place credentials in source definitions.

In supported component details, **Links** offers `off` (default), `auto` and `on`.
Current directory, project name, host PR, GitHub PR/CI and subagent directory can
link to validated HTTP(S) URLs or local files. Missing targets retain plain text.
Only users open links; configuration and rendering never open them automatically.

`auto` uses terminal hints, including `FORCE_HYPERLINK`; unknown terminals and
unconfirmed multiplexers retain plain text. `on` explicitly requests OSC 8 output.
The external preview preserves links; the native preview preserves readable
labels when its host does not expose hyperlink rendering. Actual click behavior
also depends on Claude Code and the terminal, as explained in the
[official status-line documentation](https://code.claude.com/docs/en/statusline#osc-8-links-not-clickable).

Display schema 10 and editor protocol 17 carry these additions. Older display
configurations remain readable without automatic rewriting; saving uses the new
schema. Reinstall integration when frontend/backend versions differ. Runtime,
task lifecycle, portable envelope and profile collection versions are unchanged.
