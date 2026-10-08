# In-session Client configuration editor

**English** | [简体中文](native.zh-CN.md)

Since v1.3.0, the project provides Client TUI inside the current Claude Code terminal session. `/statusline-configure-native` opens this Mod pane; `/statusline-configure` retains the external curses TUI and platform launcher. Stable defaults both on, with independent preferences and version suspension.

## Source layout and checks

`mods/statusline-native` is the only native-editor Mod source; the installed plugin identity remains `statusline-native@claude-statusline-local`. `hooks/register.ts` owns host API calls, commands, backend requests, save lifetimes and serialized input batches. `lib/editor/` owns draft/order/numeric rules; `lib/client/` owns validated batches, keys and settings; `lib/session.ts` serializes independent snapshots. `ui/client/` owns surface input and drawing, `ui/components/` reusable sections, and `ui/layout.ts` the cell budget. Tests mirror backend, client, editor, integration and UI responsibilities. The Python curses UI and launcher remain separate and use the same configuration service.

`ui/client/help.ts` selects state-dependent footer controls and computes their wrapped row budget. Drawing and keyboard pagination both use `editorLayout`; complete hint wrapping lives in `ui/components/shortcuts.ts`. The heading uses the host theme accent for **Configure Status Line**. All idle page controls begin with Tab; Main/Subagents order is Tab, Space, selection arrows, ordering arrows, Ctrl+E and search. Settings offers H to show/hide preferences and A only when expanded; item forms offer Ctrl+G back. Filter retains its search entry. Editing offers accept/cancel/clear/delete, while ordinary letter shortcuts accept either ASCII case only outside editing and Ctrl/Meta combinations. Esc remains host-owned.

At 32×12, shorten hints and omit secondary V/R/Esc help before sacrificing current controls. Auxiliary detail/count rows yield space to the footer; the selected row and one actual sample row remain visible. Resizing retains state and recomputes both rendering and navigation from the same budget. These presentation changes do not modify protocol or configuration schemas.

Use Node.js 22, the matching development backend, and the fixed host builds in CI. Regenerate official declarations for each actual host; never reuse declarations from another build. The matrix checks Linux 2.1.287/2.1.288/2.1.289/2.1.294 and Windows/macOS 2.1.288/2.1.289/2.1.294.

```bash
npm ci --prefix mods/statusline-native --ignore-scripts --no-audit --no-fund
.venv/bin/python tools/prepare_mod_types.py
claude plugin validate --strict mods/statusline-native
claude plugin test mods/statusline-native
npm run --prefix mods/statusline-native typecheck
CLAUDE_STATUSLINE_NATIVE_EXECUTABLE="$PWD/.venv/bin/claude-statusline" claude --plugin-dir ./mods/statusline-native
```

Source loading exposes only `/statusline-configure-native`. Dependencies, generated host declarations and raw validation reports are excluded from runtime packages. No model call is required by ordinary checks.

## Theme rendering

`ui/theme.ts` centralizes host color roles. Normal text and bold keys use `text`; titles and active tabs use `suggestion`; regular descriptions and borders use `inactive`; errors use `error`. The main surface pairs `text` with `inverseText`, and selection reverses that pair explicitly. Avoid combining inactive colors with terminal dimming. The host resolves these tokens for its applied standard, daltonized, ANSI, auto and custom themes; editing a theme preference alone does not apply it. Recovery buttons use the supported primary variant and remain outside Client.

Preview content fills every cell with `#17191e`, including empty and overflow rows, with `#dedee7` for uncolored samples. Backend RGB/ANSI spans keep their original colors. Preview frame titles follow the host theme. No new display setting or protocol field is needed.

## Editor behavior

Click the Client region once after opening, then use the keyboard. Opening with `focus: true` does not establish Client keyboard focus in the tested Linux 2.1.288 host. Esc is not delivered to Client: first it returns input focus, then it can close the pane. Use Ctrl+G to cancel field editing. Saving or an unknown save outcome blocks ordinary closing.

| Key | Action |
| --- | --- |
| Tab / Shift+Tab; 1/2/3/4 | Change Main, Subagents, Settings and Layout page |
| Ctrl+E / Ctrl+G | Open selected item format / return to its item list |
| Up/Down; PgUp/PgDn; Home/End | Select, paginate, first/last row |
| Left/Right | Reorder item rows; adjust settings |
| Space / Enter | Toggle an item; operate a setting or enter/accept numeric editing |
| / | Enter search on an item page; Enter finishes search input |
| Ctrl+U / Ctrl+G | Clear input / restore the search or numeric value before editing |
| S / F / Q | Save and continue / save then finish / discard pending changes and close |
| H / A | Fold/unfold Claude preferences / apply them separately |
| R / K / V | Discard and reload / check an unknown save / retry sample preview |

During search/numeric editing, ordinary characters are input, including s/f/q; shortcuts resume after acceptance or Ctrl+G. Refresh accepts a number or `event`. Saving validates every numeric buffer. Enabled and disabled rows can move; filtered movement uses adjacent visible rows and preserves hidden rows' relative order. Only enabled item order is persisted. Subagent exclusions come from the shared catalog.

The pane requests 72 columns and 24 body rows; actual placement/space belongs to the host. Minimum usable body is 32×12. At 64×20 or larger, the content and preview have group borders. Compact panes use titled separators. Navigation, selected row, details, sample preview and action hints have distinct visual regions. Settings groups Appearance, Refresh / behavior, Git metrics, Formatting, Risk colors, Subagent visibility, Presets / portable files, and folded Claude preferences. Small panes retain the draft and offer resize/close. Increasing terminal height or the host's pane-resize chord may be necessary for inline placement.

Sample preview uses fixed data and production formatting, with at most three rows plus an overflow count. Draft or width changes request a new sample; height changes and navigation reuse it. Client input is sent as cumulative ordered batches, acknowledged and deduplicated. Port snapshots are deep copies because the host freezes them. Stale props, old epochs and late preview replies cannot replace current state.

Reexecuting the native command focuses the existing pane and keeps its draft. External TUI and Client may be open concurrently. Both save through the same short-lived file lock and opening revision: the first commit wins; a stale draft gets a conflict instead of overwriting. Client retains its draft on conflict; r explicitly discards/reloads. Unknown results require k, which reads without resubmitting or automatically closing.

Claude appearance, time/title and model/effort/thinking/fast behavior use actual `$.config.list()` rows. Apply rechecks locks/current values per row, reports partial results, and is separate from tool configuration. Finish does not silently discard pending preferences. On Client failure, received host-side drafts remain available. Retry/Close buttons remain outside Client so load failures can be recovered. Builds 2.1.287/2.1.288 do not provide the later `ui.fault` event; compatible recovery uses caught drawing errors and the native recovery buttons.

## Persistent installation and recovery

```bash
claude-statusline install --experimental-slash-tui --native-editor
claude-statusline doctor
```

Restart Claude Code in a trusted terminal, then use either command. `--experimental-slash-tui` and `--no-experimental-slash-tui` control only the external entry. `--native-editor` and `--no-native-editor` control only Client integration. Stable defaults both on, preserving recorded disablement; prereleases default both off. External needs 2.1.258+ and Client 2.1.287+. Older/unknown hosts suspend each independently; explicit enabling also does not fail basic installation for unsupported versions. Reinstall after upgrading restores support. External disablement saves schema-v1 false rather than deleting its file; historical absence follows the new stable default. Reinstall restores an enabled owned external skill/hook removed by older native migration. Mod no longer registers the external name or declares `primaryCommand`.

Native resources are staged under `CLAUDE_CONFIG_DIR/statusline-native`, verified by hash/version/protocol inventory, and installed through official local marketplace commands. The installer binds absolute backend/config paths and backend version. Backend and Mod must come from the same package version and protocol. Foreign native commands/resources block that integration; external collisions are checked when enabling the external entry. An unrelated external command does not block native-only installation. Altered owned caches are not adopted.

Native disablement removes only confirmed owned native plugin/marketplace resources. The external entry keeps its own preference and artifacts. Uninstall retains display configuration, preferences, backups and runtime data. Failed operations report actual disk state; doctor checks resources, binding and enablement separately from session loading. Externally disabled plugins stay disabled; only tool-recorded suspension is automatically restored. Safe/bare mode, managed policy and disableAllHooks can prevent Mod loading. Before package downgrade, disable native using the newer package, then install the older package.

On older/unrecognized hosts, a verified owned native plugin is suspended under the installation lock by changing only its enabledPlugins entry and tool suspension marker, with backups and rollback. This path does not call newer Mod APIs and does not turn user disablement into tool suspension. See [user installation combinations](../USER_GUIDE.md#editor-installation-combinations-and-compatibility).

## Linux acceptance

The automated Linux runner uses isolated configuration and sends only local slash commands. It records terminal cells, versions and source state; captures are reconstructions of actual terminal output, not OS screenshots or human acceptance. Persistent mode runs in a private tmux server, exercises Client and the original external popup, and verifies they read each other's saved configuration.

```bash
.venv/bin/python tools/native_mod_acceptance.py --persistent --report-dir dist/validation/client-stable-local
```

Record each fixed candidate's real loading, initial click, Space/Enter, page/order/search, numeric Ctrl+G, save/finish/cancel, Esc focus/close, narrow/CJK layout, preferences, conflicts and return to the same session. Windows/macOS human checks remain separate from CI.

## Stable acceptance record

The v1.2.0 UI passed the maintainer's Linux, Windows 11 and macOS 14.5 checklists before stable promotion. The original records remain in the v1.2.0 release documentation; unprovided architecture/terminal details remain unknown.

## v1.3.0 acceptance status

On 2026-10-04 the maintainer explicitly confirmed v1.3.0a1's redesigned native-control UI passed human acceptance on Linux, Windows and macOS. Additional architecture, terminal and host outputs were not supplied with this confirmation. The a1 and a2 human results are recorded separately.

On the same date the maintainer separately confirmed **v1.3.0a2 human acceptance passed on Linux, Windows and macOS**. No terminal, architecture, exact host versions or independent report accompanied this confirmation; those metadata remain unknown. Stable v1.3.0 retains a2 Client interaction, changing version/description and installation defaults/suspension policy. Regression, real Linux PTY, packaging and installation validate those changes separately. Automated checks are not human acceptance; no paid timer suite is run for this promotion.

## Claude Code 2.1.289 interaction report

Later on 2026-10-04 the maintainer supplied [three actual terminal screenshots](../images/archive/README.md#in-session-client-screenshots), each visibly showing Claude Code 2.1.289, and reported normal in-session Client use on Linux and Windows. On macOS the Client pane opens but interaction is not working correctly. The maintainer has not found or verified a working mouse configuration. Backend/source versions and exact OS, architecture and terminal-version metadata were not supplied for this report.

The earlier release acceptance records above retain their original scope. This later macOS result remains unresolved; an open pane or passing automated CI does not establish mouse delivery, keyboard focus or successful editing. [Official mouse reporting checks](../USER_GUIDE.md#macos-mouse-reporting-and-client-focus) are documented as suggestions, not a verified fix.

A follow-up macOS acceptance record should identify the host, backend and terminal versions, terminal mouse-reporting settings, and whether tmux/SSH is involved. Verify initial click, Tab/arrows/Space, save/reopen, discard and return to the same session before recording success. This documentation update does not supply a new macOS acceptance run.

References: [actual-build Mod types](https://code.claude.com/docs/en/plugins/mods/create), [official tests](https://code.claude.com/docs/en/plugins/mods/test), [local marketplaces](https://code.claude.com/docs/en/plugin-marketplaces).

## Phase 4 editor acceptance

Main/Subagents open scoped formats with Ctrl+E. Layout manages explicit boundaries, priorities and terminal-column widths. Settings expands presets and imports into an unsaved draft, exports that draft separately, and unfolds actual host appearance/time/title/behavior rows. Ctrl+G restores an input or returns from a scoped form; Enter accepts fields. Curses keeps legacy Enter saves and adds Ctrl+S for every page, using raw input to avoid XON/XOFF swallowing the chord.

Run `tools/native_mod_acceptance.py --persistent --advanced --report-dir dist/validation/<new-directory>` from an installed candidate wheel. It checks both persistent entries at 120×30 and 80×48, CJK label/path input, ANSI palette, explicit boundaries/priority/width saves, preset/export/import validation, cancellation without writes and cross-editor readback. Raw logs remain private. Human Linux/Windows and macOS available-entry acceptance was confirmed on 2026-10-05; the previously reported macOS Client input limitation remains open.

## v1.5.0 stable acceptance

On 2026-10-05 the maintainer confirmed Phase 4 human acceptance on Linux and Windows and on macOS through the standalone TUI/CLI. Exact OS, architecture, terminal and host versions were not supplied. This confirmation does not declare the earlier macOS in-session Client input problem fixed.

Stable changes package/Mod versions and release defaults; formatting, layout, portable files, host application and accepted input behavior remain those of the verified preview. Automated CI/PTYs and agent capture inspection remain independent evidence. Historical preview images keep their a1 filenames, capture hashes and original source commits.

## v1.6.0 stable acceptance

On 2026-10-05 the maintainer confirmed v1.6.0a1 acceptance on Linux, Windows and macOS. Exact OS, architecture, terminal and host versions were not supplied. This is the new Phase 5 acceptance record, separate from historical editor confirmation and automated/headless/PTY evidence. The existing macOS Client input limitation remains documented. Stable v1.6.0 retains the accepted runtime implementation, display schema v4, configuration protocol v3 and runtime protocol v1. Editor entries default on for compatible hosts, preserving explicit false; live collection remains independently opt-in and preserves its preference.
