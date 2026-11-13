# Adaptive indicators and continuous row scenarios

**English** | [简体中文](adaptive-row-scenarios.zh-CN.md)

This page describes adaptive indicator fitting, continuous row backgrounds and the five display scenarios. Implementation and release evidence is in the [delivery record](history/deliveries/adaptive-row-scenarios.md#adaptive-indicators-and-continuous-row-scenarios).

## Shared representation and final paint

Display schema 17 adds `presentation=adaptive` and optional `powerline.row_background_gradient`; the editor protocol carries the corresponding descriptors. Portable/profile envelopes remain version 1. Old files normalize in memory without writes; neither feature is enabled by reading old data. Earlier schemas reject the new options. Explicit writes retain revision checks, locks, backups and atomic publication.

Adaptive indicators retain structured percentages and used/remaining phrases. Fixed rows shorten eligible built-in labels, reduce bars to four cells, then use numeric presentation before existing priority omission. Lower-priority indicators degrade first within each stage. Custom labels and icons remain whole. A numeric representation that cannot fit is omitted. `max_width`, groups and both scopes use this rule. Automatic layout retains ordinary wrapping and adapts only units wider than a complete row. Diagnosis and sample explanations record the same adaptation transitions for an item's own width bound; complete omission is reported as `width_omitted` rather than empty data.

The row gradient is opt-in and only active in colored Powerline output. Existing `color_mode=continuous` retains palette-sequence meaning. Final bodies are painted after visibility, fitting, grouping and wrapping. Shared-background groups form one block. Explicit component/primary backgrounds and independent background gradients override the row gradient and break its run. Spacers break runs; alignment padding remains uncolored and consumes no gradient cells. Aligned units retain body metadata until the complete row is painted. Separators and caps use actual edge colors. Warning foregrounds retain priority and contrast protection; links and complete graphemes survive.

## Display scenarios

Five new stable identities extend the original nine choices to fourteen:

| ID | Display intent |
| --- | --- |
| `powerline-daily` | Ocean daily work, continuous background and adaptive context |
| `agent-workbench` | Slate task/activity groups and agent rows |
| `quota-cost` | Ember quota/reset alignment, grouped context/spend and cost rate |
| `narrow-terminal` | Compact ASCII presentation, ordinary wrapping and four-cell adaptive bars |
| `light-readable` | Light theme, pale continuous background and protected risk colors |

Core definitions drive setup, both editors, CLI and [portable examples](../../examples/schemes/). Selection previews a candidate; acceptance is one draft-history transition. Current display language and subagent enablement are retained. No scenario installs tools, imports credentials, binds local sources or enables collection. Missing observations remain missing. Existing three complete schemes retain their identities and rendering choices.

[Installed-renderer samples](../images/adaptive-row-scenarios/README.md) show all five scenes. The narrow scene uses compact ASCII identifiers without additional labels, keeping the actual directory value visible at 40 columns; the four-cell adaptive bar still retains its complete percentage and remaining meaning.

## Native presentation and localization

Complete editor state remains in the host. Props, the outer Pane and Client drawing retain independent 48,000-character / 10,000-value / depth-16 preflights, with bounded visible pages, selected content, Unicode and colored previews. Capacity and language coverage are tracked in [native-capacity.md](native-capacity.md) and [i18n.md](i18n.md). Saved, pending and unknown save recovery remains separate from drawing failures.

## Supported signature verification

> **Scope:** The `release:signatures` procedure is current. The `3.14.0` version and artifact below are the original delivery example; substitute the release under verification. See [publication, signatures and public bytes](history/deliveries/adaptive-row-scenarios.md#publication-signatures-and-public-bytes).

Use the pinned development toolchain and an exact downloaded package:

```bash
npm run release:signatures -- --version 3.14.0 --commit FULL_SOURCE_SHA --artifact /path/to/fbincon-claude-code-statusline-3.14.0.tgz --output /path/to/new-signatures.json
```

The tool reuses npm 11.19.0's TUF, registry signature and Sigstore verification, checks package SHA-512 and every file, then binds provenance to the exact repository, source commit, tag and publisher workflow. All six bundled public dependencies are separately signature/integrity verified, and their shipped files are compared with their signed upstream archives. The four private workspace packages are covered by the signed outer archive and complete inventory; they are never queried as unpublished registry releases. Missing dependency provenance is reported as absent, while the outer package requires source provenance.

This is a dedicated, explicitly scoped verification flow. Native `npm audit signatures` still traverses private bundled workspace dependencies and may return E404. It is not reported as passed. Published releases gain a fixed-toolchain signature job beside the six existing public-download jobs.

The full [delivery record](history/deliveries/adaptive-row-scenarios.md#adaptive-indicators-and-continuous-row-scenarios) is in the development history. The links below open its moved sections.

- <a id="acceptance-and-delivery"></a>[Acceptance and delivery](history/deliveries/adaptive-row-scenarios.md#acceptance-and-delivery)
- <a id="local-candidate-evidence"></a>[Local candidate evidence](history/deliveries/adaptive-row-scenarios.md#local-candidate-evidence)
- <a id="final-source-and-release-identity"></a>[Final source and release identity](history/deliveries/adaptive-row-scenarios.md#final-source-and-release-identity)
- <a id="checks-retries-and-evidence-boundaries"></a>[Checks, retries and evidence boundaries](history/deliveries/adaptive-row-scenarios.md#checks-retries-and-evidence-boundaries)
- <a id="publication-signatures-and-public-bytes"></a>[Publication, signatures and public bytes](history/deliveries/adaptive-row-scenarios.md#publication-signatures-and-public-bytes)
- <a id="actual-machine-and-closure"></a>[Actual machine and closure](history/deliveries/adaptive-row-scenarios.md#actual-machine-and-closure)
