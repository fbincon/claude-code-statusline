# Component list shortcuts

**English** | [简体中文](editor-list-shortcuts.zh-CN.md)

This 2026-11-27 delivery aligns list controls in the terminal and in-session editors. It changes the source branches ahead of a versioned publication. No product version, tag, Release or npm publication was created. [PR #303](https://github.com/fbincon/claude-code-statusline/pull/303)

## Changes

| Area | Result |
| --- | --- |
| Component lists | Enter and Space toggle the selected instance in Main and Subagents. The external Save key commits the draft and exits. |
| Footer | Navigation and selection appear before secondary controls. Compact footers retain the primary actions, and the terminal status line can show filtered-list controls that run out of footer space. |
| Shortcut panel | Common editor and list actions appear first in their groups. Save details label the extra Enter key on original terminal Settings rows. |

## Source identities

- Baseline `03901f353f2c0f8c2d626eb9a7fd896d701d7862`.
- Implementation `0135013ce1a96ebf1eb90b72bc536e8f333b6886`. Capacity fixture fix `d1bbb239f4bfcb06a590839f39755977c2c42314`. The [PR](https://github.com/fbincon/claude-code-statusline/pull/303) records the final reviewed head and the cross-platform diagnostic run.
- Engineering candidate `0.0.0-ts05.gd1bbb239f4bf` SHA-256 `98ef9c837a1f3e8982d2388330fa3045424e2ed067cf996ca38b58cc101e555f`.
- Source archive SHA-256 `436bc1418e411f274cd6dbfb7a72bf30b309632cc563f6a2bb49dbf3e176a005`.

## Validation and limits

| Check | Result |
| --- | --- |
| Local editor checks | 65 terminal and 14 core shortcut tests passed. Minimum-size layout assertions cover all 12 registered languages. |
| Native host | Claude Code 2.1.332 passed 363 official tests across 46 files. TypeScript passed with exact 2.1.330 and 2.1.332 declarations. The ordinary 2.1.332 validator passed with warnings. Its strict validator reported the baseline TS5097 and TS2307 diagnostics. |
| Generation and docs | All 48 updated language entries were validated and accepted. Generation and the 37 source-backed documentation and example tests passed. |
| Local engineering candidate | Two independent builds matched byte for byte. Artifact verification covered 1,122 files and four package targets. |
| Installed Linux PTY | The keyboard-shortcut journey passed 83 steps on Claude Code 2.1.332. Four picker journeys also passed. The candidate showed one undo step after Enter and zero apply requests before the explicit save. It wrote exactly once on save and reopened with the committed state. Model calls were zero. |
| Native capacity fixture | The first fixed-host diagnostic found that serialized shortcut state replaced the live controller in the fixture. After restoring it, 313 fixtures passed local production drawing and budget checks. The [initial diagnostic](https://github.com/fbincon/claude-code-statusline/actions/runs/45995746808) preserves the failures. |
| Linux impact routing | The immutable comparison selected the product route. The combined scoped Linux task estimated 408 minutes against the hosted 360-minute limit. Local product checks and the [platform diagnostics](https://github.com/fbincon/claude-code-statusline/actions/runs/45997836363) are recorded separately. |

PTY and hosted tests establish automated editor, installation and input behavior. The six accepted physical validation gaps in [Issue #96](https://github.com/fbincon/claude-code-statusline/issues/96) remain unverified.
