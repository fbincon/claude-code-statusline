# Public release body checklist

**English** | [简体中文](release-body-checklist.zh-CN.md)

This 2026-11-14 documentation delivery adds a public release body checklist to the release guide. It distinguishes repository release pages from the GitHub/Gitee Release body and records the title, bilingual body, required blocks, four attachments, evidence boundary and Gitee renderer/readback requirements. Product behavior, commands, public interfaces and published releases are unchanged. No version, tag, Release or npm publication is created.

## Changes

| Area | Result |
| --- | --- |
| Checklist | `docs/RELEASING.md#public-release-body-checklist` covers the English title, bilingual body convention, required blocks and four attachment links. |
| Page/body split | The checklist distinguishes `docs/releases/vX.Y.Z.md` and `.zh-CN.md` from the external GitHub/Gitee Release body. |
| Gitee | The checklist requires `release:gitee-notes`, the appended Gitee/original-publication sections, reserved-heading avoidance and metadata/attachment readback. |
| Checker | No new checker; the release-note checks and the Gitee renderer remain authoritative. |

## Source identities

- Baseline before the task: `c87f8c13`.
- Implementation commit and final head are recorded in the PR description after CI.

## Validation and limits

| Check | Actual result |
| --- | --- |
| `npm run docs:check` | 7,331 links, 0 errors |
| `docs.test.js` | 54/54 passed |
| `npm run check` | Isolated group 1,185/1,185 passed; serial group 585/591 passed with 6 platform skips; 0 failures |
| `npm run build` | Passed |
| `git diff --check` | Passed |
| Impact plan and scoped checks | Recorded in the PR description after CI |

This delivery does not add a release-body validator, modify a published Release or its attachments, or perform product, installed, platform or paid acceptance.
