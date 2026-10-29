# Adaptive indicators and continuous row scenarios

**English** | [简体中文](adaptive-row-scenarios.zh-CN.md)

The v3.14.0 implementation covers APPEARANCE-07, APPEARANCE-06 and PROFILE-02, plus issues [#178](https://github.com/fbincon/claude-code-statusline/issues/178) and [#180](https://github.com/fbincon/claude-code-statusline/issues/180). Work started from `7dc3beec326f87864dc2401a18dffe45b7f93da3`. The final PR/main/tag gates, public channels and actual-machine validation have passed; the final evidence below retains their original source identities.

## Shared representation and final paint

Display schema 17 adds `presentation=adaptive` and optional `powerline.row_background_gradient`; editor protocol 30 carries the corresponding descriptors. Portable/profile envelopes remain version 1. Old files normalize in memory without writes; neither feature is enabled by reading old data. Earlier schemas reject the new options. Explicit writes retain revision checks, locks, backups and atomic publication.

Adaptive indicators retain structured percentages and used/remaining phrases. Fixed rows shorten eligible built-in labels, reduce bars to four cells, then use numeric presentation before existing priority omission. Lower-priority indicators degrade first within each stage. Custom labels and icons remain whole. A numeric representation that cannot fit is omitted. `max_width`, groups and both scopes use this rule. Automatic layout retains ordinary wrapping and adapts only units wider than a complete row. Diagnosis and sample explanations record the same adaptation transitions for an item's own width bound; complete omission is reported as `width_omitted` rather than empty data.

The row gradient is opt-in and only active in colored Powerline output. Existing `color_mode=continuous` retains palette-sequence meaning. Final bodies are painted after visibility, fitting, grouping and wrapping. Shared-background groups form one block. Explicit component/primary backgrounds and independent background gradients override the row gradient and break its run. Spacers break runs; alignment padding remains uncolored and consumes no gradient cells. Aligned units retain body metadata until the complete row is painted. Separators and caps use actual edge colors. Warning foregrounds retain priority and contrast protection; links and complete graphemes survive.

## Display scenarios

Five new stable identities extend the original nine choices to fourteen:

| ID | Display intent |
| --- | --- |
| `powerline-daily` | Ocean daily work, continuous background and adaptive context |
| `agent-workbench` | Slate task/activity groups and agent rows |
| `quota-cost` | Ember quota/reset alignment, grouped context/spend and cost rate |
| `narrow-terminal` | Compact ASCII presentation, ordinary wrapping and four-cell adaptive bars |
| `light-readable` | Light theme, pale continuous background and protected risk colors |

Core definitions drive setup, both editors, CLI and [portable examples](../../examples/schemes/). Selection previews a candidate; acceptance is one draft-history transition. Current display language and subagent enablement are retained. No scenario installs tools, imports credentials, binds local sources or enables collection. Missing observations remain missing. Existing three complete schemes retain their identities and rendering choices.

[Installed-renderer samples](../images/adaptive-row-scenarios/README.md) show all five scenes. The narrow scene uses compact ASCII identifiers without additional labels, keeping the actual directory value visible at 40 columns; the four-cell adaptive bar still retains its complete percentage and remaining meaning.

## Native presentation and localization

Complete editor state remains in the host. Props, the outer Pane and Client drawing retain independent 48,000-character / 10,000-value / depth-16 preflights, with bounded visible pages, selected content, Unicode and colored previews. The capacity inventory retains the original 243 cases and adds 28 scenario/color/indicator cases, totaling 271 actual-host cases. New six-language tests inspect actual style/group/history entry captions rather than merely checking resource presence. Saved, pending and unknown save recovery remains separate from drawing failures.

## Supported signature verification

Use the pinned development toolchain and an exact downloaded package:

```bash
npm run release:signatures -- --version 3.14.0 --commit FULL_SOURCE_SHA --artifact /path/to/fbincon-claude-code-statusline-3.14.0.tgz --output /path/to/new-signatures.json
```

The tool reuses npm 11.19.0's TUF, registry signature and Sigstore verification, checks package SHA-512 and every file, then binds provenance to the exact repository, source commit, tag and publisher workflow. All six bundled public dependencies are separately signature/integrity verified, and their shipped files are compared with their signed upstream archives. The four private workspace packages are covered by the signed outer archive and complete inventory; they are never queried as unpublished registry releases. Missing dependency provenance is reported as absent, while the outer package requires source provenance.

This is a dedicated, explicitly scoped verification flow. Native `npm audit signatures` still traverses private bundled workspace dependencies and may return E404. It is not reported as passed. Published releases gain a fixed-toolchain signature job beside the six existing public-download jobs.

## Acceptance and delivery

Focused validation covers six languages, 40/80/120 columns, semantic fallbacks, group/spacer/alignment boundaries, warnings, ANSI/no-color, persistence and transfer. Candidate acceptance retains eight installed targets, 32 Node cases, sixteen fixed hosts, 271 capacity cases and installed editor/PTY journeys. The [release procedure](../RELEASING.md) promotes immutable original artifacts through final PR/main/tag evidence; failed or missing gates block publication. Only the six existing [#96 gaps](https://github.com/fbincon/claude-code-statusline/issues/96) remain accepted and unverified.

A real v3.13.0 baseline verification passed for the outer package (two signatures and two attestation bundles) and all six public dependencies, including upstream file comparisons. Candidate validation, source identities and channel receipts are recorded with the matching CI run and [v3.14.0 release](https://github.com/fbincon/claude-code-statusline/releases/tag/v3.14.0). No paid model tests are required. Automated host tests, PTYs and agent-inspected captures do not establish new physical/human acceptance. After publication, new local findings are filed as issues while retaining the published version.

## Local candidate evidence

The local candidate at `492d3d50c8d0d72b6230aff956425958b86f5417` builds twice with identical bytes, SHA-256 `8fd4b89d82446ab2185fbf12181d324aedc6a68f28c4c3261b2a63b6cdd0abff`. Source checks pass 1,440 tests with six platform-only skips, 92 generated resources, the frozen archive and complete migration inventories. Installed acceptance passes all 27 tests and 26 required categories, including the five new schemes in six languages at 40/80/120 columns, semantic fitting, transfer and save/reopen. Claude Code 2.1.312 passes all 42 installed Native/external PTY journeys with zero model calls.

Earlier diagnostics remain separate: a `/tmp` quota error interrupted fixture extraction; placing the replacement temporary root inside the checkout was correctly refused by installation isolation. The successful run uses a private disk-backed root outside the checkout. A stale generated capacity payload blocked an intermediate immutable build and was regenerated. The capture checker now permits a colored preview cell only when its text and background match separately produced production cells; arbitrary preview/chrome backgrounds still fail. These failed attempts are not release evidence.

Screenshot review also removed duplicate built-in quota/reset labels and made the actual narrow-terminal directory value visible. [The five retained samples](../images/adaptive-row-scenarios/README.md) identify their original candidate, renderer, fonts and hashes; they are not relabeled as final public artifacts. Final PR/main/tag acceptance and public-byte verification remain independent requirements.

The full installed sample capture completes 732 reconstructions. A later fixed-host repetition exposed a missing `source_draft` response in the shared test fixture, which incorrectly treated the binding-pin request as a preview. The fixture now returns the actual operation's result shape, and the unknown-save test explicitly requires the current binding to remain pinned; all three source integration cases pass on Claude 2.1.310. The failed repetition remains separate from acceptance.

The [first PR execution's Windows ARM / Node 22.0.0 job](https://github.com/fbincon/claude-code-statusline/actions/runs/40864428819/job/123417364443) passes the earlier 26 installed tests, then reaches the 120-second deadline for the new combined appearance case. That case performed 450 previews and thirty save/reopen checks in one subprocess. Acceptance now executes each complete scene separately, retaining its six languages, five samples, three widths, persistence/transfer assertions and the original 120-second subprocess limit. The aggregate still requires all five exact receipts, and records each execution's duration/status. No product command deadline is enlarged. Local focused execution passes all five chunks (about 51.5 seconds total; longest about 16.5 seconds); this diagnostic is explicitly nonpromotable. The final head must pass complete CI.

An extended image collection terminated with SIGTERM during the last language and produced no passing receipt. Its partial captures remain diagnostic; the complete stock collector is rerun independently. The successful 42-journey PTY and 732-sample executions above keep their original identities.

Prepublication macOS Intel acceptance exposed a package-review completion race. A diagnostic on the original `75128bf` candidate observed a completed private result at `15:10:19.506Z`, followed by a false derived interruption at `15:10:19.607Z`: the status request still held an earlier running snapshot when it observed worker exit. Status now rereads the bounded private record before declaring interruption, revalidating ownership, configuration revision and liveness. Atomic-publication regressions cover complete, failed, cancelled and unknown-live results, plus changed owners/configuration and revision conflicts. Existing startup, overall and test deadlines remain unchanged. This diagnostic is separate from final-source acceptance.

The initial regression fixture attempted publication with its read handle still open, which Windows/Node 22.0 correctly rejected with EPERM. The portable fixture publishes after the old snapshot has been read and its handle closed, before liveness is checked. It retains the same old-product failure, fixed-product assertions and deadlines; no product behavior is changed by this fixture correction.

## Final source and release identity

Completed on **2026-10-30** (Asia/Shanghai). [PR #184](https://github.com/fbincon/claude-code-statusline/pull/184) delivers source `4146e2738ac390743c5d2d284ac91d7ac4dfc8f0`. The normal two-parent main merge is `dc76c3c426956d1a3238e5e0d3397f6c65acb93d`, with an identical tree. Annotated tag `v3.14.0`, object `b52fb1672056a33f553787e7e911df639dac755f`, points to the original product source. The package, tag and npm provenance retain that source identity through later documentation maintenance.

| Gate | Result and original evidence |
| --- | --- |
| Final PR | [Attempt 2 passed](https://github.com/fbincon/claude-code-statusline/actions/runs/40905911155/attempts/2): 60 successful jobs and eleven intentional routing skips; eight installations, 32 Node cases, sixteen fixed hosts and 271 capacity cases |
| Main integration | [Attempt 2 passed](https://github.com/fbincon/claude-code-statusline/actions/runs/40927143667/attempts/2); retains the original three-platform integration smokes and independent accepted-base verifier |
| Annotated tag | [Passed](https://github.com/fbincon/claude-code-statusline/actions/runs/40928310893); promotes the same source and original candidate files |
| npm OIDC | [Publication and subsequent verification](https://github.com/fbincon/claude-code-statusline/actions/runs/40930105973): fresh publication in attempt 1; existing-version verification in attempt 2 |
| Public release | [Seven jobs passed](https://github.com/fbincon/claude-code-statusline/actions/runs/40931917519): six OS/Node download/install jobs and fixed-toolchain signature verification |

Original candidate artifact `12912685067` has ZIP SHA-256 `a822d710b3a581b93f08b8c4afe9d7bf46bcffa72d14bdfb5a3a914ef217dc9d`. Its four files equal two independent builds and the delivered-source rebuild. Release verification covers all 1,062 files and four product targets. Final acceptance artifact `12920128077` has ZIP SHA-256 `001ab7e32a3fa899d2abaf3e2f8879f606f307a615fccafa6fdc5ddb65f6ddc8`; main/tag promotion artifacts are `12921691677` / `12922090837`.

| File | SHA-256 |
| --- | --- |
| `fbincon-claude-code-statusline-3.14.0.tgz` | `67ea588312c9f4dbb1927f2eb56de312f67a4d9981e78bc059fbcc785ae5c552` |
| `claude-code-statusline-3.14.0-source.tar.gz` | `644ffe7e387a941ccc8ee3108dc038ba212a431fde32586e07a7f41cfe26b1f6` |
| `build-manifest.json` | `a3bf7671baa7bd7af1151f66b545efec252feea21754ce0cc2fdc4d1f628b54d` |
| `SHA256SUMS` | `1252604ec30d65648ee7598407ed6275d0d9004e376dd9560c33cd8b3858e112` |

### Checks, retries and evidence boundaries

Final-source `npm run check` passes 1,443 tests with six platform-only skips, 92 generated resources, 3,881 documentation links, frozen archive verification and complete migration inventories. The exact final tgz passes 27 installed tests / 26 required categories and all 42 installed Native/external PTYs on Claude Code 2.1.312, with zero model calls. Each of the five complete scene receipts retains six languages, five samples, three widths and persistence/transfer assertions within its original 120-second limit.

Earlier captures keep their actual sources: `492d3d5` owns 732 sample reconstructions and the five documented images; `ce1e159` owns pinned 2.1.310 Mod/type/capacity/install/version checks and 1,080 dark/light captures plus four monochrome checks. Sources `75128bf` and `ee39ca5` each independently complete 1,080 captures and four monochrome checks, restore terminal state and make zero model calls. All 1,061 product files at `ee39ca5` equal the final candidate; only the source-identity manifest changes. These captures are not relabeled as final-source executions.

Prepublication failures and their repairs remain in the local evidence above. The original combined scene process exceeded 120 seconds; separate complete scenes retain every assertion and the same per-process bound. The macOS diagnostic proved a completed package review could precede a false interruption from an earlier running snapshot; the product fix rereads bounded state and preserves ownership, revision, unknown-liveness and deadline checks. The portable Windows regression closes its old snapshot before publishing; it still fails on the old product and passes on the fixed product.

Final PR attempt 1 records 55 successful jobs, four failed acceptance jobs and the blocked aggregate. All four pass formal retries on the same source with unchanged assertions and deadlines:

| Execution | Original failure | Formal retry |
| --- | --- | --- |
| Windows 2025 / Claude 2.1.310 | Capacity child failed after 175 Native tests and types passed | Full Mod/type/install/version flows and all 271 capacity cases pass; artifact `12918912507` |
| macOS 15 / Claude 2.1.294 | Unknown-save test exceeded 5,000 ms | Same case passes in 1,669.58 ms; full host checks pass; artifact `12916953686` |
| Windows ARM installation | Koffi module locked during independent-manager cleanup | All 27 installed tests and the complete platform suite pass; artifact `12921240856` |
| Windows ARM / Node 22.x | Historical 3.8.0 baseline phase exceeded 900,000 ms | Baseline 431,933.92 ms and editor execution 532,396.44 ms, each below the unchanged limit; artifact `12919224115` |

The [standalone diagnostic](https://github.com/fbincon/claude-code-statusline/actions/runs/40908901263) and [full-context diagnostic](https://github.com/fbincon/claude-code-statusline/actions/runs/40910688447) also pass the unchanged 271-case capacity child in 280,916 / 283,763 ms under its original 300,000-ms bound. They remain nonpromotable diagnostics. Formal retry aggregate `123633695079` supplies acceptance. Main attempt 1 retains three passing integration smokes but fails on a GitHub `UND_ERR_SOCKET` response before content assertions; the same-source failed-job retry passes. No failed or missing gate is waived.

### Publication, signatures and public bytes

The [OIDC dry run](https://github.com/fbincon/claude-code-statusline/actions/runs/40929421880/attempts/2) passes after a GitHub HTTP 502 interrupted its first attempt before package preparation. It establishes preparation only. Live publication was accepted at `2026-10-29T18:23:48Z`; verified provenance identifies [attempt 1](https://github.com/fbincon/claude-code-statusline/actions/runs/40930105973/attempts/1), source `4146e2738ac390743c5d2d284ac91d7ac4dfc8f0` and transparency log entry `3573461773`.

The registry initially returned 404 for the newly accepted tarball, causing post-publication verification to fail. No duplicate publication was attempted. Anonymous reads confirmed the exact tarball became available at `18:31:05Z`; SHA-256 and SHA-512 match the original CI package. The successful failed-job retry logs `already-published` and `oidc_verified:false`: it verifies existing bytes and does not establish a second OIDC publication. The first attempt ended before writing an `npm-publication` receipt; its accepted-publish log and verified public provenance retain the actual publication identity.

The [immutable GitHub stable/Latest release](https://github.com/fbincon/claude-code-statusline/releases/tag/v3.14.0) was published at `18:33:21Z`. Anonymous downloads verify all four original attachments. Local public-download checks also pass empty-cache exact-version and `latest` installations. npm `latest` is `3.14.0`; `beta` remains `3.0.0-beta.1`.

Both local public-byte verification and the public signature job pass with npm 11.19.0: two outer registry signatures, two attestation bundles, exact source/tag/workflow, full inventory and six exact public upstreams with signed-archive file comparisons. Dependency provenance is explicitly absent where upstream provides none. Public signature artifact `12922498508` has ZIP SHA-256 `97305f22b8af7bf6067e497f481b11481f862d8db0db31fdbacb7b100a6b0ccd`. The real 3.13.0 baseline also passes; controlled failures reject corrupted signatures (`EINTEGRITYSIGNATURE`), failed Sigstore verification (`EATTESTATIONVERIFY`), source/digest mismatches and inventory omission. Native full-tree `npm audit signatures` still cannot traverse the private bundled workspaces; no full-tree pass is claimed.

The [Gitee stable release](https://gitee.com/fbincon/claude-code-statusline/releases/tag/v3.14.0), ID `1254758`, retains the same tag/source and four explicitly uploaded files. Every anonymous attachment download matches the table above; Gitee's two automatic source archives are separate from those four delivery assets. The original validated main and annotated tag were synchronized with explicit non-force refspecs and verified remotely. Subsequent documentation maintenance synchronizes only validated main; published tag objects and asset bytes stay unchanged.

### Actual machine and closure

The real installation upgrades from 3.13.0 to 3.14.0 after a verified, conflict-free dry run. All 1,062 installed files match the verified public package exactly. Both actual external (English, 120 × 32) and Native (Simplified Chinese, 200 × 50) editor journeys pass on Claude Code 2.1.312: five scene previews/cancellation/acceptance, row-gradient edits/cancellation, draft export, undo/redo and localized style/group/history managers. The Native journey uses a Linux user/network namespace without outbound routes, verifies `ENETUNREACH` and records zero model request attempts. All nine original display/UI/profile/source/host preference paths retain their bytes, modes and absence after restoration, with only the project-owned backend version advanced to `3.14.0`. The actual configured statusline command then passes sample rendering with the expected model ID, directory and remaining-context meaning; preferences are checked again. No new product finding was observed in this post-publication validation.

[Issue #178](https://github.com/fbincon/claude-code-statusline/issues/178) and [issue #180](https://github.com/fbincon/claude-code-statusline/issues/180) are closed as completed with linked public-signature and actual-machine evidence. Issue #179 is outside this delivery and retains its pre-existing `closed / not_planned` state. Only the six existing [#96 gaps](https://github.com/fbincon/claude-code-statusline/issues/96) remain accepted and unverified. Automated terminals and agent-inspected reconstructions do not establish physical or new human acceptance. SHOWCASE-01 remains NOT_STARTED. New post-publication local findings receive issues while retaining v3.14.0; no patch release is issued in this task.
