# Conditional visibility, colors and Powerline

**English** | [简体中文](APPEARANCE.zh-CN.md)


Shared undo/redo, current-file comparison, reviewed alignment repairs and selected style/whole-group reuse are described in [draft history and reuse](DRAFT_HISTORY.md).

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

Themes preserve item selection, order, formats, layout and collection preferences. Existing item overrides survive a theme change. The eight theme IDs are `classic` (existing appearance), `dark`, `light`, `terminal` (terminal ANSI slots), `ocean`, `ember`, `slate` and `blossom`. Ocean, ember and slate suit dark terminal backgrounds; blossom suits light backgrounds. Each supplies regular and Powerline roles. A theme does not change the terminal background or install fonts.

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

Display schema **16** contains `powerline` with `padding`, `separator`, `start_cap`, `end_cap`, and `color_mode`. Editor protocol **24** carries the complete draft. Runtime **3**, lifecycle **4**, portable envelope **1**, UI preferences **1** and profile collection/export **1** remain independent.

Schemas 1–15 are read without rewriting files. Reading, previewing, `setup --dry-run` and `install --dry-run` preserve original bytes. Explicit display save or installation backs up the old bytes and writes schema 16. Missing Powerline controls default to both-side padding, arrow separator, no start cap, an end cap and semantic colors, preserving existing Powerline output. Existing values remain intact, and omitted gradients/alignment remain disabled. Invalid controls and future schemas are rejected. Import review includes the new fields. The ASCII status representation also preserves task/agent state instead of replacing every state with the same generic icon.

For downgrade, preserve/export the current configuration and use the current package's `recover --restore-config TRANSACTION_ID` to restore a compatible pre-upgrade display backup. Then follow the [version-management guide](PACKAGE_MANAGEMENT.md) to return to the older package and matching integration. Do not merely change the schema number or expect older software to preserve new fields. See [backups and rollback](USER_GUIDE.md#backups-and-rollback).

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

## Static component gradients

In either editor, open a component's appearance fields and select **Foreground gradient** or **Powerline background gradient**. Left/right cycles the eleven presets and `off`; Enter opens visible swatches and candidate editing. The color page supports individual stops and custom 2–5 comma-separated `#RRGGBB` colors. Presets save their expanded colors, so exported settings do not depend on later preset changes. Existing solid colors remain stored when a gradient is enabled or disabled.

```sh
claude-statusline config instance main set context-used foreground-gradient ocean
claude-statusline config instance main set context-used background-gradient '#112233,#445566,#778899'
claude-statusline config instance main set context-used foreground-gradient off
```

The same fields work for subagent instances and literal text; spacers have no gradients. Background gradients appear with Powerline. They do not change collection or external-source permissions.

Color interpolation is linear in sRGB channels with equally spaced stops. Foreground spans the final visible icon, label and body. Background spans the fitted block, including padding. Each visible fragment restarts its own gradient after clipping or wrapping; the first and last graphemes reach the endpoint colors, while a single grapheme uses the first color. Graphemes remain whole and are positioned by terminal cells. Links survive the styling pass. ANSI palettes quantize colors; no-color output retains plain text.

Warning and critical foregrounds override foreground gradients. A background gradient sample that equals the text color uses a neutral background. RGB warning/critical text also uses a neutral background when its contrast ratio against a gradient sample falls below 3:1; the warning foreground is retained. Shared Powerline groups take the entire block's background from the primary instance, retain each member's foreground and preserve inactive member backgrounds. Separators and caps use adjacent final edge colors. Spacer gaps retain the terminal default background. Existing semantic/continuous/restart modes continue to sequence inherited colors; explicit gradients restart within each component or block.

Gradients were introduced in display schema 14 / editor protocol 23. Current delivery uses display schema 16 / editor protocol 26; new theme identities require schema 16, while read-only migration from schemas 1–15 retains prior defaults. Reading an older file performs only in-memory migration; saving backs it up. Main/subagent selective imports include their instance gradients; global-only selections leave them untouched. Profile copies and exports retain gradients, and older packages reject the newer schema rather than silently removing it.

## Visual color selection and sample scenarios

Enter on a theme, foreground, background or gradient field opens a color page. Actual swatches accompany names and surface suitability. Enter selects a candidate; Ctrl+S applies it to the display draft; Esc cancels that page. Custom colors retain `inherit`, `default`, `ansi:N` and RGB support. Gradients support 2–5 RGB stops, individual edits, reversal, adding/removing stops and disabling without deleting the saved solid color.

Additional themes are `ocean`, `ember`, `slate` (dark surfaces) and `blossom` (light surfaces). Additional gradients are `glacier`, `lagoon`, `flame`, `copper`, `steel`, `sage`, `petal` and `twilight`. The terminal background remains independently controlled.

Settings includes sample scenario and preview width. Ctrl+V cycles fourteen scenarios, Ctrl+W cycles available/40/80/120 columns and Ctrl+N advances rows. The title identifies the scenario and effective width. These choices last only for the current editor session and also apply to candidate previews and sample explanations. Samples never start a collector, command or network query.

See [implementation and validation](development/appearance-preview-diagnosis.md).
