# Contributing guide maintenance

**English** | [简体中文](contributing-maintenance.zh-CN.md)

This 2026-11-14 documentation maintenance aligns the contributing guides with the documentation governance established by the November documentation reorganization and PR #250. It adds registered-guide content checks, image manifest/provenance duties, bilingual delivery-record rules, current/history ownership, release-note index and frozen-page rules, updated CI responsibility classification, PR evidence expectations and precision fixes across both languages. The PR template validation prompt is updated to match. Product behavior, commands, public interfaces, stored formats and published releases are unchanged. No version, tag, Release or npm publication is created.

## Changes

| Area | Result |
| --- | --- |
| Development checks | Registered root and current development guides now list the build and source-backed content/example tests, the registration list, `docs-example` marker maintenance and regression expectations. |
| CI classification | The guide now distinguishes the complete product matrix for product logic, protocols, runtime dependencies and bundled skill instructions from package comparison for build/generation inputs; `Complete candidate evidence` is described as the protected aggregate rather than full-matrix coverage. |
| PR evidence | Contributors are asked to describe resulting behavior and tradeoffs and record the impact route, selected tasks, actual results and limitations; evidence must be sanitized. The PR template validation prompt now matches. |
| Delivery records | The guide now requires a bilingual record under `docs/development/history/deliveries/`, linked from the delivery index with source and artifact identities, actual checks, results and limits; frozen records are not rewritten and documentation maintenance does not imply a release. |
| Ownership and history | Current procedures stay under `docs/development`, frozen records under `docs/development/history`, and the CLI reference owns current interface and format versions; moved pages keep compatibility stubs. |
| Release and images | Release notes align to the v3.9.2 boundary, both language indexes and frozen historical pages; image changes now require gallery index, bilingual README/status, tree, related guides and capture/provenance manifest consistency. |
| Precision fixes | Gitee now mirrors code and release files; toolchain versions reference `.node-version` and `package.json`; the English-only note names `AGENTS.md`; the bilingual exception covers canonical product skill resources; acceptance categories and paid-check budget/ledger wording are aligned. |

## Source identities

- Baseline before the task: `e51d040d`.
- Implementation commit and final head are recorded in the PR description after CI.

## Validation and limits

| Check | Actual result |
| --- | --- |
| `npm run docs:check` | 7,231 local links, 0 errors (baseline 7,213) |
| `git diff --check` | Passed |
| Documentation content and example tests | Not required: CONTRIBUTING and the PR template are not registered content pages |
| Impact plan and scoped check | Selected tasks and results are recorded in the PR description after CI |

This is documentation-only maintenance. It does not perform installed-product, editor, platform, provider or paid-model acceptance, and it does not revalidate the existing behavior/compatibility policy statements. Historical content is not rewritten. The six accepted issue #96 gaps remain unverified.
