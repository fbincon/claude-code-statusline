# Pull request template and Issue routing governance

**English** | [简体中文](pr-issue-template-governance.zh-CN.md)

This 2026-11-14 documentation and check delivery adds a structural check for the single bilingual pull request template, replaces stale `preview-feedback.yml` routing with a top-level Issue-form wildcard, and corrects the registration wording in the development README. Product behavior, commands, public interfaces, stored formats and published releases are unchanged. No version, tag, Release or npm publication is created.

## Changes

| Area | Result |
| --- | --- |
| Pull request template | `checkPullRequestTemplate` validates the four bilingual headings as exact lines, the four follow-up labels, contribution-guide links and sanitization hint; `checkCommunity` runs it before the Issue-template directory early return, and the repository self-check requires the canonical template to exist. |
| Issue routing | `documentationOnly` and `createImpactPlan` accept any top-level `.github/ISSUE_TEMPLATE/*.yml`/`.yaml` form and reject nested forms; the obsolete `preview-feedback.yml` allowlist entry is removed. |
| Tests | Community, CI-scope and impact-plan tests cover valid/invalid templates, `.yaml` forms, nested forms and the real repository template. |
| Documentation | Contributing, agent guidance, repository governance, CI maintenance, impact checks and the template/check registry describe the new boundary. |
| Registration wording | The development README now names the actual `checkDocumentationRegistration` allowlist and `DOCUMENT_CONTENT_PATHS` instead of the nonexistent `UNREGISTERED_CURRENT_PAGES`. |

## Source identities

- Baseline before the task: `6c7e321b`.
- Implementation commit and final head are recorded in the PR description after CI.

## Validation and limits

| Check | Actual result |
| --- | --- |
| `npm run docs:check` | 7,298 links, 0 errors |
| `community.test.js` + `ci-scope.test.js` + `impact-plan.test.js` | 36/36 passed |
| `npm run check` | 585/591 passed, 6 platform skips, 0 failures; 118 generated resources |
| `npm run build` | Passed |
| `git diff --check` | Passed |
| Impact plan and scoped checks | Recorded in the PR description after CI |

The frozen `docs/releases/v3.0.0-beta.1.md` keeps its historical `preview-feedback.yml` link; this delivery does not rewrite frozen release pages. It does not add a feature-request form or an advisory PR title check, and it performs no product, installed, platform or paid acceptance.
