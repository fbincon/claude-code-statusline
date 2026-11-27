import { join } from 'node:path';
import { withLock } from '@fbincon/statusline-platform/files';
import { AGENT_ROWS, MANAGED_MODS, type InstallContext } from '../integration/model.js';
import { pending, readJournal, assertClear, refreshIntents, permitRefresh, RecoveryRequired } from './journal.js';
import { install, restoreDisabledAgentRows } from '../integration/install.js';
import { safeTarget } from '../integration/paths.js';
import { recoverFiles } from './files.js';
import { reconcile, trackedHost } from './official.js';
import { previousBinding } from '../integration/ownership.js';
import { integrationHandoffPending } from '../management/store.js';
export function administration<T>(context: InstallContext, dryRun: boolean, action: (tracked: InstallContext) => T): T {
    assertClear(context.configDir, true);
    if (dryRun)
        return action(context);
    const lock = join(context.configDir, 'statusline_runtime/admin.lock');
    safeTarget(context.configDir, lock);
    return withLock(lock, () => {
        assertClear(context.configDir, true);
        return permitRefresh(context.configDir, () => action({ ...context, host: spec => trackedHost(context, spec, context.host(spec)) }));
    });
}
export interface RecoveryResult {
    changed: boolean;
    transactions: {
        id: string;
        kind: string;
        outcome: string;
    }[];
}
export function recover(context: InstallContext, dryRun = false): RecoveryResult {
    const paths = pending(context.configDir);
    const intents = refreshIntents(context.configDir);
    if (!paths.length && !intents.length)
        return { changed: false, transactions: [] };
    function finishRefresh(result: RecoveryResult): RecoveryResult {
        const remaining = refreshIntents(context.configDir);
        if (!remaining.length)
            return result;
        const binding = previousBinding(context.configDir, context.io);
        if (!binding) throw new RecoveryRequired('Plugin refresh has no owned installation binding');
        if (integrationHandoffPending(context.configDir, binding)) {
            // The retained package runner reconciles these intents using the
            // target's capabilities. Do not reinstall its own bundled plugins.
            return { ...result, transactions: [...result.transactions, ...remaining.map(id => ({ id, kind: 'plugin-refresh', outcome: 'recover --package' }))] };
        }
        const bound = { ...context, launch: binding };
        if (remaining.includes(AGENT_ROWS.name) && (!dryRun || !pending(context.configDir).length)) {
            restoreDisabledAgentRows(bound, dryRun);
        }
        if (!dryRun && remaining.some(name => name !== AGENT_ROWS.name) &&
            install(bound, { finishDisabledRefresh: true }).failed)
            throw new RecoveryRequired('Plugin refresh is still incomplete; inspect doctor and the official inventory');
        if (!dryRun && refreshIntents(context.configDir).length)
            throw new RecoveryRequired('Plugin refresh is still incomplete; inspect doctor and the official inventory');
        return { changed: result.changed || !dryRun, transactions: [...result.transactions, ...remaining.map(id => ({ id, kind: 'plugin-refresh', outcome: 'restore-disabled' }))] };
    }
    if (!paths.length)
        return finishRefresh({ changed: false, transactions: [] });
    function run(): RecoveryResult {
        const current = pending(context.configDir);
        if (!current.length) return { changed: false, transactions: [] };
        if (current.length > 1)
            throw new RecoveryRequired('Multiple pending transactions require inspection; no automatic ordering is assumed');
        const journal = readJournal(context.configDir, current[0]!);
        let outcome: string;
        if (journal.kind === 'files') outcome = recoverFiles(journal, context.io, dryRun);
        else {
            const spec = MANAGED_MODS.find(mod => mod.name === journal.spec);
            if (!spec) throw new RecoveryRequired('Unrecognized official plugin');
            outcome = reconcile(context, spec, context.host(spec), journal, dryRun);
        }
        return { changed: !dryRun, transactions: [{ id: journal.id, kind: journal.kind, outcome }] };
    }
    if (dryRun)
        return finishRefresh(run());
    const lock = join(context.configDir, 'statusline_runtime/admin.lock');
    safeTarget(context.configDir, lock);
    return finishRefresh(withLock(lock, () => context.io.lock(context.configDir, run)));
}
