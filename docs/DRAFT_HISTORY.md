# Draft history, structural review and reuse

**English** | [简体中文](DRAFT_HISTORY.zh-CN.md)

Both `claude-statusline configure` and `/statusline-configure-native` share the same draft rules. The external editor uses **Ctrl+Z** to undo; Native uses **Ctrl+_** (often Ctrl+Shift+-). Both use **Ctrl+R** to redo, and **Ctrl+T** or Settings → **Changes and history** to review changes. That page also offers **U** undo and **R** redo. These controls apply outside active text inputs and other managers.

Claude's Unix host intercepts Ctrl+Z to suspend the entire process before Native receives it, as observed on 2.1.312 and described in [Claude's terminal conflicts](https://code.claude.com/docs/en/keybindings#terminal-conflicts). Native retains Ctrl+Z handling for hosts that forward it; the installer does not modify Claude's global keybindings.

## History and change review

One accepted component, form, color, layout, group, preset or import action is one history step. Numeric typing may preview a temporary value; Enter accepts one action and cancellation restores the original value. No-op edits and cancelled reviews add no history. Editing after undo removes the redo branch.

History belongs to the current editor session and target. It retains at most 100 steps and 16 MiB of serialized snapshots, then drops the oldest records with a notice. A confirmed save or explicit discard/reload establishes a new boundary. Reopening the editor starts with no history. UI language, source authorization, command execution and Claude's independent Apply are separate effects; undo cannot reverse them.

The review compares the saved baseline with the unsaved draft. Enter expands a section and Page Up/Down scrolls details. Preview uses the production renderer with sample observations. Review alone never saves configuration.

## Concurrent edits and unknown saves

A save conflict keeps the draft and history. **C** reads the current configuration for the same target; **Tab** switches baseline → draft, baseline → current file, and current file → draft. **E** exports the draft to a new portable file, stripping machine authorization bindings.

**L** requests discard/reload and requires explicit Enter confirmation. **K** retains the draft and adopts the reviewed revision; use the normal Save action to retry. A later concurrent change rejects that save again. Changed target identity, profile resolution or installation ownership blocks this retry. Export or explicitly reload instead.

An unknown save outcome freezes draft/history changes until the existing saved-state check resolves it. Comparison and export remain available. Neither retry nor reload bypasses ownership, revision, transaction or recovery checks.

## Structural edits and alignment

Deleting a referenced component, dissolving a group, grouping aligned instances or changing rows may open a structural review. It lists the affected relationships and previews a complete valid candidate. Missing references and columns with fewer than two remaining references are removed. Relationships that still violate row, spacer-side or ordering constraints are proposed for removal. Unrelated relationships remain intact; no replacement component is guessed.

**A** accepts the structural action and its reference repairs together as one undoable step. **Q** or Escape cancels. A changed draft invalidates the proposal. CLI structural commands retain their default refusal and expose explicit review:

```bash
claude-statusline config instance main remove b --dry-run
claude-statusline config instance main remove b \
  --expected-revision TARGET_REV --accept-alignments table
```

Replace `TARGET_REV` and `table` with the revision and exact affected relationship IDs returned by review. `config group` and `config layout` support the same controls. The final revision check occurs inside the configuration lock.

## Copy visual styles

Open a destination component's details and choose **Copy / paste visual style**. Select the current draft, a portable file, a profile export or a saved profile as the source, then select a source component and the visual fields to copy. Incompatible fields are visible and cannot be selected.

The whitelist includes foreground/background colors, both gradients, label, icon and supported formatting overrides. Inherited values restore inheritance. Metric type, source binding, literal text, order, priority, width and visibility stay with the destination. Review the selected differences and accept with **A**, then save separately.

```bash
claude-statusline config import source.json \
  --style-from main:source --style-to main:destination \
  --style-fields foreground,background,label --dry-run
```

To apply the same selection, repeat it with `--expected-revision TARGET_REV --source-revision SOURCE_REV` from the review. A changed source file or target revision is refused. Use `--profile-file` for a single-profile envelope, or the equivalent `config profile import` entry. Target controls are `--user`, `--profile NAME` or `--project PATH`.

## Reuse complete groups

Settings → **Reuse complete groups** adds selected groups with new component, group and alignment IDs. It retains primary members, linked visibility, shared Powerline backgrounds and necessary rows/spacers. Existing explicit rows are retained and imported fragments are appended.

Outside references require a decision: **X** cycles review, expand dependencies and exclude outside alignments. **L** separately allows conversion from automatic to explicit layout when needed. Without those decisions, an incomplete candidate cannot be accepted. **Tab** switches between IDs/dependencies and semantic differences; both lists are paged. **A** accepts one draft action; **Backspace** returns to selection.

```bash
claude-statusline config import source.json --groups main:group-id \
  --references expand --explicit-layout --dry-run
```

Apply using the returned target and source revisions as above. Cross-configuration imports clear local source bindings and list unresolved references. After accepting, **B** opens the existing source manager to explicitly choose compatible local source types and scopes. Sources can remain unbound. Binding does not enable a source, approve automatic execution or refresh it. Same-draft ordinary group copies retain their existing local binding behavior.

See [composition](COMPOSITION.md), [appearance](APPEARANCE.md), [sources](EXTENSIONS.md) and the [CLI reference](reference/cli.md).
