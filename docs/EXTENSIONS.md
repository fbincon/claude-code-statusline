# Local sources, GitHub checks and links

**English** | [简体中文](EXTENSIONS.zh-CN.md)

Extensions are optional. A display component refers to a locally registered source;
adding a component, importing a scheme or selecting a project never enables a
source. External values do not contribute to task, token or cost totals.

## Contents

- [Sources, components and permissions](#sources-components-and-permissions)
- [Configure with either editor](#configure-with-either-editor)
- [Local JSON sources](#local-json-sources)
- [GitHub PR and CI checks](#github-pr-and-ci-checks)
- [Command sources](#command-sources)
- [Automation: refresh and execution](#automation-refresh-and-execution)
  - [Automatic GitHub refresh](#automatic-github-refresh)
  - [Automatic command execution](#automatic-command-execution)
  - [Shared leases and failure handling](#shared-leases-and-failure-handling)
- [Windows paths and PowerShell](#windows-paths-and-powershell)
- [Freshness, sharing and links](#freshness-sharing-and-links)
  - [Expiration, stale values and sharing](#expiration-stale-values-and-sharing)
  - [Validated links](#validated-links)
- [Operations and troubleshooting](#operations-and-troubleshooting)
  - [Readable operations and saved check details](#readable-operations-and-saved-check-details)
  - [Troubleshooting](#troubleshooting)
  - [Binding inventory and cleanup](#binding-inventory-and-cleanup)
- [Interface compatibility](#interface-compatibility)
- [Related guides](#related-guides)

<a id="registration-enablement-binding-and-execution"></a>

## Sources, components and permissions

A **source definition** is a locally saved description of where an optional value comes from and which project, session or agent it applies to. Editing it creates a new **review revision**. **Enabling** authorizes that exact revision. A **binding** associates a compatible display instance with a source. A **job** is one bounded refresh; an **observation** is its cached result. **TTL** and **freshness** describe how long that result remains usable. An **automatic policy** separately permits interval-based refresh for eligible active sessions; a **lease** is a session's renewable claim that keeps automatic work running. **Identity/context** is the project, worktree, session, agent, branch and HEAD combination that scopes a source.

| Action | Effect |
| --- | --- |
| Register/edit | Save a disabled local definition for review |
| Review and enable | Authorize the exact source revision; this alone starts no command or GitHub request |
| Bind a component | Associate a compatible display instance; editor bindings follow display-draft Save |
| Refresh manually | Explicitly start or join one bounded job |
| Review an automatic policy | Separately permit interval-based refresh for eligible active sessions, independently of display Save |

Scheme imports and project bindings cannot grant these permissions.

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
editor releases only its refresh interest; other consumers or applicable automatic leases keep the job running. Explicit cancellation still stops the whole job. Enablement is independent of refresh: it
never automatically launches a command or GitHub request. Automatic policies are reviewed separately in [automation](#automation-refresh-and-execution).

<a id="local-json"></a>

## Local JSON sources

Create a local data file, for example:

```json
{"value":0,"observed_at":"2026-10-23T08:00:00Z"}
```

Save this definition as `queue-source.json`, replacing the path with your own absolute path:

<!-- docs-example: local-source -->
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
after `source`. Paths support spaces and Unicode.

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

<a id="github-pr-and-ci"></a>

## GitHub PR and CI checks

Use an existing `gh` login for the repository's host; this feature neither logs in nor switches accounts. In your project/worktree, check the active account and branch:

```sh
gh auth status --hostname github.com
git rev-parse --show-toplevel
git branch --show-current
git rev-parse HEAD
```

Use a branch pushed to the chosen repository. Its local HEAD must match the PR head. Replace `/absolute/project`, `owner/repository`, `feature/example` and `your-gh-login` below with that project's absolute root, repository, branch and authenticated login. Save the complete definition as `forge-source.json`:

<!-- docs-example: github-source -->
```json
{
  "kind": "github",
  "name": "Project checks",
  "scope": {
    "project": "/absolute/project",
    "session": null,
    "agent": null
  },
  "ttl_seconds": 300,
  "settings": {
    "host": "github.com",
    "repository": "owner/repository",
    "branch": "feature/example",
    "account": "your-gh-login",
    "pr": null
  }
}
```

Register, inspect the returned definition and enable its exact `review_revision`. Add both main-line components and use each returned instance ID for its binding:

<!-- docs-example: github-workflow -->
```text
claude-statusline source add forge --file forge-source.json --json
claude-statusline source review forge --json
claude-statusline source enable forge --review REVIEW_REVISION --json
claude-statusline config instance main add github-pr
claude-statusline source bind forge --instance PR_INSTANCE_ID --scope main --json
claude-statusline config instance main add github-ci
claude-statusline source bind forge --instance CI_INSTANCE_ID --scope main --json
claude-statusline source refresh forge --project '/absolute/project' --json
claude-statusline source diagnose forge --project '/absolute/project' --json
```

Replace `REVIEW_REVISION`, `PR_INSTANCE_ID` and `CI_INSTANCE_ID` with actual command results. These commands save the user default. Final `source bind` and display-target writes require owned installation; some `config` writes can complete before installation. Complete [setup](SETUP.md) first when binding. Use the same configuration directory throughout. `source --config-dir PATH ...` and `config --config-dir PATH ...` select it explicitly.

If the project is already bound to a named profile, edit and bind that target instead of the independent user default; see [editing targets](PROFILES.md#choose-an-editing-target).

Before refresh, diagnosis reports `not_refreshed`. After a successful refresh, inspect the observation and check summary in diagnosis, then view the statusline in that project: bound components read the cached PR/check result. A successful query can report `no_pr` or `no_checks`; neither means passing CI. The source queries only the specified host/repository/branch. Set `pr` to an explicit number if several open PRs match. Non-repositories, detached HEAD, a PR head that differs from the context branch/HEAD, authentication failure and denied access have distinct reasons; an identity mismatch suppresses old values. The check compares the PR head ref and commit with the context branch and HEAD; it does not inspect a remote-tracking HEAD. Existing host `pr` remains unchanged; `github-pr` and `github-ci` are separate main-line components.

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

<a id="commands"></a>

## Command sources

This read-only example prints `42` using the installed Node runtime. Replace both project paths with an existing absolute directory and save this complete definition as `answer-source.json`:

<!-- docs-example: command-source -->
```json
{
  "kind": "command",
  "name": "Example answer",
  "scope": {
    "project": "/absolute/project",
    "session": null,
    "agent": null
  },
  "ttl_seconds": 300,
  "settings": {
    "executable": "node",
    "args": [
      "-p",
      "String(42)"
    ],
    "cwd": "/absolute/project",
    "input": {},
    "output": "text",
    "timeout_ms": 5000
  }
}
```

Review the resolved executable and arguments before enabling, then bind an `external-value` instance and execute explicitly:

<!-- docs-example: command-workflow -->
```text
claude-statusline source add answer --file answer-source.json --json
claude-statusline source review answer --json
claude-statusline source enable answer --review REVIEW_REVISION --json
claude-statusline config instance main add external-value
claude-statusline source bind answer --instance INSTANCE_ID --scope main --json
claude-statusline source refresh answer --project '/absolute/project' --json
claude-statusline source diagnose answer --project '/absolute/project' --json
```

Use the returned `review_revision` and instance ID, with the same owned installation and configuration directory as above. Enable/bind do not execute the command. Before refresh the result is `not_refreshed`; a successful refresh completes the job and diagnosis shows a valid text value `42`. The bound component displays that value in the matching project. On failure, inspect the job/observation reason rather than treating missing output as zero. Automatic execution remains off unless separately reviewed after this manual check.

The executable is resolved when saving. Execution uses literal arguments without
a Shell. Unrecognized executable text fails instead of implicitly entering a Shell.
For scripts, specify their interpreter explicitly. Review changes to executables,
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

Reaching the execution deadline while a manual caller still has interest records
a failed job with reason `timeout`, retains available execution diagnostics and publishes
an error observation for `source diagnose`. Deadline expiry alone is not a caller
cancellation. Explicit cancellation or release of all applicable consumers remains
separate, and obsolete source revisions or context identities cannot publish results.

`source refresh ID` waits for completion. `--no-wait` returns the job ID for
`source status JOB_ID` and `source cancel JOB_ID`. Interrupting a waiting CLI releases only its consumer; `--no-wait` retains interest through completion or publication of the original deadline's timeout result. Command sources permit one running job per source. GitHub refreshes coalesce by source revision and context identity; an explicit manual refresh joins as an independent consumer without changing the origin. Disable, deletion or editing cancels old jobs, and revision/context checks reject late results.

## Automation: refresh and execution

Manual refresh is always explicit. Automatic refresh is reviewed separately for each source, defaults off, and requires the runtime integration described below. The source-specific subsections keep their own prerequisites and limits; [shared leases and failure handling](#shared-leases-and-failure-handling) applies to both.

### Automatic GitHub refresh

After **Review and enable**, select **Review automatic refresh** in either editor. Review the source identity and interval; ←/→ adjusts it by 60 seconds and Enter saves the local policy. Escape discards the pending choices. The default follows source expiration, clamped to 60–86400 seconds. CLI accepts any integer in that range:

```bash
claude-statusline source review forge --json
claude-statusline source auto-on forge --review REVIEW_REVISION --interval 300 --json
claude-statusline source diagnose forge --project /absolute/project --json
claude-statusline source auto-off forge --json
```

Use the returned review revision. The policy is stored locally and is not exported; editing, disabling or deleting the source revokes it, as does explicit auto-off. Policy saving is independent of display Save and host installation. Run `claude-statusline install` (or Apply host integration), then restart Claude if the runtime Mod has not been installed/configured for automatic refresh. Claude 2.1.289 or newer is required. Native timing, advanced live metrics and the native editor can remain disabled.

Only an active session whose project/session scope, branch and HEAD match the source dispatches work. Multiple sessions share one job for the same source and identity.

Diagnosis reports off/waiting/running/backoff/paused, interval, next attempt, last attempt and last success. Authentication, permission, account and identity failures pause automatic attempts until a successful manual retry or renewed review. Changes to local authentication require a new automatic review. Source edits revoke automatic review; disable/remove cancel work. **Disable automatic refresh** preserves the enabled source and cached observations. Cache freshness/error markers still apply; identity mismatches suppress old values.

Rendering, preview, imports and project bindings never dispatch refreshes. JSON sources remain outside automatic scheduling; separately reviewed commands use the [automatic command execution](#automatic-command-execution) rules. Local policies are not included in portable exports. A missing eligible session appears as `waiting/no_session`; unsupported hosts or missing runtime integration cannot renew a lease.

### Automatic command execution

Enable and review the exact command first, then separately review automatic execution with the same `auto-on` entry [shown above](#automatic-github-refresh). Automatic command permission defaults off. Its initial interval is **300 seconds**, adjustable from 60 through 86400 seconds, independently of `ttl_seconds`. Source edits revoke both old execution and automatic permission; reading an old registry never grants permission.

The runtime Mod renews the shared leases described below. Confirmed projects, sessions and local agents supply only the reviewed input mappings; unknown agent/project ownership waits instead of guessing. No daemon is installed. Each command source runs serially. Identical actual inputs share a job; distinct contexts rotate fairly and keep independent results. Busy ticks are skipped rather than queued for catch-up.

### Shared leases and failure handling

The runtime Mod renews a five-second lease for each eligible active session; a lease expires after fifteen seconds without a heartbeat. Session end closes its lease, and automatic work stops when no eligible lease remains. No persistent service or daemon is installed. Multiple sessions and manual consumers retain independent interest in the same source and identity: closing one session/editor, or turning automatic refresh off, preserves other applicable consumers; an explicit cancellation still stops the whole job.

Failed requests back off exponentially up to one day. Missing executables, malformed output, authentication, permission, account, identity and configuration failures pause automatic attempts until a successful manual retry or renewed review. Reading an old registry never grants permission, and an edited source revokes both old execution and automatic review.

An overdue read can provisionally account for a timeout while a worker waits for its final lock. A later confirmed success clears that provisional backoff and records the actual completion time; a final pause failure uses its actual cause without counting the same attempt twice. Worker settlement and subsequent lifecycle ticks converge on the same feedback. Orphaned jobs retain bounded retry/backoff, and an older job cannot revise newer feedback. Late results cannot publish into an edited source.

## Windows paths and PowerShell

Use `claude-statusline.cmd` for CLI calls in PowerShell. Save the same definition files as UTF-8 JSON. For the JSON source's `settings.path` and for GitHub and command `scope.project` (and command `settings.cwd`), `"C:\\Work\\Example Project"` and `"C:/Work/Example Project"` express the same Windows path. Backslashes in a PowerShell single-quoted argument stay literal; JSON requires each backslash doubled. Spaces and Unicode are supported.

<!-- docs-example: source-powershell -->
```powershell
claude-statusline.cmd source --config-dir 'C:\Users\Example\Claude Config' add answer --file 'C:\Work\Example Project\answer-source.json' --json
claude-statusline.cmd source --config-dir 'C:\Users\Example\Claude Config' review answer --json
claude-statusline.cmd source --config-dir 'C:\Users\Example\Claude Config' enable answer --review REVIEW_REVISION --json
claude-statusline.cmd config --config-dir 'C:\Users\Example\Claude Config' instance main add external-value
claude-statusline.cmd source --config-dir 'C:\Users\Example\Claude Config' bind answer --instance INSTANCE_ID --scope main --json
claude-statusline.cmd source --config-dir 'C:\Users\Example\Claude Config' refresh answer --project 'C:\Work\Example Project' --json
claude-statusline.cmd source --config-dir 'C:\Users\Example\Claude Config' diagnose answer --project 'C:\Work\Example Project' --json
```

Replace the paths and returned placeholders, and set up that same configuration directory first. The GitHub workflow uses the same command-name/path substitutions. The CLI's npm `.cmd` wrapper is separate from the source's `settings.executable`: a command source runs a program with literal argv and does not implicitly run `.cmd`/`.bat` through `cmd.exe`. Use `node`/`node.exe` and a script path as a separate argument for Node scripts; do not put an entire shell command in `executable`.

<a id="freshness-and-sharing"></a>

## Freshness, sharing and links

### Expiration, stale values and sharing

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

<a id="links"></a>

### Validated links

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

## Operations and troubleshooting

### Readable operations and saved check details

**Inspect source and observations** and `source diagnose ID` share a readable summary: enablement, automatic policy, waiting/running/backoff/pause, current observation failure and freshness, last success, next attempt and context ownership. The newest bounded job summaries include exit status, duration and sanitized output; missing old-record information remains unknown. `--json` and the advanced JSON action expose structured details. A recent successful value can remain within TTL after a failed attempt; the failure remains visible independently of freshness.

GitHub check details retain observed names, state and validated HTTP(S) links, repository, branch, HEAD and capture time. Arrow keys paginate saved observations in groups of sixteen. Opening a page never queries GitHub. Unknown, missing, cancelled, skipped and expired checks keep their meanings; retained details from an earlier success retain their original time.

**Cancel running refresh** cancels the source's running refresh jobs. **Disable automatic refresh** releases automatic interest while keeping applicable manual consumers. **Disable source** prevents new tasks and cancels unfinished work. Closing a view releases only that view's interest.

### Troubleshooting

| Symptom | Meaning and next step |
| --- | --- |
| `not_refreshed` | No successful observation exists yet. Review the source, run an explicit refresh, then inspect diagnosis. |
| `waiting` / `no_session` | No eligible active session holds a lease, or runtime integration is missing. Install and restart the runtime Mod, then check project/session scope. |
| `backoff` / `paused` | A temporary failure is retrying with backoff, or an authentication/identity failure paused automatic work. Retry manually or renew the automatic review. |
| Stale or hidden value | Expiration, an error marker or an identity mismatch is suppressing the old value. Check freshness and context identity in diagnosis. |
| Command timeout, nonzero exit or invalid output | The job failed rather than producing zero. Inspect the bounded job summary and the published error observation. |
| `no_pr` / `no_checks` | The query succeeded but found no matching PR or checks; neither means passing CI. Check the branch/HEAD, `pr` selection and repository. |
| Windows path or `.cmd` failure | Use `claude-statusline.cmd`, UTF-8 JSON and escaped backslashes; keep `settings.executable` separate from the CLI wrapper. |
| Version or resource mismatch | Reinstall integration so frontend and backend resources come from the same package; current versions are in the [CLI reference](reference/cli.md). |

### Binding inventory and cleanup

Binding prefers the component's current compatible binding, then reuses a compatible record for the same source. The source library's **Binding inventory** lists unused and duplicate records, with explicit cleanup review. Defaults, all named schemes/project associations, registered editor drafts and retained recovery transactions protect their references. A changed review or unreadable reference prevents deletion. Cleanup never changes source definitions or execution permission.

```bash
claude-statusline source bindings --json
claude-statusline source cleanup-bindings BINDING_ID --review REVIEW_REVISION --json
claude-statusline source release-draft DRAFT_OWNER --json
```

Use the inventory's current revision and inspect references first. A crashed editor may leave a conservative draft reservation; release that exact owner only after recovering, exporting or deliberately abandoning its draft. Normal editor close releases its reservation. Removing a display reference alone does not authorize deletion of a record used by another scheme.

The legacy `source unbind ID --binding BINDING_ID` deletion also rechecks all references under lock and refuses used/uncertain records. Clear component references in the editor, then prefer the reviewed binding-cleanup flow.

[Installed source-page captures](images/source-command-package/README.md) illustrate the separate state and approval controls.

## Interface compatibility

The current interfaces are display schema 17, editor protocol 31, source registry
2 (command-source automatic policies use 3), source jobs 4 and source observations 1. Older display configurations remain
readable without automatic rewriting; saving uses the current schema. Older jobs
1–3 remain readable, with absent execution diagnostics treated as unknown.
Reinstall integration when frontend/backend versions differ. Runtime, task
lifecycle, portable envelope and profile collection versions evolve independently.

## Related guides

- [Profiles and project bindings](PROFILES.md)
- [Input diagnosis](DIAGNOSTICS.md)
- [Read-only task details](TASK_DETAILS.md)
- [CLI reference](reference/cli.md)
- [Troubleshooting](USER_GUIDE.md#troubleshooting)
