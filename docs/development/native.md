# In-session Client configuration editor

**English** | [简体中文](native.zh-CN.md)

v1.3.0 ships Client TUI inside the current Claude Code terminal session. `/statusline-configure-native` opens this Mod pane; `/statusline-configure` retains the external curses TUI and platform launcher. Stable defaults both on, with independent preferences and version suspension.

## Source layout and checks

`mods/statusline-native` is the only Mod source; the installed plugin identity remains `statusline-native@claude-statusline-local`. `hooks/register.ts` owns host API calls, commands, backend requests, save lifetimes and serialized input batches. `lib/editor/` owns draft/order/numeric rules; `lib/client/` owns validated batches, keys and settings; `lib/session.ts` serializes independent snapshots. `ui/client/` owns surface input and drawing, `ui/components/` reusable sections, and `ui/layout.ts` the cell budget. Tests mirror backend, client, editor, integration and UI responsibilities. The Python curses UI and launcher remain separate and use the same configuration service.

Use Node.js 22, the matching development backend, and the fixed host builds in CI. Regenerate official declarations for each actual host; never reuse declarations from another build. The matrix checks Linux 2.1.287/2.1.288 and Windows/macOS 2.1.288.

```bash
npm ci --prefix mods/statusline-native --ignore-scripts --no-audit --no-fund
.venv/bin/python tools/prepare_mod_types.py
claude plugin validate --strict mods/statusline-native
claude plugin test mods/statusline-native
npm run --prefix mods/statusline-native typecheck
CLAUDE_STATUSLINE_NATIVE_EXECUTABLE="$PWD/.venv/bin/claude-statusline" claude --plugin-dir ./mods/statusline-native
```

Source loading exposes only `/statusline-configure-native`. Dependencies, generated host declarations and raw validation reports are excluded from runtime packages. No model call is required by ordinary checks.

## Editor behavior

Click the Client region once after opening, then use the keyboard. Opening with `focus: true` does not establish Client keyboard focus in the tested Linux 2.1.288 host. Esc is not delivered to Client: first it returns input focus, then it can close the pane. Use Ctrl+G to cancel field editing. Saving or an unknown save outcome blocks ordinary closing.

| Key | Action |
| --- | --- |
| Tab / Shift+Tab; 1/2/3 | Change Main, Subagents and Settings page |
| Up/Down; PgUp/PgDn; Home/End | Select, paginate, first/last row |
| Left/Right | Reorder item rows; adjust settings |
| Space / Enter | Toggle an item; operate a setting or enter/accept numeric editing |
| / | Enter search on an item page; Enter finishes search input |
| Ctrl+U / Ctrl+G | Clear input / restore the search or numeric value before editing |
| s / f / q | Save and continue / save then finish / discard pending changes and close |
| h / a | Fold/unfold Claude preferences / apply them separately |
| r / k / v | Discard and reload / check an unknown save / retry sample preview |

During search/numeric editing, ordinary characters are input, including s/f/q; shortcuts resume after acceptance or Ctrl+G. Refresh accepts a number or `event`. Saving validates every numeric buffer. Enabled and disabled rows can move; filtered movement uses adjacent visible rows and preserves hidden rows' relative order. Only enabled item order is persisted. Subagent exclusions come from the shared catalog.

The pane requests 72 columns and 24 body rows; actual placement/space belongs to the host. Minimum usable body is 32×12. At 64×20 or larger, the content and preview have group borders. Compact panes use titled separators. Navigation, selected row, details, sample preview and action hints have distinct visual regions. Settings groups Appearance, Refresh / behavior, and folded Claude preferences. Small panes retain the draft and offer resize/close. Increasing terminal height or the host's pane-resize chord may be necessary for inline placement.

Sample preview uses fixed data and production formatting, with at most three rows plus an overflow count. Draft or width changes request a new sample; height changes and navigation reuse it. Client input is sent as cumulative ordered batches, acknowledged and deduplicated. Port snapshots are deep copies because the host freezes them. Stale props, old epochs and late preview replies cannot replace current state.

Reexecuting the native command focuses the existing pane and keeps its draft. External TUI and Client may be open concurrently. Both save through the same short-lived file lock and opening revision: the first commit wins; a stale draft gets a conflict instead of overwriting. Client retains its draft on conflict; r explicitly discards/reloads. Unknown results require k, which reads without resubmitting or automatically closing.

Theme/verbose use actual `$.config.list()` rows. Apply rechecks locks/current values per row, reports partial results, and is separate from tool configuration. Finish does not silently discard pending preferences. On Client failure, received host-side drafts remain available. Retry/Close buttons remain outside Client so load failures can be recovered. Builds 2.1.287/2.1.288 do not provide the later `ui.fault` event; compatible recovery uses caught drawing errors and the native recovery buttons.

## Persistent installation and recovery

```bash
claude-statusline install --experimental-slash-tui --native-editor
claude-statusline doctor
```

Restart Claude Code in a trusted terminal, then use either command. `--experimental-slash-tui` and `--no-experimental-slash-tui` control only the external entry. `--native-editor` and `--no-native-editor` control only Client integration. Stable defaults both on, preserving recorded disablement; prereleases default both off. External needs 2.1.258+ and Client 2.1.287+. Older/unknown hosts suspend each independently; explicit enabling also does not fail basic installation for unsupported versions. Reinstall after upgrading restores support. External disablement saves schema-v1 false rather than deleting its file; historical absence follows the new stable default. Reinstall restores an enabled owned external skill/hook removed by older native migration. Mod no longer registers the external name or declares `primaryCommand`.

Native resources are staged under `CLAUDE_CONFIG_DIR/statusline-native`, verified by hash/version/protocol inventory, and installed through official local marketplace commands. The installer binds absolute backend/config paths and backend version. Backend 1.3.0 pairs with Mod 1.3.0. Foreign native commands/resources block that integration; external collisions are checked when enabling the external entry. An unrelated external command does not block native-only installation. Altered owned caches are not adopted.

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

Later on 2026-10-04 the maintainer supplied [three actual terminal screenshots](../images/README.md#in-session-client-screenshots), each visibly showing Claude Code 2.1.289, and reported normal in-session Client use on Linux and Windows. On macOS the Client pane opens but interaction is not working correctly. The maintainer has not found or verified a working mouse configuration. Backend/source versions and exact OS, architecture and terminal-version metadata were not supplied for this report.

The earlier release acceptance records above retain their original scope. This later macOS result remains unresolved; an open pane or passing automated CI does not establish mouse delivery, keyboard focus or successful editing. [Official mouse reporting checks](../USER_GUIDE.md#macos-mouse-reporting-and-client-focus) are documented as suggestions, not a verified fix.

A follow-up macOS acceptance record should identify the host, backend and terminal versions, terminal mouse-reporting settings, and whether tmux/SSH is involved. Verify initial click, Tab/arrows/Space, save/reopen, discard and return to the same session before recording success. This documentation update does not supply a new macOS acceptance run.

References: [actual-build Mod types](https://code.claude.com/docs/en/plugins/mods/create), [official tests](https://code.claude.com/docs/en/plugins/mods/test), [local marketplaces](https://code.claude.com/docs/en/plugin-marketplaces).
