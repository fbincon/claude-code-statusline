# Configuration editors

**English** | [简体中文](EDITORS.zh-CN.md) · [User guide](USER_GUIDE.md) · [Documentation index](README.md)

Use the terminal editor or in-session Client to edit the same display configuration. Each open editor keeps its own draft. Start with [installation and integration](USER_GUIDE.md#installation-and-integration); use the [CLI reference](reference/cli.md) for command syntax.

## Contents

- [Open an editor](#open-an-editor)
- [Pages and navigation](#pages-and-navigation)
- [Keyboard controls](#keyboard-controls)
- [Customize keyboard shortcuts](#customize-keyboard-shortcuts)
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

On Windows, run `claude-statusline.cmd configure` in a terminal. The external launcher uses tmux or GNOME Terminal on Linux, tmux or Terminal.app on macOS, and a new system console on Windows. When no supported launcher is available, run `configure` directly. The slash-launched editor cancels without saving after 30 minutes. Standalone `configure` has no automatic timeout. Save, cancellation and errors return a short result to the original conversation. The slash command `/statusline-configure` accepts `help`, `-h` and `--help`, rejecting other arguments; the standalone `claude-statusline configure` command does not accept `help`. A terminal below the minimum size waits for resizing and still permits cancellation.

After integration changes, restart Claude Code in a trusted terminal. Click the editor body before pressing a shortcut. Running the native command again returns to the existing pane and keeps its draft. Esc returns focus to Claude and may then close the pane. Use Ctrl+G to cancel Client input. If the pane is too small, compare its reported body size with 32×12 and enlarge the terminal to continue the same draft. On macOS, Client interaction remains unverified. See [focus checks and alternatives](USER_GUIDE.md#macos-mouse-reporting-and-client-focus).

Confirm the editing target in the header. Use **Settings → Display schemes and projects** or Ctrl+O to choose a user default, named profile or project target; terminal `configure` also accepts explicit target options. See [profiles and project bindings](PROFILES.md). [Installation combinations and host compatibility](USER_GUIDE.md#editor-installation-combinations-and-compatibility) explain independent enablement of the two integrations.

<a id="pages-and-navigation"></a>

## Pages and navigation

| Page | What to configure |
| --- | --- |
| Main / Subagents | Configured component instances, including disabled instances; selection, order and item details |
| Layout | Automatic/explicit rows, row boundaries and item fitting |
| Settings | Appearance, refresh/display behavior, Git metrics, formatting, risk colors, subagent visibility, presets/files and managers; Client also provides independent Claude preferences |
| Item details (Ctrl+E) | Sources and requirements, labels/icons, formatting, width, priority and other supported component controls |

Tab / Shift+Tab changes pages outside input editing. Page changes and resizing retain the draft, selection, filters and input buffer. Group headings are not selectable. Arrow keys select fields; Page Up/Down moves a visible page and Home/End selects the first/last field. Settings, Layout and item details account for group-heading rows when paging.

<a id="terminal-page-regions-and-footer"></a>

### Terminal page regions and footer

Display-editing pages show the draft and `Preview (sample data)` in separate regions, using frames at 64×20 and above and compact separators at 64×18–19. Main, Subagents and the catalog picker show `ON`, `ITEM` and `DESCRIPTION`, with a single line below the list for the selected component’s catalog example. Settings and forms show `OPTION` and `VALUE`. Data sources, task details, version management and file or configuration confirmations use the full content area where applicable. A file diagnosis shows rendered output in its own area. Tab switches between the report and output when there are rows to read.

In both editors, horizontal dividers mark the groups in **Version and installation**. Enter opens the marked actions and the channel chooser. Going back from details, a review or a confirmation restores the originating row. [Package management](PACKAGE_MANAGEMENT.md#review-from-either-editor)

The footer changes with the current operation. Available keys appear in bold in the footer and in panel instructions. Component lists lead with page, selection and toggle controls. The save control shows the active key for saving and exiting. Filtered lists offer a way to clear filters and hide ordering hints. Input fields show accept/cancel and cursor/delete controls, while pickers show selection controls. Opening a field or editing a file path alone does not modify the display draft. Changed configuration text can mark the title before it is accepted.

Leave a task report or a running job’s status open to follow changes. The active refresh key requests an immediate update. Automatic reads pause during input and confirmation, and stop when you leave the view. The **Refresh interval** setting controls Claude’s status line independently. See [task details](TASK_DETAILS.md), [package progress](PACKAGE_MANAGEMENT.md) and [source jobs](EXTENSIONS.md#configure-with-either-editor).

<a id="client-pagination-and-footer"></a>

### Client pagination and footer

At 64×20 and above, frames separate content and preview. Compact panes use titled separators. Active tabs, group headings and selected fields have distinct styles. Save and close controls form a separate group from page controls. Component lists show the catalog shortcut and the selected component's format shortcut. Settings shows H for Claude preferences and A when those preferences are expanded.

Input editing replaces ordinary shortcuts with accept/cancel/clear/delete controls. Busy operations and unknown saves show their applicable controls. Hints wrap as complete key/action pairs. At 32×12, compact descriptions and fewer detail rows preserve the selection, basic operations and a sample preview; secondary hints may be omitted. Resizing recomputes field pages while retaining the selected field and input buffer.

<a id="keyboard-controls"></a>

## Keyboard controls

These tables describe the main editor. Active fields, pickers, reviews and managers handle their own keys; follow their footer and the linked topic guide. Client letter shortcuts display uppercase and accept either case outside input editing.

### Terminal editor

| Key | Action |
| --- | --- |
| Tab / Shift+Tab | Cycle Main, Subagents, Layout and Settings outside input editing |
| Enter / Space | Toggle the selected component in the Main or Subagents list |
| ↑ / ↓; PgUp / PgDn; Home / End | Select, page, first/last item or field |
| ← / → | Reorder components and whole groups, or adjust a setting. Clear filters to reorder. |
| `/`; printable text; Backspace / Ctrl+U | Enter or update item search; delete/clear it |
| Ctrl+F | Choose a category |
| Ctrl+E / Ctrl+G | Open item details / return, cancel input or clear list filters |
| Ctrl+A / Ctrl+D / Ctrl+X | Open the catalog / copy / remove an instance on an item page |
| Enter | Activate the selected Settings row or open and accept field editing |
| E | Set the selected refresh interval to event-only in the draft |
| Ctrl+S | Save the display draft and exit outside input editing |
| Ctrl+K | Check saved state while a save outcome is unknown |
| Esc | Cancel a field or subview. At the top level, close a clean draft or confirm discarding changes, defaulting to keep editing. Available after rebinding Close. |
| Ctrl+C | Outside shortcut recording, restore the terminal, exit 130 and discard unsaved display edits |

On the **Refresh interval** row, Enter opens the editor with its current value. Press Ctrl+U to clear it, enter a whole number from 1 to 3600 seconds or `event`, and press Enter to accept it into the draft. Use the current **Save** shortcut to write the draft. **Set event-only refresh** defaults to E and can use another available key. Enter is reserved on this row.

### In-session Client

| Key | Action |
| --- | --- |
| Tab / Shift+Tab, 1 / 2 / 3 / 4 | Switch Main, Subagents, Layout and Settings outside input editing |
| ↑ / ↓; PgUp / PgDn; Home / End | Select, page, first/last item or field |
| ← / → | Reorder components and whole groups, or adjust a setting. Clear filters to reorder. |
| Enter / Space | Toggle components, operate settings or open and accept field editing |
| `/`; Ctrl+U; Ctrl+G | Enter search; clear input; cancel and restore its prior state |
| Ctrl+F | Choose a category |
| Ctrl+E / Ctrl+G | Open item details / return from the form or clear list filters |
| A / D / X | Open the catalog / copy / remove an instance on an item page |
| S / F / Q | Save and continue / save and finish / discard unsaved display edits and close |
| H / A | Expand Claude preferences in Settings / Apply those preferences separately |
| R / K / V | Discard/reload / check an unknown save outcome / retry sample preview |
| Esc | Return focus to Claude; use Ctrl+G to cancel Client input |

### Shared tools and preview controls

| Operation | Terminal / Client | Detailed workflow |
| --- | --- | --- |
| Quick setup | Ctrl+P in either editor outside item details | [Schemes and presets](SCHEMES.md#editor-quick-setup) |
| Undo | Terminal editor uses Ctrl+Z. Client uses Ctrl+/ and also accepts Ctrl+_. | [History and terminal conflicts](DRAFT_HISTORY.md) |
| Redo; changes and history | Ctrl+R; Ctrl+T | [Draft history and review](DRAFT_HISTORY.md#history-and-change-review) |
| Component groups | Ctrl+B | [Composition](COMPOSITION.md#component-groups) |
| Profiles and project targets | Ctrl+O outside item details | [Profiles](PROFILES.md) |
| Sources | Ctrl+Y | [Source management](EXTENSIONS.md#configure-with-either-editor) |
| Diagnose an input file | Ctrl+L | [Input diagnosis](DIAGNOSTICS.md#diagnose-a-file-from-either-editor) |
| Sample scenario / width / next preview row | Ctrl+V / Ctrl+W / Ctrl+N | [Sample preview](#sample-preview-and-colors) |

Return from a manager to the main editor to use draft history. On Unix, Claude may intercept Ctrl+Z to suspend the process; use the Client undo keys above. For the Client in GNOME Terminal, Ctrl+Shift+- also sends the undo key, while Ctrl+- zooms out. See the history guide for host limitations.

<a id="customize-keyboard-shortcuts"></a>

## Customize keyboard shortcuts

In either editor, open **Settings → Keyboard shortcuts**. The three buttons sit above the list and use shorter labels in narrow panes. Horizontal dividers mark the action groups. The **Active key** column shows the binding currently in use. At 80 columns and above, the list also shows **Default key**. Staged changes are marked in the list, and the selected action shows its active and pending values in the panel details. The open panel fits in 32×12.

Navigate with the arrows and page keys. Press `/` to filter by action name, page name, alias, action ID or key, such as `Data sources` or `Ctrl+Y`. Enter accepts the filter, Ctrl+G restores the previous selection and filter, and Ctrl+U clears the filter text while editing it. The footer below the panel shows the keys for the current operation.

1. Select an action, press Enter, and press the new key. Ctrl+G cancels recording. Delete restores the selected action to its preset.
2. Press Tab to focus **Save shortcuts** or Shift+Tab to focus **Read saved**. Use Left/Right to choose a button and Enter to run it. Press Tab again to return to the same list selection and filter. **Restore all defaults** stages the defaults. Choose **Save shortcuts** to apply them.
3. Resolve any conflicts shown before saving. You can swap two bindings and save them together. Separate pages can reuse a key when their actions cannot run at the same time. Ctrl+G goes back and asks before discarding staged changes.

The current editor applies the keys after the save is confirmed. In another open editor, choose **Read saved** in the shortcut panel or close and reopen the editor. The panel asks for confirmation before discarding staged changes to read the saved keys. If two editors change shortcuts concurrently, the later save reports a conflict. If a write is in progress or recovery is required, the open panel keeps its last confirmed bindings and staged changes. Follow the recovery message when shown, then choose **Read saved**. Shortcut preferences save independently from the display draft and its undo history. [Storage format](reference/cli.md#editor-shortcut-preferences)

Choose an ASCII letter, digit, symbol, or a distinguishable Ctrl+letter. Letter case is equivalent. Space, Enter, and Left/Right are available wherever they have no fixed role. Left/Right are reserved for paging in saved source checks, so choose a different key for source refresh. The source form requires Ctrl+letter for its save shortcut so ordinary text remains editable. Ctrl+D, Ctrl+X and Ctrl+Z can be assigned only to terminal-only actions because Claude can intercept them. In the terminal editor, trying Ctrl+C while recording rejects that key and keeps both drafts open. Ctrl+C interrupts the terminal editor outside recording.

Invalid preferences trigger a warning and load the presets. The editors retain usable overrides from supported older maps. If an older map uses Left/Right to refresh sources or Enter for event-only refresh, those actions use their R or E presets. Choose **Save shortcuts** to store the resulting map.

Rebinding Save replaces its preset keys, and Enter continues to confirm menu choices. Rebinding terminal Close adds the chosen key alongside Esc. In the terminal component list or catalog, bound characters run their actions and unbound characters filter the list. To include any bound letter or symbol in the query, use the current **Search** key shown on screen to open the input field. Its preset is `/`.

The tables on this page show presets. After a change, look at the footer or shortcut panel for active bindings. Your terminal and host must deliver the key to the editor for recording and dispatch. The Client cannot distinguish paste that the host delivers as an ordinary single-character key event.

<a id="text-input"></a>

## Text input

Text, search, numeric and file-path inputs support Left/Right, Home/End, insertion, Backspace and forward Delete, with horizontal scrolling. The caret highlights the next complete character in reverse video. The text stays in its original columns while the caret moves within the visible part of the field. A highlighted blank cell marks the caret in an empty field or at the end of the text.

Deletion preserves complete grapheme clusters. Ctrl+U clears input, Enter accepts and Ctrl+G cancels. Terminal Esc also cancels. In the Client, the host handles Esc. Refresh accepts a number or `event`.

Text/search allow 256 Unicode code points and paths 4096. The padding/refresh numeric buffers allow 32; other fields also enforce their own value rules. Oversized or control-containing insertions are rejected with a message, leaving the original value intact. Field input consumes ordinary characters instead of executing letter shortcuts.

Terminal bracketed paste and recognizable Client multi-character text do not execute shortcuts. Client's single-key API has no paste-origin flag: host-split single-character paste cannot reliably be distinguished from typing. Enter a field before pasting. [Unicode and terminal widths](COMPOSITION.md#unicode-text-and-terminal-widths).

<a id="find-items-and-inspect-requirements"></a>

## Find items and inspect requirements

Press `/` on Main/Subagents to enter a query; Enter accepts it, Ctrl+U clears it and Ctrl+G restores the previous query. The terminal editor also accepts direct typing; Esc cancels explicit search input. Search matches IDs, names and descriptions in all twelve languages, custom labels and categories in any interface language. Exact matches rank before prefixes, English initials (for example `mwe`), substrings and ordered subsequences; equal ranks preserve the existing order. Highlighting identifies the match, including an alternate-language snippet when needed.

Ctrl+F opens the category picker. Select with arrows and accept with Enter. **All categories** clears the category. In the configured list, Ctrl+G clears both filters and restores ordering. When there is no match, the list points to the catalog shortcut. The catalog inherits the list's query and category when it opens. Use Ctrl+U to clear the catalog query and Ctrl+F to change its category. Catalog filters stay in that view. Enter and Space add or enable the selected type in the draft and keep the catalog open. [Component catalog and instance controls](COMPOSITION.md#use-either-editor)

In the format form (Ctrl+E), open **Sources and requirements** with Enter. In the add-component catalog, Ctrl+E opens it directly. Start with **Data source and scope** and **When it appears**. Further down, look for possible reasons the value is missing, source field names, verified version requirements and setup or diagnostic commands. The page describes general conditions for the selected component.

Scroll with the arrow keys or Page Up/Down. Home and End jump to the beginning and end. Ctrl+G returns to the format form or catalog. Esc also returns in the terminal editor.

<a id="formats-and-layouts"></a>

## Formats and layouts

On Main/Subagents, select a component and press **Ctrl+E** to open its format. On **Label preset** or **Icon preset**, press **←/→** or **Enter** to cycle the built-in options. On **Custom label** or **Custom icon**, press **Enter** to edit and again to accept. A custom value takes priority over its preset. Enter `inherit` to follow the preset, or clear the field and confirm to hide the label or icon. Unicode and ASCII icon presets use built-in characters.

Use **Ctrl+G** to return. **Enter** also opens or accepts integer input for fields such as maximum width. Enter `none` to clear an optional width or limit.

Layout chooses auto/explicit and sets **New row before** boundaries for all configured main instances, including disabled instances. Starting a row in automatic layout opens a review of the switch to explicit layout. Accept to update the display draft, then Save to apply it. Higher priorities are retained first (default 50) and maximum width counts terminal columns. Reordering keeps row boundaries valid. When explicit rows are too narrow, scope decoration yields to real items, widths shrink and lower-priority items can be hidden. Explicit layout removes empty rows without adding continuation lines. Automatic layout wraps. [Components, groups and alignment](COMPOSITION.md).

<a id="presets-import-review-and-export"></a>

## Presets, import review and export

In Settings, choose a Preset, then activate **Expand selected preset**. It replaces the display draft and remains editable before Save. Ctrl+P opens the guided [Quick setup](SCHEMES.md#editor-quick-setup), which preserves the original draft when cancelled and does not enable collectors.

Import accepts a path and compares the file with the **current unsaved draft**. Sections cover item selection, retained-item order, formatting/overrides, layout, statusline language and host statusline settings. Arrows select sections, Enter expands details, Page Up/Down scrolls and Tab switches Main/Subagents candidate previews. **A accepts only into the draft; saving is separate.** Ctrl+G or Q cancels Client review; Esc or Ctrl+G cancels terminal review.

Invalid input or cancellation retains the previous draft. Acceptance uses the already-read candidate even if the source file changes, and retains the original save revision. Complete import replaces the complete draft. Selective import starts with nothing selected and supports explicit global options, the complete main section and/or the complete subagent section; unselected settings and their local bindings remain unchanged. [Selection and target rules](PROFILES.md#selective-import).

Export writes the current draft, including unsaved edits, to a new portable file without saving settings. Relative paths use the host/terminal working directory; `~` expands to the home directory. Errors retain the draft. Both editors refuse to overwrite an existing export; choose a new path or use the CLI's explicit `--overwrite` option. Portable files exclude interface language, collector switches and independent Claude preferences. [CLI import/export and installation ownership](USER_GUIDE.md#presets-and-portable-configuration).

<a id="sample-preview-and-colors"></a>

## Sample preview and colors

Preview uses the production renderer with fixed observations. It does not collect live Git, transcripts or account metrics. Ctrl+V changes scenario, Ctrl+W changes preview width and Ctrl+N scrolls preview rows; Settings also exposes these choices. These controls belong to the editor session. A sample cannot establish real field availability or successful integration.

Select a configured component, press Ctrl+E and open **Configuration and sample explanation**. **Reference examples** show typical output for the component type. The preview below renders the whole statusline for the current draft.

Read the draft state and the current sample's scenario and column width to see why the selected instance appears, is hidden, or is shortened. Agent sample rows report their outcomes individually. **Local setup** shows what the editor can establish from the installation, host version and collector settings. The explanation is read-only. For actual captured input, use [input diagnosis](DIAGNOSTICS.md).

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
| Save display | Ctrl+S saves and exits outside input editing. | S saves and continues. F saves successfully before closing. If Claude preferences have pending changes, the panel remains for a separate Apply. |
| Cancel display edits | Top-level Esc; confirm **Discard changes and close** if modified | Q discards unsaved display edits and closes |
| Unknown save outcome | Ctrl+K checks the submitted snapshot | K checks the submitted snapshot |

Enter inside a field accepts the field, and A inside import review accepts the candidate into the draft; neither is the final display save. Real saves check the target revision and installation ownership, back up actual changes and commit atomically. Unchanged configuration creates no backup. UI language changes, source operations and Claude Apply are independent effects outside display cancellation and undo.

Two editors can stay open. The first save succeeds; a stale revision is refused without overwriting newer settings. Conflict review retains the draft and supports comparison, export and explicitly reviewed retry or discard/reload. Use the [concurrent-edit workflow](DRAFT_HISTORY.md#concurrent-edits-and-unknown-saves); ordinary reload discards the draft rather than merging it.

While a save is pending or unknown, display/history mutations and ordinary closure are blocked, including already-open source/profile managers. Saved-state checks read the submitted target without saving again. A definitive result unlocks editing, and a conflict retains the draft. Read-only source inspection remains available. In Client, use Ctrl+G to return from the active page and then press K to check. The external editor offers Ctrl+K alongside the active page's return keys. On Client failure, Retry/Close buttons outside the pane recover while retaining drafts already received by the host. At narrow widths the header ellipsizes the editing target before those controls. [Troubleshooting](USER_GUIDE.md#troubleshooting).

<a id="claude-preferences-apply-separately"></a>

## Claude preferences apply separately

In Client Settings, press H to expand **Claude preferences**. Appearance, time/title and behavior rows use the types/options the current host actually supplies. Model, effort, thinking and fast mode are independent of their statusline display switches. Unavailable rows show the applicable official entry such as `/config`, `/model`, `/effort` or `/fast`.

Edit the supplied values, then press A to Apply separately. Per-row results cover refusal, locks, external changes and partial success. Save/Finish and portable files do not apply these preferences; display undo cannot reverse Apply. Reload explicitly discards pending edits. After recovery, click Client again before keyboard use. The terminal editor manages tool configuration and cannot call Claude's host preference API.

## Related guides

- [Draft history and reuse](DRAFT_HISTORY.md)
- [Profiles and project bindings](PROFILES.md)
- [Input diagnosis](DIAGNOSTICS.md)
