# PERF-01 — Post-migration performance work

**English** | [简体中文](perf-01.zh-CN.md)

Status: **DONE**. Closed: **2026-10-19**; established: **2026-10-15**; started: **2026-10-19** (Asia/Shanghai).
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

Next action: this bounded task is closed; retain these results and scope any further optimization separately.


## Retained implementation

Exactly two runtime implementation rounds were retained in [PR #111](https://github.com/fbincon/claude-code-statusline/pull/111):

1. [Startup round](https://github.com/fbincon/claude-code-statusline/commit/611ad6a9840ded4dc516a4b8ab54f844143476a7): read-only runtime preferences and schema validation avoid display/editor dependencies. Only bare `runtime` uses the fast dispatch; unexpected CLI failures load localization lazily. Input limits, protocol errors, configuration resolution and symlink behavior retain regression coverage.
2. [Index round](https://github.com/fbincon/claude-code-statusline/commit/a84f50092865156ec26bb0a39531aa7e221b9f48): stage the latest serialized immutable pages within the existing usage-cache lock, bounded to 32 MiB, and publish once per collection. Overflow flushes durable pages. Pages precede their manifest and the atomic main-state commit; cleanup follows successful commit. Disk formats, locks, integer counters and exact message identities are unchanged. Tests cover byte-identical final formats with immediate/buffered publication, overflow, restarts, replay, increment, read errors and page/manifest failure retries without advancing committed cursors.

The startup result applies only to `runtime` **without CLI flags**. The installed Mod explicitly passes `--config-dir` and retains the existing management-command route; this experiment does not establish a Mod end-to-end startup improvement. Index coalescing applies to normal usage collection. No third implementation round was attempted.

## Formal installed comparison, 2026-10-19

The fixed harness measured 36 workloads × 50 samples × two packages × three alternating rounds: **10,800 timed actions**. Every timed output matched its separate diagnostic; baseline/candidate output and usage/transcript/Git collector counts matched in every case. Installed inventories and harness hashes passed their final checks. Fixture transcript hashes, Git HEAD, tracked-file counts and expected dirty status were unchanged afterward. Setup, priming, instrumentation and full-cache restoration are excluded from action timing; they do not overlap the other side's timed action. The local machine did not run builds/tests concurrently with the formal measurement.

| Identity | Commit | npm archive SHA-256 |
| --- | --- | --- |
| Published baseline v3.1.3 | `05c5328d5d13488f3366ae6fdd30af4a55b3b22c` | `fe0617ee8c82015cc179dc202c41e6c72403ca5688fba4ada105f5437e812ea0` |
| Measured candidate v3.1.4 | `307d1a8baf076edd0eac7eb979f90e67de3ea68f` | `907dfd2d0de0edf509e5e983c00fcd9652234c195ad3fba2f3eea70ecea68ef2` |
| Release v3.1.4 | `e05149829492a8f24bcadaa335f973c9c396483a` | `ff3ba18f309b42b6bc54dce992e7530d17985ab79964c3b35cb8c49a22f673cd` |

Harness commit: `307d1a8baf076edd0eac7eb979f90e67de3ea68f`. The merge source tree is identical; all 678 product files in the measured and release packages match byte for byte. Only `candidate.json` source/provenance metadata differs. Build toolchain: Node 24.21.0, npm 11.19.0, TypeScript 5.9.3. Measurement host: Linux x64, kernel `7.0.0-38-generic`, Intel Core i5-13500H; Node executable SHA-256 `7fde7b8afa198da66257f42ee2001d874c7355631e6d1579a5fb5ef1f246df4c`.

The unchanged [fixture generator](../../../tools/migration/ts-03/performance/fixtures.ts) also supplies 100 rows per agent. The canonical sorted, compact JSON fixture manifest has SHA-256 `a483f236d0b3f2eaea781cdc039d4db6c75c6b36852210239a8e26401e73bac8`; this includes every agent transcript hash. The retained raw comparison has SHA-256 `65c543ac6ca5c08a8aacca0be69bd63456f8009895925ad2157df9e941b01307`.

| Profile | Main rows / agents / Git files | Git fixture commit | Main transcript SHA-256 |
| --- | ---: | --- | --- |
| small | 100 / 0 / 32 | `ebc1f898a08c64342730af0118276639366709c5` | `50b7fd01d1bf90b25f872c946a7352efa61d54cd673c4e01f32ceebeb71b7b71` |
| medium | 10000 / 8 / 1000 | `cfcfd309fe63517f25a2ea711fdfb455f2f9d342` | `15c134b9c5fbc08ab95ddfe90952537b4bbab6b6e0180fa386fd5d9fae234893` |
| large | 100000 / 32 / 10000 | `714581ea8b719dc4aef0e6de55b753ecd854e6aa` | `183a70d72228a56437d148a875f4b57b12d36f3671b81959bf9ea4faf7d243ab` |

Each table cell is the **median of the three round metrics**, not a pooled percentile: each round contributes its 50-sample P50, P95 or maximum child RSS. These are single-host descriptive results, not cross-platform performance guarantees or a D06 comparison.

| Workload | P50 ms, before → after | P95 ms, before → after | Peak RSS MiB, before → after |
| --- | ---: | ---: | ---: |
| `command/render-model` | 69.562 → 69.157 | 78.583 → 78.187 | 61.492 → 61.418 |
| `command/small/render-composite` | 91.493 → 91.681 | 100.781 → 97.541 | 67.340 → 67.434 |
| `command/small/render-subagents` | 69.656 → 68.694 | 78.267 → 76.353 | 61.582 → 61.715 |
| `command/medium/render-composite` | 96.226 → 96.724 | 102.574 → 104.464 | 68.566 → 68.688 |
| `command/medium/render-subagents` | 75.681 → 77.048 | 85.256 → 84.167 | 64.004 → 64.016 |
| `command/large/render-composite` | 95.681 → 95.467 | 106.973 → 105.561 | 69.164 → 69.332 |
| `command/large/render-subagents` | 80.834 → 80.511 | 88.478 → 88.250 | 64.453 → 64.176 |
| `command/hook` | 71.388 → 71.368 | 79.169 → 78.610 | 64.289 → 64.207 |
| `command/ui-preview` | 99.239 → 101.395 | 109.900 → 108.273 | 71.617 → 71.562 |
| `command/runtime-observe` | 105.534 → 87.381 | 117.138 → 91.622 | 72.734 → 65.957 |
| `in-process/small/transcript/cold` | 19.041 → 18.916 | 21.289 → 21.713 | 66.102 → 66.234 |
| `in-process/small/transcript/warm` | 7.490 → 7.503 | 7.764 → 7.985 | 65.320 → 65.199 |
| `in-process/small/transcript/append` | 19.414 → 19.860 | 21.361 → 21.000 | 66.238 → 66.219 |
| `in-process/small/git/miss` | 15.901 → 14.589 | 20.478 → 21.002 | 64.336 → 64.562 |
| `in-process/small/git/hit` | 6.129 → 6.114 | 6.316 → 6.331 | 64.141 → 64.277 |
| `in-process/small/git/expired` | 14.903 → 14.828 | 16.732 → 16.608 | 64.422 → 64.441 |
| `in-process/small/agents` | 0.130 → 0.130 | 0.138 → 0.141 | 63.672 → 63.469 |
| `in-process/medium/transcript/cold` | 961.207 → 638.229 | 1013.981 → 653.763 | 132.957 → 136.406 |
| `in-process/medium/transcript/warm` | 13.168 → 13.144 | 14.190 → 14.148 | 66.555 → 66.508 |
| `in-process/medium/transcript/append` | 34.587 → 35.008 | 39.429 → 39.933 | 70.676 → 70.711 |
| `in-process/medium/git/miss` | 20.409 → 21.112 | 30.356 → 30.907 | 64.574 → 64.473 |
| `in-process/medium/git/hit` | 6.145 → 6.143 | 6.399 → 6.309 | 64.355 → 64.367 |
| `in-process/medium/git/expired` | 22.203 → 18.545 | 26.579 → 27.631 | 64.527 → 64.539 |
| `in-process/medium/agents` | 6.991 → 6.989 | 7.873 → 8.711 | 65.750 → 66.090 |
| `in-process/large/transcript/cold` | 12942.434 → 6794.214 | 16736.656 → 6908.401 | 521.938 → 548.070 |
| `in-process/large/transcript/warm` | 14.774 → 14.774 | 16.157 → 16.622 | 66.801 → 66.781 |
| `in-process/large/transcript/append` | 36.647 → 37.167 | 39.247 → 41.239 | 71.273 → 71.203 |
| `in-process/large/git/miss` | 44.800 → 48.883 | 61.031 → 60.917 | 64.520 → 64.516 |
| `in-process/large/git/hit` | 6.118 → 6.143 | 6.273 → 6.338 | 64.270 → 64.336 |
| `in-process/large/git/expired` | 47.553 → 45.194 | 61.240 → 61.562 | 64.570 → 64.445 |
| `in-process/large/agents` | 11.075 → 11.111 | 13.635 → 13.570 | 69.598 → 69.504 |
| `in-process/unicode-composition` | 2.445 → 2.442 | 2.516 → 2.551 | 63.574 → 63.805 |
| `in-process/medium/transcript/replay` | 29.438 → 29.820 | 31.122 → 32.575 | 70.809 → 70.629 |
| `in-process/medium/transcript/increment` | 34.448 → 35.185 | 42.011 → 37.604 | 70.582 → 70.859 |
| `in-process/large/transcript/replay` | 34.421 → 34.382 | 38.722 → 37.858 | 71.051 → 71.102 |
| `in-process/large/transcript/increment` | 35.915 → 36.551 | 38.925 → 39.287 | 71.004 → 71.156 |

### Benefit and cost review

Medium/large cold collection P50 fell 33.6%/47.5%. Instrumented index-file writes fell **153 → 17** and **2,930 → 257**; transcript reads stayed **19** and **67**, and usage calls stayed one. Durable publication and exact counting were retained. Bare runtime P50 fell 17.2%, about 18.2 ms; its applicability is limited as described above. Common render, hook and editor-preview commands show little consistent benefit.

Retaining the bounded index overlay has a measurable cost. Large cold peak RSS rose **521.938 → 548.070 MiB**, +26.133 MiB/+5.0%; 32 MiB bounds serialized staging, not total process RSS. Large append P50/P95 rose **36.647 → 37.167 ms / 39.247 → 41.239 ms** (+1.4%/+5.1%). Medium replay P50 rose **29.438 → 29.820 ms** (+1.3%); medium increment P50 rose **34.448 → 35.185 ms** (+2.1%) and RSS **70.582 → 70.859 MiB** (+0.4%). These six metric increases exceeded the full baseline-round range in every paired round under the harness's descriptive flag; they are retained costs, not dismissed as noise or passed performance budgets. The cold-collection benefit justifies this bounded tradeoff under the approved correctness-first experiment. Other worse, neutral and variable cells remain visible above; for example large Git-miss P50 is higher in the summary but does not meet that consistency flag.

No functional failure, timeout relaxation, skipped collection or reduced durability was accepted. These results do not assert universal memory/latency improvement, Python superiority, or a historical D06 pass.

<a id="delivery-v314"></a>

## Delivery v3.1.4

PERF-01 is **DONE** under the maintainer's 2026-10-19 bounded experiment. Stable v3.1.4 is delivered on all three channels. This closes the approved attempt and delivery; it does not change the historical D06 **FAIL: 104 pass / 60 fail / 28 inconclusive**.

Release source: `e05149829492a8f24bcadaa335f973c9c396483a`; annotated tag object: `c473f4bb0f06ad1b598c0503e095cffc30d59592`. Implementation [PR #111](https://github.com/fbincon/claude-code-statusline/pull/111) has final head `307d1a8baf076edd0eac7eb979f90e67de3ea68f`; the documentation follow-up uses `fbincon/perf-01-evidence`.

| Source-bound CI | Result |
| --- | --- |
| [Final PR head](https://github.com/fbincon/claude-code-statusline/actions/runs/39211727341) | 56 required jobs passed |
| [Merge/main](https://github.com/fbincon/claude-code-statusline/actions/runs/39213551892) | 56 required jobs passed |
| [Annotated tag, final attempt 2](https://github.com/fbincon/claude-code-statusline/actions/runs/39220269377/attempts/2) | 56 required jobs passed; the conditional docs-only job skipped |

Each complete matrix supplies **8 installed targets, 32 Node runtime cases and 13 fixed hosts**. Stable readiness passed from the exact tag package and all 53 receipts. Local development `npm run check` passed 1,015/1,019 tests with four native-platform skips; the subsequent portable-path correction passed its six targeted tests. Final source CI above includes that correction. Resource, archive/ledger and documentation checks passed.

The [first tag Windows job](https://github.com/fbincon/claude-code-statusline/actions/runs/39220269377/job/117954676878) failed because the existing hard-kill recovery child exceeded its 15-second bound. The same unchanged test passed in main CI in about 0.996 s. Its [targeted retry](https://github.com/fbincon/claude-code-statusline/actions/runs/39220269377/job/117961101153) passed in 1.754 s with the same source, original bound and complete assertions; the dependent aggregate gate then passed. Original logs and failed-attempt receipts remain retained separately. No timeout or functional-failure waiver was added.

Two clean independent builds and two rebuilds from the delivered source archive match all four files below byte for byte. Main/tag CI bundles, downloaded GitHub draft assets, the OIDC dry-run bundle and the actual publication bundle match them. The draft package verifies all 679 files and passes ten isolated offline installed checks. Extended six-language installed PTY acceptance passed **336 terminal-cell reconstructions and four monochrome checks**, with restored terminals and zero model calls. Representative captures were inspected by the agent; these are reconstructed cells, not OS screenshots or new human/font/platform acceptance.

| File | SHA-256 |
| --- | --- |
| `fbincon-claude-code-statusline-3.1.4.tgz` | `ff3ba18f309b42b6bc54dce992e7530d17985ab79964c3b35cb8c49a22f673cd` |
| `claude-code-statusline-3.1.4-source.tar.gz` | `2016debb13c285488b11acf4577844b093af379c65f5b2daeb2fbcf9ca12926c` |
| `build-manifest.json` | `fea0264c543f25b8acf5df75e31f6279807a4173b655ed81e5e531f42d61af1c` |
| `SHA256SUMS` | `d92380462727c2728730c529836bc6869d0726c26a065f8b4de00012ee99fbbf` |

| Public channel | Verified result |
| --- | --- |
| [npm v3.1.4](https://www.npmjs.com/package/@fbincon/claude-code-statusline/v/3.1.4) | [OIDC dry-run](https://github.com/fbincon/claude-code-statusline/actions/runs/39223388162) and [new-version publication](https://github.com/fbincon/claude-code-statusline/actions/runs/39223742547) passed; public SHA-256/SHA-512 bytes match; `latest=3.1.4`, `beta=3.0.0-beta.1` |
| [GitHub stable/Latest](https://github.com/fbincon/claude-code-statusline/releases/tag/v3.1.4) | Release 417047094, published `2026-10-19T08:39:27Z`, non-draft/non-prerelease; four matching public attachments |
| [Public downloads](https://github.com/fbincon/claude-code-statusline/actions/runs/39224323474) | All six Linux/Windows/macOS × Node 22/24 jobs passed, with twelve exact/latest installations; actual runtimes 22.23.3 and 24.22.0. Local Node 24.21.0 exact/latest installations also passed |
| [Gitee stable](https://gitee.com/fbincon/claude-code-statusline/releases/tag/v3.1.4) | Release 1218541, exact source and annotated tag synchronized without force; four anonymous HTTPS downloads match the table and ten offline installed checks pass. Notes use actual attachment URLs and preserve original GitHub publication time |

The [v3.1.4-only approval](../../releases/approvals/v3.1.4.json) retains exactly the same six unverified gaps: physical macOS sleep, macOS 14 Intel desktop power, Windows 10 desktop, WSL desktop popup, remaining target power/human visual checks, and Claude 2.1.296 exact declarations. None became a pass through this experiment. No paid model calls or personal installation cutover occurred. Pure Markdown closure uses necessary docs/whitespace checks and the docs-only CI path, not another release matrix.
