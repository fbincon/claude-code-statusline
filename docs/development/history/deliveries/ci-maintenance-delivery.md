# CI rollout and Action pinning records

**English** | [简体中文](ci-maintenance-delivery.zh-CN.md) · [Current guide](../../ci-maintenance.md)

These records cover the measured rollout for issue #157 and CI-01 Action pinning at the v3.6.0 product baseline. Each result belongs to its recorded source and run.

<a id="ci-rollout"></a>

## Issue #157 rollout

### Measured rollout evidence for issue #157

The following complete runs retain the same 8/32/16 coverage and applicable 197 Native checks. Wall time includes queueing and gaps between attempts. Task minutes sum actual job execution, including failed executions, but exclude successful jobs that GitHub copies into a later attempt with unchanged execution timestamps. Maximum queue and execution are separate per-job maxima; they need not belong to the same job and cannot be subtracted from wall time.

| Complete run | Wall | Max job queue | Max job execution | Task minutes | macOS minutes | Reruns |
| --- | --- | --- | --- | ---: | ---: | ---: |
| [Baseline PR](https://github.com/fbincon/claude-code-statusline/actions/runs/40336709149) | 56m40s | 38m14s | 32m31s | 598.35 | 221.43 | 0 |
| [Baseline main](https://github.com/fbincon/claude-code-statusline/actions/runs/40346292097) | 67m23s | 39m46s | 34m28s | 626.33 | 235.07 | 1 |
| [Baseline tag](https://github.com/fbincon/claude-code-statusline/actions/runs/40357902282) | 73m28s | 45m17s | 33m59s | 636.23 | 236.50 | 1 |
| [Stage 2 final PR](https://github.com/fbincon/claude-code-statusline/actions/runs/40402431203) | 41m53s | 34m28s | 21m17s | 459.37 | 161.97 | 0 |
| [Stage 2 main](https://github.com/fbincon/claude-code-statusline/actions/runs/40408875074) | 66m53s | 57m58s | 20m27s | 473.70 | 174.80 | 0 |
| [Stage A final PR](https://github.com/fbincon/claude-code-statusline/actions/runs/40409378646) | 70m55s | 62m45s | 19m47s | 462.07 | 170.42 | 0 |

The Stage 2 final PR reduced wall time by 26.1%, task minutes by 23.2% and macOS minutes by 26.9% against the baseline PR. The next two rollout runs overlapped and shared hosted-runner quota: their longer queues obscured the lower execution work. These are named observations, not a guaranteed latency or a controlled benchmark. At that historical rollout, enabling policy changes ran full PR/main matrices. The current route table supersedes that automatic coupling; equivalent integrations now reuse even when policy changes. New-tag execution and real npm/OIDC provenance are deferred to the next actual release; this maintenance creates no version or test tag.

Stability evidence includes [Windows x64/ARM-host installed diagnostics](https://github.com/fbincon/claude-code-statusline/actions/runs/40392875032), with same-runner supervisor startup medians reduced by 68–76% across the two diagnostic runs; this percentage describes startup only. [macOS Intel/ARM diagnostics](https://github.com/fbincon/claude-code-statusline/actions/runs/40395043483) each passed 1,000 identity comparisons and 20 affected transaction journeys. The final Stage 2 PR's Windows Claude 2.1.289 and 2.1.294 each passed ten original long-scenario repetitions: maxima 4.079s/2.434s and minimum margins 15.921s/17.566s against the unchanged 20s deadline.

Failures remain part of the record. An [earlier complete Stage 2 run](https://github.com/fbincon/claude-code-statusline/actions/runs/40397874104) was cancelled after four Windows Git-suite timing failures under two-worker scheduling. Moving those resource-sensitive suites to the serial group preserved all assertions and deadlines; [four affected Windows/Node combinations](https://github.com/fbincon/claude-code-statusline/actions/runs/40401253349) then passed their complete runtime suite and ten direct Git-suite repetitions before the final complete run. [Real draft checks](https://github.com/fbincon/claude-code-statusline/actions/runs/40401259200) passed quick checks while failing the required aggregate. Ready/converted/synchronize transitions and cancellation were also exercised. Cancelled or diagnostic runs never count as complete acceptance; the six existing issue #96 gaps remain unverified.

[Stage A main's macOS 26 / Node 22.x job](https://github.com/fbincon/claude-code-statusline/actions/runs/40418420063/job/121907456214) subsequently exposed an unhandled `EPIPE` when a historical-version command closed stdin early. The acceptance worker now registers the pipe handler before writing: exit codes and command-output assertions still decide success, and other stream errors fail and terminate the command. Real child-process regressions cover early closure with successful and failed exit codes, exact Unicode input and non-pipe errors; they run serially in every runtime source suite. The [in-flight Stage B PR run](https://github.com/fbincon/claude-code-statusline/actions/runs/40418703438) was cancelled for this repair; it is not counted in the successful-run table.

The [next Stage B run](https://github.com/fbincon/claude-code-statusline/actions/runs/40421822049) exposed a Windows-specific fault in that new fixture: closing descriptor 0 did not close every inherited stdin handle, so the fixture's handshake timed out. The fixture now exercises an actual child exit with a bounded pending write, and still requires the closed-pipe error (`EPIPE`, or Windows `EOF`), original exit status and unchanged deadline. The [targeted Windows diagnostic](https://github.com/fbincon/claude-code-statusline/actions/runs/40424220219) identified the Windows `EOF` variant; other input errors remain failures. These failed/cancelled runs remain recorded separately from successful acceptance.

<a id="ci-01"></a>

## CI-01 implementation

**Status: DONE.** Implementation baseline: `95206119dab6f931f320277d25889fea8da49528` (2026-10-23). Product baseline remains v3.6.0. This maintenance task does not create a version, tag, npm publication or Release.

CI-01 pins the existing Action majors, adds an offline identity check and enables weekly Actions update proposals. Existing workflow triggers, permissions, Node/build versions, platform and host matrices, OIDC and release conditions remain in place. [Roadmap](../../roadmap.md#milestones) · [Scope and acceptance](../work-package-designs.md#ci-01).

## Initial reference inventory and provenance

The four workflows contain 39 external references: CI 24, npm publication 7, public downloads 4 and historical Python reference 4. The following exact version tags were resolved through the official repositories' Git reference APIs on 2026-10-23; each points directly to a commit. The matching major tags were checked during planning. Each `uses:` retains an exact `# vX.Y.Z` comment.

| Official Action and version tag | Full commit SHA | References |
| --- | --- | --- |
| [checkout v4.4.0](https://github.com/actions/checkout/tree/v4.4.0) | `11d5960a326750d5838078e36cf38b85af677262` | 10 |
| [setup-node v4.4.0](https://github.com/actions/setup-node/tree/v4.4.0) | `49933ea5288caeca8642d1e84afbd3f7d6820020` | 13 |
| [upload-artifact v4.6.2](https://github.com/actions/upload-artifact/tree/v4.6.2) | `ea165f8d65b6e75b540449e92b4886f43607fa02` | 9 |
| [download-artifact v4.3.0](https://github.com/actions/download-artifact/tree/v4.3.0) | `d3f86a106a0bac45b974a628896c90dbdf5c8093` | 6 |
| [setup-python v5.6.0](https://github.com/actions/setup-python/tree/v5.6.0) | `a26af69be951a213d495a4c3e4e4022e16d87065` | 1 |

This is the initial inventory, preserved as delivery evidence. Later update PRs provide their own reviewed version/SHA provenance. Pinning applies to direct workflow references and reachable local composite Actions; dependencies inside remote Actions remain under their upstream implementation. See [GitHub's secure-use guidance](https://docs.github.com/en/actions/reference/security/secure-use).

## Validation and completion evidence

Local validation passed: `actions:check` checked four files and 39 references with zero errors; the checker/scope suite passed all 17 tests; `npm run check` passed 1,131 of 1,136 tests with five platform-specific skips, plus generated resources, documentation, archive integrity and complete responsibility ledgers. A parsed-YAML comparison with the implementation baseline confirmed identical workflow structure after normalizing the pins and removing the added scope check. `git diff --check` passed.

The [first PR attempt](https://github.com/fbincon/claude-code-statusline/actions/runs/39941449719) exposed a checker boundary error with macOS 14/15 temporary roots aliased from `/var` to `/private/var`. The checker now canonicalizes the checkout root first, with a directory-alias regression. That attempt was cancelled; the corrected final head subsequently passed the complete matrix.

Implementation [PR #126](https://github.com/fbincon/claude-code-statusline/pull/126) is merged. The final reviewed head is `7888e4af798ec795b90f4b374633e6fa4fb67335`; the merged implementation main is `8a6a081426f463157df308f6ef1d15a15b5901aa`.

The final head's first execution reported 128 passing and one failing existing native Mod test on Windows/Claude 2.1.289; the failing case was outside the retained output tail. After the run completed, only that job and its dependent aggregate gate were retried with the same commit and assertions. The final second-attempt result was 56 successful checks and one intentionally skipped documentation job. The failed history remains in the same run and was not waived under #96.

The main first attempt recorded a 15-second command-fixture timeout on Windows 11 ARM/x64 with Node 22.x. Its Node 24.0.0 and 24.x cases failed the 60-second system PowerShell readiness check before invoking the candidate (`candidate_invoked=false`). The source, timeouts and assertions stayed unchanged; all three cases and aggregate acceptance passed on the second attempt. The final main result was also 56 successful checks and one intentionally skipped documentation job.

| Validation | Result and evidence |
| --- | --- |
| Final PR | [PASS](https://github.com/fbincon/claude-code-statusline/actions/runs/39942651085): eight installed targets, 32 Node cases, thirteen hosts and aggregate acceptance |
| Implementation main | [PASS](https://github.com/fbincon/claude-code-statusline/actions/runs/39946518666): eight installed targets, 32 Node cases, thirteen hosts and aggregate acceptance |
| Historical Python reference | [PASS](https://github.com/fbincon/claude-code-statusline/actions/runs/39946731889): frozen reference and mixed-runtime recovery |
| v3.6.0 public downloads | [PASS](https://github.com/fbincon/claude-code-statusline/actions/runs/39946736835): six cases across three systems and Node 22/24 |
| npm dry-run | [PASS](https://github.com/fbincon/claude-code-statusline/actions/runs/39946741308): prepare succeeded; publish intentionally skipped |
| Initial Dependabot scan | [PASS](https://github.com/fbincon/claude-code-statusline/actions/runs/39946535839): GitHub accepted and executed the Actions update configuration |

All main/manual validations use the implementation main above. The npm dry run checks existing release inputs, preparation and registry bytes; it does not request npm publishing credentials or verify real OIDC publication. This task creates no version tag, npm publication or Release, and preserves the existing v3.6.0 identities.

Main and manual validations passed. The documentation-only evidence follow-up uses the ordinary documentation route, with links checked from a committed-files-only export. After its documentation gate, synchronize final main to Gitee using an explicit refspec after checking divergence. The six [issue #96 gaps](https://github.com/fbincon/claude-code-statusline/issues/96) remain unverified; this task's acceptance does not waive new automated failures or turn the dry run into publication evidence.
