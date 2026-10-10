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

If threshold colors are enabled, warning/critical foregrounds override an explicit foreground while retaining its background. The existing `threshold-colors`, `warning-threshold` and `critical-threshold` settings control this behavior. Turning colors off removes both channels. `palette ansi` quantizes custom RGB/extended colors to basic ANSI slots; the terminal chooses the actual slot colors. Curses further adapts to available 0/8/16/256 colors and falls back to terminal-default text when pairs cannot be allocated.

## Basic Powerline

```text
claude-statusline config set separator-style powerline
claude-statusline config set powerline-glyph ascii
claude-statusline config set powerline-glyph powerline
claude-statusline config set separator-style classic
```

Powerline is opt-in and uses `>` by default. The `powerline` glyph option uses U+E0B0 where adjacent backgrounds differ and the preceding background is explicit; other boundaries use `>`. Choose a suitable font yourself or return to `ascii`. Color-disabled output uses ASCII.

Each visible item is a block; compound item content stays together. One cell of padding on each side and boundary glyphs count toward row width. Narrow explicit/subagent rows remove decoration before priority fitting and grapheme-safe clipping. Automatic rows wrap complete blocks or whole graphemes in long blocks. Row ends reset style, and default backgrounds never leak into following content. Existing automatic/explicit layout and item width controls still apply.

## Configuration compatibility and recovery

Display schema **7** adds global `theme` / `powerline_glyph` and per-item `foreground`, `background`, `visibility`, `visibility_threshold`. Editor protocol **9** carries the complete draft; portable envelope version **1**, interface preferences **1**, and runtime protocol **2** are independent.

Versions 1–6 are read without rewriting files. Reading, previewing and `install --dry-run` preserve the original bytes. An actual configuration save or `install` backs up those bytes and writes schema 7 with classic theme, ASCII glyph, inherited colors and `always` rules where older files have no settings. Import review includes the new fields and only replaces the draft on acceptance. Future schemas, malformed colors and rules unsupported by a scoped item are rejected, including during installation with `--force`. Uninstall remains available for recovery when the display file cannot be read.

For downgrade, preserve/export the current configuration, remove the native editor with the newer package if required by the [release guide](RELEASING.md), install the older package and restore its compatible pre-migration display backup. Do not merely change the schema number or expect older software to preserve new fields. See [backups and rollback](USER_GUIDE.md#backups-and-rollback).

## Captured examples

These are reconstructions of installed terminal output with fixed sample data; see the [image provenance](images/README.md#conditional-appearance-captures). They are not human platform acceptance.

![Powerline](images/appearance/native-dark-en.png)

![Item colors](images/appearance/external-light-zh-CN.png)
