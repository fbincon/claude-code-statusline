# External TUI migration regression repairs

**English** | [简体中文](external-tui-regressions.zh-CN.md)

Updated: **2026-10-19** (Asia/Shanghai). Target: **v3.1.2**. Implementation complete; final-source acceptance and delivery pending.

## Baselines and scope

The independent review fixed Python v2.0.0 at `9b6d2fab4bf165be280d428a874521bfbf02c7e1` and TypeScript v3.1.1 at clean `main`, `fb07615bb041d4433865f20317a6eb85d988e4a4`. Python source was exported directly from that commit; the current archive was not assumed identical. The earlier [v3.1.1 delivery](external-tui-parity.md) remains a historical record, not evidence that every interaction was correct.

The maintainer approved six confirmed regression repairs and stable npm/GitHub/Gitee delivery. Public commands, protocol 12, display schema 8 and independent Save/preferences contracts remain compatible. Append-only text editing and the search length/grapheme boundary shared by both baselines remain legacy limitations. The Python archive, frozen fixtures and comparison waivers are unchanged. README remains a product introduction.

## Repairs and regression evidence

| Regression and minimal trigger | Repair and assertions |
| --- | --- |
| Main Ctrl+A, select `task-active-timer`, Ctrl+E; Subagents equivalent with `status`: guidance could dereference a missing instance and close the editor | Resolve picker guidance and titles by catalog scope/type, omit instance fields, and keep configured-instance forms separate. Draw every catalog type; test absent instances, colliding custom IDs, six languages and boundary sizes; assert unchanged draft, disk bytes and backend-preview count. |
| Add a text component, Ctrl+E, Enter: the first edit changed its label rather than its body | Select the first applicable semantic field: text body, metric label, or guidance. Exercise raw CJK, combining and ZWJ input through keys, production preview, cancel, save and reopen in both scopes. |
| Settings Home, Down ×15, Tab, Shift+Tab: Labels and its scroll position were lost | Remember Settings/Layout fields independently of transient details; normalize missing fields after draft replacement. Assert both round trips, detail traversal, resize with pending input, and deleted layout references. |
| Settings Home, PgDn at 64×18: skipped Statusline theme; equivalent errors affected other forms | Page by fields fitting the grouped viewport, including reverse traversal. Assert fixed Python targets at 64×18, 80×24 and 120×30, plus Layout/detail targets and unchanged list paging. |
| `TERM=vt100`, `vt220` or `xterm-mono`: emitted explicit colors | Treat these terminals as monochrome before COLORTERM hints; retain NO_COLOR presence override, linux eight-color and existing 16/256-color mappings. Check ANSI resets, product spans and installed CLI PTYs. |
| Warning 89/Critical 90, Right then Left: valid 88 retained the prior error | Return adjustment success from the shared internal helper. External state clears the matching localized form error only after acceptance. Redraw, failed edits and unrelated backend/review notices keep their existing messages. |

The new product suite first failed eight cases against the unchanged implementation. After repair all 22 external product tests and the targeted protocol/release/CI tests passed locally. Full final-commit results will be recorded below after acceptance; these targeted passes do not substitute for them.

The installed `capture:editor -- --extended` collector additionally exercises picker guidance, text body/preview in both scopes, Settings/Layout focus restoration and four monochrome TERM values. It retains existing style-cell assertions, review states, seven boundary dimensions, six locales, configuration-byte checks and terminal restoration. Light/dark images reconstruct recorded terminal cells using fixed fonts; they are not OS screenshots or physical/human acceptance.

## CI and release boundaries

Ordinary PR/push changes limited to root README/CHANGELOG Markdown and `docs/**/*.md` use documentation link/bilingual and whitespace checks. Unknown paths, executable changes, generated resources, version identity, approval JSON, workflow changes, tags and manual runs require the full candidate matrix. Rename detection checks both paths; missing/invalid revisions fall back to the full matrix. The existing Complete candidate evidence gate rejects scope failures, missing/skipped/failed product checks, and failed documentation checks. Documentation-only runs produce no release receipts.

v3.1.2 requires final-head, merge and tag acceptance: eight installed targets, 32 Node 22/24 cases and thirteen fixed hosts using the same package digest. Two independent builds and source-archive rebuilds, installed PTY checks, draft assets and public downloads remain required. Approval date/path are matched per version; another version's decision, a changed date or expanded gaps fail verification.

[The v3.1.2-only approval](../releases/approvals/v3.1.2.json) accepts the same six existing gaps: physical macOS sleep, macOS 14 Intel desktop/power, Windows 10 desktop, WSL desktop/popup, remaining target-specific human/power checks and Claude 2.1.296 exact declarations. They remain unverified/unavailable. New functional or automated failures are not waived. D06 stays **FAIL**; PERF-01 stays **NOT_STARTED**.

## Final-source delivery evidence

Pending final-head/merge/tag CI, immutable artifact identity, installed captures and npm/GitHub/Gitee public-download verification. [Release notes](../releases/v3.1.2.md).
