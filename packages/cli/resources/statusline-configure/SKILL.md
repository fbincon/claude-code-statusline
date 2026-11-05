---
name: statusline-configure
description: Open the local external terminal status line configuration editor.
argument-hint: ""
disable-model-invocation: true
disallowed-tools:
  - Bash
  - PowerShell
---

# External Terminal Status Line Configuration

This no-argument command is normally intercepted by a local `UserPromptExpansion`
hook before model invocation. This request reached the fallback skill, so the
local hook did not complete handling it. Disabled hooks, including `disableAllHooks`,
are one possible cause; do not claim that hooks were definitely disabled or that
the editor opened.

Do not call tools, start a terminal interface, or change configuration. Reply
briefly that the local launcher did not handle this request. Suggest running
`claude-statusline configure` in an interactive terminal (`claude-statusline.cmd configure`
on Windows), or using `/statusline-config` for guided questions. This entry accepts
no configuration arguments; do not forward invocation arguments to an editor.
