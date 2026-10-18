# External TUI rendering and interaction follow-up

**English** | [简体中文](external-tui-parity.zh-CN.md)

Updated: **2026-10-18** (Asia/Shanghai). Target: **v3.1.1**. Status: **IN_PROGRESS**; delivery has not yet been confirmed.

## Decision and boundaries

The maintainer approved implementation after comparing Python v2.0.0 (`9b6d2fab4bf165be280d428a874521bfbf02c7e1`) and TypeScript v3.1.0 (`10de45895d2734a8ab1eacec09b57bc89417be51`). Retain cyan headings, full-row selection, aligned columns and six languages. Restore useful external-editor information and repair presentation defects. Keep terminal-default frames and backgrounds, four pages, minimum 64×18 and full frames from 20 rows.

Public CLI, editor protocol 12 and persisted formats remain unchanged. Native editor behavior and the Python archive are preserved. Product tests do not introduce a CLI dependency into the TUI package. README remains a product introduction, with no new release history.

## Implementation

The drawing entry retains its existing exports and composes modules for the bounded canvas/ANSI encoder, external field presentation, contextual shortcuts and page content. Shared protocol metadata remains canonical; external labels no longer inherit shortened native labels.

Repairs cover complete separator style, one ellipsis, literal-versus-inherited values, one Enter per action, contextual category/numeric/search controls, compact action discovery, field summaries, format scope/back hints, description highlights and match snippets, pending configuration text markers, wrapped small-window dimensions, preview plurals and 8-color intensity. Notices and inline keys retain bold. Import-review headings retain cyan and full-row selection.

## Validation and evidence

Product regressions cover six languages; 32×12, 64×18, 64×19, 64×20, 80×24, 120×30 and 80×48; and monochrome/8/16/256 colors. Assertions check actual style spans and key behavior, not only text presence or image hashes. Existing named migration, backend, save/cancel, signal, resize and terminal-restoration tests remain required.

`capture:editor -- --artifact TGZ --commit FULL_SHA --output NEW_DIRECTORY --font FILE --extended` captures actual installed PTY output in six languages, contextual views and seven boundary sizes. The same recorded cells are reconstructed using explicit light/dark terminal-default profiles. It asserts full separator styling, actual controls, cancellation preserving configuration bytes and terminal restoration. These images are reconstructed terminal cells, not operating-system screenshots or human desktop/power acceptance. Raw streams, cells and reports remain under ignored validation output.

Local `npm run check` passed: 969 tests, 965 passes, 4 expected platform skips and no failures; 36 generated resources, 2,051 documentation links, frozen archive and all three responsibility ledgers passed. Separate installed package/image and PR/main/tag CI, eight-target, thirteen-host, 32-runtime and public-download evidence remain pending.

## Release decision

[v3.1.1 approval](../releases/approvals/v3.1.1.json) records the maintainer's explicit acceptance of the same six existing gaps for this version only. The release verifier accepts neither another version's approval nor failed/missing automated evidence. D06 remains FAIL and PERF-01 NOT_STARTED.

Delivery uses the fixed build toolchain, two identical builds and a source-archive rebuild. Publish the same verified npm tgz, source tar.gz, build manifest and SHA256SUMS to npm/GitHub/Gitee after final-head, merge and tag checks. npm uses existing OIDC with dry-run first. Preserve beta and published historical bytes; synchronize main and the annotated version tag to Gitee with explicit refspecs. [Release notes](../releases/v3.1.1.md).
