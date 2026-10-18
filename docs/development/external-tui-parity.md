# External TUI rendering and interaction follow-up

**English** | [简体中文](external-tui-parity.zh-CN.md)

Updated: **2026-10-19** (Asia/Shanghai). Delivered: **v3.1.1**. Status: **DONE** under the version-specific maintainer decision. [Machine-readable delivery evidence](external-tui-parity.delivery.json).

## Decision and boundaries

The maintainer approved implementation after comparing Python v2.0.0 (`9b6d2fab4bf165be280d428a874521bfbf02c7e1`) and TypeScript v3.1.0 (`10de45895d2734a8ab1eacec09b57bc89417be51`). Retain cyan headings, full-row selection, aligned columns and six languages. Restore useful external-editor information and repair presentation defects. Keep terminal-default frames and backgrounds, four pages, minimum 64×18 and full frames from 20 rows.

Public CLI, editor protocol 12 and persisted formats remain unchanged. Native editor behavior and the Python archive are preserved. Product tests do not introduce a CLI dependency into the TUI package. README remains a product introduction, with no new release history.

## Implementation

The drawing entry retains its existing exports and composes modules for the bounded canvas/ANSI encoder, external field presentation, contextual shortcuts and page content. Shared protocol metadata remains canonical; external labels no longer inherit shortened native labels.

Repairs cover complete separator style, one ellipsis, literal-versus-inherited values, one Enter per action, contextual category/numeric/search controls, compact action discovery, field summaries, format scope/back hints, description highlights and match snippets, pending configuration text markers, wrapped small-window dimensions, preview plurals and 8-color intensity. Notices and inline keys retain bold. Import-review headings retain cyan and full-row selection.

## Validation and evidence

Product regressions cover six languages; 32×12, 64×18, 64×19, 64×20, 80×24, 120×30 and 80×48; and monochrome/8/16/256 colors. Assertions check actual style spans and key behavior, not only text presence or image hashes. Existing named migration, backend, save/cancel, signal, resize and terminal-restoration tests remain required.

`capture:editor -- --artifact TGZ --commit FULL_SHA --output NEW_DIRECTORY --font FILE --extended` captures actual installed PTY output in six languages, contextual views and seven boundary sizes. The same recorded cells are reconstructed using explicit light/dark terminal-default profiles. It asserts full separator styling, actual controls, cancellation preserving configuration bytes and terminal restoration. These images are reconstructed terminal cells, not operating-system screenshots or human desktop/power acceptance. Raw streams, cells and reports remain under ignored validation output.

Local `npm run check` passed: 969 tests, 965 passes, 4 expected platform skips and no failures; 36 generated resources, 2,051 documentation links, frozen archive and all three responsibility ledgers passed. Eleven new product regressions live in the TUI package. Each locale contains 1,370 keys.

The final package passed eight installed targets, thirteen fixed-host combinations and 32 Node-runtime cases. Actual runtime versions were 22.0.0, 22.23.3, 24.0.0 and 24.22.0. The final reviewed [PR #105 head CI](https://github.com/fbincon/claude-code-statusline/actions/runs/39143608031), [merge CI](https://github.com/fbincon/claude-code-statusline/actions/runs/39145660480) and [tag CI](https://github.com/fbincon/claude-code-statusline/actions/runs/39147113769) each passed all 55 jobs. The PR run required one availability retry described below; merge/tag runs passed on their first attempts.

Fresh final-package PTY collection passed 252 frames across all six languages, four pages and contextual views. Cancellation preserves settings/display bytes and restores terminal attributes. [Fifty selected images and provenance](../images/typescript/v3.1.1/README.md) record separate image inspection, font/palette choices and hashes. These final images are byte-identical to the earlier inspected set; all 252 final-source behavior assertions were run afresh. Actual captures use 256-color capability; monochrome/8/16/256-color coverage comes from separate product assertions.

## Fixed release identity

Implementation [PR #104](https://github.com/fbincon/claude-code-statusline/pull/104) and acceptance correction [PR #105](https://github.com/fbincon/claude-code-statusline/pull/105) produce source `b484dc9acc87bc55a2833904dd332827307603ca`. The final annotated tag `v3.1.1` is object `0a74c5b40456725e2e7bd15be9d77d7fb7627a47`. Two independent builds and both independent source-archive rebuild rounds match all four delivery files. Merge/tag CI bundles and downloaded GitHub draft assets also match. The downloaded draft tgz passes verification of 667 package files and all ten isolated offline installed checks.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `fbincon-claude-code-statusline-3.1.1.tgz` | 3448826 | `364a0c7fb3c8e7d1715fe5c8d0d5a77e65926bcb3dd6f1c00b3035fb6a73e609` |
| `claude-code-statusline-3.1.1-source.tar.gz` | 19108621 | `aebff6ad18db91c120df37cbbdc30fc851cdfc634adf949819f47d1ec51868d8` |
| `build-manifest.json` | 952 | `be28c29c4617dfea66b4029dfb78d2125d5b326dd5d7af1224cc2c1b3f1ded86` |
| `SHA256SUMS` | 302 | `1f5be22e6e2ee5a64faaf788fa2bb8dbd294bff4f95c6a27bd6fdc4e34a40582` |

The fixed build uses Node 24.21.0/npm 11.19.0. npm integrity is `sha512-u6f1IdIBOImlz9be/X+kGsMzT061TPpRXqDSYD572HoxGs87mPZMKs76CHAqPWNnu5KydhzgU8D3cq0bfreZ8A==`. SHA256SUMS lists the other three files; its own digest is recorded above.

## Acceptance failures and corrections

The first unpublished candidate exposed a resize-test race: keys sent while a window was small could remain unread until after enlargement. One hundred synchronized probes preserved cancellation; the original ordering reproduced two saves in 200 runs. PR #105 waits for a complete small frame after each disabled key and checks configuration bytes before resizing, retaining the original migration test name. The corrected test passed 30 consecutive local runs. No runtime cancellation path was changed.

A Windows Node 22.0.0 job passed all ten offline checks and then failed with `ENOTEMPTY` during temporary-directory removal. PR #105 adds bounded native removal retries and writes passing receipts only after cleanup. Persistent cleanup failures still fail acceptance.

One macOS 26 Intel/Node 24.22.0 PR attempt could not establish writer identity before journal publication. A fresh-runner retry passed. Review confirmed that the existing identity guard failed closed; no guard, timeout or assertion was relaxed, and the exact availability cause was not established. This is a recorded failed attempt, not a claimed product fix. The final merge and tag matrices passed independently.

The initial unpublished tag object `e60fcb548f5aefff2b0d5d13ed6fa49a12ed07ed` pointed at `ff4f0de04f45b1d1d7a9e81010cfd2e122dc8b5c`. After confirming no public v3.1.1 package or Release existed, the approved unpublished-tag correction used that exact old-object lease to bind the passing test-only merge above. Of 667 package files, only `candidate.json` provenance changed; the other 666 runtime/resource files are byte-identical. Final builds and captures were collected again. No released version/tag/assets were overwritten.

Two source-rebuild attempts failed on registry TLS reset/download timeout and were excluded. A fresh rebuild with scoped IPv4-first DNS and normal TLS succeeded; all six locked dependency downloads separately matched SHA-512. Both source-rebuild rounds match all four final delivery files. No source, proxy or route configuration was changed.

## Release decision

[v3.1.1 approval](../releases/approvals/v3.1.1.json) records the maintainer's explicit acceptance of the same six existing gaps for this version only. The release verifier accepts neither another version's approval nor failed/missing automated evidence. D06 remains FAIL and PERF-01 NOT_STARTED.

The fixed build, source rebuild and final-head/merge/tag checks above established readiness. npm received the verified tgz; GitHub/Gitee received that same tgz, source tar.gz, build manifest and SHA256SUMS. Approval SHA-256 is `7352650c32c059fb522ad11c19e804cda879d415a5f942168e667a24a82d2cbd`. [Release notes](../releases/v3.1.1.md).

## Public delivery

| Channel | Verified result |
| --- | --- |
| [npm](https://www.npmjs.com/package/@fbincon/claude-code-statusline/v/3.1.1) | Public at `2026-10-18T17:27:50.672Z`; `latest=3.1.1`, `beta=3.0.0-beta.1`; anonymous package SHA-256/SHA-512 match |
| [GitHub stable/Latest](https://github.com/fbincon/claude-code-statusline/releases/tag/v3.1.1) | Release `416587715`, published `2026-10-18T17:29:37Z`; non-draft, non-prerelease and Latest; exactly four matching attachments |
| [Gitee stable](https://gitee.com/fbincon/claude-code-statusline/releases/tag/v3.1.1) | Release `1216887`, created `2026-10-19T01:30:03+08:00`; same source/annotated tag and four anonymous downloaded attachments; all ten offline installed checks pass |
| [Public-download CI](https://github.com/fbincon/claude-code-statusline/actions/runs/39149828588) | Six of six jobs pass on Linux x64, Windows x64 and macOS ARM64 with Node 22.23.3/24.22.0; each installs exact `3.1.1` and `latest` with fresh caches and disabled lifecycle scripts |

[OIDC dry-run](https://github.com/fbincon/claude-code-statusline/actions/runs/39148939884) passed before the [live run](https://github.com/fbincon/claude-code-statusline/actions/runs/39149157401). The first live attempt accepted the upload and signed provenance ([transparency log](https://search.sigstore.dev/?logIndex=3314357879)), then registry processing exceeded the 175-second public-visibility wait. After anonymous metadata and package bytes matched, only the failed verification job was retried: it returned `already-published`, performed no upload and completed successfully. The original timeout remains recorded; it is not a second publication or a waived failure.

Six public CI receipts bind the final source, verifier source, package digest and both registry selectors; local public-download checks independently pass. All four Gitee downloads match the table, and its tgz passes complete bundle verification and installed checks. Gitee's automatic repository archives are separate from the delivered rebuildable source attachment.

GitHub remains primary. After checking that Gitee main had no divergent commits, explicit non-force refspecs synchronized validated main and the annotated tag. This documentation/gallery follow-up does not move that public tag or replace assets. Historical releases, beta, Python reference/images, root project READMEs and the personal installation are preserved. The six accepted physical/desktop/declaration gaps remain unverified/unavailable; CI and reconstructed images do not close them. D06 stays **FAIL: 104 pass / 60 fail / 28 inconclusive**; PERF-01 stays **NOT_STARTED**.
