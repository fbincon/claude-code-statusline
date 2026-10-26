# Repository maintenance

**English** | [简体中文](repository-governance.zh-CN.md)

## Collaboration and security

[GitHub](https://github.com/fbincon/claude-code-statusline) is primary for Issues, PRs, CI and security reporting; Gitee distributes synchronized code and releases. Start with [Contributing](../../CONTRIBUTING.md) for development and feedback, or the [security policy](../../SECURITY.md) for private vulnerability reports. The generic bilingual Bug form replaces the migration preview form; blank Issues remain available for questions and feature ideas. [Issue #96](https://github.com/fbincon/claude-code-statusline/issues/96) retains its existing platform follow-up role.

Root policies use English and Simplified Chinese companion files. GitHub forms and the PR template use one bilingual file each. The project README stays focused on introduction and usage; maintenance evidence belongs here or in delivery reports.

## Main protection and checks

The active [main-required-ci ruleset](https://github.com/fbincon/claude-code-statusline/rules/25857226), verified on 2026-10-26, targets `refs/heads/main`. All changes require a PR with the branch up to date and a successful `Complete candidate evidence` check from GitHub Actions. Required approvals are zero, including unattributed changes; there are no maintainer or automation bypass entries. Force pushes and deletion are blocked. Merge commits remain supported and linear history is not required.

The gate accepts successful documentation checks for explicitly allowlisted documentation/templates, or the complete applicable product matrix for other changes. Scope failure, missing/failed/cancelled evidence and unexpected skips fail the gate. See [CI maintenance](ci-maintenance.md) for paths, local commands and the classifier's regression checks. Do not weaken the rules or substitute another status source to finish a failed PR.

Successful PR merges automatically delete their head branches when GitHub permits it. Historical branches are retained. The initial inventory found 131 non-main branch heads already reachable from main and three not reachable; those are future review candidates, not authorization to delete them. Check active PRs, immutable commit identities and documentation links before any later cleanup.

## Dependency and release maintenance

Dependabot alerts, the dependency graph and security updates are enabled. Security update PRs require normal review and CI; there is no automatic merge. The existing weekly Actions version-update configuration stays in place; npm scheduled version updates are not enabled. Dependency fixes may require coordinated changes to the pinned manifest, lockfile, package builder and verifier. Secret scanning and push protection remain enabled.

Release immutability applies to future GitHub publications. Prepare and verify all four assets in a draft before publishing. Fix a published package through a new version; do not replace assets or move its associated tag. Historical releases are not rebuilt, and no blanket `v*` ruleset is added. Gitee copies require their own digest verification; see the [release process](../RELEASING.md).

Homepage points to the npm package; topics describe the current TypeScript/Node CLI and supported platforms. The empty Wiki is disabled and Projects is retained. CodeQL, npm scheduled updates and additional community services remain outside this maintenance change.

## Validation record

The checker implementation is [PR #148](https://github.com/fbincon/claude-code-statusline/pull/148), head `a800be3114065464e88f8648fd70534b3c67cf19`, merged as `eefdd59baf41b5800639b6fa8da2424a883b4670`. Local checks passed 1,248 tests with five platform-specific skips, 3,245 documentation links, generated resources, archive integrity and complete responsibility ledgers. Eleven focused scope/gate/community/documentation tests also passed.

The [final PR CI](https://github.com/fbincon/claude-code-statusline/actions/runs/40263118059) completed 56 applicable jobs with the documentation job intentionally skipped. Its first attempt included a Windows/Claude 2.1.289 integration test exceeding its existing 20-second timeout; the user reran failed jobs on the same head and the second attempt passed. The original failed evidence remains in the run. [Merged-main CI](https://github.com/fbincon/claude-code-statusline/actions/runs/40268711351) passed all 56 applicable jobs on its first attempt, with the documentation job intentionally skipped, before repository settings and the community-content PR.

The content PR uses only the lightweight route. Setting changes are checked by reading back the API and inspecting public entry points, without destructive push/tag probes, fabricated reports or test publication. Final PR/main identities, setting verification and the explicit Gitee synchronization result are recorded in the task's delivery report. This work creates no product version, tag, Release or npm publication. The six existing #96 gaps remain accepted but unverified and do not waive new automated failures.
