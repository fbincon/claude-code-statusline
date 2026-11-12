# Documentation corrections and source-backed examples

**English** | [简体中文](documentation-content-validation.zh-CN.md)

This 2026-11-12 maintenance follows the [shared content review](https://chatgpt.com/share/6af549b5-f6b4-83ee-bbd0-19ac8fcf5f4c) and the earlier [content organization](documentation-content-organization.md). It corrects current instructions and adds targeted regression coverage, retaining existing paths, anchors and historical evidence. Product behavior, public APIs, protocols and storage formats remain unchanged.

## Content changes

| Area | Result |
| --- | --- |
| Structure and history | Composition, draft history and CLI reference agree on default refusal, dry-run review, exact revision/repair approval, editor cancellation and one-step undo. Picker guidance distinguishes adding a type from editing an instance. |
| Source workflows | GitHub and Node command examples now include complete definitions, registration, review/enablement, component binding, manual refresh, diagnosis and display expectations. Project/profile targets, unavailable results and separate automatic permission remain explicit. |
| Availability and examples | README explains data prerequisites and the v3.16.0 media baseline; metric examples identify localized phrases and separate illustrative values from explanations. Setup/source examples include PowerShell quoting and JSON path escaping. |
| Additional correction | The Chinese CLI layout reference now includes disabled configured instances, matching the English reference and implementation. |

Both languages were updated together. The implementation-stage documentation check found 5,587 local links and no errors; all 424 original anchors across the eighteen edited Markdown pages were retained. Existing screenshots, capture identities, release records and the Python archive were not rewritten.

## Targeted content checks

The [development guide](../../README.md#documentation-content-checks) documents the local entry. Tests read marked examples from the actual Markdown, validate source/display JSON with production parsers, and compare metric counts/IDs, languages, presets, display schema and editor protocol with core definitions. Invalid/missing examples, duplicate fields, non-finite values, changed counts/IDs and stale interface claims have negative coverage.

The CLI journeys use isolated directories with spaces and Unicode. They execute the documented registration, review, enablement, binding, refresh and diagnosis arguments, render the resulting values, and assert states/reasons and byte/mode preservation on refusal. Node really prints `42`; GitHub responses enter through the existing provider runner, without credentials or network calls. Structural cases cover both guides, exact approval, stale revisions, Q/Escape cancellation, acceptance and undo.

The [page registration](../../../../tools/checks/impact-documentation.ts) selects the existing `checks` family alongside `docs`, retaining three-platform tool execution. Registration participates in the immutable policy digest, including deletion/rename coverage. Historical sources predating the suite retain their original obligations; the existing PR #181 regression still passes. `docs:check` remains lightweight.

## Source identity and evidence

The baseline is `fa3f66eadbd2994db6b533a228886e5536e8c363`; the implementation commit is `c158d854d737695506bf155750113d5655e5fa39`, on `docs/refine-content-and-examples`.

| Check | Actual implementation-stage result |
| --- | --- |
| Pinned Node 24.21.0 / npm 11.19.0 build | Pass |
| Documentation and whitespace | `npm run docs:check` and `git diff --check` pass |
| Targeted content/example and impact-plan tests | 34 tests pass, including thirteen content/example tests |
| Immutable impact plan | `maintenance`; Linux: `actions`, `checks`, `docs`; Windows/macOS: `checks`; no unknown ownership or package comparison |
| Local Linux scoped receipt | Pass for the implementation commit; all 23 compiled check-family files pass, supervised in 75,978 ms |

The record commit adds this bilingual page and index links. A subsequent compatibility correction retains the existing per-file classification reason, which the accepted first parent's verifier compares exactly. The selected final-head checks and the PR's **Complete candidate evidence** remain separate evidence; local receipts have no Actions execution identity and cannot substitute for that gate or main promotion.

Intermediate [PR run 983](https://github.com/fbincon/claude-code-statusline/actions/runs/43165119798) passed Linux/macOS but failed the Windows test's synthetic CRLF variant: converting an already-CRLF checkout inserted duplicate carriage returns. The original-text validation and all ten Windows CLI journeys passed. The test now constructs LF/CRLF variants from normalized input; this is a test-fixture correction, and the failed run cannot supply final acceptance.

## Limits

The work does not establish live GitHub authentication/network success, an interactive PowerShell session, installed/physical editor acceptance, paid-model acceptance or exhaustive prose correctness. Existing issue #96 gaps remain unverified. The covered findings required documentation and check-tool changes only. There is no product version, tag, Release or npm publication.
