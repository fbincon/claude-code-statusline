# SHOWCASE-01 implementation and evidence

**English** | [简体中文](showcase.zh-CN.md)

The [roadmap](roadmap.md#milestones) owns work-package status; the [development plan](development-plan.md#showcase-01) owns scope and acceptance. This page separates demonstration acceptance from documentation maintenance. The [user walkthrough](../SHOWCASE.md) and [gallery](../images/showcase/README.md) are the public entry points.

Work began from main `91133d20e8d961934465a440a11c0ca073b60ba2` after the maintainer approved the implementation plan. This is maintenance around an existing release: no product version, tag, Release or npm publication is created. Public commands, formats and defaults are unchanged.

The initial [delivery record](history/deliveries/showcase.md#delivery-and-completion) remains historical evidence for PRs #192/#193 and main `d409503491177542b6cb8834a83888649731bf28`. Its compact profiles, grey editor frames, crop bounds, collector identities and original validation results are not relabeled by later visual work. The current classic/color presentation is described in the [classic color refinement](history/deliveries/showcase.md#classic-color-refinement); previous asset bytes and their inventory remain available in that original Git tree.

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

Collection also requires `ffmpeg` and `ffprobe` on `PATH` for GIF encoding and decoding; the recorded collection used ffmpeg 8.0.1. Collection defaults to zero model calls. The [asset inventory](../images/showcase/captures.json) binds each published file to its configuration/input, product/collector identity, dimensions, theme, language, font, transformation and digest. Original credentials, account configuration, transcripts and raw private logs remain outside tracked public files. Sanitization and crops must be documented; synthetic or replayed values cannot be labeled as live observations.

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

The full [delivery record](history/deliveries/showcase.md#showcase-01-implementation-and-evidence) is in the development history. The links below open its moved sections.

- <a id="baseline"></a><a id="fixed-product-and-collection-identities"></a>[Fixed product and collection identities](history/deliveries/showcase.md#fixed-product-and-collection-identities)
- <a id="budget-and-restoration"></a><a id="paid-calls-and-machine-restoration"></a>[Paid calls and machine restoration](history/deliveries/showcase.md#paid-calls-and-machine-restoration)
- <a id="validation"></a><a id="separate-acceptance-records"></a>[Separate acceptance records](history/deliveries/showcase.md#separate-acceptance-records)
- <a id="delivery"></a><a id="delivery-and-completion"></a>[Delivery and completion](history/deliveries/showcase.md#delivery-and-completion)
- <a id="visual-refinement"></a><a id="classic-color-refinement"></a>[Classic color refinement](history/deliveries/showcase.md#classic-color-refinement)
- <a id="reference-and-component-colors"></a>[Reference and component colors](history/deliveries/showcase.md#reference-and-component-colors)
- <a id="collection-boundary"></a>[Collection boundary](history/deliveries/showcase.md#collection-boundary)
- <a id="verified-revision-outputs"></a>[Verified revision outputs](history/deliveries/showcase.md#verified-revision-outputs)
