# Targeted documentation review adjustments

**English** | [简体中文](docs-review-targeted-adjustments.zh-CN.md)

This 2026-11-14 documentation maintenance pass applies the targeted P1/P2 recommendations from an external documentation review. It narrows duplicated editor operations in the user guide, regroups development and history navigation, adds scope notes to five current technical guides and fixes the Chinese roadmap archive reference. Product behavior, commands, public interfaces, stored formats, historical records and published releases are unchanged. No version, tag, Release or npm publication is created.

## Changes

| Area | Result |
| --- | --- |
| User guide and editor boundary | Removed duplicated key and operation enumerations from the user guide, including the quick-setup shortcut, component keys, the separate Claude preference keys and a Chinese-only save duplicate. Scenarios, launch methods, installation combinations, cautions and links remain; the editor guide stays the detailed source. |
| Development navigation | Split the combined configure/display/source row into setup and display, render/preview/diagnosis, and source/task/workflow groups without dropping links. |
| History navigation | Moved documentation-maintenance delivery records into a dedicated navigation group and added this record. |
| Scope notes and roadmap | Added scope notes to the adaptive-row, source/command/package, testing, CI-efficiency and native guides; linked the Chinese roadmap to the archived milestones and made the English sentence link the same archive. |

## Source identities

- Baseline before the task: `54b63030`.
- Final head and merge identity are recorded in the PR description after CI.

## Validation and limits

| Check | Actual result |
| --- | --- |
| `npm run docs:check` | 7,202 local links, 0 errors (baseline 7,185) |
| `git diff --check` | Passed |
| Documentation content and example tests | 34/34 passed; `docs.test.js` 17/17 passed |
| Impact plan and scoped check | Selected tasks and results are recorded in the PR description after CI |

The change is documentation-only. It performs no installed-product, editor, platform, provider or paid-model acceptance. Historical content is not rewritten; the new scope notes are editorial orientation, not new evidence. The six accepted issue #96 gaps remain unverified.
