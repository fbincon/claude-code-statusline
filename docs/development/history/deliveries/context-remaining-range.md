# Context remaining range validation

**English** | [简体中文](context-remaining-range.zh-CN.md)

This 2026-11-21 feature delivery omits invalid `context-remaining` percentages and aligns the item with the existing `context-used` availability rule. Delivery is limited to source and documentation; no version, tag, Release or npm publication is created. [Issue #231](https://github.com/fbincon/claude-code-statusline/issues/231)

## Changes

| Area | Result |
| --- | --- |
| Context item | `context-remaining` now omits missing, boolean, nonnumeric, nonfinite, negative and over-100 values instead of rendering them; numeric strings and booleans no longer coerce to percentages. |
| Regression coverage | Rounding and invalid-value cases mirror `context-used`; the former `Infinity` path that could reach `roundedInteger` is closed. |
| Documentation | `DISPLAY_ITEMS` records the closed `0–100` availability rule in English and Chinese. |

## Source identities

- Baseline before the task: `db5a0b9f71b2ac355f495e265c85b0ae3b856e3b`.
- Implementation commit and final head are recorded in the PR description after CI.

## Validation and limits

| Check | Actual result |
| --- | --- |
| `node --test packages/cli/dist/test/render-items.test.js` | 41 tests passed, including the new `context-remaining` rounding and invalid-value cases. |
| CLI reproduction | `-5`, `150` and `true` render no context item; `42` renders `Context 42% left`. |
| `npm run check` | Passed; 597 tests with six platform-specific skips, generated resources verified and documentation links/anchors clean. |
| `npm run docs:check` | 7,436 links checked with zero errors. |
| `npm run ci:plan` / `ci:check --task linux` | Product route selected; the Linux task passed with actions, checks, CLI and documentation coverage. |
| `git diff --check` | Clean. |

The behavior is verified on Linux x64 with Node 24.21.0. The six existing [issue #96](https://github.com/fbincon/claude-code-statusline/issues/96) platform gaps remain unverified. No paid model calls were made.
