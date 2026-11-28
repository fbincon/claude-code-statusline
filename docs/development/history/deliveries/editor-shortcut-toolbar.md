# Shortcut toolbar and fixed details

**English** | [简体中文](editor-shortcut-toolbar.zh-CN.md)

This 2026-11-28 feature delivery improves the keyboard shortcuts panel in the built-in and external editors. Delivery covers source and documentation on GitHub and Gitee. The engineering candidate is for isolated verification.

## Changes

| Area | Result |
| --- | --- |
| Buttons and focus | Save shortcuts, Restore all defaults and Read saved sit above the list. All three fit at 32×12 with compact labels. Tab names its destination, and the focused button has a visible marker and theme highlight. |
| List and details | Filtering and toolbar focus keep the selected action by ID. The current and default keys sit at the bottom edge. The two renderers and keyboard paging use the same row budget. |
| Contextual help | The footer uses one row when the active hints fit and up to two in narrow panes. Recovery instructions can use the space normally reserved for binding details. |

## Source identities

- Baseline `2fd1925a22533cdfb64a7b45e17506cf24d4b511`.
- Implementation `48b84c4b36b089e7e9935fc4b3ef5ccd29ea3ca9`. The candidate and host tests used `4fb9211a20adfc738b27da4496d6fb3c8629004e`, which also normalizes whitespace in the Native focus assertion. The pull request records the final reviewed head and its documentation checks.
- Engineering candidate `0.0.0-ts05.g4fb9211a20ad` had SHA-256 `7f3c3f50ff6c791005831d0e3ba5507cf4a7dc2935553d18172aacc303cd8fce`. The source archive had SHA-256 `1cfda8a64d6b5547a4ed585490f764d1fef0cc634fc44281cdc550903f6002d3`.

## Validation and limits

| Check | Actual result |
| --- | --- |
| `npm run check` on Linux x64 with Node 24.21.0 | 2,030 tests passed with six platform-conditioned skips. Generated resources, documentation links, archive integrity and migration inventories passed. |
| Localization and layout | All 12 interface languages had 2,533 accepted messages and zero English fallbacks. A shared-layout probe passed 9,504 combinations of language, editor, viewport and panel state. |
| Scoped Native check on Claude Code 2.1.332 | Official validation, 371 tests and type checking against declarations emitted by the same host passed. |
| Candidate and installed smoke | Two independent builds produced byte-identical packages. Package verification covered 1,190 files. All seven Linux installation smoke checks passed. |
| Installed terminal journeys | Both Linux PTY journeys passed across 171 steps. They exercised focus, resizing, staged saving, preset restoration and cross-editor readback. Saving shortcuts preserved the display configuration's bytes and mode. |
| Impact checks | The impact plan selected the product route. The aggregate Linux task was estimated at 374 minutes against the 360-minute scheduling limit. The local product suite, scoped Native check and installation smoke ran separately. |

Terminal evidence came from Linux PTYs and reconstructed terminal cells. Configuration and installation directories were isolated. Model usage was zero. The six existing unverified platform scenarios are tracked in [issue #96](https://github.com/fbincon/claude-code-statusline/issues/96).
