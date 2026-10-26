# M10–M12 implementation and delivery

**English** | [简体中文](m10-m12-delivery.zh-CN.md)

IMPORT-01, APPEARANCE-04 and COMPOSITION-03 are delivered in **v3.9.0**, published and publicly verified on GitHub, npm and Gitee on 2026-10-26 (Asia/Shanghai). Three feature PRs were followed by one release PR, starting from main `7d73a2c9f7418f59f781fe71a0e9e66f4db18a2a`. Final evidence follows; preparation history is retained separately.

## Final source and release gates

[Release PR #146](https://github.com/fbincon/claude-code-statusline/pull/146), reviewed at `ac9ff6fb6e3ae61776a66fdc2d56c7909cf7458b`, merged as `dc8732fb3605db0f4d9e918ceebc9aeb7e8dca8f`. The annotated `v3.9.0` tag object is `38900d7552d8103a0d24f3b09504936cec1b8f75` and resolves to that merge. Display schema is 15 and editor protocol is 24; portable/profile envelopes remain 1, with source/runtime formats unchanged.

| Gate | Source | Result |
| --- | --- | --- |
| [Release PR CI 40235603129](https://github.com/fbincon/claude-code-statusline/actions/runs/40235603129) | `ac9ff6f` | All 56 applicable jobs passed |
| [Final main CI 40239423724](https://github.com/fbincon/claude-code-statusline/actions/runs/40239423724) | `dc8732f` | All 56 applicable jobs passed |
| [Final tag CI 40239517617](https://github.com/fbincon/claude-code-statusline/actions/runs/40239517617) | `dc8732f` | All 56 applicable jobs passed |

Each gate independently covers 8 installed targets, 32 Node cases, 13 fixed hosts and the source/aggregate checks. Main and tag acceptance reports bind the same package and the exact six accepted gaps; both report SHA-256 `96790b5abc8849037ff2e9524b663503f902bd1d2946e9b6fd8c5ebf6c7ef97b`. Real published v3.7.0 and v3.8.0 histories exercise upgrade, schema 13 → 15 migration, incompatible-schema refusal, explicit backup restoration, rollback and interrupted-process recovery.

## Reproducible artifacts and installed terminal evidence

Two independent local builds, complete rebuilds from the delivered source archive, and the final main/tag CI builds produced identical bytes for all four files. Build identity remains Node 24.21.0/npm 11.19.0. All four GitHub draft attachments were downloaded again and matched before publication; the downloaded package passed isolated offline installation with an initially empty cache and lifecycle scripts disabled.

| File | SHA-256 |
| --- | --- |
| `fbincon-claude-code-statusline-3.9.0.tgz` | `1b337f4ff36426e989cfa9682927968c3450baca05f187dfd59636ebfe77197c` |
| `claude-code-statusline-3.9.0-source.tar.gz` | `403257e53bffe2ebbe054b511cb3adea0eb6b17d418e868348a296a993ba5fcc` |
| `build-manifest.json` | `1bacd973c1ae98d6f3bbc0011d77ec0a8e57d3e878db3bb6ba1c0fdd1593109e` |
| `SHA256SUMS` | `c40b78feec7aa56a87e6eb0a15fb823e42e2003bd41e5ac574a44be4c0ac0503` |

The final installed artifact passed 792 six-language dark/light PTY terminal-cell reconstructions (132 per language), four monochrome/unsupported-terminal cases and terminal restoration, with zero model calls. Report SHA-256: `a99098d15f68a5856322c7a2c89b325e1304bec135019181e6af22e44cf2d3ea`. Representative screens in all six languages and the 40-cell joint reconstruction were visually inspected by the agent. Automated installed joint acceptance covers six languages × 40/80/120 cells, save/reopen equality and preview/render equality. Raw CJK, combining characters, emoji graphemes and links are checked separately from font appearance; the supplied local fonts do not shape the complex emoji in the joint reconstruction. These frames are PTY reconstructions. Human and physical-machine checks retain their recorded status.

## Publication and public verification

[npm 3.9.0](https://www.npmjs.com/package/@fbincon/claude-code-statusline/v/3.9.0), [GitHub stable/Latest](https://github.com/fbincon/claude-code-statusline/releases/tag/v3.9.0) and [Gitee stable](https://gitee.com/fbincon/claude-code-statusline/releases/tag/v3.9.0) are published and verified. GitHub publication time is `2026-10-25T23:55:28Z` (2026-10-26 in Asia/Shanghai).

[OIDC dry-run 40246377282](https://github.com/fbincon/claude-code-statusline/actions/runs/40246377282) and [tag-dispatched publication 40246617447](https://github.com/fbincon/claude-code-statusline/actions/runs/40246617447) passed. npm `latest=3.9.0`; `beta=3.0.0-beta.1` is preserved. The [first live dispatch from main](https://github.com/fbincon/claude-code-statusline/actions/runs/40246483060) was rejected by the existing release-tag guard before publishing; its publish job was skipped and made no registry write. Dispatching the unchanged workflow from `v3.9.0` succeeded without relaxing a gate.

[Public-download CI 40246908215](https://github.com/fbincon/claude-code-statusline/actions/runs/40246908215) passed all six Linux/Windows/macOS × Node 22/24 cases. Each verifies public GitHub/npm bytes and fresh-cache exact-version/latest installations; observed runtimes were Node 22.23.4 and 24.22.1. The six original receipt ZIPs and their source/package identities were verified. Gitee's four delivery attachments were downloaded anonymously over HTTPS, matched the table and passed an offline fresh-cache installation plus version/configuration/rendering checks. Gitee's two generated repository archives are separate from the four delivery attachments. Validated main and the identical annotated tag were synchronized with explicit refspecs after a divergence check; GitHub remains primary.

Only the six pre-existing [#96 gaps](https://github.com/fbincon/claude-code-statusline/issues/96) are accepted under the [v3.9.0 approval](../releases/approvals/v3.9.0.json). They remain unverified. Automated, PTY, agent visual and human/physical evidence are distinct; no new failed or missing automated gate is waived. SHOWCASE-01 remains NOT_STARTED.

The documentation follow-up records these receipts, aligns current guides/examples/contracts with schema 15/protocol 24, and moves M10–M12 into delivered planning tables. Historical introduction versions remain documented. README contains no version/update notes from this delivery; documentation-only validation applies to the follow-up.

## IMPORT-01

[PR #143](https://github.com/fbincon/claude-code-statusline/pull/143) merged as `e4f3e7b3266aae7d35d579a233e2e9c58b5d7b3b`, with head `69ad4485c5f03e43845864a82968ba938f7c1b92`. [CI 40218297344](https://github.com/fbincon/claude-code-statusline/actions/runs/40218297344) passed all 56 applicable jobs: 8 installed targets, 32 Node cases, 13 fixed hosts and the source/aggregate gates. IMPORT-01 is functionally DONE and included in the verified v3.9.0 release.

Protocol 22 adds optional exact selection keys to the existing import operations; display schema remains 13, with portable/profile envelopes remaining 1. The shared selector and differences are generated from core into the native editor. Whole scoped sections retain valid internal identities; main and subagent ID namespaces remain independent. No arbitrary component merge or host-authorization transfer is introduced.

CLI and both editors support the global and complete-section slices. Named/profile/project saves reuse revision-checked transactions and retain identity/bindings. Installed receipts add four selective-import cases to the existing twenty categories. See [usage and target rules](../PROFILES.md#selective-import).

Local source checks passed 1,218 tests with 5 explicitly skipped; generated resources, documentation links and migration inventories passed. The local official native Mod suite passed 133 tests. All 21 installed categories passed before the rollback repair. The real npm 3.7.0/current roundtrip, interruption recovery and explicit configuration restoration passed on pinned Claude Code 2.1.296 with the repaired package. The final feature CI matrix passed as recorded above; these local results preceded the final release gates above.

The pinned-host matrix exposed a rollback defect: an older ownership reader cannot interpret the newer editor protocol, and an official plugin update can retain a newer cache. The current package now verifies and stages the actual target Mod bundle, re-installs the owned cache on downgrade, preserves explicit disablement and unrelated settings, and then runs the target installer in a separate process. Resource hashes, backend bindings and doctor results remain mandatory. This fixes a new automated failure; it is not part of the six accepted historical gaps.

## Release boundary

All three work packages are functionally DONE. The gradient/alignment schema/protocol pairs are 14/23 and 15/24. SHOWCASE-01 remains outside this delivery. The six historical [issue #96](https://github.com/fbincon/claude-code-statusline/issues/96) gaps remain unverified; only those gaps are accepted for the approved release after all final automated gates pass.

## APPEARANCE-04

[PR #144](https://github.com/fbincon/claude-code-statusline/pull/144) merged as `0c0200240292dc912f635cccffd6a4c53a08c58a`, with head `564915a847fea0575d785644115261691b7318ee`. [CI 40225167655](https://github.com/fbincon/claude-code-statusline/actions/runs/40225167655) passed all 56 applicable jobs: 8 installed targets, 32 Node cases, 13 fixed hosts and the source/aggregate gates. APPEARANCE-04 is functionally DONE and included in the verified v3.9.0 release.

Implementation builds on the accepted IMPORT-01. Schema 14 / protocol 23 add optional normalized RGB arrays; the shared forms cycle presets or edit custom stops. Post-fit foreground callbacks preserve instance boundaries inside semantic wraps, and background painting includes padding before boundary colors are selected. Both scopes use the same pure interpolation; warnings retain precedence and source observations are unchanged. Focused tests cover grapheme endpoints, links, clipping, groups and six-language forms. Source checks passed 1,227 tests with 5 explicitly skipped; the later warning-contrast test also passed. All 22 installed categories passed on package source `8fa8bc9`. Pinned Claude Code 2.1.296 passed both official Mod suites, installed integration and real-npm schema upgrade/refusal/restore/rollback on source `21da545`; the final feature matrix passed as recorded above.

PTY visual review also exposed ambiguous gradient labels. Both editors now show an explicit localized Off state and localized preset names in all six languages, while retaining canonical editable values. Focused external TUI and native Mod tests cover these presentation rules.

## COMPOSITION-03

[PR #145](https://github.com/fbincon/claude-code-statusline/pull/145) merged as `9e4a049a1f8198a190f1e8a20adf0092864c161b`, with head `cdbe9d1a2dc89e19ee5e6901cff968f84809c364`. [CI 40229051764](https://github.com/fbincon/claude-code-statusline/actions/runs/40229051764) ultimately passed all 56 applicable jobs: 8 installed targets, 32 Node cases, 13 fixed hosts and the source/aggregate gates. In attempt 1, macOS 26 Intel / Node 24.x could not resolve github.com during all three checkout attempts, before product execution. The unchanged-head retry and aggregate passed in attempt 2. Product behavior and test gates are unchanged. COMPOSITION-03 is functionally DONE.

Schema 15 / protocol 24 add optional stable unit references for corresponding columns in explicit main rows. The shared Layout manager, CLI transactions, import validation and both diagnostic paths use the same relationship rules. Two-phase rendering shares observations and the color cursor, preserves hidden slots and drops alignment whitespace when a related row exceeds the available width. Destructive structural edits identify the affected relationships before saving. Focused core/CLI/TUI tests passed thirteen cases; the local native Mod suite passed 136 tests on host 2.1.310 (additional local evidence, not the pinned-host matrix). Installed acceptance adds four required cases, and extended PTY captures include manager forms. Source `9f3a30a` passed 1,238 tests with 5 explicitly skipped and all 23 installed categories. Pinned host 2.1.296 passed official Mods, installed integration and schema upgrade/restore/rollback. Joint tests cover six languages, 40/80/120 cells, Unicode, links and color fallback, with preview/render equality. The final feature matrix passed as recorded above.

The integrated source `281e559` passed 1,241 tests with 5 explicitly skipped, generated-resource checks and documentation checks. This includes the localized gradient presentation fix and single-observation/scope-label alignment regressions. The replaced gradient CI run was canceled; only the final head’s complete matrix can authorize its merge. Intermediate main CI after #143 was canceled after verifying an identical tree to the fully passing PR; it is not release evidence. The final release PR/main/tag each retain their mandatory complete gates.

The first alignment matrix [40228240870](https://github.com/fbincon/claude-code-statusline/actions/runs/40228240870) rejected the new native integration test at the exact-host TypeScript gate: Client port data is `unknown`, and the test accessed it before using the existing `ClientProps` type. The fixture now uses that exported port type and retains the same runtime assertions. Exact Claude Code 2.1.294 declarations passed typechecking, and all 137 native tests passed locally. No product behavior or gate was relaxed; the corrected head subsequently passed the complete feature matrix as recorded above.

## Combined release preparation

The v3.9.0 candidate from source `de7f1a2` passed 1,239 local tests (5 explicit skips), all 23 installed categories and official Claude Code 2.1.296 Mod/integration acceptance. Both published v3.7.0 and v3.8.0 archives are pinned by SHA-256 and exercise real npm upgrade, schema 13 → 15 migration, rejection of an incompatible rollback, explicit backup restoration, rollback, process interruption and recovery. The later installed joint matrix requires six languages × 40/80/120 cells (18 cases), save/reopen equality and preview/render equality. This intermediate local candidate was not published; the final source and publication receipts are recorded above.

The integrated release source `aa090e0` passed 1,242 tests with 5 explicit platform skips, 56 generated-resource checks and 3,229 documentation links. The intermediate main run [40228151865](https://github.com/fbincon/claude-code-statusline/actions/runs/40228151865) after #144 was canceled after its tree `cd2d526565ca3a0e2516ca0804e8b3f1e59801d1` was verified identical to the fully passing feature head. This canceled run is not release evidence.

Two independent builds from candidate source `f5bb3da` were byte-identical. Installed PTY review passed 792 six-language dark/light reconstructions (132 per language), four monochrome/unsupported-terminal cases, cancellation preservation and terminal restoration, with zero model calls. Representative screens in all six languages were inspected, and actual installed joint rendering passed at 40/80/120 cells; raw ANSI preserved whole graphemes. Report SHA-256: `83458ad60112fa4546035583a202e0b43049dd7c77cfd978f41b54ae8b87127b`; package SHA-256: `5092e30c454d7a6e3b830ea0ed3398d078e672e96c33dd80efaf8264d03bf137`. This is pre-release review, not an OS screenshot or human/physical-machine evidence; the final-artifact evidence above supersedes these intermediate files for publication.

After #145, intermediate main run [40232707528](https://github.com/fbincon/claude-code-statusline/actions/runs/40232707528) was canceled after confirming tree `84ca377515098595000ec751576371ff8d2c4306` matches the fully passing feature head. The final v3.9.0 release PR, main and tag subsequently passed complete automated acceptance as recorded above.

The first release matrix [40232974157](https://github.com/fbincon/claude-code-statusline/actions/runs/40232974157) failed the Windows 2025 and Windows ARM / Node 22.0.0 crash-injection fixture after its ordinary v3.7.0 upgrade and rollback had succeeded. The added per-history nesting expanded the recovery package manifest path. [An isolated path probe](https://github.com/fbincon/claude-code-statusline/actions/runs/40234895182) reproduced the result on both Windows targets: Node 22.0.0 loaded the 241-character original and 239-character sibling paths, but misclassified the 262-character nested .js module despite a readable type=module manifest; .mjs and Node 22.23.4 controls loaded successfully, for ASCII and Unicode paths. Each history now uses its own canonical Unicode/shell-character temporary workspace at the established depth, with owned cleanup. The fixture additionally requires the persisted package_verified checkpoint before recovery. Both real npm histories passed 22 operations each locally, and the eight release-readiness tests passed. The [unchanged-artifact Windows diagnostic](https://github.com/fbincon/claude-code-statusline/actions/runs/40235365958) and corrected full matrix passed, followed by the final release PR/main/tag gates above. Node lower bounds, product deadlines and all upgrade/rollback/recovery assertions remain required.
