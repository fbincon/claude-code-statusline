# Components and layout

**English** | [简体中文](COMPOSITION.zh-CN.md)

See [configuration editors](EDITORS.md) for full keyboard controls, preview and save operations. After installation, build or adjust the layout in either editor and save the display draft.

Shared undo/redo, current-file comparison, reviewed alignment repairs and selected style/whole-group reuse are described in [draft history and reuse](DRAFT_HISTORY.md).

A component type describes a value, such as a model or token count. An instance
places that component in your statusline. Add the same type more than once to
show different labels, formats, colors, conditions or widths. Each copy keeps its
own settings and identity when you save, reopen or export it.

Existing installations and new defaults keep their familiar display. Choose the
**Left and right** or **Repeated metrics** preset to try composition; a preset
replaces the display draft in an editor and takes effect when you save.

## Contents

- [Use either editor](#use-either-editor)
- [Unicode text and terminal widths](#unicode-text-and-terminal-widths)
- [Static text and flexible space](#static-text-and-flexible-space)
- [Component groups](#component-groups)
- [Align corresponding columns across main rows](#align-corresponding-columns-across-main-rows)
- [Adaptive indicators and continuous backgrounds](#adaptive-indicators-and-continuous-backgrounds)
- [CLI](#cli)
- [Migration, transfer and recovery](#migration-transfer-and-recovery)

## Use either editor

Open `/statusline-configure-native` inside Claude Code, or run
`claude-statusline configure` in a terminal. Main and Subagents list the instances
you have configured, including disabled ones. A suffix such as `(2)` distinguishes
instances of the same type; it follows their current order.

| Action in Main or Subagents | Native / external |
| --- | --- |
| Open the component picker | A / Ctrl+A |
| Copy the selected instance | D / Ctrl+D |
| Remove the selected instance from the draft | X / Ctrl+X |
| Enable or disable | Space |
| Edit the selected instance | Ctrl+E |
| Move the selected instance | Left / Right |
| Search / choose category | `/` / Ctrl+F |

The add picker searches names, descriptions and categories in all supported languages.

- **In the add picker:** Enter adds the selected type after the previously selected instance. Ctrl+E opens the type's read-only sources and requirements, whether or not it already has instances. Ctrl+G returns from guidance or cancels the picker.
- **In the configured list:** Ctrl+E edits the selected instance. A successful addition clears this list's filter so the new instance is visible. Clear the filter before reordering.

Copying retains all options and creates a new identity. Disabling keeps the row
position. Removing a component updates its row references and removes empty rows.
An invalidated alignment can open the [structural review](DRAFT_HISTORY.md#structural-edits-and-alignment) before the draft changes.
All these operations edit the draft. Native S / F or external Ctrl+S saves; the
existing close/cancel controls discard unsaved edits. Claude host preferences
still have their own Apply action. Resize, language changes and save conflicts
preserve the draft.

Native uses letter keys A/D/X because the host can intercept control chords such as Ctrl+D. Letters remain literal while searching or editing text.

Types with exclusions remain exclusive: for example, disable `status-elapsed`
before enabling a separate `status` or `elapsed`. A conflicting addition or copy
leaves the draft unchanged and explains the conflict.

<a id="unicode-text-and-terminal-widths"></a>

## Unicode text and terminal widths

Wrapping, truncation and editor previews keep extended grapheme clusters together, including combining accents and joined emoji. Ambiguous characters use one column; ordinary CJK and emoji clusters use two. The layout policy is fixed across supported runtimes and editors. Actual glyph appearance still depends on your terminal and fonts.

Truncation ends at a complete grapheme boundary and appends `…`; saved labels, icons and paths remain intact. Backspace removes a complete text cluster. Palette changes belong to the display draft; the native light/dark preview background remains an independent UI preference.

## Static text and flexible space

`text` displays up to 256 Unicode code points of literal text. It supports labels,
icons, foreground/background colors, priority and maximum width. Line breaks,
terminal escapes and other control characters are rejected. Text such as
`${model}` stays literal; it is neither expanded nor translated.

`spacer` fills the remaining fitted cells. A spacer between two groups separates
left and right content; a leading spacer right-aligns content, and a trailing
spacer left-aligns it. Spacers have no colors, metric conditions or width options.

- Main auto layout supports text and retains automatic wrapping. Switch Layout
  to explicit rows before adding a spacer.
- Each explicit main row and the single-row subagent template accepts at most
  one spacer, including disabled spacers. Remove spacers before returning main
  layout to auto.
- Each instance belongs to one position. Copy an instance to show it elsewhere.
  Row boundaries retain disabled instances, which return to that position when
  re-enabled. New instances grow the insertion row.
- Under width pressure, flexible whitespace collapses first. Content then follows
  priority, maximum width and whole-grapheme clipping. Alignment never creates
  continuation rows or reorders Agents.
- Hidden content, empty text and spacer-only rows emit no blank statusline rows.
  Nonempty text can render independently. Powerline boundaries are recomputed
  after fitting; flexible gaps use the terminal default background.

Subagent templates repeat independently for each Agent. Their component instance
IDs are separate from the Agent IDs in the host protocol. Both scopes share raw
observations for repeated components and format each instance separately, so
copying a component does not duplicate transcript scans, Git calls or usage totals.

## Component groups

Open **Component groups** in Settings or press **Ctrl+B** in either editor. Select the main line or subagent template, then create a group by choosing its first/last members and primary metric. Arrows select/adjust; Enter on **Apply to draft** previews the change. Close the panel and use the usual display Save. Canceling a form leaves its previous draft intact.

Groups contain at least two consecutive instances in one scope; explicit layouts must place the whole group on one explicit row. They cannot overlap, nest or contain a spacer. Decorations follow the primary's final visibility by default, including layout omission; other metrics retain their own conditions. If linked visibility is turned off, decoration remains independent. Auto layout keeps the group on one row and trims decoration/secondary metrics before its primary. A group's omission priority is its primary's priority.

Sharing Powerline creates one block with the primary's background; foreground/threshold colors remain per member. Member backgrounds are retained for use after sharing is disabled. Ordinary grouped content uses a space between members. Group actions edit, move the whole group, copy with new IDs and ungroup. Deleting the primary dissolves the group and retains surviving instances; affected alignments require structural review. Copying an individual member inserts a standalone copy after its group. Operations without a valid candidate retain the draft.

```bash
claude-statusline config group main list --json
claude-statusline config group main create cost-block --members LABEL_ID,COST_ID --primary COST_ID --powerline on
claude-statusline config group main set cost-block linked on
claude-statusline config group main copy cost-block
claude-statusline config group main move cost-block --before OTHER_ID
claude-statusline config group main ungroup cost-block
```

Replace uppercase placeholders with IDs from `config instance main list`. `subagent` uses the same operations. `set` supports `primary`, comma-separated `members`, `linked on|off`, and `powerline on|off`. Profile saves/copies and portable export preserve groups; no source access or automatic refresh is granted. [Implementation and acceptance](development/history/deliveries/m4-m7-delivery.md).

## Align corresponding columns across main rows

In **Layout → Align explicit main rows**, create a relationship, then select one
component or whole group per participating row for each column. Use Left/Right
to choose, **Add column** for another column and **Apply to draft** to accept the
relationship. The usual Save persists it. Cancel leaves the previous draft
unchanged. The selectors show stable IDs so repeated component types remain
independent.

Each column requires at least two distinct explicit main rows. A row contributes
at most one unit to a column, and columns follow the same physical order in each
row. A grouped member must be selected as its whole group. Units cannot be reused
by another column. A relationship owns the participating left or right side of a
row; overlapping relationships on that same side are rejected. Auto-wrapped rows,
subagent templates and relationships across scopes are excluded.

Widths are measured after visibility and per-component maximum-width rules.
Each column uses the widest visible member. Hidden members retain that column's
slot when other visible rows need it; a wholly hidden column collapses and an
empty row emits no output. Both sides of a spacer are measured independently;
the spacer receives remaining width and right-side columns retain their right
anchor. Powerline units retain complete blocks and caps, with default-background
spacing between them. No isolated separator or cap represents a hidden member.

If the added alignment spaces would make any participating row too wide, its
related rows render without those spaces for that frame, using the existing
priority, decoration and whole-grapheme fitting rules. A disabled structural
spacer also causes this fallback. Explain/diagnose reports `alignment_collapsed`;
wide frames report `alignment_active`. Relationships sharing a physical row
share its width budget and fall back together.

```sh
claude-statusline config alignment list
claude-statusline config alignment set summary --columns 'instance:ROW1_MODEL,instance:ROW2_MODEL;group:ROW1_USAGE,group:ROW2_USAGE'
claude-statusline config alignment remove summary
```

Replace the uppercase IDs with your configured units. Commas join members of one
column; semicolons separate columns. Ordinary instance/group copies do not join
existing relationships. Complete scheme copies and main-section transfers retain
all referenced units together.

Deletion, movement, ungrouping or row/mode changes can invalidate relationships. The editor can show a complete valid candidate and affected relationship IDs in structural review: **A** accepts the action and repairs as one undoable edit; **Q** or Escape cancels without changing the draft. An intervening draft change invalidates the proposal. CLI commands refuse unapproved repairs; review and explicitly accept them:

<!-- docs-example: alignment-review -->
```text
claude-statusline config instance main remove INSTANCE_ID --dry-run
claude-statusline config instance main remove INSTANCE_ID --expected-revision TARGET_REV --accept-alignments ALIGNMENT_IDS
```

Replace `INSTANCE_ID` with the selected instance; use the returned `expected_revision` and exact comma-separated repair IDs for the other placeholders. `config group` and `config layout` support the same review flags. An invalid candidate, changed revision or mismatched repair list is refused without changing the saved configuration. You can instead edit/remove the relationship yourself. [Structural review details](DRAFT_HISTORY.md#structural-edits-and-alignment).

The default layout does not enable alignment. Some complete schemes, such as
`quota-cost`, include explicit alignment relationships; review the candidate
before applying it.

## Adaptive indicators and continuous backgrounds

Adaptive indicators take part in width fitting while retaining custom labels, icons and percentage meaning; automatic layout retains normal wrapping. Continuous backgrounds apply only to colored Powerline output. Spacers and explicit backgrounds break gradient runs, while alignment padding stays uncolored. See [appearance controls](APPEARANCE.md#adaptive-indicators) and [continuous row backgrounds](APPEARANCE.md#continuous-row-backgrounds) for the complete options and paint rules.

Choose a layout example from the [complete schemes](SCHEMES.md) and review its candidate. Schemes grant no source permissions. The current rules are above and in [appearance controls](APPEARANCE.md#adaptive-indicators); the original v3.14.0 scenarios and compatibility evidence remain in the [historical implementation and scenarios record](development/history/deliveries/adaptive-row-scenarios.md).

## CLI

Commands use the same validated configuration transaction as the editors.
`main` and `subagent` select a scope; instance IDs are opaque and are shown by
`list --json`. Type names and IDs are never translated.

```sh
claude-statusline config preset left-right
claude-statusline config instance main list --json
claude-statusline config instance main copy context-remaining
```

A real `config preset` or instance write requires this tool to own the installed status line; `--dry-run` does not. Complete [setup](SETUP.md) first when necessary.

The copy command prints the new ID after the save result. Use that ID in these
commands, replacing `INSTANCE_ID` with the value from your configuration:

```sh
claude-statusline config instance main set INSTANCE_ID label Context
claude-statusline config instance main set INSTANCE_ID max-width 24
claude-statusline config instance main disable INSTANCE_ID
claude-statusline config instance main enable INSTANCE_ID
claude-statusline config instance main move INSTANCE_ID --before git
claude-statusline config instance main remove INSTANCE_ID
claude-statusline config instance main add text --text 'Project ◆'
```

`add TYPE_ID [--after INSTANCE_ID] [--text TEXT]` appends when no anchor is given.
`copy INSTANCE_ID` inserts immediately after its source; when the source belongs
to a group, the copy is inserted after the whole group. `move` requires exactly
one `--before` or `--after` anchor. `set` accepts existing item options, including
`number-format` for supported numeric components such as `tokens` and
`context-window-size`, and `text` for literal-text components. Use the
corresponding `subagent` scope for its single-row template.

To specify main rows by instance identity, use
`config layout --by-instance explicit ROW...`, with comma-separated IDs in each
row argument. Include all configured instances, including disabled ones, exactly
once in instance order. Layout can also be edited interactively. For example,
immediately after applying the unmodified left/right preset:

```sh
claude-statusline config layout --by-instance explicit model-with-effort,git,spacer,context-remaining
```

Legacy type commands remain useful for uniquely matched metrics. They reject
ambiguous matches. Bulk type-based selection/order/layout commands reject
compositions with repeated types, text or spacers; use instance commands or an
editor to preserve the complete composition. Type catalog JSON adds
`instance_ids`, `enabled_instance_ids` and `instance_only`; `position` is null
when there is no unique enabled placement.

Unique type-based enable/disable commands preserve existing positions in explicit rows or compositions. A simple automatic type selection retains the historical append order when enabling a disabled metric. Instance enable/disable always preserves placement.

## Migration, transfer and recovery

Current versions and read ranges are in [protocol and schema versions](reference/cli.md#protocol-and-schema-versions). The current display schema stores ordered instances, groups, optional explicit-row
alignment and adaptive presentation; the current editor protocol requires matching
TypeScript and bundled native resources. Portable/profile envelopes and UI preferences evolve independently from the runtime observation protocol.

Supported older display schemas normalize in memory. The canonical type ID within
each scope provides a deterministic migration identity. Enabled order, explicit
rows, languages and disabled-type overrides are retained. Reading, previewing and
import review do not migrate the saved file. An actual save or installation uses
the existing backup and atomic transaction before persisting the new schema.

Exports retain IDs, options and row references. Import review distinguishes added,
removed, enabled, disabled, reordered and edited instances. Accepting an import
only replaces the draft; saving still checks the original revision. If another
editor changed the configuration, reconcile or reload before saving.

Before a downgrade, restore the compatible pre-upgrade configuration backup
with `recover --restore-config BACKUP_ID`. The version manager refuses
incompatible display schemas and refreshes verified owned Mod resources and
bindings before installing an older backend. Preserve the current
configuration separately if you intend to upgrade again. Repeated instances and
flexible layouts cannot be converted losslessly to an older schema; changing the
schema number by hand is not a migration. See the [upgrade guide](USER_GUIDE.md#upgrading).

## Related guides

- [Appearance](APPEARANCE.md)
- [Built-in display schemes](SCHEMES.md)
- [Draft history and reuse](DRAFT_HISTORY.md)
