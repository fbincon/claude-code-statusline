# Bundled configuration skill workflows

**English** | [简体中文](skill-workflows.zh-CN.md)

This record tracks the v3.16.3 repairs to the two canonical skill templates in `packages/cli/resources`. The templates are installed product instructions. Changes require the applicable product checks and release evidence, even though their source format is Markdown. The Python archive remains a historical reference.

## Scope and command boundaries

`statusline-config/SKILL.md` describes the model-guided user-default workflow and fallback for argument-based commands. The local `UserPromptExpansion` hook handles supported argument calls on compatible hosts; it passes the no-argument wizard through to the model. `parseSlashArguments` delegates to `parseConfig`, whose nineteen top-level actions are `show`, `list-items`, `set-items`, `enable`, `disable`, `order`, `subagents`, `set`, `apply`, `item`, `instance`, `group`, `alignment`, `layout`, `preset`, `import`, `export`, `language` and `reset`. Supported action flags retain the shared parser's behavior. `profile` and `project` management are separate terminal/editor entry points; slash calls do not forward arbitrary terminal commands.

Model fallback must parse literal arguments and quote each value for the selected shell rather than interpolate raw invocation text. Preserve spaces, Unicode, empty values and shell metacharacters inside values; do not evaluate substitutions, variables, globs, pipes, redirections or chained commands. Let the installed configuration command validate the action once and report its exact result.

The wizard edits the user-default display in the active Claude configuration directory. Named-profile project bindings can select another display; host settings remain shared user-level settings in that directory. It must not claim that every project's display changes, silently select another target or modify profile bindings.

`statusline-configure/SKILL.md` is the short fallback shown when local interception did not handle the call. The external editor is a stable Node terminal TUI; the historical `--experimental-slash-tui` preference name remains for compatibility. The fallback describes failure to launch without inferring its cause, suggests terminal `configure` or the wizard and uses `.cmd` for Windows. It retains `disable-model-invocation: true`, the Bash/PowerShell exclusions and the prohibition on starting a terminal interface through any model tool.

## Guided question contract

The guided path reads interface-language preferences, the current configuration and both live catalogs before asking questions. Saved values define current selection; catalog `default_enabled` values do not replace them. Display language remains independent of interface language.

Preflight checks both instance lists and group lists, plus main-layout alignments. Duplicate metric types, text/spacers, groups or alignments stop the type-based form before any write, with pointers to the instance-aware editor or explicit structural commands. Simplifying the structure to fit the form is not allowed.

Missing installation or a foreign subagent renderer also stops preflight. Do not replace or disable another renderer to make the guided form proceed.

Generated metric pages contain at most three metric IDs each. Add one localized, exclusive “None on this page” option so each question has two to four choices. That answer clears only its page. Contradictory answers remain unresolved. Ask each metric page once across the main/subagent flow, combine all page selections and preserve retained order before appending newly enabled items in catalog order. One `AskUserQuestion` call contains no more than four questions.

Language selection uses consecutive pages of at most three language codes, followed by the selected page's native language names and an explicit “Keep current” choice. Twelve languages therefore fit a four-page chooser. Scalar options likewise start from their saved values. Theme choices are generated from the canonical theme registry; the guided save preserves themes and other appearance settings that are outside the form.

No configuration is saved after cancellation or while an answer remains unresolved. Once every answer is resolved, reread `config show --json` and compare display, host, installed state and subagent ownership with the initial snapshot. A change stops the flow and requires an explicit restart; do not restart or overwrite automatically. This is best effort, because `config apply` has no revision argument and cannot atomically compare the original snapshot. If the recheck matches, submit one `config apply`, then read `config show --json` to verify its result. Report apply or verification failures without retrying separate or reduced writes. [User workflow](../USER_GUIDE.md#statusline-config-wizard) · [CLI support](../reference/cli.md#slash-command-support)

## Source maintenance and regression coverage

The CLI installer renders the canonical templates for the exact installed executable, preserving literal paths and arguments. Item groups, language choices and theme choices come from shared registries rather than hand-maintained copies. Update the canonical resources and generator together, then run generation and the checks selected by the impact plan. Do not edit installed skills or regenerate the archived Python resources.

Regression coverage must check generated page size, unique complete metric coverage, language/appearance registry parity, current-value guidance, composition refusal, cancellation and single-save instructions, supported slash actions and the external fallback's tool restrictions. Template checks establish an instruction contract; they do not establish that a paid model followed every question or that a physical terminal behaved correctly. [Testing and acceptance](testing.md) · [Impact checks](impact-checks.md)

<a id="final-release"></a>

## Validation and release evidence

As of 2026-11-05, implementation and release preparation are in progress. Final local checks, final-head PR acceptance, merged-main and annotated-tag evidence, reproducible delivery files, npm publication, GitHub/Gitee synchronization, public downloads and test-machine upgrade verification are pending. Record their actual source, run, artifact and checksum identities here after verification; no published result is claimed.

Six actual skill-call scenarios are approved but not yet reported as passed. All paid calls, failures and retries share a USD 30 ceiling after the explicit 2026-11-05 increase, with at most USD 24 before publication and USD 6 after it. Unknown attempts retain their full conservative request reservation; subsequent calls require terminated prior work and guaranteed remaining headroom. Record scenario outcomes, actual usage, reserved upper bounds and remaining budget after verification.

Display schema 17, editor protocol 31 and existing storage formats are unchanged by this patch. The six previously accepted [issue #96 gaps](https://github.com/fbincon/claude-code-statusline/issues/96) remain unverified and do not waive new automated failures. [Release notes](../releases/v3.16.3.md) · [Version decision](../releases/approvals/v3.16.3.json)
