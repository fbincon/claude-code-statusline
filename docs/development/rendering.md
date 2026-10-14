# Rendering and Unicode contracts

**English** | [简体中文](rendering.zh-CN.md)

Production main/subagent rows, Python previews and the native editor use fixed Unicode 18.0 cell widths and extended grapheme boundaries. Ambiguous characters occupy one cell. A terminal or font can choose different glyph presentation; this contract describes the application's layout, not every physical terminal.

## Reproducible Unicode data

`tools/unicode/data.json` retains the required tables from wcwidth 0.9.1 with original module hashes. `provenance.json` records the Unicode version, data and official conformance-file hashes. The MIT and Unicode notices accompany source distributions and wheels; generated native tables retain the notices for separately installed Mods.

Distribution metadata declares `MIT AND Unicode-3.0` for the project code and bundled Unicode data, following the [package license-expression specification](https://packaging.python.org/en/latest/specifications/pyproject-toml/#license) and [Unicode-3.0 identifier](https://spdx.org/licenses/Unicode-3.0.html). The project's own code retains its MIT license.

```bash
python tools/generate_unicode.py --check
```

Checking and ordinary builds are offline and require no wcwidth installation. To deliberately refresh the pinned snapshot, install `wcwidth==0.9.1` in a development environment and run `python tools/generate_unicode.py --refresh`; review all resulting data, generated files and provenance. Changing Unicode or reference versions requires an explicit generator change and complete acceptance.

The printable-ASCII fast path avoids Unicode table loads. Both implementations run the official Unicode 18.0 GraphemeBreakTest cases and shared terminal-width examples. The width policy applies the reference policy separately to each complete grapheme: for example, `a` followed by ZWJ and `b` must not swallow the unrelated `b`. Width and segmentation neither import wcwidth nor depend on the Python/host Unicode database.

Generated Python tables decode fixed little-endian 32-bit integers with the standard-library `struct` module. This avoids compiling thousands of tuple literals when bytecode is cold; every decoded reference interval is checked against the pinned JSON. Table values, Unicode rules and the native generated arrays remain identical. Unselected transcript/timer modules are imported only when used, with historical module aliases retained.

## Styles and boundaries

The supported style state consists of foreground, background and bold. SGR changes accumulate; `0` resets all supported attributes, `22` clears bold, and `39`/`49` restore default foreground/background independently. ANSI slots 0–255 and RGB colors are preserved. Semicolon and colon extended-color forms are supported; malformed color groups cannot become unrelated style commands. Other terminal effects are outside this contract.

Partition the visible row into graphemes before assigning styles. When SGR occurs inside one cluster, its first visible code point supplies the cluster's drawing style; all later transitions still affect following clusters. Cropping and wrapping never split the cluster. Each emitted styled row restores its state and ends in a reset. An indivisible cluster wider than the whole viewport is replaced with an ellipsis; ordinary CJK/emoji clusters fit the existing two-cell production minimum.

Untrusted payload controls remain sanitized. ZWJ, variation selectors and emoji tag characters are preserved as part of Unicode text; they do not enable ANSI injection. Fixed sample previews continue to avoid live collectors, Git execution and persistent writes.

See [testing](testing.md) for representative benchmarks and [shared contracts](contracts.md) for the editor protocol.

## Editor drawing and capture

The native preview applies explicit span backgrounds inside its existing light/dark surface. Default backgrounds restore that surface; padding does not inherit the final span's color. Curses maps both channels to its 0/8/16/256-color capabilities and bounds color-pair allocation. Missing defaults or exhausted pairs fall back to readable terminal-default text.

Curses continues to own input, geometry and restoration. On VT-capable outputs, a blank backing frame is refreshed before complete, positioned text runs are painted; each batch restores the cursor and SGR state. This avoids curses' code-point-only emoji cells. Without VT, unsupported multi-code-point clusters are replaced as a whole with a width-preserving placeholder; saved text is unchanged. Resizing and shorter redraws clear previous content. Text editing and highlighted rows also preserve grapheme boundaries.

The PTY tools use pyte for controls and pinned wcwidth for independent grapheme decoding, never the production cell kernel. Raw streams accompany decoded cells. Captures verify terminal output, not installed fonts or human acceptance. Run on Linux/macOS with `pyte` and `wcwidth==0.9.1` in the runner environment:

```bash
python tools/rendering_acceptance.py --python /absolute/installed-venv/bin/python --commit VERIFIED_SHA --report-dir dist/validation/new-rendering-pty
```

This checks color and monochrome PTYs at 32/64/120 columns, clusters across SGR boundaries, indexed/RGB backgrounds, selective resets, shorter redraws and resizing. The `--source` option is only for development probes and is recorded separately from installed-package acceptance.

## Visibility and item appearance

Visibility consumes the same lazy Git/live snapshots and unrounded usage values as rendering. Only complete zero/clean evidence suppresses an item; formatting is not parsed back into observations. Theme palettes provide semantic foregrounds, then item channel overrides apply across all styled units, including label/icon prefixes and internal resets. Enabled risk foregrounds win over overrides. Powerline composes visible blocks after fitting, budgeting padding/boundaries and resetting each output row. The classic path keeps legacy bytes and lazy imports. Shared color quantization lives in `rendering.colors`; curses retains its compatibility exports. See [user behavior](../APPEARANCE.md) and the shared appearance/legacy fixtures in tests.

## Component instances and layout

`config/instances.py` owns identity, legacy mapping and pure draft edits; `instance_commands.py` provides the CLI. `rendering/components.py` fits text and one flexible spacer in main/subagent rows. Raw observations are reused within the frame and copies format independently. Native pure edits live in `lib/editor/instances.ts`; TypeScript generates the shared protocol. See [composition](../COMPOSITION.md) and [shared contracts](contracts.md).

## TypeScript development renderer

The TS-03 entry supports `render` (UTF-8 JSON stdin, main rows on stdout) and `render-subagents` (one compact NDJSON record per accepted ID). Both accept a UTF-8 BOM, quietly ignore invalid input, and fall back to defaults for an invalid display file. `CLAUDE_CONFIG_DIR` selects an isolated configuration directory; these render commands do not take `--config-dir`. Main output budgets `COLUMNS - 2`, with a 118-cell fallback. The UI v11 preview returns semantic spans for main and agent rows, with host padding applied only to the main preview.

`RenderEnvironment` connects clocks, paths and selected observations. Repeated components share Git, usage, live, branch-diff and task snapshots; output formatting never becomes accounting input. Ended subagents require recorded end evidence for elapsed time and retain frozen durations across refreshes. The five small statusline language packs remain separate from UI catalogues. Generated Unicode table arrays initialize only when non-ASCII processing needs them; ASCII frames do not allocate them. Unicode 18 layout data and licenses remain pinned, while payload case conversion and legacy decimal parsing preserve Python 3.14's UCD 16 semantics.
