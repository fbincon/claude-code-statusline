# Configuration editors

**English** | [简体中文](EDITORS.zh-CN.md) · [User guide](USER_GUIDE.md) · [Documentation index](README.md)

Use the terminal editor or in-session Client to edit the same display configuration. Each open editor keeps its own draft. Start with [installation and integration](USER_GUIDE.md#installation-and-integration); use the [CLI reference](reference/cli.md) for command syntax.

## Contents

- [Open an editor](#open-an-editor)
- [Pages and navigation](#pages-and-navigation)
- [Keyboard controls](#keyboard-controls)
- [Text input](#text-input)
- [Find items and inspect requirements](#find-items-and-inspect-requirements)
- [Formats and layouts](#formats-and-layouts)
- [Presets, import review and export](#presets-import-review-and-export)
- [Sample preview and colors](#sample-preview-and-colors)
- [Save, cancel and recover](#save-cancel-and-recover)
- [Claude preferences apply separately](#claude-preferences-apply-separately)

<a id="open-an-editor"></a>

## Open an editor

| Entry | Where it runs | Conditions |
| --- | --- | --- |
| `claude-statusline configure` | Current terminal, including SSH | Valid configuration, installation owned by the current CLI, TTY stdin/stdout and working ANSI/VT; minimum 64×18 |
| `/statusline-configure` | Supported terminal launched from Claude | Claude Code 2.1.258+ and enabled external integration; same terminal editor conditions |
| `/statusline-configure-native` | Client pane inside the current Claude session | Claude Code 2.1.287+, enabled native integration and loaded matching resources; minimum Client body 32×12 |

On Windows, run `claude-statusline.cmd configure` in a terminal. The external launcher uses tmux or GNOME Terminal on Linux, tmux or Terminal.app on macOS, and a new system console on Windows. When no supported launcher is available, run `configure` directly. The slash-launched editor cancels without saving after 570 seconds; standalone `configure` has no automatic timeout. Save, cancellation and errors return a short result to the original conversation. The external command accepts `help`, `-h` and `--help`, rejecting other arguments. A terminal below the minimum size waits for resizing and still permits cancellation.

After integration changes, restart Claude Code in a trusted terminal. Click inside Client before using the keyboard; running the native command again focuses its existing pane and keeps its draft. Esc is a host focus action and may then close the pane; Ctrl+G cancels Client input. On macOS, Client interaction remains unverified; use the [focus checks and alternatives](USER_GUIDE.md#macos-mouse-reporting-and-client-focus).

Confirm the editing target in the header. Use **Settings → Display schemes and projects** or Ctrl+O to choose a user default, named profile or project target; terminal `configure` also accepts explicit target options. See [profiles and project bindings](PROFILES.md). [Installation combinations and host compatibility](USER_GUIDE.md#editor-installation-combinations-and-compatibility) explain independent enablement of the two integrations.

<a id="pages-and-navigation"></a>

## Pages and navigation

| Page | What to configure |
| --- | --- |
| Main / Subagents | Configured component instances, including disabled instances; selection, order and item details |
| Settings | Appearance, refresh/display behavior, Git metrics, formatting, risk colors, subagent visibility, presets/files and managers; Client also provides independent Claude preferences |
| Layout | Automatic/explicit rows, row boundaries and item fitting |
| Item details (Ctrl+E) | Sources and requirements, labels/icons, formatting, width, priority and other supported component controls |

Tab / Shift+Tab changes pages outside input editing. Page changes and resizing retain the draft, selection, filters and input buffer. Group headings are not selectable. Arrow keys select fields; Page Up/Down moves a visible page and Home/End selects the first/last field. Settings, Layout and item details account for group-heading rows when paging.

<a id="terminal-page-regions-and-footer"></a>

### Terminal page regions and footer

Content and `Preview (sample data)` occupy separate regions, using frames at 64×20 and above and compact separators at 64×18–19. Main/Subagents show `ON`, `ITEM`, `DESCRIPTION`; settings and forms show `OPTION`, `VALUE`.

The footer changes with the current operation. Item pages show Enter/Ctrl+S for saving; filtered lists hide ordering hints. Input fields show accept/cancel and cursor/delete controls, while pickers show selection controls. Opening a field or editing a file path alone does not modify the display draft. Changed configuration text can mark the title before it is accepted.

<a id="client-pagination-and-footer"></a>

### Client pagination and footer

At 64×20 and above, frames separate content and preview; compact panes use titled separators. Active tabs, group headings and selected fields have distinct styles. Save/finish/close/preview controls form a separate group from page controls. The page group starts with Tab; Settings shows H for Claude preferences and A only when those preferences are expanded.

Input editing replaces ordinary shortcuts with accept/cancel/clear/delete controls. Busy operations and unknown saves show their applicable controls. Hints wrap as complete key/action pairs. At 32×12, compact descriptions and fewer detail rows preserve the selection, basic operations and a sample preview; secondary hints may be omitted. Resizing recomputes field pages while retaining the selected field and input buffer.

<a id="keyboard-controls"></a>

## Keyboard controls

These tables describe the main editor. Active fields, pickers, reviews and managers handle their own keys; follow their footer and the linked topic guide. Client letter shortcuts display uppercase and accept either case outside input editing.

### Terminal editor

| Key | Action |
| --- | --- |
| Tab / Shift+Tab | Cycle Main, Subagents, Settings and Layout outside input editing |
| Space | Toggle the selected component |
| ↑ / ↓; PgUp / PgDn; Home / End | Select, page, first/last item or field |
| ← / → | Reorder components or adjust a setting; ordering is disabled while filtered |
| `/`; printable text; Backspace / Ctrl+U | Enter or update item search; delete/clear it |
| Ctrl+F | Choose a category |
| Ctrl+E / Ctrl+G | Open item details / return or cancel input |
| Ctrl+A / Ctrl+D / Ctrl+X | Add / copy / remove a component on an item page |
| Enter | Save on item/original settings rows; edit or accept advanced fields |
| Ctrl+S | Save the display draft outside input editing |
| Ctrl+K | Check saved state while a save outcome is unknown |
| Esc | Cancel a field or subview; at the top level close a clean draft or confirm discarding changes, defaulting to keep editing |
| Ctrl+C | Restore the terminal, exit 130 and discard unsaved display edits |

### In-session Client

| Key | Action |
| --- | --- |
| Tab / Shift+Tab; 1 / 2 / 3 / 4 | Switch Main, Subagents, Settings and Layout outside input editing |
| ↑ / ↓; PgUp / PgDn; Home / End | Select, page, first/last item or field |
| ← / → | Reorder components or adjust a setting; ordering is disabled while filtered |
| Space / Enter | Toggle components; operate settings or enter/accept field editing |
| `/`; Ctrl+U; Ctrl+G | Enter search; clear input; cancel and restore its prior state |
| Ctrl+F | Choose a category |
| Ctrl+E / Ctrl+G | Open item details / return from the form |
| A / D / X | Add / copy / remove a component on an item page |
| S / F / Q | Save and continue / save and finish / discard unsaved display edits and close |
| H / A | Expand Claude preferences in Settings / Apply those preferences separately |
| R / K / V | Discard/reload / check an unknown save outcome / retry sample preview |
| Esc | Return focus to Claude; use Ctrl+G to cancel Client input |

### Shared tools and preview controls

| Operation | Terminal / Client | Detailed workflow |
| --- | --- | --- |
| Quick setup | Ctrl+P in either editor outside item details | [Schemes and presets](SCHEMES.md#editor-quick-setup) |
| Undo | Ctrl+Z / Ctrl+/ (Ctrl+_ also accepted when forwarded) | [History and terminal conflicts](DRAFT_HISTORY.md) |
| Redo; changes and history | Ctrl+R; Ctrl+T | [Draft history and review](DRAFT_HISTORY.md#history-and-change-review) |
| Component groups | Ctrl+B | [Composition](COMPOSITION.md#component-groups) |
| Profiles and project targets | Ctrl+O outside item details | [Profiles](PROFILES.md) |
| Sources | Ctrl+Y | [Source management](EXTENSIONS.md#configure-with-either-editor) |
| Diagnose an input file | Ctrl+L | [Input diagnosis](DIAGNOSTICS.md#diagnose-a-file-from-either-editor) |
| Sample scenario / width / next preview row | Ctrl+V / Ctrl+W / Ctrl+N | [Sample preview](#sample-preview-and-colors) |

Return from a manager to the main editor to use draft history. On Unix, Claude may intercept Ctrl+Z to suspend the process; use the Client undo keys above. In GNOME Terminal, Ctrl+Shift+- also sends the undo key, while Ctrl+- zooms out. See the history guide for host limitations.

<a id="text-input"></a>

## Text input

Text, search, numeric and file-path inputs support Left/Right, Home/End, insertion, Backspace and forward Delete, with horizontal scrolling. `▏` marks the caret. Deletion preserves complete grapheme clusters. Ctrl+U clears input, Enter accepts and Ctrl+G cancels; terminal Esc also cancels, while Client Esc belongs to the host. Refresh accepts a number or `event`.

Text/search allow 256 Unicode code points and paths 4096. The padding/refresh numeric buffers allow 32; other fields also enforce their own value rules. Oversized or control-containing insertions are rejected with a message, leaving the original value intact. Field input consumes ordinary characters instead of executing letter shortcuts.

Terminal bracketed paste and recognizable Client multi-character text do not execute shortcuts. Client's single-key API has no paste-origin flag: host-split single-character paste cannot reliably be distinguished from typing. Enter a field before pasting. [Unicode and terminal widths](COMPOSITION.md#unicode-text-and-terminal-widths).

<a id="find-items-and-inspect-requirements"></a>

## Find items and inspect requirements

Press `/` on Main/Subagents to enter a query; Enter accepts it, Ctrl+U clears it and Ctrl+G restores the previous query. The terminal editor also accepts direct typing; Esc cancels explicit search input. Search matches IDs, names and descriptions in all twelve languages, custom labels and categories in any interface language. Exact matches rank before prefixes, English initials (for example `mwe`), substrings and ordered subsequences; equal ranks preserve the existing order. Highlighting identifies the match, including an alternate-language snippet when needed.

Ctrl+F opens the category picker. Select with arrows and accept with Enter; choose **All categories** to remove the category filter. Query and category combine and remain local to the session. Filtered items can be toggled or formatted; ordering is disabled until both filters are cleared. Filters are not saved or exported.

For an item's source and conditions, press Ctrl+E, select **Sources and requirements** at the start of the form, then Enter. Scroll with arrows or Page Up/Down; return with Ctrl+G (terminal Esc also works). This explains scope, source fields, verified host requirements, optional collectors and unavailable reasons. It does not inspect live data or enable collection. An unobserved item remains selectable and its preview stays a fixed sample.

<a id="formats-and-layouts"></a>

## Formats and layouts

On Main/Subagents, select a component and press Ctrl+E to edit its label, icon, priority, maximum width and supported format choices. Ctrl+G returns. Enter opens or accepts text/integer input. `inherit` clears an override, an empty label/icon hides it and `none` clears an optional width/limit. Unicode/ASCII icon modes use built-in characters and need no special font.

Layout chooses auto/explicit and sets **New row before** boundaries for all configured main instances, including disabled instances. Higher priorities are retained first (default 50); maximum width counts terminal columns. Reordering keeps row boundaries valid. When explicit rows are too narrow, scope decoration yields to real items, widths shrink and lower-priority items can be hidden. Explicit layout removes empty rows without adding continuation lines; automatic layout wraps. [Components, groups and alignment](COMPOSITION.md).

<a id="presets-import-review-and-export"></a>

## Presets, import review and export

In Settings, choose a Preset, then activate **Expand selected preset**. It replaces the display draft and remains editable before Save. Ctrl+P opens the guided [Quick setup](SCHEMES.md#editor-quick-setup), which preserves the original draft when cancelled and does not enable collectors.

Import accepts a path and compares the file with the **current unsaved draft**. Sections cover item selection, retained-item order, formatting/overrides, layout, statusline language and host statusline settings. Arrows select sections, Enter expands details, Page Up/Down scrolls and Tab switches Main/Subagents candidate previews. **A accepts only into the draft; saving is separate.** Ctrl+G or Q cancels Client review; Esc or Ctrl+G cancels terminal review.

Invalid input or cancellation retains the previous draft. Acceptance uses the already-read candidate even if the source file changes, and retains the original save revision. Complete import replaces the complete draft. Selective import starts with nothing selected and supports explicit global options, the complete main section and/or the complete subagent section; unselected settings and their local bindings remain unchanged. [Selection and target rules](PROFILES.md#selective-import).

Export writes the current draft, including unsaved edits, to a new portable file without saving settings. Relative paths use the host/terminal working directory; `~` expands to the home directory. Errors retain the draft. Both editors refuse to overwrite an existing export; choose a new path or use the CLI's explicit `--overwrite` option. Portable files exclude interface language, collector switches and independent Claude preferences. [CLI import/export and installation ownership](USER_GUIDE.md#presets-and-portable-configuration).

<a id="sample-preview-and-colors"></a>

## Sample preview and colors

Preview uses the production renderer with fixed observations. It does not collect live Git, transcripts or account metrics. Ctrl+V changes scenario, Ctrl+W changes preview width and Ctrl+N scrolls preview rows; Settings also exposes these choices. These controls belong to the editor session. A sample cannot establish real field availability or successful integration.

Select a component, press Ctrl+E, then choose **Configuration and sample explanation**. The view separates draft enablement, known local installation/collector conditions, conditional hiding, clipping and width omission. Repeated types resolve by instance ID and agent sample rows have separate outcomes. Panel overflow is distinct from renderer omission. Scroll with arrows or PgUp/PgDn; Ctrl+G returns. Explanation writes no files or locks and starts no collection. For actual captured input, use [input diagnosis](DIAGNOSTICS.md).

<a id="terminal-colors"></a>

### Terminal colors

The editor uses terminal-default foreground/background, bold ANSI cyan headings and reverse selection. Preview uses the terminal background and selected Palette. If `default` looks faint on a light terminal, compare `ansi` in Settings. Display palette changes preview immediately and affect actual output after Save. [Color capability, NO_COLOR and fallback behavior](APPEARANCE.md#terminal-color-capability).

<a id="client-preview-background"></a>

### Client preview background

Client controls follow Claude's applied theme. **Preview background (UI only)** separately selects `light` (`#ffffff`) or `dark` (`#17191e`), defaults to dark and is remembered immediately. A failed preference write restores the previous choice. This preference is outside the display draft, portable files and Palette. The pane cannot query the terminal's exact RGB background. Compare `default` and `ansi` when needed; cancelling display edits does not undo this UI preference. [Display appearance](APPEARANCE.md).

<a id="save-cancel-and-recover"></a>

## Save, cancel and recover

| Operation | Terminal editor | Client |
| --- | --- | --- |
| Save display | Ctrl+S outside input editing; Enter also saves on item/original settings rows | S saves and continues; F saves successfully before closing |
| Cancel display edits | Top-level Esc; confirm **Discard changes and close** if modified | Q discards unsaved display edits and closes |
| Unknown save outcome | Ctrl+K checks the submitted snapshot | K checks the submitted snapshot |

Enter inside a field accepts the field, and A inside import review accepts the candidate into the draft; neither is the final display save. Real saves check the target revision and installation ownership, back up actual changes and commit atomically. Unchanged configuration creates no backup. UI language changes, source operations and Claude Apply are independent effects outside display cancellation and undo.

Two editors can stay open. The first save succeeds; a stale revision is refused without overwriting newer settings. Conflict review retains the draft and supports comparison, export and explicitly reviewed retry or discard/reload. Use the [concurrent-edit workflow](DRAFT_HISTORY.md#concurrent-edits-and-unknown-saves); ordinary reload discards the draft rather than merging it.

While a save is pending or unknown, display/history mutations and ordinary closure are blocked, including already-open source/profile managers. Saved-state checks read the submitted snapshot without saving again. A definitive result unlocks editing; a conflict retains the draft. Read-only source inspection remains available. On Client failure, Retry/Close buttons outside the pane recover while retaining drafts already received by the host. [Troubleshooting](USER_GUIDE.md#troubleshooting).

<a id="claude-preferences-apply-separately"></a>

## Claude preferences apply separately

In Client Settings, press H to expand **Claude preferences**. Appearance, time/title and behavior rows use the types/options the current host actually supplies. Model, effort, thinking and fast mode are independent of their statusline display switches. Unavailable rows show the applicable official entry such as `/config`, `/model`, `/effort` or `/fast`.

Edit the supplied values, then press A to Apply separately. Per-row results cover refusal, locks, external changes and partial success. Save/Finish and portable files do not apply these preferences; display undo cannot reverse Apply. Reload explicitly discards pending edits. After recovery, click Client again before keyboard use. The terminal editor manages tool configuration and cannot call Claude's host preference API.
