# Display schemes and project bindings

**English** | [简体中文](PROFILES.zh-CN.md)


For external source registration, authorization, refresh, diagnosis and sharing boundaries, see the [extensions guide](EXTENSIONS.md).

Save a named collection of complete display settings and reuse it across projects. Open either configuration editor and choose **Settings → Display schemes and projects**, or press **Ctrl+O**. The sample preview never changes saved settings.

## Choose an editing target

The editor opens the scheme selected for its working directory, or the user default when no binding matches. Its header identifies the editing target, matching root and number of shared project bindings. The target stays fixed during editing; switching a dirty draft offers Save, Discard and Cancel.

```sh
claude-statusline configure
claude-statusline configure --user
claude-statusline configure --profile "Daily development"
claude-statusline configure --project "/work/project"
```

Editing a named scheme updates every project bound to that scheme when you save. Choose **Save current display as and bind** for an independent copy. Renaming retains the scheme's stable identity. Delete requires removing its project bindings first.

**Use as default draft** loads a copy for review; ordinary Save activates it. The user default is an independent snapshot: subsequent edits to the named scheme do not change that default. Existing `config set`, `config preset`, `config import` and `config reset` commands continue to operate on the user default. Reset does not remove the personal collection.

Schemes contain display language, component instances and options, layouts, colors and subagent display settings. They do not contain interface language, collector switches, native/external editor preferences or Claude host preferences. Host fields shown in an editor remain user-level settings; copying or importing a scheme does not copy those fields.

## Manage schemes from the CLI

```sh
claude-statusline config profile list
claude-statusline config profile save "Daily development"
claude-statusline config profile preview "Daily development" --width 80
claude-statusline config profile rename "Daily development" "Development"
claude-statusline config profile activate "Development"
claude-statusline config profile export "Development" ./development.profile.json
claude-statusline config profile import ./development.profile.json --dry-run
claude-statusline config profile import ./development.profile.json --name "Imported"
claude-statusline config profile delete "Imported"
```

`save` copies the saved user default, not an unsaved editor draft. In an editor, **Save current display as** saves its current display draft. Names are case-sensitive, trimmed and NFC-normalized; they allow 1–128 Unicode code points without control characters. IDs are independent of names.

Existing names and export files require `--overwrite`. Import supports `--name` and `--dry-run`; dry-run validates and prints the display candidate without creating files. Inspection and management commands support `--json`. Place `--config-dir PATH` immediately after `config` to select another user configuration directory.

## Bind project roots

```sh
claude-statusline config project bind "/work/project" "Development"
claude-statusline config project list --json
claude-statusline config project resolve "/work/project/src" --json
claude-statusline config profile save "Independent" --bind "/work/other"
claude-statusline config project unbind "/work/project"
```

Binding a root that already selects another scheme requires `--overwrite`. Save-as and binding commit together. Bindings live in user configuration; no project file is read as executable configuration.

Resolution chooses the deepest registered ancestor of the current directory. It uses native real paths and directory identities, including symlink aliases and case-sensitive volumes. A sibling path such as `/work/project-old` does not match `/work/project`. Worktrees are ordinary independent roots: bind them explicitly if they live outside a registered root. No Git or hosting-service query is required.

The main statusline and all subagent rows use the session directory. They do not select separate schemes from each agent's working directory. Unbound paths, unavailable directories, conflicting aliases and missing schemes fall back to the user default. A missing scheme at a more specific root does not silently select a parent's scheme. `project resolve` and [input diagnosis](DIAGNOSTICS.md) report the selection reason.

Moving a project does not rewrite bindings: unbind the old path and bind the new root. A scheme cannot enable collection. When a bound scheme needs custom subagent rows, the tool coordinates its own display callback; a foreign renderer remains protected. A project with custom rows disabled keeps Claude's default rows.

## Files, conflicts and recovery

The version-1 `claude-statusline-profiles.json` file under the Claude user configuration directory contains the collection and bindings. It is created only by a save or binding operation. The existing `claude-statusline.json` remains the user default with display schema 15. Collection limits are 128 schemes, 512 bindings and 32 MiB.

A single exported scheme has format `claude-code-statusline-profile`, version 1, name and display. It contains no project roots or internal scheme ID and has a 1 MiB transfer limit. This is distinct from the existing `claude-code-statusline` portable envelope, which also carries tool host settings. Use the corresponding import command for each format.

Writes use the shared installation lock, revision checks, immutable backups and recovery journal. A concurrent edit is refused; reload and review instead of forcing an old draft over it. If a save response is lost, refresh saved state before another write. Corrupt collections are retained and reported, while rendering falls back safely.

Older versions continue to render the user-default snapshot and ignore the new collection. Before downgrading after an interrupted transaction, recover it with the newer version. Restore backups through the existing [recovery workflow](USER_GUIDE.md#troubleshooting); keep the collection for a later upgrade.

## Selective import

Use **S** in the portable import review to choose settings. Selection starts empty; Space toggles a choice, Enter returns to the difference review, F restores full import, and A accepts the reviewed draft. Save separately. In **Display schemes and projects**, choose **Import selected settings into current draft** for a single-profile file. The current editing target, including the shared-project notice, remains unchanged.

The CLI uses the matching file-format entry point:

```sh
claude-statusline config import display.json --select theme,palette --dry-run
claude-statusline config import display.json --select main --profile Work
claude-statusline config profile import scheme.json --select subagent,statusline_language --project /path/to/project --dry-run
```

`--select` accepts comma-separated exact keys: `main`, `subagent`, `use_colors`, `palette`, `theme`, `directory_style`, `separator_style`, `scope_labels`, `powerline_glyph`, `powerline.padding`, `powerline.separator`, `powerline.start_cap`, `powerline.end_cap`, `powerline.color_mode`, `statusline_language`, `formatting.model_name`, `formatting.number_format`, `formatting.labels`, `formatting.icons`, `formatting.allowance`, `formatting.reset_format`, `formatting.reset_timezone`, and `formatting.thresholds`. Thresholds are selected as one complete group. New fields do not automatically expand this list.

Main selection replaces its complete instances, groups, layout and metric settings. Subagent selection replaces its complete template and display controls. IDs are scoped: the same ID in main and subagents is legal; replacing a whole scope preserves its internal references without colliding with the retained scope. Duplicate IDs and incomplete references in the input are rejected before selection, even when their section is unselected.

Choose at most one of `--user`, `--profile NAME_OR_ID`, or `--project PATH`; omission means the user default. Project targets follow existing project resolution, including the user-default fallback. Named targets retain their name, ID and bindings; JSON results identify the target and affected shared projects. A selective profile import updates that target and cannot be combined with `--name` or `--overwrite`. The original full-profile import still creates a named copy.

Unselected settings and local source bindings are preserved. Imported scopes lose local bindings; source registrations and permissions are never imported. Selective import preserves host settings, UI language and warning thresholds unless the display thresholds are explicitly selected. Dry runs, review cancellation and invalid inputs write nothing. Concurrent saved edits refuse the old revision.

## Sample scenarios

`config profile preview NAME --scenario warning --width 80` previews a saved scheme with the selected deterministic observations. Omit `--scenario` for the normal sample. JSON includes its scenario identity; neither preview path writes display settings.

## Adaptive indicators and continuous backgrounds

Use `config instance main set context-remaining presentation adaptive` to enable adaptive indicators and `config set powerline-row-background-gradient lagoon` to choose a continuous background; `off` disables it. Backgrounds apply only to colored Powerline output. Custom labels/icons remain whole; a numeric representation that cannot fit is omitted. Auto layout retains ordinary wrapping.

New schemes are `powerline-daily`, `agent-workbench`, `quota-cost`, `narrow-terminal` and `light-readable`, compatible with v3.14.0 onward (display schema 17/protocol 30). Use existing preset/profile selection and import/export. Schemes cannot authorize sources. See [implementation and scenarios](development/adaptive-row-scenarios.md).
