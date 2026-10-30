# Twelve-language interface and statusline support

**English** | [简体中文](language-expansion.zh-CN.md)

v3.16.0 adds Spanish (`es`), French (`fr`), German (`de`), Brazilian Portuguese (`pt-BR`), Russian (`ru`) and Indonesian (`id`), after the original six selector entries. Published and verified on the test machine on **2026-10-30**. Original source, release identities and actual results are recorded below.

## Resources and compatibility

All twelve languages cover the CLI, both editors, help, recovery, previews and main/subagent statuslines. The new packs follow the existing B policy: current English may be used during development, but every public release requires complete accepted A/B resources. Canonical translations and explicit validation/acceptance remain governed by the [translation guide](i18n.md). Review records distinguish agent contextual review from native-speaker review.

The generator owns shared language types, effective Node/Native dictionaries, statusline modules and installed wizard lists. Node dictionaries have an explicit language/message-key type to avoid TypeScript declaration serialization limits as packs grow. Native modules remain split below 1 MiB. No dictionaries or translation history are transported to the Client.

Editor protocol 31 rejects stale frontends with the existing reinstall guidance. Display schema 17, UI preferences 1, portable/profile formats and runtime protocols retain their formats. Owned protocol-30 resources can be upgraded. Reads preserve bytes; UI language saves immediately, output language follows display Save/Cancel, and Claude preferences retain separate Apply. `zh-Hant` remains an input-only alias for `zh-TW`; new codes have no aliases or automatic locale selection.

## Acceptance obligations

- All 144 independent UI/output combinations, save/cancel/reopen, failures, import/export, upgrade and exact effective packaged resources.
- Meaningful localized CLI/render expectations and shared search fixtures for accents, combining characters, Cyrillic, CJK and emoji. Commands, IDs, numbers, technical units and user labels retain their identity.
- All 283 previous capacity scenarios plus five scenarios per new language, for 313 actual-host cases. Fixtures inject the selected output-language messages into the production preview renderer. Original scenario identities remain inspectable.
- Independent 48,000-character, 10,000-value and depth-16 budgets for props, the outer Pane and the Client tree, including non-ASCII escape expansion. Preserve selected content, paging, whole graphemes, preview colors and saved/pending/unknown recovery outcomes.
- Native 32×12 and TUI 64×18 minimums, common and tall/resize viewports, 40/80/120-column output, both backgrounds and supported color fallbacks.

Language registration, generated types and protocol changes require the product route: complete final-PR acceptance across eight installation targets, 32 Node cases and sixteen fixed hosts. Verified main integration and tag promotion retain immutable original evidence. Scoped documentation follow-ups use their own impact checks.

The expanded official tests run one source test file per disposable exact-source copy, with twelve generated language files covering all 144 pairs. Individual tests retain their 30-second limits and each official invocation retains its 180-second deadline. Copies preserve hooks and supporting modules; receipts bind the complete ordered file inventory, source hashes, pass counts, elapsed times and retained logs. Release verification compares those inventories with the immutable source archive and verifies the actual logs, rejecting omitted, duplicated, altered or skipped executions.

The capacity suite uses the same serial mechanism for its seven generated entry points. Each case keeps its 20-second limit and each capacity invocation keeps the 300-second deadline. Release verification reconstructs the exact capacity source inventory from the immutable Native archive, including its test registration hooks and entry ranges, and requires all 313 successful cases and every retained batch log.

## Final local checks and implementation diagnostics

The final local check corresponding to frozen source `c89a2ca088099ccd3ceb76baf59ecf11d84b08f0` passed **1,514 tests**, with **six existing platform skips**, zero failures and 1,520 total cases. It checked 118 generated resources, 4,105 documentation links, the frozen Python/archive boundaries and all three responsibility inventories with no pending items. These local results are distinct from the final full-matrix CI result and publication. Source: `dist/validation/expand-languages/check-tar-final.log`.

Earlier implementation work passed `npm run check`: 1,508 tests passed, six existing non-Linux platform cases were skipped, and no tests failed. Generated resources, 4,061 documentation links, frozen Python/archive checks and all three migration responsibility inventories passed. All twelve languages have 2,311 accepted entries, including 261 statusline messages, with no missing, stale, pending, invalid or fallback entries. A subsequent 29-test focused run passed the final source-bound receipt and log-retention guards. These local results are separate from the required immutable candidate and PR/main/tag evidence.

The actual 2.1.312 host exposed a Spanish 32×12 footer overflow during local validation. Retained shortcut labels now use grapheme-safe shortening only after the existing compaction/priority steps, preserving keys, selection, draft and a real preview. The unchanged full-language drawing matrix and added minimum-size regression passed together (16 tests) in an isolated actual-host rerun. Earlier failed/partial runs remain diagnostic records.

An isolated editor rehearsal also found two manager captions falling back to English; display-scheme and package-management rows now use their existing shared translated descriptors. The shared message tests cover all twelve languages, and Native regressions retain draft, cancel, explicit Save and separate Claude Apply behavior.

The unchanged capacity source at `19baf416` passed all 313 cases when its seven files ran serially. The concurrent run had caused memory pressure and incomplete results on this machine; the serial diagnostic completed in 395 seconds with 2.38 GiB peak owned RSS and no added memory-pressure stalls. Its original failures remain failed diagnostics. The diagnostic is not promoted to PR evidence; final-source automation must produce its own bound receipts.

The canonical serial harness then passed all 313 cases on source `6e86031`, together with 25 tests from the two changed Native files and exact Claude 2.1.312 types. These 338 actual-host tests are an explicitly scoped local diagnostic, not a replacement for the full final-source host matrix. That committed source also passed the [draft quick check](https://github.com/fbincon/claude-code-statusline/actions/runs/41004196699) with 1,510 tests and six existing platform skips; the draft aggregate correctly remains blocked until complete product acceptance.

The isolated candidate from `6e86031` (`6d6d955e3850e25c36705927e97ba8522d0bde83d60f1de32b8d229458501b68`) matched all 1,092 installed files. Six external/Native PTY journeys passed cancellation, Save and restoration, including both twelve-language UI cycles and the localized manager captions. All 72 main/subagent render cases passed (twelve languages × three widths × two scopes). All six terminals and nine preference paths were restored, no model request was attempted, and the isolated fixture was removed. These are candidate PTY/renderer results, not physical acceptance or verification of a published installation. The same candidate passed the complete local installed suite: 28 tests, zero failures/skips, including all 144 language combinations, historical upgrade/recovery and all five appearance scenarios. The [nine-image gallery](../images/typescript/v3.16.0/README.md) retains its original candidate identity.

The final source rebuild and CI exposed a tar-reader lifetime defect: the synchronous dependency reuses a 16 MiB input buffer, and retained chunk views could overwrite entries spanning its boundary. This affected three archived entries and caused a source file to fail compilation. The reader now copies each chunk immediately; binary, Unicode, empty, raw-boundary and gzip regressions verify complete bytes. Git exports independently compare every path and blob hash with the immutable tree before writing a manifest; source-archive rebuilds remain usable without Git history. The failed candidate/CI run and the earlier preparation archive audit are retained; neither is promoted as accepted release source.

<a id="final-release"></a>

## Final source and release identity

Publication and test-machine verification completed on **2026-10-30** (Asia/Shanghai). The released source is [`c89a2ca088099ccd3ceb76baf59ecf11d84b08f0`](https://github.com/fbincon/claude-code-statusline/commit/c89a2ca088099ccd3ceb76baf59ecf11d84b08f0) from [PR #190](https://github.com/fbincon/claude-code-statusline/pull/190). Merge [`2974c968426c020af13bf47933ba33dc65104653`](https://github.com/fbincon/claude-code-statusline/commit/2974c968426c020af13bf47933ba33dc65104653) has parents `9002ae1a57a6687b0cc2261957fee54395eff19e` and `c89a2ca088099ccd3ceb76baf59ecf11d84b08f0` and the same tree as the reviewed source. Annotated tag `v3.16.0` has object `43a876bbd001d77932779cff4b2378232207968f` and peels to `c89a2ca088099ccd3ceb76baf59ecf11d84b08f0`.

| Evidence stage | Observed identity and outcome |
| --- | --- |
| Final PR | [41007969032](https://github.com/fbincon/claude-code-statusline/actions/runs/41007969032), attempt 2: complete 8-installation / 32-Node / 16-host matrix and `Complete candidate evidence` passed |
| Main integration | [41028226478](https://github.com/fbincon/claude-code-statusline/actions/runs/41028226478), attempt 1: three-platform smoke, accepted-base verification and aggregate passed |
| Tag promotion | [41028802052](https://github.com/fbincon/claude-code-statusline/actions/runs/41028802052), attempt 1: original source, main ancestry, tag and evidence passed |
| npm preparation | [41029244762](https://github.com/fbincon/claude-code-statusline/actions/runs/41029244762), attempt 1: dry-run passed and its four files matched the original CI bundle |
| Fresh npm OIDC publication | [41030212502](https://github.com/fbincon/claude-code-statusline/actions/runs/41030212502), attempt 1: `action=published`; `latest=3.16.0`, `beta=3.0.0-beta.1` preserved |
| Public downloads and signatures | [41031023958](https://github.com/fbincon/claude-code-statusline/actions/runs/41031023958), attempt 1: all six Linux/Windows/macOS × Node 22/24 download/install jobs and the signature job passed |

The original candidate was produced by attempt 1 of run `41007969032`, artifact `12956665742` (ZIP SHA256 `3c69ffe3f80568cac453cf300e05504509698b839609b731bdac508a1b993a30`). Complete acceptance is artifact `12963314175` (ZIP SHA256 `5cb5ed374753e12e0e0e12bf4d046dfe951bfa0a3cd13c50b7a7f2298601ebc4`). Its execution records retain **55 original attempt-1 executions and one attempt-2 Windows ARM installation execution**.

The first Windows ARM installation reached the unchanged 55-minute suite deadline after 26 passing tests and no assertion failure. One targeted retry of the same source passed the installed suite in 52m05s and then the complete platform suite. The original timeout remains a failed diagnostic; budgets and assertions were unchanged. The historical complete-envelope counter remains the 197-case capacity baseline; source-bound extended receipts require 313 total cases, including 116 cumulative additions. The inspected final Linux 2.1.310 receipt records seven files, 313 passes and zero failures/skips. All sixteen host receipts passed the same source-bound acceptance checks.

All twelve languages have 2,311 accepted entries, including 261 statusline messages, and zero missing, stale, pending, invalid or fallback entries. The original four CI files match two independent Git-source builds and two delivered-source rebuilds byte for byte. Independent Python tar inspection verified all 1,870 Git blob contents, excluding the generated candidate manifest.

| Delivery file | Bytes | SHA256 | GitHub asset | Gitee asset |
| --- | ---: | --- | ---: | ---: |
| `fbincon-claude-code-statusline-3.16.0.tgz` | 5,151,103 | `2030ef2f8d386b2fcb1f616fb49ce6f16eed92ec21ea22486799da68151b8c8a` | 691518634 | 3540784 |
| `claude-code-statusline-3.16.0-source.tar.gz` | 34,604,495 | `3a02ecafbc377e94c278a0d635978ff8e6c59af8c9743f02a62621f72aa7457c` | 691518626 | 3540758 |
| `build-manifest.json` | 955 | `ae03e30ac441e6c8adcf25da4f9b99c2a82fb607ddae531bb15f85fd2d6081a2` | 691518633 | 3540761 |
| `SHA256SUMS` | 304 | `a7858b5f3f62025c330b7f3333343d6562c9d08b51b1dcb879f35045ab8f57df` | 691518630 | 3540766 |

[GitHub Release](https://github.com/fbincon/claude-code-statusline/releases/tag/v3.16.0) `428817159` was published at `2026-10-30T09:06:38Z` (17:06:38 Asia/Shanghai) and is immutable. All four draft downloads and public GitHub/Gitee files matched the table; npm serves the matching package tarball. Its integrity is `sha512-3O75WAbL0bBXeYJUEAC9pbPsT/FcWjRhvsBLBIVgXXHhiTQBk/a1/5ZGsMxxTNzIU+oQZaN+bkDCRvksyoCz7A==`. Signature verification recorded two package signatures, two attestations and all six bundled public upstreams. Provenance identifies `refs/tags/v3.16.0`, `.github/workflows/npm-publish.yml`, source `c89a2ca088099ccd3ceb76baf59ecf11d84b08f0` and the original live OIDC invocation.

[Gitee Release](https://gitee.com/fbincon/claude-code-statusline/releases/tag/v3.16.0) `1256599` is public. Explicit refspecs synchronized main `2974c968426c020af13bf47933ba33dc65104653` and the original annotated tag object; the peeled target remained `c89a2ca088099ccd3ceb76baf59ecf11d84b08f0`. All four anonymous attachment downloads matched. A failed package upload was confirmed absent before one retry; large-file download timeouts used a freshly resolved native interface with normal TLS verification. No existing attachment was replaced.

The final CI package also passed isolated rehearsals on Claude 2.1.312 and, after the host updated, 2.1.314. Each passed six editor journeys, both twelve-language UI cycles and 72 render cases, restored nine preference paths and six terminal modes, and removed its fixture. The earlier gallery retains its separate `6e86031` / `6d6d955e…` capture identity.

## Verification of the published installation

The supported update completed **3.15.0 → 3.16.0** on Node 24.21.0 / Claude 2.1.314. Its dry-run verified the public artifact, found no compatibility/configuration conflict and preserved the nine preference paths. The installed file inventory and all **1,092 file contents** matched the released package; the installed product and applicable integration were verified. The read-only doctor check exited successfully.

| Published-machine check | Actual result |
| --- | --- |
| External editor | Three successful Cancel / Save / restore journeys in `actual-01`, including a full twelve-language interface cycle and localized search |
| Native editor | Three successful Cancel / Save / restore journeys in `actual-02`, including a full twelve-language interface cycle and localized search |
| Output and reopening | Both editors exercised output-language drafts, cancellation, explicit Save and saved readback/reopening |
| Actual configured statusline | Verified the configured command and its literal invocation; 72 fixture cases passed using the installed renderer (12 languages × 40/80/120 columns × main/subagent scopes) |
| Preferences and terminals | Nine original paths restored with byte/mode/absence checks; all six successful journeys restored terminal modes; product upgrade retained |
| Permitted metadata change | Only the owned Native plugin's `backendVersion` advanced from 3.15.0 to 3.16.0; runtime collection opt-out and unrelated settings were preserved |
| Model requests and findings | Zero model calls/request attempts; no new product findings in the completed checks |

The first actual Native attempt failed during Claude startup, before the Mod loaded: the private harness forced `CLAUDE_CONFIG_DIR` to the default directory and selected a different, uninitialized onboarding file. Preferences were restored after that attempt. Only the ignored local harness was corrected to retain ordinary default user-configuration resolution, keeping network isolation and every deadline. The subsequent three Native journeys passed. The failed startup record remains a separate failed diagnostic; no published product code or assets changed.

The consolidated private report is `dist/validation/expand-languages/machine/final-machine-summary.json`, SHA256 `f549949d3849d1dfcf5f92c614ca8ed054b9eba3347c1cf354aecfe747c3a9df`. Raw settings, host logs and terminal captures remain private. [Documentation follow-up PR #191](https://github.com/fbincon/claude-code-statusline/pull/191) uses an impact plan bound to its committed source and scoped validation; original product source, run and artifact identities stay fixed.

## Authority and verification limits

The [version decision](../releases/approvals/v3.16.0.json) records the maintainer's authorization. All required publication gates and channels completed. No paid model tests were run. Automated tests, actual-host mounts, PTYs and inspected terminal reconstructions remain distinct from human physical acceptance; agent translation review is distinct from native-speaker review.

The six accepted [issue #96 gaps](https://github.com/fbincon/claude-code-statusline/issues/96), including unavailable exact Claude 2.1.296 declarations, remain **unverified**. Any new post-publication product finding receives an issue while retaining v3.16.0, its tag and assets; no patch publication is part of this delivery.

[Release notes](../releases/v3.16.0.md) · [Release process](../RELEASING.md) · [Capacity and recovery](native-capacity.md).
