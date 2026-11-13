# Changelog template and format check

**English** | [简体中文](changelog-template-maintenance.zh-CN.md)

This 2026-11-14 documentation and check maintenance adds a project-specific CHANGELOG template to the release guide, documents its boundary, and introduces `checkChangelog` with baseline and future-entry rules. It also aligns the Chinese changelog title and terminology, corrects the release-index wording, and links the template from CONTRIBUTING and AGENTS. Product behavior, commands, public interfaces, stored formats and published releases are unchanged. No version, tag, Release or npm publication is created.

## Changes

| Area | Result |
| --- | --- |
| Template | `docs/RELEASING.md#changelog-template` and its Chinese pair define the heading, 3–7 summary bullets, compatibility bullet, canonical footer, evidence limits and issue-reference form. |
| Baseline checks | `checkChangelog` validates one H1, version headings and dates, descending order, duplicate versions, the top version against `release.ts`, bilingual version/date/bullet parity, and release-note links from v3.0.0. |
| Future-entry checks | Entries at or after `3.16.4` additionally require an em dash heading, a publication line matching the heading date, `Release notes`/`发布说明` as the first final-bullet link, and terminal punctuation. |
| Tests | Ten new cases cover the accepted historical/current fixture, duplicate and out-of-order versions, date order, top-version mismatch, missing release links, bilingual bullet drift, and the three strict future rules. |
| Documentation | CONTRIBUTING and AGENTS point to the template; the Chinese H1 uses `变更日志`; release-index wording uses “concise version summaries” / “简明版本摘要”. |
| History | Earlier changelog entries remain frozen; the template applies prospectively from `3.16.4`. |

## Source identities

- Baseline before the task: `355bfaa4`.
- Implementation commit and final head are recorded in the PR description after CI.

## Validation and limits

| Check | Actual result |
| --- | --- |
| `npm run docs:check` | 7,246 local links, 0 errors (baseline 7,239) |
| `npm run build` | Passed |
| `docs.test.js` | 28/28 passed |
| `docs-content.test.js` + `docs-examples.test.js` | 34/34 passed |
| `npm run check` | 585/591 passed, 6 platform skips, 0 failures; 118 generated resources |
| `git diff --check` | Passed |
| Impact plan and scoped checks | Selected tasks and results are recorded in the PR description after CI |

This is documentation and check maintenance. It does not rewrite historical changelog entries, correct the deferred Chinese semantic issues, or perform installed-product, editor, platform, provider or paid-model acceptance. The checker validates structure, not prose quality. The six accepted issue #96 gaps remain unverified.
