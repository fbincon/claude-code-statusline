# Component group movement in editors

**English** | [简体中文](editor-group-movement.zh-CN.md)

This 2026-11-20 feature delivery fixes component ordering in the two editors for [issue #224](https://github.com/fbincon/claude-code-statusline/issues/224). Delivery includes source and documentation only, with no version, tag, Release or npm publication.

## Changes

| Area | Result |
| --- | --- |
| Main and Subagents lists | Each Left or Right press swaps the selected component or its whole group with the adjacent component or whole group. The editor retains the selected member and the group retains its member order and settings. |
| Explicit main rows | Units on adjacent rows trade rows. Row sizes can change to fit the incoming units, and the row count stays the same. |
| Draft validation | A valid move is a single undoable edit. Any affected alignments go through structural review. Rejected group splits use the group validation message, and spacer collisions use the layout validation message. |

## Source identities

- Baseline before the task: `d6d94361236e5e2f5741c4a4dac56433396e4c21`.
- Implementation commit: `e2e8cbc497f6b134de9dcce50dadc42605019510`. The final reviewed head is recorded in the PR.
- Engineering candidate SHA-256: `e1b3850449199239c19cabb06005b252820954f483cecce871aad8156da9fd77`.
- Linux x64 host with Node 24.21.0 and Claude Code 2.1.322. Claude binary SHA-256: `bfb3703ad5380242328459bc62ada4bde8ae7ba57c6e1eeadb9c00e08874c478`.

## Validation and limits

| Check | Actual result |
| --- | --- |
| Movement regressions and `npm run check` | Seven focused tests reproduced the failures on the old implementation and passed after the fix. The local check passed 1,822 tests with six platform skips. It included resource generation verification, source-backed documentation and example tests, and frozen replay cases. |
| Candidate build and verification | Two independent builds produced identical bytes after retrying registry connection resets. Verification covered 1,102 files, and the verified tarball matched the one used for both editor sessions byte for byte. |
| Installed external and Native editors | Linux PTYs exercised both directions across groups, crossing explicit row boundaries, moving a group by a selected member, and stopping at the list edge. Each editor saved and reopened both scopes with the expected order, rows, group metadata and file mode. The Native pane was reopened in the same Claude Code session. |
| Native Mod on Claude Code 2.1.322 | Strict plugin validation, exact-host declaration type checking and 357 official tests across 45 files passed. |
| Isolation and cost | The temporary installation was removed. The fingerprints or absence of 11 real Claude or statusline paths matched before and after. Zero paid model calls. |

Host coverage is limited to automated Linux checks and PTY operation of Claude Code 2.1.322. The six existing [issue #96 gaps](https://github.com/fbincon/claude-code-statusline/issues/96) remain unverified.
