# In-place input caret in both editors

**English** | [简体中文](editor-input-caret.zh-CN.md)

This 2026-11-28 feature delivery keeps text in its columns while the caret moves through an input field in the built-in and external editors. Delivery covers source and documentation on GitHub and Gitee. The engineering candidate is for isolated verification.

## Changes

| Area | Result |
| --- | --- |
| Caret and viewport | Reverse video marks the next complete grapheme on its existing cells. An empty field, the end of a value, or a viewport too narrow for the next grapheme gets a highlighted blank cell. |
| Fields and forms | Both editors use the shared caret range. Localized labels leave room for the active input, and only the editable field with focus shows a caret. |

## Source identities

- Baseline `bd4bba8994c27f8bdf71241002d875a7c4117b52`.
- Implementation and candidate source `567a94da8a2e29c4c8a399f86a185e76ee008aa0`. The pull request records the final reviewed head and its documentation checks.
- Engineering candidate `0.0.0-ts05.g567a94da8a2e` had SHA-256 `867022ea4b78c4c2f2faeb4da92e9db112354a466c4eb9e7c7395415204bd5bc`. The source archive had SHA-256 `75d1c16222b76d3afbfbdfc6f8961e9a57add1449e3f3ed50e61e342d168179f`.

## Validation and limits

| Check | Actual result |
| --- | --- |
| `npm run check` on Linux x64, Node 24.21.0 | 2,036 tests passed with six platform-conditioned skips. Generation, documentation, archive and migration checks passed. |
| Impact plan and scoped checks | The product route's Linux task passed. On Claude Code 2.1.332, official validation, all 373 Native tests and type checking against declarations emitted by that host passed on the full rerun. One existing source-management test timed out in the initial parallel run and passed in isolation on the baseline and the candidate. |
| Verified candidate and installed integration | The two independent builds produced identical packages on the run through the local HTTPS proxy with bounded retries after registry TLS resets. Verification covered 1,190 files. All seven Linux installation smoke checks and the official host's installed integration passed. |
| Installed Native and external editor journeys | The focused shortcut journey passed 177 steps across two Linux PTY journeys. The Native search kept `az` in its original columns as the highlight moved from `z` to the trailing blank. The installed external search and numeric fields also passed the caret checks. |
| Focused external caret probe | Four installed Linux PTY sessions passed 20 caret states in English and Simplified Chinese, with 256-color and `NO_COLOR` terminals. The probe checked wide and joined characters, insertion in the middle, the trailing blank, and configuration bytes, file modes and terminal state after cancellation. |

The extended external capture stopped at an existing catalog navigation step before the caret checks. Replays with both the baseline product package from `4fb9211a20adfc738b27da4496d6fb3c8629004e` and this candidate opened the same catalog description instead of the editable representation row. The focused probe above exercised the installed text-editing path directly.

The candidate used isolated installation and configuration directories. All editor verification used zero model calls. Visual evidence came from Linux PTYs and reconstructed terminal cells. The six existing [issue #96 gaps](https://github.com/fbincon/claude-code-statusline/issues/96) remain unverified.
