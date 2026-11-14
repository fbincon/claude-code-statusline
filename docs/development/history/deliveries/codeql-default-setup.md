# CodeQL default setup and initial alert triage

**English** | [简体中文](codeql-default-setup.zh-CN.md)

This 2026-11-14 security-maintenance delivery records the CodeQL default setup and the triage of its first scan. It creates no product version, tag, Release or npm publication.

## Changes

| Area | Result |
| --- | --- |
| CodeQL configuration | Default setup enabled for GitHub Actions and JavaScript/TypeScript; Python disabled because it is a frozen archive. Standard GitHub runner, default query suite, remote-sources threat model, push/PR scans for `main` and protected branches, plus a weekly schedule. |
| Initial scan | Two analyses on `2c2044d0` completed without analysis errors. |
| Alert triage | 29 alerts reviewed and dismissed with recorded reasons: 14 test/tooling findings as used in tests or false positive; 15 `actions/cache-poisoning` findings as false positive because the candidate jobs use read-only permissions, Actions caches are branch-scoped, and the workflow is manually dispatched without an arbitrary commit input. |
| Open alerts after triage | 0. |
| Required checks | CodeQL remains separate from `Complete candidate evidence`; no ruleset change. |
| Product scope | No product source or behavior changes. |

## Source identities

- Baseline before the task: `2c2044d0`.
- Implementation commit and final head are recorded in the PR description after CI.

## Validation and limits

| Check | Actual result |
| --- | --- |
| `GET /code-scanning/default-setup` | `configured`; languages `actions`, `javascript`, `javascript-typescript`, `typescript`; `default` query suite; `remote` threat model; weekly schedule; standard runner. |
| `GET /code-scanning/analyses` | Two analyses on `2c2044d0`, no error. |
| `GET /code-scanning/alerts?state=open` | 0 after triage. |
| Dismissal readback | 29 alerts dismissed with recorded reasons and comments in the Security tab. |
| Documentation checks | `npm run docs:check`, `git diff --check`, build, docs-content/docs-examples and docs template tests for this governance-record PR. |

No product, installed, official-host, terminal, physical or paid acceptance was run; this security-maintenance change does not alter product behavior. CodeQL is not a required check; new alerts require triage. The dismissals are security decisions recorded in the Security tab and are not a substitute for reviewing future findings.
