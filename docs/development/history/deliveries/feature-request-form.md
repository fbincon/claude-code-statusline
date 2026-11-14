# Feature request form

**English** | [简体中文](feature-request-form.zh-CN.md)

This 2026-11-14 documentation delivery adds a bilingual Feature request Issue form, routes feature ideas to it while keeping blank Issues for questions, and synchronizes the contribution guides, governance pages, template registry and delivery history. It creates no product version, tag, Release or npm publication.

## Changes

| Area | Result |
| --- | --- |
| Issue form | Added `.github/ISSUE_TEMPLATE/feature_request.yml` with required problem/use-case and proposed-solution fields, optional alternatives and additional context, and the `enhancement` label. `blank_issues_enabled` remains `true`. |
| Contribution entry | Split feature ideas from questions in `CONTRIBUTING.md` and `CONTRIBUTING.zh-CN.md`; feature ideas use the new form and questions use a blank Issue. |
| Governance pages | Updated `docs/development/repository-governance.md`, `docs/development/repository-governance.zh-CN.md`, `docs/development/roadmap.md` and `docs/development/roadmap.zh-CN.md` to match the new routing. |
| Template registry | Added the Issue forms row using `checkCommunity` to `docs/development/README.md` and `docs/development/README.zh-CN.md`. |
| Documentation index | Added this bilingual record to both development history indexes. |

## Source identities

- Baseline before the task: `cd6ee50f`.
- Implementation commit and final head are recorded in the PR description after CI.

## Validation and limits

| Check | Actual result |
| --- | --- |
| `npm run docs:check` | 7,374 links, 0 errors. |
| `git diff --check` | Passed. |
| `npm run build` | Passed. |
| `node --test dist/typescript/tools/checks/test/docs-content.test.js dist/typescript/tools/checks/test/docs-examples.test.js` | 34 tests passed, 0 failed. |
| `node --test dist/typescript/tools/checks/test/docs.test.js` | 54 tests passed, 0 failed. |

Scoped impact-plan and CI evidence are recorded in the PR description. No product, installed, official-host, terminal, physical or paid acceptance was run; this documentation change does not alter product behavior. GitHub renders the form and applies its label; local checks validate only the YAML structure and links, and no test Issue was submitted. Frozen historical records, release notes, the root README and product code were not changed.
