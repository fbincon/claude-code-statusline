# CLI reference maintenance

**English** | [简体中文](cli-reference-maintenance.zh-CN.md)

This 2026-11-12 maintenance makes the [CLI reference](../../../reference/cli.md) a complete command lookup while retaining its English/Simplified Chinese single-page entry points. Product behavior, built-in help output, public APIs, protocols and stored formats are unchanged.

## Content changes

| Area | Result |
| --- | --- |
| Navigation and conventions | Command index, directory-option placement, target/prerequisite/effect rules, and command-family order precede the centralized options and file reference. |
| Correctness | User-default show/reset are distinguished from project Profiles; layout input compatibility, shared help granularity, and subagent local-source/cache behavior are explicit. |
| Coverage | Profile/project actions, diagnosis/task JSON, all recovery forms, style/group reuse approvals, all 33 config set options and scoped capabilities are indexed. The file inventory includes the Profile library and version-2 source registry. |
| Examples | Sorting and layout examples define their initial selection. Profile/reset and source/target revision examples show the resulting behavior. Development-guide summaries use the same rendering boundaries. |

Existing topic guides retain workflow and metric ownership. All 223 original heading/explicit anchors across the four edited reference/development pages remain available, and the CLI pair has matching levels/order for 68 headings. This is structural verification, not a claim of exhaustive prose correctness.

## Regression coverage

The existing [content/example suite](../../README.md#documentation-content-checks) reads marked fences from the actual bilingual Markdown and executes only selected fixture-bound commands. It now compares the option table with production `OPTIONS`, rejecting missing, unknown and duplicate entries; required example markers remain unique. Valid content is also checked with LF and CRLF endings.

The CLI journeys verify enabled ordering and disabled-instance retention in layouts; user-default/Profile resolution across reset; style/group reuse with exact source and target revisions; byte/mode preservation on refused writes and previews; ordinary transaction-recovery preview; diagnostic/task JSON and error meanings; and local JSON subagent observation publication. Source observations retain numeric values. Disabling custom subagent rows emits no overrides. Fixtures isolate configuration, export paths, runtime/session locations and GitHub credentials, and assert actual cleanup through the platform removal adapter.

A subsequent review also clarifies the corrupted-default fallback in the reference and user guide: rendering can still select a valid project Profile, while normal inspection reports the invalid default file. The Profile journey asserts that selection and byte/mode preservation.

## Source identities and checks

The baseline is `6a39f1a89981e9e5dd7547f354cd10b01f7bee6d`; implementation commit `3eeac9f5850e2e8772eda472cc5a5d88b4dd53e3` is on `docs/cli-reference-refresh`. This subsequent record/index commit adds no product code.

| Implementation-stage check | Actual result |
| --- | --- |
| Node 24.21.0 / npm 11.19.0 build | Pass |
| Documentation links and whitespace | 5,635 local links, no errors; git diff --check passes |
| Source-backed content and examples | 26 tests pass, including both language variants |
| Anchor and bilingual structure comparison | 223 original anchors retained; 68 corresponding CLI headings |
| Immutable implementation impact plan | maintenance; Linux: actions, checks, docs; Windows/macOS: checks; no unknown paths or package comparison |

The final-head scoped receipt, required **Complete candidate evidence**, merge identity and main promotion are separate evidence recorded in the delivery PR. The implementation-stage results above retain their original identities and cannot substitute for those gates. GitHub is primary; validated main is synchronized to Gitee only after divergence and resulting remote SHA checks.

## Limits

The tests do not establish live GitHub authentication/network behavior, interactive PowerShell, physical editor/installed-host acceptance, paid-model acceptance or closure of existing issue #96 gaps. This task does not change screenshots, historical evidence, the Python archive, release versions, tags, Releases or npm publications.
