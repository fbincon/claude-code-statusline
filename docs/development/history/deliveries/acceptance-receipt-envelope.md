# Acceptance receipt envelope

**English** | [简体中文](acceptance-receipt-envelope.zh-CN.md)

This 2026-11-14 documentation and tooling delivery defines the shared acceptance receipt envelope, adds its validator and unit tests, and applies it as an additive field in the showcase and editor-capture receipt producers. Existing CI evidence formats are unchanged; `official-tests` remains on its own schema. Product behavior, commands, public interfaces, stored formats and published releases are unchanged. No version, tag, Release or npm publication is created.

## Changes

| Area | Result |
| --- | --- |
| Envelope contract | `tools/checks/receipt.ts` defines `AcceptanceEnvelope`, `createAcceptanceEnvelope` and `validateAcceptanceEnvelope`; source commit and file digest, artifact identity, runtime identity, at least one passing check and explicit limitations are required. |
| Exemplars | `tools/acceptance/showcase.ts` and `tools/acceptance/editor-capture.ts` add a nested `envelope` without changing existing top-level fields; their collector identity covers `tools/checks/receipt.ts`. |
| CI boundary | `tools/checks/ci-fragment.ts` schema 2, `tools/checks/impact-product.ts` schema 1, release bindings and `tools/acceptance/official-tests.ts` remain authoritative and unchanged. |
| Tests | `tools/checks/test/receipt.test.ts` covers exemplar shapes, the official-tests-compatible shape, unknown extension keys and invalid identity/check/limitation cases. |
| Documentation | `docs/development/testing.md#acceptance-receipt-envelope` records the contract and the exemplar-only boundary; the template/check registry links it. |

## Source identities

- Baseline before the task: `9c9c565a`.
- Implementation commit and final head are recorded in the PR description after CI.

## Validation and limits

| Check | Actual result |
| --- | --- |
| `npm run docs:check` | 7,304 links, 0 errors |
| `receipt.test.js` | 2/2 passed |
| `npm run check` | Isolated group 1,184/1,184 passed; serial group 585/591 passed with 6 platform skips; 0 failures |
| `npm run build` | Passed |
| `git diff --check` | Passed |
| Impact plan and scoped checks | Recorded in the PR description after CI |

This delivery does not refactor the remaining acceptance scripts, change existing CI evidence identities, or perform product, installed, platform or paid acceptance. Local diagnostics keep their own formats and remain non-promotable.
