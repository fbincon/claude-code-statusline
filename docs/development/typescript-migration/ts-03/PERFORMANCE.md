# TS-03 D06 performance acceptance

**English** | [简体中文](PERFORMANCE.zh-CN.md)

> **Current applicability (2026-10-15 amendment):** this report preserves its measured results and then-current stage decisions. Statements below about IN_PROGRESS, TS-03 remediation or TS-04 admission are historical. The latest measurement remains FAIL (104/60/28), with unchanged data. Under the [D06 amendment](../ts-02/D06.md#applicability-amendment-2026-10-15), TS-03/03-F [close as DONE](README.md#closure-2026-10-15) on existing non-performance evidence. Further performance work belongs to [PERF-01](../../performance/perf-01.md) after TS-06 and does not block migration/release; this task starts no subsequent implementation.

**Result: FAIL. TS-03 remains IN_PROGRESS.** All 32 workloads produced matching outputs and collection counts, but the fixed performance gate failed: **91 pass, 69 fail, 32 inconclusive** across 192 latency/RSS dispositions. Warm Python bytecode: 38/43/15; cold bytecode: 53/26/17. No failed or noisy result is counted as a pass.

This page preserves the original 03-F measurement. Both subsequent optimization rounds are complete; round 2 is **104/60/28 (pass/fail/inconclusive)** and still fails. See the [optimization and per-metric regression report](PERFORMANCE-OPTIMIZATION.md).

## Reproducible evidence

Candidate: `1fddaa6ea1fef7f631e51641f15214cbddd7ec08` (clean). Immutable Python oracle: `9b6d2fab4bf165be280d428a874521bfbf02c7e1`. Node 24.21.0 and Python 3.14.4 ran on the same Linux x86-64 machine. The [complete machine-readable summary](performance.03-f.json) retains all 64 workload/mode comparisons, all 192 round summaries, runtime/policy/fixture hashes, output hashes and exact collector counts. The 424-entry source/compiled graph is identified by the measured commit and manifest digest. Raw samples remain under the ignored evidence path recorded in that summary; the raw report SHA-256 is `61525a2604ad709b4f2b8b953851f3b668ebf4053d5b291afe53b69538b7c985`.

The harness measures ten fresh-process commands and 22 in-process workloads, with 50 samples per side in each of three alternating rounds, for cold and warm Python bytecode separately: **19,200 measured samples**. Eight startup/native-load controls add 400 descriptive samples. Transcript profiles contain 100/10,000/100,000 rows, 0/8/32 agents and 32/1,000/10,000 Git files. Preparation is outside timing. Actual worker high-water RSS is used; child peaks are not summed. Output and collector checks passed for every sample; source and fixture hashes also passed the post-run check.

The existing [D06 policy](../ts-02/D06.md) was unchanged. Command P50/P95 budgets add the greater of 10%/15% or 5/10 ms; in-process floors are 0.1/0.2 ms. RSS adds 32 MiB. All three rounds must exceed the budget and the median increase must exceed baseline variation to fail; mixed/noisy excess is inconclusive. This run contains failures, so the same-graph noise repeat is not permitted. No repeat was used.

## Representative failures

Values below are three-round medians in the warm-bytecode mode; the complete summary also retains each round and cold-bytecode results.

| Workload | Metric | Python | TypeScript | Budget | State |
| --- | --- | ---: | ---: | ---: | --- |
| `command/large/render-composite` | p50 (ms) | 134.85 | 275.06 | 148.33 | fail |
| `command/large/render-composite` | p95 (ms) | 149.50 | 294.13 | 171.92 | fail |
| `command/large/render-composite` | peak_rss (MiB) | 44.78 | 136.98 | 76.78 | fail |
| `command/hook` | p50 (ms) | 47.85 | 77.72 | 52.85 | fail |
| `in-process/medium/transcript/cold` | peak_rss (MiB) | 68.88 | 326.38 | 100.88 | fail |
| `in-process/large/transcript/warm` | p50 (ms) | 53.29 | 139.13 | 58.62 | fail |

Even the minimal render P50 is inconclusive in warm mode because one round exceeded its budget; its median alone is not a pass. Medium cold-transcript latency passed while its memory failed. These are independent gates.

## Remaining work

Keep performance work in TS-03. Profile and reduce full-command startup/native loading, large-cache parsing/serialization and allocation, and warm transcript/render costs. Preserve lossless numeric semantics, immutable case outputs, disk formats and collector counts. After implementation changes, rerun the complete fixed-budget suite on a clean committed graph; retain this failed run as history. The later CLI help exit-code correction is outside the measured commit and has no new performance pass.

The six implementation/review batches do not by themselves close the stage. D06 must pass before TS-03 is marked DONE; installed-package and real-terminal acceptance still belong to TS-04/05. No version tag, Release or installed-binding switch is part of this record.
