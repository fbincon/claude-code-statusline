# Node runtime and regional language follow-up

**English** | [简体中文](node-regional-languages.zh-CN.md)

This post-migration work is **DONE**: v3.1.0 is delivered on npm, GitHub and Gitee. TS-01–TS-06 remain complete; their frozen fixtures, historical decisions and Python reference are retained. PERF-01 remains separate and not started.

## Runtime contract

The product accepts stable Node `^22.0.0 || ^24.0.0`. Development, resource generation and reproducible builds retain Node 24.21.0/npm 11.19.0. `packages/core/src/node-runtime.ts` is shared by package generation, verification, diagnostics and runtime receipt checks. No other Node series or additional OS/architecture is declared supported.

The original eight installed targets and thirteen hosts remain. An additional 32-case matrix tests each installed target with 22.0.0, latest 22.x, 24.0.0 and latest 24.x against the identical package. Each receipt records the source commit, package SHA-256, actual Node version/hash, product tests and isolated offline installation. Release readiness rejects missing, duplicate, wrong-runtime or failed evidence. Bootstrap with the fixed toolchain, then run `npm run test:runtime` under the selected Node without rebuilding. Module-import tracing uses asynchronous loader hooks with an explicit flush handshake, including on Node 22.0.0.

Windows Node 24.0.0/libuv 1.50 also reports a zero device ID in path stats while descriptor stats retain the actual volume serial; the [isolated Windows diagnostic](https://github.com/fbincon/claude-code-statusline/actions/runs/39117485659) reproduces this on both Windows targets. Recovery obtains the Windows volume and file index from a native no-follow handle, checks that the index still matches the preceding path snapshot, and compares that identity with the opened descriptor. BigInt IDs avoid rounding; Windows serials use 32 bits and POSIX device IDs retain all bits. Regular-file/reparse/permission guards remain, and regressions reject different files and path replacement. The native structure follows [Microsoft's documented layout](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/ns-fileapi-by_handle_file_information).

## Regional language contract

Selectors contain `en`, `zh-CN`, `zh-TW`, `zh-HK`, `ja`, `ko`, in that order. `zh-Hant` is an input-only compatibility alias for Taiwan. Reads normalize without rewriting; explicit saves and exports emit canonical codes. Unknown inputs remain invalid. Taiwan and Hong Kong have complete independent packs, regional terminology, shared generation, multilingual search and independent UI/output selection. [Translation conventions](i18n.md).

Editor protocol 12 rejects older frontends with a reinstall message. Display schema 8, UI preferences 1, portable envelope 1 and runtime protocol 2 retain their formats. Reinstallation refreshes matching resources and accepts the former owned protocol marker for upgrade. Before downgrading, reset both language settings to English using the newer version, or restore a compatible backup.

The frozen migration capture adapts historical protocol-11 requests in memory. Comparison permits only the known protocol fields, exact unsupported-version text and two language-choice lists to change; unrelated behavior and the three original CLI wording exemptions remain checked.

## Validation and delivery

Status: **DONE**, 2026-10-18. Generation/coverage checks, product/tool tests, eight installed targets, thirteen hosts and 32 runtime receipts passed. All 36 installed UI/output combinations passed. Tests cover regional search, legacy preferences and arguments, failed writes, portable imports, protocol mismatch, save/cancel/reopen, main and subagent output. Both editors were checked at minimum/common sizes and light/dark backgrounds. [Installed regional interfaces and capture scope](../images/typescript/regional/README.md).

The maintainer explicitly accepted the same six disclosed historical gaps for v3.1.0 in the [version-specific decision](../releases/approvals/v3.1.0.json). They remain unverified: physical macOS sleep; macOS 14 Intel desktop/power; Windows 10 desktop; WSL desktop/popup; remaining target-specific human/power checks; and Claude 2.1.296 exact declarations. Functional and automated failures remain blocking. The v3.0.0 approval is unchanged. D06 remains **FAIL: 104 pass / 60 fail / 28 inconclusive**; PERF-01 remains **NOT_STARTED**, with no performance-improvement claim.

### Immutable release identity

[Implementation PR #102](https://github.com/fbincon/claude-code-statusline/pull/102) merged as `10de45895d2734a8ab1eacec09b57bc89417be51`. Annotated tag `v3.1.0` has object `c7d2b00e9c3a828cff88594f037a3c6058308787` and peels to that source. The subsequent documentation/evidence work does not move this tag or replace published assets. [Machine-readable delivery evidence](node-regional-languages.delivery.json).

| Delivery file | Bytes | SHA-256 |
| --- | ---: | --- |
| `fbincon-claude-code-statusline-3.1.0.tgz` | 3,437,064 | `000ddea0e995034ec8040691e21c9cf3119e18b6508c4870bc55b95247591011` |
| `claude-code-statusline-3.1.0-source.tar.gz` | 17,442,036 | `ae4bc088a9079c20ce8c26e160f57e3f7ede29285705aed32bd377c84e075a7a` |
| `build-manifest.json` | 952 | `ee1f26d550d5789674fdc5cfeadd835e6f949f45f82ad4a80ec1dd042aef9491` |
| `SHA256SUMS` | 302 | `df19ddf9a77682dc2983a60445b559fd153514e56b066340ff02a0c1f071f550` |

Two independent fixed-toolchain builds and a separate rebuild from the delivered source archive produced identical delivery files. Main/tag CI candidates and downloaded GitHub draft files matched this bundle. Its 655 packaged files include all four existing native targets. The final package passed Node 22.0.0 product tests and ten isolated offline checks. An actual published v3.0.0 upgrade preserved legacy-file bytes during reads, canonicalized both languages only on save, upgraded owned protocol-11 resources to 12 and retained backups.

### CI and publication

| Check | Actual result |
| --- | --- |
| [Reviewed PR head CI](https://github.com/fbincon/claude-code-statusline/actions/runs/39117679694) | 55/55 passed at `8e9e58d04716fb5279d450ca1c789c0f720d59dc` |
| [Merge CI](https://github.com/fbincon/claude-code-statusline/actions/runs/39119023676) | 55/55 passed at the release source |
| [Tag CI](https://github.com/fbincon/claude-code-statusline/actions/runs/39120233851) | 55/55 passed at the release source |
| [npm OIDC dry-run](https://github.com/fbincon/claude-code-statusline/actions/runs/39121664834) | Preparation passed; publisher skipped as intended |
| [npm publication](https://github.com/fbincon/claude-code-statusline/actions/runs/39121750108) | OIDC upload accepted in attempt 1; attempt 2 verified identical public bytes and passed |
| [Public downloads](https://github.com/fbincon/claude-code-statusline/actions/runs/39122362109) | 6/6 passed; four GitHub assets and npm exact-version/`latest` installations |

The local complete check ran 957 tests: 953 passed, four platform skips, zero failures. All six packs cover 1,365 keys, all 36 generated outputs match, and frozen Python/archive and responsibility-ledger checks pass. Release readiness accepted all 8/13/32 source/package-bound receipts and recorded the approval SHA-256 `6f44f89301c96f38656067a8fc3cf2db6ea65e3be94c66a19b0a9c52e750f4a2`.

npm accepted the first OIDC upload before public metadata was available. The verifier exhausted its approximately three-minute wait and failed; the authenticated version-status endpoint subsequently reported `published`. Anonymous metadata and downloaded SHA-256/SHA-512 were then verified before retrying only the failed job. That retry logged `already-published`, did not upload again and did not revalidate OIDC. The original signed provenance binds the package to the release source, tag and `npm-publish.yml` [attempt 1](https://github.com/fbincon/claude-code-statusline/actions/runs/39121750108/attempts/1). The existing npm publisher now displays **Valid**. No token publishing fallback or overwritten package was used.

The original public-download receipts record actual versions rather than inferring them from `22.x`/`24.x`:

| Platform | 22.x selection | 24.x selection |
| --- | --- | --- |
| Ubuntu 24.04 x64 | 22.23.3 | 24.21.0 |
| Windows 2025 x64 | 22.23.3 | 24.21.0 |
| macOS 15 arm64 | 22.23.2 | 24.21.0 |

The macOS selection exposed a runner-cache difference. The evidence follow-up enables `check-latest: true` for both the 32-case compatibility matrix and six-case public downloads, so subsequent range selections resolve the latest release. Original receipts retain their actual versions. Exact minimum versions and the fixed development toolchain remain explicit.

### Public channels and captures

- [npm 3.1.0](https://www.npmjs.com/package/@fbincon/claude-code-statusline/v/3.1.0): `latest=3.1.0`, `beta=3.0.0-beta.1`; downloaded package bytes match the bundle and registry SHA-512.
- [GitHub stable/Latest](https://github.com/fbincon/claude-code-statusline/releases/tag/v3.1.0), Release `416388749`, published `2026-10-18T11:13:23Z`: four verified attachments. The six public-download jobs each installed both `3.1.0` and `latest` into initially empty caches with scripts disabled.
- [Gitee stable](https://gitee.com/fbincon/claude-code-statusline/releases/tag/v3.1.0), Release `1215869`: source and annotated tag synchronized with explicit refspecs after ancestry checks; four identical attachments anonymously downloaded, fully verified and passed ten offline installed checks. Automatic repository source archives are separate from the rebuildable source asset. A proxy TLS failure was checked before retrying; the slow source download completed through the native interface with fresh public DNS and normal certificate validation.

The [regional gallery](../images/typescript/regional/README.md) publishes 20 inspected images with file/cell/font hashes and release-source/package binding. The complete final capture set contains 24 external page frames, 32 external boundary frames, 20 native component frames and four actual installed Client frames in official Claude 2.1.294. Native common-size PTYs, synthetic 32×12 components and operating-system/human acceptance remain explicitly distinguished. No paid model calls or personal configuration changes were made.
