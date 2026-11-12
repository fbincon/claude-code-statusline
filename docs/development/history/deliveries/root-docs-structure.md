# Root documentation structure and version ownership

**English** | [简体中文](root-docs-structure.zh-CN.md)

This 2026-11-13 maintenance pass finishes the root documentation reorganization started by the [root documentation audit](root-documentation-audit.md). It splits the independent main-item table, reorders the extensions guide and makes the CLI reference the single current-version registry. Product behavior, protocols, storage formats and command output are unchanged.

## Content changes

| Area | Result |
| --- | --- |
| Display items | The 39-row independent/live table is now five sibling H3 tables: model/context/allowance (7), session usage (13), session identity/repository (9), live execution state (5) and request metrics (5). The old `independent-and-live-main-items` anchor remains. |
| Extensions | The guide now follows sources/permissions → editor → source types → automation → Windows paths → freshness/links → operations/troubleshooting → compatibility. Duplicated lease and failure rules moved to one shared section; the Windows H3 became an H2; a compact troubleshooting index was added. All six `docs-example` markers and the four inbound section anchors remain unchanged. |
| Version ownership | `docs/reference/cli.md` now owns current interface and stored-format versions, read ranges, package compatibility values and unversioned host-owned contracts. COMPOSITION, EXTENSIONS, APPEARANCE, DIAGNOSTICS, USER_GUIDE, PACKAGE_MANAGEMENT, PROFILES, SCHEMES and TASK_DETAILS link there instead of repeating current numbers. Development ownership statements point to the same chapter. |
| Checks | `tools/checks/docs-content.ts` now requires the centralized chapter and link targets from COMPOSITION and EXTENSIONS; the negative tests mutate the central values and remove the links. |

## Source and verification

The baseline is `607841a2`. The implementation commits are:

| Stage | Commit |
| --- | --- |
| Split independent display item tables | `2cce2042` |
| Reorganize the extensions guide | `db775e22` |
| Centralize interface versions | `e4ae1031` |

The delivery commit adds this record and the history index entry.

| Check | Actual result |
| --- | --- |
| `npm run docs:check` after the final implementation commit | 6,109 local links, 0 errors |
| `git diff --check` | Passed |
| Build and documentation tests | `docs-content.test.js` and `docs-examples.test.js`: 28/28 passed |
| Bilingual heading levels | DISPLAY_ITEMS, EXTENSIONS and reference/cli pairs match |
| Split table inventory | 39 unique item rows in each language; all six docs-example markers exactly once |
| Immutable impact plan | Maintenance; Linux: actions/checks/docs; Windows and macOS: checks; no unknown paths or comparison |
| Local Linux scoped receipt | Passed for `e4ae1031` with actions/checks/docs |

The content checks read the marked fences in the actual Markdown and executed the selected CLI workflows in temporary directories. This was documentation and source inspection, not installed-product, editor/focus, physical or paid-model acceptance.

## Limits

No product version, tag, Release, npm publication, screenshot or Python-archive change is included. Subdirectory documentation was not audited beyond the version-ownership sentences, the CLI reference chapter and this record. Historical delivery records and preview snapshots retain their original versions. The six accepted issue #96 gaps remain unverified.

Final-head scoped receipts, the required **Complete candidate evidence**, merge identity and main promotion are recorded by the delivery PR. GitHub remains primary; validated main is synchronized to Gitee after checking divergence, with the remote SHA verified afterward.
