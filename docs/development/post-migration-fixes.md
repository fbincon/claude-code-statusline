# Post-migration repairs and delivery

**English** | [简体中文](post-migration-fixes.zh-CN.md)

Updated: **2026-10-19** (Asia/Shanghai). Delivered: **v3.1.3**. Status: **DONE** under the version-specific maintainer decision. Baseline: `1fa57c9ebfbb6ee76a1258939c3211145d55f719`. The [review](post-migration-review.md) retains the original triggers, priorities and frozen Python references.

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

The primary repairs are in `de9bf27`; `77b7ae9` additionally requires fresh execution-start clock evidence, recognizes absolute npm bootstraps and isolates the Windows bridge collector from the installed native adapter. Documentation consolidation is in `f4af8d1`, with the version-scoped release identity in `2044540`. These changes merged through [PR #109](https://github.com/fbincon/claude-code-statusline/pull/109).

## Exact usage cache and compatibility

`statusline_usage_v2/state.json` is separate from the legacy `statusline_state.json`. Legacy files are read without rewriting. Retained exact IDs migrate; positive compacted legacy bases have irrecoverable identity gaps and remain marked `usage_incomplete`, so the collector returns unavailable rather than certifying a guessed total. Starting a new session establishes a complete new ledger; restoring or deleting old cache files is not required for installation.

Each retained session has content-addressed hash-trie pages with at most 5,000 identities each. Pages retain message IDs and exact integer counter maxima; the hot cache remains bounded at 5,000 IDs, with 100 retained sessions. Disk usage grows with retained message history and is reclaimed when sessions leave the cache. No Bloom filter or additional runtime dependency is used.

Pages and their manifest are immutable. The atomic cache commit publishes the manifest reference, aggregate counters and byte cursors together under the existing cache lock. Failed cache commits leave unreachable pages, and retry starts from the previous committed cursor. Cleanup follows successful publication. Unchanged transcripts require no additional identity-page reads; repeated display items still share one collection.

A functional stress check collected 100,000 distinct positive-usage messages, then replayed them after compaction and reload: the total remained 100,000. The hot window held 3,126 IDs and the exact index used 256 pages. This checks accounting and bounds; it does not replace D06 or PERF-01 measurements.

Public display schema 8, configuration protocol 12, runtime protocol 2 and lifecycle schema 4 remain independent. Internal `start_observed` provenance treats absent historical evidence as unknown without rewriting frozen total task duration. The frozen Python oracle is unchanged; its fully observed trace asserts the new provenance before omitting only that internal field for historical shape comparison.

## Validation and release gates

Local development validation passed 1,001 tests: 997 passed and four native-platform skips; generated resources, bilingual docs, archive integrity and all three responsibility ledgers pass. All three source-bound CI rounds below passed their full matrices. Runtime receipts use Node 22.0.0, 22.23.3, 24.0.0 and 24.22.0.

Required: local `npm run check`, final PR-head/main/tag CI, eight installed targets, 32 Node runtime cases and thirteen official hosts. The installed Windows bridge must pass on Node 24.0.0 as well as the other selected runtimes. Linux injection and PTYs do not establish Windows desktop or human acceptance.

The [v3.1.3 decision](../releases/approvals/v3.1.3.json) accepts only the same six existing gaps. Its SHA-256 is `7a43f5080f3fb32252b5ce1f225f719a7135112cc66d9619cb50939d608e5d13`; local stable readiness passes with the final tag's 53 installed/runtime/host receipts. New functional failures remain blocking. TS-01–TS-06 remain DONE, D06 remains FAIL and PERF-01 remains NOT_STARTED. No paid model calls or personal installation cutover is part of this task.

Delivery completed [the release procedure](../RELEASING.md): identical independent builds/source rebuild, verified draft assets, OIDC npm publication, GitHub stable/Latest and explicit non-force Gitee synchronization. Final source identities, CI links, artifact hashes and download evidence appear below. Pure documentation receipts cannot substitute for release matrices.

## Final-source identity and artifacts

The reviewed PR head is `77b7ae962ba9648234b719de5cbc6785cf71338d`. The release source is merge commit `05c5328d5d13488f3366ae6fdd30af4a55b3b22c`; annotated `v3.1.3` is tag object `d5e7cb5f22a78c2f45109c0adad5846b9e2193f8` at that commit. [Final-head CI](https://github.com/fbincon/claude-code-statusline/actions/runs/39193260622), [merge CI](https://github.com/fbincon/claude-code-statusline/actions/runs/39194981198) and [tag CI](https://github.com/fbincon/claude-code-statusline/actions/runs/39195509842) each passed all 56 required jobs, with only the documentation-only job skipped. Each includes eight installed targets, 32 runtime cases, thirteen hosts and the aggregate gate.

The final-tag Windows 2025 x64/Node 24.0.0 receipt confirms real request, started, result, save and cancel checks, all against the release-source package digest. This is installed Windows CI evidence; the separately disclosed desktop/human gaps remain unverified.

The superseded [initial PR run](https://github.com/fbincon/claude-code-statusline/actions/runs/39192772373) failed because the Windows collector parent loaded both workspace and installed Koffi adapters. The collector now uses its source adapter while the child exercises the installed bridge; the final-head run passed the actual request/started/result and save/cancel flow. The failed run is retained separately and is not accepted evidence.

Two clean builds and two independent rebuilds from the delivered source match all four delivery files byte for byte. The merge-CI and tag-CI candidate bundles, downloaded GitHub draft assets and OIDC dry-run bundle match the local bundle. The downloaded draft verifies all 673 package files and passes ten isolated offline installed checks. Build identity is Node 24.21.0/npm 11.19.0.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `fbincon-claude-code-statusline-3.1.3.tgz` | 3,458,440 | `fe0617ee8c82015cc179dc202c41e6c72403ca5688fba4ada105f5437e812ea0` |
| `claude-code-statusline-3.1.3-source.tar.gz` | 23,717,106 | `90ddbe59d39203345b68c8168091d704c642b26714f59d0d2e665962021d2751` |
| `build-manifest.json` | 952 | `a237053d1f7b7e978ea701e62b65855886e8c3a8a597b40b626ba545ecdb5b08` |
| `SHA256SUMS` | 302 | `02c2703ad8b247204c09f7ae78b990a83df215a7449f740440fc9329b624fe94` |

npm integrity: `sha512-0e94wUauEg/9nyF3ERTExxM26biKLwhnPtSsCf9iKNlN/E0KPsFncWH/Nc3FHFnABjiMwVF1v1c/d05/iLrOTA==`. SHA256SUMS lists the other three files; its own digest appears above.

## Installed terminal evidence

The final-source extended collector passed 168 installed page/state frames and 336 light/dark reconstructions across six languages, four pages and seven boundary sizes. It covers picker guidance, text-body/preview, detail/edit/search/category/numeric/review states, plus vt100/vt220/xterm-mono color suppression and the existing dumb-terminal rejection. Configuration bytes and terminal attributes are preserved; model calls are zero. Collector report SHA-256: `7fc46e41448d3c7b2b09e765eb94f6ee2fd11deb7c168bfa1716fc0be4e0af7f`.

These are Linux x64 terminal-cell reconstructions using fixed DejaVu Sans Mono and Noto Sans CJK fonts, not desktop screenshots or human acceptance. Sampled frames were inspected; missing emoji glyphs in those reconstruction fonts remain separate from code-point, grapheme and terminal-cell assertions. Raw streams, cells, images and receipts stay in ignored validation directories and are excluded from release attachments.

## Public delivery

| Channel | Verified result |
| --- | --- |
| [npm](https://www.npmjs.com/package/@fbincon/claude-code-statusline/v/3.1.3) | Metadata timestamp `2026-10-19T04:08:43.129Z`; latest=3.1.3, beta=3.0.0-beta.1; public SHA-256/SHA-512 match |
| [GitHub stable/Latest](https://github.com/fbincon/claude-code-statusline/releases/tag/v3.1.3) | Release 416878136, published `2026-10-19T04:09:50Z`; four matching attachments, non-draft and non-prerelease |
| [Gitee stable](https://gitee.com/fbincon/claude-code-statusline/releases/tag/v3.1.3) | Release 1217595, created `2026-10-19T12:10:10+08:00`; four anonymous downloads match byte for byte, all 673 package files verify and all ten offline installed checks pass |
| [Public-download CI](https://github.com/fbincon/claude-code-statusline/actions/runs/39198087057) | Six of six Linux x64/Windows x64/macOS ARM64 jobs pass on Node 22.23.3/24.22.0; each installs exact 3.1.3 and latest with fresh caches and lifecycle scripts disabled |

[OIDC dry-run](https://github.com/fbincon/claude-code-statusline/actions/runs/39197699186) passed before [live publication](https://github.com/fbincon/claude-code-statusline/actions/runs/39197845754). The actual publication receipt records `published`, the release source, tag CI and exact package digest. No publication retry was needed. Local public-download verification independently passes both selectors and compares all GitHub/npm delivery bytes.

Gitee's bilingual notes use actual attachment URLs and retain the original GitHub publication time. The metadata update included the original tag/name and stable flag; a fresh read confirmed the body, identity and attachment inventory.

GitHub remains primary. Gitee synchronization checked ancestry and used explicit non-force main/tag refspecs; its tag object and peeled source match GitHub. Gitee's automatic repository archives are separate from the four delivered attachments. The delivery-document follow-up does not move the public tag or replace assets. The six accepted physical/desktop/declaration gaps remain unverified/unavailable; D06 stays **FAIL** and PERF-01 stays **NOT_STARTED**.
