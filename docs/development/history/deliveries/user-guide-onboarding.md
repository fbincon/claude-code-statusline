# User-guide onboarding and editor operations

**English** | [简体中文](user-guide-onboarding.zh-CN.md)

This 2026-11-12 documentation maintenance follows the USER_GUIDE review of PR #229. The [user guide](../../../USER_GUIDE.md) now starts with the first-install workflow, and [configuration editors](../../../EDITORS.md) owns detailed user operations. Product commands, editor behavior, protocols, storage and release identity retain their existing contracts.

## Content and ownership

- Quick start follows the contents and uses package installation → setup dry run → setup → restart Claude → doctor. Platform prerequisites and the Windows `.cmd` entry are explicit. Detailed installation, first-use transactions and recovery remain in their responsible guides.
- The ownership troubleshooting paragraph names only preset/import dry runs; apply/set do not support `--dry-run`.
- The new editor topic collects opening conditions, keyboard controls, pages/footer/pagination, input, discovery, formatting, import review, preview and saving. It distinguishes accepting into a draft, saving display settings, checking an unknown save and independent Claude Apply.
- USER_GUIDE retains common operations and troubleshooting. Unicode rules live in Composition. The native development page retains implementation, original observations and acceptance records, with user-operation sections linking to the editor topic.
- Both language indexes and relevant topics link to the new guide. Existing headings and explicit anchors remain at their original paths with useful destinations.

## Source and verification

The baseline is `ed3e9fa10afcb92d46b3cfe4dc593ab9b9e093e4`; the implementation commit is `64b6d646dcaa65484f7ae14d8f1c162ca455a2c5`, on `docs/user-guide-onboarding`. This subsequent record/index commit adds no product code.

| Implementation-stage check | Actual result |
| --- | --- |
| Node 24.21.0 / npm 11.19.0 build | Passed |
| Local documentation links and whitespace | 5,807 links, no errors; `git diff --check` passed |
| Documentation content, examples and anchor tests | 31/31 passed |
| Existing anchor inventory | USER_GUIDE EN 231/231, ZH 165/165; native development EN 16/16, ZH 19/19 preserved, as reported by the existing anchor helper |
| Bilingual structure | Matching heading levels/order: USER_GUIDE 85 headings per language; EDITORS 19 per language, excluding fenced examples |
| Immutable impact plan | Maintenance; Linux: actions/checks/docs; Windows and macOS: checks; no unknown paths or package comparison |
| Local Linux scoped receipt | Passed for the implementation commit on Node v24.21.0; original execution 12:50:19–12:51:22 UTC |

The editor topic is registered in the existing source-backed suite. Its terminal minimum dimensions are compared with production layout constants, and its Client host gate with the integration definition; mutation cases reject changed facts. Navigation tests check the first-use position, both public entry pages and specific legacy-section destinations. Guide examples execute only in isolated fixtures; preset/import dry runs and rejected apply/set dry runs assert preserved file bytes and modes.

A source-backed reading pass followed installation → setup → restart → diagnostics and both editor paths through navigation, preview, import, Save/cancel and conflict recovery. Key controls were compared with terminal `state.ts`/footer and Client `keys.ts`/help; detailed structural and concurrent-edit decisions remain in their topic guides. This was a documentation/source inspection, not interactive editor acceptance.

Final-head scoped receipts, the required **Complete candidate evidence**, merge identity and main promotion are separate evidence recorded by the delivery PR. The implementation-stage results above keep their original source identity. GitHub is primary; validated main is synchronized to Gitee only after checking divergence, with the remote SHA verified afterward.

## Limits

No installed-product, physical editor/focus, live GitHub source-provider or paid-model acceptance was performed. The existing issue #96 gaps remain unverified. This maintenance does not introduce a product version, tag, Release, npm publication, screenshot or Python-archive change. See [testing and acceptance](../../testing.md) for the separate obligations.
