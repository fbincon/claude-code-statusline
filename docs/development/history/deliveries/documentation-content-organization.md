# Documentation content organization

**English** | [简体中文](documentation-content-organization.zh-CN.md)

This 2026-11-12 maintenance pass organizes current documentation by reading and operating sequence. It covers twelve core document pairs plus diagnosis, complete schemes and profiles, with the existing directory structure retained. Product behavior, public interfaces and stored formats are unchanged.

## Content changes

| Round | Result |
| --- | --- |
| Chapter order | Appearance and composition teach capabilities before recovery; extensions group manual and automatic behavior by source type; architecture starts with current layers, dependencies and data flow. |
| Content layers and duplication | The user guide compares language persistence and consolidates presets; CLI topics are grouped by function; task controls distinguish Native buttons from body/terminal keys; metric definitions start with scope and availability. Diagnosis, history and profile terminology follow the same current-operation focus. |
| Current rules and history | Contracts separate current operations, models, transactions and feature rules from introduction versions. The development plan uses a compact archive index, and multilingual policy precedes delivery background. |
| Bilingual review | All fifteen pairs have matching chapter levels/order. Original anchors remain available, navigation is updated and current command/option meanings are checked against source. |

The [documentation index](../../../README.md), [development guide](../../README.md) and [history index](../README.md) retain their existing responsibilities. Original delivery evidence is linked rather than relabeled or rebuilt.

## Source identities

The baseline is `cf3e5618939b485c63df4d5a179db2c0e18826eb`. Work uses branch `docs/reorganize-document-content` and one PR. The content rounds have these immutable commits:

| Round | Commit |
| --- | --- |
| Chapter order and architecture | `1ff7a61e487e24d18fa89c49cae17e0911bdcf65` |
| User workflows and command references | `daedea973f3838d4ca0d771b8ceeb643b2da3844` |
| Current contracts and historical index | `15f5603d6cc41f9c77b1185b63f5f54ba67ed976` |

The following delivery commit adds final review corrections, navigation and this record. Its final-head scoped checks and GitHub acceptance are identified in the PR; earlier receipts keep their original commit identities.

## Validation and limits

Each content round passed `npm run docs:check` and `git diff --check`. On `15f5603d6cc41f9c77b1185b63f5f54ba67ed976`, the documentation check reports 5,551 local links with no errors. The immutable impact plan selects the `maintenance` route and one Linux task containing `actions` and `docs`; its local scoped receipt passes. The Actions identity check inspects five files and 144 references with no errors. Local receipts have no Actions execution identity and do not replace `Complete candidate evidence`.

Additional content review verifies:

- All 1,002 original explicit/heading anchors across the thirty edited pages are retained, using the repository checker's anchor rules.
- All fifteen bilingual pairs have matching chapter levels/order. Commands, examples, option meanings and boundaries were also reviewed; matching structure alone does not establish translation quality.
- Both contract operation indexes exactly match the 41 canonical operations in [core](../../../../packages/core/src/contracts/ui.ts).
- All eleven named [gradient presets](../../../../packages/core/src/editor/gradients.ts) parse to their expanded colors and appear in both CLI references; `off` parses to null.
- No new table column mismatch is introduced. Installation/configuration, appearance/composition, source authorization, task diagnosis and developer-contract reading paths were reviewed.

Only Markdown is changed. Validation does not claim a new product matrix, installed/physical acceptance, paid model calls or closure of the six existing issue #96 gaps. There is no version, tag, Release or npm publication in this task.

## Separate product-copy finding

The canonical English [`gradients.invalid` message](../../../../packages/core/resources/i18n/locales/en.json) still names only `ocean`, `sunset` and `aurora`, although the parser accepts eleven presets. The CLI reference now lists the actual supported values. Updating that product hint and its translations/generated resources remains separate presentation maintenance; this documentation pass does not change runtime resources.
