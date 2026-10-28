# Appearance, sample scenarios and explicit file diagnosis

**English** | [简体中文](appearance-preview-diagnosis.zh-CN.md)

APPEARANCE-05, PREVIEW-01 and EXPLAIN-02 build on v3.9.2, starting from main `4ae8d45a8029339f11d3c5dead6a9f19a58a9a40`. The target is v3.10.0. Implementation is in validation; publication and final source-bound receipts are recorded only after their gates pass.

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

The complete final PR/main/tag gates, eight installation targets, 32 Node cases, sixteen hosts, immutable package/source/manifest/checksums, OIDC publication and public downloads remain required. Acceptance-tool changes require full main acceptance and shadow promotion. The [v3.10.0 decision](../releases/approvals/v3.10.0.json) accepts only the six existing [#96 gaps](https://github.com/fbincon/claude-code-statusline/issues/96); they remain unverified. No paid model tests are run. Actual final receipts and machine restoration evidence will be added here after execution.
