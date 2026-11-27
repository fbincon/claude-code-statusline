import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { agentRowCapabilities } from '@fbincon/statusline-core/integration/agent-row-capabilities';
import { CONFIG_FILENAME } from '@fbincon/statusline-core/config/display';
import { MAX_PROFILES_BYTES, PROFILES_FILENAME } from '@fbincon/statusline-core/config/profiles';
import { object } from '@fbincon/statusline-core/config/validation';
import { ownedCommand } from '@fbincon/statusline-platform/commands';
import { lock } from '@fbincon/statusline-platform/files';
import { revision, sha256 } from '@fbincon/statusline-platform/hash';
import { readBoundedRegularFile } from '@fbincon/statusline-platform/regular-file';
import type { LaunchSpec } from '@fbincon/statusline-platform/launch';
import { createStorage, jsonBytes, readSettings, type Storage } from '../config/storage.js';
import { assertClear } from '../recovery/journal.js';
import { AGENT_ROWS, VERSION } from './model.js';
import { owner } from './mod-ownership.js';
import { bindingRecord } from './ownership.js';
import { commit, safeTarget } from './transaction.js';
import { isGeneration, isHost, privateJson, routeChange, routeSnapshot, type AgentRowMode } from './agent-row-state.js';
import { addSession, findSession, readEvidence, saveEvidence, type AgentRowIdentity } from './agent-row-evidence.js';
export type { AgentRowIdentity };

const CONFIG_LIMIT = 32 * 1024 * 1024;
const CONFIRMATION_LIFETIME_MS = 120_000;
// Settings, bindings and plugin resources are normal installation artifacts; only
// our route and its changing session receipt require private-state permissions.
const io: Storage = { ...createStorage(), read: path => readBoundedRegularFile(path, CONFIG_LIMIT) };

function validIdentity(identity: AgentRowIdentity): boolean {
    return typeof identity.session_id === 'string' && identity.session_id.length > 0 && identity.session_id.length <= 256 &&
        !/[\u0000-\u001f]/u.test(identity.session_id) && isHost(identity.host_version) &&
        agentRowCapabilities(identity.host_version.split('.').map(Number)).mod &&
        identity.backend_version === VERSION && isGeneration(identity.installation_id) &&
        typeof identity.cwd === 'string' && identity.cwd.length > 0 && !identity.cwd.includes('\0');
}

/** Check the options the host will pass to the next session, not just a running plugin's stale copy. */
function boundOptions(settings: Record<string, unknown>, directory: string, identity: AgentRowIdentity, launch: LaunchSpec): boolean {
    const enabled = object(settings.enabledPlugins) ? settings.enabledPlugins[AGENT_ROWS.plugin] : undefined;
    if (enabled !== true) return false;
    const config = object(settings.pluginConfigs) ? settings.pluginConfigs[AGENT_ROWS.plugin] : undefined;
    const opts = object(config) ? config.options : undefined;
    if (!object(opts) || opts.installationId !== identity.installation_id || opts.backendVersion !== identity.backend_version ||
        opts.configDir !== directory || opts.backendExecutable !== launch.executable) return false;
    try {
        const args: unknown = typeof opts.backendArgs === 'string' ? JSON.parse(opts.backendArgs) : opts.backendArgs;
        return Array.isArray(args) && revision(args) === revision(launch.args);
    } catch { return false; }
}

function current(directory: string, identity: AgentRowIdentity) {
    if (!validIdentity(identity)) return null;
    const before = routeSnapshot(directory), state = before.state;
    if (!state || state.installationId !== identity.installation_id || state.backendVersion !== identity.backend_version ||
        (state.mode !== 'standby' && state.mode !== 'mod')) return null;
    const binding = bindingRecord(directory, io);
    if (!binding || binding.backend_version !== VERSION || state.launchRevision !== revision(binding.launch)) return null;
    safeTarget(directory, join(directory, 'settings.json'));
    const [settings, settingsRaw] = readSettings(directory, io);
    if (!settingsRaw || settings.disableAllHooks === true || !boundOptions(settings, directory, identity, binding.launch as LaunchSpec)) return null;
    const callback = settings.subagentStatusLine;
    if (state.mode === 'standby') {
        if (!object(callback) || callback.type !== 'command' || !state.legacyLaunch ||
            revision(callback) !== state.legacyRevision || !ownedCommand(callback.command, 'render-subagents', state.legacyLaunch)) return null;
    } else if (callback != null) return null;
    return { before, state, settings, settingsRaw, mode: state.mode as 'standby' | 'mod' };
}

type Checked = NonNullable<ReturnType<typeof current>>;

function installedResourcesMatch(directory: string, checked: Checked): boolean {
    const marker = owner(directory, AGENT_ROWS, io);
    if (!marker || marker.suspended || marker.protocol_version !== AGENT_ROWS.protocol ||
        marker.backend_version !== VERSION || marker.mod_version !== VERSION) return false;
    if (!checked.state.resourceRevision) return true;
    const path = join(directory, AGENT_ROWS.name, 'plugins', AGENT_ROWS.name, 'resource-manifest.json');
    safeTarget(directory, path);
    const manifest = readBoundedRegularFile(path, 256 * 1024);
    return !!manifest && revision(privateJson(manifest)) === checked.state.resourceRevision;
}

function reviewRevision(directory: string, identity: AgentRowIdentity, checked: Checked): string {
    function configHash(name: string, maximum: number): string | null {
        const path = join(directory, name);
        safeTarget(directory, path);
        const raw = readBoundedRegularFile(path, maximum);
        return raw === null ? null : sha256(raw);
    }
    return revision([checked.state, identity.host_version, identity.cwd,
        configHash(CONFIG_FILENAME, CONFIG_LIMIT), configHash(PROFILES_FILENAME, MAX_PROFILES_BYTES)]);
}

/** Match install/recover lock order. A concurrent installation gets priority over
 * a host observation; the Mod can retry on its next eligible batch. */
function underInstallLock<T>(directory: string, action: () => T): T {
    const path = join(directory, 'statusline_runtime/admin.lock');
    safeTarget(directory, path);
    const release = lock(path, true);
    try {
        return io.lock(directory, () => { assertClear(directory); return action(); });
    } finally { release(); }
}

export function agentRowAccess(directory: string, identity: AgentRowIdentity): AgentRowMode {
    return current(directory, identity)?.mode ?? 'pass';
}

export function agentRowLoaded(directory: string, identity: AgentRowIdentity): AgentRowMode {
    const checked = current(directory, identity);
    if (!checked) return 'pass';
    if (findSession(readEvidence(directory, identity.installation_id), identity)) return checked.mode;
    return underInstallLock(directory, () => {
        const now = current(directory, identity);
        if (!now || !installedResourcesMatch(directory, now)) return 'pass';
        const evidence = readEvidence(directory, identity.installation_id);
        if (!findSession(evidence, identity)) {
            addSession(evidence, identity, Date.now());
            saveEvidence(directory, evidence);
        }
        return now.mode;
    });
}

/** Capture the reviewed input before rendering. Once this session is verified, a
 * regular frame only needs read-only route and evidence snapshots. */
export function beginAgentRowBatch(directory: string, identity: AgentRowIdentity): { mode: AgentRowMode; revision?: string } {
    const checked = current(directory, identity);
    if (!checked) return { mode: 'pass' };
    const session = findSession(readEvidence(directory, identity.installation_id), identity);
    if (!session) return { mode: 'pass' };
    return session.verifiedAt === null ?
        { mode: checked.mode, revision: reviewRevision(directory, identity, checked) } : { mode: checked.mode };
}

/** Only called after at least one applicable row (including an intentional hide)
 * was rendered successfully from the reviewed batch. No row content is stored. */
export function confirmAgentRowBatch(directory: string, identity: AgentRowIdentity, expected: string): string | undefined {
    if (!current(directory, identity)) return;
    return underInstallLock(directory, () => {
        const checked = current(directory, identity);
        if (!checked || reviewRevision(directory, identity, checked) !== expected) return;
        const evidence = readEvidence(directory, identity.installation_id);
        const row = findSession(evidence, identity);
        if (!row || row.verifiedAt !== null) return;
        const now = Date.now();
        if (row.confirmation && row.confirmation.revision === expected && row.confirmation.expiresAt > now) return row.confirmation.token;
        row.confirmation = { token: randomUUID(), expiresAt: now + CONFIRMATION_LIFETIME_MS, revision: expected };
        saveEvidence(directory, evidence);
        return row.confirmation.token;
    });
}

/** Called outside the render event. This consumes one successful session batch
 * and completes only the previously authorized installation's owned handoff. */
export function agentRowReady(directory: string, identity: AgentRowIdentity, confirmation: unknown): AgentRowMode {
    if (!isGeneration(confirmation) || !current(directory, identity)) return 'pass';
    return underInstallLock(directory, () => {
        const checked = current(directory, identity);
        if (!checked) return 'pass';
        const evidence = readEvidence(directory, identity.installation_id);
        const row = findSession(evidence, identity);
        if (!row) return 'pass';
        if (row.verifiedAt !== null) return checked.mode;
        const now = Date.now(), ticket = row.confirmation;
        if (!ticket || ticket.token !== confirmation || ticket.expiresAt <= now ||
            ticket.revision !== reviewRevision(directory, identity, checked) || !installedResourcesMatch(directory, checked))
            return checked.mode === 'standby' ? 'standby' : 'pass';
        if (checked.mode === 'standby') {
            const state = { ...checked.state, mode: 'mod' as const, reason: 'mod-selected' as const,
                legacyRevision: null, legacyLaunch: null };
            const change = routeChange(directory, checked.before, state)!;
            const updated = { ...checked.settings };
            delete updated.subagentStatusLine;
            commit(directory, 'agent-row-handoff', [
                { name: 'settings.json', path: join(directory, 'settings.json'), raw: checked.settingsRaw, desired: jsonBytes(updated) },
                change,
            ], io);
        }
        row.confirmation = null;
        row.verifiedAt = now;
        saveEvidence(directory, evidence);
        return 'mod';
    });
}
