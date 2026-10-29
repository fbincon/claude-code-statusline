# Adaptive indicators and continuous row scenarios

**English** | [简体中文](adaptive-row-scenarios.zh-CN.md)

The v3.14.0 implementation covers APPEARANCE-07, APPEARANCE-06 and PROFILE-02, plus issues [#178](https://github.com/fbincon/claude-code-statusline/issues/178) and [#180](https://github.com/fbincon/claude-code-statusline/issues/180). Work started from `7dc3beec326f87864dc2401a18dffe45b7f93da3`. Release acceptance remains subject to the final PR/main/tag gates below.

## Shared representation and final paint

Display schema 17 adds `presentation=adaptive` and optional `powerline.row_background_gradient`; editor protocol 30 carries the corresponding descriptors. Portable/profile envelopes remain version 1. Old files normalize in memory without writes; neither feature is enabled by reading old data. Earlier schemas reject the new options. Explicit writes retain revision checks, locks, backups and atomic publication.

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

Complete editor state remains in the host. Props, the outer Pane and Client drawing retain independent 48,000-character / 10,000-value / depth-16 preflights, with bounded visible pages, selected content, Unicode and colored previews. The capacity inventory retains the original 243 cases and adds 28 scenario/color/indicator cases, totaling 271 actual-host cases. New six-language tests inspect actual style/group/history entry captions rather than merely checking resource presence. Saved, pending and unknown save recovery remains separate from drawing failures.

## Supported signature verification

Use the pinned development toolchain and an exact downloaded package:

```bash
npm run release:signatures -- --version 3.14.0 --commit FULL_SOURCE_SHA --artifact /path/to/fbincon-claude-code-statusline-3.14.0.tgz --output /path/to/new-signatures.json
```

The tool reuses npm 11.19.0's TUF, registry signature and Sigstore verification, checks package SHA-512 and every file, then binds provenance to the exact repository, source commit, tag and publisher workflow. All six bundled public dependencies are separately signature/integrity verified, and their shipped files are compared with their signed upstream archives. The four private workspace packages are covered by the signed outer archive and complete inventory; they are never queried as unpublished registry releases. Missing dependency provenance is reported as absent, while the outer package requires source provenance.

This is a dedicated, explicitly scoped verification flow. Native `npm audit signatures` still traverses private bundled workspace dependencies and may return E404. It is not reported as passed. Published releases gain a fixed-toolchain signature job beside the six existing public-download jobs.

## Acceptance and delivery

Focused validation covers six languages, 40/80/120 columns, semantic fallbacks, group/spacer/alignment boundaries, warnings, ANSI/no-color, persistence and transfer. Candidate acceptance retains eight installed targets, 32 Node cases, sixteen fixed hosts, 271 capacity cases and installed editor/PTY journeys. The [release procedure](../RELEASING.md) promotes immutable original artifacts through final PR/main/tag evidence; failed or missing gates block publication. Only the six existing [#96 gaps](https://github.com/fbincon/claude-code-statusline/issues/96) remain accepted and unverified.

A real v3.13.0 baseline verification passed for the outer package (two signatures and two attestation bundles) and all six public dependencies, including upstream file comparisons. Candidate validation, source identities and channel receipts are recorded with the matching CI run and [v3.14.0 release](https://github.com/fbincon/claude-code-statusline/releases/tag/v3.14.0). No paid model tests are required. Automated host tests, PTYs and agent-inspected captures do not establish new physical/human acceptance. After publication, new local findings are filed as issues while retaining the published version.

## Local candidate evidence

The local candidate at `492d3d50c8d0d72b6230aff956425958b86f5417` builds twice with identical bytes, SHA-256 `8fd4b89d82446ab2185fbf12181d324aedc6a68f28c4c3261b2a63b6cdd0abff`. Source checks pass 1,440 tests with six platform-only skips, 92 generated resources, the frozen archive and complete migration inventories. Installed acceptance passes all 27 tests and 26 required categories, including the five new schemes in six languages at 40/80/120 columns, semantic fitting, transfer and save/reopen. Claude Code 2.1.312 passes all 42 installed Native/external PTY journeys with zero model calls.

Earlier diagnostics remain separate: a `/tmp` quota error interrupted fixture extraction; placing the replacement temporary root inside the checkout was correctly refused by installation isolation. The successful run uses a private disk-backed root outside the checkout. A stale generated capacity payload blocked an intermediate immutable build and was regenerated. The capture checker now permits a colored preview cell only when its text and background match separately produced production cells; arbitrary preview/chrome backgrounds still fail. These failed attempts are not release evidence.

Screenshot review also removed duplicate built-in quota/reset labels and made the actual narrow-terminal directory value visible. [The five retained samples](../images/adaptive-row-scenarios/README.md) identify their original candidate, renderer, fonts and hashes; they are not relabeled as final public artifacts. Final PR/main/tag acceptance and public-byte verification remain independent requirements.

The full installed sample capture completes 732 reconstructions. A later fixed-host repetition exposed a missing `source_draft` response in the shared test fixture, which incorrectly treated the binding-pin request as a preview. The fixture now returns the actual operation's result shape, and the unknown-save test explicitly requires the current binding to remain pinned; all three source integration cases pass on Claude 2.1.310. The failed repetition remains separate from acceptance.

The [first PR execution's Windows ARM / Node 22.0.0 job](https://github.com/fbincon/claude-code-statusline/actions/runs/40864428819/job/123417364443) passes the earlier 26 installed tests, then reaches the 120-second deadline for the new combined appearance case. That case performed 450 previews and thirty save/reopen checks in one subprocess. Acceptance now executes each complete scene separately, retaining its six languages, five samples, three widths, persistence/transfer assertions and the original 120-second subprocess limit. The aggregate still requires all five exact receipts, and records each execution's duration/status. No product command deadline is enlarged. Local focused execution passes all five chunks (about 51.5 seconds total; longest about 16.5 seconds); this diagnostic is explicitly nonpromotable. The final head must pass complete CI.

An extended image collection terminated with SIGTERM during the last language and produced no passing receipt. Its partial captures remain diagnostic; the complete stock collector is rerun independently. The successful 42-journey PTY and 732-sample executions above keep their original identities.
