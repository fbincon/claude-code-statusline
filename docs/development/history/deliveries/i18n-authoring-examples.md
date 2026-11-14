# i18n authoring input examples

**English** | [简体中文](i18n-authoring-examples.zh-CN.md)

This 2026-11-14 documentation delivery adds field-level examples for the i18n authoring inputs and corrects the documentation-only validation wording. Product behavior, commands, public interfaces, stored formats and published releases are unchanged. No version, tag, Release or npm publication is created.

## Changes

| Area | Result |
| --- | --- |
| Context example | `docs/development/i18n.md#authoring-input-examples` shows the full `context.json` shape with `schema_version`, `entries`, `version`, `description`, `terms` and optional `cell_budget`. |
| Terminology example | The same section shows the full `terminology.json` shape and notes that language fields are authoring conventions rather than validated schema; unreferenced entries are not validated. |
| Validation wording | The documentation-only section now states that registered current guides also run the build, source-backed content and example tests selected by the impact plan. |
| Boundary | No checker is added; the existing analyzer and language commands remain authoritative. |

## Source identities

- Baseline before the task: `ea0644ab`.
- Implementation commit and final head are recorded in the PR description after CI.

## Validation and limits

| Check | Actual result |
| --- | --- |
| `npm run docs:check` | 7,315 links, 0 errors |
| `docs-content.test.js` + `docs-examples.test.js` | 34/34 passed |
| `npm run check` | Isolated group 1,185/1,185 passed; serial group 585/591 passed with 6 platform skips; 0 failures |
| `npm run build` | Passed |
| `git diff --check` | Passed |
| Impact plan and scoped checks | Recorded in the PR description after CI |

The examples are illustrative and do not fill raw packs with English or replace the `languages` commands. This delivery does not add a checker or perform product, installed, platform or paid acceptance.
