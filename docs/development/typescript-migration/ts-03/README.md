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
| 03-B | Configuration core, instances, catalog, languages, Unicode and generation ownership | VALIDATING |
| 03-C | Locked configuration services, preferences and management commands | NOT_STARTED |
| 03-D | Collectors, caches, timing, tasks, observations and hooks | NOT_STARTED |
| 03-E | Rendering, preview and complete backend protocols | NOT_STARTED |
| 03-F | Integrated parity, Mod checks, CI, performance and TS-04 handoff | NOT_STARTED |

Active branch: `fbincon/ts-03-configuration-core`. 03-A merged as `21fb21d` and GitHub/Gitee main were verified equal. Tested/merged commits and PRs are recorded after
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
An unused, duplicate or broader exemption fails validation. None are recorded yet.

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
