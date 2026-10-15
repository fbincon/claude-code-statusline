# PERF-01 — Post-migration performance work

**English** | [简体中文](perf-01.zh-CN.md)

Status: **NOT_STARTED**. Established: **2026-10-15** (Asia/Shanghai).
This is an independent follow-up to the [TypeScript migration](../typescript-migration.md),
not a seventh migration stage. This document records future work; creating it does
not start profiling, optimization, installation changes or a release.

## Entry and ownership

Start after **TS-06 is DONE** and a subsequent task starts this work. No worker,
implementation branch, target release or optimization round is assigned yet.
The migration plan remains the sole authority for TS-01–TS-06 status; this page
owns the follow-up's scope and its eventual progress records.

TS-06 must retain the delivered source commit, artifact checksums, runtime and
dependency versions, installation path and known limitations. PERF-01 will use
that exact installed candidate for its initial full measurement. Those future
identifiers are not available yet; the TS-03 candidate must not be presented as
the completed migration's baseline.

## Preserved evidence and goals

The [D06 amendment](../typescript-migration/ts-02/D06.md#applicability-amendment-2026-10-15)
removes performance measurement and passing budgets from migration/release gates.
Its numerical budgets, workload sizes, sample counts, alternating rounds,
bytecode modes and bounded noise-repeat rule remain unchanged as PERF-01's
measurement method and targets. Any later method, budget or architecture change
needs its own recorded decision; this plan does not authorize one.

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

## Work to plan after entry

1. Measure the final installed TS candidate with the preserved D06 scenarios;
   record source, artifacts, runtime, policy and fixture hashes. Include output
   and exact collector counts, not just latency and RSS.
2. Reassess the actual product's bottlenecks. Existing leads are medium cold-cache
   RSS, warm/append cache latency, startup and hooks, Git misses/expiry and
   multi-agent/Unicode rendering. The final product's measurements determine
   priority; current synthetic profiles do not prove future user impact.
3. Define bounded implementation rounds and acceptance for a separate execution
   task. Every candidate must retain compatibility and assess individual
   regressions. Do not repeat an unchanged failing candidate under D06's
   inconclusive-only noise exception.

PERF-01 completion will require its recorded performance targets and applicable
functional/platform checks to be satisfied. Until then, retain each unresolved
failure or inconclusive result explicitly. Diagnostic profiles and fixture
validation alone cannot establish a performance pass.

## Boundaries during migration

Relative Python/TS latency or RSS regression does not block TS-03–TS-06, including
preview and stable delivery. Repeated full D06 runs are not required during those
stages. Release notes must disclose known limitations and recovery options.

Functional failures remain actionable: host timeouts that prevent operations,
lost events, failed saves or memory exhaustion must still be resolved. Preserve
existing timeout, bounded-resource, lock, atomic-write, clock-precision and
collector-count contracts. Physical/desktop acceptance and installation/recovery
requirements remain governed by the migration plan.

## Evidence and updates

When this work starts, record its owner, baseline, branch, commits, PRs, checks,
measured results and next action here in both languages. Keep raw measurements
in ignored evidence directories and commit independently readable summaries.
Do not rewrite earlier JSON receipts or interpret their historical stage status
as the migration's current status.
