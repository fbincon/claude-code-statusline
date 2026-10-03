# Native integration probe

**English** | [简体中文](native.zh-CN.md)

This is Phase 1 developer tooling, loaded explicitly from source. It is not the full native configuration editor and is not installed by the wheel. Stable users retain v1.1.1 and the existing CLI, wizard and standalone TUI.

## Source layout and checks

`mods/statusline-native` is an independent plugin: `.claude-plugin/plugin.json` identifies it, `hooks/hooks.json` loads `hooks/register.ts`, `lib` contains pure draft logic, and `tests` uses the official Mod kit. Host API calls stay in the entry module so official static analysis can inspect them. Source distributions include these developer files; dependencies, generated host declarations and raw acceptance logs are excluded.

Use Node.js 22 for development and a supported Claude Code build. The native workflow pins 2.1.287 and 2.1.288 separately from the Python platform matrix. Run from the repository root:

```bash
npm ci --prefix mods/statusline-native --ignore-scripts --no-audit --no-fund
.venv/bin/python tools/prepare_mod_types.py
claude plugin validate --strict mods/statusline-native
claude plugin test mods/statusline-native
npm run --prefix mods/statusline-native typecheck
claude --plugin-dir ./mods/statusline-native
```

The type preparer supplies fresh unauthenticated configuration and no project settings. Loading writes the host's declarations before the print session refuses authentication. Success requires declarations whose header matches the actual executable version; an old file cannot satisfy the check. This runs no model call. Generated `.claude-plugin/types` files are local and must be regenerated after changing host versions. A version number or successful manifest validation alone does not establish that a module loaded.

## Probe behavior

Run `/statusline-configure-native` in the resulting session. The pane requests focus, lets you toggle **Colors** with `c` or keyboard navigation, and closes with Esc or **Close** (`q`). Draft state resets on reopening; it is never saved. A pane may appear beside the transcript or above the prompt, according to the host and terminal width. Focus is a host request, not a guarantee; existing prompt text or another dialog can retain the keyboard.

The temporary name preserves `/statusline-config` and `/statusline-configure`. Before registering, the Mod lists existing commands. A foreign owner prevents registration and the command handler passes through; other panes are also passed through. Reloading its own registration is permitted. Verify the observed command sources and precedence in a real host; do not assume all hooks or skills have the same priority.

## Linux acceptance

The opt-in runner creates a private, isolated Claude configuration and binds the selected backend. It copies only authentication/gateway/model settings, sends local slash commands, and leaves personal settings untouched. Raw terminal/debug files may contain private paths and remain under ignored `dist/validation`.

```bash
.venv/bin/python -m pip install pyte==0.8.2
.venv/bin/python tools/native_mod_acceptance.py --report-dir dist/validation/native-pty
.venv/bin/python tools/native_mod_acceptance.py --interactive --report-dir dist/validation/native-manual
```

Use a fresh report directory for every invocation. PTY cases cover 120 and 80 columns: open, toggle, Esc, return to the prompt, run the existing local `/statusline-config show`, and confirm no display file was saved. PTY evidence and official callback tests do not constitute manual visual acceptance.

For manual acceptance, record OS, terminal, Claude and backend versions, commit and results. Check the pane's placement, focus, keyboard toggle, Esc, narrow windows and continued use of the same session. Send no model prompt for this check. The native-entry PR stays pending until the maintainer confirms these steps; Windows and macOS native interaction remain unverified until Phase 2 acceptance.

References: [creation and actual-build types](https://code.claude.com/docs/en/plugins/mods/create), [interface and focus](https://code.claude.com/docs/en/plugins/mods/interface), [official tests](https://code.claude.com/docs/en/plugins/mods/test).

Development validation on 2026-10-04: Claude Code 2.1.288 emitted matching declarations and passed strict validation, three official Mod tests and TypeScript checks. Native Linux x86_64 PTY cases at 120/80 columns opened and toggled the pane, returned after Esc and ran the legacy local command without saving. Manual visual/focus acceptance remains pending. The separate CI reports establish the minimum-version result.
