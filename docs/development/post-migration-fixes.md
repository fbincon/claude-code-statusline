# Post-migration repairs and delivery

**English** | [简体中文](post-migration-fixes.zh-CN.md)

Updated: **2026-10-19** (Asia/Shanghai). Target: **v3.1.3**. Baseline: `1fa57c9ebfbb6ee76a1258939c3211145d55f719`. The [review](post-migration-review.md) retains the original triggers, priorities and frozen Python references. Implementation is complete; final-source CI and public delivery are pending.

## Repair coverage

| Findings | Implementation and regression evidence |
| --- | --- |
| R01 | Private bridge reads use bigint identities and the existing Windows native volume/file-index checks. Installed Windows save/cancel now supplies request, nonce and result environment and reads the actual started/result files. Replacement and reparse rejection remain required. |
| R02, R06 | Shared entry recognition relates the shipped npm bootstrap/shims to its own absolute internal backend; it never runs PATH programs to establish ownership. PATH-selected current installations work; foreign absolute bindings remain foreign. |
| R03 | Doctor validates full skill bytes, host options and current-user runtime writes. Private probes are removed. Existing translated diagnostics are reused in all six languages. |
| R04, R05 | Invalid prompt types remain unavailable through rendering, while absent IDs retain current-task selection. Both language-option forms preserve successful version queries and clean stderr. |
| B01, B02 | Wait boundaries use fresh boot samples; missing turn-start provenance cannot become complete zero execution. Tests retain independent total/native time, persistence, reload and rendering. |
| B03, B04 | File identities reset cursors after replacement. Exact disk identities survive hot-window compaction and restarts; replayed IDs count only per-field increases. |
| B05 | Backup ancestors are checked before mkdir/chmod/snapshot writes; preexisting links cause rejection without external snapshots. |
| D01–D05 | Current schema/protocol, filtered reordering, Node development/acceptance, raw TTY troubleshooting and doctor coverage are aligned in both languages. Historical version-specific procedures remain historical. |

## Exact usage cache and compatibility

`statusline_usage_v2/state.json` is separate from the legacy `statusline_state.json`. Legacy files are read without rewriting. Retained exact IDs migrate; positive compacted legacy bases have irrecoverable identity gaps and remain marked `usage_incomplete`, so the collector returns unavailable rather than certifying a guessed total. Starting a new session establishes a complete new ledger; restoring or deleting old cache files is not required for installation.

Each retained session has content-addressed hash-trie pages with at most 5,000 identities each. Pages retain message IDs and exact integer counter maxima; the hot cache remains bounded at 5,000 IDs, with 100 retained sessions. Disk usage grows with retained message history and is reclaimed when sessions leave the cache. No Bloom filter or additional runtime dependency is used.

Pages and their manifest are immutable. The atomic cache commit publishes the manifest reference, aggregate counters and byte cursors together under the existing cache lock. Failed cache commits leave unreachable pages, and retry starts from the previous committed cursor. Cleanup follows successful publication. Unchanged transcripts require no additional identity-page reads; repeated display items still share one collection.

Public display schema 8, configuration protocol 12, runtime protocol 2 and lifecycle schema 4 remain independent. Internal `start_observed` provenance treats absent historical evidence as unknown without rewriting frozen total task duration. The frozen Python oracle is unchanged; its fully observed trace asserts the new provenance before omitting only that internal field for historical shape comparison.

## Validation and release gates

Local development validation passed 1,000 tests: 996 passed and four native-platform skips; generated resources, bilingual docs, archive integrity and all three responsibility ledgers pass. The final source matrices and delivery receipts below are still required.

Required: local `npm run check`, final PR-head/main/tag CI, eight installed targets, 32 Node runtime cases and thirteen official hosts. The installed Windows bridge must pass on Node 24.0.0 as well as the other selected runtimes. Linux injection and PTYs do not establish Windows desktop or human acceptance.

The [v3.1.3 decision](../releases/approvals/v3.1.3.json) accepts only the same six existing gaps. New functional failures remain blocking. TS-01–TS-06 remain DONE, D06 remains FAIL and PERF-01 remains NOT_STARTED. No paid model calls or personal installation cutover is part of this task.

Delivery follows [the release procedure](../RELEASING.md): identical independent builds/source rebuild, verified draft assets, OIDC npm publication, GitHub stable/Latest and explicit non-force Gitee synchronization. Final source identities, CI links, artifact hashes and download evidence will be recorded here after validation. Pure documentation receipts cannot substitute for release matrices.
