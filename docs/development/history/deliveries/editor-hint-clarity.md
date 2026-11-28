# Editor format and shortcut hints

**English** | [简体中文](editor-hint-clarity.zh-CN.md)

This 2026-11-28 editor delivery simplifies component examples, item formatting and keyboard instructions. The delivery covers source synchronization. Product versions, tags, Releases and npm publication are outside its scope.

## Changes

| Area | Result |
| --- | --- |
| External component lists | Main, Subagents and the add-component catalog reserve one line for the selected example. Descriptions and search matches appear in the description column. |
| Item format | Both editors pair each preset with its custom field. The form shows when a custom value takes priority and distinguishes following the preset from hiding the label or icon. |
| Shortcut hints | Both editors style actionable keys in localized panel instructions using the footer style. The shortcut panel uses one row budget for the rendered instructions and page movement. |

## Source identities

- Baseline `688eaa5702c3031540f632eef9375c084318cf39`.
- Product source `cf5f6135e815f0ac723df682aad4810ebda24cf1` and verified engineering package SHA-256 `d29f2f199f19f8cd6fe096f0f003fea2e4dc9255cd61472bbe1d28c8747a2e33`. Two independent builds produced identical bytes. Package verification checked 1,186 files.
- Official Native checks used `d5311a2773a381cea23abeba7ef9e7dbe81d377c`, which updates only the version-page test's handling of styled text. The PR records the final reviewed head and documentation checks.

## Validation and limits

| Check | Actual result |
| --- | --- |
| `npm run check` on Linux x64 with Node 24.21.0 | 2,021 passed and six platform-conditioned tests skipped. Generated resources, frozen cases and migration ledgers passed. |
| Language validation | All 624 changed message entries were accepted across twelve languages. `generate:check` and `languages -- release-check` passed with zero English fallback entries. |
| Claude Code 2.1.332 | The selected Native `ci:check` passed official plugin validation, all 370 tests and compilation against declarations emitted by the same build. |
| Installed terminal interactions | Six journeys passed using the verified package and Claude Code 2.1.332. Terminal cells confirmed that keys were bold and their labels regular. The external format journey verified draft preview, save and reopen. |
| Linux installation smoke | Seven checks passed, including offline installation with an empty cache, configuration read/write and uninstall preserving unowned settings. |
| Impact planning | The plan selected the product route. The aggregate Linux `ci:check` was rejected at admission because its 409-minute estimate exceeded the scoped 360-minute limit. The full local product check and the separate Linux installation smoke ran successfully. |

Interactive evidence comes from Linux PTYs and reconstructed terminal cells. Model calls and charges were zero. The six existing platform gaps remain unverified. [Issue #96](https://github.com/fbincon/claude-code-statusline/issues/96)
