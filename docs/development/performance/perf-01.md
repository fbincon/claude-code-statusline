# PERF-01 — Post-migration performance work

**English** | [简体中文](perf-01.zh-CN.md)

Status: **IN_PROGRESS**. Established: **2026-10-15**; started: **2026-10-19** (Asia/Shanghai).
This is an independent follow-up to the [TypeScript migration](../typescript-migration.md),
not a seventh migration stage. The maintainer approved this bounded implementation
plan on 2026-10-19.

## Maintainer amendment, 2026-10-19

Functional correctness is mandatory. Performance optimization is an experiment:
no minimum improvement and no requirement to outperform Python apply to this
task. Preserve the original D06 policy, oracle, harness and failed results;
completion of this task does not establish a D06 pass. A new, separately identified
installed TypeScript comparison replaces neither the historical measurements nor
their methodology.

Use at most two implementation rounds, prioritizing startup/common commands and
then measured usage-index/resource hotspots. Revert reliable regressions and
changes whose uncertain benefit does not justify their complexity. With retained
runtime improvements, deliver stable v3.1.4 through PR/CI, npm OIDC, GitHub and
Gitee. The maintainer accepted only the same six existing gaps for v3.1.4; new
functional and automated failures remain blocking. With no retained runtime
change, merge necessary benchmark/report work and synchronize Gitee without
publishing an empty patch release. No paid calls or personal installation cutover
are included.

## Entry and ownership

TS-06 is DONE. Worker: Codex; branch: `fbincon/perf-01`; starting main:
`732a95bb31acab4fa62b7cccc191b4348e5b25c2`. Baseline: published v3.1.3 at
`05c5328d5d13488f3366ae6fdd30af4a55b3b22c`, package SHA-256
`fe0617ee8c82015cc179dc202c41e6c72403ca5688fba4ada105f5437e812ea0`.
Starting main differs from that release only in documentation. The migration plan
continues to own TS-01–TS-06 status; this page owns PERF-01.

The [v3.1.3 delivery record](../post-migration-fixes.md) retains source, artifacts
and known limitations. Measurements use isolated extractions of those published
bytes, never personal Claude configuration.

## Preserved evidence and goals

The [D06 amendment](../typescript-migration/ts-02/D06.md#applicability-amendment-2026-10-15)
removes performance measurement and passing budgets from migration/release gates.
Its numerical budgets, workload sizes, sample counts, alternating rounds,
bytecode modes and bounded noise-repeat rule remain unchanged for historical
D06 comparisons. The amendment above separately authorizes this task's installed
TS-to-TS method without a numerical performance gate.

| Evidence | Measured commit | Pass / fail / inconclusive |
| --- | --- | --- |
| [Original 03-F](../typescript-migration/ts-03/performance.03-f.json) | `1fddaa6ea1fef7f631e51641f15214cbddd7ec08` | 91 / 69 / 32 |
| [Optimization round 1](../typescript-migration/ts-03/performance.optimization-01.json) | `821915520b47e0f7a9dfa99c764c1d379a23a4da` | 97 / 64 / 31 |
| [Optimization round 2](../typescript-migration/ts-03/performance.optimization-02.json) | `93384f573ddb02b4067947493b6d89a64b276341` | 104 / 60 / 28 |

The latest measured result is still **FAIL**. Retain [all 192 comparisons](../typescript-migration/ts-03/performance.optimization-comparison.json),
[diagnostics](../typescript-migration/ts-03/diagnostics.optimization.json) and
[the two-round review](../typescript-migration/ts-03/PERFORMANCE-OPTIMIZATION.md).
The completed rounds are historical work, not newly authorized attempts.

Preserve Python reference `9b6d2fab4bf165be280d428a874521bfbf02c7e1`, frozen
fixtures and the original harness/provenance in an isolated comparison environment.
Normal runtime, build, test and release workflows must no longer require Python
when migration is complete. Archival comparisons remain outside those workflows;
do not delete their evidence or silently change the oracle while retiring tools.

## Active implementation and validation

1. Add artifact-mode benchmarks under `tools/benchmarks`, retaining historical
   entry points and all original results. Command timing executes the installed
   bin directly; counters use a separate instrumented invocation. Restore the
   complete cache, including identity pages, between samples. Each measured
   action runs in a fresh child; priming runs elsewhere. Linux GNU time supplies
   true child peak RSS. Cold means an empty product cache, not a dropped OS cache.
2. Reuse the 32 workload definitions and add four medium/large replay and
   per-field increment cases. Record outputs, collector counts and I/O alongside
   P50/P95/RSS. Exploratory runs locate hotspots; a retained candidate receives
   50 samples per case and three alternating baseline/candidate rounds through
   one fixed harness and the same fixture paths, with compile caching disabled.
3. Attempt no more than two implementation rounds; preserve public CLI, formats,
   exact counters, atomic publication, locks, timing and bounded resources.
   Complete applicable functional, installed and Node 22/24 gates. Pure Markdown
   follow-up uses only necessary documentation/whitespace checks.

Task completion requires the bounded attempt, applicable correctness gates and
honest evidence/delivery, not a speedup. Retain neutral, worse and inconclusive
measurements explicitly. Diagnostics never establish a D06 performance pass.

## Benchmark commands

Use the pinned development Node/npm. `--artifact` selects the installed Linux
measurement; omitting it retains the older workspace diagnostic, which must not
be described as installed-product timing. Artifact mode verifies every packaged
file before extraction and after measurement. `--validate` permits exploratory
runs on a dirty harness and labels the result accordingly.

```bash
npm run benchmark -- --artifact BASELINE.tgz --output NEW_DIRECTORY --profiles small,medium,large --samples 2 --validate
npm run benchmark:compare -- --baseline-artifact BASELINE.tgz --candidate-artifact CANDIDATE.tgz --output NEW_DIRECTORY --profiles small,medium,large --samples 50
```

The installed comparison runs each baseline/candidate case consecutively and
reverses order in the middle of three rounds. Process elapsed time includes GNU
time's external supervisor; in-process latency times only the action. RSS includes
that fresh child's module initialization, but never cache priming in another
process. Counter instrumentation is outside measured samples. Only the response's
`result.backend_version` is normalized between patch releases; hook evidence
checks the published record count, status and prompt ID. Raw measurements remain
under ignored `dist/validation/perf-01`.

## Boundaries and evidence

Existing timeout, bounded-resource, lock, atomic-write, clock-precision and
collector-count contracts remain mandatory. Host timeouts, lost events, failed
saves and memory exhaustion are functional failures. Preserve historical results,
record source/artifact/harness/fixture identities, checks, PRs and next action in
both languages, and commit independently readable summaries rather than raw logs.

Next action: complete exploratory baseline, select low-risk implementation work,
and retain its actual validation and delivery evidence here.
