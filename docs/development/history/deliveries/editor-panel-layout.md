# Version and shortcut panels

**English** | [简体中文](editor-panel-layout.zh-CN.md)

This 2026-11-28 source delivery organizes the version and shortcut panels in both editors. Delivery covers source and documentation on GitHub and Gitee. The engineering candidate is for local verification.

## Changes

| Area | Result |
| --- | --- |
| Version and installation | The overview uses the same horizontal dividers as Settings. Group titles occupy one row, and arrow navigation skips them. |
| Keyboard shortcuts | The six action groups share a framed content region with a fixed action menu and a separate footer. At 80 columns the list expands to Option, Current key and Default key. The compact panel supports 32×12. |
| Navigation | Paging counts divider rows. Filtering and resizing retain the selected action where applicable. The selected action shows the applicable editors' current and default keys. |

## Source identities

- The baseline was `b6855d6fd25311f3242b7a7b5b43578bd32e55e5`.
- The tested source was `418520ba7c64fd59a86514378439ddd84d2b8e35`. The engineering candidate SHA-256 was `94611bfb8284f47bd90a1d65d39758fd46316625bb63889be5dc915b199f522a`. The source archive SHA-256 was `7cb46793ced2d540d59843936a357866a6d350c741f92126ccff314278d6b4d1`. Two independent builds produced byte-identical packages.
- The pull request records its final reviewed head and documentation checks.

## Validation and limits

| Check | Actual result |
| --- | --- |
| `npm run check` on Linux x64 with Node 24.21.0 | 2,030 passed with six platform-dependent skips. Generated resources, documentation, archive integrity and migration inventories passed. |
| UI language validation | The 24 column labels were accepted across 12 locales with zero English fallback. |
| Native `ci:check` on Claude Code 2.1.332 | Official validation, 371 tests and type checking with the exact host declarations passed. Initial test assertions about the requested viewport were replaced with fixed-geometry rendering checks and a separate assertion that the actual fitted pane retains selection after resizing. |
| Installed Linux PTY journeys | Four version and two shortcut journeys passed on the same verified candidate. The probes checked group dividers, channel choice and return, staged shortcut saves and readback, and terminal resizing from 32×12 to a three-column view. Version options were verified after specifying an installation prefix. |
| Candidate and installation smoke | Verified 1,190 files and seven Linux smoke checks, including an offline empty-cache install and uninstall preserving unowned settings. After intermittent registry TLS resets, the two-build check succeeded through the local HTTPS proxy with bounded retries on locked downloads. |
| Impact checks | The impact plan selected product checks. The aggregate Linux task required 374 minutes against the 360-minute scheduling limit. The full local product suite, scoped Native check and separate Linux installation smoke passed. |

Terminal evidence came from Linux PTYs and reconstructed terminal cells. Model calls and charges were zero. The six existing platform gaps remain unverified. [Issue #96](https://github.com/fbincon/claude-code-statusline/issues/96)
