# Release artifact templates and checks

**English** | [简体中文](release-artifact-governance.zh-CN.md)

This 2026-11-14 documentation and check maintenance adds an approval-decision template and checkout validation, extends the release-note template checks for versions at or after 3.16.4, and adds release-index row and current-stable checks. It also links the approval template from the release-data policy. Product behavior, commands, public interfaces, stored formats and published releases are unchanged. No version, tag, Release or npm publication is created.

## Changes

| Area | Result |
| --- | --- |
| Approval template | `docs/RELEASING.md#approval-decision-template` and its Chinese pair document the decision JSON, registry row, historical v3.0.0 path and six accepted gaps. |
| Approval check | `checkApprovalData` validates the registry and every registered decision against the checkout; unregistered `v*.json` files fail. |
| Release notes | `checkReleases` now requires the issue #96 link, Node 22/24 block, delivery-record link, release-guide link, compatibility statement and summary for versions at or after 3.16.4. |
| Release index | Current-era rows must match their note date, localized status, summary and counterpart; exactly one current-stable row and callout are required. |
| Documentation | `docs/development/ci-maintenance.md` links the approval template from the release-data policy. |
| History | Earlier release pages, the approval registry order and existing decisions remain frozen. |

## Source identities

- Baseline before the task: `5802ca74`.
- Implementation commit and final head are recorded in the PR description after CI.

## Validation and limits

| Check | Actual result |
| --- | --- |
| `npm run docs:check` | 7,261 local links, 0 errors (baseline 7,255) |
| `npm run build` | Passed |
| `docs.test.js` | 50/50 passed, including the new release-note, index and approval cases |
| `docs-content.test.js` + `docs-examples.test.js` | 34/34 passed |
| `npm run check` | 585/591 passed, 6 platform skips, 0 failures; 118 generated resources |
| `git diff --check` | Passed |
| Impact plan and scoped checks | Selected tasks and results are recorded in the PR description after CI |

This is documentation and check maintenance. It does not rewrite published release notes, reorder the approval registry, or perform installed-product, editor, platform, provider or paid-model acceptance. The six accepted issue #96 gaps remain unverified.
