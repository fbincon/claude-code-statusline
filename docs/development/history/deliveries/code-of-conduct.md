# Bilingual Code of Conduct

**English** | [简体中文](code-of-conduct.zh-CN.md)

This 2026-11-14 documentation delivery adds the Contributor Covenant 2.1 Code of Conduct in English and Simplified Chinese and links it from the contribution guide. It creates no product version, tag, Release or npm publication.

## Changes

| Area | Result |
| --- | --- |
| Community policy | Added `CODE_OF_CONDUCT.md` and `CODE_OF_CONDUCT.zh-CN.md` with the Contributor Covenant 2.1 text and the maintainer contact. |
| Contribution entry | Added the Code of Conduct link to `CONTRIBUTING.md` and `CONTRIBUTING.zh-CN.md`. |
| Documentation index | Added this bilingual record to the history indexes. |

## Source identities

- Baseline before the task: `0f286e37`.
- Implementation commit and final head are recorded in the PR description after CI.

## Validation and limits

| Check | Actual result |
| --- | --- |
| `npm run docs:check` | 7,348 links, 0 errors. |
| `git diff --check` | Passed. |
| `npm run build` | Passed. |
| `node --test dist/typescript/tools/checks/test/docs-content.test.js dist/typescript/tools/checks/test/docs-examples.test.js` | 34 tests passed, 0 failed. |
| `node --test dist/typescript/tools/checks/test/docs.test.js` | 54 tests passed, 0 failed. |

Scoped impact-plan and CI evidence are recorded in the PR description. No product, installed, official-host, terminal, physical or paid acceptance was run; this documentation change does not alter product behavior. Frozen historical records and release notes were not changed.
