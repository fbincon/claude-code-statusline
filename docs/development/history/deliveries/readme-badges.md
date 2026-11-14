# README badges and Code of Conduct link

**English** | [简体中文](readme-badges.zh-CN.md)

This 2026-11-14 documentation delivery replaces the plain npm and MIT links in both READMEs with npm-version and MIT badges, and links the Code of Conduct from the contributing section. It creates no product version, tag, Release or npm publication.

## Changes

| Area | Result |
| --- | --- |
| README presentation | Added the npm-version badge and static MIT badge in `README.md` and `README.zh-CN.md`; the CI badge is unchanged. |
| Community entry | Linked the Code of Conduct from “Contributing and security” / “贡献与安全” in both READMEs. |
| Documentation index | Added this bilingual record to the history indexes. |

## Source identities

- Baseline before the task: `9a992c60`.
- Implementation commit and final head are recorded in the PR description after CI.

## Validation and limits

| Check | Actual result |
| --- | --- |
| `npm run docs:check` | 7,354 links, 0 errors. |
| `git diff --check` | Passed. |
| `npm run build` | Passed. |
| `node --test dist/typescript/tools/checks/test/docs-content.test.js dist/typescript/tools/checks/test/docs-examples.test.js` | 34 tests passed, 0 failed. |
| `node --test dist/typescript/tools/checks/test/docs.test.js` | 54 tests passed, 0 failed. |

Scoped impact-plan and CI evidence are recorded in the PR description. No product, installed, official-host, terminal, physical or paid acceptance was run; this documentation change does not alter product behavior. The shields.io badges are external images; the local `LICENSE` and Code of Conduct links resolve. Frozen historical records and release notes were not changed.
