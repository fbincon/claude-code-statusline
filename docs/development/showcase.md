# SHOWCASE-01 implementation and evidence

**English** | [简体中文](showcase.zh-CN.md)

The [roadmap](roadmap.md#milestones) owns work-package status; the [development plan](development-plan.md#showcase-01) owns scope and acceptance. This record separates demonstration acceptance from documentation maintenance. The [user walkthrough](../SHOWCASE.md) and [gallery](../images/showcase/README.md) are the public entry points.

Work began from main `91133d20e8d961934465a440a11c0ca073b60ba2` after the maintainer approved the implementation plan. This is maintenance around an existing release: no product version, tag, Release or npm publication is created. Public commands, formats and defaults are unchanged.

The initial delivery below remains historical evidence for PRs #192/#193 and main `d409503491177542b6cb8834a83888649731bf28`. Its compact profiles, grey editor frames, crop bounds, collector identities and original validation results are not relabeled by later visual work. The current classic/color presentation is described in the [visual refinement](#visual-refinement); previous asset bytes and their inventory remain available in that original Git tree.

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

The initial five downloadable profiles derived from existing schemes through the installed product. They used compact separators and cleared inactive row gradients/shared Powerline blocks. Daily added an ordinary foreground gradient and session cost; other scene intent, linked visibility and quota alignment remained. The current [profile mapping](../SHOWCASE.md#scenes) follows the later visual refinement. No generated built-in scheme is edited and imports cannot grant source permission.

The collection entry uses an explicitly supplied verified tgz, product commit, new output directory and font files. Product modules load from the installed package, while the recorder and its dependencies retain a separate collection identity. Scene checks cover English/Simplified Chinese, 40/80/120 columns and dark/light/no-color variants. Light override variants use suitable foreground gradients and are recorded as variants, not silently substituted for the downloadable profile.

`samples-v3` passed **540 cases**: five scenes × two languages × three widths × three appearances × six scenarios (`normal`, `warning`, `critical`, `zero`, `missing`, `long-content`). All five profiles passed import dry-run, import/export equality, read-only preview and activation readback. It produced ten PNGs with zero model calls and removed the isolated installation. Its collector is `9b9788e10b5b6d71f36698751b22af0a908ab819`; later tool changes do not change that original identity.

Run the collection tool after building its pinned development checkout. Reproducing an earlier collection requires that collection's recorded tool commit; current tools apply the later visual recipe:

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

The initial version image cropped the actions/diagnostics area to terminal cells `[0,12,120,11]`; it does not show a complete prefix or current-version header. Its multiple-prefix warning remains visible. The full source frame and crop bounds remain in provenance, and the user guide requires selecting the intended `--prefix`.

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

The [initial published inventory](https://github.com/fbincon/claude-code-statusline/blob/d409503491177542b6cb8834a83888649731bf28/docs/images/showcase/captures.json) contains 20 assets (14 PNGs and six GIFs, 1,257,840 bytes). Full GIF decoding and inspected keyframes passed. Task clips combine the clean `4f94f96911f20313b5a16e330b38b6e91f539b71` replay with actual task-viewer frames; the inventory retains both sources and the 1.4-second edited holds. Other clips use actual editor keyframes, including explicit Save followed by reopening. Native crops exclude the surrounding host, and version images retain the action/diagnostic area while excluding private paths. Agent inspection is not human/physical acceptance.

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

<a id="visual-refinement"></a>

## Classic color refinement

The maintainer approved this follow-up after the original delivery, using the actual machine's display as a visual reference. Product 3.16.0 and the original paid observations remain fixed. Current images replace the initial presentation at the same public paths; the previous images and inventory remain identified by main `d409503491177542b6cb8834a83888649731bf28`. This is visual/tooling maintenance, not a product feature or a new physical acceptance result.

### Reference and component colors

The observed reference display has SHA256 `a2d461caa4109bfb5747178f1bf49f6f2f5ae892d10e0f9775ce37595a5f00e1`: color enabled, default RGB palette, Classic theme/separators, legacy labels/icons/numbers and original model names. Full directory formatting, remaining allowances, local countdowns and scope labels when subagents are present are retained. The model Petal, directory Sunset and remaining-context Ocean scales below preserve the three chosen anchors. Directory/Token and remaining-context/window-size now have distinct scales. Status symbols such as ✓ and ⏱ remain meaningful; decorative ASCII M/D/G overrides are cleared.

Every enabled foreground-capable type uses its reviewed scale across main/subagent rows and scenes. Spacers, separators and editor controls remain neutral. Light variants use deep colors from the same hue families; only the quota tutorial enables threshold overrides (70/90), so its warning/critical colors can replace decorative gradients under existing product rules. The maintained mapping is `SHOWCASE_GRADIENTS` in [the collection driver](../../tools/acceptance/showcase-driver.ts); these are documentation configurations, not new built-in gradient presets.

| Component type | Dark-background stops | Light-background stops |
| --- | --- | --- |
| `model-with-effort` | `#fbcfe8` → `#e9d5ff` → `#dbeafe` | `#9d174d` → `#6b21a8` → `#1e40af` |
| `current-dir` | `#fb923c` → `#f472b6` → `#a78bfa` | `#9a3412` → `#9d174d` → `#5b21b6` |
| `git` | `#86efac` → `#5eead4` → `#7dd3fc` | `#166534` → `#115e59` → `#075985` |
| `context-remaining` | `#22d3ee` → `#3b82f6` | `#0e7490` → `#1e40af` |
| `context-window-size` | `#93c5fd` → `#a5b4fc` → `#c4b5fd` | `#1e40af` → `#3730a3` → `#5b21b6` |
| `context-used` | `#fed7aa` → `#fdba74` → `#fca5a5` | `#9a3412` → `#92400e` → `#991b1b` |
| `five-hour-limit` | `#fde68a` → `#fdba74` → `#fda4af` | `#854d0e` → `#9a3412` → `#9f1239` |
| `weekly-limit` | `#ddd6fe` → `#c4b5fd` → `#a5b4fc` | `#6b21a8` → `#5b21b6` → `#3730a3` |
| `spend-limit` | `#fecdd3` → `#f9a8d4` → `#e9a8f4` | `#9f1239` → `#9d174d` → `#86198f` |
| `five-hour-reset` | `#d9f99d` → `#a7f3d0` → `#99f6e4` | `#3f6212` → `#065f46` → `#115e59` |
| `weekly-reset` | `#c4b5fd` → `#a5b4fc` → `#99f6e4` | `#5b21b6` → `#3730a3` → `#115e59` |
| `tokens` | `#f0abfc` → `#d8b4fe` → `#c4b5fd` | `#86198f` → `#6b21a8` → `#5b21b6` |
| `task-timer` | `#99f6e4` → `#67e8f9` → `#93c5fd` | `#115e59` → `#155e75` → `#1e40af` |
| `task-active-timer` | `#a7f3d0` → `#a5f3fc` → `#bfdbfe` | `#065f46` → `#155e75` → `#1e40af` |
| `session-cost` | `#c7d2fe` → `#d8b4fe` → `#fbcfe8` | `#3730a3` → `#6b21a8` → `#9d174d` |
| `session-cost-rate` | `#fed7aa` → `#fca5a5` → `#f9a8d4` | `#9a3412` → `#991b1b` → `#9d174d` |
| `run-state` | `#bae6fd` → `#99f6e4` → `#a7f3d0` | `#075985` → `#115e59` → `#065f46` |
| `task-progress` | `#a5f3fc` → `#93c5fd` → `#c4b5fd` | `#155e75` → `#1e40af` → `#5b21b6` |
| `active-agents` | `#f5d0fe` → `#e9d5ff` → `#f9a8d4` | `#86198f` → `#6b21a8` → `#9d174d` |
| `status-elapsed` | `#bbf7d0` → `#bfdbfe` → `#ddd6fe` | `#166534` → `#1e40af` → `#6b21a8` |
| `status` | `#d9f99d` → `#86efac` → `#5eead4` | `#3f6212` → `#166534` → `#115e59` |
| `name` | `#fef08a` → `#fcd34d` → `#fde68a` | `#713f12` → `#854d0e` → `#92400e` |
| `elapsed` | `#fed7aa` → `#fde68a` → `#d9f99d` | `#9a3412` → `#854d0e` → `#3f6212` |
| `task` | `#bfdbfe` → `#c7d2fe` → `#fbcfe8` | `#1e40af` → `#3730a3` → `#9d174d` |

Daily uses the ten reference-like components over four explicit rows. The agent scene keeps completed rows and shares type colors with the main bar. Quota keeps its grouping and reset alignment. Narrow keeps legacy formatting at 40 columns with explicit rows and bounded example content. Light uses the Light theme and the deep stops above. Actual-task replay displays only fields supported by retained observations; it does not fill missing account values from samples.

### Collection boundary

The desktop reports Ubuntu Sans Mono 11. GNOME's window-screenshot API again returned `AccessDenied: ScreenshotWindow is not allowed`, so the approved route uses actual PTY output reconstructed with recorded DejaVu Sans Mono/Noto Sans CJK/Noto Sans Symbols2 font files. The raw terminal captures and selected cells, not screenshot background or `use_colors` alone, establish color.

The earlier grey editor recordings inherited `NO_COLOR=1`. Product behavior correctly treats the variable's presence as disabling color; assigning `0` or an empty string would still disable it. The revised recorder clones its isolated child environment and removes the key while selecting an identified color-capable terminal. It neither changes the global environment nor weakens product `NO_COLOR` handling. The public frame check requires matching foreground SGR and chromatic text cells inside the actual preview; neutral UI controls or a colored background cannot satisfy it.

The source/version pages include their real colored preview. Duplication appears only during the copy/history tutorial; after verifying Save/reopen, the recorder restores the clean scene before unrelated management pages. The replay reuses the original completed task and two agents from byte-identical retained evidence in a new isolated fixture. No new model call is needed for presentation changes.

Only the recording children receive the fixed sample home `/demo`; persistent state still uses the explicit isolated configuration directory. No `/demo` directory is created. This lets the real product preview render its full example path without exposing the private installation path. Native recordings use 200 × 38 cells and crop `[128,4,72,26]`; the crop must include the complete visible preview and keyboard footer. External recordings remain 120 × 32. Version images crop `[0,12,120,18]`, preserving the actual action/diagnostic area and colored preview while excluding private paths above it. The multiple-prefix diagnostic remains visible and is not changed into a successful version check.

### Verified revision outputs

All **14 PNGs and six GIFs** were recollected, totaling **1,890,452 bytes**. The [current inventory](../images/showcase/captures.json) binds every asset to exact profile, saved baseline, input, raw ANSI, terminal cells, crop, fonts, source/compiled collector bytes and conversion identities. Baseline hashes describe saved input, not every unsaved tutorial draft. The Native style tutorial explicitly borrows the session-cost gradient for the model, then proves undo/redo and cancellation; its temporary palette exception is recorded separately.

| Collection | Actual collector commit | Result and provenance |
| --- | --- | --- |
| `samples-final` | `ff0861050c99e6fba7286ca36170f84b714cf914` | 540 cases, five import/export/activation journeys, ten PNGs; provenance SHA256 `1e34703f914a9385fac759474f5adcaa03b71c93f7978c1b12c3fc9421e0fe78` |
| `journeys-final-03` | `746907dd6d3d9ce1e90bf3f9fdf54b40b066daa8` | Six actual English/Chinese editor/viewer journeys; byte-bound imported profile, saved baseline, ANSI and frame files; receipt SHA256 `dabd63714d3355026e5a264357805d17e3a13a2569901c7b4a7ba37747af8927` |
| `replay-final-03` | `2630bb9ec8f9b3ff3850320d51f2f8fd38ddda8b` | Two completed-observation replays, unchanged inputs and frozen durations, source and compiled collector digests; provenance SHA256 `5f14f2c7b2771fceec863728a0f5dc1ceddb1b54c999271fe78449fbeff629bd` |

These directories are under private `dist/validation/showcase-01/color-refinement`; their names do not replace the recorded commit/hash identities. Source snapshot and runtime package identities remain distinct. Both source tests and actual installed recordings verify color; no-color still passes as a compatibility matrix case and is excluded from the public selection. All 28 focused tool tests passed, including inherited `NO_COLOR=1`, `0` and empty values, false color evidence, configuration drift, source labeling, restoration and budget boundaries. A separate five-profile import/activation run preserved the source listing and registry bytes/modes/absence, with no implicit authorization.

GIF encoding uses one 256-color palette for the complete sequence with Bayer dithering. All **42 encoded frames** fully decoded and retained chromatic pixels inside their recorded preview area (the initial task replay uses its actual rendered rows). There are 36 selected keyframes, each held for 1.4 seconds, plus the encoder's final 40 ms repeat in each GIF. Agent visual review covered all 14 PNGs and those 36 source keyframes; it does not claim a human or physical usability study. The GIF color report has SHA256 `6dc2553a971bf2036f41a382445251c1cf923036813e2ca8c9fd798424d79378`. Captions describe the copy/undo/redo tutorial and later baseline restoration, and distinguish actual controlled-demo identifiers from the reader's own task IDs.

Earlier attempts remain diagnostics. The first visual pass exposed a missing stopwatch glyph; adding the recorded Noto Sans Symbols2 font fixed it. `replay-final-02` completed rendering but failed while hashing Node through the observation reader's 64 MiB limit. The fix uses the executable hashing path while keeping observation limits unchanged; its isolated fixture was removed, and `replay-final-03` passed. Later recordings bind the imported profile and actual frame-file bytes directly. Earlier results are not relabeled as those executions, and no product behavior was changed.

The revision made **zero new paid calls**. The original shared USD 10 ledger remains at CLI-reported **USD 0.00224378**, with no outstanding reservation; the provider invoice remains unverified. All ten revision-start configuration paths match their original bytes, modes and absent states, the parent `NO_COLOR` setting is unchanged, and the actual installation remains 3.16.0. Every accepted recording/replay installation was removed after its process and terminal checks. Original private observations remain preserved for reproduction with their recorded identities.

This visual-maintenance branch starts from validated main `d409503491177542b6cb8834a83888649731bf28`. Its actual committed impact plan, selected scoped checks, clean-checkout documentation check and final-head **Complete candidate evidence** govern delivery. The protected merge is followed by main verification and explicit non-force Gitee synchronization; final PR/main/synchronization identities are reported at handoff. There is no version, tag, Release or npm publication, and all six issue #96 gaps remain unverified.
