# TypeScript stable delivery evidence

**English** | [简体中文](stable-release.zh-CN.md)

Publication status: **v3.0.0 delivered on 2026-10-18** through npm `latest`, GitHub stable/Latest and Gitee stable. Public downloads and installations passed. **TS-06 is DONE under the version-limited maintainer decision; PERF-01 remains NOT_STARTED.** [Release notes](../../../releases/v3.0.0.md) · [Decision and gates](README.md#stable-decision-2026-10-18) · [Platform feedback #96](https://github.com/fbincon/claude-code-statusline/issues/96).

## Immutable release identity

| Item | Value |
| --- | --- |
| Version / npm selectors | `v3.0.0` / `@fbincon/claude-code-statusline@3.0.0` and `@latest` |
| Source / merge commit | `d3c87090fed4005f9d1ec8d84d3b016e0cdd4774` |
| Annotated tag object | `f457695f4d4956220b7397b991ee92cc8b0cf7a2` |
| Reviewed head | `a89aae54d81bc2a1f7f504b514a8df16b1e43444`, [PR #99](https://github.com/fbincon/claude-code-statusline/pull/99); reviewed and merge trees match |
| Runtime / package manager | Node `24.21.0` / npm `11.19.0` |
| Locked build dependencies | TypeScript `5.9.3`, Koffi `3.3.3`, lossless-json `4.3.1` |
| npm SHA-512 integrity | `sha512-7fsWbwmKLoum5IoLZf8fhbs2CWxYp+cl47uR+iz/bPEuRptDThFBpkxZp18WD3DLVbaIg63DQt6u7Hz2Bkh90g==` |
| Source-archived approval | [stable-approval.json](stable-approval.json), SHA-256 `9b9cbb38e8a9cfff54928b9c45275d084b2ae3ba924ca1c54a8de10f34034db2` |

Exactly four delivery attachments are published. SHA256SUMS lists the other three; its own digest is recorded separately below.

| Attachment | Bytes | SHA-256 |
| --- | ---: | --- |
| `fbincon-claude-code-statusline-3.0.0.tgz` | 3327658 | `fa689dd448646a5fcbcc5fe7a66a60879646d71321fcc17417a95dd9c6e81749` |
| `claude-code-statusline-3.0.0-source.tar.gz` | 17365853 | `215ae3b88e5689e2fda85e3af14739ebf75c02a0fa96996a87dba400c50b2872` |
| `build-manifest.json` | 952 | `3eca893298f8dd1b3a23891963eb02ef79920c80d8e180a9ecb675a9546ee318` |
| `SHA256SUMS` | 302 | `3564ff726327c0ca37be006ff0ab9c9c59cc761841f6c7b73b1031e0bc49ae62` |

The npm package contains 648 files, including native dependencies for Linux x64, Windows x64, macOS x64 and macOS ARM64. Internal workspaces remain private. Windows ARM uses x64 Node emulation. Display schema 8, editor protocol 11, runtime protocol 2 with v1 compatibility and task schema 4 remain compatible.

## Build and final-artifact acceptance

| Evidence | Result |
| --- | --- |
| [Final PR head CI](https://github.com/fbincon/claude-code-statusline/actions/runs/39105913003) | 23/23 jobs succeeded at the reviewed head |
| [Merge CI](https://github.com/fbincon/claude-code-statusline/actions/runs/39106933639) | 23/23 jobs succeeded at the release source |
| [Tag CI](https://github.com/fbincon/claude-code-statusline/actions/runs/39107697338) | 23/23 jobs succeeded at the same release source |
| Independent builds | Two clean builds are byte-identical; local, merge CI and tag CI match all four attachment digests |
| Source rebuild | Extracted the delivered source archive without Git history; both rebuilt rounds match all four delivered files |
| Formal readiness | Complete eight-installation/thirteen-host receipts bind one source and tgz digest; `stable_ready=true`, valid approval above, six unavailable exact-host Mod declaration results retained |
| Downloaded GitHub draft | All four files match; `release:verify --release` and ten isolated installed checks pass on the downloaded final package |
| Installed external TUI | Eight English/Chinese four-page PTY captures from the final tgz match the reviewed documentation images byte for byte |

The eight targets are ubuntu-24.04 x64, windows-2025 x64, windows-11-arm with emulated x64 Node, macos-14/15/26 ARM64 and macos-15-intel/26-intel x64. The thirteen fixed host combinations are Linux Claude 2.1.287/2.1.288/2.1.289/2.1.294/2.1.296 and Windows/macOS Claude 2.1.288/2.1.289/2.1.294/2.1.296. Windows 10 desktop and macOS 14 Intel desktop/power are outside those CI receipts.

Local engineering checks on **Ubuntu 26.04.1 LTS x64**, Node 24.21.0/npm 11.19.0 reported **944 tests: 941 passed, three Windows-only skips**. The complete responsibility ledgers, generated resources, documentation links and frozen Python archive checks passed. Final local and downloaded-draft packages each pass all ten isolated installed checks with empty npm cache, offline installation, disabled lifecycle scripts and execution outside the checkout. Runner-specific CI evidence supplies Windows/macOS results; local skips are not relabeled as platform passes.

Installation tests cover the no-preference defaults, reinstall, compatible old preferences, explicit and saved opt-ins/opt-outs, flag combinations, older hosts, disabled plugins, both editors, interruption/recovery, ownership, rendering and no-write reads. Native timing and advanced collection are off without saved preferences; explicit flags and saved preferences retain precedence. Basic hook/transcript task timing is retained. Five-language TUI tests cover frames, grouped lines, Unicode geometry, selection width and styling; existing interaction, resize, cancellation and terminal restoration checks remain passing. [Installed PTY gallery and exact capture provenance](../../../images/typescript/README.md) distinguish reconstructed terminal images from human desktop observations.

An initial local artifact build retry was necessary after an npm-registry TLS reset; the partial failed directory was excluded. A subsequent complete two-round build and the independent source rebuild passed and matched CI. Earlier fixture/acceptance assumptions about preview identity and old collection defaults were corrected before the reviewed final head; failed logs remain historical failures. No published beta bytes, source tag or reference-oracle files were changed.

## Public-channel acceptance

| Channel | Delivered identity and verification |
| --- | --- |
| [npm stable](https://www.npmjs.com/package/@fbincon/claude-code-statusline/v/3.0.0) | Published `2026-10-18T07:46:42.701Z`; `latest=3.0.0`, `beta=3.0.0-beta.1`; anonymous tgz and SHA-512 integrity match the table |
| [GitHub stable/Latest](https://github.com/fbincon/claude-code-statusline/releases/tag/v3.0.0) | Release `416306494`, published `2026-10-18T07:47:13Z`; `draft=false`, `prerelease=false`, Latest resolves to this tag; four identical attachments |
| [Gitee stable](https://gitee.com/fbincon/claude-code-statusline/releases/tag/v3.0.0) | Release `1215314`; same commit/annotated tag and four byte-identical downloaded attachments; Gitee installation links verified |
| [Three-OS public-download CI](https://github.com/fbincon/claude-code-statusline/actions/runs/39108976848) | 3/3 jobs passed: ubuntu-24.04 x64, windows-2025 x64, macos-15 ARM64; each installs exact `3.0.0` and `latest` with empty caches and scripts disabled |

Public-download receipts bind source `d3c87090fed4005f9d1ec8d84d3b016e0cdd4774`, verifier `d3c87090fed4005f9d1ec8d84d3b016e0cdd4774` and the final tgz digest. Local GitHub/npm verification also passes both selectors. All four anonymous Gitee downloads match; the Gitee tgz passes full bundle verification and isolated installation checks. Gitee's additional automatic repository archives are not the delivered rebuildable source attachment.

GitHub is primary. Validated main and explicit version-tag refspecs are synchronized to Gitee after divergence checks. This evidence follow-up changes documentation only; it does not move the release tag or replace published assets. The prior [beta.1 release identities](preview-release.md) remain intact, with `beta` unchanged. Python v2.0.0 remains available for rollback; no PyPI upload or personal installation switch occurred.

## Accepted gaps and stage closure

On 2026-10-18 the maintainer accepted the exact source-archived scope for **v3.0.0 only**: physical macOS sleep/resume; macOS 14 Intel desktop/power; Windows 10 desktop; WSL desktop/popup; remaining target-specific power/human visual checks; and unavailable Claude 2.1.296 exact declarations. These remain **unverified/unavailable**. Passing official Mod tests and available exact-host declarations do not supply the missing six declaration checks. Existing macOS Client click-before-typing limitations remain documented.

No new physical sleep/reboot or human desktop acceptance is inferred from CI or reconstructed PTY images. Failed functionality, saves, event delivery and restoration remain blocking. The valid version-limited approval plus the complete passing automated matrix and verified artifact identity establish the stable publication gate; this does not approve a later version or a failed/incomplete matrix.

All requested channels and public-download checks are complete, so **TS-06 is DONE** under that decision. **D06 remains FAIL: 104 pass / 60 fail / 28 inconclusive. PERF-01 remains NOT_STARTED** and requires a subsequent task. The source, runtime/dependency identities and attachment digests above are its reproducible baseline. Platform feedback stays on #96 without checking off missing observations. Private raw logs and temporary files remain in ignored validation directories.
