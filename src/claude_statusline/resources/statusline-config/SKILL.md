---
name: statusline-config
description: Configure the installed claude-statusline display and Claude Code host settings.
argument-hint: "[show|list-items|set-items|enable|disable|order|subagents|set|item|layout|preset|import|export|reset]"
disable-model-invocation: true
allowed-tools:
  - AskUserQuestion
__CLAUDE_STATUSLINE_ALLOWED_RULES__
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
__CLAUDE_STATUSLINE_ITEM_GROUPS__
4. Preserve the relative order of currently enabled selected items. Append
   newly enabled items in the catalog order returned by `list-items`.
5. Ask for:
   - subagent row items from the listing; respect its excludes constraints. If the
     user selects status-elapsed together with status or elapsed, keep the combined
     item and drop the excluded standalone items.
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
