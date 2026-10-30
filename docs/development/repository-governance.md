# Repository maintenance

**English** | [简体中文](repository-governance.zh-CN.md)

## Collaboration and security

[GitHub](https://github.com/fbincon/claude-code-statusline) is primary for Issues, PRs, CI and security reporting; Gitee distributes synchronized code and releases. Start with [Contributing](../../CONTRIBUTING.md) for development and feedback, or the [security policy](../../SECURITY.md) for private vulnerability reports. The generic bilingual Bug form replaces the migration preview form; blank Issues remain available for questions and feature ideas. [Issue #96](https://github.com/fbincon/claude-code-statusline/issues/96) retains its existing platform follow-up role.

Root policies use English and Simplified Chinese companion files, except [repository agent guidance](../../AGENTS.md), which is maintained in English only. That file records shared development rules; personal preferences, machine setup and credential handling remain in user-level guidance. GitHub forms and the PR template use one bilingual file each. The project README stays focused on introduction and usage; maintenance evidence belongs here or in delivery reports.

## Main protection and checks

The active [main-required-ci ruleset](https://github.com/fbincon/claude-code-statusline/rules/25857226), verified on 2026-10-26, targets `refs/heads/main`. All changes require a PR with the branch up to date and a successful `Complete candidate evidence` check from GitHub Actions. Required approvals are zero, including unattributed changes; there are no maintainer or automation bypass entries. Force pushes and deletion are blocked. Merge commits remain supported and linear history is not required.

PR checks follow the immutable [impact plan](impact-checks.md): documentation/media, presentation, tests, tools, CI and release data select scoped checks; core behavior and runtime dependencies require the complete product matrix. Mixed responsibilities combine their checks. Unknown ownership or unresolved package comparisons block. Draft fast checks cannot pass `Complete candidate evidence`.

An equivalent main merge reuses verified final-PR evidence through the appropriate product or maintenance route. The accepted base independently verifies source, merge/tree, original execution and artifacts; product promotion also requires integration smoke. Changed integrations are reclassified, and unavailable, expired, failed or cancelled evidence and unexpected skips remain blocking. [CI maintenance](ci-maintenance.md) owns the exact routes and expiry rules. Do not weaken classification, repository protection or status sources to finish a failed PR.

Successful PR merges automatically delete their head branches when GitHub permits it. Historical branches are retained. The 2026-10-26 inventory recorded 131 non-main branch heads already reachable from main and three not reachable; that historical inventory is not authorization to delete branches. Check active PRs, immutable commit identities and documentation links before any later cleanup.

## Dependency and release maintenance

Dependabot alerts, the dependency graph and security updates are enabled. Security update PRs require normal review and CI; there is no automatic merge. The existing weekly Actions version-update configuration stays in place; npm scheduled version updates are not enabled. Dependency fixes may require coordinated changes to the pinned manifest, lockfile, package builder and verifier. Secret scanning and push protection remain enabled.

The initial scan on 2026-10-26 found six alerts (one high, two moderate and three low) in `tools/acceptance/package-lock.json` and `tools/migration/ts-05/reference-requirements.txt`. Dependabot opened separate fixes for [setuptools #149](https://github.com/fbincon/claude-code-statusline/pull/149), [body-parser #150](https://github.com/fbincon/claude-code-statusline/pull/150) and [fast-uri #151](https://github.com/fbincon/claude-code-statusline/pull/151). The earlier root-workspace npm audit did not cover these independent dependency files. Those fixes were assigned separate review and checks; this inventory is a historical snapshot, not the current alert or PR status. The #96 platform acceptance exceptions do not apply to dependency alerts.

Release immutability applies to future GitHub publications. Prepare and verify all four assets in a draft before publishing. Fix a published package through a new version; do not replace assets or move its associated tag. Historical releases are not rebuilt, and no blanket `v*` ruleset is added. Gitee copies require their own digest verification; see the [release process](../RELEASING.md).

The repository metadata configured in that maintenance task points Homepage to the npm package, describes the TypeScript/Node CLI in Topics, disables the empty Wiki and retains Projects. CodeQL, npm scheduled updates and additional community services were outside that task.

## Validation record

The following records the 2026-10-26 governance delivery. Job counts, source identities and then-current routing are historical evidence; use the policies above and linked CI guides for current work.

The checker implementation is [PR #148](https://github.com/fbincon/claude-code-statusline/pull/148), head `a800be3114065464e88f8648fd70534b3c67cf19`, merged as `eefdd59baf41b5800639b6fa8da2424a883b4670`. Local checks passed 1,248 tests with five platform-specific skips, 3,245 documentation links, generated resources, archive integrity and complete responsibility ledgers. Eleven focused scope/gate/community/documentation tests also passed.

The [final PR CI](https://github.com/fbincon/claude-code-statusline/actions/runs/40263118059) completed 56 applicable jobs with the documentation job intentionally skipped. Its first attempt included a Windows/Claude 2.1.289 integration test exceeding its existing 20-second timeout; the user reran failed jobs on the same head and the second attempt passed. The original failed evidence remains in the run. [Merged-main CI](https://github.com/fbincon/claude-code-statusline/actions/runs/40268711351) passed all 56 applicable jobs on its first attempt, with the documentation job intentionally skipped, before repository settings and the community-content PR.

The content PR used the then-applicable lightweight route. Setting changes were checked by API readback and public entry inspection, without destructive push/tag probes or test publication. The task did not create a product version, tag, Release or npm publication. The six existing #96 gaps remain accepted but unverified and do not waive new automated failures.
