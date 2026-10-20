# Real-input diagnosis and host-field coverage

**English** | [简体中文](real-input-diagnostics.zh-CN.md)

Implementation baseline: `6716435` after configuration-experience delivery. The [user guide](../DIAGNOSTICS.md) defines the shipped command contract. Publication and final-artifact acceptance are pending; this record does not claim a released milestone.

## Architecture and contracts

Core owns host-field interpretation, configuration reasons, neutral render tracing and real-input report assembly. The existing sample adapter maps neutral layout results to its sample-specific reason codes. Production rendering keeps tracing opt-in. CLI owns explicit input parsing, display/settings reads and adaptation of existing stores; platform exposes bounded file reads without mutation or process methods.

Editor protocol 14 adds `diagnose` with required `draft`, `input`, `scope` and `width`; optional `source` defaults to `supplied_json`, `observed_at` defaults to null, and `include_local` defaults to true. The response separates provenance, fitted output spans, instance reasons, evidence and row outcomes. `explain` remains sample-only. Display schema 8, runtime 2, portable 1 and UI preferences 1 are unchanged. Both editors receive the new optional component through generated catalog and localization resources.

The diagnostic adapter does not use `ConfigurationService.read`, which creates an installation lock. It uses individual read-only display/settings reads. Runtime observations never invoke collector classes, transaction services, directory scans, reconciliation, subprocesses or network clients. Published request/cost joins have a separate pure snapshot resolver; ordinary collection retains its existing reconciliation behavior. Frozen task snapshots can use the production timer formatter without collecting transcripts.

The ordinary worktree label remains preferred when both host fields exist. A linked Git worktree has a distinct label. Cache miss explanations remain host-reported hypotheses; detailed counts and timestamps stay in the report. The optional `cache-miss-reason` adds one main metric: 61 main / 14 subagent metrics, or 63 / 16 types including composition components. Defaults are unchanged.

## Evidence and limits

Synthetic [host fixtures](../../tests/fixtures/diagnostics/host-input.json) bind field semantics to the official statusline documentation, inspected on 2026-10-19. They contain no real session data. The legacy Python corpus and archived receipts remain unchanged; comparison accepts only the new operation, explicit worktree metadata change and additive cause component at their exact paths.

Tests cover CLI/file/stdin/backend transport, six languages, repeated instances and fitting, missing/invalid/zero values, session and prompt isolation, stale/future evidence, and read-only before/after store equality. Sample and real output use the same fitting implementation. Separate tests exercise generated Mod protocol parsing and generic editor saving of the added component.

Known limits: source snapshots are not globally atomic; usage caches lack capture times; no transcript refresh or historical reconstruction occurs; absent commit-pair identity prevents branch-diff lookup. Existing physical/desktop/exact-host gaps in [#96](https://github.com/fbincon/claude-code-statusline/issues/96) remain unverified. The [2026-10-20 decision](../releases/approvals/v3.3.0.json) accepts only those six gaps for v3.3.0; all new functional and automated failures remain blocking.

## Validation record

Local implementation checks passed: `npm run check` ran 1,055 tests (1,051 passed, four platform skips, zero failures), generated-resource parity, 2,477 documentation links, archive integrity and all migration ledgers. Official native/runtime Mod tests passed on Linux Claude Code 2.1.294 with synthetic offline credentials and zero model calls. These checks do not replace installed-artifact or final platform acceptance.

Record immutable source and artifact identities, final checks, PR/main/tag CI, installed/Mod/PTY results and public delivery evidence here as they complete. Store raw receipts in ignored validation directories. Documentation-only follow-up does not rerun product matrices.

### Engineering candidate

Source `ae574dba06d22c59c04d4217e3a2cb4f29e31dec`; private engineering package SHA-256 `c5db3f984387ce110a0bfea5ee5ca547f626d5f8c4f823d9132f236a468e5f99`. Two independent builds are byte-identical. Ten isolated installed checks and twenty supplied-input checks passed, including all six languages at 40/80/120 columns and unchanged files after diagnosis. Linux Claude Code 2.1.294 native/runtime official tests, exact declarations and actual installed binding passed. Raw receipts are under ignored `dist/validation/v3.3.0/`. All 396 extended six-language installed PTY captures passed, with terminal restoration. Capture receipt SHA-256: `db6e52b41ccf90e7fb980a37ba5da6817c6f0a6cc3b68c0f426f4a5f7acd0b30`. Selected reconstructed frames were visually inspected by the agent; this is not human desktop acceptance. Final PR/main/tag matrices and public v3.3.0 publication are pending.
