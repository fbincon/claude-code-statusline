# Acceptance producer registry

**English** | [简体中文](acceptance-producer-registry.zh-CN.md)

This 2026-11-14 documentation and tooling delivery registers every non-test top-level `tools/acceptance` module and adds a blocking registry check with bilingual projections. It does not change any acceptance producer's production logic, CI evidence format, product behavior, command, public interface, stored format or published release. No version, tag, Release or npm publication is created.

## Changes

| Area | Result |
| --- | --- |
| Registry | `tools/checks/acceptance-producers.ts` defines `ACCEPTANCE_PRODUCERS` with 60 entries: 21 producers, 3 diagnostics, 30 helpers, 4 wrappers and 2 drivers. |
| Check | `checkAcceptanceProducers` validates the filesystem inventory, entry invariants, fixed exceptions and both bilingual table projections; `validateKnownExceptions` locks the sensitive decisions. |
| Enforcement | `tools/checks/docs.ts` calls the check, so `npm run docs:check` and `npm run check` block drift. `tools/acceptance/test/acceptance-producers.test.ts` closes the acceptance-family scoped route. |
| Documentation | `docs/development/testing.md#acceptance-receipt-producers` records the policy, token vocabulary, exceptions and registry; the template/check registry and `AGENTS.md` link it. |
| Boundary | No producer logic, `ci-fragment` schema 2, complete evidence, scoped or maintenance receipt, release binding, `official-tests` schema or `integration-smoke` schema changed. |

## Source identities

- Baseline before the task: `86bd098b`.
- Implementation commit and final head are recorded in the PR description after CI.

## Validation and limits

| Check | Actual result |
| --- | --- |
| `npm run docs:check` | 7,340 links, 0 errors |
| `acceptance-producers.test.js` | 6/6 passed |
| acceptance-family `acceptance-producers.test.js` | 1/1 passed |
| `docs-content.test.js` + `docs-examples.test.js` | 34/34 passed |
| `npm run check` | Isolated group 1,192/1,192 passed; serial group 585/591 passed with 6 platform skips; 0 failures |
| `npm run build` | Passed |
| `git diff --check` | Passed |
| `npm run generate:check` | Passed; 118 generated resources, check true |
| Impact plan and scoped checks | Recorded in the PR description after CI |

This delivery does not adopt envelopes in additional producers, migrate the physical fragment schema, run paid or manual acceptance, or rewrite frozen records. The registry classifies source files only; coverage-plan counts, producer and job identities, receipt file sets and release bindings remain owned by their existing checks. Deliberate reclassifications that change a locked exception also update `validateKnownExceptions` and `PLANNED_ALLOWED`. The registry check is a no-op when `tools/acceptance` or either testing guide is absent; other build, acceptance and bilingual checks cover those structural failures.
