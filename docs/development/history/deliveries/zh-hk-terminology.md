# Hong Kong terminology normalization

**English** | [简体中文](zh-hk-terminology.zh-CN.md)

This 2026-11-21 feature delivery normalizes `zh-HK` to the documented Hong Kong vocabulary and records fresh structural acceptance for the changed messages. Delivery is limited to source and documentation; no version, tag, Release or npm publication is created. [Issue #234](https://github.com/fbincon/claude-code-statusline/issues/234)

## Changes

| Area | Result |
| --- | --- |
| Terminology | All 68 affected keys follow the documented Hong Kong conventions. Source data uses `數據來源`, metadata uses `元數據`, identity data uses `識別資訊` and consumers use `使用方`. The JSON caption and the truncated check-list notice use `詳情`. |
| Acceptance | The 68 changed translations were structurally validated, reviewed in context, and accepted; `zh-HK` remains 2,345/2,345 accepted with no English fallback. |
| Regeneration | The canonical Resource pack, generated Node/Native dictionaries and acceptance/history/provenance evidence were regenerated together; `zh-TW` and baseline snapshots are unchanged. |
| Regression coverage | A generation test rejects the four Taiwan variants in `zh-HK` and asserts that `zh-TW` keeps its own terminology; CLI regional-language tests cover representative messages. |
| Documentation | The translation guide records the consistent Hong Kong convention, the standard alternatives and the unchanged native-speaker caveat. |
| Scoped checks | Oversized maintenance tasks split at check-family boundaries. Each task retains its planned platform and host, and earlier source revisions retain their original task lists. |

## Source identities

- The initial checks below ran on head `6f7b7ec06216c087c05a709a1845fbb2054dfe56` against baseline `db5a0b9f71b2ac355f495e265c85b0ae3b856e3b`.
- The completion update integrates `main` at `cf6d115ab07d0e362805e5446368e3cd28ee43dc`. The final head, package comparison identities and scoped results are recorded in [PR #285](https://github.com/fbincon/claude-code-statusline/pull/285).

## Validation and limits

| Check | Actual result |
| --- | --- |
| `node --test dist/typescript/tools/generation/test/i18n-terminology.test.js packages/cli/dist/test/regional-language.test.js` | Six targeted regression tests passed. |
| `npm run generate` / `generate:check` | 119 resources regenerated and verified; no capacity-fixture changes appeared. |
| `npm run languages:coverage` | `zh-HK` 2,345/2,345 raw, current and accepted, zero fallback; development and release readiness true. |
| `npm run languages -- release-check --format text` | All twelve languages complete; development and public release ready. |
| `npm run check` | Passed; 597 product tests with 591 passes and six platform-specific skips, 1,248 tool tests, and clean documentation links/anchors. |
| `claude plugin test mods/statusline-native` | 357 tests passed across 45 files, including the registered language cycling. |
| External language tests | 34 tests passed, including all 144 interface/statusline combinations and actual rendering. |
| `npm run docs:check` / registered content tests | 7,436 links with zero errors; 37 content/example tests passed. |
| Initial `npm run ci:plan -- --compare` | The package comparison reported equivalence. The original Linux task budget was 377 minutes and scheduling rejected it. |
| `git diff --check` | Clean. |

The completion update explicitly validated and accepted the two wording refinements and verified 119 generated resources. The planner, historical evidence, bilingual documentation and regional-language suites passed 69 tests before the final commits.

The acceptance record is structural and contextual only; it does not establish native-speaker review. Automated editor tests cover both editors, but no human visual or physical desktop sample was made. `zh-TW` terminology was not changed. The six existing [issue #96](https://github.com/fbincon/claude-code-statusline/issues/96) platform gaps remain unverified, and no paid model calls were made.
