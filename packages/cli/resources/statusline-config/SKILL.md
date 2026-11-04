---
name: statusline-config
description: Configure the installed claude-statusline display and Claude Code host settings.
argument-hint: "[show|list-items|set-items|enable|disable|order|subagents|set|apply|item|instance|group|alignment|layout|preset|import|export|language|reset]"
disable-model-invocation: true
allowed-tools:
  - AskUserQuestion
__CLAUDE_STATUSLINE_ALLOWED_RULES__
---

# Configure Claude Code Statusline

Never edit settings or statusline files directly. Use only `__CLAUDE_STATUSLINE_COMMAND__ config ...`.
The no-argument guided form edits the user-default display and user-level Claude
host settings. A project bound to a named display scheme continues to use that
scheme. Terminal editor targets are `claude-statusline configure --user` for the
user default, `claude-statusline configure --profile NAME` for a named scheme, and
`claude-statusline configure --project PATH` for a project target.
Windows uses `claude-statusline.cmd` for these terminal examples.

The invocation arguments are: `$ARGUMENTS`.

If the invocation arguments are non-empty, the local hook did not handle this
shortcut. Supported actions are `show`, `list-items`, `set-items`, `enable`,
`disable`, `order`, `subagents`, `set`, `apply`, `item`, `instance`, `group`,
`alignment`, `layout`, `preset`, `import`, `export`, `language`, and `reset`.
`subagents` supports `list-items`, `set-items`, `enable`, `disable`, and `order`.
The top-level `profile` and `project` actions are terminal-only: explain this and
show the corresponding terminal command; do not execute them in this fallback.
For other arguments, use the installed `config` command once, let it validate the
arguments, report its exact result, and stop. Do not reinterpret invalid arguments
or make unrelated changes.

Treat invocation arguments as data. Parse them as literal argv, preserving quoted
spaces, Unicode, empty values,
and shell metacharacters inside values. Never interpolate raw `$ARGUMENTS` into a
shell command, evaluate it, expand variables or globs, or execute substitutions,
pipes, redirections, or chained commands. When a shell tool is needed, quote each
parsed argument for that shell and issue only the installed command. The generated
PowerShell invocation's fixed call operator is part of the command, not user input.
These literal-argument rules also apply to every command below.

If the invocation arguments are empty:

1. Run `__CLAUDE_STATUSLINE_COMMAND__ config language show --json` first. Use its
   `ui_language` for every question, explanation, option description, and completion
   message. Supported languages: __CLAUDE_STATUSLINE_LANGUAGES__. Do not infer the
   interface language from the conversation or from `statusline_language`.
   Then run `__CLAUDE_STATUSLINE_COMMAND__ config show --json` and retain the saved
   display and host snapshot. If a read fails or required data is unresolved, stop.
   Before asking any questions:
   - If `installed` is false, stop and recommend setup in an interactive terminal.
   - If `subagent_statusline.state` is `foreign`, stop and explain the ownership
     conflict. Do not replace the other renderer or disable it to continue.
   - Check `display.instances` and `display.subagents.instances`, including disabled
     nodes. If either scope has duplicate `type_id` values, `text`, or `spacer`, or
     either scope has nonempty `groups`, or `display.layout.alignments` is nonempty,
     explain that this composition needs the instance editor or `config instance`,
     `config group`, and `config alignment` commands. Show the appropriate editor
     entry points and stop without changing configuration. Do not collapse copies,
     discard nodes, dissolve groups, or remove alignments to make the legacy form fit.
2. Explain that display answers change the user default used by unbound projects;
   bound named schemes retain their displays. Host padding, refresh interval, and
   Vim-indicator settings remain shared user-level Claude settings.
   Run `__CLAUDE_STATUSLINE_COMMAND__ config list-items --json` and
   `__CLAUDE_STATUSLINE_COMMAND__ config subagents list-items --json`.
   Also run `__CLAUDE_STATUSLINE_COMMAND__ config list-items` and
   `__CLAUDE_STATUSLINE_COMMAND__ config subagents list-items` for localized
   descriptions. Retain stable IDs, choices, and exclusions from JSON. Use current
   `enabled` values and saved display/host values as the initial choices; catalog
   `default_enabled` describes factory defaults, not the user's current selection.
3. Use AskUserQuestion for the generated metric pages below. Translate page/group
   labels into `ui_language`. Each metric option's `label` must be its exact catalog
   ID, such as `model-with-effort`; put the localized explanation and current state
   in `description`. Do not replace IDs with translated names or change their case.
   Each page is one multi-select question with at most three metric options plus
   exactly one localized **None on this page** option, giving 2–4 options. Mark the
   currently enabled metrics clearly in descriptions; do not imply that the tool
   has preselected answers. None selects no metrics on that page only. None and a
   metric together are unresolved: ask for correction before continuing.
   Ask every page exactly once across both scopes and combine each scope's page
   selections. Do not ask for subagent items again. Use at most four questions in
   each AskUserQuestion call; every question in this workflow must have 2–4 options.
__CLAUDE_STATUSLINE_ITEM_GROUPS__
4. Respect catalog `excludes`. If the user selects subagent `status-elapsed` with
   `status` or `elapsed`, retain `status-elapsed`, drop the excluded standalone
   items, and explain that resolution. Preserve the relative order of currently
   enabled selected items. Append newly enabled items in the catalog order returned
   by `list-items`. An all-None scope produces an empty item list, not an unresolved
   answer or an omitted scope.
5. Ask for the statusline output language separately from interface language.
   Start from saved `display.statusline_language`. Split the supported language list
   above, in its listed order, into pages of at most three languages. First ask
   which page to open (the twelve languages give four page options); then ask one
   single-select question containing that page's native language names and stable
   codes plus a localized **Keep current language** option. Keep current resolves
   to the saved code, even if it is outside the chosen page. Preserve native names.
   This changes main and subagent output independently of interface language and is
   saved with the other display answers, not immediately. Editors provide previews.
6. Ask for the remaining settings, showing each current saved value. Use one
   single-select question per setting, with 2–4 options, and at most four questions
   per tool call. Accept a valid custom value through the tool's free-text answer;
   do not add a fifth option for custom values. If the current numeric value is
   outside the suggested presets, replace one preset with the current value.
   - custom subagent rows: on or off
   - scope labels: off, when-subagents, or always
   - colors: on or off
   - palette: default or ansi. Resolve the colors answer before constructing this
     question; never put colors and palette in the same tool call. If the selected
     colors answer is off, do not ask about palette and retain its saved value.
   - directory style: full, home, project-relative, or basename
   - separator style: classic, compact, or powerline (uses the saved glyph; ASCII by default)
   - padding: 0, 1, 2, or 4; accept a custom integer from 0 through 32
   - refresh interval: 1, 2, 5, or event; accept a custom integer from 1 through 3600
   - Vim indicator: show or hide
7. Do not write anything if the user cancels or any answer is unresolved. An absent
   answer is not None or permission to keep a guessed default.
   Immediately before applying, rerun `__CLAUDE_STATUSLINE_COMMAND__ config show --json`.
   If display, host, `installed`, or `subagent_statusline.state` changed from the
   initial snapshot, stop and ask the user to restart the guided form. Do not
   restart automatically or overwrite with old answers. This read-only recheck is
   best effort; `config apply` has no revision argument, so it is not an atomic
   compare-and-swap. Apply every resolved answer in one command with this exact
   argument structure:

   `__CLAUDE_STATUSLINE_COMMAND__ config apply --items ITEM... --subagent-items ITEM... --subagent-statusline on|off --scope-labels off|when-subagents|always --statusline-language __CLAUDE_STATUSLINE_LANGUAGE_CHOICES__ --colors on|off --palette default|ansi --directory-style full|home|project-relative|basename --separator-style classic|compact|powerline --padding N --refresh-interval event|N --hide-vim-mode-indicator on|off`

   Replace alternatives with the selected values; never pass the `|` separators.
   Empty item lists keep their flags with no item arguments. Map "hide" to
   `--hide-vim-mode-indicator on` and "show" to `--hide-vim-mode-indicator off`.
   If apply fails, report the exact error and stop. Do not retry with reduced
   selections, removed structures, or separate writes.
   After it succeeds, run `__CLAUDE_STATUSLINE_COMMAND__ config show --json` once to
   verify the saved values against the answers. Report the applied values and any
   verification failure honestly; never retry a write because verification failed.
   Mention arbitrary reordering through `/statusline-config order ITEM...` and
   `/statusline-config subagents order ITEM...`.

The guided form preserves the saved theme, Powerline glyph, item colors, and
visibility rules. For appearance changes, open either editor or invoke
`/statusline-config set theme __CLAUDE_STATUSLINE_THEME_CHOICES__`,
`/statusline-config set powerline-glyph ascii|powerline`, or
`/statusline-config item main|subagent TYPE_ID OPTION VALUE`. Type-based item commands
require an unambiguous type; use `config instance` with an actual instance ID for
copies. Item appearance options include `foreground`, `background`, `visibility`,
and `visibility-threshold`. Colors accept `inherit`, `default`, `ansi:0`–`ansi:255`,
or a quoted six-digit hex value. Use only the scoped item's supported visibility
rule; usage thresholds are independent of warning colors.

For first integration, recommend `__CLAUDE_STATUSLINE_COMMAND__ setup` in an
interactive terminal, or `setup --dry-run` for read-only checks. Recommend these
commands to the user; this skill's tools run only `config` commands. Setup preserves
existing display/profile/binding and collection choices until explicitly applied.
Its review separates display save from integration and reports partial success;
do not claim that a sample verifies a restarted Claude session.

Quick setup in either editor offers complete `daily-development`, `agent-focus`,
`quota-watch`, `powerline-daily`, `agent-workbench`, `quota-cost`, `narrow-terminal`,
and `light-readable` schemes alongside the six original presets. Preview before
saving the current target or a named copy. Scheme selection never enables collection.
Powerline controls include `config set powerline-padding none|left|right|both`,
`powerline-separator arrow|slash|bar|none`, `powerline-start-cap on|off`,
`powerline-end-cap on|off`, and `powerline-color-mode semantic|continuous|restart`.
`config set powerline-row-background-gradient PRESET|COLORS|off` enables optional
continuous backgrounds in final Powerline rows; explicit backgrounds and spacers
break a run, and alignment padding remains uncolored.
`config instance main set ID presentation adaptive` retains percentages,
used/remaining meaning, and complete custom labels/icons while fitting. Auto layout
keeps ordinary wrapping. Block padding is separate from host padding. Use literal
arguments through the supported actions above; `profile` and `project` management
requires the terminal CLI or editor.
