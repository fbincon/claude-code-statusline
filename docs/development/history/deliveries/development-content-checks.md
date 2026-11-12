# Development content checks and registration

**English** | [简体中文](development-content-checks.zh-CN.md)

This 2026-11-13 maintenance registers the current `docs/development` guides in the source-backed documentation suite and adds rules that compare their facts with production definitions. Product behavior, interfaces, storage formats and command output are unchanged.

## Registration and rules

| Area | Result |
| --- | --- |
| Registered pages | 29 current development guides × English/Simplified Chinese (58 exact paths). Historical records and old-path compatibility stubs remain unregistered. |
| Generic rules | Current pages reject a frozen historical banner, historical delivery framing, known stale interface versions, unknown `npm run` scripts and a missing link to a same-name delivery record when one exists. |
| Interface versions | Prose display schema, editor protocol and runtime protocol literals must equal the core constants; compatibility ranges and history tables are excluded. |
| Acceptance matrix | `testing` and `node-regional-languages` are checked against the 8 installations / 32 Node cases / 16 hosts registries; `testing` also checks 27 installed-category checks. |
| Catalog and operations | `contracts` is checked against the 41 current operations and the 67/17 catalog type counts. |
| Languages | `i18n` and `node-regional-languages` must list every registry selector; `i18n-workflow` must retain the 144 language-combination count. |
| Runtime and native | `live` is checked against the turn/tool/task/request bounds; `native` must retain the current External TUI section and `A/D/X` control order. |
| CI and tooling | `ci-maintenance` is checked against the 40 logical obligations, 16 fixed hosts and 8/8 history split; `architecture` must list every `tools/` directory; `README` must retain the canonical skill paths. |
| Skill and source defaults | `skill-workflows` must match the action list in the canonical skill template; `source-command-package-management` must retain the documented automatic interval and lease defaults. |

## Source and verification

The baseline is `a624ed35`; the implementation commit is `abb0cb17`.

| Check | Actual result |
| --- | --- |
| Build | Passed |
| `docs-content.test.js` | 5/5 passed |
| `docs-examples.test.js`, `impact-plan.test.js`, `ci-scope.test.js` | 54/54 passed |
| `npm run check` | Passed: 585/591 tests, 6 platform skips, 0 failures; 118 generated resources |
| `npm run docs:check` | 6,868 links, 0 errors |
| `git diff --check` | Passed |
| Immutable impact plan | Recorded by the delivery PR |
| Local Linux scoped receipt | Recorded by the delivery PR |

The mutation tests change each registered fact and inject a historical banner, historical framing, stale interface version and unknown npm script; each mutation must fail the registered page. CRLF coverage follows the existing all-page test.

## Limits

This is documentation-check tooling, not installed-product, physical editor, terminal, live-provider or paid-model acceptance. The newly registered current pages are not edited in this change; guide wording updates can follow separately. The six accepted issue #96 gaps remain unverified.

Final-head **Complete candidate evidence**, merge identity and main promotion are recorded by the delivery PR. GitHub remains primary; validated main is synchronized to Gitee only after checking divergence, with the remote SHA verified afterward.
