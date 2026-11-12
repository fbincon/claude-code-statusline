# Development documentation factual corrections and historical freezing

**English** | [简体中文](development-docs-corrections.zh-CN.md)

This 2026-11-13 documentation maintenance corrects current development guidance that had drifted from the 3.16.3 implementation and freezes historical delivery records that still read as current. Product behavior, interfaces, storage formats and command output are unchanged.

## Content changes

| Area | Result |
| --- | --- |
| Installed acceptance | The development guide now records the v3.15.0+ contract of 27 check categories (26 earlier), including version management and the i18n workflow. |
| Resource ownership | `tools/generation/` owns language and Mod outputs; the statusline skill sources remain canonical under `packages/cli/resources` and are maintained separately. |
| CI observation | The CI efficiency page records PR #204's completed full run `41291221369` instead of waiting for a future core PR. |
| Repository state | Repository governance records the observed `origin` state on 2026-11-13; the 2026-10-26 inventory remains historical and is not deletion authorization. |
| Native history | The Phase 4 acceptance block is scoped to the Python/Curses era and links the archived acceptance script. |
| Regional terminology | The translation guide describes the documented Hong Kong convention and the actual zh-HK mixed usage tracked by [issue #234](https://github.com/fbincon/claude-code-statusline/issues/234). |
| Historical status | PERF-01, UPDATE-02 slices 2/3, issues #173/#178/#179/#180 and SHOWCASE-01 now use past-tense status with forward links to their closures. v3.1.1, v3.1.2, v3.3.0, v3.5.0 and v3.6.0 records carry frozen-version banners. |
| Migration records | TS-01 through TS-06 READMEs carry historical-stage banners; stale stage status and interface versions are version-qualified. The TS-04 candidate and recovery pages are marked as historical evidence, and the migration plan is framed as an archive-close record. |
| Historical references | The Python implementation notes are scoped to the final Python release v2.0.0. The planning snapshot and the separate v3.9.1 review source are disambiguated in the work-package and roadmap records. |

## Source and verification

The baseline is `4e432337`. The implementation commits are:

| Stage | Commit |
| --- | --- |
| Correct current guide facts | `3c64cf1e` |
| Freeze historical records | `b8b7a834` |

The delivery commit adds this record and the history index entry.

| Check | Actual result |
| --- | --- |
| `npm run docs:check` | 6,258 local links, 0 errors |
| `git diff --check` | Passed |
| Bilingual pairing and heading levels | 99 pairs, 0 missing counterparts, 0 level mismatches |
| Anchor preservation against the baseline | 2,446 anchors checked, 0 missing |
| Build and documentation tests | `docs-content.test.js` and `docs-examples.test.js`: 28/28 passed |
| Immutable impact plan | Recorded by the delivery PR |
| Local Linux scoped receipt | Recorded by the delivery PR |

The content tests read the marked fences in the actual Markdown and executed the selected CLI workflows in temporary directories. This was documentation and source inspection, not installed-product, editor/focus, physical or paid-model acceptance.

## Limits

No installed-product, physical editor, terminal, live provider or paid-model acceptance was performed. The six accepted issue #96 gaps remain unverified. This maintenance does not introduce a product version, tag, Release, npm publication, screenshot or Python-archive change. The zh-HK terminology inconsistency is a product issue tracked by #234 and is not changed here.

Final-head **Complete candidate evidence**, merge identity and main promotion are recorded by the delivery PR. GitHub remains primary; validated main is synchronized to Gitee only after checking divergence, with the remote SHA verified afterward.
