import { randomUUID } from 'node:crypto';
import { object } from '@fbincon/statusline-core/config/validation';
import { agentRowCapabilities } from '@fbincon/statusline-core/integration/agent-row-capabilities';
import { ownedCommand } from '@fbincon/statusline-platform/commands';
import { revision } from '@fbincon/statusline-platform/hash';
import type { LaunchSpec } from '@fbincon/statusline-platform/launch';
import { AGENT_ROWS, VERSION, type InstallContext } from './model.js';
import { previousBinding } from './ownership.js';
import type { Change } from './transaction.js';
import { idleRoute, isDigest, isPreference, readAgentRowRoute, routeChange, routeSnapshot,
    type AgentRowPreference, type AgentRowRoute, type RouteReason, type SelectedRows } from './agent-row-state.js';
import { latestAgentRowEvidence } from './agent-row-evidence.js';

export { agentRowCapabilities };
export { AGENT_ROW_ROUTE_FILE, AGENT_ROW_EVIDENCE_FILE } from './agent-row-paths.js';
export { readAgentRowRoute, deactivateAgentRowRoute } from './agent-row-state.js';
export type { AgentRowPreference, AgentRowMode, AgentRowRoute, RouteReason } from './agent-row-state.js';
export { agentRowAccess, agentRowLoaded, beginAgentRowBatch, confirmAgentRowBatch, agentRowReady, type AgentRowIdentity } from './agent-row-session.js';

type Context = Pick<InstallContext, 'configDir' | 'launch' | 'version' | 'io'>;
type Settings = Record<string, unknown>;
type RowOptions = { preference?: AgentRowPreference; force?: boolean; modUnavailable?: 'disabled' | 'failed';
    modSuspended?: boolean; resourceRevision?: string | (() => string) };
type LegacyAction = 'write' | 'keep' | 'remove';
interface Selection {
    preference: AgentRowPreference;
    mode: SelectedRows;
    reason: RouteReason;
    legacy: LegacyAction;
    wantMod: boolean;
    unsupported: boolean;
}
export interface AgentRowInstallPlan extends Selection { installationId: string | null; change: Change | null }

function ownerLaunch(context: Context, current: unknown): LaunchSpec | null {
    if (!object(current) || current.type !== 'command') return null;
    if (ownedCommand(current.command, 'render-subagents', context.launch)) return context.launch;
    const previous = previousBinding(context.configDir, context.io);
    return previous && ownedCommand(current.command, 'render-subagents', previous) ? previous : null;
}

function choose(context: Context, settings: Settings, rows: boolean, options: RowOptions, before: AgentRowRoute | null): Selection {
    const preference = options.preference ?? before?.preference ?? 'auto';
    if (!isPreference(preference)) throw new Error('Invalid subagent renderer preference');
    const capabilities = agentRowCapabilities(context.version);
    const chooseMode = (mode: SelectedRows, reason: RouteReason, legacy: LegacyAction, unsupported = false): Selection =>
        ({ preference, mode, reason, legacy, wantMod: mode === 'mod' || mode === 'standby', unsupported });
    const unavailable = (reason: RouteReason) => chooseMode('preserve', reason, 'keep', true);
    if (preference !== 'auto' && !capabilities[preference]) return unavailable('unavailable');
    if (!rows) return chooseMode('builtin', 'disabled', 'remove');
    if (settings.disableAllHooks === true) return preference === 'auto' ?
        chooseMode('builtin', 'restricted', 'keep') : unavailable('restricted');
    if (!capabilities.legacy && !capabilities.mod) {
        if (!context.version) return chooseMode('preserve', 'unknown-host', 'keep');
        const gap = context.version[0] === 2 && context.version[1] === 1 && [323, 324, 325].includes(context.version[2]!);
        return gap ? chooseMode('builtin', 'callback-gap', 'remove') : chooseMode('preserve', 'unsupported-host', 'keep');
    }
    if (preference === 'legacy' || !capabilities.mod) return chooseMode('legacy', 'legacy', 'write');
    const old = settings.subagentStatusLine, owner = ownerLaunch(context, old);
    if (old != null && !owner) return preference === 'mod' ?
        unavailable('foreign') : chooseMode('preserve', 'foreign', 'keep');
    const configured = object(settings.enabledPlugins) ? settings.enabledPlugins[AGENT_ROWS.plugin] : undefined;
    // The host accepts a version list in settings, but only literal true enables
    // a marketplace plugin. A user re-enabling it supersedes its recorded opt-out.
    const disabled = !options.modSuspended && configured !== undefined && configured !== true;
    const remembered = !options.preference && before?.reason === 'mod-disabled' && configured !== true;
    const blocked = options.modUnavailable ?? (disabled || remembered ? 'disabled' : null);
    if (blocked) {
        const reason = blocked === 'disabled' ? 'mod-disabled' : 'mod-failed';
        if (preference === 'mod') return unavailable(reason);
        return capabilities.legacy ? chooseMode('legacy', reason, 'write') : chooseMode('builtin', reason, 'keep');
    }
    if (old != null) return chooseMode('standby', 'awaiting-mod', 'keep');
    return chooseMode('mod', 'mod-selected', 'remove');
}

function activation(context: Context, settings: Settings, before: AgentRowRoute | null, selection: Selection, options: RowOptions): AgentRowRoute {
    const standby = selection.mode === 'standby';
    const legacy = standby ? settings.subagentStatusLine : null;
    const signature = {
        hostVersion: context.version!.join('.'), backendVersion: VERSION, launchRevision: revision(context.launch),
        resourceRevision: (typeof options.resourceRevision === 'function' ? options.resourceRevision() : options.resourceRevision) ??
            before?.resourceRevision ?? null,
        legacyRevision: legacy ? revision(legacy) : null,
        legacyLaunch: standby ? ownerLaunch(context, legacy) : null,
    };
    if (signature.resourceRevision !== null && !isDigest(signature.resourceRevision))
        throw new Error('Invalid agent row resource revision');
    if (standby && !signature.legacyLaunch) throw new Error('Cannot establish ownership of the old agent row command');
    const next: AgentRowRoute = { ...idleRoute(selection.preference, 'builtin', selection.reason),
        ...signature, mode: standby ? 'standby' : 'mod', installationId: before?.installationId ?? null };
    if (!next.installationId || revision(next) !== revision(before)) next.installationId = randomUUID();
    return next;
}

/** Plan only. The installer publishes the returned generation in its existing locked transaction. */
export function planAgentRowInstall(context: Context, settings: Settings, rows: boolean, options: RowOptions = {}): AgentRowInstallPlan {
    const before = routeSnapshot(context.configDir);
    const selection = choose(context, settings, rows, options, before.state);
    if (selection.mode === 'preserve')
        return { ...selection, installationId: before.state?.installationId ?? null, change: null };
    let desired: AgentRowRoute | null = null;
    if (selection.wantMod) desired = activation(context, settings, before.state, selection, options);
    else if (selection.preference !== 'auto' || selection.reason === 'mod-failed' || selection.reason === 'mod-disabled')
        desired = idleRoute(selection.preference, selection.mode === 'legacy' ? 'legacy' : 'builtin', selection.reason);
    return { ...selection, installationId: desired?.installationId ?? null, change: routeChange(context.configDir, before, desired) };
}

/** Editors and doctor never manufacture an install or a migration generation. */
export function inspectAgentRowRoute(context: Context, settings: Settings, rows: boolean, options: { evidence?: boolean } = {}) {
    const state = readAgentRowRoute(context.configDir);
    const selection = choose(context, settings, rows, {}, state);
    const caps = agentRowCapabilities(context.version);
    if (!rows && state?.mode === 'standby' && state.legacyRevision === revision(settings.subagentStatusLine ?? null)) {
        // Config/Profile saves only change display settings. The old command
        // already passes when off; keep this reviewed handoff resumable on re-enable.
        selection.legacy = 'keep';
    } else if (selection.wantMod) {
        if (!state?.installationId || state.backendVersion !== VERSION || state.launchRevision !== revision(context.launch)) {
            const current = settings.subagentStatusLine;
            const fallback = caps.legacy && !!ownerLaunch(context, current);
            selection.mode = fallback ? 'legacy' : 'builtin';
            selection.reason = state?.reason === 'mod-failed' ? 'mod-failed' : 'not-installed';
            // A newly enabled Profile can acquire its first owned row without an
            // interactive plugin install while the legacy command still works.
            const firstLegacy = !state?.installationId && current == null && selection.preference === 'auto' && caps.legacy;
            selection.legacy = fallback || firstLegacy || state?.mode === 'legacy' && caps.legacy ? 'write' : 'keep';
        } else if (state.mode === 'standby') {
            selection.legacy = 'keep';
            if (revision(settings.subagentStatusLine ?? null) !== state.legacyRevision) {
                selection.mode = 'preserve';
                selection.reason = 'ownership-changed';
            }
        } else if (settings.subagentStatusLine != null) {
            selection.mode = 'preserve';
            selection.reason = 'ownership-changed';
            selection.legacy = 'keep';
        }
    }
    const evidence = options.evidence === false ? { loadedAt: null, verifiedAt: null } :
        latestAgentRowEvidence(context.configDir, state?.installationId ?? null, context.version?.join('.') ?? '');
    return { ...selection, installationId: state?.installationId ?? null, ...evidence };
}
