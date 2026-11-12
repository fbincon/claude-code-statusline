# Development documentation archive and navigation refresh

**English** | [简体中文](development-docs-archive-refresh.zh-CN.md)

This 2026-11-13 maintenance separates current development guidance from frozen delivery records. Historical pages move under `docs/development/history/`, compatibility stubs preserve old paths and anchors, and current pages retain their behavior and contracts. Product behavior, interfaces, storage formats and command output are unchanged.

## Archive boundary

| Area | Result |
| --- | --- |
| Full moves | `correctness-maintenance`, `draft-history-and-reuse`, `external-tui-parity`, `external-tui-regressions` and the TypeScript migration plan moved under `history/deliveries/` or `history/migration/`; bilingual stubs preserve every old section anchor. |
| Mixed pages | Twelve current-plus-delivery pages split into a current page and a historical record under `history/deliveries/`. Current behavior stays at the old path; moved sections keep their headings and anchors, with bridge anchors on the current page. |
| Navigation | The development index and history index describe current guides, frozen records and compatibility stubs; moved records link their current owners. |
| Single source | Testing owns the acceptance matrix, the CLI reference owns current interface versions, and the two language guides split authoring from policy and lifecycle. |
| External TUI | A current External TUI section in the Native guide links current user operations and the two historical migration records. |
| Historical references | Acceptance and release archives gained contents and version portals; work-package coverage boundaries, Python duplicate sections and release-version gaps were corrected without rewriting evidence. |
| Reference details | Live retention bounds, Native control order, capture arguments, media prerequisites, protocol history, tools tree, CI host labels, stub anchors, showcase merge identity and terminology were corrected. |

## Source and verification

The baseline is `2a1ef056`. The implementation commits are:

| Stage | Commit |
| --- | --- |
| Move historical records | `ef4b0dd9` |
| Split current guides | `c741b1c0` |
| Consolidate navigation and references | `28258242` |

The delivery commit adds this record and the history index entry.

| Check | Actual result |
| --- | --- |
| `npm run docs:check` | 6,864 local links, 0 errors |
| `git diff --check` | Passed |
| Bilingual pairing and heading levels | 118 pairs, 0 missing counterparts, 0 level mismatches |
| Anchor preservation against the baseline | 2,458 anchors checked, 0 missing |
| Build and documentation tests | `docs-content.test.js` and `docs-examples.test.js`: 28/28 passed |
| Delivery JSON identity | `external-tui-parity.delivery.json` and `node-regional-languages.delivery.json` unchanged |
| Immutable impact plan | Recorded by the delivery PR |
| Local Linux scoped receipt | Recorded by the delivery PR |

The content tests read the marked fences in the actual Markdown and executed the selected CLI workflows in temporary directories. This was documentation and source inspection, not installed-product, editor/focus, physical or paid-model acceptance.

## Limits

No installed-product, physical editor, terminal, live provider or paid-model acceptance was performed. The six accepted issue #96 gaps remain unverified. This maintenance introduces no product version, tag, Release, npm publication, screenshot or Python-archive change. The zh-HK terminology inconsistency remains tracked by issue #234. Registering development pages in source-backed content checks remains a separate follow-up.

Final-head **Complete candidate evidence**, merge identity and main promotion are recorded by the delivery PR. GitHub remains primary; validated main is synchronized to Gitee only after checking divergence, with the remote SHA verified afterward.
