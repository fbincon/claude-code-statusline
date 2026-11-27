# Shared editor shortcut correctness

**English** | [简体中文](editor-shortcut-correctness.zh-CN.md)

This 2026-11-28 maintenance delivery aligns shortcut prompts with the keys that both editors accept and verifies shortcut saves against the transaction state. The change goes through [PR #306](https://github.com/fbincon/claude-code-statusline/pull/306) as ordinary maintenance. This delivery creates no product version, tag, Release or npm publication.

## Changes

| Area | Result |
| --- | --- |
| Active keys | The built-in editor shows the current keys after loading a preset and when Claude preferences are pending. Both color panels show the current apply and back keys. Trying Ctrl+C while recording in the external editor keeps both drafts open. |
| Paging and compatibility | Saved source checks retain arrow paging. Historical arrow bindings for source reload revert to R and historical Enter bindings for event-only refresh revert to E. The compatible read retains usable overrides and reports skipped keys. |
| Readback | The shortcut reader observes the existing installation lock and the file transaction. An unconfirmed read retains the previous bindings and current edits in the open panel. A completed transaction can be confirmed while its journal still exists. |
| Languages | All twelve language packs have 2,468 accepted messages. The editor guides, CLI reference and developer contract describe the current behavior in both documentation languages. |

## Source identities

- Baseline `f15a3a20314178d1523aaba4d63973530cd29e28`.
- Implementation source `731509454c55197bc3dcb0503b246cce38a1127c`. Commit `0040696a26185997bcfc3c8fcb2fe7a38d0453b6` changes only the Windows contention test fixture. The PR records the final reviewed head.
- Engineering candidate `0.0.0-ts05.g0040696a2618`, SHA-256 `80d6081ad1b4756a4bd80da7a2433875cb8ad13399bcd2082e16fed92f9e8b52`. The source archive SHA-256 is `ac8c85511aa1bdafdd63bcb71848db1e345bf737454201d31bf6217ec2adf613`.
- The release-grade language report bound to both archived and Git sources has SHA-256 `475a14a051b3a83f9f96eb8b6dc1924ba57393ce0434f55e7a82d5f98df483b1`.
- The hosted diagnostics package built from `731509454c55197bc3dcb0503b246cce38a1127c` has SHA-256 `564fe477d4b817e50f39ad7d52ddefe6031570e6db11bec05ffc64b7a8b45dac`.

## Validation and limits

| Check | Actual result |
| --- | --- |
| Local product checks | `npm run check` passed 1,953 tests with six platform-conditioned skips. It also passed resource, Actions, documentation, archive and responsibility checks. The source-backed content and example suite passed 37 tests. |
| Readback and compatibility | Sixteen new lock, CLI and panel tests passed locally. Real CLI child processes were interrupted before and after commit for first write, replacement and reset. Recovery retained the old or new map according to the commit state. Source paging covered a 33-item fixture with and without a known job. |
| Installed keyboard journeys | Both Linux PTY journeys on Claude Code 2.1.332 passed, with 160 steps in total. Pressing the displayed Z discard key after loading a preset sent zero apply requests and preserved the original display file and mode. The standalone external editor passed its installed remap, recording, reopen, restore and cancel flow. |
| Native capacity and declarations | Claude Code 2.1.332 passed 366 Native tests and all 313 capacity cases. Exact declaration type checking passed. The host's strict validator reports TS5097 for `.ts` imports on both the baseline and this change. The candidate adds one import with that diagnostic. The behavioral run used ordinary host validation and the same capacity inputs. |
| Language evidence | All twelve languages passed with zero English fallbacks. Two independent candidate builds matched byte for byte. The source archive and Git maintenance input both verified the same language report under the public-release rules. |
| Hosted diagnostics | Ubuntu 24.04 x64 and macOS 15 Intel passed the installed and source suites. Fixed Claude Code 2.1.296 and 2.1.310 jobs passed. The Windows ARM64 runner using x64 Node 22.0.0 passed the installed control flow, language and history checks. Its source suite hit `EBUSY` in the test snapshot before reaching the CLI assertion. The corrected source suite passed on Windows Server 2025 x64 with Node 24.0.0 and on Windows 11 ARM64 with x64 Node 22.23.4, 24.0.0 and 24.21.0. [Original run](https://github.com/fbincon/claude-code-statusline/actions/runs/46033527851) · [Windows source rerun](https://github.com/fbincon/claude-code-statusline/actions/runs/46037773218) |
| Impact route | The package comparison selected the product route. The combined Linux scoped task required an estimated 477 minutes against the 360-minute hosted limit. The complete local product suite and bounded platform diagnostics ran separately. |

Test installations and configuration directories were isolated. Model usage was zero. The six existing platform verification gaps retain their status. [Issue #96](https://github.com/fbincon/claude-code-statusline/issues/96)
