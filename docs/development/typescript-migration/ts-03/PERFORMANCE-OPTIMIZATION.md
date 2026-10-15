# TS-03 performance optimization

**English** | [简体中文](PERFORMANCE-OPTIMIZATION.zh-CN.md)

State: **IN_PROGRESS**. Both approved optimization rounds and their complete unchanged D06 measurements are finished. Round 2 has **104 pass / 60 fail / 28 inconclusive**; implementation stops for focused review. The original [03-F failure](PERFORMANCE.md) and [raw summary](performance.03-f.json) remain historical evidence. This work does not change TS-04 admission or switch the installed backend.

## Scope and reproducibility

Base: `f7cf0e1`. Branch: `fbincon/ts-03-performance`. Node 24.21.0, npm 11.19.0 and Python 3.14.4 are explicit; the default shell Node is not used. Python oracle: `9b6d2fab4bf165be280d428a874521bfbf02c7e1`. D06 policy, fixtures, 50 samples, three alternating rounds, separate bytecode modes, true peak RSS, output hashes and exact collection counts remain unchanged. Compile caching stays disabled.

Development profiles cover cold/warm/append transcript caches, composite render, hook, Git hits and 32-agent rendering. CPU/allocation/GC captures are diagnostic only. Baseline fixture validation passed all 32 workloads. A first diagnostic attempt could not extract the worker JSON after the heap profiler printed a final GC line; the corrected diagnostic retained the actual JSON record and both attempts remain private. No formal D06 attempt was made by that diagnostic.

## Round 1: staged streaming and cache allocation

The internal JSON reader uses native parsing for safely classified ordinary data and a one-pass exact reader for exceptional numeric kinds and ordered member names. It eliminates number placeholders and a second whole-tree restoration. Public strict parsing and Python diagnostics remain unchanged. Ordered dictionaries allocate insertion indexes only when numeric/symbol names require them, and accounting traversal avoids intermediate arrays. Cache serialization preserves exact Python layout and numeric spelling.

Transcript usage is reduced as complete byte lines arrive. Only counters, independent cost-field suffixes and compact lifecycle observations survive parsing. Read failure discards staged results before cursor/counter/task publication. Original lifecycle ordering, per-field snapshot deltas, ID compaction, one-time rescans, lock ordering and disk formats are retained.

New regressions cover exact integers around 2^53, malformed JSON diagnostics, late numeric/symbol dictionary keys, read failure after valid records and 72 randomized partial-snapshot/duplicate-message traces against the immutable Python implementation.

## Acceptance and next action

Round 1 complete D06 **failed: 97 pass, 64 fail, 31 inconclusive**. All 19,200 samples matched output and collector counts. Measured commit: `821915520b47e0f7a9dfa99c764c1d379a23a4da`; [complete summary](performance.optimization-01.json), [functional/CI evidence](validation.optimization-01.json), [PR #84](https://github.com/fbincon/claude-code-statusline/pull/84). All 43 PR jobs passed; eight receipts each matched 298 source hashes, the pinned runtime and a tested merge tree equal to the PR head. Four duplicate push runs were cancelled and recorded separately, never counted as passes. Local validation: **553/554 TS tests passed** (one Windows-only skip), all **161 fixed cases** matched with the same three CLI text exceptions, the **516-ID audit** passed, Python **847/856** passed (nine platform skips), and official Claude Code 2.1.294 Mod suites passed **112 native / 10 runtime**. Both Mod typechecks and strict validators, 34 generated resources, five retained read-only generators and documentation validation passed. The initial system-Python suite lacked its installed CLI entry (one failure, eleven skips); the existing Python 3.14.4 repository virtual environment passed the full suite. No source correction or test waiver was used for that environment issue. No diagnostic result is a performance pass. After Round 1, remaining failures select Round 2's startup/native-binding, Git-cache, rendering or residual cache work. At most two changed-source rounds are authorized. The existing same-graph noise repeat is permitted only when there are inconclusive metrics and no failures.

TS-03 stays IN_PROGRESS until all applicable functional checks and D06 pass. If Round 2 still fails or remains inconclusive, retain the stage state and deliver a focused review; budget changes, a third implementation round, runtime replacement and architectural expansion are not automatic.

Private evidence root: `dist/validation/typescript-migration/ts-03/perf-opt-*`. Sanitized results will identify measured and merged commits separately.

## Round 1 outcomes and round 2 priorities

Values are warm-bytecode three-round medians; budgets use this run's Python baseline.

| Metric | Original TS | Round 1 TS | Current budget | State |
| --- | ---: | ---: | ---: | --- |
| `in-process/large/transcript/cold` peak_rss (MiB) | 848.98 | 445.04 | 519.81 | pass |
| `in-process/large/transcript/cold` p50 (ms) | 1361.33 | 900.68 | 1843.23 | pass |
| `in-process/medium/transcript/cold` peak_rss (MiB) | 326.38 | 265.99 | 100.96 | fail |
| `in-process/large/transcript/warm` p50 (ms) | 139.13 | 124.29 | 59.54 | fail |
| `command/large/render-composite` p50 (ms) | 275.06 | 288.16 | 148.83 | fail |
| `command/large/render-composite` p95 (ms) | 294.13 | 346.67 | 170.16 | fail |
| `command/hook` p50 (ms) | 77.72 | 77.22 | 54.93 | fail |

No previously passing metric became a failure, but formerly inconclusive metrics include new failures; the total pass count does not hide them. The large complete-command latency regression is also retained explicitly. Round 2 prioritizes native parsing of ordinary large cache dictionaries, medium cold-read allocation, hook dependencies/native bindings and repeated agent layout work. Budgets are unchanged; this failed graph is not eligible for a noise repeat.


## Round 2: reduce repeated initialization and rendering work

Branch `fbincon/ts-03-performance-round-2`, measured commit `93384f573ddb02b4067947493b6d89a64b276341`, [PR #85](https://github.com/fbincon/claude-code-statusline/pull/85). Large ordinary `ids` subtrees use native JSON parsing independently. Numeric guards recognize valid token starts instead of misclassifying IDs such as `agent-0-…` as negative zero. Exact integers, float kinds, duplicate/escaped/numeric keys and malformed syntax retain the exact path. Safe integer aggregates flush their original operands to BigInt before overflow.

Lightweight directory helpers are separate from configuration management. Native modules, structure types and function bindings initialize on demand; successful bindings are reused, while observations and failures are not cached. Hooks load agent duration handling only for SubagentStart/Stop and capture the original observation time before asynchronous import. Git cache hits use the exact fast parser while preserving version, cwd, 500 ms TTL and value validation. Each agent render prepares formats, configuration indexes, palette and at most 1,024 complete-string widths, evaluates only enabled components and retains no cross-request configuration/text cache.

Local checks: **556/557 TS tests pass, one platform skip**; all 161 frozen cases, the 516-ID audit, Python **847/856 (nine skips)**, Mods **112/10**, both typechecks/strict validators, 34 resources and five read-only generators pass. New tests cover large JSON subtrees, integer overflow, 0/8/32 agents and configuration changes between renders. All **43 source-head PR jobs passed**; eight digest-verified receipts match 298 source hashes, pinned runtimes and an identical tested merge tree. See [validation.optimization-02.json](validation.optimization-02.json). Final documentation-head CI, reviewed head, integration merge SHA and Gitee confirmation are recorded on PR #85, separately from the measured source commit.

## Formal results after both rounds

**Round 2 still FAILS: 104 pass, 60 fail, 28 inconclusive.** Each round includes 19,200 measured samples and 192 decisions, three alternating runs in each bytecode mode. Every output, collector count and pre/post source/fixture check matched. Both rounds contain failures; neither used the same-source noise repeat. The original `performance.03-f.json` is unchanged.

| Version | Measured commit | Pass | Fail | Inconclusive |
| --- | --- | ---: | ---: | ---: |
| Original 03-F | `1fddaa6` | 91 | 69 | 32 |
| Optimization round 1 | `8219155` | 97 | 64 | 31 |
| Optimization round 2 | `93384f5` | 104 | 60 | 28 |

The [complete round 2 summary](performance.optimization-02.json) and [all 192 before/after comparisons](performance.optimization-comparison.json) retain decisions, round values and budget gaps. The following values are warm-bytecode three-round medians. A negative median gap does not override an across-round inconclusive decision.

| Workload / metric | Original TS | Round 1 | Round 2 | Current budget | Remaining gap | State |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| `in-process/large/transcript/cold` peak_rss (MiB) | 848.98 | 445.04 | 436.88 | 520.12 | -83.24 (-16.0%) | pass |
| `in-process/large/transcript/cold` p50 (ms) | 1361.33 | 900.68 | 925.44 | 1776.89 | -851.46 (-47.9%) | pass |
| `in-process/medium/transcript/cold` peak_rss (MiB) | 326.38 | 265.99 | 262.51 | 100.91 | +161.60 (+160.1%) | fail |
| `in-process/medium/transcript/warm` peak_rss (MiB) | 190.02 | 152.82 | 130.91 | 100.82 | +30.09 (+29.8%) | fail |
| `in-process/large/transcript/warm` p50 (ms) | 139.13 | 124.29 | 114.80 | 57.90 | +56.90 (+98.3%) | fail |
| `command/large/render-composite` p50 (ms) | 275.06 | 288.16 | 247.53 | 144.04 | +103.49 (+71.8%) | fail |
| `command/large/render-composite` p95 (ms) | 294.13 | 346.67 | 258.79 | 159.49 | +99.30 (+62.3%) | fail |
| `command/large/render-composite` peak_rss (MiB) | 136.98 | 127.50 | 122.62 | 76.66 | +45.96 (+60.0%) | fail |
| `command/hook` p50 (ms) | 77.72 | 77.22 | 68.94 | 52.05 | +16.89 (+32.5%) | fail |
| `in-process/medium/git/hit` p50 (ms) | 0.33 | 0.29 | 0.15 | 0.17 | -0.02 (-11.5%) | inconclusive |
| `in-process/large/agents` p50 (ms) | 5.84 | 5.61 | 2.79 | 2.45 | +0.34 (+13.8%) | fail |
| `command/runtime-observe` p50 (ms) | 96.99 | 99.09 | 97.56 | 91.87 | +5.69 (+6.2%) | fail |

Large cold-read RSS falls from the original 848.98 to 436.88 MiB (about 48.5%). Large full-render p95 falls from round 1's 346.67 to 258.79 ms, reversing its earlier regression while remaining above budget. The 32-agent p50 falls from 5.61 to 2.79 ms, still above its 2.45 ms budget. These observed values do not replace the individual decisions.

## Regression review

Relative to round 1 there are no pass→fail changes, but **five pass→inconclusive and ten inconclusive→fail changes**, listed below. All ten new failures have lower TS median latency than round 1; corresponding Python baselines and across-round excess changed, so the failed decisions are retained. Relative to original 03-F, **warm `command/runtime-observe` p50 changes from pass to fail**: TS 96.99→97.56 ms, Python 91.11→83.51 ms, budget 100.23→91.87 ms, with all three current rounds exceeding budget.

| Workload | Mode | Metric | Round 1 → 2 | TS round 1 → 2 (ms) |
| --- | --- | --- | --- | ---: |
| `command/medium/render-composite` | warm | p95 | inconclusive → fail | 129.188 → 117.641 |
| `command/runtime-observe` | warm | p50 | inconclusive → fail | 99.090 → 97.557 |
| `in-process/small/transcript/cold` | warm | p50 | pass → inconclusive | 2.819 → 2.964 |
| `in-process/small/transcript/append` | warm | p50 | inconclusive → fail | 2.736 → 2.339 |
| `in-process/small/transcript/append` | warm | p95 | inconclusive → fail | 4.031 → 3.229 |
| `in-process/small/git/expired` | warm | p95 | inconclusive → fail | 10.742 → 8.317 |
| `in-process/medium/git/miss` | warm | p95 | pass → inconclusive | 23.671 → 16.264 |
| `in-process/large/git/expired` | warm | p50 | pass → inconclusive | 42.923 → 39.205 |
| `in-process/small/transcript/cold` | cold | p50 | pass → inconclusive | 3.072 → 2.802 |
| `in-process/small/transcript/cold` | cold | p95 | pass → inconclusive | 5.322 → 3.720 |
| `in-process/small/transcript/append` | cold | p95 | inconclusive → fail | 2.997 → 2.721 |
| `in-process/small/git/miss` | cold | p95 | inconclusive → fail | 8.414 → 8.155 |
| `in-process/small/git/expired` | cold | p50 | inconclusive → fail | 8.307 → 7.458 |
| `in-process/small/git/expired` | cold | p95 | inconclusive → fail | 9.160 → 8.297 |
| `in-process/medium/git/expired` | cold | p50 | inconclusive → fail | 14.072 → 13.575 |

Twenty-two of the 192 raw TS medians are higher than round 1; every increase is retained in the comparison JSON. Notable changes include small warm-mode cold-read p50 2.819→2.964 ms (+5.1%, now inconclusive), medium cold-read p50 +2.3%/+4.0% in warm/cold modes, and large cold-read p50 +2.7%/+2.9%; those medium/large latency metrics still pass. Cold-mode Unicode p50 0.0366→0.0411 ms (+12.4%) still passes, while its p95 remains failed. Aggregate pass counts are not the sole effectiveness criterion.

## Stop condition and focused review

Both approved implementation rounds and their full D06 measurements are complete; **TS-03 remains IN_PROGRESS**. Verified overall improvements can be integrated through the PR checks without claiming stage admission. Round 1's measured `8219155`, final evidence head `735ff9c` and integration merge `b8e1b296e47e1b3de2a50afc0c9bb8b2b506d357` were verified separately, including equal GitHub/Gitee main refs. PR #85 records final integration for round 2's measured `93384f5`.

Review the remaining work before authorizing a third implementation round:

1. **Caches and memory.** Medium cold-read RSS exceeds budget by about 161.60 MiB; large warm-read p50 by about 56.90 ms. CPU/heap profiles still point to JSON parsing, cache serialization, dictionary traversal and GC. Evaluate compact in-memory counters and serialization while retaining ID compaction, unknown fields and disk schemas; do not bypass publication, rescans or validation.
2. **Startup and hooks.** Hook p50 remains about 16.89 ms over budget. Warm empty-runtime controls show Node p50 30.90 ms and Python 16.91 ms; these are controls, not exemptions. Assess the remaining module graph and loading cost within the approved runtime.
3. **Agents, Unicode and Git.** The 32-agent p50 gap is about 0.34 ms; Unicode/grapheme layout remains a profile hotspot. Git misses and expiry still involve process startup, parsing, atomic writes and fsync. Preserve Unicode, locking, 500 ms TTL, collector counts and durability in any subsequent proposal.

The [diagnostic summary](diagnostics.optimization.json) retains CPU, sampled heap, GC, peak RSS, output/count evidence and raw-file digests for seven workloads. Sampled live allocations are not exact cumulative allocation volume; profiles include profiler/preparation overhead and never establish acceptance. Raw profiles, logs, build artifacts and both rounds' 38,400 samples remain under ignored `dist/validation/typescript-migration/ts-03/perf-opt-*` paths.

Budget changes, architectural changes, another runtime and a third implementation round require a separate review. TS-04, installation switching and release work remain outside this task; the [existing TS-04 handoff](TS04-HANDOFF.md) awaits all TS-03 gates.
