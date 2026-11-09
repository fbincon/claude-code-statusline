# Incremental language workflow implementation

**English** | [简体中文](i18n-02-delivery.zh-CN.md) · [Design](#original-design-baseline) · [Work package](../work-package-designs.md#i18n-02)

All three I18N-02 slices are delivered in v3.15.0 on 2026-10-30. GitHub/npm/Gitee publication, public verification and actual-machine validation are complete. The final source and evidence below retain their original identities.

## Starting point and compatibility preparation

Implementation starts at `745336e969937c56d12e6866cd05fa56debf429a`, product v3.14.0, on 2026-10-30 (Asia/Shanghai). Each of the six canonical packs contains 2,311 keys. The 92 generated resources pass the existing drift check; language inputs are unchanged from accepted v3.14.0 source `4146e2738ac390743c5d2d284ac91d7ac4dfc8f0`.

Compatibility [PR #187](https://github.com/fbincon/claude-code-statusline/pull/187) merged as `f4f5b944cd1e446ace650da26740517bca1fda3e`. Its final head `30d606e464b91ed5343c096f921324e84e01a89a` passed the local Linux scoped task and all three-platform [PR checks](https://github.com/fbincon/claude-code-statusline/actions/runs/40966696928); [main verification](https://github.com/fbincon/claude-code-statusline/actions/runs/40967505441) passed through the accepted-base verifier. Actual package comparison proved equivalent runtime payloads; no product matrix was selected. This preparation retained strict complete packs. The feature delivery activates metadata, effective-resource generation, authoring tools and frontend origin handling together.

The build-only analyzer lives in `tools/generation/i18n/`; versioned data lives in its `data/` directory. Inputs are registered as build responsibilities requiring generation, consuming frontend checks and actual package comparison. Raw dictionaries remain in the canonical resource directory. The analyzer reads declared byte maps without Git, network, clock or filesystem access; its accepted-base exporter preserves the analyzer alongside the independent evidence readers.

`release:prepare --candidate` separates product acceptance from publication readiness. Existing `--stable` and `--preview`, complete-source tag promotion, maintenance-source release binding, and npm publication require release-ready languages for activated sources. Original complete/maintenance envelopes retain their schema and identities, with an optional versioned `language` field. Missing new-format evidence cannot use the pre-v3.15 compatibility path. Historical `sourceHashes()` and `policyDigest()` retain their meanings.

Records bind the exact source commit and deterministic report to English, raw translations, acceptance/context/terminology/policy/history and generator inputs. Reports distinguish presence, current validity, acceptance, fallback and retired entries. Accepted provenance preserves the actual validation scope; structural checks do not establish native-speaker review. New unsafe templates fail even when English fallback would be available.

## Effective resources and authoring

The feature keeps all six raw packs unchanged. Each language initially receives 2,311 matching baseline records from the independently verified original PR run `40905911155` (attempt 2), acceptance artifact `12920128077`, ZIP SHA-256 `001ab7e32a3fa899d2abaf3e2f8879f606f307a615fccafa6fdc5ddb65f6ddc8`. Version-controlled snapshots bind every raw language; runtime generation needs no network or repository history. Three immediate-UI/display-save labels per language then receive explicit context/terminology annotations and current contextual validation through the real `validate`/`accept` commands. Each language has 2,308 baseline and three current validated records. No raw phrase was changed and no native-speaker review is inferred.

The analyzer produces one deterministic effective dictionary and origin map. Node UI resources remain aggregated; Native UI dictionaries and fallback lists remain split per language; statusline modules contain only effective `statusline.*` messages. Package staging replaces raw JSON with effective JSON. The runtime package contains neither lifecycle history nor acceptance records. English and Simplified Chinese must be complete during generation; unfinished B entries use current English. Public release requires all A/B entries accepted. Explicit future C registration requires maintenance scope and truthful disclosure; no additional selectable language ships.

Developer commands are `languages report`, `freeze`, `validate`, `accept` and `release-check`, exposed through `npm run languages -- ...`; `languages:coverage` aliases the JSON report. Freeze reads fixed commits and does not build, test, call the network or mutate sources. Validation records exact source/translation/generator inputs and actual contextual review. Only explicit acceptance publishes matching records and preserves previous contracts. Changing the input invalidates a pending validation file. `generate`, `generate:check` and `check` keep their existing integration roles.

Pure `messageOrigin` preserves English fallback evidence in both editors' prepared search without changing ranking or highlights. Accepted technical words identical to English retain their accepted language. UI language, output language and host Apply persistence remain independent. Display schema 17 and editor protocol 30 remain unchanged. No dictionaries, reports or history are added to Client props; existing props/Pane/Client budgets and save recovery remain enforced.

## Validation and delivery status

The focused compatibility tests cover source/translation/context/terminology changes, historical placeholders and deletions, duplicate/unsafe inputs, intentional English terms, future community disclosure, exact package resources and rejected evidence tampering. The independent-verifier regression also replaces HEAD's analyzer with a no-op and confirms that accepted-base code still rejects changed bytes.

Pre-publication source `96b4971c6b0c8ab33d4d57b6c02dd5647f27c41d` passes the full local check: 1,463 tests pass and six existing platform-only cases skip, with all 92 generated resources, 4,005 documentation links, frozen archive and responsibility ledgers verified. Both Mods pass official validation/tests and exact Claude 2.1.312 declarations; all 283 capacity cases pass in that actual host. The installed language-only diagnostic passes all 36 combinations and is explicitly non-promotable; it does not replace complete installation or Actions evidence. Two independent builds match at package SHA-256 `8d73f2b6852ffdb149283c2c6f033ae62ee208efdd844897f9498d8b0c92c5cf`.

The first build attempt failed with local `/tmp` write quota exhaustion. The unchanged-source retry uses a private task directory on the disk filesystem and preserves the failed log; no product rule or deadline was relaxed. A subsequent focused guard rejects partial activation metadata and unverifiable legacy version syntax; its three evidence tests pass. Final-source acceptance and publication identities are recorded separately rather than relabeling these earlier executions.

I18N-02 is complete, including v3.15.0 publication, Gitee synchronization and test-machine verification. Only the six previously accepted issue #96 gaps remain unverified; no new automated failure is waived. No paid model tests were run. New post-publication findings receive issues without a patch release.

<a id="final-release"></a>

## Final source and publication

Feature [PR #188](https://github.com/fbincon/claude-code-statusline/pull/188) accepts source `73096d7851feb855ba36ed5640034b77951cdb79`. Its normal merge is `3ffea73e2d13252f226e68922524a09e618aa843`, with preparation merge `f4f5b944` as the first parent and the accepted source as the second. Annotated tag object `5ef6a815c14602fd0b15364cec38cd88fd31bfcb` points to that accepted source, which is reachable from main.

| Gate | Original run and result |
| --- | --- |
| Final PR | [40971513208](https://github.com/fbincon/claude-code-statusline/actions/runs/40971513208), attempt 1 passed: eight installation targets, 32 Node cases, sixteen fixed hosts and `Complete candidate evidence` |
| Main integration | [40980771635](https://github.com/fbincon/claude-code-statusline/actions/runs/40980771635), attempt 1 passed: accepted-base verification and three-platform integration smoke |
| Annotated tag | [40981220044](https://github.com/fbincon/claude-code-statusline/actions/runs/40981220044), attempt 1 passed: original evidence promotion and strict language publication gate |
| npm OIDC | [Dry-run 40981921941](https://github.com/fbincon/claude-code-statusline/actions/runs/40981921941) and [fresh publication 40982136714](https://github.com/fbincon/claude-code-statusline/actions/runs/40982136714), both attempt 1 passed |
| Public verification | [40982689125](https://github.com/fbincon/claude-code-statusline/actions/runs/40982689125), attempt 1 passed: all six Linux/Windows/macOS × Node 22/24 download/install jobs and the signature job |

The original candidate artifact is `12939848889`, ZIP SHA-256 `e0643c997ab3c0cb05fa38a31fe79540bd06b91a5a8b9a43f0c0e0d3bc8deb0f`; complete acceptance is artifact `12943673752`, ZIP SHA-256 `5a8fba6c3687518a763c1a88a98d8e450d74d98a50535300e33f3510796d4e7b`. Source/attempt/job attribution, all 59 referenced artifacts and the PR/main/tag relationship were independently rechecked. The analyzer exported from accepted base `f4f5b944` reproduces final language report SHA-256 `d6eae34382272132d5378d1ed7bf78509e62438659ba656370b701ac7371617e`. Each language has 2,311 accepted current entries and zero missing/stale/pending/invalid entries or fallback.

Final-source local acceptance also passes 28 installed tests across 27 categories, including all 36 UI/output combinations, 42 Native/external PTY journeys and 24 six-language external captures. The 283 capacity cases retain all 271 earlier cases and add twelve language cases. Earlier `96b4971` checks remain attributed to that source. Automated terminals and agent-inspected reconstructions do not establish physical or human acceptance.

Two independent final-source builds and a rebuild from the delivered source archive match all four original CI files. Exactly these four files are published:

| File | SHA-256 |
| --- | --- |
| `fbincon-claude-code-statusline-3.15.0.tgz` | `9064fa583037b57c3b3d0c876fabe6dd15e63c4a9b8e52446e1a2ef9dcabe683` |
| `claude-code-statusline-3.15.0-source.tar.gz` | `000059c92b98ffc5be3372504e1e884f0f40997e5ba58d05a3aae0a449e53e4e` |
| `build-manifest.json` | `bdd9fc33b5e85858f30388230d9b99c2c22894d8af0a5b0550c6a1e9b9ced714` |
| `SHA256SUMS` | `bb9737158ff48b410fc1a604fb98bbccb33a90be220a0224dad81b05eb480960` |

[GitHub Release](https://github.com/fbincon/claude-code-statusline/releases/tag/v3.15.0) `428538015` is stable, Latest and immutable, published at `2026-10-30T00:55:17Z`. Its draft and public attachments were downloaded and compared with the original CI bytes. [npm](https://www.npmjs.com/package/@fbincon/claude-code-statusline) reports `latest=3.15.0`, retaining `beta=3.0.0-beta.1`; the publication receipt records a fresh `published` action. The signature report verifies the real public package, all six bundled public upstreams and provenance for the exact tag/source/workflow invocation. Native full-tree audit of bundled private workspaces remains unsupported; the dedicated verification scope is unchanged.

[Gitee Release](https://gitee.com/fbincon/claude-code-statusline/releases/tag/v3.15.0) `1255035` retains the same source and four attachment bytes. Main and the annotated tag were synchronized with explicit refspecs and verified. All four attachments were anonymously redownloaded and compared; Gitee's two automatically generated source links are separate from the four delivery files. A slow source download exceeded its initial transfer window and ranged resumption was unsupported; a fresh complete transfer passed the original digest check. Failed transfer diagnostics remain separate from acceptance. Bilingual Gitee notes use actual attachment URLs.

## Actual machine and remaining limits

The supported package command upgrades the test machine from 3.14.0 to 3.15.0 after a verified, conflict-free dry-run; transaction `pkg-af68f02c-903d-4156-8005-e22c2cf64e9e` retains recovery. All 1,062 installed files equal the public package before and after actual-session checks. The installed Native plugin and cache manifest report 3.15.0; the external editor is registered. The user's existing runtime-collection opt-out remains disabled. Doctor passes its on-disk checks and keeps its expected live-session warning; actual loading is verified separately below.

On Claude Code 2.1.312, six actual external/Native journeys at 200 × 50 pass: all six interface languages, English search evidence, immediate UI persistence, output-language cancel/save/reopen and restoration. Native runs in a Linux user/network namespace without outbound routes, explicitly selects fullscreen rendering for the child process, exits gracefully and records zero model request attempts. The harness first passed against an isolated candidate; input sequencing, save acknowledgement and host focus/renderer diagnostics are not product failures or promoted CI receipts.

All nine original display/UI/profile/source/host preference paths retain their bytes, modes and absence after restoration, with only the owned backend version advanced to 3.15.0. The actual configured statusline command then renders a controlled sample with the expected model, directory and remaining-context meaning; the preferences are checked again. No new product finding was observed after publication. The six [#96 gaps](https://github.com/fbincon/claude-code-statusline/issues/96) retain their unverified status under the [v3.15.0 decision](../../../releases/approvals/v3.15.0.json). SHOWCASE-01 and its original prerequisites remain unchanged.

<a id="original-design-baseline"></a>

## Original v3.14.0 design baseline

The original design was reviewed on **2026-10-30** (Asia/Shanghai) against `0d6bd307aa8ab29f3c49793efc0445189c82fb76`, product v3.14.0. At that source, each of the six packs had 2,311 keys. The [generator](../../../../tools/generation/resources.ts) required complete packs, rejected unknown keys and mismatched placeholders, and emitted Node and Native resources. Its coverage report measured key completeness; neither the report nor runtime English fallback tracked changed source meaning or translation acceptance. These gaps are addressed by the implementation below.

The translation guide maintains the implemented developer commands. Metadata and reports have internal versioned interfaces; display schema 17 and editor protocol 30 remain unchanged. Implement compatibility where data actually crosses an interface; adding policy does not by itself require a user-configuration migration. Preserve historical `sourceHashes()` and `policyDigest()` meanings and receipt identities; new inputs need explicit binding and compatible readers.

<a id="delivery-slices"></a>

## Delivery boundaries

The following preserves the original I18N-02 slices and six-language baseline. The later twelve-language expansion does not relabel those original results.

| Slice | Deliverable and completion condition |
| --- | --- |
| 1. Baseline and compatibility | Record the implementation's starting source, existing six-language evidence and its limits. Define build-only inputs, ownership, archive/package boundaries, report binding and compatible verification. Reuse valid prior results; establish current records only where needed. No active input remains unclassified. |
| 2. Minimum complete workflow | Deliver signatures, acceptance invalidation, all states and four source-change cases, historical isolation, common effective resources and basic reporting. Enable A development and A/B release gates with the PR/main/tag verification paths in the same delivery boundary. Establish the six-language baseline without claiming unperformed review. Safe B fallback cannot ship ahead of its release guard. |
| 3. Maintenance tools and expansion entry | Add incremental/freeze lists, batch validation/record updates and applicable terminology/context support. Define C disclosure and future-language entry criteria without selecting a new language. All reports remain reproducible from their declared inputs and translation maintenance follows actual impact. |

These are dependency and acceptance boundaries, not mandatory separate PRs or repeated full matrices. Necessary compatibility work must precede activation; compatible preparation and functional work can share a delivery where the existing verifier can independently validate it. Implementation records exact interfaces and migration decisions at that point, without adding a separate design approval step.

Future languages use complete structural/template/safety/generation checks plus their UI, output, search and relevant layout cases. Add representative cross-language independence cases when affected. Number/quantity expression, short labels, complex plurals and RTL/bidirectional text need explicit behavior and host coverage when a selected language requires them; filled strings alone do not establish layout support. No new format framework or selectable test language is required by this package.

<a id="acceptance"></a>

## Functional acceptance and evidence limits

The following preserves I18N-02 implementation requirements and its original six-language acceptance scope; actual results remain in the [delivery record](i18n-02-delivery.md). Current changes follow the registered-language policy above and the [translation guide](../../i18n.md), using existing suites and isolated fixtures.

| Area | Required scenarios |
| --- | --- |
| Source lifecycle | Add key, change English meaning, change context with unchanged English, change placeholders, delete key; verify state, current fallback and affected acceptance invalidation |
| Translation lifecycle | Translation edit invalidates its hash; missing/pending entries fail the appropriate gate; legitimate identical-to-English terms can be accepted; retired keys leave the denominator |
| Invalid and historical input | Reject duplicates, invalid types, unsafe text, new template errors and unexplained keys; accept only verifiable historical isolation without depending on Git history/network |
| Generation and packaging | Same inputs yield identical effective Node/Native messages and dev/release bytes; generated copies match; build-only inputs stay out of the runtime package but inside reproducible source/report identity |
| Cross-frontend behavior | Consistent CLI/TUI/Native output and fallback; truthful search origin/highlighting; six-language UI/output independence, switch/failure/save/cancel/reopen, import/export and upgrade preservation |
| Native presentation | Long/mixed/wide text, narrow/tall/resize views, separate props/Pane/Client budgets, actual mounting, retained drafts and saved/pending/unknown recovery outcomes |
| Release readiness | B missing/stale/pending entries may pass development rules but fail publication; A omissions and invalid content fail; C limitations are disclosed; complete-source and maintenance-source routes both enforce the gate |
| Evidence reuse | Reject wrong source/policy/generator/acceptance inputs, expired/corrupt reports, failed latest runs, wrong merge relations and incompatible readers; preserve original identities through valid reuse |

Retain existing logical obligations when sharing identical executions. Record automated checks, actual-host results, PTY reconstruction, agent inspection and physical acceptance distinctly. The six accepted [issue #96 gaps](https://github.com/fbincon/claude-code-statusline/issues/96) remain unverified and do not waive new failures. Paid checks retain their existing explicit scope and budget requirements.

Documentation completion means paired files, accurate current/future boundaries, consistent work-package navigation and necessary documentation checks. I18N-02 completion is established by the linked implementation, protected gates, publication and actual-machine evidence, rather than documentation checks alone. Follow the [work-package handoff rules](../../development-plan.md#handoff) for subsequent maintenance and publication records.
