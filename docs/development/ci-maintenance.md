# CI maintenance and Action identities

**English** | [简体中文](ci-maintenance.zh-CN.md)

Current native capacity and recovery use bounded visible frames and add three-platform Claude 2.1.310 gates; see [implementation and acceptance](native-capacity.md).

## CI latency and stability work

### Candidate promotion across PR, main and tag

Ready product PRs execute complete acceptance once. A normal two-parent merge into main reuses that candidate when the final accepted PR head/base equal the actual merge parents and the complete Git trees match. The actual first parent's latest main run and required aggregate must have passed. A batched push is eligible when its earlier push boundary is an ancestor of that first parent; the boundary does not replace the real merge base. Main installs the original package and exercises version, install, doctor, rendering, revision-bound configuration writes and uninstall on Linux, Windows and macOS. These independent smoke jobs identify the actual integration commit and original source/package and can be retried separately.

`policyDigest` still binds an evidence envelope to the executable rules in its own immutable source. Its path selection and historical interpretation are unchanged. **A difference from the previous main digest never selects the full matrix.** Product, generated resources, approval data, new acceptance cases, screenshots, CI observation, release notes, build tools, workflows, release validators and acceptance dependency changes all use the same content/provenance decision. There is no tool, directory or release-version exemption list.

### Route table and blocking conditions

| Event or verified condition | Route and validation | Reason / limitation |
| --- | --- | --- |
| Allowlisted documentation-only PR or main push | Documentation checks and required aggregate | No candidate/release evidence is produced |
| Draft product PR | Quick local checks; required aggregate fails | Not final acceptance |
| Ready product PR | Full 8 installation / 32 runtime / 16 host matrix and applicable 197 capacity cases | Scope predicts the future merge route, conditionally on this final run passing |
| Owned two-parent main merge, accepted head/base and identical whole tree | Reuse original PR matrix; three smokes, immutable-base verifier, promotion contract regressions and aggregate | Includes executable policy and workflow changes |
| Batch containing that merge | Same reuse route if push boundary is an ancestor and actual first-parent gate passed | An unvalidated intermediate base blocks; an unrelated/unknown push range blocks |
| Accepted PR but actual merged tree, head or accepted base differs | Full main at the actual integration commit | That integrated source/relationship has not received complete acceptance |
| Squash, rebase, direct/non-two-parent integration or no unique owned merge PR | Full main; ambiguous owned PR provenance blocks | Equal trees alone do not establish original source ancestry, compiler restoration or tag/npm source identity |
| Source genuinely predates CI envelopes, or base predates the independent verifier | Full main bootstrap | Missing protocol capability is distinct from missing evidence for a supported protocol |
| Latest applicable PR/base/main run failed, cancelled, incomplete, or lacks its successful required aggregate | Block | Never choose an older green run or hide the failure in an automatic full fallback |
| Supported evidence missing, expired, corrupt, mismatched or ambiguous; invalid approval; independent verifier rejects | Block | Repair the cause or explicitly design a protocol migration; repetition of the new verifier is not independent proof |
| Manual `validation=full` | Explicit complete validation; `Manual validation (not PR evidence)` | No promotable `ci-evidence.json`; output is `ci-manual-acceptance` |
| Manual `validation=promotion-shadow` on main | Independently re-evaluate reuse, three smokes and promotion contracts | Diagnostic main receipt only; no full matrix and no PR/tag/npm evidence |
| Other manual probes | Named isolated diagnostics | Cannot satisfy PR or release acceptance |
| Annotated tag at accepted source with successful main integration (or same-commit complete main) | Verify original source, bytes, complete receipts, approval, tag and main ancestry | Missing applicable modern evidence blocks; only genuinely legacy sources retain full tag acceptance |

The scope log and job summary report the actual route/mode/reason, source PR/run/commit, accepted first parent/run, original envelope and artifact IDs, four delivery hashes and changed paths. PR scope predicts whether an up-to-date merge commit can reuse its tree; this forecast is not acceptance and cannot guarantee later artifact availability or a changed merge/base. All dynamic conditions are checked again on main. Path changes are explanatory output, never the reuse predicate.

### Independent verification and main/tag obligations

Every reuse promotion exports the verifier TypeScript blobs from the **actual, previously accepted first parent** into an isolated temporary directory. It imports that parent's `ci-sources`, `ci-evidence` and `ci-integration` implementations, independently re-reads the latest applicable source and base runs, checks merge/head/base/tree, workflow source, envelope, full coverage and immutable downloaded bytes. Candidate compiler outputs never replace this verifier. The current verifier additionally rechecks the required aggregate and original job IDs, names, times and attempts against Actions. It reads the observed run attempt explicitly, avoiding the mutable latest-jobs alias, then re-reads run status/attempt so a concurrent retry cannot supply a stale successful gate. Current release checks validate all current receipt semantics and source-bound approval. Three-platform integration and focused route/tag/npm/aggregate/workflow regressions cover behavior unique to promotion without repeating the product matrix.

This trust boundary is the already accepted base plus review of the new workflow/driver, not two executions of the same changed validator. Regression fixtures replace HEAD's validators with no-ops and verify that the exported base still rejects tampered bytes and a wrong PR. Workflow regressions require the cross-check before compiler restoration and before promotion. Incompatible future evidence formats or changed coverage require an explicit, reviewed compatibility/migration check; they block rather than silently ignoring the old verifier. The one-time absence of any base verifier uses the documented bootstrap route. New main receipts use schema 2 and record verifier commit/tree, base run, source envelope and original record hash; schema-1 historical receipts remain readable without rewriting them.

An annotated release tag normally points at the fully accepted **PR source commit**, reachable from main through the verified merge. The tag gate checks that PR's latest complete run, successful main integration, tag object, version-scoped approval, source tree/policy and all original four-file/receipt/input/compiler digests. The same-commit main-to-tag route remains available for complete-main fallback and older evidence. Squash/rebase support is deliberately not broadened: retaining two-parent/head/base checks avoids making an unreachable PR commit a release source or restoring its compiler outputs under a rewritten identity. Promotion records separate actual checks from reused coverage and never rewrite package commits or original receipts.

Complete automatic runs retain schema-v1 `ci-evidence.json` alongside `candidate-acceptance.json`. The envelope records source/toolchain/runtime/host identities, original job attempts and receipt/artifact hashes. Same-name artifacts are ordered by their API creation timestamps: IDs are opaque and a successful retry can have a smaller ID than an older failed upload. Missing or tied timestamps block ambiguous selection; a corrupt, expired or failed newest artifact cannot fall back to an older success. Original successful executions from earlier attempts retain their job IDs and times. Before restoring executable compiler outputs, consumers verify the original archive and manifest digests; restoration across commits additionally requires equal trees and source reachability.

The npm resolver follows tag promotion back to its original complete run, revalidates the chain and publishes the same package bytes. Source archives, independent builds, source rebuilds, draft-asset checks, OIDC context and public-download acceptance retain their existing requirements. Source/evidence artifacts expire after 30 days. Refresh with a new complete execution of the appropriate original PR/main event, then reverify integration/tag; manual diagnostics and unrelated successful runs cannot replace that evidence. No historical source identity, published package, receipt or release record is rewritten.

### Release data and acceptance policy

Version approval registrations belong in [the approval registry](../releases/approvals/registry.json), alongside each version-specific decision JSON. Add the version, approval path and exact approval date there; adding a release must not edit `tools/release/approval.ts`. Both data files are source-bound release inputs in the Git tree, source archive and candidate identity. They are not executable rules and do not enter the policy digest. Executable `tools/release/` files, including future validators, remain in that digest; it is compared with the accepted source, not used to trigger a matrix because the previous main differed.

`release:prepare` and promotion read registration and decision from the verified source archive, not the checkout. Registration requires a unique stable version/path and valid calendar date; the decision must match its version/date, maintainer, authority, reference and exact six accepted gaps. The original acceptance receipt records both file digests. Historical archives without a registry can read their literal registration table without executing it; malformed new registries never fall back. See [release preparation](../RELEASING.md#source-bound-ci-evidence-promotion) and [routing regressions](testing.md#release-approval-and-ci-routing).

### Development and execution routes

The macOS identity adapter reads `PROC_PIDTBSDINFO` through the existing native bridge, checks the full structure and PID, and retains the C-locale/UTC `ps lstart` token including single-digit-day spacing. Unknown results remain unverifiable and zombies are not live. The ABI is checked against [Apple's definitions](https://github.com/apple-oss-distributions/xnu/blob/main/bsd/sys/proc_info.h); real macOS tests compare the token with `ps`. Manual `validation=macos-probe` repeats the affected six-language transaction journey twenty times on Intel and ARM, with 1,000 direct identity comparisons per runner. It produces diagnostic evidence only.

Draft product PRs run `Draft quick checks` (the complete local Linux check command) but cannot pass `Complete candidate evidence`. Opening, synchronizing, reopening, marking ready and converting back to draft all reclassify the current head. Ready product PRs require complete coverage; allowlisted documentation is checked in the classification job without a product build. The aggregate executes its dependency-free checker directly with pinned Node. PR updates cancel superseded runs; main/tag runs are grouped by immutable commit rather than cancelling another revision's evidence.

Development checks and the two independent clean builds run in parallel, and both must pass before platform work begins. The development job distributes portable compiler outputs with an exact commit, lockfile and per-file/archive digests. Consumers install native dependencies locally, verify the bundle and restore only the six fixed compiled-output roots. Independent builds never use this bundle. Platform jobs run all source tests, while repository-static generation/docs/archive/inventory commands run centrally. Source tests use two isolated file workers, with native process/lock, terminal, timing and recovery suites retained in a serial group. Unknown locations remain included and serial; `STATUSLINE_TEST_WORKERS=1` supports comparison.

Node selectors resolve once per candidate. All 8/32/16 logical obligations remain: when the development runtime exactly matches a Node case, the installed job's complete source suite and unchanged isolated installation cover that case too. The shared receipt references that execution and requires its source-test receipt, executable digest and source hashes; it is not a new test run. Other runtimes remain separate jobs. The two real historical-version sequences use isolated child processes with separate prefixes, HOME, configuration, cache, registry and traces. Windows runs them sequentially to avoid competing npm/copy fixtures; other platforms run them concurrently. Failures cancel siblings and await termination before cleanup. Each original sequence retains its own 900-second budget (1,200 seconds with an official host); the additional v3.12 editor-execution phase has its own 900/1,200-second timer and receipt. Release validation rejects missing or over-budget phases; enclosing budgets sum these independent obligations.

Manual `validation=windows-probe` runs the source-process regressions, same-runner old/new supervisor measurement and real installed acceptance on Windows x64 and ARM-host/x64. It cannot produce aggregate release acceptance. The final full matrix also repeats the original 20-second native long scenario ten times on Windows Claude 2.1.289 and 2.1.294, retaining the exact test body, source digest, individual times and logs before running the ordinary full host suite. The Windows console probe runs the unchanged terminal-policy and external-editor scenarios first, using a fixture-only Node preload to record child-process terminal bytes while keeping real console handles. `test:installed -- --diagnostic-pattern REGEX` retains PowerShell preparation and all selected assertions; its receipt is explicitly non-promotable and never has passing full-acceptance status.

The diagnostic probe optionally preloads a timing subscriber into management commands. The product's `claude-statusline.management-timing` diagnostics channel reports only phase names and durations for npm, copying, archive verification and transaction checkpoints; normal commands have no subscriber and keep protocol output unchanged. Diagnostic traces are separate from ordinary cold-install evidence. Registry/cache settings are read in one npm `config list --json` call while retaining npm's configuration precedence, prefix/root checks and credential rejection ([npm configuration](https://docs.npmjs.com/cli/v10/commands/npm-config/)).

[Issue #157](https://github.com/fbincon/claude-code-statusline/issues/157) tracks staged optimization. Complete candidate coverage remains 8 installation targets, 32 runtime cases, 16 official hosts and 197 applicable native-capacity cases. Ordinary delivery uses one complete candidate matrix followed by main integration and tag verification; only the unaccepted integration/protocol bootstrap cases in the route table retain the full fallback.

Candidate preparation downloads the immutable 3.7.0 and 3.8.0 archives once, verifies their pinned SHA-256 values and distributes a separate `ci-historical-inputs` artifact. The cache key contains both immutable digests, has no fallback keys and never stores test results; restored files are rehashed before use. Consumers use the existing `TS06_LEGACY_370_ARTIFACT` / `TS06_LEGACY_380_ARTIFACT` inputs and independently recheck their bytes. Candidate installation still starts outside the checkout with an empty cache, offline npm and lifecycle scripts disabled. Direct local preparation uses the same downloader when no supplied archive exists.

The historical cache uses [actions/cache v4.3.0](https://github.com/actions/cache/tree/v4.3.0), resolved to `0057852bfaa89a56745cba8c7296529d2fc39830`. The Node release index has the same bounded transient retry policy and records its digest and resolution time; selectors are never resolved independently by matrix consumers.

Downloads allow three attempts with one- and two-second backoff only for eligible transient connection failures and HTTP 408/429/500/502/503/504. Corruption, invalid gzip, oversized content, permissions and exhausted retries fail. Version, fixed URL, phase, attempts and duration are logged without credentials. Official-host receipts retain bounded, sanitized successful and failed command logs with phase durations and run identity. Candidate and acceptance artifacts have explicit 30-day retention; compressed package uploads avoid redundant compression.

Use `npm run ci:watch -- --run RUN_ID --head FULL_SHA --watch --report dist/validation/ci/RUN_ID.json` for deterministic observation. It uses the existing authenticated `gh` account locally or the Actions token in CI; it never prints tokens or mutates GitHub. It polls the pinned run and current job progress with 15/30/60-second backoff, emits only changed states and failure-step summaries, and retrieves complete paginated attempt/step timings at completion. A rerun starting during collection is not reported as an older success. The report separates queue time, execution time and attempts. Exit 0 means successful completion, 1 failed CI and 2 incomplete observation; a deadline does not cancel CI. Never count retained successful jobs as newly executed samples.

Real Git repository tests are resource-sensitive and remain serial: Windows diagnostics exposed missing observations and subprocess timeouts when they shared two-worker execution. `validation=windows-source-probe` runs twenty isolated package-history cleanup repetitions with reference/protection diagnostics, the unchanged runtime suite and ten direct Git-suite repetitions on the affected Windows x64/ARM and Node combinations, without candidate or release acceptance.

Manual runs use the separate aggregate name `Manual validation (not PR evidence)`, including intentionally skipped diagnostic gates. They cannot overwrite the required PR check with a successful or skipped diagnostic status.

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

## CI-01 implementation

**Status: DONE.** Implementation baseline: `95206119dab6f931f320277d25889fea8da49528` (2026-10-23). Product baseline remains v3.6.0. This maintenance task does not create a version, tag, npm publication or Release.

CI-01 pins the existing Action majors, adds an offline identity check and enables weekly Actions update proposals. Existing workflow triggers, permissions, Node/build versions, platform and host matrices, OIDC and release conditions remain in place. [Roadmap](roadmap.md#milestones) · [Scope and acceptance](development-plan.md#ci-01).

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

## Local and CI checks

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run actions:check
npm run check
git diff --check
```

`actions:check` parses `.github/workflows/**/*.yml` and `.yaml` with the fixed development-only `yaml` dependency. It checks step Actions, job-level reusable workflows and reachable local Action manifests. External repository references require a full 40-character commit SHA and a semantic version comment; Docker steps require a full SHA-256 digest. Local `./` references retain their normal checkout-relative behavior. Referenced definitions must exist inside the checkout, and local composite dependencies are checked once per file.

The checker handles quoted keys, flow mappings, aliases and folded scalars, ignores script/comment examples, and fails on malformed YAML, duplicate keys, unresolved references or an empty workflow inventory. Diagnostics include the file and line; failure exits nonzero. Its offline check verifies reference and comment syntax. Reviewers verify the actual version-to-commit association against the official upstream source.

The CI scope job runs this check before classifying the change, and `npm run check` runs it before the ordinary suite. The existing aggregate gate requires scope success. Workflow, Dependabot and tool changes continue to require the full final-PR product matrix; allowlisted documentation and community templates use necessary documentation checks and do not produce release acceptance receipts.

### Community documentation checks

The lightweight route includes the existing README/CHANGELOG and `docs/**/*.md` paths, root `AGENTS.md`, root `SECURITY.md`/`CONTRIBUTING.md` with their `.zh-CN.md` counterparts, `.github/pull_request_template.md`, and the exact Issue template paths `bug_report.yml`, `config.yml` and legacy `preview-feedback.yml`. The legacy path allows its replacement or deletion. Agent guidance adds only the exact root `AGENTS.md` path, without a wildcard for other instruction files. Other `.github` paths and mixed product/documentation changes still require the full matrix. Unknown Git revisions and executable-to-document renames cannot enter this documentation route. Tag and manual events follow the explicit route table above.

`npm run docs:check` checks local links and anchors in Markdown, the single bilingual PR template, and Markdown content in Issue forms and chooser links. Root policy documents require separate English/Chinese files, except the root `AGENTS.md`, which is maintained in English only and retains link and anchor checks. The exception does not apply to same-named files under `docs/`. The PR template and forms contain both languages in one file. The existing development-only YAML parser checks form structure, explicit unique field IDs, required flags, dropdown choices and contact-link names, HTTP(S) URLs and explanations. This is an offline check of the fields maintained here, not a replacement for GitHub's renderer; inspect the actual chooser and templates after merging. See [GitHub's form syntax](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms).

`Complete candidate evidence` remains the single aggregate check. On the lightweight route it requires successful scope and documentation jobs and intentionally skipped product jobs; full acceptance requires every product job, while reuse requires successful integration and promotion with product jobs intentionally skipped. Classifier/checker edits require regression tests, complete final-PR acceptance and main verification under the route table, including the independent accepted-base check.

## Weekly updates and review procedure

[Dependabot configuration](../../.github/dependabot.yml) checks only `github-actions`, with a weekly Monday 09:00 schedule in `Asia/Shanghai`. Minor/patch updates share one group and at most one open version-update PR; major version updates are ignored. PRs target the default branch and require normal review and CI. See [GitHub's options reference](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference). An initial scan with no newer eligible version does not need to create a PR.

For every automatic or manual update:

1. Read the official release notes and compare the pinned source with the proposed commit. Keep the current major; assess any runtime, runner or permission changes separately.
2. Resolve the exact version tag in the official Action repository, for example:

   ```bash
   gh api --hostname github.com repos/actions/checkout/git/ref/tags/v4.4.0 \
     --jq '{ref: .ref, type: .object.type, sha: .object.sha}'
   ```

   If the object is an annotated tag, follow its Git tag object until reaching the commit. Record the full commit, version and official source in the PR. Never obtain credentials by printing tokens.
3. Update all occurrences of that Action's SHA and exact version comment together. Run `actions:check`, its regression tests, `npm run check` and whitespace checks. Inspect the diff for permissions, triggers, matrices and release-condition changes.
4. Require successful CI for the final reviewed PR head, then verify the merged main. Run the affected manual workflows when their references change. Documentation-only evidence follow-ups use the normal documentation route.

If an update regresses a workflow, revert the specific update through a PR to restore its previously verified SHA/comment, then revalidate the affected workflows. Preserve existing release tags and npm selectors. No force update of published release identities is part of this procedure.

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
