# TypeScript candidate recovery

**English** | [简体中文](recovery.zh-CN.md)

This procedure applies to the private TS-04 candidate. The released Python
package and the maintainer's existing installation remain unchanged. Run the
candidate with an explicit isolated configuration directory until release
acceptance authorizes a cutover.

## Inspect and recover

```bash
node packages/cli/dist/src/entry.js doctor --config-dir /absolute/isolated/config
node packages/cli/dist/src/entry.js recover --config-dir /absolute/isolated/config --dry-run
node packages/cli/dist/src/entry.js recover --config-dir /absolute/isolated/config
```

`doctor` reports unfinished work without repairing files. `recover --dry-run`
checks paths, ownership, snapshots and current contents without changing the
candidate's files. Ordinary configuration saves, UI-language writes and new
installation transactions refuse unresolved checkpoints. Rendering and runtime
observations remain available. Recovery is explicit and never runs at renderer
startup.

| Checkpoint | Recovery |
| --- | --- |
| Prepared or partially applied file phase | Validate every target and backup, then restore original bytes, absence and applicable POSIX modes. |
| Durable committed file phase | Confirm the new bytes and clear the checkpoint; retain the completed change. |
| Interrupted rollback | Repeat restoration idempotently from the same immutable snapshots. |
| Unconfirmed official plugin operation | Read official inventory, verified cache and binding. Confirm the requested state or establish the unchanged prior state before clearing the checkpoint. Never replay the recorded mutating argv. |
| Interrupted refresh of a user-disabled plugin | Preserve the disablement intent across uninstall/reinstall. After reconciliation, finish the owned installation and restore disablement. The dry-run reports `restore-disabled`. |
| Foreign changes, altered backup, unsupported journal or ambiguous plugin state | Stop before restoration and retain evidence for inspection. |

Normal file phases and official plugin operations are separate. A failed Mod
operation can leave working compatibility settings installed. Recovery does not
roll back unrelated completed phases or erase explicit opt-outs. A resolved
`not-applied` plugin operation can be followed by ordinary `install`; the
installer re-reads actual inventory before deciding the next operation.

## Evidence and ownership

Private journals are under `statusline_runtime/transactions/txn-*.json`.
Before-images remain in `backups/statusline/cli-*`; files are created exclusively,
synced and hash-bound before publishing intent. Recovery rejects links/reparse
points, escaping paths, duplicate keys, unsupported schemas and content changes
outside the recorded before/after states. A live process identity is not taken
over. The common installation lock serializes file publication; an additional
administration lock serializes multi-phase plugin work.

`statusline_runtime/installation.json` records the Node/JS binding and, only
during an interrupted refresh, the plugin disablement intent. Doctor reports
such an intent as unfinished work. Configuration writers wait for recovery;
install/recover can finish the verified refresh. Unknown files in owned resource
directories are retained.

Keep the original Python environment available during migration. The installer
recognizes historical owned commands and reports PATH collisions, but never
uninstalls Python or rewrites an unrelated renderer without the existing explicit
`--force` choice. Completed upgrades retain compatible before-image backups;
`recover` handles interrupted transactions rather than selecting arbitrary old
backup versions. A manual rollback should inspect those backups and restore the
matching historical package and its binding together.

Tests terminate real child processes at preparation, each file boundary, commit,
rollback, Mod staging, official-operation return and the disabled-plugin refresh
gap. These are process-interruption tests, not a claim of hardware power-loss
testing. Parent-directory syncing follows the platform adapter: unsupported
filesystem/Windows directory-sync behavior remains an explicit platform limit.

For ambiguous official state, inspect the same `CLAUDE_CONFIG_DIR` using
`claude plugin list --json`, `claude plugin marketplace list --json`, and
`claude plugin configure PLUGIN --json`. Resolve the reported ownership or
binding discrepancy, then run recovery again. Do not delete the journal merely
to bypass the guard or edit Claude's plugin registries directly.
