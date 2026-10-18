# TS-06 preview delivery and stable acceptance

**English** | [简体中文](README.zh-CN.md)

Status: **IN_PROGRESS**. **v3.0.0-beta.1 is published and download-verified** on GitHub, Gitee and npm beta. [Release identity, checksums and CI evidence](preview-release.md). Stable delivery remains pending the gates below. [Preview guide](../../../PREVIEW.md) · [Feedback and platform tracker](https://github.com/fbincon/claude-code-statusline/issues/96).

## Approved preview amendment, 2026-10-18

The maintainer approved a public preview to obtain unavailable macOS/Windows and other target feedback. This supersedes the earlier requirement to complete every physical/desktop check before *any* TS release. Those checks remain mandatory for stable delivery and are not passed by deferral. The supported target boundaries are unchanged. Current task delivery is the first preview; TS-06 remains in progress afterward. PERF-01 stays NOT_STARTED.

The selected package is `@fbincon/claude-code-statusline`, version `3.0.0-beta.1`, published with npm dist-tag `beta`; GitHub/Gitee use `v3.0.0-beta.1` and prerelease status. Python v2.0.0 remains the latest stable release and the rollback target. No PyPI upload occurs. Unlike historical Python previews, TS previews default both compatible editors on, preserving explicit disablement. Advanced live metrics remain opt-in.

| Gate | Preview | Stable |
| --- | --- | --- |
| Fixed-source independent builds and matching bytes | Required | Required |
| Eight installed targets / thirteen fixed hosts | Required on final head, merge and tag | Required on final product |
| Downloaded GitHub/Gitee/npm identity and installed smoke | Required | Required |
| Physical macOS sleep/resume | Unverified; collect feedback | Required |
| macOS 14 Intel physical desktop/power | Unverified | Required |
| Windows 10 desktop, focus, editors and recovery | Unverified | Required |
| WSL desktop launch/focus and popup | Unverified | Required |
| Other target-specific power/human visual checks | Preserve exact historical scope; new gaps unverified | Required where applicable |
| Claude 2.1.296 exact declarations | Unavailable; recheck, retain official Mod tests and 2.1.294 typecheck | Recheck exact selected host |
| Functional timeouts, event loss, writes and recovery | Blocking | Blocking |
| D06 performance budgets | Historical FAIL disclosed | Not blocking; PERF-01 afterward |

D06 remains **104 pass / 60 fail / 28 inconclusive**. No new human/power observations are inferred from CI. Historical Linux and other records retain their original source/runtime identities.

## Engineering and evidence

A single application version source drives CLI, protocol identities, defaults and generated Mod manifests. Internal workspaces remain private. Engineering candidate mode retains its separate package identity; public mode emits exactly the package tgz, source tar.gz, build manifest and SHA256SUMS. Normal build/test/release verification needs no Python or compiler. The frozen Python archive remains independent.

The 161-case comparison retains the three existing hash-bound CLI wording differences. TS-06 additionally allows only current release identity at twelve explicit paths: CLI version stdout; UI read/describe and transaction read/save/reopen backend_version; six runtime stdout records with exactly one backend_version replacement. Other bytes, fields, numeric kinds and persisted state still compare exactly. Runtime action-trace comparisons change only the top-level protocol backend_version from the historical value to the current version; oracle files/hashes are untouched.

Power and terminal collectors optionally require `--artifact`, `--commit` and `--installed-root` together. They verify the complete bundle, matching collector source and installed bytes, then record the exact artifact alongside observations. They never initiate power events. Terminal primitive evidence remains distinct from actual editor acceptance.

Local raw logs, assets and screenshots stay under ignored validation directories. Public summaries record OS/architecture, Node/npm/Claude/terminal, source SHA, artifact SHA-256, commands, counts, skips and actual CI URLs. Do not include private transcripts or machine paths in committed summaries.

## Delivery sequence

1. Review and merge preparation through GitHub; require final-head and merge CI.
2. Build from the immutable merge SHA, require tag CI and `release:prepare --preview` receipts from the same bytes.
3. Create/download/verify a GitHub prerelease draft with all four assets.
4. Complete official npm login/2FA as fbincon; publish that tgz with `--access public --tag beta --ignore-scripts`.
5. Publish GitHub without Latest, synchronize validated main/tag and identical assets to Gitee, verify prerelease status and downloads.
6. Require the three-OS public-download workflow, including exact-version and beta npm installations, then record release evidence through a follow-up PR.

A partial channel failure is not completed delivery. Inspect remote state before retrying; already-public bytes and versions are immutable. Fixes use the next beta version. Stable delivery requires resolving blocking feedback and collecting applicable missing acceptance on the final artifact. No automatic schedule or paid model call is introduced.
