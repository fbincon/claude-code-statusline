# Custom editor shortcuts

**English** | [简体中文](editor-shortcuts.zh-CN.md)

This 2026-11-27 feature delivery adds shared shortcut preferences to the built-in Claude Code editor and the external terminal editor. Settings → Keyboard shortcuts stages changes and supports restoring one preset or all presets before saving. This delivery creates no product version, tag, Release or npm publication. [PR #301](https://github.com/fbincon/claude-code-statusline/pull/301)

## Changes

| Area | Result |
| --- | --- |
| Editor commands | The shared action map covers the editor and its subpanels. Conflicts are checked against both editors. Fixed text, navigation and recovery keys remain available, and available command hints use the active bindings. |
| Shared preferences | Both editors use `statusline-shortcuts.json` schema 1 through editor protocol 33. Saving activates the staged bindings in the current editor. A second editor can read them on reopen or through Read saved. Revision checks protect concurrent edits. |
| Documentation and languages | The English and Simplified Chinese guides cover recording, restoring, resolving conflicts and reloading. New interface messages were accepted in both A languages. Other language packs use the existing development fallback for new messages. |

## Source identities

- Baseline `cd01a796d1595fab73292702e60d6135bf3a6d62`.
- Editor implementation `ccf29b9a48a5d5c4ff22094ffad28f1b642e4dbb` and engineering candidate source `d76bdf9b73c3e8b198e38d315ccd7b00e0375994`.
- Candidate `0.0.0-ts05.gd76bdf9b73c3` SHA-256 `a8c3dee0fc27b60762a7f49799bcb8666178db0169f948a9f124e6036b444b23`.
- Source archive SHA-256 `61b58495be7ee5ed28debc702b7e84d156b10c7f18ec8668b25545ec83d33ba6`.
- The PR records the final reviewed head and its checks.

## Validation and limits

| Check | Actual result |
| --- | --- |
| `npm run check` | The implementation passed 1,867 tests with six skips, along with Actions, generated resources, document links, archive integrity and responsibility inventories. |
| Documentation | `docs:check`, `git diff --check` and all 37 source-backed content and example tests passed. |
| Candidate and local installation | Two independent builds produced byte-identical packages. Artifact verification passed for all four package targets, and the isolated Linux integration smoke passed all seven checks. |
| Cross-editor shortcut round trip | The installed candidate and Claude Code 2.1.330 ran in isolated Linux PTYs. The built-in editor changed Save from S to Z. The external editor loaded Z, saved a display change with it and restored the presets. The still-open built-in editor read the saved preferences and showed S again. The replaced Save keys did not submit the edited draft. Shortcut saves left display configuration bytes and mode intact. |
| Official host checks | The Linux scoped checks on 2.1.287, 2.1.289 and 2.1.310 each passed 362 Native Mod tests. The PR records the full host inventory. On 2.1.330, standard validation and the generated host declarations typecheck passed. The strict validator reported `TS5097` import-extension diagnostics on both the baseline and the candidate source. |
| Model calls and real configuration | Zero model calls and USD 0 in model charges. All nine real settings and preference paths matched their starting content hashes, modes or absence. |

The product impact plan resolved from immutable sources. Its aggregate Linux task exceeded the modeled hosted job budget, so the recorded Linux evidence consists of the full local check, scoped host checks and separate installed smoke and PTY runs. The terminal run covers Linux x64 with Node 24.21.0. Windows and macOS installed workflows and physical acceptance remain unverified here. The six previously accepted gaps remain open. [Issue #96](https://github.com/fbincon/claude-code-statusline/issues/96)
