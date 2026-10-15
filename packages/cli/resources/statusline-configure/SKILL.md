---
name: statusline-configure
description: Open the experimental local interactive status line configuration launcher.
argument-hint: ""
disable-model-invocation: true
disallowed-tools:
  - Bash
  - PowerShell
---

# Experimental Interactive Status Line Configuration

This command is normally intercepted by a local `UserPromptExpansion` hook before
model invocation. The local hook did not run, for example because Claude Code hooks
are disabled with `disableAllHooks`.

Do not start curses or any terminal interface through Bash or another tool. Reply
only that the experimental hook did not run and suggest running
`claude-statusline configure` in a terminal or using `/statusline-config`.
