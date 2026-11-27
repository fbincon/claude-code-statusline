# Shared editor shortcut reliability

**English** | [简体中文](editor-shortcut-reliability.zh-CN.md)

This 2026-11-27 maintenance delivery fixes key reachability, recovery and navigation in the built-in and terminal editors. The editors share schema 1 shortcut preferences through editor protocol 33. This delivery creates no product version, tag, Release or npm publication. [Shortcut settings](../../../EDITORS.md#customize-keyboard-shortcuts)

## Changes

| Area | Result |
| --- | --- |
| Host key restrictions | Ctrl+D, Ctrl+X and Ctrl+Z are available for terminal-only actions. The built-in editor uses D, X and Ctrl+/ for copy, remove and undo. |
| Compatibility | The reader retains usable overrides from previously valid preferences and warns about keys it had to skip. Explicit cleanup uses the existing revision check, backup and transaction. The same warnings appear in `doctor`. |
| Terminal controls | Esc and the remapped Close key both reach the guarded exit. The configured search key opens a text field where bound characters remain searchable. |
| Shortcut panel | Both editors filter actions by name or ID and paginate by the number of visible rows. The open panel fits at 32×12. English and Simplified Chinese messages were accepted through the language workflow. |

## Source identities

- Baseline `57f63883606d206875883c977f990a545a6cdc8f`.
- Product source and full local suite `14c50ecefea775e40d5da6f7fc362059d586fdfd`.
- Engineering candidate and fixed-host checks `dcc1e360676a72c5339934f36267a6bab25c8448`. The intervening change updates four Native test files to exercise the reachable presets.
- Candidate `0.0.0-ts05.gdcc1e360676a` SHA-256 `9beb2b6b4ceea382bec29c1a7657e889093a835531fc0c88279b3f17b71b74c6`.
- Source archive SHA-256 `3f8a9d65364cbd78dc92ec17ddbcf553c29ad3f71a8811a09bdd891d585be171`.
- The pull request records the reviewed head and its documentation checks.

## Validation and limits

| Check | Actual result |
| --- | --- |
| `npm run check` | The product commit passed 1,875 tests with six platform-conditioned skips. Actions, resources, document links, archive integrity and responsibility inventories passed. The completed run used one test worker and disk-backed temporary directories after the original memory interruption. |
| Fixed Linux hosts | Each scoped Native check for Claude Code 2.1.287, 2.1.288, 2.1.289, 2.1.294, 2.1.296 and 2.1.310 passed 362 tests across 46 files. Exact declarations were unavailable on 2.1.296 as documented by the host policy. |
| Installed Claude Code 2.1.330 | Standard validation and the exact generated declarations typecheck passed. Before declaration generation, the strict validator reported TS2307 and TS5097 on both the baseline and candidate sources. |
| Reproducible candidate and smoke | Two independent builds produced identical package bytes. Verification covered four package targets and 1,122 files. The isolated Linux integration smoke passed all seven checks. |
| Cross-editor PTY | The installed candidate passed 73 steps on Linux x64 with Node 24.21.0 and Claude Code 2.1.330. The run covered the legacy warning, filtering and recording, preference cleanup and backup, remapped search, Esc cancellation and exit, restoration and readback. Model calls and charges were zero. Nine real configuration paths matched their original bytes, modes or absence. |

The immutable impact plan selected the product route. Its aggregate Linux task required an estimated 444 minutes against the 360-minute hosted limit. The local evidence includes the completed product suite, scoped host tests, candidate verification and installed checks. Windows and macOS installed workflows and physical acceptance remain unverified here, including the six previously accepted gaps. [Issue #96](https://github.com/fbincon/claude-code-statusline/issues/96)
