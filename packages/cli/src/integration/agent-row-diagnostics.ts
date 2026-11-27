import type { DisplayDraft } from '@fbincon/statusline-core/contracts/ui';
import { object } from '@fbincon/statusline-core/config/validation';
import { text } from '@fbincon/statusline-core/i18n/messages';
import { configuredAgentRows } from '../config/agent-rows.js';
import { installationIdentity } from '../config/host.js';
import { readProfiles } from '../rendering/configuration.js';
import { agentRowCapabilities, inspectAgentRowRoute } from './agent-row-route.js';
import { latestAgentRowEvidence } from './agent-row-evidence.js';
import { AGENT_ROWS, type Diagnostic, type InstallContext } from './model.js';
import { cacheOwned, owner, registered } from './mod-ownership.js';
import { bindingMatches, bindingValues } from './mods.js';
import { bundledFiles, digest } from './resources.js';

type DiskState = 'absent' | 'disabled' | 'mismatch' | 'suspended' | 'verified';

function agentRowDisk(context: InstallContext, settings: Record<string, unknown>, installationId: string | null): DiskState {
    const {configDir, io, version} = context;
    const marker = owner(configDir, AGENT_ROWS, io);
    const explicitlyEnabled = object(settings.enabledPlugins) && settings.enabledPlugins[AGENT_ROWS.plugin] === true;
    if (!marker) return explicitlyEnabled ? 'mismatch' : 'absent';
    if (!agentRowCapabilities(version).mod) return explicitlyEnabled ? 'mismatch' : 'suspended';
    const bundle = bundledFiles(AGENT_ROWS), manifest = bundle.inventory;
    if (marker.backend_version !== manifest.backend_version || marker.mod_version !== manifest.mod_version ||
        marker.protocol_version !== manifest.protocol_version) return 'mismatch';
    const prefix = 'plugins/' + AGENT_ROWS.name + '/';
    if (bundle.files.size + 1 !== Object.keys(marker.files).length ||
        [...bundle.files].some(([name, raw]) => marker.files[prefix + name] !== digest(raw))) return 'mismatch';
    const host = context.host(AGENT_ROWS), [markets, plugins] = host.listing();
    const [market, row] = registered(configDir, AGENT_ROWS, markets, plugins, marker);
    if (!market || !row) return 'mismatch';
    cacheOwned(configDir, AGENT_ROWS, row, marker, io, true);
    if (row.enabled !== true) return 'disabled';
    if (!installationId) return 'mismatch';
    const options = host.run(['configure', AGENT_ROWS.plugin, '--json'], undefined, true);
    return bindingMatches(options, bindingValues(context, AGENT_ROWS)) ? 'verified' : 'mismatch';
}

export function agentRowDiagnostics(context: InstallContext, settings: Record<string, unknown>, display: DisplayDraft, rows: Diagnostic[]): void {
    const requested = configuredAgentRows(display, readProfiles(context.configDir, context.io)[0]);
    const route = inspectAgentRowRoute(context, settings, requested, {evidence: false});
    const legacy = installationIdentity(settings, context.launch).subagentStatusLine!.state;
    const invalidLegacy = route.legacy === 'write' && legacy !== 'owned' || route.legacy === 'remove' && legacy === 'owned';
    const warning = requested && !['legacy', 'mod-selected'].includes(route.reason);
    rows.push({level: invalidLegacy ? 'ERROR' : warning ? 'WARN' : 'OK', message: text('agent_rows.doctor.route', {
        preference: route.preference, mode: route.mode, legacy, reason: text('agent_rows.reason.' + route.reason),
    })});
    try {
        const evidence = latestAgentRowEvidence(context.configDir, route.installationId, context.version?.join('.') ?? '');
        const when = (stamp: number | null) => stamp !== null ? new Date(stamp).toISOString() : text('diagnose.status.not_observed');
        rows.push({level: 'OK', message: text('agent_rows.doctor.evidence', {loaded: when(evidence.loadedAt), verified: when(evidence.verifiedAt)})});
    } catch (error) {
        rows.push({level: 'ERROR', message: String(error)});
    }
    const disk = agentRowDisk(context, settings, route.installationId);
    const wantsMod = route.mode === 'mod' || route.mode === 'standby';
    const level = disk === 'mismatch' ? 'ERROR' : wantsMod && disk !== 'verified' ? 'WARN' : 'OK';
    rows.push({level, message: text('agent_rows.doctor.disk', {state: text('agent_rows.disk.' + disk)})});
}
