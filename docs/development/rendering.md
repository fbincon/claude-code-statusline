# Rendering and Unicode contracts

**English** | [简体中文](rendering.zh-CN.md)

Production main/subagent rows, shared TypeScript previews and both editors use fixed Unicode 18.0 cell widths and extended grapheme boundaries. Ambiguous characters occupy one cell. A terminal or font can choose different glyph presentation; this contract defines application layout, not every physical terminal.

## Reproducible Unicode data

`tools/unicode/data.json` retains the required wcwidth 0.9.1 tables and original module hashes. `provenance.json` records the Unicode version, data and official conformance-file hashes. The npm package and source archive carry the MIT and Unicode notices; generated Native tables retain those notices too. Product metadata declares `MIT AND Unicode-3.0`; the project's own code retains MIT.

The current generator is `tools/generation/resources.ts`. After changing its canonical inputs, run:

```bash
npm run generate
npm run generate:check
```

Ordinary generation is offline and needs no Python or wcwidth installation. Changing the pinned Unicode/reference versions requires an explicit generator change and applicable product acceptance. The [Python archive](../../archive/python/README.md) preserves the original Python generation procedure and table encoding; do not regenerate it from current main.

The printable-ASCII fast path avoids Unicode table initialization. Core and Native tests use the official Unicode 18.0 GraphemeBreakTest cases and shared terminal-width examples. Width policy applies separately to each complete grapheme: `a` followed by ZWJ and `b` must not swallow the unrelated `b`. Runtime segmentation and width do not import wcwidth or depend on the host Unicode database. Generated arrays initialize only when non-ASCII processing needs them.

## Styles and boundaries

Supported style state consists of foreground, background and bold. SGR changes accumulate; `0` resets supported attributes, `22` clears bold, and `39`/`49` restore default foreground/background independently. ANSI slots 0–255 and RGB colors are preserved. Semicolon and colon extended-color forms are supported; malformed groups cannot become unrelated commands.

Visible rows are partitioned into graphemes before styles are assigned. If SGR occurs inside a cluster, its first visible code point supplies the drawing style; subsequent transitions still affect following clusters. Cropping and wrapping never split a cluster. Styled rows restore their state and reset at the end. An indivisible cluster wider than the viewport uses an ellipsis; ordinary CJK/emoji clusters fit the two-cell production minimum.

Untrusted payload controls remain sanitized. ZWJ, variation selectors and emoji tags remain part of Unicode text without enabling ANSI injection. Validated OSC 8 links survive supported styling and fitting. Fixed sample previews never run live collectors, execute Git or write persistent state. [Shared contracts](contracts.md).

## Editor drawing and capture

The Native preview applies span backgrounds within its separate light/dark surface. Default backgrounds restore that surface, and padding does not inherit the final span's color. The external editor uses `packages/tui/src/drawing/canvas.ts` for bounded frames and ANSI output, mapping foreground/background to the detected 0/8/16/256-color capability. Platform terminal adapters own raw input, resizing and terminal restoration. Complete text runs and editing operations preserve graphemes; shorter redraws clear prior rows.

The shared input viewport fits complete grapheme clusters into the terminal columns left by the localized label and other row content. Only the active editable field carries a caret range. The caret reverses the next visible grapheme in its existing cells. A single highlighted blank cell marks an empty field, the end of the value, or a position where the next grapheme is too wide for the input area. The external editor uses ANSI reverse video at all supported color depths. The Native editor uses the host theme for caret contrast.

Current capture tools live under `tools/acceptance`: `capture:editor` runs the matching installed external editor in a real PTY, and `capture:render` reconstructs recorded terminal cells with explicit fonts. Their output identifies the package/source, cell input, crop, renderer and font hashes. `capture:native-capacity` provides actual-host Native capture coverage; [candidate acceptance](testing.md#candidate-build-and-isolated-installation) and [capacity/recovery](native-capacity.md) define its separate obligations.

A reconstruction verifies recorded terminal output, not installed physical fonts or human acceptance. Read [image provenance](../images/README.md) and [SHOWCASE-01 collection](showcase.md) for method labels and sanitized reproduction inputs. Historical Python/pyte commands remain in the frozen archive and original capture records, not the current development workflow.

## Visibility and item appearance

Visibility uses the same lazy Git/live snapshots and unrounded usage values as rendering. Only complete zero/clean evidence suppresses an item; formatted text is not parsed back into observations. Theme roles supply semantic foregrounds, then per-item colors cover the complete styled value, including labels/icons. Enabled risk foregrounds take precedence. Shared color rules live in `packages/core/src/rendering/colors.ts`.

Powerline composes visible blocks after fitting, counts padding/boundaries and resets every row. Component foreground gradients work with ordinary separators; Powerline background and continuous-row gradients require colored Powerline output. Adaptive indicators retain numerical meaning while width fitting shortens or removes decoration. [User behavior](../APPEARANCE.md).

## Component instances and layout

`packages/core/src/config/instances.ts` owns identity, legacy mapping and pure instance edits. CLI configuration services apply those rules through existing ownership/revision transactions. `packages/core/src/rendering/components.ts` shares main/subagent fitting, including text and one flexible spacer per applicable row. Observations are reused within a frame while copies format independently. Native generated modules reuse the same pure rules. [Composition](../COMPOSITION.md) · [Shared contracts](contracts.md).

## TypeScript development renderer

The production TypeScript entry supports `render` (UTF-8 JSON stdin, main rows on stdout) and the legacy `render-subagents` command (one compact NDJSON record per accepted ID). Both accept a UTF-8 BOM, quietly ignore invalid input and use defaults for invalid display configuration. `CLAUDE_CONFIG_DIR` selects the configuration directory for these two forms. Main content budgets `COLUMNS - 2`, with a 118-cell fallback and a two-cell minimum. The current editor protocol returns semantic spans for both scopes, applying host padding only to the main preview.

The AgentRow Mod maps host `kind`, `type` and `taskStatus` to the renderer's task `type`, `agentType` and `status`. It orders tasks by the host's row IDs and supplies each body width after tree indentation. The shared renderer counts nonempty rows for the row limit and advances continuous Powerline colors across the fitted rows. The Mod puts the resulting styled text in `body` and leaves the pointer, connectors and row actions to the host. [Subagent rows and the three scopes](../reference/cli.md#subagent-rows-and-the-three-scopes)

`RenderEnvironment` connects clocks, paths and selected observations. Repeated components share Git, usage, live, branch-diff and task snapshots; formatting never becomes accounting input. Ended agents need recorded ending evidence and retain frozen durations. The twelve small statusline language packs remain separate from UI catalogs. Unicode 18 layout data stays pinned while payload case conversion and legacy decimal parsing preserve the frozen Python 3.14/UCD 16 compatibility semantics.
