# Twelve-language interface and statusline support

**English** | [简体中文](language-expansion.zh-CN.md)

v3.16.0 adds Spanish (`es`), French (`fr`), German (`de`), Brazilian Portuguese (`pt-BR`), Russian (`ru`) and Indonesian (`id`), after the original six selector entries. Implementation and release preparation are in progress; this record does not yet claim completed publication.

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

## Local implementation checks

The implementation working tree passed `npm run check`: 1,508 tests passed, six existing non-Linux platform cases were skipped, and no tests failed. Generated resources, 4,061 documentation links, frozen Python/archive checks and all three migration responsibility inventories passed. All twelve languages have 2,311 accepted entries, including 261 statusline messages, with no missing, stale, pending, invalid or fallback entries. A subsequent 29-test focused run passed the final source-bound receipt and log-retention guards. These local results are separate from the required immutable candidate and PR/main/tag evidence.

The actual 2.1.312 host exposed a Spanish 32×12 footer overflow during local validation. Retained shortcut labels now use grapheme-safe shortening only after the existing compaction/priority steps, preserving keys, selection, draft and a real preview. The unchanged full-language drawing matrix and added minimum-size regression passed together (16 tests) in an isolated actual-host rerun. Earlier failed/partial runs remain diagnostic records.

An isolated editor rehearsal also found two manager captions falling back to English; display-scheme and package-management rows now use their existing shared translated descriptors. The shared message tests cover all twelve languages, and Native regressions retain draft, cancel, explicit Save and separate Claude Apply behavior.

The unchanged capacity source at `19baf416` passed all 313 cases when its seven files ran serially. The concurrent run had caused memory pressure and incomplete results on this machine; the serial diagnostic completed in 395 seconds with 2.38 GiB peak owned RSS and no added memory-pressure stalls. Its original failures remain failed diagnostics. The diagnostic is not promoted to PR evidence; final-source automation must produce its own bound receipts.

The canonical serial harness then passed all 313 cases on source `6e86031`, together with 25 tests from the two changed Native files and exact Claude 2.1.312 types. These 338 actual-host tests are an explicitly scoped local diagnostic, not a replacement for the full final-source host matrix. That committed source also passed the [draft quick check](https://github.com/fbincon/claude-code-statusline/actions/runs/41004196699) with 1,510 tests and six existing platform skips; the draft aggregate correctly remains blocked until complete product acceptance.

The isolated candidate from `6e86031` (`6d6d955e3850e25c36705927e97ba8522d0bde83d60f1de32b8d229458501b68`) matched all 1,092 installed files. Six external/Native PTY journeys passed cancellation, Save and restoration, including both twelve-language UI cycles and the localized manager captions. All 72 main/subagent render cases passed (twelve languages × three widths × two scopes). All six terminals and nine preference paths were restored, no model request was attempted, and the isolated fixture was removed. These are candidate PTY/renderer results, not physical acceptance or verification of a published installation. The same candidate passed the complete local installed suite: 28 tests, zero failures/skips, including all 144 language combinations, historical upgrade/recovery and all five appearance scenarios. The [nine-image gallery](../images/typescript/v3.16.0/README.md) retains its original candidate identity.

## Release and machine verification

The [version decision](../releases/approvals/v3.16.0.json) records the maintainer's authority. Publication requires complete twelve-language readiness, all required final PR/main/tag gates, independent and source-archive rebuilds, four verified delivery files, npm OIDC and public-download/signature checks. Synchronize validated main and the annotated tag to Gitee with explicit refspecs, verify matching assets, then upgrade and exercise the test machine with its preferences restored.

No paid model tests are planned. Automated tests, actual-host mounts, PTYs and agent-inspected reconstructions are recorded separately from physical or human acceptance. The six accepted [issue #96 gaps](https://github.com/fbincon/claude-code-statusline/issues/96) remain unverified and do not waive new failures. After completed publication, keep v3.16.0 and file issues for new local findings without publishing a patch.

[Release notes](../releases/v3.16.0.md) · [Release process](../RELEASING.md) · [Capacity and recovery](native-capacity.md).
