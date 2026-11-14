# Bug report label

**English** | [简体中文](bug-report-label.zh-CN.md)

This 2026-11-14 documentation delivery adds the `bug` label to the bilingual Bug report Issue form so new bug reports are triaged automatically. It creates no product version, tag, Release or npm publication.

## Changes

| Area | Result |
| --- | --- |
| Issue form | Added top-level `labels: [bug]` to `.github/ISSUE_TEMPLATE/bug_report.yml`; the existing bilingual fields and required validations are unchanged. |
| Documentation index | Added this bilingual record to both development history indexes. |

## Source identities

- Baseline before the task: `578c18c4`.
- Implementation commit and final head are recorded in the PR description after CI.

## Validation and limits

| Check | Actual result |
| --- | --- |
| `npm run docs:check` | 7,378 links, 0 errors. |
| `git diff --check` | Passed. |

Scoped impact-plan and CI evidence are recorded in the PR description. No product, installed, official-host, terminal, physical or paid acceptance was run; this documentation change does not alter product behavior. GitHub applies the label when the form is submitted; local checks validate only the YAML structure, and no test Issue was submitted. Frozen historical records, release notes, the root README and product code were not changed.
