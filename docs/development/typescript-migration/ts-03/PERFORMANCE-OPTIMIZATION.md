# TS-03 performance optimization

**English** | [简体中文](PERFORMANCE-OPTIMIZATION.zh-CN.md)

State: **IN_PROGRESS**. The maintainer approved at most two optimization rounds, each followed by functional validation and the complete unchanged D06 measurement. The original [03-F failure](PERFORMANCE.md) and [raw summary](performance.03-f.json) remain historical evidence. This work does not change TS-04 admission or switch the installed backend.

## Scope and reproducibility

Base: `f7cf0e1`. Branch: `fbincon/ts-03-performance`. Node 24.21.0, npm 11.19.0 and Python 3.14.4 are explicit; the default shell Node is not used. Python oracle: `9b6d2fab4bf165be280d428a874521bfbf02c7e1`. D06 policy, fixtures, 50 samples, three alternating rounds, separate bytecode modes, true peak RSS, output hashes and exact collection counts remain unchanged. Compile caching stays disabled.

Development profiles cover cold/warm/append transcript caches, composite render, hook, Git hits and 32-agent rendering. CPU/allocation/GC captures are diagnostic only. Baseline fixture validation passed all 32 workloads. A first diagnostic attempt could not extract the worker JSON after the heap profiler printed a final GC line; the corrected diagnostic retained the actual JSON record and both attempts remain private. No formal D06 attempt was made by that diagnostic.

## Round 1: staged streaming and cache allocation

The internal JSON reader uses native parsing for safely classified ordinary data and a one-pass exact reader for exceptional numeric kinds and ordered member names. It eliminates number placeholders and a second whole-tree restoration. Public strict parsing and Python diagnostics remain unchanged. Ordered dictionaries allocate insertion indexes only when numeric/symbol names require them, and accounting traversal avoids intermediate arrays. Cache serialization preserves exact Python layout and numeric spelling.

Transcript usage is reduced as complete byte lines arrive. Only counters, independent cost-field suffixes and compact lifecycle observations survive parsing. Read failure discards staged results before cursor/counter/task publication. Original lifecycle ordering, per-field snapshot deltas, ID compaction, one-time rescans, lock ordering and disk formats are retained.

New regressions cover exact integers around 2^53, malformed JSON diagnostics, late numeric/symbol dictionary keys, read failure after valid records and 72 randomized partial-snapshot/duplicate-message traces against the immutable Python implementation.

## Acceptance and next action

Round 1 full D06 measurement is pending. Local validation: **553/554 TS tests passed** (one Windows-only skip), all **161 fixed cases** matched with the same three CLI text exceptions, the **516-ID audit** passed, Python **847/856** passed (nine platform skips), and official Claude Code 2.1.294 Mod suites passed **112 native / 10 runtime**. Both Mod typechecks and strict validators, 34 generated resources, five retained read-only generators and documentation validation passed. The initial system-Python suite lacked its installed CLI entry (one failure, eleven skips); the existing Python 3.14.4 repository virtual environment passed the full suite. No source correction or test waiver was used for that environment issue. No diagnostic result is a performance pass. After Round 1, remaining failures select Round 2's startup/native-binding, Git-cache, rendering or residual cache work. At most two changed-source rounds are authorized. The existing same-graph noise repeat is permitted only when there are inconclusive metrics and no failures.

TS-03 stays IN_PROGRESS until all applicable functional checks and D06 pass. If Round 2 still fails or remains inconclusive, retain the stage state and deliver a focused review; budget changes, a third implementation round, runtime replacement and architectural expansion are not automatic.

Private evidence root: `dist/validation/typescript-migration/ts-03/perf-opt-*`. Sanitized results will identify measured and merged commits separately.
