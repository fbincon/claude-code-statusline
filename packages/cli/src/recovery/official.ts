import { join } from 'node:path';
import { equalSettings } from '@fbincon/statusline-core/json-equality';
import { object } from '@fbincon/statusline-core/config/validation';
import { UnconfirmedOperation } from '@fbincon/statusline-platform/plugin-host';
import { resolvedPath } from '@fbincon/statusline-platform/commands';
import { type InstallContext, type Host, type ModSpec } from '../integration/model.js';
import { owner, registered, cacheOwned } from '../integration/mod-ownership.js';
import { bindingMatches } from '../integration/mods.js';
import { base, persist, complete, checkpoint, assertClear, active, RecoveryRequired, type OfficialJournal } from './journal.js';
interface Observed {
    market: unknown;
    plugin: Record<string, unknown> | null;
    inputs: unknown;
    currentCache: boolean;
}
function inspect(context: InstallContext, spec: ModSpec, host: Host, args: readonly string[]): Observed {
    const marker = owner(context.configDir, spec, context.io, true), [markets, plugins] = host.listing();
    const [registeredMarket, row] = registered(context.configDir, spec, markets, plugins, marker);
    let currentCache = false;
    if (row) {
        cacheOwned(context.configDir, spec, row, marker!, context.io);
        try {
            cacheOwned(context.configDir, spec, row, marker!, context.io, true);
            currentCache = true;
        }
        catch { /* A verified historical cache is distinguishable from the new one. */ }
    }
    const plugin = row ? Object.fromEntries(['id', 'scope', 'version', 'installPath', 'enabled'].map(key => [key, key === 'installPath' && typeof row[key] === 'string' ? resolvedPath(row[key]) : row[key] ?? null])) : null;
    const configured = row && ['configure', 'install', 'update'].includes(args[0] ?? '') ? host.run(['configure', spec.plugin, '--json'], undefined, true) : null;
    return { market: registeredMarket ? { name: spec.marketplace, path: resolvedPath(join(context.configDir, spec.name)), source: 'directory' } : null, plugin, inputs: object(configured) ? configured.inputs ?? null : null, currentCache };
}
function mutation(args: readonly string[]): boolean {
    return ['install', 'uninstall', 'update', 'enable', 'disable'].includes(args[0] ?? '') || args[0] === 'configure' && args.includes('--values-stdin') || args[0] === 'marketplace' && ['add', 'remove', 'update'].includes(args[1] ?? '');
}
function validate(journal: OfficialJournal, spec: ModSpec): void {
    const args = journal.args, operation = args[0];
    if (!mutation(args) || operation === 'marketplace' && (args[1] === 'add' ? resolvedPath(args[2]!) !== resolvedPath(join(journal.configDir, spec.name)) : args[2] !== spec.marketplace) || operation !== 'marketplace' && args[1] !== spec.plugin)
        throw new RecoveryRequired('Untrusted official operation identity');
    if (journal.values && (operation !== 'configure' || !args.includes('--values-stdin')))
        throw new RecoveryRequired('Unexpected official operation values');
    let valid = false;
    if (operation === 'marketplace')
        valid = args[1] === 'remove' ? args.length === 5 && args[3] === '--scope' && args[4] === 'user' : args.length === 3;
    else if (operation === 'configure')
        valid = args.length === 3 && args[2] === '--values-stdin' && journal.values !== null;
    else if (operation === 'uninstall')
        valid = args.length === 4 && args[2] === '--scope' && args[3] === 'user';
    else if (operation === 'install')
        valid = args.length >= 5 && args[2] === '--scope' && args[3] === 'user' && args[4] === '--json' && (args.length - 5) % 2 === 0 && args.slice(5).every((arg, index) => index % 2 ? /^[A-Za-z]+=/u.test(arg) : arg === '--config');
    else
        valid = args.length === 5 && args[2] === '--scope' && args[3] === 'user' && args[4] === '--json';
    if (!valid)
        throw new RecoveryRequired('Unsupported official operation checkpoint');
}
function expected(journal: OfficialJournal, state: Observed): boolean {
    const args = journal.args;
    if (args[0] === 'marketplace')
        return args[1] === 'remove' ? state.market === null : state.market !== null;
    if (args[0] === 'uninstall')
        return state.plugin === null;
    if (!state.plugin)
        return false;
    if (args[0] === 'enable' || args[0] === 'disable')
        return state.plugin.enabled === (args[0] === 'enable');
    if (args[0] === 'configure')
        return bindingMatches({ inputs: state.inputs }, journal.values ?? {});
    if (!state.currentCache)
        return false;
    const values = Object.fromEntries(args.flatMap((value, index) => args[index - 1] === '--config' && value.includes('=') ? [[value.slice(0, value.indexOf('=')), value.slice(value.indexOf('=') + 1)]] : []));
    return args[0] === 'update' || state.plugin.enabled === true && bindingMatches({ inputs: state.inputs }, values);
}
/** Only inventory/configuration reads are used during recovery. Mutating argv is never replayed. */
export function reconcile(context: InstallContext, spec: ModSpec, host: Host, journal: OfficialJournal, dryRun = false): 'confirmed' | 'not-applied' {
    validate(journal, spec);
    if (active(journal))
        throw new RecoveryRequired('Official operation owner is still running');
    const actual = inspect(context, spec, host, journal.args);
    const before = structuredClone(journal.before);
    if (object(before)) for (const [key, field] of [['market', 'path'], ['plugin', 'installPath']] as const) if (object(before[key]) && typeof before[key][field] === 'string') before[key][field] = resolvedPath(before[key][field]);
    const state = expected(journal, actual) ? 'confirmed' : equalSettings(actual, before) ? 'not-applied' : null;
    if (!state)
        throw new RecoveryRequired('Official operation is still ambiguous; inspect its inventory and binding before retrying');
    if (!dryRun)
        complete(journal);
    return state;
}
export function trackedHost(context: InstallContext, spec: ModSpec, host: Host): Host {
    return {
        listing: () => host.listing(),
        run(args, values, json) {
            if (!mutation(args))
                return host.run(args, values, json);
            return context.io.lock(context.configDir, () => {
                assertClear(context.configDir);
                const journal: OfficialJournal = { ...base(context.configDir, args.slice(0, 2).join(' '), 'official'), kind: 'official', spec: spec.name as OfficialJournal['spec'], args: [...args], values: values ?? null, before: inspect(context, spec, host, args), phase: 'prepared' };
                validate(journal, spec);
                persist(journal);
                checkpoint('official-prepared', journal);
                try {
                    const result = host.run(args, values, json);
                    checkpoint('official-returned', journal);
                    const actual = inspect(context, spec, host, args);
                    if (!expected(journal, actual))
                        throw new UnconfirmedOperation('Official plugin result was not confirmed by inventory and binding');
                    complete(journal);
                    return result;
                }
                catch (error) {
                    if (!(error instanceof UnconfirmedOperation)) {
                        try {
                            if (equalSettings(inspect(context, spec, host, args), journal.before)) {
                                complete(journal);
                                throw error;
                            }
                        }
                        catch (checked) {
                            if (checked === error)
                                throw error;
                        }
                    }
                    journal.phase = 'uncertain';
                    persist(journal);
                    throw new RecoveryRequired(String(error) + '; run `claude-statusline recover` to reconcile the official operation');
                }
            });
        },
    };
}
