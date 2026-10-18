# Node runtime and regional language follow-up

**English** | [简体中文](node-regional-languages.zh-CN.md)

This post-migration work targets v3.1.0. TS-01–TS-06 remain complete; their frozen fixtures, historical decisions and Python reference are retained. PERF-01 remains separate and not started.

## Runtime contract

The product accepts stable Node `^22.0.0 || ^24.0.0`. Development, resource generation and reproducible builds retain Node 24.21.0/npm 11.19.0. `packages/core/src/node-runtime.ts` is shared by package generation, verification, diagnostics and runtime receipt checks. No other Node series or additional OS/architecture is declared supported.

The original eight installed targets and thirteen hosts remain. An additional 32-case matrix tests each installed target with 22.0.0, latest 22.x, 24.0.0 and latest 24.x against the identical package. Each receipt records the source commit, package SHA-256, actual Node version/hash, product tests and isolated offline installation. Release readiness rejects missing, duplicate, wrong-runtime or failed evidence. Bootstrap with the fixed toolchain, then run `npm run test:runtime` under the selected Node without rebuilding. Module-import tracing uses asynchronous loader hooks with an explicit flush handshake, including on Node 22.0.0.

Windows Node 24.0.0 exposed a historical libuv mismatch between path and descriptor volume-serial widths. Recovery compares BigInt inode IDs and normalized 32-bit Windows volume serials (the current libuv representation), retaining all POSIX device bits and existing regular-file/reparse/permission guards. The regression tests reject different inodes even beyond the safe-number boundary.

## Regional language contract

Selectors contain `en`, `zh-CN`, `zh-TW`, `zh-HK`, `ja`, `ko`, in that order. `zh-Hant` is an input-only compatibility alias for Taiwan. Reads normalize without rewriting; explicit saves and exports emit canonical codes. Unknown inputs remain invalid. Taiwan and Hong Kong have complete independent packs, regional terminology, shared generation, multilingual search and independent UI/output selection. [Translation conventions](i18n.md).

Editor protocol 12 rejects older frontends with a reinstall message. Display schema 8, UI preferences 1, portable envelope 1 and runtime protocol 2 retain their formats. Reinstallation refreshes matching resources and accepts the former owned protocol marker for upgrade. Before downgrading, reset both language settings to English using the newer version, or restore a compatible backup.

The frozen migration capture adapts historical protocol-11 requests in memory. Comparison permits only the known protocol fields, exact unsupported-version text and two language-choice lists to change; unrelated behavior and the three original CLI wording exemptions remain checked.

## Validation and delivery

Status: **IN_PROGRESS**. Complete generation/coverage checks, all product/tool tests, eight installed targets, thirteen hosts and 32 runtime receipts before release. Exercise all 36 UI/output combinations, regional search, legacy preferences and arguments, failed writes, portable imports and protocol mismatch. Inspect both editors at minimum/common sizes and capture the installed regional interfaces; automated captures do not establish new human desktop acceptance.

The maintainer explicitly accepted the same six disclosed historical gaps for v3.1.0 in the [version-specific decision](../releases/approvals/v3.1.0.json). Functional and automated failures remain blocking. Preserve the v3.0.0 approval unchanged. Publish one verified package through OIDC to npm `latest`, GitHub stable/Latest and Gitee with identical delivery bytes, retaining `beta`. Record final source, CI, digests and download results after actual delivery.
