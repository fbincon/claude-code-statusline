# Appearance, sample scenarios and explicit file diagnosis

**English** | [简体中文](appearance-preview-diagnosis.zh-CN.md)

APPEARANCE-05, PREVIEW-01 and EXPLAIN-02 build on v3.9.2, starting from main `4ae8d45a8029339f11d3c5dead6a9f19a58a9a40`. The work is delivered in v3.10.0, published on 2026-10-28. The source, gates and original delivery artifacts are recorded below.

## Ownership and behavior

Core owns the theme registry, gradient presets, session-only preview selection, color candidates, file-diagnosis presentation and rendering decisions. Platform retains bounded read-only file access; CLI parses supplied files and orchestrates diagnosis. Both editors adapt the same pure state. Native projection sends only visible spans and text, retaining candidates, scenario definitions and complete reports in the host.

Eight themes retain `classic`, `dark`, `light`, `terminal` and add `ocean`, `ember`, `slate`, `blossom`. Eleven gradients retain the original three and add `glacier`, `lagoon`, `flame`, `copper`, `steel`, `sage`, `petal`, `twilight`. Presets persist expanded RGB stops. Color candidates preview before acceptance; accepting affects only the display draft. Display Save remains separate from host preferences and source authorization.

Fourteen deterministic scenarios replace observations: normal, warning, critical, zero, missing, stale/failed sources, long content, three Git states and zero/two/24 agents. Ctrl+V cycles scenarios, Ctrl+W cycles auto/40/80/120 widths and Ctrl+N advances preview rows. Effective width never exceeds the available preview surface. No scenario changes the draft or enables collection.

`diagnose_file` reads the explicitly supplied path using the current draft, selected scope, optional capture time and `include_local:false` default. Existing CLI `diagnose` retains its cache-inclusive default and `--input-only` switch. A file operation never saves, collects, repairs or launches a source. Report origin, capture/diagnosis times, session identity and evidence range remain visible. Esc returns from the report to its form, then to the retained editor.

## Interfaces and compatibility

Display schema 16 adds theme identities; schemas 1–15 read without writes and explicit saves retain backup/migration. New themes cannot be claimed under an older schema. Protocol 26 adds `diagnose_file`, optional `scenario` on preview/explain, scenario metadata and optional per-row `style_reasons` with stable codes and primary-owner identity. Portable/profile envelopes, source stores, runtime and UI preferences retain their versions. Upgrade matching frontend/backend resources; restore a compatible backup before downgrading.

Style reasons come from production rendering and distinguish disabled colors, inactive background gradients, group-owned backgrounds, threshold foregrounds, ANSI conversion and neutral contrast protection. Sample evidence remains synthetic and does not establish live availability. File diagnosis retains the historical time and per-agent evidence rules delivered by FIX-04.

## Validation and delivery

Focused regressions cover registry/migration, all scenarios at 40/80/120 columns, production preview/explanation agreement, actual zeros, style decisions, file validation and read-only boundaries, six-language candidates and unknown-save protection. Installed acceptance additionally checks new themes/presets, scenario IDs and unsaved-draft file diagnosis. Official Mod tests include bounded color pages and a large retained diagnosis report. All original 197 capacity cases remain required.

Final PR/main/tag gates passed, including eight installation targets, 32 Node cases, sixteen official-host cases and all 197 capacity cases. Acceptance-tool changes received full main acceptance and shadow promotion. The [v3.10.0 decision](../releases/approvals/v3.10.0.json) accepts only the six existing [#96 gaps](https://github.com/fbincon/claude-code-statusline/issues/96); they remain unverified. No paid model tests are run. The terminal observations below are automated captures, not physical or human acceptance.

## Source and required gates

[PR #169](https://github.com/fbincon/claude-code-statusline/pull/169) delivers source `e2cd0a8178d2a5eee58a308ad52db4f60d21847a`. Main merge `6a3e9bb96b9670123d5f99d1e0cb6a5e8201ccde` has the same tree. Annotated tag `v3.10.0`, object `cceec9e93ea2228d5aa2b8b19e0276dbaf3854bc`, points to the accepted PR source reachable from main.

| Execution | Actual result |
| --- | --- |
| [Final PR 40622637912](https://github.com/fbincon/claude-code-statusline/actions/runs/40622637912) | Complete candidate evidence passed; full installation, runtime, official-host and capacity matrix |
| [Main 40626868677](https://github.com/fbincon/claude-code-statusline/actions/runs/40626868677) | Full matrix, three integration smokes and shadow promotion passed |
| [Tag 40630847629](https://github.com/fbincon/claude-code-statusline/actions/runs/40630847629) | Original source promotion and Complete candidate evidence passed |
| [npm dry run 40632861625](https://github.com/fbincon/claude-code-statusline/actions/runs/40632861625) | Passed against the exact tag and original package |
| [npm publication 40633101480](https://github.com/fbincon/claude-code-statusline/actions/runs/40633101480) | New OIDC publication passed; `latest` is 3.10.0 and `beta` remains 3.0.0-beta.1 |
| [Public downloads 40633802047](https://github.com/fbincon/claude-code-statusline/actions/runs/40633802047) | All six Linux/Windows/macOS × Node 22/24 jobs passed |

Original PR artifact `12788490223` supplies the four files below; original acceptance artifact `12789129762` retains the source-bound evidence. Its envelope references 56 original executions and 66 receipt hashes. Main and tag promote this source without relabeling receipts or replacing files with a later rebuild. Independent local and source-archive rebuilds reproduced all four bytes.

| Original file | SHA-256 |
| --- | --- |
| `fbincon-claude-code-statusline-3.10.0.tgz` | `71f52fcbf8bc726c34340c5916db71f3f9b1e4eef03d4c4fd9a4f9a7a73a3b10` |
| `claude-code-statusline-3.10.0-source.tar.gz` | `ee5d0a692d380d90a134edf339a618b1932b80f48efe2e2d2ab79f6c67105cb3` |
| `build-manifest.json` | `2b3e702072131ac0565d090258740528e49439dc903fa4bf79a2f32f9058838f` |
| `SHA256SUMS` | `94b17620e58a571d2a7443755c7f02d988fc537e44db187565d0c838ce48e15a` |

## Local observations and machine restoration

The final source passes `npm run check`: 1,313 tests pass, six platform-specific cases skip and none fail. Resource generation/check covers 67 owned resources; six languages each contain 2,063 messages. Documentation and whitespace checks pass, and the frozen Python archive remains unchanged. The fixed official-host test suite passes 157 tests; exact-host type checks also pass.

Installed acceptance retains all 197 capacity cases and passes 23 real Linux native/external PTY journeys. The external collector records 852 light/dark frames across six languages and four no-color/dumb-terminal controls. New color candidates, scenario/width selection and file form/report captures were inspected. A supplemental native observation waits for the actual asynchronous Ocean preview before checking its production colors; it retains its own collector identity.

The real test installation was upgraded from 3.9.2 to 3.10.0 through the supported package manager. Both installed editors opened scenario/width controls and diagnosed an explicit Unicode-path file using input-only evidence, with no display save or model call. The probe preserves configuration bytes, host interface preferences and terminal state. A first supplemental probe inherited `TERM=dumb` and correctly stopped before entering the editor; the corrected ANSI PTY probe passes.

The upgrade snapshot `pkg-1a876a82-04f1-4425-a05f-cc87e0348f16` was reviewed with `recover --restore-config --dry-run`, then restored through the supported recovery command. Original display schema-15 and UI-preference bytes and permissions match the pre-upgrade snapshot. Optional configuration files retain their original absence. Claude settings differ only in the managed native backend binding, now 3.10.0; unrelated settings are preserved. A final read-only protocol-26 preview and input-only diagnosis load the restored schema-15 file successfully without rewriting it. Version and doctor checks pass; the upgraded package remains installed.

Private machine snapshots, raw terminal captures and detailed receipts remain under ignored `dist/validation/v3.10.0/`; they are not published as user configuration or asserted to be physical acceptance. Temporary harness failures and interrupted transfers retain their actual outcomes and are not reused as passing receipts.

## Published channels

[npm 3.10.0](https://www.npmjs.com/package/@fbincon/claude-code-statusline/v/3.10.0) is public. Anonymous package bytes match the original candidate's SHA-256 and SHA-512 integrity. Its SLSA provenance names source `e2cd0a8178d2a5eee58a308ad52db4f60d21847a`, the tag workflow and publication run 40633101480.

[GitHub v3.10.0](https://github.com/fbincon/claude-code-statusline/releases/tag/v3.10.0) is a public stable/Latest Release, published at `2026-10-28T04:42:09Z`. All four draft assets were downloaded and compared before publication; fresh offline installation, doctor, preview, file diagnosis and PTY cancellation passed. The public download matrix above verifies the published delivery separately.

[Gitee v3.10.0](https://gitee.com/fbincon/claude-code-statusline/releases/tag/v3.10.0), Release `1248231`, distributes the same source and annotated tag. All four manual attachments were downloaded anonymously and match the original bytes; Gitee's two automatically generated archives are not substituted for the verified source archive. An empty-cache offline installation of the downloaded npm package passes version, installation/doctor, protocol/scenario, input-only file diagnosis and PTY cancellation/terminal-restoration checks. Release notes were rendered from the published GitHub metadata and actual Gitee attachment catalog, then read back. Validated main and the unchanged tag object were synchronized with explicit refspecs after checking divergence.
