# Extension implementation and validation

**English** | [简体中文](extensions.zh-CN.md)

This change implements EXTENSIONS-01, LINKS-01, WORKFLOW-01, COMMAND-01 and
CAPABILITIES-01 from baseline `9b783c9b92135607cb5f234a9c53314553fe9ecf`.
CI-01, dependency-update automation and SHOWCASE-01 remain outside this work.
See the [user guide](../EXTENSIONS.md) for configuration and examples.

## Responsibilities and contracts

- Core extension rules validate versioned registrations, scalar observations,
  scope, restricted JSON Pointer and freshness. Display references use opaque
  local bindings; portable imports and exports explicitly remove binding IDs.
- The existing catalog owns capabilities for the affected components. The shared
  editor form filter consumes those descriptors, as do CLI field validation and
  configuration explanation. Old unrelated formatting overrides remain readable.
- Platform adapters bound file reads and subprocess output. POSIX process groups
  and a Windows kill-on-close Job Object terminate descendants; Windows creates
  the tool suspended and assigns it before resuming. The static supervisor never
  interpolates arguments into Shell source.
  POSIX uses an `execve` handoff so an unrecognized executable cannot trigger
  the implicit `/bin/sh` fallback of `execvp`, even on older Node runtimes
  ([exec family contract](https://man7.org/linux/man-pages/man3/exec.3.html)).
  The Windows supervisor is an isolated Node process using the existing native
  adapter, avoiding a PowerShell launch and C# compilation for every command.
  The command receives its separately serialized minimum environment, including
  the caller's HOME; the supervisor does not grant it the host's full environment.
  Package management starts from its independent recovery copy before loading
  native code, so replacing the original package cannot lock its own adapter.
- CLI source services own the separate registry transaction, short-lived refresh
  jobs, revision checks, observation cache and GitHub provider. Jobs have one
  exclusive execution claim, a deadline, cancellation state and a source revision.
  No renderer launches a provider refresh. Local JSON rendering can maintain its
  private last-known-value cache; diagnosis reads without publishing that cache.
- The shared source manager drives both editors. Frontends adapt rendering and
  transport only. Source persistence is separate from display Save and host Apply.
- Link targets remain attached to styled grapheme units and preview spans.
  Clipping/wrapping reconstructs closed OSC 8 ranges; separators and decorations
  do not inherit the preceding target. External input never supplies raw controls.

Display schema is 10; editor protocol is 17. Registry and observation versions
are independently 1. Runtime 2, lifecycle 4, portable 1, UI preferences 1 and
profile collection/export 1 retain their versions. Existing IDs and default
selections remain unchanged; the catalog adds three main types and one subagent
type, for 66 main and 17 subagent types including text and spacer.


## Completed validation and delivery

The five selected work packages are DONE. Version publication is separately
complete: [GitHub](https://github.com/fbincon/claude-code-statusline/releases/tag/v3.6.0),
[npm](https://www.npmjs.com/package/@fbincon/claude-code-statusline/v/3.6.0) and
[Gitee](https://gitee.com/fbincon/claude-code-statusline/releases/tag/v3.6.0)
deliver the verified files. CI-01, Dependabot and SHOWCASE-01 were not started.

### Source and automated gates

[Feature PR #123](https://github.com/fbincon/claude-code-statusline/pull/123)
merged reviewed head `99bf53bc5e93dfb5c6729f4e66e2b7a015d317be` as release source
`359b627aa3c4349b15f0b5007fc33fa17a8c0062`. Annotated tag `v3.6.0` has object
`c80a5f9d95791845e1e98237d4d8589a7d94649e` and peels to that source.

| Gate | Evidence | Result |
| --- | --- | --- |
| Final PR | [39912463623](https://github.com/fbincon/claude-code-statusline/actions/runs/39912463623) | Passed |
| Release main | [39915698855](https://github.com/fbincon/claude-code-statusline/actions/runs/39915698855), attempt 2 | Passed; recovery below |
| Annotated tag | [39922242928](https://github.com/fbincon/claude-code-statusline/actions/runs/39922242928) | Passed on attempt 1 |
| OIDC preparation | [39925189220](https://github.com/fbincon/claude-code-statusline/actions/runs/39925189220) | Dry run passed |
| OIDC publication | [39925469351](https://github.com/fbincon/claude-code-statusline/actions/runs/39925469351) | Attempt 2 passed after delayed registry visibility; recovery below |
| Public downloads | [39926501613](https://github.com/fbincon/claude-code-statusline/actions/runs/39926501613) | Six OS/Node cases and twelve registry installations passed |

Each final product CI accepted eight installation targets, 32 Node runtime
cases and thirteen fixed hosts. The stable verifier required the four installed
extension scenarios and the version-specific approval without waiving a new
failure. Local `npm run check` passed: 1,123 tests, 1,118 passes, five platform
skips and zero failures; 47 generated resources and 2,746 documentation links
were checked. Two clean builds and two builds from the delivered source archive
produced identical files. Main and tag CI candidates, downloaded draft assets
and the public files match those same four files.

### Installed behavior and evidence boundaries

All twelve isolated installed checks passed, including source opt-in, manual
command refresh, portable binding isolation and OSC 8/plain-text output. Main
and subagent layouts were exercised at 40/80/120 columns. Both editors and CLI
share source review, activation, binding, refresh, cancellation and diagnosis;
fixture journeys cover six languages, conflicts, stale revisions, disable/delete
during refresh, late results, close cancellation, partial/bad files and explicit
argv/stdin/environment boundaries. Commands are tested for nonzero exits,
invalid UTF-8/JSON, output limits, timeout and descendant cleanup.

An authorized read-only query against this repository resolved PR #123 at its
final reviewed head and reported successful CI. After switching to merged main,
that source's old observation was suppressed for the changed branch/HEAD.
Fixtures separately cover ambiguity, no checks, pending, mixed conclusions,
authentication/permission errors and identity changes. No tokens are stored in
source configuration or observations.

The installed external editor produced 600 PTY cell captures across all six
languages, plus four limited-terminal cases (`vt100`, `vt220`, `xterm-mono`,
`dumb`). Terminal restoration and unchanged saved configuration after cancellation
passed. Report SHA-256:
`c7b1f4b5be5ede9a24769259eb84f5474ca4f5d06f05f4de413ae02338c62b93`.
The actual Claude 2.1.294 host passed source-review/native-operation, scheme/save,
profile and task-pane interactions; report SHA-256:
`9c7f9ac75200da2981d5597e8786728c1a74c55191290913c5167d307c9026f3`.
Both capture and host runs made zero model calls. These are protocol/PTY and
agent inspection evidence, not OS screenshots, human terminal-click acceptance
or physical desktop/power verification. OSC 8 encoding, closure, clipping,
wrapping, emoji, Powerline boundaries and plain-text fallback are automated
checks; actual clicking remains dependent on the terminal and host.

### Public delivery

| Delivery file | SHA-256 |
| --- | --- |
| `fbincon-claude-code-statusline-3.6.0.tgz` | `94d89808cd3aa841fedc0b800b6e620a2694edb1745d91b8e5cb75d3da5944a5` |
| `claude-code-statusline-3.6.0-source.tar.gz` | `53f2a54ff9b29987b42c6fee8bed25982cc674ea3e4ffb0937471f79e35ee2eb` |
| `build-manifest.json` | `8206992f9963038e5eaca3b148471f3226048ecfed65b42c5f366eaaa53aa84c` |
| `SHA256SUMS` | `bd98068c05d4b4a88568f0e3faa61534266a1277b5961c4048b4e6a8e3131ba0` |

npm `latest` is 3.6.0; `beta` remains 3.0.0-beta.1. The OIDC publisher recorded
[provenance](https://search.sigstore.dev/?logIndex=3415380061) and verified the package SHA-256/SHA-512 and selectors.
GitHub stable/Latest Release `421580832` and Gitee Release `1233575` use the
same annotated tag and source. All four attachments on both services were
anonymously downloaded with normal TLS verification and matched the table.
Local fixed-version/`latest` npm installations passed with initially empty
caches. The Gitee-downloaded package passed all twelve isolated installed checks.
GitHub and Gitee main/tag were synchronized using explicit refspecs.

The first Gitee SSH push disconnected; remote references were read back and
remained unchanged before retrying. Large anonymous CDN transfers timed out on
the initial route. Downloads succeeded through the current native Wi-Fi interface
with freshly resolved public addresses, normal TLS verification and unchanged
files. SSH synchronization retained strict verification of the existing host key.

### Corrections and recovery

Pre-release failures led to fixes for Windows supervisor bootstrap, file identity
on Node 24.0, immutable native host render props, global-scope editing, local Git
identity discovery, no-checks parsing and detached-worker fixture cleanup. A
reproduction showed that Node `shell: false` could still reach POSIX `execvp`'s
implicit shell fallback for unrecognized executable text. The final `execve`
handoff rejects that case while retaining explicitly selected interpreters,
literal arguments, standard streams and process-group cleanup. Final matrices
include these fixes; no product test was disabled to obtain acceptance.

Main attempt 1 had two failures. The Windows ARM/Node 22.x system PowerShell
readiness step exceeded 60 seconds before invoking the candidate. An existing
macOS 26 Intel/Node 24.x concurrent-preference writer could not establish current
process identity and retained its previous choice; the underlying OS cause is
not proven. The aggregate rejected both. Only failed jobs and their aggregate
were rerun, with unchanged source, timeouts and assertions; attempt 2 passed.
Failed reports and logs are retained. Tag CI passed on its first attempt. The first OIDC run submitted the package and signed provenance at 08:34 UTC, but npm server-side processing exceeded the existing three-minute visibility check. The registry made the version public at `2026-10-23T08:38:19.808Z`. After independently verifying public SHA-256/SHA-512, `latest` and the preserved `beta`, only the failed publisher job was rerun. Attempt 2 passed through `already-published`; it neither uploaded again nor requested a new OIDC publish. The original signed provenance and both job logs are retained.

Raw logs, superseded candidates, final receipts and ANSI/cell captures remain in
ignored `dist/validation/v3.6.0/`. This separate delivery-documentation follow-up
uses necessary documentation checks; the published tag and files remain fixed.

The [v3.6.0 decision](../releases/approvals/v3.6.0.json) accepts only the six
historical [#96 observations](https://github.com/fbincon/claude-code-statusline/issues/96):
physical macOS sleep; macOS 14 Intel desktop/power; Windows 10 desktop; WSL
popup; remaining target power/human visual coverage; and exact Claude 2.1.296
type declarations. All six remain unverified. This decision does not waive new
functional issues or automated failures.
