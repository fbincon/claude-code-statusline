# Permission snapshots and main statusline styles

**English** | [简体中文](permission-mode-and-render-styles.zh-CN.md)

This 2026-11-21 maintenance delivery restores permission snapshots and main statusline styling. Delivery is limited to source and documentation, with a private engineering package for validation. [Issue #209](https://github.com/fbincon/claude-code-statusline/issues/209) · [Issue #216](https://github.com/fbincon/claude-code-statusline/issues/216)

## Changes

| Area | Result |
| --- | --- |
| Permission mode | The installed `UserPromptSubmit` settings hook can record the observed main-session mode when live metrics are enabled and the native heartbeat is current. The record shares the live session lock and expires after 15 seconds. Equal or older snapshots cannot replace the current snapshot, and verified live values take priority. |
| Source and indicator styles | External and GitHub source items receive a palette foreground and bold weight. Adaptive bars and their numeric fallbacks keep regular bar styles and threshold colors. Main labels and icons follow the component style, while compound values retain the styling of their individual parts. |

## Source identities

- Baseline is `326a7cb7aeed1fac524269f1dcf593498e6f3b75`. Implementation and candidate source is `25266c0da7ed3b928a16c3cdf1cb4f651a3e2c25`. The PR records its final reviewed head.
- Engineering package SHA-256 is `e9155e4e2bbe4950866ca79c2b183703b7baaa169fb375bd617ce4432cd8879e`.
- Linux x64 validation used Node 24.21.0 and npm 11.19.0. Claude Code 2.1.319 binary SHA-256 is `dabafec82ca1319fa43d8be36a10fc61b1d11821cb98ad5df04ad95e199b8eed`. The 2.1.322 binary SHA-256 is `bfb3703ad5380242328459bc62ada4bde8ae7ba57c6e1eeadb9c00e08874c478`.

## Validation and limits

| Check | Actual result |
| --- | --- |
| Local product checks | Six regression cases reproduced the defects on the baseline and passed with the repair. `npm run check` passed 1,837 tests with six platform-specific skips. Generation verified 119 resources, and 37 source-backed documentation and example tests passed. |
| Impact and candidate checks | `ci:plan` selected the product route with CLI, documentation, generation and Native coverage alongside the repository checks. Two independent builds produced identical package bytes. `candidate:verify` checked all 1,102 files. |
| Installed Claude Code 2.1.319 and 2.1.322 | In both PTY sessions, the host logged that `cc-plugin-sec-default` had skipped the Mod's `classic.UserPromptSubmit`. The settings hook produced `Mode plan*`. It returned to `Mode —` after expiry while the native heartbeat remained fresh. The installed command's fixed-input probes confirmed critical red and bold for both the full adaptive bar and its numeric fallback. The host displayed the local JSON source with a bold gradient. |
| Installed editor preview | Seven production preview calls covered warning and critical scenarios at 40, 80 and 120 columns, plus the numeric fallback. They verified source emphasis and GitHub links. |
| Runtime Mod | Strict validation, exact-host type checks and 18 official tests across eight files passed on both tested host versions. |
| Native Mod | Strict validation, exact-host type checks and 357 official tests across 45 files passed on Claude Code 2.1.322. |
| Native preview capacity | All 313 cases across seven official test files passed on Claude Code 2.1.322, including the regenerated preview fixtures. |
| Configuration and cost | The two model requests went to a local loopback responder and cost USD 0. All 11 checked settings and executable paths matched their original fingerprints or absence after cleanup. |

Evidence is scoped to Linux x64 and PTY sessions. The six existing platform validation gaps remain unverified. [Issue #96](https://github.com/fbincon/claude-code-statusline/issues/96)
