# Native configuration editor

**English** | [简体中文](native.zh-CN.md)

The source frontend now provides Main, Subagents and Settings pages. Stable installation remains v1.1.1. The editor is development work for v1.2.0 previews; persistent installation and three-platform acceptance are tracked separately from callback tests.

## Source layout and checks

`mods/statusline-native` is the sole maintained Mod source. `.claude-plugin/plugin.json` declares the plugin and backend options; `hooks/register.ts` owns host calls, opening, saving and response lifetimes. `lib/draft.ts` owns pure selections, exclusions, ordering and numeric buffers; `lib/backend.ts` validates wire responses; `lib/preferences.ts` represents actual host configuration rows. `ui/` draws controls and pages. `tests/` uses the official Mod kit. Host API calls remain in the entry layer for official static analysis.

Use Node.js 22 and a supported Claude Code build. The native workflow pins 2.1.287 and 2.1.288 independently of the Python platform matrix. First install this checkout in a development environment as described in [local checks](testing.md#local-checks). The released v1.1.1 backend does not expose the new `ui` protocol.

```bash
npm ci --prefix mods/statusline-native --ignore-scripts --no-audit --no-fund
.venv/bin/python tools/prepare_mod_types.py
claude plugin validate --strict mods/statusline-native
claude plugin test mods/statusline-native
npm run --prefix mods/statusline-native typecheck
CLAUDE_STATUSLINE_NATIVE_EXECUTABLE="$PWD/.venv/bin/claude-statusline" claude --plugin-dir ./mods/statusline-native
```

Regenerate declarations when changing the host executable. The preparer uses fresh unauthenticated configuration and no project settings; it verifies the emitted header against the actual executable version and runs no model call. Dependencies and generated host declarations stay outside Git and distribution packages. A version or valid manifest alone does not prove session loading.

## Editor behavior

Run `/statusline-configure-native`. The pane requests focus and uses the host's placement and scrolling. Main and Subagents consume all 24 main and 10 subagent items from the Python catalog. Select an item, enable/disable it, or move an enabled item up/down. Filtering preserves the complete selection. Mutual exclusions come from the shared catalog; empty selections are valid. Descriptions and examples explain the selected item. Sample preview uses production formatting without live collection.

Settings exposes colors, palette, directory style, separator style, padding, refresh interval, Vim indicator, scope labels and custom subagent rows. Numeric ranges and option choices come from `describe`. Refresh accepts `event`. Invalid numeric buffers remain visible and block saving.

Tool configuration and host preferences are separate actions. **Save tool configuration** (`s`) submits the complete draft and opening revision. Success updates the baseline/revision and keeps the pane open; subsequent statusline refreshes use saved settings. A conflict retains the draft and offers **Discard draft and reload**. Timeout or an invalid save response requires **Check saved state** before retry or close. The check rereads saved state rather than submitting another write.

Host settings include only actual `theme` and `verbose` rows from `$.config.list()`. Missing or locked rows explain their state. **Apply host preferences** (`a`) checks each row again before calling `$.config.set()`, and reports applied or refused rows individually. Partial success is retained; it is not a transaction with tool configuration. Closing discards pending preferences, while already applied preferences remain applied.

| Key | Action |
| --- | --- |
| Tab / Enter | Move focus / operate the current host control |
| `1`, `2`, `3` | Main, Subagents, Settings |
| `s` / `a` | Save tool configuration / apply pending host preferences |
| `t`, `u`, `d` | Toggle selected item / move it up / move it down |
| Esc | Leave input editing first; another Esc closes the pane |
| `q` | Close and discard unsaved changes |
| `r` | Discard draft and reload saved configuration |

Global shortcuts are handled by native controls and yield while typing in an input. Leaving input editing cancels unaccepted numeric buffers. Below 24 body columns, the pane shows a resize prompt and Close while preserving its draft. Ordinary redraws reuse preview; draft or width changes request another. Closing/reopening invalidates outstanding responses. Applying blocks repeated writes and ordinary closing. Reload discards unsaved state.

The development command preserves the installed wizard and compatibility TUI. Foreign commands prevent registration; foreign panes pass through. Source development can bind an absolute executable with `CLAUDE_STATUSLINE_NATIVE_EXECUTABLE`; `CLAUDE_CONFIG_DIR` is passed as an argument without shell interpolation.

## Linux acceptance

Use an isolated configuration and the matching source backend. Record OS, architecture, terminal/version, Claude version and fixed commit. Phase 1 manual Linux acceptance at `3a65482` covered the old transient probe; it does not establish acceptance of the three-page editor.

For the editor, check real plugin loading, pane placement and keyboard focus, all three pages, filtering, exclusions and ordering, sample preview, narrow/CJK display, numeric Esc, save then statusline refresh, cancel/reopen, conflicts, separate host application and continuing the same session after closing. Windows and macOS require the same checklist before stable publication. Keep private configuration and terminal/debug streams in ignored `dist/validation`. Publish only sanitized conclusions. Official callback tests and PTY captures do not replace a maintainer's visual acceptance.

The isolated runner and platform installation checks are being updated with persistent integration. Stable release remains pending until Linux, Windows and macOS human results are recorded; the first preview also requires Linux human acceptance.

References: [creation and actual-build types](https://code.claude.com/docs/en/plugins/mods/create), [interface and focus](https://code.claude.com/docs/en/plugins/mods/interface), [official tests](https://code.claude.com/docs/en/plugins/mods/test), [local marketplaces](https://code.claude.com/docs/en/plugin-marketplaces).
