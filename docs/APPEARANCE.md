# Conditional visibility, colors and Powerline

**English** | [简体中文](APPEARANCE.zh-CN.md)

Use Settings for the statusline theme and separator; open an item's form with Ctrl+E for colors and applicable visibility rules. Both editors preview the unsaved draft using fixed sample data. Save commits the changes; cancel retains the saved configuration. These settings are independent of the Claude theme, interface language and native preview background.

## Conditional visibility

Item options do not enable an item. Use its checkbox or `config enable context-used` to select it for rendering.

The default `always` adds no filtering: an item still follows its existing missing-data behavior. Conditions use raw observations before formatting and layout, so rounded percentages, translated labels and compact numbers cannot change a decision. Hidden items leave no separators or empty rows.

| Rule | Supported items | Meaning |
| --- | --- | --- |
| `git-dirty` | Main `git`, `git-changes` | Hide confirmed zero staged, unstaged, conflict and untracked counts. The compound `git` also requires zero ahead/behind and no missing-upstream warning. Git errors remain visible. |
| `nonzero` | Main `active-agents`, `task-progress` | Hide only a complete, valid zero-agent or empty-list observation. A nonempty completed checklist stays visible. |
| `used-at-least` | Main `context-used`, `context-remaining`, `five-hour-limit`, `weekly-limit`, `spend-limit`; subagent `context-used`, `context-remaining` | Show when raw **used** percentage is at least `visibility-threshold` (integer 0–100, initially 70), regardless of whether the item displays used or remaining allowance. |

Unknown, stale, partial or unavailable observations retain their original presentation; they are never treated as zero. Expired limits retain their existing omission behavior. Conditions do not enable live collection or add collectors. Visibility thresholds are independent of warning/critical color thresholds.

```text
claude-statusline config item main git visibility git-dirty
claude-statusline config item main active-agents visibility nonzero
claude-statusline config item main task-progress visibility nonzero
claude-statusline config item main context-used visibility-threshold 80
claude-statusline config item main context-used visibility used-at-least
claude-statusline config item subagent context-remaining visibility used-at-least
claude-statusline config item main git visibility always
```

## Themes and item colors

Themes preserve item selection, order, formats, layout and collection preferences. Existing item overrides survive a theme change. The four theme IDs are `classic` (existing appearance), `dark`, `light` and `terminal` (terminal ANSI slots). Each supplies regular and Powerline roles. A theme does not change the terminal background or install fonts.

```text
claude-statusline config set theme light
claude-statusline config item main model foreground '#205727'
claude-statusline config item main model background 'ansi:254'
claude-statusline config item subagent name foreground default
claude-statusline config item main model foreground inherit
claude-statusline config item main model background inherit
```

Colors accept `inherit`, `default`, `ansi:N` (0–255), or six-digit `#RRGGBB`; quote hex values in shells. `inherit` uses the item's theme/semantic color. `default` explicitly restores the terminal foreground or background, including inside a Powerline block. JSON stores inheritance as `null`; other values are strings. RGB text is normalized to lowercase.

If threshold colors are enabled, warning/critical foregrounds override an explicit foreground while retaining its background. The existing `threshold-colors`, `warning-threshold` and `critical-threshold` settings control this behavior. Turning colors off removes both channels. `palette ansi` quantizes custom RGB/extended colors to basic ANSI slots; the terminal chooses the actual slot colors. The external editor adapts its preview to the reported terminal color capacity.

## Basic Powerline

```text
claude-statusline config set separator-style powerline
claude-statusline config set powerline-glyph ascii
claude-statusline config set powerline-glyph powerline
claude-statusline config set separator-style classic
```

Powerline is opt-in and uses `>` by default. The `powerline` glyph option uses U+E0B0 where adjacent backgrounds differ and the preceding background is explicit; other boundaries use `>`. Choose a suitable font yourself or return to `ascii`. Color-disabled output uses ASCII.

Each visible item is a block; compound item content stays together. One cell of padding on each side and boundary glyphs count toward row width. Narrow explicit/subagent rows remove decoration before priority fitting and grapheme-safe clipping. Automatic rows wrap complete blocks or whole graphemes in long blocks. Row ends reset style, and default backgrounds never leak into following content. Existing automatic/explicit layout and item width controls still apply.

## Block controls and line colors

Use the same Settings fields in either editor or these CLI options. These are global Powerline **block** controls; Claude host `padding` remains a separate option.

| CLI option | Choices | Default |
| --- | --- | --- |
| `powerline-padding` | `none`, `left`, `right`, `both`; one space on each selected side | `both` |
| `powerline-separator` | `arrow`, `slash`, `bar`, `none` | `arrow` |
| `powerline-start-cap` | `on`, `off` | `off` |
| `powerline-end-cap` | `on`, `off` | `on` |
| `powerline-color-mode` | `semantic`, `continuous`, `restart` | `semantic` |

```sh
claude-statusline config set separator-style powerline
claude-statusline config set powerline-padding left
claude-statusline config set powerline-separator slash
claude-statusline config set powerline-start-cap on
claude-statusline config set powerline-end-cap off
claude-statusline config set powerline-color-mode continuous
```

`semantic` retains the existing component-role colors. `continuous` advances the six theme colors through visible blocks across physical rows; `restart` starts from the first color on each physical row. Main and subagent rendering have independent cursors. Hidden components, scope labels and spacers consume no colors; repeated instances are separate blocks. A spacer's two sides share one row sequence. Explicit per-item colors and threshold-color precedence survive theme changes. If a rotating inherited background equals the retained foreground (for example an ANSI warning on yellow), it uses a neutral background so the text remains visible; explicit backgrounds remain unchanged.

Start/end decorations follow the separator shape, with a reversed start. ASCII uses `>`/`<`, `/`/`\`, `|`, or no glyph. Powerline mode uses the arrow/slanted glyph only with a suitable colored boundary; otherwise it uses the ASCII shape. No-color output uses ASCII without ANSI escapes. Font support is selected explicitly; it is not automatically detected.

Padding, separators and both ends count toward width. Fitting first removes padding, then end decorations, then drops low-priority blocks or truncates a remaining block at grapheme boundaries. Automatic rows wrap using the same measured geometry. Empty lines produce no decoration, and each colored row restores terminal style.

## Configuration compatibility and recovery

Display schema **9** adds `powerline` with `padding`, `separator`, `start_cap`, `end_cap`, and `color_mode`. Editor protocol **16** carries the complete draft. Runtime **2**, lifecycle **4**, portable envelope **1**, UI preferences **1** and profile collection/export **1** remain independent.

Schemas 1–8 are read without rewriting files. Reading, previewing, `setup --dry-run` and `install --dry-run` preserve original bytes. Explicit display save or installation backs up the old bytes and writes schema 9. Migrated defaults are both-side padding, arrow separator, no start cap, an end cap and semantic colors, preserving existing Powerline output. Invalid controls and future schemas are rejected. Import review includes the new fields. The ASCII status representation also preserves task/agent state instead of replacing every state with the same generic icon.

For downgrade, preserve/export the current configuration, remove the native editor with the newer package if required by the [release guide](RELEASING.md), install the older package and restore its compatible pre-migration display backup. Do not merely change the schema number or expect older software to preserve new fields. See [backups and rollback](USER_GUIDE.md#backups-and-rollback).

## Captured examples

These are reconstructions of installed terminal output with fixed sample data; see the [image provenance](images/README.md#conditional-appearance-captures). They are not human platform acceptance.

![Powerline](images/appearance/native-dark-en.png)

![Item colors](images/appearance/external-light-zh-CN.png)

Item appearance belongs to an instance and can change independently after copying. See [composition](COMPOSITION.md) for text and spacer rules.

## Graphical indicators

Eligible context and quota instances offer **Indicator presentation**, **Bar width** and **Bar characters** in item details in either editor. Numeric is the default. Bars use 4–20 cells (default 8); `auto` uses ASCII with ASCII icon formatting and Unicode otherwise. Choose `ascii` explicitly for terminals without block glyphs. Colors are optional.

```bash
claude-statusline config instance main set context-remaining presentation bar
claude-statusline config instance main set context-remaining bar-width 8
claude-statusline config instance main set context-remaining bar-style ascii
```

Use an existing instance ID from `config instance main list`; the same options work with `subagent`. Supported types are `context-used`, `context-remaining`, and main-only `five-hour-limit`, `weekly-limit`, `spend-limit`. Quotas follow the instance's used/remaining selection. The bar retains its direction and percentage even when ordinary labels are hidden. It is an observed level, not elapsed time or a prediction. Missing/invalid/expired input produces no fabricated zero. Only fill is bounded to 100%; valid over-limit quota text remains visible. Width fitting can shorten or omit the complete representation.

Copies, profiles and portable exports retain these display options without enabling any collector or source. Save/reopen persists them; cancel retains the opening configuration. See [delivery and compatibility](development/m4-m7-delivery.md).
