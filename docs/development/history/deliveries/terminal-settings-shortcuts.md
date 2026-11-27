# Terminal Settings shortcuts

**English** | [简体中文](terminal-settings-shortcuts.zh-CN.md)

This 2026-11-27 feature delivery aligns the terminal Settings controls with the editors' draft workflow. No product version, tag, Release or npm publication was created. [PR #304](https://github.com/fbincon/claude-code-statusline/pull/304)

## Changes

| Area | Result |
| --- | --- |
| Settings activation | Enter toggles boolean settings, advances preset choices and opens numeric fields with the current value. |
| Refresh interval | Enter accepts seconds or `event` into the draft. The current Save shortcut commits the draft and exits. E sets event-only refresh by default and accepts available remaps. The shortcut recorder and preference writer reserve Enter on the refresh row. |
| Shortcut hints | Settings identifies the selected row’s controls and the current event-only refresh binding. The shortcut panel shows each editor's Save binding. |

## Source identities

- Baseline `3a2a3c7829706f1a004bc47bbffd0e58f6d1f1e8` integrates the component list shortcut changes.
- Implementation `954ced41e17a64f46a1ee5ea67010a6a31ba55d4`. The verified product and acceptance source is `fd0ccf31737662dd2ea6a87afa2df398c30d035a`, which also recognizes truncated row labels in the PTY harness. The PR records the final reviewed head.
- Engineering candidate `0.0.0-ts05.gfd0ccf317376` SHA-256 `d4f78055ccfc15acb2f55b68fe8072b17ae406c48bad4b5b11ee197d5b887306`. Source archive SHA-256 `66b1bde578b42df6d60c3fcd8e2f3a1c531abddda009722294e4784234c5a890`.
- Hosted diagnostic package SHA-256 `64f1d3b4b6d88ac66b5c0ae52f737f508ac5e620f66bbd2a7d768e684c367ae8`. The run retains the package and source-bound platform receipts. [Run 46001341594](https://github.com/fbincon/claude-code-statusline/actions/runs/46001341594)

## Validation and limits

| Check | Actual result |
| --- | --- |
| Local product | `npm run check` passed 1,891 tests with six platform skips. The editor regression tests cover numeric input, cancellation, history, current bindings and the minimum-size footer in all 12 languages. |
| Generation and documentation | All 12 reviewed event-only refresh labels were accepted. Resource generation, documentation checks and the 37 source-backed documentation and example tests passed. |
| Engineering candidate | Both independent builds produced the same bytes. Artifact verification covered 1,122 files and four package targets. |
| Installed Linux PTY | The shortcut journey passed 144 steps on Claude Code 2.1.332. The refresh flow checked invalid input, cancellation, draft-only acceptance, one explicit apply and the persisted value after reopening. An additional installed PTY check verified that J sets event-only refresh in the draft and Z commits it after rebinding. Model calls were zero. |
| Native hosts | Claude Code 2.1.332 passed 363 official tests across 46 files. The ordinary validator passed with warnings. TypeScript passed with the exact 2.1.330 and 2.1.332 declarations. The strict 2.1.332 validator returned the same TS2307 and TS5097 diagnostics on the baseline and the reviewed source. |
| Hosted diagnostics | Linux x64 installation, macOS Intel PTY and Windows ARM64 with x64 Node 22.0.0 passed. The Windows console receipt covers launch, save and cancel. The two fixed Linux hosts, 2.1.296 and 2.1.310, passed their selected checks. |
| Linux impact routing | The comparison selected the product route. The combined scoped Linux task estimated 444 minutes against the hosted 360-minute limit. The local product checks and the platform diagnostic jobs provide separate receipts. |

PTY and hosted console checks establish automated software coverage. The six accepted physical validation gaps remain unverified. [Issue #96](https://github.com/fbincon/claude-code-statusline/issues/96)
