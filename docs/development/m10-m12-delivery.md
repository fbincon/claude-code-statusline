# M10–M12 implementation and delivery

**English** | [简体中文](m10-m12-delivery.zh-CN.md)

The approved order is IMPORT-01, APPEARANCE-04, COMPOSITION-03, then one v3.9.0 release PR. Starting main: `7d73a2c9f7418f59f781fe71a0e9e66f4db18a2a`; its documentation CI passed. Feature acceptance, final release-source gates and public publication are separate.

## IMPORT-01

[PR #143](https://github.com/fbincon/claude-code-statusline/pull/143) merged as `e4f3e7b3266aae7d35d579a233e2e9c58b5d7b3b`, with head `69ad4485c5f03e43845864a82968ba938f7c1b92`. [CI 40218297344](https://github.com/fbincon/claude-code-statusline/actions/runs/40218297344) passed all 56 applicable jobs: 8 installed targets, 32 Node cases, 13 fixed hosts and the source/aggregate gates. IMPORT-01 is functionally DONE; publication remains pending the combined release.

Protocol 22 adds optional exact selection keys to the existing import operations; display schema remains 13, with portable/profile envelopes remaining 1. The shared selector and differences are generated from core into the native editor. Whole scoped sections retain valid internal identities; main and subagent ID namespaces remain independent. No arbitrary component merge or host-authorization transfer is introduced.

CLI and both editors support the global and complete-section slices. Named/profile/project saves reuse revision-checked transactions and retain identity/bindings. Installed receipts add four selective-import cases to the existing twenty categories. See [usage and target rules](../PROFILES.md#selective-import).

Local source checks passed 1,218 tests with 5 explicitly skipped; generated resources, documentation links and migration inventories passed. The local official native Mod suite passed 133 tests. All 21 installed categories passed before the rollback repair. The real npm 3.7.0/current roundtrip, interruption recovery and explicit configuration restoration passed on pinned Claude Code 2.1.296 with the repaired package. The final feature CI matrix passed as recorded above; no public release has been made.

The pinned-host matrix exposed a rollback defect: an older ownership reader cannot interpret the newer editor protocol, and an official plugin update can retain a newer cache. The current package now verifies and stages the actual target Mod bundle, re-installs the owned cache on downgrade, preserves explicit disablement and unrelated settings, and then runs the target installer in a separate process. Resource hashes, backend bindings and doctor results remain mandatory. This fixes a new automated failure; it is not part of the six accepted historical gaps.

## Remaining work

APPEARANCE-04 is in progress; COMPOSITION-03 is not started. Their planned schema/protocol pairs are 14/23 and 15/24. SHOWCASE-01 remains outside this delivery. The six historical [issue #96](https://github.com/fbincon/claude-code-statusline/issues/96) gaps remain unverified; only those gaps are accepted for the approved release after all final automated gates pass.

## APPEARANCE-04

Implementation is in progress in an isolated worktree based on the IMPORT-01 implementation. Schema 14 / protocol 23 add optional normalized RGB arrays; the shared forms cycle presets or edit custom stops. Post-fit foreground callbacks preserve instance boundaries inside semantic wraps, and background painting includes padding before boundary colors are selected. Both scopes use the same pure interpolation; warnings retain precedence and source observations are unchanged. Focused tests cover grapheme endpoints, links, clipping, groups and six-language forms. Source checks passed 1,227 tests with 5 explicitly skipped; the later warning-contrast test also passed. All 22 installed categories passed on package source `8fa8bc9`. Pinned Claude Code 2.1.296 passed both official Mod suites, installed integration and real-npm schema upgrade/refusal/restore/rollback on source `21da545`; the final feature matrix is still required.
