# TS-06 preview delivery and stable acceptance

**English** | [简体中文](README.zh-CN.md)

Status: **DONE** under the version-limited decision below. **v3.0.0 is published and download-verified** on npm `latest`, GitHub stable/Latest and Gitee stable. [Stable identity, checksums and CI evidence](stable-release.md). The [beta.1 delivery record](preview-release.md), npm `beta` and its immutable artifacts are preserved. [User guide](../../../USER_GUIDE.md) · [Feedback and platform tracker](https://github.com/fbincon/claude-code-statusline/issues/96).

## Stable decision, 2026-10-18

The maintainer confirmed beta.1 acceptance, selected **accept known gaps for publication**, and approved the v3.0.0 implementation and stable release plan. This supersedes the prior mandatory physical/desktop gates for **v3.0.0 only**. The target support boundaries remain unchanged. Physical macOS sleep/resume, macOS 14 Intel desktop/power, Windows 10 desktop, WSL desktop/popup and remaining target-specific human/power checks remain **unverified**. Claude 2.1.296 exact declarations remain unavailable. No new human, power or typecheck pass is inferred.

The [machine-readable approval](stable-approval.json) is carried in the verified source archive; `release:prepare --stable` validates its version/scope and records its SHA-256 alongside source/artifact-bound passing automated evidence. It cannot approve another version, an incomplete matrix or a functional failure. D06 remains FAIL; PERF-01 remains NOT_STARTED. [Stable release evidence](stable-release.md) is updated as actual delivery completes.

v3.0.0 uses npm `latest`, GitHub stable/Latest and a stable Gitee Release. Both editors keep their existing defaults. Native timing and advanced collection default off without saved preferences; explicit flags and saved preferences retain precedence. No PyPI upload occurs. Python v2.0.0 remains a rollback target; beta.1 remains on `beta` with its immutable assets.

## Closure, 2026-10-18

[PR #99](https://github.com/fbincon/claude-code-statusline/pull/99) delivered the installation defaults, external TUI restoration and stable release support. Final-head, merge and tag CI each passed all 23 jobs. The fixed source `d3c87090fed4005f9d1ec8d84d3b016e0cdd4774` rebuilt identically from its source archive; downloaded draft, npm and Gitee bytes match. All three public-download jobs passed exact-version and `latest` installations. The [complete report](stable-release.md) records every attachment, source-archived approval and remaining unverified scope. TS-06 is DONE; PERF-01 remains NOT_STARTED and requires a subsequent task. #96 remains available for missing platform observations.

## Approved preview amendment, 2026-10-18

At the preview handoff, the maintainer approved a public preview to obtain unavailable macOS/Windows and other target feedback. This superseded the earlier requirement to complete every physical/desktop check before *any* TS release. Those checks were stable gates until the version-limited decision above; deferral never passed them. The supported target boundaries are unchanged. TS-06 remained in progress after that preview; the closure above records subsequent stable delivery. PERF-01 stays NOT_STARTED.

The selected preview package was `@fbincon/claude-code-statusline`, version `3.0.0-beta.1`, published with npm dist-tag `beta`; GitHub/Gitee use `v3.0.0-beta.1` and prerelease status. Python v2.0.0 was then the latest stable release and remains a rollback target. No PyPI upload occurred. Unlike historical Python previews, TS previews default both compatible editors on, preserving explicit disablement. Advanced live metrics remain opt-in.

| Gate | Preview | Stable |
| --- | --- | --- |
| Fixed-source independent builds and matching bytes | Required | Required |
| Eight installed targets / thirteen fixed hosts | Required on final head, merge and tag | Passed on final head, merge and tag |
| Downloaded GitHub/Gitee/npm identity and installed smoke | Required | Required |
| Physical macOS sleep/resume | Unverified; collect feedback | Unverified; accepted for v3.0.0 |
| macOS 14 Intel physical desktop/power | Unverified | Unverified; accepted for v3.0.0 |
| Windows 10 desktop, focus, editors and recovery | Unverified | Unverified; accepted for v3.0.0 |
| WSL desktop launch/focus and popup | Unverified | Unverified; accepted for v3.0.0 |
| Other target-specific power/human visual checks | Preserve exact historical scope; new gaps unverified | Unverified scope accepted for v3.0.0 |
| Claude 2.1.296 exact declarations | Unavailable; recheck, retain official Mod tests and 2.1.294 typecheck | Unavailable; accepted for v3.0.0 only, six gaps retained |
| Functional timeouts, event loss, writes and recovery | Blocking | Blocking |
| D06 performance budgets | Historical FAIL disclosed | Not blocking; PERF-01 afterward |

D06 remains **104 pass / 60 fail / 28 inconclusive**. No new human/power observations are inferred from CI. Historical Linux and other records retain their original source/runtime identities.

## Engineering and evidence

A single application version source drives CLI, protocol identities, defaults and generated Mod manifests. Internal workspaces remain private. Engineering candidate mode retains its separate package identity; public mode emits exactly the package tgz, source tar.gz, build manifest and SHA256SUMS. Normal build/test/release verification needs no Python or compiler. The frozen Python archive remains independent.

The 161-case comparison retains the three existing hash-bound CLI wording differences. TS-06 additionally allows only current release identity at twelve explicit paths: CLI version stdout; UI read/describe and transaction read/save/reopen backend_version; six runtime stdout records with exactly one backend_version replacement. Other bytes, fields, numeric kinds and persisted state still compare exactly. The approved v3.0.0 no-preference policy additionally changes only `runtime-null-prompt/value/0/stdout`: native timing/enabled become false, and the top-level and active-timer reasons report disabled. Its original stdout SHA-256 is pinned; all other bytes remain exact, with negative rejection tests. The oracle and original three wording exceptions are untouched. Runtime action-trace comparisons change only the top-level protocol backend_version from the historical value to the current version; oracle files/hashes are untouched.

Power and terminal collectors optionally require `--artifact`, `--commit` and `--installed-root` together. They verify the complete bundle, matching collector source and installed bytes, then record the exact artifact alongside observations. They never initiate power events. Terminal primitive evidence remains distinct from actual editor acceptance.

Local raw logs, assets and screenshots stay under ignored validation directories. Public summaries record OS/architecture, Node/npm/Claude/terminal, source SHA, artifact SHA-256, commands, counts, skips and actual CI URLs. Do not include private transcripts or machine paths in committed summaries.

## Historical preview delivery sequence

1. Review and merge preparation through GitHub; require final-head and merge CI.
2. Build from the immutable merge SHA, require tag CI and `release:prepare --preview` receipts from the same bytes.
3. Create/download/verify a GitHub prerelease draft with all four assets.
4. Complete official npm login/2FA as fbincon; publish that tgz with `--access public --tag beta --ignore-scripts`.
5. Publish GitHub without Latest, synchronize validated main/tag and identical assets to Gitee, verify prerelease status and downloads.
6. Require the three-OS public-download workflow, including exact-version and beta npm installations, then record release evidence through a follow-up PR.

A partial channel failure is not completed delivery. Inspect remote state before retrying; already-public bytes and versions are immutable. Fixes use the next beta version. Stable delivery follows the decision above and the current [release procedure](../../../RELEASING.md); automated and functional acceptance remains required on the final artifact. No automatic schedule or paid model call is introduced.
