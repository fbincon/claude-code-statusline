# Appearance, sample scenarios and explicit file diagnosis

**English** | [简体中文](appearance-preview-diagnosis.zh-CN.md)

This page describes appearance ownership, deterministic preview scenarios and explicit file diagnosis. Original implementation and release evidence is in the [delivery record](history/deliveries/appearance-preview-diagnosis.md#appearance-sample-scenarios-and-explicit-file-diagnosis).

## Ownership and behavior

Core owns the theme registry, gradient presets, session-only preview selection, color candidates, file-diagnosis presentation and rendering decisions. Platform retains bounded read-only file access; CLI parses supplied files and orchestrates diagnosis. Both editors adapt the same pure state. Native projection sends only visible spans and text, retaining candidates, scenario definitions and complete reports in the host.

Eight themes retain `classic`, `dark`, `light`, `terminal` and add `ocean`, `ember`, `slate`, `blossom`. Eleven gradients retain the original three and add `glacier`, `lagoon`, `flame`, `copper`, `steel`, `sage`, `petal`, `twilight`. Presets persist expanded RGB stops. Color candidates preview before acceptance; accepting affects only the display draft. Display Save remains separate from host preferences and source authorization.

Fourteen deterministic scenarios replace observations: normal, warning, critical, zero, missing, stale/failed sources, long content, three Git states and zero/two/24 agents. Ctrl+V cycles scenarios, Ctrl+W cycles auto/40/80/120 widths and Ctrl+N advances preview rows. Effective width never exceeds the available preview surface. No scenario changes the draft or enables collection.

`diagnose_file` reads the explicitly supplied path using the current draft, selected scope, optional capture time and `include_local:false` default. Existing CLI `diagnose` retains its cache-inclusive default and `--input-only` switch. A file operation never saves, collects, repairs or launches a source. Report origin, capture/diagnosis times, session identity and evidence range remain visible. Esc returns from the report to its form, then to the retained editor.

## Interfaces and compatibility

Themes, scenario previews and file diagnosis use the current display schema and editor protocol. `diagnose_file` supports optional `scenario` metadata on preview/explain and optional per-row `style_reasons` with stable codes and primary-owner identity. Portable/profile envelopes, source stores, runtime and UI preferences retain their versions. Reads of older schemas normalize in memory; explicit saves retain backup and migration. New themes cannot be claimed under an older schema. Upgrade matching frontend/backend resources; restore a compatible backup before downgrading. Current interface versions are in the [CLI reference](../reference/cli.md#protocol-and-schema-versions); historical introduction values are in the [delivery record](history/deliveries/appearance-preview-diagnosis.md#validation-and-delivery).

Style reasons come from production rendering and distinguish disabled colors, inactive background gradients, group-owned backgrounds, threshold foregrounds, ANSI conversion and neutral contrast protection. Sample evidence remains synthetic and does not establish live availability. File diagnosis retains the established historical time and per-agent evidence rules.

The full [delivery record](history/deliveries/appearance-preview-diagnosis.md#appearance-sample-scenarios-and-explicit-file-diagnosis) is in the development history. The links below open its moved sections.

- <a id="validation-and-delivery"></a>[Validation and delivery](history/deliveries/appearance-preview-diagnosis.md#validation-and-delivery)
- <a id="source-and-required-gates"></a>[Source and required gates](history/deliveries/appearance-preview-diagnosis.md#source-and-required-gates)
- <a id="local-observations-and-machine-restoration"></a>[Local observations and machine restoration](history/deliveries/appearance-preview-diagnosis.md#local-observations-and-machine-restoration)
- <a id="published-channels"></a>[Published channels](history/deliveries/appearance-preview-diagnosis.md#published-channels)
