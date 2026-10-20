# Display schemes, project selection and task inspection

**English** | [简体中文](profiles-projects-tasks.zh-CN.md)

Implementation baseline: `58cafcc1f85aadd566a1c926549880814d3722a2`, after v3.3.0 delivery. User contracts are documented in [profiles](../PROFILES.md) and [task details](../TASK_DETAILS.md).

## Architecture and contracts

Core defines complete display schemes, stable identities, target descriptors, the shared editor manager and the pure task-detail projection. Platform resolves native directory identities and supplies bounded read-only files. CLI coordinates existing configuration transactions and read models. The external TUI and native Client adapt the same scheme manager. Native task inspection has a separate pane and remains part of the existing native Mod.

Editor protocol 15 adds `profiles_read`, `profiles_apply`, `profile_import`, `profile_export` and `task_details`. `read` and `apply` accept an optional explicit target; their scoped results include target identity, matching root, fallback reason and shared bindings. Legacy unscoped operations retain their existing default-configuration behavior. The generated native request/parser is exercised against every operation.

The version-1 collection holds schemes and project bindings in one user file. Display schema 8, runtime protocol 2, lifecycle 4, portable 1 and UI preferences 1 are unchanged. A scheme stores only a DisplayDraft. The existing default file remains an independent snapshot and downgrade path. New files join the existing recovery allowlist and export protection.

Scoped revisions cover collection state, the selected configuration, installation identity and target. Save-as plus binding is one transaction. Readers never create the collection. Render selection stays outside management initialization and uses no Git or network lookup. A disabled custom-agent display emits no overrides, preserving the host's default rows even when another project needs the shared callback.

## Read-only task evidence

Inspection reads known session task/live files through the bounded diagnostic-file capability, then uses the existing lifecycle decoder, snapshot metrics and timer rules. It does not call collectors, reconcile bindings or persist a new lifecycle representation.

Explicit session identity is required. Current pointers, unique prompt aliases and already-published ownership determine selection. Missing/ambiguous association, future snapshots, incomplete waits and unknown timing stay distinguishable. Parent relationships come from attributed metadata; absent or cyclic relationships do not manufacture a complete tree. Each contributing source retains its own observation time.

Native on-demand agent names are supplied separately and joined only to attributable IDs. They are not persisted. Cross-file snapshots are not atomic and the bounded existing stores are not a full history. Interface support must be established per terminal host.

<a id="validation-record"></a>

## Validation and delivery record

Published as [v3.4.0](https://github.com/fbincon/claude-code-statusline/releases/tag/v3.4.0) on 2026-10-21 (Asia/Shanghai). [Implementation PR #117](https://github.com/fbincon/claude-code-statusline/pull/117) and [task-evidence correction #118](https://github.com/fbincon/claude-code-statusline/pull/118) deliver source `ea2dbde01808dbc85472e70d3d7cb994aa2b2d7e`; annotated tag object is `aa2434de27aee31d81e03e6292b8df80403dc7e0`.

Local `npm run check` at the final correction completed 1,076 tests: 1,072 passed, four platform skips and zero failures. All 41 generated resources, 2,567 documentation links, archive integrity and migration ledgers passed. Node 24.21.0/npm 11.19.0 produced the public package.

| Final gate | Evidence | Result |
| --- | --- | --- |
| Corrective PR head `605ae945aae329f64965d3683a8ca22954455972` | [CI](https://github.com/fbincon/claude-code-statusline/actions/runs/39460986472) | Passed on attempt 3 |
| Merged main `ea2dbde01808dbc85472e70d3d7cb994aa2b2d7e` | [CI](https://github.com/fbincon/claude-code-statusline/actions/runs/39468216307) | Passed on attempt 2 |
| Annotated v3.4.0 tag | [CI](https://github.com/fbincon/claude-code-statusline/actions/runs/39475852091) | Passed on attempt 1 |
| npm OIDC dry-run / publication | [Dry-run](https://github.com/fbincon/claude-code-statusline/actions/runs/39479689073) · [Publication](https://github.com/fbincon/claude-code-statusline/actions/runs/39480001991) | Passed after registry processing recovery; existing bytes verified |
| Public GitHub/npm download acceptance | [CI](https://github.com/fbincon/claude-code-statusline/actions/runs/39481989578) | Six jobs passed; twelve installations with initially empty caches |

Each final full CI run requires eight installation targets, 32 Node 22/24 runtime cases, thirteen fixed Claude hosts and the aggregate acceptance gate. A documentation-only job is deliberately inapplicable in those code/tag runs. Stable readiness binds every receipt to the exact source and package, with the version-specific six-gap decision.

Two independent builds, two builds from the delivered source archive, and the main/tag CI bundles produced identical package/source/manifest/checksum files. An earlier local pack attempt hit a registry TLS connection reset; its files and log were retained, and the completed retry used the existing proxy with certificate verification unchanged. The four GitHub draft attachments were downloaded and verified before publication. Local, draft-download and Gitee-download installations each passed all ten checks, including the installed profile/project/task scenarios.

Final installed acceptance on Linux Claude Code 2.1.294 passed strict validation, exact-host declarations, 124 native tests and 14 runtime tests. The actual terminal smoke opened scheme management, returned to the editor, saved/finished, then opened the read-only task pane with zero model calls. The terminal capture parser includes horizontal absolute cursor movement, so incremental native redraws remain visible in reconstructed evidence.

The final package produced **444** six-language extended PTY captures, including 48 scheme-management captures. Reports verify terminal restoration and unchanged settings/display/profile bytes. Selected final scheme-switch and task-pane images were inspected. These automated captures and agent image inspections are distinct from human desktop or physical power acceptance. The capture report SHA-256 is `d5460d0641d07e0bfe0294c45744c6d1901cbea0f1303816cc861860e191692e`.

| Delivery file | SHA-256 |
| --- | --- |
| `fbincon-claude-code-statusline-3.4.0.tgz` | `373e73191e75d5e18dfe5f9372b25ee69c85fb3af713650f7fb7c5e84ddf53c7` |
| `claude-code-statusline-3.4.0-source.tar.gz` | `096ec316d0847bdec61550613da92afeb42b7121b532def364d7f45170c77977` |
| `build-manifest.json` | `679618805e8710a835c4d50e95140d9ede8d761d367d3e4d00abc1e46505a5f1` |
| `SHA256SUMS` | `e1eb8d2d8c61cecc1b6f64266de319914c6655ec2a507af0d91ddd99cbc7d240` |

[npm](https://www.npmjs.com/package/@fbincon/claude-code-statusline/v/3.4.0), [GitHub](https://github.com/fbincon/claude-code-statusline/releases/tag/v3.4.0) and [Gitee](https://gitee.com/fbincon/claude-code-statusline/releases/tag/v3.4.0) deliver the same package bytes. GitHub Release `418602053` became public at `2026-10-20T19:16:04Z`; Gitee Release is `1224016`. npm `latest` points to 3.4.0 and `beta` remains 3.0.0-beta.1. Gitee's four attachments were anonymously downloaded with normal TLS verification, compared byte for byte, and installed outside the checkout.

### Corrections and recovery

Before public publication, inspection of the first merged candidate (`3bfad2ba6c30bbdd3f5a210f9617c1167ab973a1`) found that another task's heartbeat could refresh an old unfinished task and advance its elapsed time. The Release remained a draft, tag CI [39454778493](https://github.com/fbincon/claude-code-statusline/actions/runs/39454778493) was cancelled, and #118 added source-scoped freshness, future-observation checks and terminal-event precedence. The unpublished tag and private draft were replaced after fresh final gates; old candidate receipts were retained as superseded evidence.

The first corrective PR attempt completed every matrix job except Node 24.0.0 on macOS 26 ARM64, which waited for a runner for more than 25 minutes. That attempt was cancelled and only unfinished work was rescheduled, retaining successful checks. On attempt 2, GitHub reported hosted macOS ARM64 capacity constraints and cancelled the job before execution; the aggregate correctly rejected the missing evidence. Attempt 3 acquired a runner and passed the missing case and aggregate at the same source and package, with no weakened checks.

The first final-main attempt stalled in the macOS 26 Intel installation job after the isolated installation had passed. The full-check step had run for more than 30 minutes; repeated live-page reads ended at the README formatting test with no final summary. Normal cancellation did not complete; a force-cancel request closed the run. GitHub supplied no completed log archive, so the visible live-page summary and job metadata were retained. No partial target artifact existed before retry. Attempt 2 passed the full installation job and aggregate with the same source, package and acceptance rules.

npm accepted the OIDC upload at `2026-10-20T19:03:19Z` and signed [provenance](https://search.sigstore.dev/?logIndex=3342264198). Registry processing completed at `2026-10-20T19:07:29.384Z`, after the publisher’s bounded visibility window, so its first job failed the post-upload visibility check and produced no publication JSON artifact. An independent anonymous download then matched the package’s SHA-256/SHA-512 and confirmed `latest=3.4.0` with unchanged `beta`. The successful workflow retry recognized the existing identical version (`already-published`) and performed no second upload; it does not claim a new OIDC authentication. The original upload log and `npm-registry-verification.json` preserve the distinct upload and verification evidence.

An earlier #117 Windows run passed its CLI help assertion before the file-level Node process failed without an exit cause in the log. Subsequent final Windows runs passed without reducing checks; the original log remains retained and its cause is not asserted.

The first Gitee upload transferred the package, then hit a TLS transport error on the source archive. Remote inspection confirmed only the package attachment existed. A fresh authenticated client uploaded the three missing files without replacing the existing package. Native-interface routing used freshly resolved public addresses and normal certificate verification. All four anonymous downloads matched, and the downloaded package passed all ten isolated installation checks.

Raw reports, superseded candidates and receipts remain in ignored `dist/validation/v3.4.0/`. Post-publication documentation uses the necessary links/formatting checks rather than rerunning the platform matrix. Local roadmap archives retain their original bytes.

## Known gaps

The [v3.4.0-specific maintainer decision](../releases/approvals/v3.4.0.json) accepts exactly the six existing observations in [#96](https://github.com/fbincon/claude-code-statusline/issues/96). Those observations remain unverified; new functionality, failed checks or missing automated receipts are not waived. CI, reconstructed PTYs, agent visual inspection, human desktop use and physical power evidence remain separate.
