# Native configuration editor

**English** | [简体中文](native.zh-CN.md)

v1.2.0 bundles Main, Subagents and Settings in the wheel. Stable installs prefer native on compatible hosts and preserve explicit disablement. The maintainer confirmed human acceptance on Linux, Windows 11 and macOS 14.5; automated evidence and environment limits are recorded separately.

## Source layout and checks

`mods/statusline-native` is the sole maintained Mod source. `.claude-plugin/plugin.json` declares the plugin and backend options; `hooks/register.ts` owns host calls, opening, saving and response lifetimes. `lib/draft.ts` owns pure selections, exclusions, ordering and numeric buffers; `lib/backend.ts` validates wire responses; `lib/preferences.ts` represents actual host configuration rows. `ui/` draws controls and pages. `tests/` uses the official Mod kit. Host API calls remain in the entry layer for official static analysis.

Use Node.js 22 and a supported Claude Code build. The native workflow checks Linux 2.1.287/2.1.288 plus Windows/macOS 2.1.288, independently of the Python platform matrix. First install this checkout in a development environment as described in [local checks](testing.md#local-checks). The released v1.1.1 backend does not expose the new `ui` protocol.

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

Run `/statusline-configure-native` for source development, or `/statusline-configure` after persistent installation. The pane requests focus and uses the host's placement and scrolling. Main and Subagents consume all 24 main and 10 subagent items from the Python catalog. Select an item, enable/disable it, or move an enabled item up/down. Filtering preserves the complete selection. Mutual exclusions come from the shared catalog; empty selections are valid. Descriptions and examples explain the selected item. Sample preview uses production formatting without live collection.

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

## Persistent installation and recovery

With v1.2.0 installed, run `claude-statusline install --native-editor`. The backend stages only runtime resources under `CLAUDE_CONFIG_DIR/statusline-native`, verifies a hash inventory, then uses official marketplace add/install/configure commands at user scope. `claude-statusline-local` is reserved for this tool's local directory marketplace. It binds absolute backend and config paths plus the expected version. The stable Mod/backend versions both use `1.2.0`; preview Mod SemVer `1.2.0-alpha.1` matches backend PEP 440 `1.2.0a1`.

Only after verified installation does the file transaction remove the owned compatibility `/statusline-configure` skill/hook. Both native command names open the same editor. The wizard and standalone TUI remain available. A foreign skill, command, directory, marketplace, scope or altered cached resource blocks adoption, including with `--force`. Session command collisions are checked again in the Mod; primary and alias ownership are independent.

`claude-statusline-native.json` records explicit native enable/disable separately from `claude-statusline-features.json`. Preview defaults are off. Stable defaults prefer native on compatible hosts; explicit native false, legacy explicit false and externally disabled plugins remain disabled. Enable an externally disabled plugin with `claude plugin enable statusline-native@claude-statusline-local --scope user` yourself before reinstalling. The installer reenables only a suspension it recorded itself.

`install --no-native-editor` removes the confirmed owned plugin/marketplace through official commands and deletes only hash-owned staged files. It preserves the disabled preference and restores the old launcher only when the experimental preference is enabled. Uninstall retains preferences, display configuration, runtime data and backups. Normal reinstall is idempotent. Same-version changed resources use an owned official uninstall/install because official update otherwise keeps the old cache. A bounded previous inventory lets a refused upgrade be diagnosed and retried without adopting foreign cache content.

Plugin operations and compatibility writes are separate stages. Failed/uncertain operations retain compatibility and report actual state; inspect `doctor` before retrying. Doctor verifies version/protocol, resource hashes, official installation/enablement and backend binding. Current-session loading remains unverified: restart in a trusted terminal and check `/plugin` and the command. Safe/bare mode, `disableAllHooks` or managed policy can prevent loading. Missing resources can be repaired; modified foreign content must be restored or moved aside. For a foreign reserved marketplace, rename/remove its registration explicitly before reinstalling.

After a host downgrade, rerun install with the current backend to suspend native and retain its preference. Before downgrading the Python package, first run `claude-statusline install --no-native-editor` using the new package, then install the old package and run its installer. An old package cannot remove resources introduced by this version.

## Linux acceptance

Use an isolated configuration and the matching source backend. Record OS, architecture, terminal/version, Claude version and fixed commit. Phase 1 manual Linux acceptance at `3a65482` covered the old transient probe; it does not establish acceptance of the three-page editor.

For the editor, check real plugin loading, pane placement and keyboard focus, all three pages, filtering, exclusions and ordering, sample preview, narrow/CJK display, numeric Esc, save then statusline refresh, cancel/reopen, conflicts, separate host application and continuing the same session after closing. Windows and macOS require the same checklist before stable publication. Keep private configuration and terminal/debug streams in ignored `dist/validation`. Publish only sanitized conclusions. Official callback tests and PTY captures do not replace a maintainer's visual acceptance.

The isolated runner can test the installed plugin without `--plugin-dir`:

```bash
.venv/bin/python -m pip install pyte==0.8.2
.venv/bin/python tools/native_mod_acceptance.py --persistent --backend .venv/bin/claude-statusline --report-dir dist/validation/native-pty
.venv/bin/python tools/native_mod_acceptance.py --persistent --interactive --backend .venv/bin/claude-statusline --terminal 'name/version' --report-dir dist/validation/native-manual
```

Use a new directory each time. PTY checks open all pages, toggle/save, cancel/reopen, Esc and the local wizard at 120/80 columns. They record decoded terminal cells for screenshots and never mark human acceptance as passed. Interactive mode records environment/commit and keeps `manual_visual_acceptance` false until the maintainer reports the complete checklist. Windows/macOS use the same installed candidate and checklist in a real terminal. Release gates require recorded human results for all three platforms; those confirmations are recorded below.

References: [creation and actual-build types](https://code.claude.com/docs/en/plugins/mods/create), [interface and focus](https://code.claude.com/docs/en/plugins/mods/interface), [official tests](https://code.claude.com/docs/en/plugins/mods/test), [local marketplaces](https://code.claude.com/docs/en/plugin-marketplaces).

The maintainer confirmed the complete Linux human checklist on 2026-10-04 using the isolated installed wheel built from `db4129b`, backend 1.2.0a1 and Claude Code 2.1.288 on Linux x86_64. The interactive run recorded clean documentation commit `94ddbbd` and exit code 0; its Mod runtime matches the tested code commit. The explicit user confirmation establishes acceptance. The terminal argument was a placeholder, so terminal product/version remains unknown. Raw evidence is in ignored `dist/validation/phase2-human-linux`. Subsequent platform fixes address Windows npm entry resolution and macOS executable aliases; the accepted Linux UI/runtime resources are unchanged. Windows/macOS human acceptance was subsequently confirmed as recorded below.

## Stable acceptance record

On 2026-10-04 the maintainer explicitly confirmed that both Windows and macOS passed the complete requested native checklist against released v1.2.0a1 (`d161e55`) and the instructed Claude Code 2.1.288. A follow-up identifies the systems as Windows 11 and macOS 14.5. Architecture, terminal product/version and separate host-version command outputs were not provided; they remain unknown instead of being inferred from CI. This confirmation is distinct from the automated Windows Server 2025/macOS 15.7.9 arm64 installation reports. Linux acceptance is recorded above. The stable change promotes the same UI/runtime modules, updates matching versions and enables the already tested stable default. Raw confirmation metadata stays in ignored `dist/validation/phase2-human-windows-macos.json`.
