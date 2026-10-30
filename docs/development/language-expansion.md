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

## Local implementation checks

The implementation working tree passed `npm run check`: 1,502 tests passed, six existing non-Linux platform cases were skipped, and no tests failed. Generated resources, 4,061 documentation links, frozen Python/archive checks and all three migration responsibility inventories passed. All twelve languages have 2,311 accepted entries, including 261 statusline messages, with no missing, stale, pending, invalid or fallback entries. These local results are separate from the required immutable candidate and PR/main/tag evidence.

The actual 2.1.312 host exposed a Spanish 32×12 footer overflow during local validation. Retained shortcut labels now use grapheme-safe shortening only after the existing compaction/priority steps, preserving keys, selection, draft and a real preview. The unchanged full-language drawing matrix and added minimum-size regression passed together (16 tests) in an isolated actual-host rerun. Earlier failed/partial runs remain diagnostic records.

## Release and machine verification

The [version decision](../releases/approvals/v3.16.0.json) records the maintainer's authority. Publication requires complete twelve-language readiness, all required final PR/main/tag gates, independent and source-archive rebuilds, four verified delivery files, npm OIDC and public-download/signature checks. Synchronize validated main and the annotated tag to Gitee with explicit refspecs, verify matching assets, then upgrade and exercise the test machine with its preferences restored.

No paid model tests are planned. Automated tests, actual-host mounts, PTYs and agent-inspected reconstructions are recorded separately from physical or human acceptance. The six accepted [issue #96 gaps](https://github.com/fbincon/claude-code-statusline/issues/96) remain unverified and do not waive new failures. After completed publication, keep v3.16.0 and file issues for new local findings without publishing a patch.

[Release notes](../releases/v3.16.0.md) · [Release process](../RELEASING.md) · [Capacity and recovery](native-capacity.md).
