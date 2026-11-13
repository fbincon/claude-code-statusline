# Release notes index, navigation and template

**English** | [简体中文](docs-releases-organization.zh-CN.md)

This 2026-11-13 maintenance pass reorganizes `docs/releases` around one annotated index, a uniform language entry and a single current-release template. Product behavior, public interfaces, stored formats and published GitHub/Gitee Release bodies are unchanged. No version, tag, Release or npm publication is created.

## Changes

| Round | Result |
| --- | --- |
| Index and language navigation | Rebuilt both indexes with the current stable callout, dates from CHANGELOG, Latest/Stable/Preview status, one-line summaries and clickable language links. Added top language navigation and visible `english`/`简体中文` anchors to 38 historical pages; v3.9.0 keeps its visible Chinese heading. Labelled the seven Chinese summaries and added minimal status notes. |
| Current-era template | Aligned the v3.10.0–v3.16.3 English/Chinese pairs to one block order: date and delivery record, summary, change bullets, compatibility/install, platforms, #96 and known limits, decision/process links. Moved source SHA, cost, request/replay and harness detail to existing delivery records; fixed three translation divergences. |
| Governance | Added the release-note template to RELEASING (English/Chinese), pointers in CONTRIBUTING and AGENTS, `checkReleases` in `tools/checks/docs.ts` and fourteen new tests. |

## Source identities

- Baseline before the task: `62e27e01`.
- PR1 index and navigation: merge `3b22bbafadd515698656708f81f9f0ac90cb96cd` (PR #246).
- PR2 current-era template: merge `eeb43e1dbb17a3936a69549b9579f7bae97940e5` (PR #247).
- PR3 governance: final head and merge identity are recorded in the PR description after CI.

## Validation and limits

| Check | Actual result |
| --- | --- |
| `npm run docs:check` | 7,185 local links, 0 errors after the check addition |
| `git diff --check` | Passed |
| Historical anchor preservation | 0 headings or explicit anchors removed in PR1 |
| Index completeness | 60 tags in each index, no duplicates or unknown entries |
| Release template tests | `docs.test.js`: 17/17 passed, including fourteen new release cases |
| Gitee release-body test | 12/12 passed |
| Impact plan and scoped receipt | Recorded by the PR3 description |

No installed-product, physical, editor, paid-model or new platform acceptance is performed. The six issue #96 gaps remain unverified. Historical content is not rewritten: the three versionless H1s, the seven Chinese summaries and all commands and evidence stay frozen; published Release bodies are not edited. Repository copies may differ from the immutable public bodies only by navigation, labels, status notes and the current-era template.