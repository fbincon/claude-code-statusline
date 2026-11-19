# CI maintenance and Action identities

**English** | [简体中文](ci-maintenance.zh-CN.md)

Ordinary merges use [local impact checks](impact-checks.md). GitHub workflows cover release validation and on-demand diagnostics.

The measurements include same-package language samples, history time, artifact sizes, queue time and the runner cost of a native single-job rerun. [CI acceptance measurements](ci-efficiency.md)

## Language evidence compatibility

I18N-02 separates product acceptance from language publication readiness. The accepted-base exporter includes the pure build-only language analyzer; complete and maintenance records bind a versioned language report to their original source and all declared inputs. Main may reuse safe B-language fallback acceptance, while both complete-source and maintenance-source public releases require complete A/B readiness. Missing activated reports cannot use legacy pre-v3.15 compatibility. Language metadata is build-owned and requires generation, consuming checks and actual package comparison; generated fallback membership is presentation data only when exact generation and origin rules agree. Original source/policy digest meanings and receipt identities stay unchanged. See [implementation](history/deliveries/i18n-02-delivery.md) and [authoring](i18n.md#incremental-authoring).

## Complete evidence versions

The dual reader reached accepted main before the versioned producer was enabled. The original v1 envelope still describes a complete historical suite on every installation, Node and host combination. The v2 reader chooses the contract from the immutable source and its activation history. It reconstructs the expected obligations from the frozen Node inputs and the verified comparison base. The planner records which physical execution satisfies each obligation and which Windows ARM stage owns it. Deleting the activation marker, submitting a v1 envelope for an activated commit or substituting an earlier green job blocks promotion.

The verifier checks the original run, attempt, job ID and times, artifact ID and digest, candidate bytes, runner and executable identities, history depth and section results. For the current twelve-language source, v2 verifies 313 capacity cases per host. The 197-case field in a v1 envelope retains its historical meaning. When Actions retains an unaffected job during a rerun its original identity is preserved. The accepted first parent performs this verification before candidate compiler output is restored. Historical automatic complete runs emit v2. The full diagnostic suite still uses that coverage plan.

### Historical depth and Windows ARM jobs

Every logical target installs and exercises the candidate on its own required runtime or references an identical original execution. Short history installs the pinned 3.8.0 package, upgrades to the candidate and rolls back to 3.8.0. It checks actual versions, entry, configuration and required restore. An official host additionally exercises marketplace installation, backend bindings, explicit disablement and third-party settings. Full history also exercises 3.7.0, integrity refusal, fault injection, editor execution and independent package/configuration recovery.

| Runner | Full-history cases in the diagnostic suite |
| --- | --- |
| Ubuntu 24.04 x64 | All four Node selectors and the development Node |
| Windows 2025 x64 | 22.x, 24.0.0 |
| Windows 11 ARM, x64 Node | 22.0.0, 24.x |
| macOS 15 ARM | 22.0.0 and 24.0.0 |
| macOS 15 Intel | 22.x |
| macOS 26 ARM / Intel | 24.x on both |
| Fixed Claude hosts (eight full / eight short) | Linux 2.1.287, Windows 2.1.288 and all three OSes for 2.1.289 and 2.1.310 |

The full diagnostic suite has 35 logical installation and Node obligations, with 14 full and 21 short histories. The 16 fixed hosts follow the history profile in the table. Exact declarations, Mod tests, capacities and Windows stability stay on the relevant host. Node aliases share only when both binaries and inputs match. The Windows ARM language, history and remaining installation jobs each own their prefix, configuration and cache. Relocation and the shell, editor and recovery checks that depend on it stay together. Each fixed host has a recorded capability, regression and replacement criterion. Review a pinned probe before changing the inventory. [Coverage policy](../../tools/checks/ci-coverage.ts)

GitHub retired the macOS 14 runner image on 2026-11-02. The runner activation moves its full Node 22.0.0 history to macOS 15 ARM. Earlier evidence retains its original runner grid, depths and policy digest. [GitHub runner retirement](https://github.blog/changelog/2026-10-01-github-actions-macos-14-runner-image-retirement/)

## CI latency and stability work

### Candidate promotion across PR, main and tag

Ordinary PRs and their merges to `main` use local checks. Release CI runs for owned, ready `release/` PRs targeting `main`, their merged PR events, and version tag pushes. A normal PR can show skipped jobs without starting any project runner.

### Route table and blocking conditions

The candidate stage schedules 11 release PR jobs.

| Event | Execution |
| --- | --- |
| Ready release PR | One Linux development and reproducibility job, six package smokes, one official-host job per system, and the `Accept release candidate` aggregate |
| Release PR merged into `main` | Independent first-parent verification, three package smokes and `Accept release integration` |
| Annotated version tag | One verification job binds the release candidate and integration to the tag and original files |
| Manual dispatch | Release CI runs the same candidate jobs as a diagnostic. CI diagnostics offers the full suite and targeted probes. |

A release PR branch follows the standard type/description format, for example `release/next-patch`. Bring it up to date and merge with a two-parent merge commit after the final head passes. A new head requires its own checks. If the merge base or tree changes, prepare an up-to-date release PR and pass its checks before tagging.

### Independent verification and main/tag obligations

The merged PR event pins the actual merge SHA. The candidate must match the real second parent and the integrated tree. The first parent supplies independent TypeScript verifiers and is confirmed through the protected `main` merge history. The integration workers install the original PR package after verifying its digests.

The immutable source selects the release evidence format. Each receipt is bound to the workflow, original run, attempt, job, artifact digest and exact candidate bytes. Reuse preserves original job identity across targeted reruns. The latest applicable failed, cancelled or incomplete run blocks promotion, as do stale or missing artifacts and mismatched identities. Retention is 30 days. Retry the applicable original run when available. If it can no longer be rerun, prepare a new release PR.

The annotation points to the exact approved PR head that is reachable from `main`. The tag verifies the three-stage chain and the original four delivery files. npm preparation rechecks the chain before preparing the exact tgz for OIDC. The previous complete and maintenance readers apply to historical sources under their own activation rules. [Release guide](../RELEASING.md#source-bound-ci-evidence-promotion).

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

Select a branch and `validation` in [CI diagnostics](../../.github/workflows/ci-diagnostics.yml). The full suite covers additional runner images, Node versions, historical recovery, native capacity and additional official hosts. For installation, recovery or native integration work, run the relevant diagnostic to resolve uncertainty. The platform, language and artifact transfer probes keep their own reports.

Use `npm run ci:watch -- --run RUN_ID --head FULL_SHA --watch --report dist/validation/ci/RUN_ID.json` to record timings and original job identities. Its report distinguishes queue time, physical work and retained jobs across retries. Diagnose the failed phase and retry the original run.

## Local and CI checks

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run actions:check
npm run check
git diff --check
```

`actions:check` parses `.github/workflows/**/*.yml` and `.yaml` with the fixed development-only `yaml` dependency. It checks step Actions, job-level reusable workflows and reachable local Action manifests. External repository references require a full 40-character commit SHA and a semantic version comment; Docker steps require a full SHA-256 digest. Local `./` references retain their normal checkout-relative behavior. Referenced definitions must exist inside the checkout, and local composite dependencies are checked once per file.

The checker handles quoted keys, flow mappings, aliases and folded scalars, ignores script/comment examples, and fails on malformed YAML, duplicate keys, unresolved references or an empty workflow inventory. Diagnostics include the file and line; failure exits nonzero. Its offline check verifies reference and comment syntax. Reviewers verify the actual version-to-commit association against the official upstream source.

Run workflow identity and contract checks locally. The release candidate job runs `npm run check` before verifying the build.

### Community documentation checks

Documentation/media checks cover maintained Markdown, community templates and registered documentation assets, including screenshot metadata and Mod/package README files. Product skill instructions remain execution inputs. Combine the applicable maintenance checks. Run the local product suite for product behavior. Unknown revisions or responsibilities block. See the [impact ownership rules](impact-checks.md#responsibilities-and-checks).

`npm run docs:check` checks local links and anchors in Markdown, the single bilingual PR template, and Markdown content in Issue forms and chooser links. It also validates the PR template's required bilingual headings, follow-ups and guidance, and the impact plan treats any top-level `.github/ISSUE_TEMPLATE/*.yml`/`.yaml` form as documentation. Root policy documents require separate English/Chinese files, except the root `AGENTS.md`, which is maintained in English only and retains link and anchor checks. The exception does not apply to same-named files under `docs/`. The PR template and forms contain both languages in one file. The existing development-only YAML parser checks form structure, explicit unique field IDs, required flags, dropdown choices and contact-link names, HTTP(S) URLs and explanations. This is an offline check of the fields maintained here, not a replacement for GitHub's renderer; inspect the actual chooser and templates after merging. See [GitHub's form syntax](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms).

Follow the [route table](#route-table-and-blocking-conditions) for release PR, main and tag evidence.

## Weekly updates and review procedure

[Dependabot configuration](../../.github/dependabot.yml) checks only `github-actions`, with a weekly Monday 09:00 schedule in `Asia/Shanghai`. Minor/patch updates share one group and at most one open version-update PR; major version updates are ignored. PRs target the default branch and follow ordinary review and local checks. See [GitHub's options reference](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference). An initial scan with no newer eligible version does not need to create a PR.

For every automatic or manual update:

1. Read the official release notes and compare the pinned source with the proposed commit. Keep the current major; assess any runtime, runner or permission changes separately.
2. Resolve the exact version tag in the official Action repository, for example:

   ```bash
   gh api --hostname github.com repos/actions/checkout/git/ref/tags/v4.4.0 \
     --jq '{ref: .ref, type: .object.type, sha: .object.sha}'
   ```

   If the object is an annotated tag, follow its Git tag object until reaching the commit. Record the full commit, version and official source in the PR. Never obtain credentials by printing tokens.
3. Update all occurrences of that Action's SHA and exact version comment together. Run `actions:check`, its regression tests, the impact-plan checks and whitespace checks. Inspect the diff for permissions, triggers, matrices and release-condition changes.
4. Check the final reviewed head locally, then verify the merge on main. Run the affected manual workflows when their references change. Documentation-only evidence follow-ups use the normal documentation route.

If an update regresses a workflow, revert the specific update through a PR to restore its previously verified SHA/comment, then revalidate the affected workflows. Preserve existing release tags and npm selectors. No force update of published release identities is part of this procedure.

## Historical delivery records

- <a id="measured-rollout-evidence-for-issue-157"></a>[Measured rollout evidence for issue #157](history/deliveries/ci-maintenance-delivery.md#measured-rollout-evidence-for-issue-157)
- <a id="ci-01-implementation"></a>[CI-01 implementation](history/deliveries/ci-maintenance-delivery.md#ci-01-implementation)
- <a id="initial-reference-inventory-and-provenance"></a>[Initial reference inventory and provenance](history/deliveries/ci-maintenance-delivery.md#initial-reference-inventory-and-provenance)
- <a id="validation-and-completion-evidence"></a>[Validation and completion evidence](history/deliveries/ci-maintenance-delivery.md#validation-and-completion-evidence)
