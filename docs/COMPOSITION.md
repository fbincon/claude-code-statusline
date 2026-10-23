# Components and layout

**English** | [简体中文](COMPOSITION.zh-CN.md)

A component type describes a value, such as a model or token count. An instance
places that component in your statusline. Add the same type more than once to
show different labels, formats, colors, conditions or widths. Each copy keeps its
own settings and identity when you save, reopen or export it.

Existing installations and new defaults keep their familiar display. Choose the
**Left and right** or **Repeated metrics** preset to try composition; a preset
replaces the display draft in an editor and takes effect when you save.

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

The picker searches names, descriptions and categories in all supported
languages. Enter adds the selected type after the previously selected instance;
Ctrl+E shows its sources and requirements before adding. Ctrl+G returns from the
guidance or cancels the picker. Accepting an addition clears the old list filter
so the new instance is visible. Reordering requires an unfiltered list.

Copying retains all options and creates a new identity. Disabling keeps the row
position. Removing a component updates its row references and removes empty rows.
All these operations edit the draft. Native S / F or external Ctrl+S saves; the
existing close/cancel controls discard unsaved edits. Claude host preferences
still have their own Apply action. Resize, language changes and save conflicts
preserve the draft.

Native uses letter keys A/D/X because the host can intercept control chords such as Ctrl+D. Letters remain literal while searching or editing text.

Types with exclusions remain exclusive: for example, disable `status-elapsed`
before enabling a separate `status` or `elapsed`. A conflicting addition or copy
leaves the draft unchanged and explains the conflict.

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

## CLI

Commands use the same validated configuration transaction as the editors.
`main` and `subagent` select a scope; instance IDs are opaque and are shown by
`list --json`. Type names and IDs are never translated.

```sh
claude-statusline config preset left-right
claude-statusline config instance main list --json
claude-statusline config instance main copy context-remaining
```

The copy command prints the new ID after the save result. Use that ID in these
commands, replacing `INSTANCE_ID` with the value from your configuration:

```sh
claude-statusline config instance main set INSTANCE_ID label Context
claude-statusline config instance main set INSTANCE_ID number-format full
claude-statusline config instance main disable INSTANCE_ID
claude-statusline config instance main enable INSTANCE_ID
claude-statusline config instance main move INSTANCE_ID --before git
claude-statusline config instance main remove INSTANCE_ID
claude-statusline config instance main add text --text 'Project ◆'
```

`add TYPE_ID [--after INSTANCE_ID] [--text TEXT]` appends when no anchor is given.
`copy INSTANCE_ID` inserts immediately after its source. `move` requires exactly
one `--before` or `--after` anchor. `set` accepts existing item options and `text`
for literal-text components. Use the corresponding `subagent` scope for its
single-row template.

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

Display schema 8 stores ordered instances; editor protocol 12 requires matching
Python and bundled native resources. The portable envelope remains version 1,
UI preferences version 1, and runtime observation protocol version 2.

Supported display schemas 1–7 normalize in memory. The canonical type ID within
each scope provides a deterministic migration identity. Enabled order, explicit
rows, languages and disabled-type overrides are retained. Reading, previewing and
import review do not migrate the saved file. An actual save or installation uses
the existing backup and atomic transaction before persisting the new schema.

Exports retain IDs, options and row references. Import review distinguishes added,
removed, enabled, disabled, reordered and edited instances. Accepting an import
only replaces the draft; saving still checks the original revision. If another
editor changed the configuration, reconcile or reload before saving.

Before a downgrade, use the current package to remove incompatible native editor
resources, then restore the compatible pre-upgrade configuration backup and
install the older package and its matching resources. Preserve the current
configuration separately if you intend to upgrade again. Repeated instances and
flexible layouts cannot be converted losslessly to an older schema; changing the
schema number by hand is not a migration. See the [upgrade guide](USER_GUIDE.md#upgrading).

## Component groups

Open **Component groups** in Settings or press **Ctrl+B** in either editor. Select the main line or subagent template, then create a group by choosing its first/last members and primary metric. Arrows select/adjust; Enter on **Apply to draft** previews the change. Close the panel and use the usual display Save. Canceling a form leaves its previous draft intact.

Groups contain at least two consecutive instances in one scope and one explicit row. They cannot overlap, nest or contain a spacer. Decorations follow the primary's final visibility by default, including layout omission; other metrics retain their own conditions. If linked visibility is turned off, decoration remains independent. Auto layout keeps the group on one row and trims decoration/secondary metrics before its primary. A group's omission priority is its primary's priority.

Sharing Powerline creates one block with the primary's background; foreground/threshold colors remain per member. Member backgrounds are retained for use after sharing is disabled. Ordinary grouped content uses a space between members. Group actions edit, move the whole group, copy with new IDs and ungroup. Deleting the primary dissolves the group and retains surviving instances. Copying an individual member inserts a standalone copy after its group. Invalid moves retain the draft.

```bash
claude-statusline config group main list --json
claude-statusline config group main create cost-block --members LABEL_ID,COST_ID --primary COST_ID --powerline on
claude-statusline config group main set cost-block linked on
claude-statusline config group main copy cost-block
claude-statusline config group main move cost-block --before OTHER_ID
claude-statusline config group main ungroup cost-block
```

Replace uppercase placeholders with IDs from `config instance main list`. `subagent` uses the same operations. `set` supports `primary`, comma-separated `members`, `linked on|off`, and `powerline on|off`. Profile saves/copies and portable export preserve groups; no source access or automatic refresh is granted. [Implementation and acceptance](development/m4-m7-delivery.md).
