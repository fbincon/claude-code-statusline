# Delivery record template and check

**English** | [简体中文](delivery-record-governance.zh-CN.md)

This 2026-11-14 documentation and check maintenance adds a delivery-record template to the development history index, a boundary-aware structural checker, and the delivery-record footer rule for changelog entries from 3.16.4. It also links the template from the release guide, contributing guide and repository agent guidance. Product behavior, commands, public interfaces, stored formats and published releases are unchanged. No version, tag, Release or npm publication is created.

## Changes

| Area | Result |
| --- | --- |
| Template | `docs/development/history/README.md#delivery-record-template` and its Chinese pair define the dated intro, required heading spine, optional sections, `#final-release` rule and the 2026-11-14 boundary. |
| Checker | `checkDeliveryRecords` validates boundary records, bilingual intro dates, heading order, and history-index membership. Earlier and date-less records remain exempt. |
| Changelog | `checkChangelog` now requires the delivery-record link with `#final-release` in future entry footers, while keeping release notes as the first link. |
| Documentation | The release guide, contributing guides and `AGENTS.md` link the template. |
| History | Existing delivery records remain frozen; the template applies prospectively from 2026-11-14. |

## Source identities

- Baseline before the task: `093b07fd`.
- Implementation commit and final head are recorded in the PR description after CI.

## Validation and limits

| Check | Actual result |
| --- | --- |
| `npm run docs:check` | 7,255 local links, 0 errors (baseline 7,246) |
| `npm run build` | Passed |
| `docs.test.js` | 37/37 passed, including the new delivery-record and changelog cases |
| `docs-content.test.js` + `docs-examples.test.js` | 34/34 passed |
| `npm run check` | 585/591 passed, 6 platform skips, 0 failures; 118 generated resources |
| `git diff --check` | Passed |
| Impact plan and scoped checks | Selected tasks and results are recorded in the PR description after CI |

This is documentation and check maintenance. It does not rewrite historical delivery records, validate prose quality, or perform installed-product, editor, platform, provider or paid-model acceptance. The six accepted issue #96 gaps remain unverified.
