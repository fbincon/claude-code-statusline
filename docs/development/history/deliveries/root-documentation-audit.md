# Root documentation accuracy and organization

**English** | [简体中文](root-documentation-audit.zh-CN.md)

This 2026-11-12 documentation maintenance records the review of the thirteen root topic guides, the documentation index and the user guide. It corrects statements that had drifted from the 3.16.3 implementation, aligns both languages, and moves duplicated preset details to the guide that owns them. Product commands, editor behavior, protocols, storage and release identity retain their existing contracts.

## Content and ownership

- `DISPLAY_ITEMS` no longer promises global terminal-text sanitization, and its availability rule now defers to each numeric item's validation. The main `context-remaining` row records the current finite-number behavior; issue [#231](https://github.com/fbincon/claude-code-statusline/issues/231) tracks the product-side range decision. A private security advisory tracks the rendering-hardening follow-up.
- `COMPOSITION` uses a supported instance option in its copy example, states that numeric formatting applies only to supported components, and clarifies automatic versus explicit group rows and group-aware copy placement.
- `SCHEMES` no longer claims that preset application preserves disabled subagent rows; it preserves collector preferences and the subagent enablement switch, then rebuilds row contents. The six original presets now have their summary table here.
- `EDITORS` separates terminal-editor and Client undo keys, clarifies the slash-only `help` arguments and records the pending Claude-preferences Apply exception.
- `PROFILES`, `EXTENSIONS`, `SETUP`, `SHOWCASE`, `DIAGNOSTICS`, `PACKAGE_MANAGEMENT`, `TASK_DETAILS`, `APPEARANCE` and `DRAFT_HISTORY` received the factual, prerequisite, version-baseline and troubleshooting corrections described in the audit.
- The documentation index now links the whole user guide, separates guided first-use setup from manual installation, and files draft history with display building. `USER_GUIDE` keeps its tested anchors and installation-combination table while linking the preset summary, editor keys and the full metric catalog.
- `PROFILES` and `SCHEMES` have distinct titles and preserve their old heading anchors. The main topic guides gained contents or related-guide sections where they improve discovery.
- Chinese counterparts were updated in the same change. The duplicate `diagnose` command block was removed, body terminology now uses "子代理", and UI labels follow the established Chinese wording. Legacy anchors remain available.

The historical v3.7.0 → v3.8.0 package example and the v3.16.0 SHOWCASE recording baseline remain, with explicit scope notes; they are not current-version recommendations.

## Source and verification

The baseline is `80f541e6`; the implementation commit is `a98d3e23`, on `docs/root-documentation-audit`. This subsequent record/index commit adds no product code.

| Implementation-stage check | Actual result |
| --- | --- |
| Node 24.21.0 / npm 11.19.0 build | Passed |
| Local documentation links and whitespace | 5,962 links, no errors; `git diff --check` passed |
| Documentation content, examples and anchor tests | 31/31 passed |
| Bilingual structure | All 13 topic pairs have matching heading-level sequences |
| Immutable impact plan | Maintenance; Linux: actions/checks/docs; Windows and macOS: checks; no unknown paths or package comparison |
| Local Linux scoped receipt | Passed for `a98d3e23` with actions/checks/docs |

The source-backed suite read the marked `docs-example` fences in the actual Markdown and executed the selected CLI workflows in temporary directories. Preset/import dry runs, anchor placement and bilingual destinations remain covered. This was a documentation/source inspection, not interactive editor acceptance.

Final-head scoped receipts, the required **Complete candidate evidence**, merge identity and main promotion are separate evidence recorded by the delivery PR. GitHub is primary; validated main is synchronized to Gitee only after checking divergence, with the remote SHA verified afterward.

## Limits

No installed-product, physical editor/focus, live GitHub source-provider or paid-model acceptance was performed. The existing issue #96 gaps remain unverified. This maintenance does not introduce a product version, tag, Release, npm publication, screenshot or Python-archive change. The private security advisory and issue #231 track product-side follow-ups; this record does not change product code or tests.
