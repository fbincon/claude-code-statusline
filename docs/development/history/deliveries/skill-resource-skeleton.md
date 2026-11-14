# Skill resource skeleton and check

**English** | [简体中文](skill-resource-skeleton.zh-CN.md)

This 2026-11-14 documentation and check delivery adds the canonical skill resource skeleton, a placeholder-aware structural check and bilingual guidance. The canonical `packages/cli/resources/*/SKILL.md` product inputs, product behavior, commands, public interfaces and published releases are unchanged. No version, tag, Release or npm publication is created.

## Changes

| Area | Result |
| --- | --- |
| Skeleton | `docs/development/skill-workflows.md#canonical-resource-skeleton` documents the frontmatter fields, name/directory agreement, argument hint, tool archetypes, placeholder handling and required body structure. |
| Check | `tools/checks/skill-resources.ts` exports `checkSkillResources`; it validates the installer's known placeholder tokens, rejects placeholders in the external skill, validates both tool archetypes, and counts one H1 across ATX/setext headings outside fenced code; `checkDocs` calls it. |
| Tests | `tools/checks/test/skill-resources.test.ts` covers both real archetypes, malformed frontmatter, name/description/hint/flag/tool failures, unknown/malformed/external placeholders, fenced code, setext headings, missing or multiple H1, empty body, CRLF and the real repository files. |
| Registration | The template/check registry and agent guidance link the skeleton and check. |
| Boundary | The check is a development contract; `packages/cli/resources` remains a product execution input and keeps the full product matrix when changed. |

## Source identities

- Baseline before the task: `6beb1379`.
- Implementation commit and final head are recorded in the PR description after CI.

## Validation and limits

| Check | Actual result |
| --- | --- |
| `npm run docs:check` | 7,311 links, 0 errors |
| `skill-resources.test.js` | 1/1 passed |
| `npm run check` | Isolated group 1,185/1,185 passed; serial group 585/591 passed with 6 platform skips; 0 failures |
| `npm run build` | Passed |
| `git diff --check` | Passed |
| Impact plan and scoped checks | Recorded in the PR description after CI |

This delivery does not edit either canonical `SKILL.md`, change the packaging whitelist or run the product matrix. It adds a development structural check; it does not validate paid-model behaviour, installed skills or physical terminals.
