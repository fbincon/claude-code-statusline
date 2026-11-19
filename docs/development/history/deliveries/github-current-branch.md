# GitHub sources follow the current branch

**English** | [简体中文](github-current-branch.zh-CN.md)

This 2026-11-19 feature delivery lets one GitHub source and its bindings track PR and CI data as the worktree switches branches. The work creates no product version, tag, Release or npm publication. [Issue #227](https://github.com/fbincon/claude-code-statusline/issues/227)

## Changes

| Area | Result |
| --- | --- |
| Branch selection | New sources follow the current checkout by default. Use `branch: null` in a source definition or leave **PR head branch** blank in an editor. A branch name pins the source to that PR head. |
| Fixed branch diagnosis | Before any refresh, an inapplicable fixed source can display its configured branch. `source diagnose` reports `branch_mismatch` and gives the configured and current names. |
| Refresh identity | The worker checks the exact PR head branch and commit within the reviewed repository. Jobs and observations stay scoped to the checkout identity. A job overtaken by a local branch or HEAD change cancels without replacing the prior observation or pausing the old identity. |
| Compatibility | The first following source upgrades the source registry to v4. Package review uses the registry read range to prevent an incompatible downgrade. Editor protocol v32 covers both editors. Existing branch strings retain their fixed meaning. |

## Source identities

- Baseline `07acb62214d260ee4517dbbea43a145447501e47`.
- Both independent candidate builds used implementation commit `222bb7c3230b175849185cf8731c55329d9ff547` and produced package SHA-256 `8530857714a78d3c5c3d74819b201dfb9acaa800677da31e5efacf8a9cabc6f9`. The candidate verifier checked 1,102 files.
- Linux validation used Node 24.21.0 and Claude Code 2.1.322 with host SHA-256 `bfb3703ad5380242328459bc62ada4bde8ae7ba57c6e1eeadb9c00e08874c478`.
- The final head and check results are recorded in the pull request. [PR #278](https://github.com/fbincon/claude-code-statusline/pull/278)

## Validation and limits

| Check | Actual result |
| --- | --- |
| Local product and documentation | `npm run check` passed with 1,223 isolated tests and 590 serial tests. The serial group recorded six skips. Generated resources, bilingual examples and documentation validation, frozen replay, and archive checks passed. Language checks accepted the changed message keys in all twelve registered languages. |
| Impact routing and package smoke | `ci:plan` classified the implementation as a product change. The combined Linux `ci:check` invocation was rejected before execution because its budget estimate was 444 minutes. The digest-verified candidate separately passed the installed Linux smoke, including offline installation, configuration round trips, rendering and uninstall. |
| Live GitHub in one Linux PTY session | Following mode reported `no_pr` on `main`. Switching to the open PR branch displayed `#278` and `pending` from nine checks. The fixed source identified `main` as its configured branch. Detached HEAD suppressed the branch-bound values. Returning to `main` reused its cached result. |
| Official Mods | Strict validation and exact-host type checks passed. Claude Code 2.1.322 passed 356 Native and 18 Runtime tests. |
| Configuration and cost | The host probe preserved the originals or absence of eleven Claude and statusline paths and removed its isolated installation. It sent zero model requests and cost USD 0. |

A repeat on `main` displayed `no PR` for the fixed source, while the following source did not reach a successful observation within the probe deadline. A further retry stopped at a GitHub API `EOF` before starting the host. The passing session above supplies the branch-switch evidence.

Validation covered Linux and the named host. The six existing platform gaps remain unverified. [Issue #96](https://github.com/fbincon/claude-code-statusline/issues/96)
