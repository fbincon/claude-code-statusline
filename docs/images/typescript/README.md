# Installed TypeScript editor captures

**English** | [简体中文](README.zh-CN.md)

The [v3.16.0 language gallery](v3.16.0/README.md) shows six additional interface languages in the external editor and three Native examples from a verified installed candidate. It records exact source/package identities, image hashes, privacy crops and separate twelve-language behavior checks.

The [v3.1.1 six-language gallery](v3.1.1/README.md) preserves four pages, contextual controls, light/dark profiles and minimum-window views from that final installed package. Its image hashes, source/package provenance and separate behavior assertions retain their original identities.

The [v3.1.0 regional gallery](regional/README.md) preserves Taiwan/Hong Kong captures from both editors. The preparation captures below retain their original provenance.

These eight images reconstruct the cells emitted by the actual installed external editor in a Linux PTY. They are **not operating-system screenshots**. Original Python screenshots remain unchanged in [the cross-platform gallery](../README.md).

Capture source: `2f6d1c21f2abccfe0a05396172c1c8ec55cd989a`; preparation tgz SHA-256: `4870797de594c064ab7bbea190eaaa0e6981ac5b60a263b7ac418b5cd94d8b50`. This is a preparation artifact, distinct from the final release artifact. [Capture hashes, fonts and configuration](provenance.json) · [Final delivery evidence](../../development/typescript-migration/ts-06/stable-release.md).

Ubuntu 26.04.1 LTS x64, Node 24.21.0, 120×32 cells, xterm-256color. Setup explicitly selects home-relative directory display and matches sample-output language to the interface language. Samples use the production preview renderer; no live transcript or model call is used. Each session cancels without changing settings/display files and restores terminal attributes. Five-language geometry, monochrome and light/dark behavior are tested separately. These captures do not establish desktop focus or physical power acceptance.

Reproduce with `npm run capture:editor -- --artifact TGZ --commit FULL_SHA --output NEW_DIRECTORY --font FILE`, repeating `--font` for DejaVu Sans Mono regular/bold, Noto Sans CJK regular/bold and Noto Sans Symbols2. The collector requires matching source and installed bytes. Raw ANSI, cells and reports stay under ignored validation directories.

## Main

![Main](external/linux/en/main.png)

## Subagents

![Subagents](external/linux/en/subagents.png)

## Settings

![Settings](external/linux/en/settings.png)

## Layout

![Layout](external/linux/en/layout.png)

