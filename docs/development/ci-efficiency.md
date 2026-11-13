# CI acceptance measurements

**English** | [简体中文](ci-efficiency.zh-CN.md)

> **Scope:** This page records one-time CI measurements for named versions and runs. They are historical observations; they do not define current thresholds or constitute reproduction commands. Current acceptance procedures are in [testing and acceptance](testing.md).

## Failure baseline

The old 55-minute installation timeout stopped otherwise valid Windows ARM/x64 Node appearance work after 4.64 seconds on #190 and 52.86 seconds on #198. Both logs contained 26 passing tests. The Windows ARM Node 22.0.0 rerun on #198 took 52m28s. A separate run on the final #198 head failed uploading the Intel Mac receipt after its product assertions had passed. That run's first attempt took 2h03m16s wall clock, with 1,389m13s of unweighted runner execution across 60 jobs. The longest queue was 99m20s. Repeating the Intel job and aggregate cost another 24m31s of runner time. [#190 timeout](https://github.com/fbincon/claude-code-statusline/actions/runs/41007969032/job/123908643050) · [#198 timeout rerun](https://github.com/fbincon/claude-code-statusline/actions/runs/41168202931/job/124463172951) · [#198 final-source attempts](https://github.com/fbincon/claude-code-statusline/actions/runs/41180416268)

## Installed language acceptance

Each runner alternated three original and three optimized measurements using the same v3.16.1 tarball, SHA-256 `71e714f72b436acf6b24b78461b314dea12c01dc9ee00a7033a5c393bf7f891c`. Each sample checked all 144 UI/output language pairs. The original execution started 879 candidate Node processes. The new execution started 231. Pair order, assertions and content digests matched across both drivers. The cold control in each UI row rotates the output language. Together the controls exercise all UI and output languages through CLI pipes. Times below are seconds. [Hosted comparison and raw artifacts](https://github.com/fbincon/claude-code-statusline/actions/runs/41262274958) · [Budget and language changes](https://github.com/fbincon/claude-code-statusline/pull/200)

| Runner and x64 Node | Original samples | Optimized samples | Median reduction | Artifact ID |
| --- | --- | --- | ---: | --- |
| Ubuntu 24.04, 24.21.0 | 124.64, 122.04, 120.86 | 38.84, 38.76, 36.90 | 68.2% | 13065399693 |
| macOS 15 Intel, 24.21.0 | 412.69, 301.69, 287.21 | 114.69, 110.84, 88.19 | 63.3% | 13066266349 |
| Windows 11 ARM, 24.21.0 | 817.71, 799.49, 798.97 | 243.53, 244.13, 246.61 | 69.5% | 13066224589 |
| Windows 11 ARM, 22.0.0 | 1038.46, 1000.83, 965.94 | 308.85, 308.04, 285.49 | 69.2% | 13067218164 |

The diagnostic consumed 155m15s of unweighted runner time including input preparation and both drivers. It took 68m30s wall clock. Observed job queues were 2–3 seconds.

## History and targeted reruns

On one Linux x64 machine with Node 24.21.0, both profiles used candidate SHA-256 `cecd4b540a09a0c316dc27562ae6c4e50baf7ff59b4e9c6b4ab5e0b773dc50b1`. Each host/profile has one sample. Times measure the historical transactions and exclude initial fixture installation. The accepted reader at `4cb8db1` checked each original record. [Reader deployment](https://github.com/fbincon/claude-code-statusline/pull/201) · [History and shard implementation](https://github.com/fbincon/claude-code-statusline/pull/202)

| Host | Full history | Short history |
| --- | ---: | ---: |
| Version fixture | 90.96 s | 13.47 s |
| Official Claude 2.1.310 | 165.09 s | 78.78 s |
| Official Claude 2.1.288, Native only | — | 40.40 s |

The seven hosted jobs below tested commit `7039eb8` and tarball SHA-256 `207aff4c6c0ca65e4423f03f0f37c7d243aafb694deec609186c2208041ae7c7`. The diagnostic took 26m54s wall clock and 135m24s unweighted runner time including its aggregate and preparation jobs. Queues ranged from two to seven seconds. [Seven original executions](https://github.com/fbincon/claude-code-statusline/actions/runs/41270059909/attempts/1)

| Physical job | Worker step | Whole job |
| --- | ---: | ---: |
| Windows ARM/x64 Node 22.0.0, language | 5m53s | 7m18s |
| Windows ARM/x64 Node 22.0.0, full history | 21m47s | 23m05s |
| Windows ARM/x64 Node 22.0.0, remaining installation and source tests | 19m20s | 20m46s |
| Ubuntu x64 installation, full history | 11m55s | 12m14s |
| Intel macOS installation, short history | 22m03s | 23m04s |
| Linux Claude 2.1.296, short history | 21m24s | 21m48s |
| Linux Claude 2.1.310, full history | 24m04s | 24m28s |

One native targeted rerun executed the Windows ARM language job for 6m57s and the dependent aggregate for 16s. It produced job `124746022304` and artifact `13069512605`. The six other execution records matched their original IDs, attempts, timestamps and digests. A separate read-back compared both immutable result archives. [Targeted rerun](https://github.com/fbincon/claude-code-statusline/actions/runs/41270059909/attempts/2)

## Worker input and artifact recovery

Stage three's original candidate ZIP was 41,887,915 bytes. Repacking its original tarball and verified worker manifest in a stored ZIP took 5,167,748 bytes, saving 36,720,167 bytes per ordinary worker (87.66%). Nine interleaved measurements on Linux x64 used fresh output directories and a warm filesystem cache. Median read and CRC-checked unpack time was 32.568 ms for the original and 3.163 ms for the light ZIP. Including startup, manifest verification and publishing the restored test inputs, the light path took 87.113 ms. The restored package passed the existing validator with 1,092 package files. These measurements exclude network time. [Original full artifact](https://github.com/fbincon/claude-code-statusline/actions/runs/41270059909/artifacts/13068638321)

The transfer Action installs its own integrity-locked SDK once on a runner. On Linux a single cold bootstrap took 4.586 s, using 28 MiB of npm cache and installing 187 MiB in the runner's temporary directory. A new temporary directory with warm npm tarballs took 1.424 s. Reusing the initialized directory took about 1 ms. Ordinary development and package builds use the repository's independent root lock.

On Windows 11 ARM image `20261025.196.1`, the SDK install hit its 90 s limit before the first artifact download. A diagnostic on image `20261026.197.1` used an ARM64 Action Worker running Node 24.22.1 and npm 11.19.0 from the x64 Node 24.21.0 setup. Installing the 266 locked packages took 94.903 s with an empty npm cache and 85.728 s with cached tarballs and a fresh installation directory. Reusing the completed directory took 1–2 ms. The SDK installation limit is 180 s for Windows ARM64 Action Workers and 90 s elsewhere. [Original timeout](https://github.com/fbincon/claude-code-statusline/actions/runs/41282500996/job/124778016949) · [Windows ARM diagnostic](https://github.com/fbincon/claude-code-statusline/actions/runs/41283455910/job/124779900376)

A hosted transfer at `b2f9af7` produced a 41,997,730-byte full ZIP (artifact `13070430658`) and a 5,225,964-byte worker ZIP (`13069489705`), a measured 87.56% reduction. On Linux, a simulated lost acknowledgment recovered the first accepted upload in 14.205 s. A simulated reset before committing the worker upload required two calls in 5.457 s. Windows read the full input in 16.002 s and recovered the light input in 1.433 s after an interrupted read. These timings include different bootstrap and recovery paths. Digest mismatch, HTTP 403 and ambiguous upload each failed on its first operation. A persistent 503 stopped at two attempts. The two jobs queued for two seconds each, ran for 169 runner-seconds in total and took 175 seconds wall clock. [Hosted probe](https://github.com/fbincon/claude-code-statusline/actions/runs/41273837453) · [Diagnostic receipt](https://github.com/fbincon/claude-code-statusline/actions/runs/41273837453/artifacts/13070182754)

The first Windows probe exposed a case-sensitive lookup of the runner's `Path` inside a Node Worker and stopped at SDK setup. After the fix, a separate local read of both hosted ZIPs verified their service SHA-256 digests and reproduced the worker manifest from the full candidate. The restored tarball `3c9ebd6dbcd3f4e92d9f9dfe0463bd4f7fe527cf2716642ab5e9bfdea6685373` passed offline installation, doctor, render, configuration read/write and uninstall-preservation checks. [Initial Windows setup failure](https://github.com/fbincon/claude-code-statusline/actions/runs/41273548069/job/124751285890) · [Transfer implementation](https://github.com/fbincon/claude-code-statusline/pull/203)

## Interpreting the measurements

Runner time sums executing jobs, including parallel jobs. Wall clock includes dependency waits and available capacity. A model-free diagnostic can establish worker coverage, recovery and timings. [PR #204](https://github.com/fbincon/claude-code-statusline/pull/204)'s [full run](https://github.com/fbincon/claude-code-statusline/actions/runs/41291221369) completed on 2026-11-01, 09:00:45–10:55:52Z, about 115 minutes wall clock, against the 70-minute target. Keep the six existing physical and host declaration gaps recorded for the original release. [Issue #96](https://github.com/fbincon/claude-code-statusline/issues/96)
