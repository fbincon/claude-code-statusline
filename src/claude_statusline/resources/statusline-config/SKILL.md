---
name: statusline-config
description: Configure the installed claude-statusline display and Claude Code host settings.
argument-hint: "[show|list-items|set-items|enable|disable|order|subagents|set|reset]"
disable-model-invocation: true
allowed-tools:
  - AskUserQuestion
  - __CLAUDE_STATUSLINE_ALLOWED_RULE__
---

# Configure Claude Code Statusline

This is a user-global configuration workflow. Never edit settings or statusline
files directly. Use only `__CLAUDE_STATUSLINE_COMMAND__ config ...`.

The invocation arguments are: `$ARGUMENTS`.

If the invocation arguments are non-empty, this Claude Code version did not handle the
shortcut locally. Parse the arguments as one of the documented `config`
subcommands, run `__CLAUDE_STATUSLINE_COMMAND__ config $ARGUMENTS`, report its
exact result, and stop. Do not reinterpret invalid arguments or make unrelated
changes.

If the invocation arguments are empty:

1. Run `__CLAUDE_STATUSLINE_COMMAND__ config show --json` and
   `__CLAUDE_STATUSLINE_COMMAND__ config list-items --json`, then run
   `__CLAUDE_STATUSLINE_COMMAND__ config subagents list-items --json`.
2. Tell the user that the configuration applies to every Claude Code project.
3. Use AskUserQuestion with multi-select questions for these groups:
   - Identity / Repo: `model-with-effort`, `current-dir`, `project-name`,
     `hostname`, `git`
   - Context: `context-remaining`, `context-used`, `context-window-size`
   - Limits: `five-hour-limit`, `weekly-limit`, `spend-limit`
   - Usage: `tokens`, `prompt-timer`, `cost`, `prompt-cache`
   - Session: `version`, `session`
   - Modes: `fast-mode`, `agent`, `vim-mode`, `thinking`
   - Repository: `pr`, `worktree`, `repo`
   The Session, Modes, and Repository items plus `project-name`, `hostname`,
   `context-used`, `cost`, and `prompt-cache` are disabled by default;
   selecting them here enables them.
4. Preserve the relative order of currently enabled selected items. Append
   newly enabled items in the catalog order returned by `list-items`.
5. Ask for:
   - subagent row items: `status-elapsed`, `status`, `name`,
     `model-with-effort`, `context-remaining`, `context-used`, `elapsed`,
     `task`, `tokens`, and `current-dir`; `status-elapsed` cannot be combined
     with `status` or `elapsed` — if the user picks conflicting items, keep
     `status-elapsed` and drop the other two
   - custom subagent rows: on or off
   - scope labels: off, when-subagents, or always
   - colors: on or off
   - palette: default or ansi (retain the current value if colors are off)
   - directory style: full, home, project-relative, or basename
   - separator style: classic or compact
   - padding: 0, 1, 2, or 4 (accept a custom integer from 0 through 32)
   - refresh interval: 1, 2, 5, or event (accept a custom integer from 1 through 3600)
   - Vim indicator: show or hide
6. Do not write anything if the user cancels or any answer is unresolved.
7. Apply every answer in one command with this exact argument structure:

   `__CLAUDE_STATUSLINE_COMMAND__ config apply --items ITEM... --subagent-items ITEM... --subagent-statusline on|off --scope-labels off|when-subagents|always --colors on|off --palette default|ansi --directory-style full|home|project-relative|basename --separator-style classic|compact --padding N --refresh-interval event|N --hide-vim-mode-indicator on|off`

   Map "hide" to `--hide-vim-mode-indicator on` and "show" to
   `--hide-vim-mode-indicator off`.

   After it succeeds, run `__CLAUDE_STATUSLINE_COMMAND__ config show --json`
   once to verify the saved result. Report the applied values and mention that
   arbitrary reordering is available through
   `/statusline-config order ITEM...` and
   `/statusline-config subagents order ITEM...`.
