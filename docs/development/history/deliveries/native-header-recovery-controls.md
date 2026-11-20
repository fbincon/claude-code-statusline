# Native header recovery controls

**English** | [简体中文](native-header-recovery-controls.zh-CN.md)

This 2026-11-21 feature delivery keeps the Native editor header clear of the host Retry/Close controls. Delivery is limited to source and documentation; no version, tag, Release or npm publication is created. [Issue #241](https://github.com/fbincon/claude-code-statusline/issues/241)

## Changes

| Area | Result |
| --- | --- |
| Header budget | `ui/layout.ts` owns the shared 20-cell recovery-control width and a `headerColumns` budget; the host control box and the Client header use the same value. |
| Title drawing | The first Client header row is clipped to `headerColumns`, so long target labels are ellipsized before the controls instead of being drawn underneath them. |
| Regression coverage | Long titles are checked at 32, 72, 73 and 120 columns; the all-language viewport test now expects the clipped heading at narrow widths. |
| Documentation | Native and editor guides state the reserved control area in English and Chinese. |

## Source identities

- Baseline before the task: `db5a0b9f71b2ac355f495e265c85b0ae3b856e3b`.
- Implementation commit and final head are recorded in the PR description after CI.

## Validation and limits

| Check | Actual result |
| --- | --- |
| `claude plugin test mods/statusline-native` | 359 tests passed across 45 files with zero failures. |
| `npm run test:native-capacity -- --output dist/validation/native-capacity/header-fix` | 313 cases passed across seven files; actual host used, zero model calls. |
| `npm run check` | Passed; 597 tests with 591 passes and six platform-specific skips. |
| `npm run docs:check` | 7,436 links checked with zero errors. |
| Registered documentation content/example tests | 37 tests passed. |
| `git diff --check` | Clean. |

Evidence is host-engine, drawing-layer and PTY-capacity evidence, not a physical desktop capture. Historical native-capacity and draft-history galleries retain their original #241 notes because they describe the recorded v3.9.1/v3.13.0 versions. The six existing [issue #96](https://github.com/fbincon/claude-code-statusline/issues/96) platform gaps remain unverified. No paid model calls were made.
