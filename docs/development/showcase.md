# SHOWCASE-01 implementation and evidence

**English** | [简体中文](showcase.zh-CN.md)

The [roadmap](roadmap.md#milestones) owns work-package status; the [development plan](development-plan.md#showcase-01) owns scope and acceptance. This record separates demonstration acceptance from documentation maintenance. The [user walkthrough](../SHOWCASE.md) and [gallery](../images/showcase/README.md) are the public entry points.

Work began from main `91133d20e8d961934465a440a11c0ca073b60ba2` after the maintainer approved the implementation plan. This is maintenance around an existing release: no product version, tag, Release or npm publication is created. Public commands, formats and defaults are unchanged.

<a id="baseline"></a>

## Fixed product and collection identities

| Identity | Value |
| --- | --- |
| Product | `@fbincon/claude-code-statusline` 3.16.0 |
| Product source | `c89a2ca088099ccd3ceb76baf59ecf11d84b08f0` |
| Public package SHA256 | `2030ef2f8d386b2fcb1f616fb49ce6f16eed92ec21ea22486799da68151b8c8a` |
| Existing publication evidence | [v3.16.0 delivery](language-expansion.md#final-release) |
| Formats | Display schema 17; editor protocol 31; single-profile format 1 |
| Initial machine | Linux / Node 24.21.0 / npm 11.19.0 / Claude Code 2.1.314; actual capture metadata records the complete environment |

The product archive and installed inventory must match before capture. New collection tooling has its own commit/file hashes, recorded separately from the product source and package hash. Existing capture suites retain their strict `sourceHashes()` match and run from an exact-source checkout when used. A new showcase receipt is not an original complete-product acceptance receipt, and later documentation commits do not relabel earlier captures.

<a id="prerequisites"></a>

## Eighteen prerequisite packages and all slices

The records below establish accepted prerequisite work. They retain their original PR/main/tag, artifact, failure and retry identities. Their historical language/matrix counts describe those releases, not a new execution for SHOWCASE-01.

| Package | Accepted slice coverage | Original acceptance |
| --- | --- | --- |
| FIX-01 | Mutation inventory → shared unknown-save guard → reconciliation/continued editing | [v3.9.2 correctness](correctness-maintenance.md#final-stable-delivery), PR #166 |
| FIX-02 | Numeric/bar semantics → shared label composition → main/subagent regressions | [v3.9.2 correctness](correctness-maintenance.md#final-stable-delivery), PR #166 |
| FIX-03 | Consumer ownership → service/editor/CLI lifecycle → overlap and expiry | [v3.9.2 correctness](correctness-maintenance.md#final-stable-delivery), PR #166 |
| FIX-04 | Time/evidence identity → applicable source filtering → render/diagnosis parity | [v3.9.2 correctness](correctness-maintenance.md#final-stable-delivery), PR #166 |
| I18N-01 | Preference/task separation → initial/retry localization → failure transitions | [v3.9.2 correctness](correctness-maintenance.md#final-stable-delivery), PR #166 |
| APPEARANCE-05 | Shared themes → reviewed palettes/gradients → bounded selectors and edits | [v3.10.0 source and gates](appearance-preview-diagnosis.md#source-and-required-gates), PR #169 |
| PREVIEW-01 | Deterministic scenarios → shared selectors/renderer → presentation checks | [v3.10.0 source and gates](appearance-preview-diagnosis.md#source-and-required-gates), PR #169 |
| EXPLAIN-02 | Style/source reasons → explicit input file → paged explanations and errors | [v3.10.0 source and gates](appearance-preview-diagnosis.md#source-and-required-gates), PR #169 |
| TASK-02 | Slice 1: external read-only browsing/paging/refresh/resize; slice 2: shared filtering/search/expansion/evidence/reading position | [v3.11.0 accepted delivery](task-version-review.md#accepted-source-and-immutable-delivery), PR #172 |
| UPDATE-02 | Slice 1: local status and verified review; slice 2: execution/detach/recovery; slice 3: protected history cleanup | [v3.11.0 slice 1](task-version-review.md#accepted-source-and-immutable-delivery), PR #172; [v3.12.0 slices 2/3](source-command-package-management.md#v3120-delivery-record), PR #175 |
| SOURCES-01 | Slice 1: distinct stop operations and retained results; slice 2: stored GitHub check pages; slice 3: binding reuse and protected cleanup | [v3.12.0 delivery](source-command-package-management.md#v3120-delivery-record), PR #175 |
| COMMAND-02 | Separate automatic approval → active-session scheduling → cancellation/revision/lifecycle verification | [v3.12.0 delivery](source-command-package-management.md#v3120-delivery-record), PR #175 |
| UX-03 | Shared history/change review → editor controls → compare/export/reload/retry recovery | [v3.13.0 delivery](draft-history-and-reuse.md#delivery-evidence), PR #177 |
| IMPORT-02 | Selected visual styles → whole-group/reference import → explicit local rebinding | [v3.13.0 delivery](draft-history-and-reuse.md#delivery-evidence), PR #177 |
| COMPOSITION-04 | Structural proposals → review/accept/cancel → combined reference regressions | [v3.13.0 delivery](draft-history-and-reuse.md#delivery-evidence), PR #177 |
| APPEARANCE-06 | Scope/precedence → final-row background paint → preview/editor/import/explanation | [v3.14.0 delivery](adaptive-row-scenarios.md#final-source-and-release-identity), PR #184 |
| APPEARANCE-07 | Semantic fallbacks → shared fitting/layout → editor choice and explanation | [v3.14.0 delivery](adaptive-row-scenarios.md#final-source-and-release-identity), PR #184 |
| PROFILE-02 | Scene intent → matching configurations → selection/partial reuse/provenance | [v3.14.0 delivery](adaptive-row-scenarios.md#final-source-and-release-identity), PR #184 |

The original SETUP-01/APPEARANCE-01/APPEARANCE-02 journeys remain grounded in [setup and complete appearances](setup-appearance.md). [Git and terminal delivery](m8-m9-delivery.md) supplies applicable TERMINAL-01 outcomes; [Native capacity and recovery](native-capacity.md) retains its separate transport/Pane/Client boundaries. I18N-02 and the later language expansion remain delivered but do not add prerequisites. Candidates do not expand this task.

<a id="collection"></a>

## Collection and reproduction

The five downloadable profiles derive from existing schemes through the installed product. They use compact separators and clear inactive row gradients/shared Powerline blocks. Daily adds an ordinary foreground gradient and session cost; other scene intent, linked visibility and quota alignment remain. See the [profile mapping](../SHOWCASE.md#scenes). No generated built-in scheme is edited and imports cannot grant source permission.

The collection entry uses an explicitly supplied verified tgz, product commit, new output directory and font files. Product modules load from the installed package, while the recorder and its dependencies retain a separate collection identity. Scene checks cover English/Simplified Chinese, 40/80/120 columns and dark/light/no-color variants. Light override variants use suitable foreground gradients and are recorded as variants, not silently substituted for the downloadable profile.

`samples-v3` passed **540 cases**: five scenes × two languages × three widths × three appearances × six scenarios (`normal`, `warning`, `critical`, `zero`, `missing`, `long-content`). All five profiles passed import dry-run, import/export equality, read-only preview and activation readback. It produced ten PNGs with zero model calls and removed the isolated installation. Its collector is `9b9788e10b5b6d71f36698751b22af0a908ab819`; later tool changes do not change that original identity.

Run the collection tool after building the pinned development checkout:

```sh
npm run build
node dist/typescript/tools/acceptance/showcase.js \
  --artifact /absolute/fbincon-claude-code-statusline-3.16.0.tgz \
  --commit c89a2ca088099ccd3ceb76baf59ecf11d84b08f0 \
  --output /absolute/new-showcase-output \
  --font /absolute/terminal-font.ttf
```

Collection defaults to zero model calls. The [asset inventory](../images/showcase/captures.json) binds each published file to its configuration/input, product/collector identity, dimensions, theme, language, font, transformation and digest. Original credentials, account configuration, transcripts and raw private logs remain outside tracked public files. Sanitization and crops must be documented; synthetic or replayed values cannot be labeled as live observations.

The separate public-command walkthrough uses `showcase-operations.js` with the same `--artifact`, `--commit` and new `--output` arguments. Optional `--claude /absolute/claude` invokes only host version detection; installation disables both editors' host integrations and both runtime collectors inside the fixture. `--github fbincon/claude-code-statusline` explicitly permits read-only lookup after verifying the existing `gh` account and repository read permission. Without that flag it performs no GitHub query. `--previous-artifact /absolute/public-3.15.0.tgz` additionally enables the documented exact-version tutorial against the public npm registry. Its previous-package SHA256 is fixed to `9064fa583037b57c3b3d0c876fabe6dd15e63c4a9b8e52446e1a2ef9dcabe683`.

Set `TMPDIR` to an owned directory with sufficient disk space when the system temporary filesystem is quota-limited. The fixture and npm cache stay isolated. Configuration snapshots require ordinary owned files; installation snapshots separately record npm bin-link targets without following them. All owned fixtures are removed with the platform adapter and removal is asserted.

Evidence kinds remain separate:

| Kind | Establishes | Does not establish |
| --- | --- | --- |
| Native window capture | Pixels/frames captured from the identified desktop window | Human acceptance or unobserved platforms |
| Actual-session PTY reconstruction | Recorded real terminal output, reconstructed with identified fonts and timing | A physical desktop screenshot |
| Actual-input replay | Production rendering of recorded inputs with stated transformations | A newly executed live interaction |
| Fixed sample | Reproducible production-renderer examples of named observations | Account usage, billing, current GitHub checks or real task execution |
| Agent visual review | Recorded inspection of the emitted images/frames | A new human usability study |

The actual editor material uses the approved PTY reconstruction route. GIFs select observed keyframes and hold each for **1.4 seconds**; they are edited walkthroughs, not real-time screen recordings or performance measurements. The task montage combines two identified sources: an installed-renderer replay of completed-task observations, followed by actual task-viewer PTY frames reading the copied stores. The inventory keeps both identities. All new visual material remains non-Powerline. APPEARANCE-06's continuous background requires colored Powerline and is therefore explained and linked rather than activated in these scenes.

`replay-04`, collected at `4f94f96911f20313b5a16e330b38b6e91f539b71`, passed English/Chinese replay with unchanged original observations and identical repeated frozen output. It shows the completed main task at 14 seconds and two agents at 5/7 seconds. Model identity and session cost are explicitly derived from the actual CLI init/result; they are **not** an original statusline callback. The parallel session's CLI cost is USD 0.00199048, which the production two-decimal format displays as `$0.00`; that does not mean a free call. Task-viewer `active_unknown`, `runtime_disabled` and `incomplete` evidence remain visible rather than being converted into complete active-time coverage.

The version image crops the actions/diagnostics area to terminal cells `[0,12,120,11]`; it does not show a complete prefix or current-version header. Its multiple-prefix warning remains visible. The full source frame and crop bounds remain in provenance, and the user guide requires selecting the intended `--prefix`.

<a id="budget-and-restoration"></a>

## Paid calls and machine restoration

The maintainer authorized at most **USD 10** for this task. Ordinary setup/configuration/source/version checks make no model calls. Necessary ordinary-task and dual-agent observations share one new task ledger, reusing the existing reservation/settlement rules without resetting historical ledgers. Failures, retries and subagents count together; unknown cost keeps its reservation and blocks further paid calls.

Claude's `--max-budget-usd` applies to its noninteractive entry. Paid prompts therefore use a budgeted entry; interactive editor/window collection must not submit unbounded prompts. Report CLI/provider-estimated cost separately from any independently verified provider invoice.

`paid-01` completed two budgeted tasks:

| Task | Reserved cap (USD) | CLI-reported cost (USD) | Offline observation |
| --- | ---: | ---: | --- |
| Ordinary task | 1 | 0.00025330 | Requested marker; no agents |
| Parallel task | 2 | 0.00199048 | Exactly two agents completed concurrently, with the two permitted sleep calls |
| Total | Shared authorization: 10 | **0.00224378** | Both costs known; no outstanding reservation |

Costs come from Claude CLI `total_cost_usd`; the provider invoice was not independently inspected. These are two top-level tasks, not a count of model/API requests; the parallel task includes its subagents. Offline verification made no new model call. The original collector ran before its first commit and retains exact source/compiled snapshots in `paid-01/collector.json` (SHA256 `ea098519db1f6b8d811da543f6ad7872869dff4390b548e49873044a1683523a`). Both tasks used their recorded CLI caps and **did not run under the subsequently added supervisor**. Later supervisor regressions are separate evidence, not retroactive protection for the original execution. Credential-copy cleanup is separately recorded; it removed copied authentication fields from the task-owned installation before-image without changing the original machine settings or relabeling the paid attempt.

Machine restoration passed for all nine tracked paths: original bytes, modes and absent states match exactly, including `settings.json`; the independently checked runtime preference file remains absent. The product stayed at 3.16.0. `preferences-exact-comparison.json` has SHA256 `b391c5a8ce0eaf01540a89fbb8b68a20944cd2e2a7458230f245bf0f640ebf3c`. The actual configured command and installed renderer then passed 72 **fixture** cases (twelve languages × three widths × main/subagent), without preference writes. These are installed-renderer observations, not 72 new paid or physical sessions.

The closure comparison again matched all nine paths. Both paid-session fixture installations were removed after retaining 24 original evidence files byte for byte; no active process referencing either fixture remained. Private transcripts, snapshots and logs stay in ignored storage. The final ledger still records USD 0.00224378 and zero outstanding reservation; closure and CI made no additional paid calls.

<a id="validation"></a>

## Separate acceptance records

| Track | Required observations | Current record |
| --- | --- | --- |
| SHOWCASE package/operations | Exact public bytes and installed inventory; installation/configuration/task/source/version walkthroughs; Save/reopen, cancellation, failure and partial outcomes | Passed: local operations, real task observations, six final editor/viewer journeys, restoration, installed reuse, final PR and main evidence |
| SHOWCASE configurations | Five importable profiles; non-Powerline assertions; isolated source permissions; width/theme/no-color and round-trip checks | Passed: 540 cases, five profile journeys and ten sample PNGs |
| SHOWCASE media | Ten scene PNGs, six bilingual GIFs, four source/version PNGs; complete decode, keyframe inspection, provenance and privacy checks | Passed: 14 PNGs and six GIFs; complete GIF decode, source hashes, keyframes and privacy reviewed |
| Tool regressions | Wrong package identity, false source labels, Powerline rejection, restoration failure and existing budget unknown-cost behavior | 22 focused tests passed in `test-showcase-tools-04.log`; no failed/skipped tests |
| Documentation | Current-fact audit, bilingual semantics, navigation, preserved anchors, docs/whitespace checks and committed-only checkout | Passed: 22 pairs updated, seven pairs retained; all prior anchors preserved across 48 changed Markdown files; final implementation checkout passed 4,368 links and whitespace checks |

The document audit covers the homepage, user guide, topical guides, command reference, image index and development navigation. It corrects current counts, languages, schemes, format guidance and project bindings while retaining original historical evidence. Existing directories and image paths stay in place; reordered sections preserve public anchors. Public navigation must not depend on ignored local evidence files.

The semantic/anchor audit is recorded in `documentation-audit.json`, SHA256 `ff210542b82e84b8de3f0ee586b0a846ef3640b7937f7147649b93b7363453a4`. It identifies its reviewed working-tree bytes and excludes the separately authored SHOWCASE files. Its then-failing documentation check correctly retained not-yet-published media links; it is not relabeled as the final clean-checkout check.

The local `operations-02` walkthrough passed all six groups with zero model calls: setup/install/doctor, JSON observations, command lifecycle, import authorization isolation, the 3.15.0 → 3.16.0 tutorial, and explicit GitHub lookup. It verified 1,091 installed payload files plus the candidate identity manifest. Setup/install dry runs preserved absent/existing configuration; non-TTY setup exited 2 without saving; doctor left persistent files unchanged. JSON checks retained explicit zero while separately reporting missing, stale, invalid and missing-file observations. Command checks preserved the last success after exit 7, distinguished whole-job cancellation, retained manual execution after automatic policy was disabled, and blocked refresh after source disablement. Profile transfer created no source grants in its recipient.

The tutorial installed the verified public 3.15.0 tgz with offline npm and scripts disabled, then used the verified 3.16.0 manager with the public registry: upgrade dry-run preserved the target, explicit upgrade produced the exact public 3.16.0 files, and rollback dry-run preserved that installation. It did not repeat the separate crash/recovery suite. The read-only GitHub result for `docs/showcase-01` at `9b9788e10b5b6d71f36698751b22af0a908ab819` was **valid / no PR**, with `ci=no_pr`, observed at `2026-10-30T10:55:11.659Z`; that is not a passing-check claim. The source was disabled afterward and the isolated installation was removed.

Private summary: `dist/validation/showcase-01/operations-02/summary.json`, SHA256 `dc774d27e841f337c59edb3dbe4a1b09e4a4e3eed48aa2d731f569efec975b84`. Its collector files and compiled hash remain recorded, including the then-uncommitted collector flag. The preceding `operations-01` failed in the collector because a configuration-only snapshot rejected an ordinary npm bin symlink; the product bootstrap had succeeded. The corrected installation snapshot and three focused regression tests passed. That original failure and successful cleanup remain recorded, not relabeled as product acceptance.

The exact `c89a2ca` version-management suite separately passed seven cases from 3.7.0 and seven from 3.8.0 against the same public 3.16.0 bytes. It used real npm and a controlled loopback registry for upgrade/rollback, interruption after package verification, package recovery and separate configuration restoration, including retained editor controls and protected cleanup. It uses a version-only host fixture and makes no model calls; this is not a physical editor run. `version-roundtrips.json` retains the original matching product/collector source.

`installed-reuse-02` passed installed-module history, atomic structural repairs, visual-style fields, group closure, unbound-source handling, conflict retry, unknown-save reconciliation and Save/reopen across all twelve languages and 40/80/120 widths. The initial reuse attempt omitted fixture installation and correctly hit the owned-renderer guard; that preparation failure remains separate and required no product change.

Actual-machine version check/dry-run used the correct persistent prefix `/home/fbincon/.local`: current and target remained 3.16.0, compatibility passed, reasons/conflicts were empty, and the dry-run returned `unchanged: true` with **`artifact_verified: false`**. This same-version result did not download and verify an upgrade archive. Independent installed-inventory verification established that all 1,092 files match the published package. Earlier temporary-quota and wrong-default-prefix diagnostics remain recorded; the latter was a target-selection error, not a missing working installation.

`journeys-06` passed six real editor/viewer PTY journeys. Subsequent independent review strengthened detail assertions, source hashes and cleanup checks, so its successful frames retain their original collector identity. A new execution supplies the final hardened capture; the older run is not relabeled as that execution.

The final `journeys-final-02` execution uses clean collector `7081c45acbc60dbe60526dcdd723d3125205ddef` and the original public package. All six English/Chinese external, Native and read-only viewer journeys passed; every terminal mode was restored, owned process groups were confirmed ended, and the isolated installation was removed before publishing success. The task projection binds the original stream to one completed task and exactly two completed agents. Receipt SHA256: `bb1761079dde2f46e3af13ed329bc8097ec6e68565246f52fd22f71e6f52023e`. Earlier harness-preparation, profile-format, privacy-crop and overbroad task-event assertions remain failed diagnostics; these were collection-tool corrections, not product changes.

The [published inventory](../images/showcase/captures.json) contains 20 assets (14 PNGs and six GIFs, 1,257,840 bytes). Full GIF decoding and inspected keyframes passed. Task clips combine the clean `4f94f96911f20313b5a16e330b38b6e91f539b71` replay with actual task-viewer frames; the inventory retains both sources and the 1.4-second edited holds. Other clips use actual editor keyframes, including explicit Save followed by reopening. Native crops exclude the surrounding host, and version images retain the action/diagnostic area while excluding private paths. Agent inspection is not human/physical acceptance.

To reproduce a combined task clip after running `showcase-replay` and `showcase-journeys`, copy the replay PNG to a new frame directory as `frame-000.png`, then copy that language's browse frames in the order in `receipt.json` as `frame-001.png` onward. Use the exported `encodeKeyframes(directory, frameNames, absoluteOutput)` from `showcase-journeys.js`; it applies the recorded 128-color Bayer palette, 1.4-second holds, infinite loop and complete decode check. Keep the original per-frame byte hashes, source collections and edited-timing label when publishing. Do not insert unobserved intermediate states.

Run `npm run docs:check` and `git diff --check`. For the actual committed difference, run `ci:plan` and all selected `ci:check` tasks; use `--compare` where the plan requires package comparison. Documentation/media, examples and acceptance tools retain their separate checks and their union. Unresolved ownership or comparison blocks. Local receipts are not Actions acceptance; final PR **Complete candidate evidence** and applicable main verification remain required. No CI classification or protection is weakened for this delivery.

<a id="delivery"></a>

## Delivery and completion

**Accepted on 2026-10-30 (Asia/Shanghai).** SHOWCASE-01 and documentation maintenance passed their separate acceptance tracks. [PR #192](https://github.com/fbincon/claude-code-statusline/pull/192) delivers the tools, five profiles, 20 assets, bilingual walkthrough and current-document corrections. The evidence follow-up records these results and marks the roadmap DONE without changing the product or original capture identities.

| Delivery identity | Verified result |
| --- | --- |
| Final implementation head | `b61627e9983fea63ba79883e23446063382ff031` |
| Final PR CI | [Run 41049771362, attempt 1](https://github.com/fbincon/claude-code-statusline/actions/runs/41049771362): Linux, Windows and macOS scoped checks, evidence verification and **Complete candidate evidence** passed |
| Implementation main | `258559d981eac20a7e5a6169d2d712e9ce196338`, normal two-parent merge of PR #192 |
| Main CI | [Run 41050797157, attempt 1](https://github.com/fbincon/claude-code-statusline/actions/runs/41050797157): accepted-base verification of reused PR maintenance evidence and **Complete candidate evidence** passed |
| Gitee implementation main | `258559d981eac20a7e5a6169d2d712e9ce196338`, verified after explicit non-force push from prior main `91133d20e8d961934465a440a11c0ca073b60ba2` |

The immutable implementation plan selected `acceptance`, `actions`, `assets`, `core` and `docs` on Linux, plus `acceptance` on Windows/macOS. Its Linux local receipt passed at the final head; CI supplied the remaining platform executions. No package comparison or complete product matrix was selected for this maintenance difference. Main reused those original executions through the accepted first-parent verifier; its intentional skips are not new execution samples or omitted obligations. No classifier or protection was changed.

An independent checkout containing only committed files at `b61627e9983fea63ba79883e23446063382ff031`, with locked dependencies installed using disabled lifecycle scripts, passed `docs:check`: **4,368 links, zero errors**. Whitespace and the bilingual semantic/anchor review also passed. This clean-checkout result is separate from the earlier working-tree audit and its historical missing-media diagnostics.

The documentation-only closure uses the same protected PR/main process and its own actual impact plan. Its final merge and verified Gitee synchronization identity are reported at handoff rather than recursively creating another evidence PR. Gitee receives validated main only after divergence inspection; published version refs/assets remain unchanged.

The six [issue #96 gaps](https://github.com/fbincon/claude-code-statusline/issues/96) remain **unverified**: macOS physical sleep/resume; macOS 14 Intel desktop/power; Windows 10 desktop/editors/focus/interruption/recovery; WSL desktop launch/focus/popup; remaining target-specific power/human visual coverage; and the unavailable exact Claude 2.1.296 declarations. They neither pass through this demonstration nor waive new failures. Product defects found during collection are reported with their impact and blocking status; product repair requires a separately agreed scope.
