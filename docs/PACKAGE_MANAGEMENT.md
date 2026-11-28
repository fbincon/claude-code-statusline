# Package upgrades, rollback and recovery

**English** | [简体中文](PACKAGE_MANAGEMENT.zh-CN.md)

Version management is explicit through the CLI or either editor. Rendering and either editor never check for new packages. Use a persistent global npm installation; [first entry](SETUP.md#first-entry-and-persistent-npm-installation) can review and create one. Source checkouts and private engineering candidates use explicit development commands.

## Review from either editor

Open **Settings → Version and installation** in either editor. The overview reads local status and shows the installed version, installation channel and any unfinished transaction. Open **Installation details** for the prefix, executable entry, configuration directory, prior successful version and compatibility diagnostics. If the installation is ambiguous, edit the prefix there. Leave the field blank to detect the installation again.

Press Enter on **Target version** to enter an exact version. With the target blank, checks and upgrades use the selected channel and rollback uses the previous successful version. Press Enter on **Channel** to choose **Use installation channel**, **latest** or **beta**. The choice applies to automatic checks and upgrades in the current view. Exact versions take priority.

Select **Check version metadata** to contact the configured npm registry. The review reports whether the artifact was verified. Upgrade, package rollback and unfinished-package recovery reviews use the dry-run service and temporary staging with scripts disabled. Open **Recovery and history** for recovery and cleanup reviews and to review a verified configuration backup for restoration. The page reports damaged records and verifies backups against their recorded snapshot hashes. A compatible verified review enables a separate execution confirmation.

Use the current back key (default Q) to return one level with the originating row selected. Escape also works in the external editor. Press Ctrl+G to go back or cancel text input in either editor. Claude Code handles Escape in the native pane.

**Current review** and **Execution progress** reopen their reports from the overview. The external editor follows visible progress automatically. Use R to read it immediately in either editor. L reloads local installation status where shown, and C cancels this view’s review before execution. These letter keys follow your shortcut settings.

A verified review is bound to the selected installation, saved configuration revision, exact target and integrity. Changes require a fresh review. Exiting the overview cancels this view’s temporary review or detaches from execution. Reviews use saved configuration and preserve unsaved display drafts and source authorization. Execution and history cleanup each require their own explicit review and run with the current user’s privileges.

Ordinary npm manifest modes `0600`, `0644` and `0664` are supported. Recovery journals and snapshots still require private permissions. The v3.11.0 false warning is fixed by [#173](https://github.com/fbincon/claude-code-statusline/issues/173).

## Check and review

```text
claude-statusline update --check --json
claude-statusline update --dry-run
claude-statusline update
claude-statusline rollback
```

Checks query the configured scoped npm registry, or its default registry. Stable installs default to `latest`; a recorded channel remains selected. A prerelease without a recorded channel needs `--version EXACT` or `--channel latest|beta`. Channels resolve to an exact version before review. `update --version` refuses downgrades; use `rollback`. Rollback without a version selects the previous successful artifact for this prefix and configuration directory, checking the recorded integrity or inventory identity.

The review identifies the current and target package, registry, prefix, absolute Node/JS entry, Node/host compatibility, configuration formats, and artifact integrity. `--check` reports metadata compatibility without downloading the archive; its JSON explicitly reports `artifact_verified: false`. `--dry-run` also verifies a downloaded archive in a temporary staging prefix; when the installation is already current, it can instead return `unchanged: true` and `artifact_verified: false` without downloading. Neither writes the target installation or configuration. Temporary files and ordinary npm cache activity are separate from the target.

Pass `--prefix PATH` when multiple installations exist, and use the same `--config-dir PATH` that owns the integration. The target must be outside the npm cache. Permission failures require choosing or repairing a writable prefix; the product never invokes sudo or an elevation prompt. An installation without Claude integration stays package-only. An integrated installation requires a recognized compatible host and refreshes its owned resources.

<a id="package-operation-diagnosis"></a>

## Package operation diagnosis

`update --check --json` reports metadata compatibility; `update --dry-run` additionally verifies the archive. `recover --package --dry-run --prefix PATH --config-dir PATH` inspects a retained package transaction. Keep `recover --restore-config BACKUP_ID` separate from package repair. See [scripted changes](#scripted-changes) and [package transaction recovery](#package-transaction-recovery) for exact commands.

## Execute, detach and reconnect

After a verified review, choose execution and handle the current draft explicitly: save successfully and review again, export to a new file, discard explicitly, or cancel and retain the draft. Export does not mark it saved. Unknown save outcomes require read-only reconciliation; any saved configuration change requires a fresh package review. Execution rechecks installation identity, configuration revision, exact target and integrity before mutation.

The handoff returns a durable execution ID and an independent Node/JS control entry outside the replaced package. The old editor becomes read-only. The external editor follows the execution stages and the separate package, integration and configuration outcomes until a definite result arrives. If the executor’s state is unknown, the page checks less frequently. Use the refresh key to read immediately.

Closing the page detaches from execution. Reopen while unfinished to inspect or review recovery. The external editor verifies the retained runner and uses its own Node executable to run that runner’s JS entry, including when you reconnect from another supported Node installation. Keep the returned control entry to inspect progress even after downgrading to an older editor protocol. After completion reopen the external editor or restart Claude. A successful package replacement with failed integration remains incomplete and recoverable.

## Scripted changes

The following is the historical v3.7.0 → v3.8.0 migration example; the current documented version is 3.16.3. On a newer installation, `update --version 3.8.0` is a downgrade and is refused, and older packages have their own configuration-compatibility limits.

```text
claude-statusline update --version 3.8.0 --prefix /chosen/prefix --config-dir /chosen/claude --yes
claude-statusline rollback --version 3.7.0 --prefix /chosen/prefix --config-dir /chosen/claude --yes
```

Noninteractive package changes require all three: an exact `--version`, an explicit `--prefix`, and `--yes`. `--config-dir` is optional but recommended for isolated installations. Use quoted native paths; Windows supports `claude-statusline.cmd`. Ordinary interactive changes display a review and require `yes`, unless `--yes` was already explicit. Both editors offer the same reviewed execution rules.

Automatic transitions are tested from the actual published v3.7.0 archive. Its compatibility record is bound to SHA-256 `b1afec4a234368ab0ef2e23f728b8204122c86e17213af32738b6f3d84363e95`; registry metadata cannot substitute another legacy archive. New packages carry a versioned `statuslineCompatibility` declaration; current versions and read ranges are in the [CLI reference](reference/cli.md#protocol-and-schema-versions). Missing/unknown declarations, unsupported runtimes/hosts or unreadable configuration stop replacement.

v3.7.0 itself has no management commands. To move from it, run a newer public manager with `npx @fbincon/claude-code-statusline@3.8.0 update --version 3.8.0 --prefix PATH --config-dir PATH`, or use the retained recovery entry printed by a previous transaction. npm controls the initial npx download; the manager separately reviews the persistent change.

## Package transaction recovery

```text
claude-statusline recover --package --prefix /chosen/prefix --config-dir /chosen/claude --dry-run
claude-statusline recover --package --version 3.8.0 --prefix /chosen/prefix --config-dir /chosen/claude --yes
```

Each operation records its prefix, original/target identities, verified archive, configuration before-images and stages below `<CLAUDE_CONFIG_DIR>/statusline_runtime/package-management/transactions/pkg-ID/`. A prefix lock prevents simultaneous product operations even when they name different configuration directories. A prefix marker points to the unfinished record. These records use an independent format; older configuration recovery never interprets them as file/plugin journals.

The executor is copied outside the package before npm can replace it. A retained `recovery-runner/bin/claude-statusline.js` is transaction recovery material; it is not another managed installation and Claude is never bound to it. Run it with Node if the installed version lacks recovery commands or its entry is damaged. Keep its parent transaction directory until recovery and any needed configuration restoration are complete.

Recovery first inspects the actual package on disk. A valid target is verified and proceeds to integration without repeating the global npm replacement. A recorded incomplete/old package can be repaired from the verified retained archive after review. An unexpected package, changed target or invalid record blocks recovery. Ordinary `recover --dry-run` handles separate file/plugin transactions; resolve those before resuming the package operation.

Package replacement and integration are separate durable stages. A successful npm exit is not an upgrade-complete result. Failed integration, interruption or a configuration edit during npm leaves an incomplete record; review the actual state before resuming. The flow does not promise atomicity across npm and configuration. Completed transitions preserve schemes, project bindings, execution authorization and independent disabled options. Restart Claude after the verified integration to load matching resources.

### Resume a 3.16.4 update on Claude Code 2.1.330

When the retained transaction targets 3.16.4 and Claude Code 2.1.330 rejected the bundled plugin validation, start the v3.16.5 manager in a separate npm environment. Use the original persistent prefix and Claude configuration directory. The review still targets 3.16.4.

```text
npx --yes --package @fbincon/claude-code-statusline@3.16.5 -- claude-statusline recover --package --version 3.16.4 --prefix PATH --config-dir PATH --dry-run
npx --yes --package @fbincon/claude-code-statusline@3.16.5 -- claude-statusline recover --package --version 3.16.4 --prefix PATH --config-dir PATH --yes
```

After recovery completes, check the installation with `claude-statusline doctor` and run the normal `update --version 3.16.5` from the original prefix. This recovery uses the retained archive and verifies the owned plugin caches and backend bindings. [Issue #292](https://github.com/fbincon/claude-code-statusline/issues/292)

## Protected history cleanup

History is paginated for the selected installation prefix. Explicit cleanup accepts only selected, completed and unreferenced owned records, rechecking the review under installation/configuration locks. Running or unverifiable executors, unfinished transactions, attached control entries, current/previous rollback material and necessary snapshots are protected. Unreadable ownership or references block deletion. Configuration restoration stays a separate review and never silently restores source permission.

## Separate configuration restoration

```text
claude-statusline recover --restore-config pkg-BACKUP_ID --prefix /chosen/prefix --config-dir /chosen/claude --dry-run
claude-statusline recover --restore-config pkg-BACKUP_ID --prefix /chosen/prefix --config-dir /chosen/claude --yes
```

Replace `pkg-BACKUP_ID` with the exact UUID-based ID printed by the operation. The review lists files and revisions. With an explicit prefix, this restoration works without npm. It restores the display and Profile collection, including project bindings. Reconciliation follows the current installation's subagent renderer preference and ownership rules. Current source execution grants, editor and collector choices, interface preferences and unrelated Claude settings are preserved.

When downgrading to a package that predates the AgentRow Mod, the newer recovery runner removes the owned row plugin and cancels any pending handover before the older installer runs. On hosts with a verified callback, enabled custom rows can return to the legacy command. The process preserves third-party row settings and manual plugin disablement.

Restoration validates snapshot hashes, rechecks current revisions under the configuration lock, and backs up the content being replaced through the existing file transaction. Missing or changed snapshots and concurrent edits block it. Incompatible rollback stops before package replacement; restore an applicable snapshot separately, then review rollback again. Do not edit schema numbers to force acceptance.

## Earlier or manually installed versions

Versions before v3.7.0 need manual recovery. Stop Claude, export current display choices if useful, retain the working Node/package entry and a compatible pre-change configuration backup, then deliberately install the exact older package into the selected prefix with npm. Restore only applicable product configuration, retain unrelated settings and current opt-outs, run that version's `install` and `doctor`, and restart Claude. Python-era recovery remains documented in the [user guide](USER_GUIDE.md#upgrading). An npm failure with unknown results must be inspected before another install.

See the [CLI reference](reference/cli.md), [npm installation rules](https://docs.npmjs.com/cli/v11/commands/npm-install/), and [implementation/acceptance record](development/history/deliveries/m8-m9-delivery.md).

## Related guides

- [First-use setup](SETUP.md)
- [User guide](USER_GUIDE.md)
- [Input diagnosis](DIAGNOSTICS.md)
