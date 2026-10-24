# First-use setup

**English** | [简体中文](SETUP.zh-CN.md)

After installing the npm package, run:

```sh
claude-statusline setup --dry-run
claude-statusline setup
```

The wizard checks the environment, lets you keep the current display or select a [complete scheme](SCHEMES.md), previews the candidate, and reviews changes before saving. Existing installations initially select **Keep**. New installations recommend **Daily development**. Arrow keys select, Enter continues, Backspace returns, Page Up/Down scroll details, Tab switches Quick setup's main/subagent preview, and Esc cancels. The external terminal must be at least 64 columns by 18 rows; resizing retains the draft.

Use `claude-statusline --language zh-CN setup` for an invocation language override. Pressing L inside the wizard explicitly changes and immediately saves the UI language. Display language remains part of the display draft. All six supported languages are available.

## First entry and persistent npm installation

In an interactive terminal, run `npx @fbincon/claude-code-statusline` or run an already installed `claude-statusline` without a subcommand. The entry checks the public package identity, Node/npm, effective registry and global prefix. It shows the exact version and location and requires `yes` before installing. npm's initial npx download has its own confirmation.

A matching persistent package is reused, including read-only system installations. A different version, conflicting PATH/integration prefix or pending package operation stops the flow. Select a location explicitly with `--prefix PATH`; the target must be outside npm's cache. No privilege elevation or account login occurs. Source checkouts and engineering candidates keep using explicit commands.

After verification, the global Node/JS entry runs the existing setup wizard. Removing the temporary npx cache after the flow exits does not remove that entry or its Claude binding. Package installation, display Save and Claude integration remain separate stages; cancelling setup retains a completed package install. A failed/uncertain npm step leaves an operation record and cannot be retried blindly.

No-argument non-TTY entry exits 2 without installation or configuration changes. Explicit `--dry-run` may inspect npm locations and print the review without changing the target. `--config-dir PATH` selects the same isolated configuration directory for the later setup.

## Checks and targets

`setup --dry-run` works without a TTY. It checks Node, the detected Claude version, configuration readability/permissions, resource ownership and pending recovery, then prints the steps. It does not choose a scheme, create configuration directories or locks, run a write probe, install plugins, or recover transactions. Ordinary non-TTY `setup` exits 2 and prints the existing commands. Dry-run exits 0 when integration is eligible and 1 when checks block it.

```sh
claude-statusline setup --config-dir '/path with spaces/claude'
```

The target is always the **user default**. The wizard reports saved profiles, project bindings and the current project's bound scheme; it does not replace those bindings. Use `configure --profile NAME`, `configure --project PATH` or the editor's scheme manager to edit those targets afterward.

Integration requires a detected Claude version of at least 2.1.205. This is the wizard's basic integration boundary, not a claim that every optional field or editor works on that host. Existing capability checks continue to suspend unsupported features. Missing/unknown/older Claude or a third-party integration can still permit **Save display only**. Damaged display/settings/profile files or pending transactions block saving. Inspect the reported file or run `claude-statusline recover --dry-run` before an explicit recovery; the wizard does not reset damaged files or force ownership.

Permission checks are read-only and cannot guarantee that a later disk write will succeed. Revisions and ownership are checked again before committing.

## Apply and recovery

The final review offers **Save display and integrate**, **Save display only**, and **Cancel**. It shows display changes, planned file resources, retained editor/collector choices and the separate official plugin stage. Review details are scrollable.

Display save and integration are separate durable commits with backups. Display-only save works before installation and does not apply Claude host preferences. Integration reuses the existing installer and plugin recovery journal. Selecting a scheme never enables native timing or live metrics; saved opt-outs survive.

Cancellation before Apply leaves display and integration unchanged. An explicitly saved UI language remains saved. If a later stage fails, the result states whether display save already completed, prints available backup locations and directs you to `doctor`/`recover`. It does not promise whole-flow rollback. Inspect pending transactions before repeating setup; concurrent changes require a fresh review.

Successful checks confirm written resources. Restart Claude and inspect the actual status line to verify session loading. A fixed preview does not establish live observations or successful restart. Continue editing with `/statusline-config` or `claude-statusline configure --user`; use `doctor` for installation diagnosis.

`install`, `doctor`, `configure`, and configuration CLI commands remain available. Setup does not download/upgrade the package, install fonts, log in to an account, or change independent Claude preferences. See [installation and rollback](USER_GUIDE.md) and [appearance compatibility](APPEARANCE.md#configuration-compatibility-and-recovery).
