# Native configuration editor

**English** | [简体中文](native.zh-CN.md)

v1.3.0a1 previews a paged, keyboard-operated editor inside Claude Code. The current stable release remains v1.2.0. Its previous human acceptance applies to that UI only; the redesigned editor requires a new Linux, Windows and macOS checklist before v1.3.0 can become stable.

## Source layout and checks

`mods/statusline-native` is the sole maintained Mod source. `.claude-plugin/plugin.json` declares the plugin and backend options; `hooks/register.ts` owns host calls, opening, saving and response lifetimes. `lib/editor/` separates draft, navigation and numeric validation; `lib/backend.ts` validates wire responses; `lib/preferences.ts` represents actual host configuration rows. `ui/components/` draws item lists, pagination, preview and action bars; `ui/pages/` composes Main/Subagents and Settings, while `ui/layout.ts` budgets the available cells. Tests mirror editor, UI, backend and integration responsibilities and use the official Mod kit. Host API calls remain in the entry layer for official static analysis.

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

Run `/statusline-configure-native` for source development, or `/statusline-configure` after persistent installation. The editor requests 24 body rows and 72 docked columns; placement and the actual space remain host-owned. It requires at least **32 columns × 12 body rows**, not a terminal of that total size. Inline panes share room with the composer and statusline: a short 80-column terminal may need more height or the host's Ctrl+X then arrow resizing. A smaller body shows a resize message and Close, preserving the draft.

Main/Subagents show direct `[x]` / `[ ]` item rows instead of a dropdown. Enter on a row toggles it. Focus, filter and the selected row are maintained per scope; page changes and pagination request focus on the current item. The native host can refuse a focus request, for example after keyboard focus moves back to the composer; edits remain valid. Search submission returns to a matching row. Empty selection and empty search results are valid. Descriptions/examples occupy a compact detail row.

The full order starts with enabled items in their saved order, followed by other catalog entries. Both enabled and disabled rows may move. With a filter active, movement uses the adjacent visible row and preserves hidden rows' relative order, matching the standalone TUI. Only enabled items are persisted. Subagent mutual exclusions still come from the shared Python catalog.

A horizontal tab row, paged content, bounded bottom sample preview and two action rows fit the body's height budget. The preview shows at most three rows; overflow reports how many remain. It uses fixed samples and production formatting, never live Git/transcript data. Height changes, filtering and focus reuse the cached preview; draft or width changes request another, with stale responses ignored.

Settings contains nine tool settings. Ranges and choices come from `describe`; refresh accepts `event`. Enter accepts the current numeric field independently. Saving validates every numeric buffer; invalid values stay visible and focus moves to the first invalid field. Esc first leaves input editing and cancels that unaccepted field; a later Esc closes the pane.

**Save** (`s`) submits the full draft and opening revision, updates the baseline, and keeps the pane open. **Finish** (`f`) saves then closes only after a confirmed success and no pending host preferences. If theme/verbose changes remain pending, Finish opens the advanced region and asks the user to apply them with `a`, finish again with `f`, or explicitly discard/close with `q`. A failed/conflicting save retains the draft. An unknown result requires **Check saved state** (`k`) before retrying or closing; reconciliation never resubmits a write or automatically closes.

Theme/verbose are folded by default behind **Advanced** (`h`). Only actual rows from `$.config.list()` are offered, with missing/locked states explained. **Apply** (`a`) rechecks and applies each row separately through `$.config.set()`; partial success remains applied. This is separate from saving tool settings. Closing discards unapplied preferences; applied preferences stay applied.

| Key | Action |
| --- | --- |
| Tab / Enter | Move focus / operate the focused native control; Enter toggles a focused item row |
| `1`, `2`, `3` | Main, Subagents, Settings |
| `p` / `n` | Previous / next content page, selecting its first row |
| `t`, `u`, `d` | Toggle selected item / move it earlier / later |
| `s` / `f` | Save and continue / save and close after confirmed success |
| `h` / `a` | Fold/unfold advanced host preferences / apply them separately |
| `c` | Toggle colors while that setting is on the current Settings page |
| Esc / `q` | Leave input editing first / close and discard pending changes |
| `r` / `k` / `v` | Discard draft and reload / reconcile an unknown save / retry a failed preview |

Printable shortcuts yield to a focused Input. Tab and arrows remain native focus/scroll controls, not the standalone TUI's page/reorder bindings. Busy operations block duplicate writes and ordinary closing. Reload discards unsaved state. The wizard, standalone TUI and compatibility launcher remain available under their existing installation preferences.

## Client capability probe

An isolated Linux x86_64 PTY probe against Claude Code 2.1.288 confirmed that a `Client` region receives Up/Down/Left/Right, Tab, Enter, ordinary characters and Ctrl+U **after a click**. Opening the pane with `focus: true` did not give the region keyboard input. Esc was not delivered to `surface.onKey`; its focus/close behaviour remains host-owned. The source and raw report stay in ignored validation directories and are excluded from runtime resources. This is automated capability evidence, not human acceptance. v1.3.0a1 therefore retains native controls for keyboard-only operation; it does not ship a Client mode.

## Persistent installation and recovery

With the matching package installed, run `claude-statusline install --native-editor`. The backend stages only runtime resources under `CLAUDE_CONFIG_DIR/statusline-native`, verifies a hash inventory, then uses official marketplace add/install/configure commands at user scope. `claude-statusline-local` is reserved for this tool's local directory marketplace. It binds absolute backend and config paths plus the expected version. The v1.3.0a1 preview pairs Mod SemVer `1.3.0-alpha.1` with backend PEP 440 `1.3.0a1`; stable v1.2.0 pairs `1.2.0` with `1.2.0`. Runtime inventories recursively include the maintained hooks/lib/ui TypeScript tree, while dependencies, tests and host declarations remain excluded from the wheel.

Only after verified installation does the file transaction remove the owned compatibility `/statusline-configure` skill/hook. Both native command names open the same editor. The wizard and standalone TUI remain available. A foreign skill, command, directory, marketplace, scope or altered cached resource blocks adoption, including with `--force`. Session command collisions are checked again in the Mod; primary and alias ownership are independent.

`claude-statusline-native.json` records explicit native enable/disable separately from `claude-statusline-features.json`. Preview defaults are off. Stable defaults prefer native on compatible hosts; explicit native false, legacy explicit false and externally disabled plugins remain disabled. Enable an externally disabled plugin with `claude plugin enable statusline-native@claude-statusline-local --scope user` yourself before reinstalling. The installer reenables only a suspension it recorded itself.

`install --no-native-editor` removes the confirmed owned plugin/marketplace through official commands and deletes only hash-owned staged files. It preserves the disabled preference and restores the old launcher only when the experimental preference is enabled. Uninstall retains preferences, display configuration, runtime data and backups. Normal reinstall is idempotent. Same-version changed resources use an owned official uninstall/install because official update otherwise keeps the old cache. A bounded previous inventory lets a refused upgrade be diagnosed and retried without adopting foreign cache content.

Plugin operations and compatibility writes are separate stages. Failed/uncertain operations retain compatibility and report actual state; inspect `doctor` before retrying. Doctor verifies version/protocol, resource hashes, official installation/enablement and backend binding. Current-session loading remains unverified: restart in a trusted terminal and check `/plugin` and the command. Safe/bare mode, `disableAllHooks` or managed policy can prevent loading. Missing resources can be repaired; modified foreign content must be restored or moved aside. For a foreign reserved marketplace, rename/remove its registration explicitly before reinstalling.

After a host downgrade, rerun install with the current backend to suspend native and retain its preference. Before downgrading the Python package, first run `claude-statusline install --no-native-editor` using the new package, then install the old package and run its installer. An old package cannot remove resources introduced by this version.

## Linux acceptance

Use an isolated configuration and the matching source backend. Record OS, architecture, terminal/version, Claude version and fixed commit. Phase 1 manual Linux acceptance at `3a65482` covered the old transient probe; it does not establish acceptance of the three-page editor.

For each redesigned candidate, check real plugin loading; pane placement and keyboard-only focus; direct Enter toggles; p/n pagination and retained selection; filtered enabled/disabled ordering and exclusions; all three pages; bounded sample preview and narrow/CJK layout; numeric submit/Esc; s save/refresh and f save/close; cancel/reopen; conflicts and unknown-result checks; folded/separate host preferences; and continuing the same session after closing. Windows and macOS require the same checklist before stable publication. Keep private configuration and terminal/debug streams in ignored `dist/validation`. Publish only sanitized conclusions. Official callback tests and PTY captures do not replace a maintainer's visual acceptance.

The isolated runner can test the installed plugin without `--plugin-dir`:

```bash
.venv/bin/python -m pip install pyte==0.8.2
.venv/bin/python tools/native_mod_acceptance.py --persistent --backend .venv/bin/claude-statusline --report-dir dist/validation/native-pty
.venv/bin/python tools/native_mod_acceptance.py --persistent --interactive --backend .venv/bin/claude-statusline --terminal 'name/version' --report-dir dist/validation/native-manual
```

Use a new directory each time. PTY checks open all pages, toggle/save, cancel/reopen, Esc and the local wizard at 120×30 and 80×48 terminal cells. They record decoded terminal cells for screenshots and never mark human acceptance as passed. Interactive mode records environment/commit and keeps `manual_visual_acceptance` false until the maintainer reports the complete checklist. Windows/macOS use the same installed candidate and checklist in a real terminal. Release gates require recorded human results for all three platforms; the historical v1.2.0 confirmations below do not satisfy the v1.3.0 gate.

References: [creation and actual-build types](https://code.claude.com/docs/en/plugins/mods/create), [interface and focus](https://code.claude.com/docs/en/plugins/mods/interface), [official tests](https://code.claude.com/docs/en/plugins/mods/test), [local marketplaces](https://code.claude.com/docs/en/plugin-marketplaces).

The maintainer confirmed the complete Linux human checklist on 2026-10-04 using the isolated installed wheel built from `db4129b`, backend 1.2.0a1 and Claude Code 2.1.288 on Linux x86_64. The interactive run recorded clean documentation commit `94ddbbd` and exit code 0; its Mod runtime matches the tested code commit. The explicit user confirmation establishes acceptance. The terminal argument was a placeholder, so terminal product/version remains unknown. Raw evidence is in ignored `dist/validation/phase2-human-linux`. Subsequent platform fixes address Windows npm entry resolution and macOS executable aliases; the accepted Linux UI/runtime resources are unchanged. Windows/macOS human acceptance was subsequently confirmed as recorded below.

## Stable acceptance record

On 2026-10-04 the maintainer explicitly confirmed that both Windows and macOS passed the complete requested native checklist against released v1.2.0a1 (`d161e55`) and the instructed Claude Code 2.1.288. A follow-up identifies the systems as Windows 11 and macOS 14.5. Architecture, terminal product/version and separate host-version command outputs were not provided; they remain unknown instead of being inferred from CI. This confirmation is distinct from the automated Windows Server 2025/macOS 15.7.9 arm64 installation reports. Linux acceptance is recorded above. The stable change promotes the same UI/runtime modules, updates matching versions and enables the already tested stable default. Raw confirmation metadata stays in ignored `dist/validation/phase2-human-windows-macos.json`.

## v1.3.0 acceptance status

v1.3.0a1 is a preview. Linux automated PTY checks use fixed Claude Code 2.1.288 and the persistent plugin; official Mod tests also cover the fixed CI host matrix. New Linux, Windows and macOS human acceptance remains pending. Stable v1.3.0 and Latest promotion require all three confirmations against the new candidate, with source/version and actual environment recorded.
