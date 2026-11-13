# Root documentation maintenance

**English** | [简体中文](root-docs-maintenance.zh-CN.md)

This 2026-11-14 documentation maintenance updates root README and CHANGELOG entry points and historical links after the November documentation reorganization. It points recent changelog delivery links to canonical history records, restores 3.9.2 bullet ordering, adds Chinese anchors for combined release pages, and adds CLI reference/CHANGELOG entry points plus the per-task-effort host requirement to both READMEs. Product behavior, commands, public interfaces, stored formats and published releases are unchanged. No version, tag, Release or npm publication is created.

## Changes

| Area | Result |
| --- | --- |
| CHANGELOG delivery links | v3.16.3, v3.16.2 and v3.16.1 links now target `docs/development/history/deliveries/` records instead of compatibility stubs. |
| CHANGELOG ordering | The three v3.9.2 #157 entries now precede the release-notes and implementation link. |
| Chinese release navigation | Links to combined v3.9.2 and earlier release pages append `#简体中文`; already anchored links are unchanged. |
| README entry points | Documentation and help now link the CLI reference and CHANGELOG in both languages. |
| README requirements | The feature-requirement sentence now includes per-task effort 2.1.214+ for subagent rows. |

## Source identities

- Baseline before the task: `62af291b`.
- Implementation commit and final head are recorded in the PR description after CI.

## Validation and limits

| Check | Actual result |
| --- | --- |
| `npm run docs:check` | 7,239 local links, 0 errors (baseline 7,231) |
| `git diff --check` | Passed |
| `npm run build` | Passed |
| Documentation content and example tests | 34/34 passed (README is registered) |
| Impact plan and scoped check | Selected tasks and results are recorded in the PR description after CI |

This is documentation-only maintenance. It does not perform installed-product, editor, platform, provider or paid-model acceptance. Historical release pages, delivery records and images remain frozen; v3.16.1–v3.16.3 release-note delivery links are left unchanged. The six accepted issue #96 gaps remain unverified.
