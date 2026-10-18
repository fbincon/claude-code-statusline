# First TypeScript preview: delivery evidence

**English** | [简体中文](preview-release.zh-CN.md)

Publication status: **v3.0.0-beta.1 delivered on 2026-10-18** through GitHub, Gitee and npm beta; public download and installation acceptance passed. TS-06 remains **IN_PROGRESS**; PERF-01 remains **NOT_STARTED**. [Decision and stable gates](README.md) · [Feedback tracker #96](https://github.com/fbincon/claude-code-statusline/issues/96).

## Immutable release identity

| Item | Value |
| --- | --- |
| Version / npm selector | `v3.0.0-beta.1` / `@fbincon/claude-code-statusline@beta` |
| Source commit | `a6cfb6aadf2fcacbd5bf8f027665528cf6b6f29f` |
| Annotated tag object | `edd2fb90803aa15086ff42f090c7afa418217b80` |
| Reviewed implementation head | `f97c06ea5607a1b74b1f8f389ea58d343097e582`, [PR #97](https://github.com/fbincon/claude-code-statusline/pull/97); its tree equals the merge tree |
| Runtime / package manager | Node `24.21.0` / npm `11.19.0` |
| Locked build dependencies | TypeScript `5.9.3`, Koffi `3.3.3`, lossless-json `4.3.1` |
| npm SHA-512 integrity | `sha512-d3ysd2J8ZTmMOlFUjGAwH7GmvuLyklTSSCw69rPWFlpWAtwalFaZiMH1teFSv92zAbSXsaTcsfDWmuMMJMw25Q==` |

Exactly four release attachments are required. SHA256SUMS lists the other three files; its own digest below is an additional recorded identity.

| Attachment | Bytes | SHA-256 |
| --- | ---: | --- |
| `fbincon-claude-code-statusline-3.0.0-beta.1.tgz` | 3322997 | `3c2f350c976b669894b7a86aba2383c04489e5b1e2215631a5d74f23540aecb7` |
| `claude-code-statusline-3.0.0-beta.1-source.tar.gz` | 16573393 | `b875f415841fae13b29f105d8e4e68b5aeeccb1be521350e1c391e24e3bb416f` |
| `build-manifest.json` | 974 | `5d0c42d32790a0782f33e18118dab6174c84252366c559e7296372030c51280d` |
| `SHA256SUMS` | 316 | `71d0157d94f1da983be2f1c1afabf43d0468119b67ff12124432f44c02b681a7` |

The release package contains 645 files and bundled native dependencies for Linux x64, Windows x64, macOS x64 and macOS ARM64. Internal workspaces remain private. Display schema 8, editor protocol 11, runtime protocol 2 with v1 compatibility, and task schema 4 are unchanged.

## Build and automated acceptance

| Evidence | Result |
| --- | --- |
| [PR head CI](https://github.com/fbincon/claude-code-statusline/actions/runs/39091472751) | 23/23 jobs succeeded at the reviewed head |
| [Merge CI](https://github.com/fbincon/claude-code-statusline/actions/runs/39092199540) | 23/23 jobs succeeded at the release source |
| [Tag CI](https://github.com/fbincon/claude-code-statusline/actions/runs/39092942344) | 23/23 jobs succeeded at the same release source |
| Independent builds | Each CI build produces two byte-identical packages; main/tag attachments match all four digests above |
| Receipt aggregation | Eight installation targets and thirteen fixed Claude host combinations per run; exact source and artifact digest checked; `preview_ready=true`, `stable_ready=false` |
| Downloaded GitHub draft | All four files match; `release:verify` and ten isolated installed checks pass against the final artifact |

The eight installation targets are ubuntu-24.04 x64; windows-2025 x64; windows-11-arm with emulated x64 Node; macos-14/15/26 ARM64; and macos-15-intel/26-intel x64. The thirteen host combinations use Linux Claude 2.1.287/2.1.288/2.1.289/2.1.294/2.1.296 and Windows/macOS Claude 2.1.288/2.1.289/2.1.294/2.1.296. Windows 10 and macOS 14 Intel are not represented by those runners.

Installed checks cover empty-cache offline installation with lifecycle scripts disabled, paths containing spaces/Unicode/shell metacharacters, rendering, relocation rejection, platform launchers, native/editor binding, explicit interruption recovery, preserved preferences and Python-compatible configuration. Full checks include wrong version/commit/digest, absent evidence, incomplete attachments and bounded release-identity comparison rejection tests. Generated resources, documentation links, responsibility ledgers and the frozen Python archive are checked. Official Mod tests do not call paid models.

Local checks used **Ubuntu 26.04.1 LTS x64**, Node 24.21.0/npm 11.19.0. `npm run check` reported 940 tests: 937 passed and three Windows-only skips; local skips are not counted as Windows acceptance. The draft package's ten installed checks passed on that local OS. The separate CI receipts above supply each runner's evidence. One earlier local receipt was mislabeled as Ubuntu 24.04 by a target override; its preserved adjacent correction excludes it from Ubuntu 24.04 claims. The final draft receipt uses `local-ubuntu-26.04-x64`.

The reviewed PR package was also rebuilt from its source archive without Git history, matching SHA-256 `a8ddd0083130b974e11c6633b2ee1c55e198063cac3339a2a1109781c764f453`. That digest belongs to the PR source, not the final merge artifact, because source identity is embedded in the package.

## Python transition and evidence limits

An isolated Python 3.14.4 environment installed the actual published v2.0.0 wheel, SHA-256 `a6e35b5d1154738834497a098369722819cf3fe9292e290024fa0b16602bdaed`. The reviewed PR package then completed dry-run, upgrade, uninstall and reinstall of the retained Python command. Saved opt-outs, unrelated settings, original command binding and rendering were preserved. This used the PR source/package above, whose tree equals the final merge tree; it is not relabeled as a final-artifact run. The one-off harness SHA-256 was `1bae464af9ec64b0ad2588972fd0c0b00315156bf9da5cc2e576dd70a5dddbe9`. [User transition and rollback procedure](../../../PREVIEW.md).

No existing personal Python installation was switched. No paid model call, automatic suspend/reboot or new human desktop/power acceptance was performed. Local logs, source hashes, raw receipts and scripts remain under ignored `dist/validation/typescript-migration/ts-06/`; committed records contain no private transcripts or machine paths.

Claude 2.1.296 exact declarations remain unavailable for both Mods; the six platform/Mod gaps are recorded separately from passing official Mod tests and 2.1.294 type checks. A local recheck against host SHA-256 `24972e3bc859fab2b46ed4c1e51f7d6130f06d3bd550811a114640de3370d0de` confirmed the same limitation without paid calls.

D06 remains **FAIL: 104 pass / 60 fail / 28 inconclusive**. Physical macOS sleep/resume, macOS 14 Intel, Windows 10 desktop, WSL desktop/popup and other applicable human/power gaps remain unverified stable gates. Preview publication does not close TS-06. Functional regressions remain blocking; any published-byte fix requires a new beta version.

## Public-channel acceptance

The npm registry accepted the upload asynchronously, then reported the exact version as published. A fresh anonymous download matches the final package byte for byte. `beta` resolves to `3.0.0-beta.1`. The registry also created a `0.0.0-stage` stub and initially assigned `latest` to the preview; removing `latest` returned HTTP 400, so it was redirected to that existing registry stub. No package bytes were republished. The stub is not a usable product; installation must specify `@beta` or the exact version until a real npm stable version is released.

Local public GitHub/npm verification passed on Ubuntu 26.04.1 x64: all four GitHub attachments match, npm bytes/integrity match, and both exact-version and beta installations pass with empty caches and lifecycle scripts disabled. All four anonymous Gitee downloads also match the table above; the downloaded Gitee tgz passed bundle verification and isolated, empty-cache offline installation, version/config/render smoke with scripts disabled.

The [initial three-OS download run](https://github.com/fbincon/claude-code-statusline/actions/runs/39094514522) failed because the verification script passed unsupported `--config-dir` arguments to `config show`. The corrected verifier uses its already-isolated `CLAUDE_CONFIG_DIR` environment. This changes the verification harness, not the published package. Manual verification now records the verifier commit separately from the immutable release commit and checks out the selected workflow commit while resolving the exact release tag. Historical failed receipts are retained. The [corrected three-OS run](https://github.com/fbincon/claude-code-statusline/actions/runs/39094840584) passed all three jobs: ubuntu-24.04 x64, windows-2025 x64 and macos-15 ARM64, each using Node 24.21.0 and both selectors. All three downloaded receipts bind release commit `a6cfb6aadf2fcacbd5bf8f027665528cf6b6f29f`, verifier commit `02fc7807d50be96956256c5261c4702ce6e9ae3d` and the final tarball digest.

| Public channel | Delivered identity and acceptance |
| --- | --- |
| [GitHub prerelease](https://github.com/fbincon/claude-code-statusline/releases/tag/v3.0.0-beta.1) | Release `416206854`, published `2026-10-18T03:41:34Z`; four byte-matched attachments; Python v2.0.0 retains Latest |
| [Gitee prerelease](https://gitee.com/fbincon/claude-code-statusline/releases/tag/v3.0.0-beta.1) | Release `1214744`; same source/tag, four byte-matched delivery attachments, translated installation notes and primary GitHub feedback links; the platform's additional automatic source archives are not the delivered rebuildable source package |
| [npm preview](https://www.npmjs.com/package/@fbincon/claude-code-statusline/v/3.0.0-beta.1) | Published `2026-10-18T03:33:36.416Z`; `beta=3.0.0-beta.1`, `latest=0.0.0-stage`; identical tgz SHA-256 and SHA-512 integrity |

The evidence follow-up changes documentation and the public-download verifier only. It does not move the release tag or replace published files. Gitee main synchronization follows verified GitHub PR/main checks. Stable delivery remains a separate task after the outstanding physical/desktop evidence and blocking feedback are addressed.
