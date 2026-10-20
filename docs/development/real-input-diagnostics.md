# Real-input diagnosis and host-field coverage

**English** | [简体中文](real-input-diagnostics.zh-CN.md)

Implementation baseline: `6716435` after configuration-experience delivery. The [user guide](../DIAGNOSTICS.md) defines the shipped command contract. v3.3.0 is published and verified on npm, GitHub and Gitee; the delivery evidence is recorded below.

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

Immutable source and artifact identities, final checks, PR/main/tag CI, installed/Mod/PTY results and public delivery evidence are recorded below. Raw receipts remain in ignored validation directories. Documentation-only follow-up does not rerun product matrices.

### Engineering candidate

Source `ae574dba06d22c59c04d4217e3a2cb4f29e31dec`; private engineering package SHA-256 `c5db3f984387ce110a0bfea5ee5ca547f626d5f8c4f823d9132f236a468e5f99`. Two independent builds are byte-identical. Ten isolated installed checks and twenty supplied-input checks passed, including all six languages at 40/80/120 columns and unchanged files after diagnosis. Linux Claude Code 2.1.294 native/runtime official tests, exact declarations and actual installed binding passed. Raw receipts are under ignored `dist/validation/v3.3.0/`. All 396 extended six-language installed PTY captures passed, with terminal restoration. Capture receipt SHA-256: `db6e52b41ccf90e7fb980a37ba5da6817c6f0a6cc3b68c0f426f4a5f7acd0b30`. Selected reconstructed frames were visually inspected by the agent; this is not human desktop acceptance. Final-source checks and publication evidence are recorded below.

## Release validation — 2026-10-20

[Implementation PR #115](https://github.com/fbincon/claude-code-statusline/pull/115) merged as `002c55dd993f457ab438507214515385b67692fa`. Annotated tag `v3.3.0` is object `72daa1af12a78cc305fa48b603852a3f73ca02b4` and points to that commit. Final review added a regression that prevents a task snapshot newer than the supplied input from leaking into lifecycle-state rendering; each contributing source retains its own observation time.

| Gate | Evidence | Result |
| --- | --- | --- |
| Final PR head `e8c8900` | [CI 39407955538, attempt 2](https://github.com/fbincon/claude-code-statusline/actions/runs/39407955538/attempts/2) | 56 successful jobs; documentation-only job skipped |
| Merged main | [CI 39413309273](https://github.com/fbincon/claude-code-statusline/actions/runs/39413309273) | Complete matrix and stable readiness passed |
| Version tag | [CI 39416322509](https://github.com/fbincon/claude-code-statusline/actions/runs/39416322509) | Complete matrix and stable readiness passed |
| Local development | `npm run check` | 1,056 tests: 1,052 passed, zero failed, four platform skips; 39 generated resources, 2,491 links, archive integrity and ledgers passed |
| Final-package installation | Offline installation and diagnosis | Ten installed checks and twenty supplied-input cases passed |
| Local fixed host | Linux Claude Code 2.1.294 | Native/runtime validation, official tests, exact declarations and actual installed binding passed |
| Installed terminal workflows | Final-package extended PTYs, six languages | All 396 captures and terminal restoration passed |

Each full matrix requires eight offline installation targets, all 32 Node runtime cases and thirteen fixed host combinations. The installed and Node harnesses include the diagnosis cases. Exact Claude 2.1.296 declarations remain unavailable under the version-specific decision.

The [first PR attempt](https://github.com/fbincon/claude-code-statusline/actions/runs/39407955538/attempts/1) stalled on macOS 26 Intel / Node 24.x after the live log reported 612 product tests: 610 passed, two platform skips and zero failures. No installation receipt followed. The run was cancelled after exceeding the acceptance subprocess timeout; the aggregate correctly rejected incomplete evidence. GitHub did not provide a completed log archive for the stalled job, so its live-page summary and job metadata were retained separately. The affected case and aggregate passed on attempt 2 at the same source and with the same package. No check, timeout or acceptance rule was relaxed. The same target also passed in the main matrix.

Two independent local builds, a delivered-source rebuild and the main/tag CI bundles match byte for byte for all four delivery files. Package SHA-256: `605ef85be239a9b4184bb59ce7cad036880a66c43ea126845b180aa66ebee90f`. Source archive SHA-256: `497b892739aff300983b493171914cd6ed9b854eb5b717ba7d10ee85c0b1d71f`.

Final local evidence is retained under ignored `dist/validation/v3.3.0/`. The final `release-captures/editor-capture.json` digest is `7861eceb29bc69e409ff23cca5092f15eaa44cc70207808310314228d8d1be4b`. Selected English and Chinese frames were visually inspected by the agent; reconstructed cells and recorded fonts do not establish human desktop or power acceptance. An initial local Mod setup attempt found that the earlier temporary host directory no longer existed; reinstalling the same pinned host completed acceptance without a product change.

## Published delivery

- [GitHub stable / Latest](https://github.com/fbincon/claude-code-statusline/releases/tag/v3.3.0), Release `418352448`, published at `2026-10-20T12:13:44Z`. All four draft attachments were downloaded and matched the verified build; the downloaded package passed ten installed checks. [SHA256SUMS](https://github.com/fbincon/claude-code-statusline/releases/download/v3.3.0/SHA256SUMS) identifies the package, source and manifest.
- [npm 3.3.0](https://www.npmjs.com/package/@fbincon/claude-code-statusline/v/3.3.0): [OIDC dry-run](https://github.com/fbincon/claude-code-statusline/actions/runs/39419833196) and [publication](https://github.com/fbincon/claude-code-statusline/actions/runs/39420030905) passed. The receipt records `published` for the verified commit and package. Public SHA-512 integrity matched; `latest=3.3.0` and `beta=3.0.0-beta.1`.
- [Public-download CI](https://github.com/fbincon/claude-code-statusline/actions/runs/39420669544) passed all six Linux/Windows/macOS × Node 22/24 jobs. Exact-version and `latest` installations passed in twelve initially empty caches with lifecycle scripts disabled; GitHub/npm bytes and registry integrity matched.
- [Gitee stable](https://gitee.com/fbincon/claude-code-statusline/releases/tag/v3.3.0), Release `1223144`: validated main and the annotated tag were synchronized with explicit refspecs after an ancestry check. All four attachments were anonymously downloaded and matched; the downloaded package passed ten offline installation checks. Automatic repository archives are separate from the rebuildable source attachment.

The first Gitee asset upload encountered a TLS transport error and left no asset. After checking remote state, the same files were uploaded through the active native interface with freshly resolved public addresses and normal certificate verification. Anonymous downloads used that path too; credentials stayed in the existing keyring-backed API client.

This documentation follow-up records actual delivery and uses documentation/link/whitespace checks only. The released tag and package remain bound to the implementation commit above. The six disclosed physical/desktop/exact-declaration gaps remain unverified.
