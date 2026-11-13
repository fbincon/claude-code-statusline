# CI maintenance and Action identities

**English** | [简体中文](ci-maintenance.zh-CN.md)

[Impact checks and maintenance evidence](impact-checks.md) defines the enabled classifier, local commands, scoped receipts and maintenance-source release binding. Only core product behavior requires the complete product matrix; the compatibility foundation was accepted before enabling this routing.

Current native capacity and recovery use bounded visible frames and add three-platform Claude 2.1.310 gates; see [implementation and acceptance](native-capacity.md).

The measurements include same-package language samples, history time, artifact sizes, queue time and the runner cost of a native single-job rerun. [CI acceptance measurements](ci-efficiency.md)

## Language evidence compatibility

I18N-02 separates product acceptance from language publication readiness. The accepted-base exporter includes the pure build-only language analyzer; complete and maintenance records bind a versioned language report to their original source and all declared inputs. Main may reuse safe B-language fallback acceptance, while both complete-source and maintenance-source public releases require complete A/B readiness. Missing activated reports cannot use legacy pre-v3.15 compatibility. Language metadata is build-owned and requires generation, consuming checks and actual package comparison; generated fallback membership is presentation data only when exact generation and origin rules agree. Original source/policy digest meanings and receipt identities stay unchanged. See [implementation](history/deliveries/i18n-02-delivery.md) and [authoring](i18n.md#incremental-authoring).

## Complete evidence versions

The dual reader reached accepted main before the versioned producer was enabled. The original v1 envelope still describes a complete historical suite on every installation, Node and host combination. The v2 reader chooses the contract from the immutable source and its activation history. It reconstructs the expected obligations from the frozen Node inputs and the verified comparison base. The planner records which physical execution satisfies each obligation and which Windows ARM stage owns it. Deleting the activation marker, submitting a v1 envelope for an activated commit or substituting an earlier green job blocks promotion.

The verifier checks the original run, attempt, job ID and times, artifact ID and digest, candidate bytes, runner and executable identities, history depth and section results. For the current twelve-language source, v2 verifies 313 capacity cases per host. The 197-case field in a v1 envelope retains its historical meaning. When Actions retains an unaffected job during a rerun its original identity is preserved. The accepted first parent performs this verification before candidate compiler output is restored. Activated sources emit v2 on automatic complete runs.

### Historical depth and Windows ARM jobs

Every logical target installs and exercises the candidate on its own required runtime or references an identical original execution. Short history installs the pinned 3.8.0 package, upgrades to the candidate and rolls back to 3.8.0. It checks actual versions, entry, configuration and required restore. An official host additionally exercises marketplace installation, backend bindings, explicit disablement and third-party settings. Full history also exercises 3.7.0, integrity refusal, fault injection, editor execution and independent package/configuration recovery.

| Runner | Full history on ordinary core changes |
| --- | --- |
| Ubuntu 24.04 x64 | All four Node selectors and the development Node |
| Windows 2025 x64 | 22.x, 24.0.0 |
| Windows 11 ARM, x64 Node | 22.0.0, 24.x |
| macOS 14 ARM | 22.0.0 |
| macOS 15 ARM / Intel | 24.0.0 / 22.x |
| macOS 26 ARM / Intel | 24.x on both |
| Fixed Claude hosts (eight full / eight short) | Linux 2.1.287, Windows 2.1.288 and all three OSes for 2.1.289 and 2.1.310 |

Using the versions frozen in #198, the 40 logical installation/Node obligations comprise 14 full and 26 short histories. The 16 fixed hosts comprise eight full and eight short histories. Exact declarations, Mod tests, capacities and Windows stability stay on the relevant host. Node aliases share only when both binaries and inputs match. The Windows ARM language, history and remaining installation jobs each own their prefix, configuration and cache. Relocation and the shell, editor and recovery checks that depend on it stay together. Each fixed host has a recorded capability, regression and replacement criterion. Review a pinned probe before changing the inventory. [Coverage policy](../../tools/checks/ci-coverage.ts)

## CI latency and stability work

### Candidate promotion across PR, main and tag

Ready core-product PRs execute complete acceptance once. An equivalent normal two-parent merge reuses that candidate after checking the final accepted PR head/base, actual merge parents, complete tree and accepted first-parent gate; Linux/Windows/macOS integration smokes exercise the original package. Maintenance PRs instead execute their impact-plan checks and main reuses those scoped receipts through the independent accepted-base verifier. A push boundary is only an ancestry boundary, never a replacement for the real first parent.

`policyDigest` continues to bind each complete envelope to its own immutable executable rules, with unchanged historical interpretation. It is not the impact classifier. Policy changes alone do not select the product matrix: the planner uses file responsibilities, dependency ownership and required package comparisons. Multiple maintenance categories union their checks; unknown ownership blocks.

### Route table and blocking conditions

| Event or verified condition | Route and validation | Boundary |
| --- | --- | --- |
| Documentation, media or other registered maintenance | Union of impact-plan checks and required aggregate | No complete product acceptance claim |
| Draft PR | Feedback only; required aggregate fails | Not promotable |
| Ready core-product PR | Complete product acceptance per [testing and acceptance](testing.md#current-typescript-checks) and all current capacity obligations | Final immutable source |
| Equivalent accepted core merge | Original complete evidence, accepted-base verification and three integration smokes | Actual parents and complete tree must match |
| Equivalent accepted maintenance merge | Original scoped receipts and accepted-base verification | No new candidate or full matrix |
| Changed integration relationship or tree | Reclassify actual main; maintenance checks or core acceptance as indicated | Cannot borrow mismatched PR evidence |
| Unknown path, unresolved comparison or ambiguous provenance | Block | No automatic full-matrix fallback |
| Latest applicable run failed/cancelled/incomplete, or required evidence missing/expired/corrupt | Block | No older-green substitution; complete compatibility transitions must verify actual complete evidence |
| Tag at accepted complete source | Existing immutable product promotion | Original bytes and main ancestry remain required |
| Tag at accepted maintenance source | Current-source reproducible build/rebuild, product equivalence, three installation smokes and release approval | Explicit original product-coverage linkage |
| Manual full/probe/promotion-shadow | Named diagnostics; separate aggregate | Never PR/tag/npm evidence |

The scope log and job summary identify the actual route, source/base, changed responsibilities, selected tasks and reused evidence. Core-PR merge forecasts remain conditional and are not acceptance. Main rechecks live relationships and evidence; complete-source reuse still requires equal whole trees, while maintenance uses its own source-bound plan and receipts.

### Independent verification and main/tag obligations

Complete-source promotions export the verifier TypeScript blobs from the actual, previously accepted first parent and independently check merge/head/base/tree, workflow provenance, original complete coverage and downloaded bytes. Current checks also bind original job IDs, names, times and attempts to Actions. Maintenance promotions use the corresponding frozen impact verifier and scoped receipts described in [impact evidence](impact-checks.md#evidence-and-promotion). Candidate compiler output never replaces either verifier. Only complete-source promotion adds the fixed three-platform integration smokes; maintenance runs the tasks its plan requires.

This trust boundary is the already accepted base plus review of the new workflow/driver, not two executions of the same changed validator. Regression fixtures replace HEAD's validators with no-ops and verify that the exported base still rejects tampered bytes and a wrong PR. Workflow regressions require the cross-check before compiler restoration and before promotion. Incompatible future evidence formats or changed coverage require an explicit, reviewed compatibility/migration check; they block rather than silently ignoring the old verifier. The one-time absence of any base verifier uses the documented bootstrap route. New main receipts use schema 2 and record verifier commit/tree, base run, source envelope and original record hash; schema-1 historical receipts remain readable without rewriting them.

For complete-product sources, an annotated release tag normally points at the accepted PR source commit reachable through its verified main merge. The original complete run, integration, tag, approval and immutable bytes remain required. Maintenance-source tags use the separate release binding and newly built current-source bytes. Rewritten integration cannot reuse a mismatched PR package/compiler identity. Promotion records always distinguish executed checks from reused coverage.

Complete automatic runs retain the source-versioned `ci-evidence.json` alongside `candidate-acceptance.json`. The envelope records source/toolchain/runtime/host identities, original job attempts and receipt/artifact hashes. Same-name artifacts are ordered by their API creation timestamps: IDs are opaque and a successful retry can have a smaller ID than an older failed upload. Missing or tied timestamps block ambiguous selection; a corrupt, expired or failed newest artifact cannot fall back to an older success. Original successful executions from earlier attempts retain their job IDs and times. Before restoring executable compiler outputs, consumers verify the original archive and manifest digests; restoration across commits additionally requires equal trees and source reachability.

The npm resolver revalidates either complete-source promotion or maintenance-source release binding and publishes exactly the selected package bytes. Source archives, independent/source rebuilds, approval, draft assets, OIDC and public-download checks remain required. Evidence retention remains 30 days. Required expired evidence blocks and must be refreshed through the appropriate original automatic event; manual diagnostics cannot replace it. Ordinary maintenance does not require downloading an old product candidate. Historical sources, receipts and published identities are never rewritten.

### Release data and acceptance policy

Version approval registrations belong in [the approval registry](../releases/approvals/registry.json), alongside each version-specific decision JSON. Add the version, approval path and exact approval date there; adding a release must not edit `tools/release/approval.ts`. Both data files are source-bound release inputs in the Git tree, source archive and candidate identity. They are not executable rules and do not enter the policy digest. Executable `tools/release/` files, including future validators, remain in that digest; it is compared with the accepted source, not used to trigger a matrix because the previous main differed.

`release:prepare` and promotion read registration and decision from the verified source archive, not the checkout. Registration requires a unique stable version/path and valid calendar date; the decision must match its version/date, maintainer, authority, reference and exact six accepted gaps. The original acceptance receipt records both file digests. Historical archives without a registry can read their literal registration table without executing it; malformed new registries never fall back. Use the [approval decision template](../RELEASING.md#approval-decision-template) for the decision file and registry row. See [release preparation](../RELEASING.md#source-bound-ci-evidence-promotion) and [routing regressions](testing.md#release-approval-and-ci-routing).

### Installed acceptance deadlines

The installed test runner budgets the actual sequence of work. Sequential stages add their limits. Concurrent historical journeys contribute the longest branch. The supervising process also allows time for preparation, process termination, cleanup and the receipt. Each scenario keeps its own deadline. In particular, an appearance scenario has 120 seconds once it starts. Progress messages identify the active stage without renewing that deadline.

Two Windows ARM-host/x64 jobs illustrate why the outer limit matters. At PR #190 the first appearance scenario had run for 4.64 seconds when the old 55-minute limit fired. At PR #198 the last scenario had run for 52.86 seconds. Both logs already contained 26 passing tests. A later failure on the final #198 head involved an artifact upload after the product tests had passed. Keep the stage, original failure and retry identities when diagnosing similar runs. [PR #190 timeout](https://github.com/fbincon/claude-code-statusline/actions/runs/41007969032/job/123908643050) · [PR #198 timeout](https://github.com/fbincon/claude-code-statusline/actions/runs/41168202931/job/124441167592) · [PR #198 upload](https://github.com/fbincon/claude-code-statusline/actions/runs/41180416268/job/124477485935).

### Recovering artifact transfers

Ordinary installation, Node and Mod workers take the original tarball and a checksum manifest from the producing job's immutable artifact ID. Verify the expected source, original full artifact, package digest and frozen plan before running candidate code. The complete candidate still contains the four delivery files for independent release verification and promotion. Keep all original run, attempt, job and artifact identities when the required event reuses an execution.

A runner can recover a temporary connection failure, an applicable service error or a supported rate limit within the transfer deadline. The upload client gets at most one additional submission after its built-in recovery. When completion is uncertain, look up the object from the original run and producing attempt, then compare its file contents. A permissions error, corrupt ZIP, digest conflict, missing required input or ambiguous object blocks the operation. A runner loss requires a native targeted retry when GitHub allows the run to be retried. Select the failed physical job and let Actions schedule its dependent aggregate. [GitHub job reruns](https://docs.github.com/en/rest/actions/workflow-runs#re-run-a-job-from-a-workflow-run)

Use the step name, phase report and original exception to classify a failure. An exhausted parent allowance while a child still has valid time is an orchestration fault. A failed product assertion requires inspection of the assertion and its inputs. A lost runner or missing platform prerequisite is an environment failure. An artifact transport error after passing assertions records a failed transfer. Keep an unexplained exit unclassified until its logs identify the cause. The `ci:watch` report separates each attempt's fresh runner seconds and queue seconds from retained executions.

### Development and execution routes

The macOS identity adapter reads `PROC_PIDTBSDINFO` through the existing native bridge, checks the full structure and PID, and retains the C-locale/UTC `ps lstart` token including single-digit-day spacing. Unknown results remain unverifiable and zombies are not live. The ABI is checked against [Apple's definitions](https://github.com/apple-oss-distributions/xnu/blob/main/bsd/sys/proc_info.h); real macOS tests compare the token with `ps`. Manual `validation=macos-probe` repeats the affected six-language transaction journey twenty times on Intel and ARM, with 1,000 direct identity comparisons per runner. It produces diagnostic evidence only.

Draft core-product PRs run quick local feedback but cannot pass the required aggregate. Ready core PRs require full coverage; maintenance follows the impact plan. Opening, synchronizing, reopening and draft-state transitions reclassify the current head. PR updates cancel superseded runs; main/tag runs retain immutable-commit grouping. Manual runs retain their separate aggregate name.

Development checks and the two independent clean builds run in parallel, and both must pass before platform work begins. The development job distributes portable compiler outputs with an exact commit, lockfile and per-file/archive digests. Consumers install native dependencies locally, verify the bundle and restore only the six fixed compiled-output roots. Independent builds never use this bundle. Platform jobs run all source tests, while repository-static generation/docs/archive/inventory commands run centrally. Source tests use two isolated file workers, with native process/lock, terminal, timing and recovery suites retained in a serial group. Unknown locations remain included and serial; `STATUSLINE_TEST_WORKERS=1` supports comparison.

Node selectors resolve once per candidate. All installation, Node and host logical obligations remain: when the development runtime exactly matches a Node case, the installed job's complete source suite and unchanged isolated installation cover that case too. The shared receipt references that execution and requires its source-test receipt, executable digest and source hashes; it is not a new test run. Other runtimes remain separate jobs. In the full profile, the two real historical-version sequences use isolated child processes with separate prefixes, HOME, configuration, cache, registry and traces. Windows runs them sequentially to avoid competing npm/copy fixtures; other platforms run them concurrently. Failures cancel siblings and await termination before cleanup. Each original sequence retains its own 900-second budget (1,200 seconds with an official host); the additional v3.12 editor-execution phase has its own 900/1,200-second timer and receipt. Release validation rejects missing or over-budget phases. The enclosing budget follows the sequential or parallel schedule and includes preparation and teardown.

Manual `validation=windows-probe` runs the source-process regressions, same-runner old/new supervisor measurement and real installed acceptance on Windows x64 and ARM-host/x64. It cannot produce aggregate release acceptance. The final full matrix also repeats the original 20-second native long scenario ten times on Windows Claude 2.1.289 and 2.1.294, retaining the exact test body, source digest, individual times and logs before running the ordinary full host suite. The Windows console probe runs the unchanged terminal-policy and external-editor scenarios first, using a fixture-only Node preload to record child-process terminal bytes while keeping real console handles. `test:installed -- --diagnostic-pattern REGEX` retains PowerShell preparation and all selected assertions; its receipt is explicitly non-promotable and never has passing full-acceptance status.

The diagnostic probe optionally preloads a timing subscriber into management commands. The product's `claude-statusline.management-timing` diagnostics channel reports only phase names and durations for npm, copying, archive verification and transaction checkpoints; normal commands have no subscriber and keep protocol output unchanged. Diagnostic traces are separate from ordinary cold-install evidence. Registry/cache settings are read in one npm `config list --json` call while retaining npm's configuration precedence, prefix/root checks and credential rejection ([npm configuration](https://docs.npmjs.com/cli/v10/commands/npm-config/)).

[Issue #157](https://github.com/fbincon/claude-code-statusline/issues/157) records earlier latency work. Core candidates retain the complete [product acceptance matrix](testing.md#current-typescript-checks) and all current native-capacity obligations. Core delivery uses one complete matrix, main integration and tag verification. Maintenance uses scoped checks and explicit evidence linkage; policy changes alone do not trigger full acceptance.

Candidate preparation downloads the immutable 3.7.0 and 3.8.0 archives once, verifies their pinned SHA-256 values and distributes a separate `ci-historical-inputs` artifact. The cache key contains both immutable digests, has no fallback keys and never stores test results; restored files are rehashed before use. Consumers use the existing `TS06_LEGACY_370_ARTIFACT` / `TS06_LEGACY_380_ARTIFACT` inputs and independently recheck their bytes. Candidate installation still starts outside the checkout with an empty cache, offline npm and lifecycle scripts disabled. Direct local preparation uses the same downloader when no supplied archive exists.

The historical cache uses [actions/cache v4.3.0](https://github.com/actions/cache/tree/v4.3.0), resolved to `0057852bfaa89a56745cba8c7296529d2fc39830`. The Node release index has the same bounded transient retry policy and records its digest and resolution time; selectors are never resolved independently by matrix consumers.

Historical package downloads allow three attempts with one- and two-second backoff only for eligible transient connection failures and HTTP 408/429/500/502/503/504. Corruption, invalid gzip, oversized content, permissions and exhausted retries fail. Version, fixed URL, phase, attempts and duration are logged without credentials. Official-host receipts retain bounded, sanitized successful and failed command logs with phase durations and run identity. Candidate and acceptance artifacts have explicit 30-day retention; compressed package uploads avoid redundant compression.

Use `npm run ci:watch -- --run RUN_ID --head FULL_SHA --watch --report dist/validation/ci/RUN_ID.json` for deterministic observation. It uses the existing authenticated `gh` account locally or the Actions token in CI; it never prints tokens or mutates GitHub. It polls the pinned run and current job progress with 15/30/60-second backoff, emits only changed states and failure-step summaries, and retrieves complete paginated attempt/step timings at completion. A rerun starting during collection is not reported as an older success. The report separates queue time, execution time and attempts. Exit 0 means successful completion, 1 failed CI and 2 incomplete observation; a deadline does not cancel CI. Never count retained successful jobs as newly executed samples.

Real Git repository tests are resource-sensitive and remain serial: Windows diagnostics exposed missing observations and subprocess timeouts when they shared two-worker execution. `validation=windows-source-probe` first reuses installed acceptance's bounded 60-second system PowerShell readiness phase and records `candidate_invoked=false`; the original source-command deadline remains 15 seconds. It then runs twenty isolated package-history cleanup repetitions with reference/protection diagnostics, the unchanged runtime suite and ten direct Git-suite repetitions on the affected Windows x64/ARM and Node combinations, without candidate or release acceptance.

Manual runs use the separate aggregate name `Manual validation (not PR evidence)`, including intentionally skipped diagnostic gates. They cannot overwrite the required PR check with a successful or skipped diagnostic status.

## Local and CI checks

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run actions:check
npm run check
git diff --check
```

`actions:check` parses `.github/workflows/**/*.yml` and `.yaml` with the fixed development-only `yaml` dependency. It checks step Actions, job-level reusable workflows and reachable local Action manifests. External repository references require a full 40-character commit SHA and a semantic version comment; Docker steps require a full SHA-256 digest. Local `./` references retain their normal checkout-relative behavior. Referenced definitions must exist inside the checkout, and local composite dependencies are checked once per file.

The checker handles quoted keys, flow mappings, aliases and folded scalars, ignores script/comment examples, and fails on malformed YAML, duplicate keys, unresolved references or an empty workflow inventory. Diagnostics include the file and line; failure exits nonzero. Its offline check verifies reference and comment syntax. Reviewers verify the actual version-to-commit association against the official upstream source.

The CI scope job always checks Action identities before routing. Workflow, Dependabot, checker and release-policy changes use the corresponding scoped regressions, with package comparison when build inputs are affected. A changed policy digest alone does not require product acceptance. The required aggregate validates all selected jobs and deliberate skips.

### Community documentation checks

Documentation/media checks cover maintained Markdown, community templates and registered documentation assets, including screenshot metadata and Mod/package README files. Product skill instructions remain execution inputs. Mixed maintenance unions the necessary checks; product behavior requires the complete matrix. Unknown revisions or responsibilities block. See the [impact ownership rules](impact-checks.md#responsibilities-and-checks).

`npm run docs:check` checks local links and anchors in Markdown, the single bilingual PR template, and Markdown content in Issue forms and chooser links. Root policy documents require separate English/Chinese files, except the root `AGENTS.md`, which is maintained in English only and retains link and anchor checks. The exception does not apply to same-named files under `docs/`. The PR template and forms contain both languages in one file. The existing development-only YAML parser checks form structure, explicit unique field IDs, required flags, dropdown choices and contact-link names, HTTP(S) URLs and explanations. This is an offline check of the fields maintained here, not a replacement for GitHub's renderer; inspect the actual chooser and templates after merging. See [GitHub's form syntax](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms).

`Complete candidate evidence` remains the single protected aggregate. Maintenance requires its selected scoped checks or verified reuse and its own evidence envelope; core acceptance requires the full product jobs; complete-source promotion requires integration/promotion; maintenance-source tags require fresh release build, smoke and binding jobs. Unexpected skips, drafts and missing evidence fail. Classifier/checker changes receive scoped regressions and accepted-base verification rather than an automatic full product matrix.

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
3. Update all occurrences of that Action's SHA and exact version comment together. Run `actions:check`, its regression tests, the impact-plan checks and whitespace checks. Inspect the diff for permissions, triggers, matrices and release-condition changes.
4. Require successful CI for the final reviewed PR head, then verify the merged main. Run the affected manual workflows when their references change. Documentation-only evidence follow-ups use the normal documentation route.

If an update regresses a workflow, revert the specific update through a PR to restore its previously verified SHA/comment, then revalidate the affected workflows. Preserve existing release tags and npm selectors. No force update of published release identities is part of this procedure.

## Historical delivery records

- <a id="measured-rollout-evidence-for-issue-157"></a>[Measured rollout evidence for issue #157](history/deliveries/ci-maintenance-delivery.md#measured-rollout-evidence-for-issue-157)
- <a id="ci-01-implementation"></a>[CI-01 implementation](history/deliveries/ci-maintenance-delivery.md#ci-01-implementation)
- <a id="initial-reference-inventory-and-provenance"></a>[Initial reference inventory and provenance](history/deliveries/ci-maintenance-delivery.md#initial-reference-inventory-and-provenance)
- <a id="validation-and-completion-evidence"></a>[Validation and completion evidence](history/deliveries/ci-maintenance-delivery.md#validation-and-completion-evidence)
