# TS-03 shared core and backend migration

**English** | [简体中文](README.zh-CN.md)

The [migration plan](../../typescript-migration.md) owns stage status. TS-03 is
**IN_PROGRESS**, starting at `9b121e0`. The maintainer approved all six batches,
separate PRs with checks before merging, and synchronization to Gitee. There is
no new version, release, installed backend switch or external editor in this stage.

## Implementation sequence

| Batch | Deliverable | State |
| --- | --- | --- |
| 03-A | Private workspace, production platform primitives, lossless JSON, canonical revisions and comparison harness | DONE; [PR #78](https://github.com/fbincon/claude-code-statusline/pull/78) |
| 03-B | Configuration core, instances, catalog, languages, Unicode and generation ownership | DONE; [PR #79](https://github.com/fbincon/claude-code-statusline/pull/79) |
| 03-C | Locked configuration services, preferences and management commands | DONE; [PR #80](https://github.com/fbincon/claude-code-statusline/pull/80) |
| 03-D | Collectors, caches, timing, tasks, observations and hooks | DONE; [PR #81](https://github.com/fbincon/claude-code-statusline/pull/81) |
| 03-E | Rendering, preview and complete backend protocols | DONE — PR #82 |
| 03-F | Integrated parity, Mod checks, CI, performance and TS-04 handoff | IN_PROGRESS |

Active branch: `fbincon/ts-03-rendering`. 03-A/03-B/03-C/03-D merged as `21fb21d`/`f1363e3`/`0faa639`/`dc2e218`; GitHub/Gitee main were verified equal after each merge. Tested/merged commits and PRs are recorded after
verification. The package workspaces are private development packages at 0.0.0;
the existing Python application remains at 2.0.0.

## Boundaries and reproducibility

`packages/core` contains portable rules with no Node ambient types in its production
compilation. `packages/platform` owns Node/native I/O and imports pure core types.
`packages/cli` owns application orchestration. Tests use separate Node declarations.
Each package exposes subpaths instead of an eager aggregate import. Existing Mods
and TS-02 probes retain their independent builds.

Use Node **24.21.0**, npm **11.19.0**, and Python **3.14.4** for comparison. The
runtime archive checksums remain in the [TS-02 lock](../../../../tools/migration/ts-02/runtime-lock.json).
Set `TS03_PYTHON` to an existing interpreter when `python3` is not suitable.

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run migration:inventory
npm run migration:capture -- /absolute/new-output-directory
npm run migration:compare -- /absolute/new-output-directory/results.json
```

Capture refuses an existing directory. Every implemented case runs in a fresh
Node process with isolated config/runtime/session directories, no inherited model
credentials and an isolated PATH. Only the case-root path is normalized. An
unimplemented adapter is reported as pending and exits 2; no pending case counts
as parity. At the 03-A handoff all 161 functional adapters and all 516 mapped TS-03 tests remained
pending. 03-B implements the eight schema-read cases and 24 named baseline test replacements; 153 cases and 492 test IDs still await their later batches. Foundation tests are additional evidence, not substitutes for those cases.
The completion check `npm run migration:inventory -- --complete` must reject this
unfinished state.

The original oracle commit, fixtures, expectations, adapter hashes and D06 budgets
remain unchanged. Windows v2 boot identity follows the approved D02 correction.
Integer literals are read losslessly; float canonicalization follows Python's
finite binary64 representation, exponent thresholds and negative zero. Scalar-key
ordering and UTF-8 hashing match the existing semantic revision. Cross-process
locks retain the Python namespace; synchronous transactions reject recursive or
asynchronous lock callbacks. Atomic publication preserves complete old/new files;
multi-file interrupted installation recovery remains TS-04.

## Approved differences and acceptance

The maintainer permits changes to human CLI help and parameter diagnostics.
Normal command output, protocol messages/codes, stderr/stdout roles and exit codes
remain compatible. Exact changed strings are tracked by case, field and both
content hashes in [differences.json](../../../../tools/migration/ts-03/differences.json).
An unused, duplicate or broader exemption fails validation. Three precise help/argument diagnostic strings are recorded; no protocol, numeric, file or exit-status differences are exempted.

The [coverage ledger](../../../../tools/migration/ts-03/coverage.json) accounts for
all 516 baseline test IDs assigned to TS-03. Each port needs replacement test paths;
each TS-04 deferral needs a specific reason. Mixed editor/installation assertions
must be separated by behavior, not discarded by renaming their test family.

Local 03-A foundation validation: 28 tests, 27 passed, one Windows sharing test
skipped on Linux; compilation passed. This includes deterministic finite IEEE-754
comparison with Python, 16 mixed lock writers, both killed-holder directions,
publication fault/crash cases, native clocks/process identity and argv preservation.
Cross-platform checks run the production adapters on the existing eight TS-02
targets. Remaining physical power/desktop checks and the missing 2.1.296 host
declarations retain their earlier explicit limitations.

Raw evidence belongs under ignored `dist/validation/typescript-migration/ts-03/`.
Commit sanitized receipts with source/runtime hashes, commands, counts, failures,
skips and exact CI/PR links. Only the full TS-03 acceptance closes this stage.

## 03-B configuration and resource ownership

The core now validates and migrates display schemas 1–8, keeps disabled instance options, reconciles explicit rows, edits scoped forms/instances, expands presets, validates portable drafts and produces semantic import reviews. Configuration services and file effects are 03-C; rendering is 03-E. All 84 frozen rendering configurations validate; the eight schema cases replay in independent Node processes and match their original semantic state and file bytes without exceptions.

`tools/generation/resources.ts` is the active writer for 34 resources. It derives catalog IDs and presets from their TS definitions, languages from canonical JSON, and Unicode tables/fixtures from the pinned source and licenses. Both Mod copies and Python compatibility outputs are generated. The old Python generation commands retain read-only checks; historical Python benchmarks must use frozen reference exports. Removal detects obsolete generated language modules and compatibility packs without deleting unowned files. `npm run languages:coverage` reports missing translations without writing.

The 03-A artifact audit initially rejected ten Windows root/tool file hashes because checkout converted them to CRLF. Every difference was verified against that exact conversion and recorded in [the receipt](validation.03-a.json); there were no other differences. 03-B enforces LF for those files. The failed comparison is recorded explicitly; original platform receipts remain available in the ignored evidence directory. All 43 03-A PR checks passed before its guarded merge.

## 03-C configuration services and commands

The development entry is `node packages/cli/dist/src/entry.js`. It provides every `config` subcommand and the configuration UI service; successful production preview rendering is bound in 03-E. Installed Python commands remain unchanged. Use an isolated `--config-dir` when evaluating the TS entry. The backend binds its complete `LaunchSpec` and refuses another renderer; canonical legacy single-executable commands remain supported.

Transactions re-read under the existing installation lock, compare semantic revisions, merge unrelated settings, back up only changed artifacts, roll back failed writes and return the committed snapshot while still locked. Repeated saves create no new backups. Reads, dry-runs and import review preserve configuration bytes; portable export protects live files and owned support directories. UI preferences and runtime/editor opt-outs remain independent. JSON numbers retain their kind and precision, numeric-looking object keys keep input order, and public malformed JSON/UTF-8 diagnostics follow the pinned Python 3.14 oracle.

At the 03-C handoff the ledger mapped 78 of 516 baseline tests and Linux replay covered 26 of 161 fixed cases with the three approved text differences. All 43 PR checks passed; eight platform artifacts matched all 106 recorded source hashes exactly. CI also runs mixed Python/TS configuration and preference writers. Source receipts, checks and merge/sync evidence are in [validation.03-c.json](validation.03-c.json). The 03-B audit verified all eight ZIP digests and exact source hashes, with no checkout-normalization exception. A duplicate push-only Mod timeout and the successful same-head PR result are recorded in [validation.03-b.json](validation.03-b.json).

## 03-D collectors and runtime

The TS entry now accepts `runtime [--config-dir PATH]` and `hook`. Runtime v2 and v1 requests use the existing preferences and file schemas. Observation batches validate fully before publication. Reads, disabled collection and corrupt-state inspection do not repair files. Hooks remain silent and return success even when evidence cannot be recorded. The installed backend still uses Python.

Pure modules under `core/runtime` and `core/timing` own task transitions, identity binding, native/wait coverage, usage accounting and Git parsing. Application services under `cli/runtime` own the shared cache, session registry, transcript/submission cursors, task/live ledgers and classic agent-duration evidence. `RuntimeContext`, `RuntimeIO` and `CommandRunner` inject clocks, process identity, filesystem and Git execution. File effects use the existing platform locks and atomic publisher. Live observation acquires the live lock before the task lock; usage can acquire the cache lock before the task lock; task writers never acquire either live or usage locks. Submission indexing is bounded and acquired inside the task transition when final evidence needs it.

Usage retains per-message maximums, missing-versus-zero availability, independent cost-snapshot deltas, 5,000-ID compaction and 100-session retention. UTF-8 cursors advance only over complete byte lines. Git status keeps its 500 ms cache; branch differences use immutable commit keys and one shared deadline. Timing preserves Stop/continuation, notification aliases, overlapping waits, reboot degradation and frozen results. The runtime request reader stops after 1 MiB plus one byte. Python-compatible binary64 division, compensated sums, ISO timestamps and byte-file encoding detection are covered independently.

Local TS validation: 276 tests, 275 passed and one Windows-only sharing test skipped. The ledger maps **206/516** baseline tests; **310** remain pending. Ten mixed token tests have TS collector assertions but retain pending rendered-output assertions for 03-E. The frozen replay now covers **45/161** cases, with the same three exact CLI wording differences; **116** rendering/preview/slash cases remain. An additional 24-session action trace compares each result and final JSON state against the untouched TS-01 Python export, preserving numeric kinds. Actual multi-process tests cover 20 live writers, eight agent starts, four bounded-ledger writers and six usage-cache writers. Git integration includes worktrees, submodules, shallow clones and divergence. Final rendering, both Mods bound to TS, performance acceptance and complete ledger closure remain 03-E/F. See [validation.03-d.json](validation.03-d.json) for source-bound local evidence and all 43 successful PR checks. Eight clean CI artifacts matched 161 source hashes each and the pinned runtime hashes before the guarded merge and verified Gitee synchronization.

## 03-E rendering and complete backend interfaces

`core/rendering` supplies production main/subagent rows, previews, styles, Unicode fitting, thresholds, independent instance formats and Powerline. `cli/rendering` binds selected sources through `RenderEnvironment`; `platform/presentation` owns lexical path, date and hostname effects. The private development entry now accepts all planned backend commands and every UI v11 operation. UTF-8/BOM handling, NDJSON task IDs, empty rows, frozen timing and stdout/stderr contracts remain covered. Repeated metrics share raw snapshots; previews replace every live source.

The generator still owns 34 resources. Core and Client share lazy Unicode table accessors: ASCII rendering allocates no table arrays. Small statusline packs load by language and do not pull UI catalogues into the render path. Case folding/initial capitals and numeric text parsing explicitly preserve Python 3.14 UCD 16 where Node's newer database differs. No resource generator calls Python business logic.

The editor request/result interface preserves `LaunchSpec` and cwd, validates command preconditions, bounds result text and maps all terminal outcomes. Tests inject the adapter; the production development fallback remains unavailable until TS-04 supplies terminal execution. Existing Python installation and Mod bindings are unchanged.

All **161/161** fixed cases pass with the original three CLI wording exceptions. Local TS tests pass **454/455** (one Windows-only skip), Python **847/856** (nine platform skips), native Mod **112/112**, runtime Mod **10/10**. The ledger advances to **389/516** ported IDs; **127** remain pending, so `--complete` must still fail. [Validation evidence](validation.03-e.json) binds the results to sources and the pinned runtime. Remaining work is 03-F's full ledger audit, cross-module and Mod-to-TS validation, D06 performance/no-Python acceptance and TS-04 handoff. This intermediate batch does not mark TS-03 DONE.


## 03-F integrated acceptance in progress

03-E merged as `10c6348aef1fcd1d2a1681aa808a842e0d883b56` after all 43 PR checks. Eight receipts each matched 201 raw source hashes and the pinned runtime; GitHub and Gitee main were independently verified at the merge commit. The initial Windows CRLF mismatch was rejected and corrected before merge; [03-E evidence](validation.03-e.json) retains both attempts.

The 516-ID audit now has **471 ported**, **45 external TUI/installation/terminal tests assigned to TS-04**, and **zero pending**. [The assertion handoff](../../../../tools/migration/ts-03/ts04-handoff.json) names each deferred test and eight mixed-test assertions; their backend portions have TS evidence. `migration:inventory -- --complete` validates both ledgers and rejects missing owners. CI now requires this complete audit.

Fresh-process tests cover all five output-language packs without loading another language or UI catalogues. CLI help and argument errors honor the resolved UI preference and explicit language override; machine catalogues remain language independent. The allowed `cli-help` stdout hash was updated explicitly for localized descriptions; the immutable Python fixtures and the other two diagnostic exceptions remain unchanged.

Both original Mod libraries are compiled into temporary test trees and connected to real Node backend processes with an empty PATH. The native parser verifies all ten UI v11 operations, save/no-op/stale revisions, import review, spans and errors. The runtime queue verifies v2 acknowledgements, retry/deduplication, v1 reads, disabled/timing-only modes and bounded batches. Render, subagent NDJSON, hook and slash-hook also run there without Python. A separate Claude Code 2.1.296 PTY probe used temporary Mod bindings and the real host process API: both strict manifests passed, configuration describe/read/preview/preferences and runtime observe succeeded, no model calls occurred, and cleanup completed. This is automated host evidence; approved physical/desktop release gates remain.

The [performance harness](../../../../tools/migration/ts-03/performance/benchmark.ts) covers ten complete-command and 22 in-process workloads: three fixed transcript/agent/Git sizes, cold/warm/append transcript caches, Git miss/hit/expiry, repeated metrics, Unicode composition, agents, hook, preview and runtime observe. Fixture and bytecode priming remain outside measurement. Every measured output and collector count is checked; a fresh cache retains the reference's one-time lifecycle/usage rescans, while warm refreshes perform zero transcript reads. Full D06 runs require a clean committed source graph, 50 samples per side, three alternating rounds and separate cold/warm Python bytecode. They retain P50/P95, true peak RSS, policy/runtime/source hashes and the one-repeat noise rule. `--validate` checks fixtures only and cannot establish a performance pass. The formal run on clean commit `1fddaa6ea1fef7f631e51641f15214cbddd7ec08` completed and **failed**: 91 metrics passed, 69 failed and 32 were inconclusive. All 19,200 samples matched outputs and collector counts. [The full D06 record](PERFORMANCE.md) preserves every disposition and source/runtime/policy hash.

Local acceptance passes 549 of 550 TS tests (one platform skip), 847 of 856 Python tests (nine platform skips), both Mod suites (112/10), both Mod typechecks/strict validators, 34 generated resources, five retained read-only generators and the complete 516-ID audit. [03-F validation](validation.03-f.json) records exact sources and logs. [TS-04 handoff](TS04-HANDOFF.md) records pending editor/install assertions. The initial head passed all 43 PR jobs and eight exact 296-source-file receipts. A final differential help matrix corrects invalid-command/missing-option/mutual-exclusion exit codes without changing the allowed help wording. Final head/check/artifact verification is recorded in [PR #83](https://github.com/fbincon/claude-code-statusline/pull/83). **D06 failed; TS-03 remains IN_PROGRESS.** Further performance work belongs to this stage; merging its implementation and evidence does not waive that gate.
