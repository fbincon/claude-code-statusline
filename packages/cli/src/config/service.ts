import { join } from 'node:path';
import type { DisplayDraft, Draft, HostDraft } from '@fbincon/statusline-core/contracts/ui';
import { CONFIG_FILENAME, defaultDisplay, validateDisplay } from '@fbincon/statusline-core/config/display';
import { DEFAULT_HOST, validateDraft } from '@fbincon/statusline-core/config/draft';
import { ConfigError } from '@fbincon/statusline-core/config/validation';
import { equalSettings } from '@fbincon/statusline-core/json-equality';
import { pythonJson } from '@fbincon/statusline-core/json-text';
import { revision } from '@fbincon/statusline-platform/hash';
import type { LaunchSpec } from '@fbincon/statusline-platform/launch';
import { hostFromSettings, installationIdentity, settingsWithHost } from './host.js';
import { artifact, createStorage, errorDetail, jsonBytes, readDisplay, readSettings, type Storage } from './storage.js';
import { commit } from '../recovery/files.js';
import { assertClear } from '../recovery/journal.js';
import { readProfiles } from '../rendering/configuration.js';
import { profileRowsSettings } from './profiles.js';
import { configuredAgentRows, hasAgentRowBinding } from './agent-rows.js';
import { agentRowCapabilities, inspectAgentRowRoute } from '../integration/agent-row-route.js';
import { latestAgentRowEvidence } from '../integration/agent-row-evidence.js';
export interface ConfigurationContext {
    configDir: string;
    launch: LaunchSpec;
    hostVersion: () => readonly number[] | null;
}
export interface EffectiveConfig {
    scope: 'user';
    config_path: string;
    installed: boolean;
    display: DisplayDraft;
    host: HostDraft;
    subagent_statusline: {
        enabled: boolean;
        installed: boolean;
        state: string;
    };
    revision: string;
    installation: Record<string, Record<string, unknown>>;
}
export interface MutationResult {
    changed: boolean;
    effective: EffectiveConfig;
    backup_dir: string | null;
}
export const UNCHANGED = Symbol('unchanged'), DELETE = Symbol('delete');
export type Mutation = (display: DisplayDraft, settings: Record<string, unknown>, host: HostDraft, installed: boolean) => readonly [
    DisplayDraft | typeof UNCHANGED | typeof DELETE,
    Record<string, unknown> | typeof UNCHANGED
];
export function atLeast(version: readonly number[] | null, required: readonly number[]): boolean {
    if (!version)
        return false;
    for (let i = 0; i < required.length; i++) {
        if ((version[i] ?? 0) !== required[i])
            return (version[i] ?? 0) > required[i]!;
    }
    return true;
}
export function publicConfig(effective: EffectiveConfig): Omit<EffectiveConfig, 'revision' | 'installation'> {
    const { revision: _revision, installation: _installation, ...result } = effective;
    return result;
}
export function draft(effective: EffectiveConfig): Draft { return { display: effective.display, host: effective.host }; }
export class ConfigurationService {
    constructor(public readonly context: ConfigurationContext, public readonly io: Storage = createStorage()) { }
    agentRowRoute(settings: Record<string, unknown>, requested: boolean, version = this.context.hostVersion()) {
        return inspectAgentRowRoute({ ...this.context, io: this.io, version }, settings, requested, {evidence: false});
    }
    assertRowOwnership(settings: Record<string, unknown>, identity = installationIdentity(settings, this.context.launch)): void {
        if (identity.subagentStatusLine!.state === 'foreign' && this.agentRowRoute(settings, true).legacy === 'write')
            throw new ConfigError('errors.service.claude_code_subagentstatusline_belongs_to_another_renderer', {}, 'ownership_mismatch');
    }
    snapshot(display: DisplayDraft, settings: Record<string, unknown>, requestedRows?: boolean): EffectiveConfig {
        const { configDir, launch } = this.context;
        const { host, installed } = hostFromSettings(settings, launch);
        const installation = installationIdentity(settings, launch);
        const version = this.context.hostVersion(), capabilities = agentRowCapabilities(version);
        const rows = requestedRows ?? (display.subagents.enabled || configuredAgentRows(display, readProfiles(configDir, this.io)[0]));
        const route = this.agentRowRoute(settings, rows, version);
        const legacy = String(installation.subagentStatusLine!.state);
        let state = capabilities.legacy ? legacy : capabilities.mod ? 'absent' : 'unsupported';
        if (route.installationId || route.preference !== 'auto') {
            // Revisions bind edits to the reviewed route. Session timestamps must never stale a draft.
            installation.agentRows = { preference: route.preference, generation: route.installationId && revision(route.installationId), mode: route.mode };
        }
        if (route.mode === 'mod') {
            // Session evidence is observational. Damaged evidence belongs in doctor and must not block a display save.
            try {
                const observed = latestAgentRowEvidence(configDir, route.installationId, version?.join('.') ?? '');
                state = observed.verifiedAt !== null ? 'mod-verified' : observed.loadedAt !== null ? 'mod-loaded' : 'mod-pending';
            } catch { state = 'mod-unverified'; }
        } else if (route.mode === 'standby') state = 'standby';
        else if (route.mode === 'preserve' && legacy === 'foreign') state = 'foreign';
        else if (route.mode === 'builtin' && ['restricted', 'mod-disabled', 'mod-failed', 'unavailable'].includes(route.reason)) state = route.reason;
        const bound = route.mode === 'mod' && hasAgentRowBinding(settings, route.installationId);
        const rowInstalled = bound || state === 'owned' || state === 'mod-verified' || state === 'mod-loaded' ||
            (state === 'standby' && legacy === 'owned');
        return {
            scope: 'user', config_path: join(configDir, CONFIG_FILENAME), installed, display, host,
            subagent_statusline: { enabled: display.subagents.enabled, installed: rowInstalled, state },
            revision: revision({ revision_version: 1, display, host, installation }), installation,
        };
    }
    read(): EffectiveConfig {
        return this.io.lock(this.context.configDir, () => {
            const [display] = readDisplay(this.context.configDir, this.io);
            const [settings] = readSettings(this.context.configDir, this.io);
            return this.snapshot(display, settings);
        });
    }
    /** Setup can save a display before integration; this never applies host preferences. */
    saveDisplay(value: unknown, expectedRevision: string, beforeCommit: () => void = () => {}): MutationResult {
        const parsed = validateDisplay(value), { configDir } = this.context;
        return this.io.lock(configDir, () => {
            assertClear(configDir);
            const [display, raw] = readDisplay(configDir, this.io), [settings] = readSettings(configDir, this.io);
            if (this.snapshot(display, settings).revision !== expectedRevision)
                throw new ConfigError('errors.service.status_line_configuration_changed_while_the_editor', {}, 'configuration_conflict');
            beforeCommit();
            const desired = jsonBytes(parsed), path = join(configDir, CONFIG_FILENAME);
            const backup = raw?.equals(desired) ? null : commit(configDir, 'setup-display', [{ ...artifact(path, raw), desired }], this.io);
            return { changed: backup !== null, effective: this.snapshot(parsed, settings), backup_dir: backup };
        });
    }
    mutate(action: string, mutation: Mutation, tolerateInvalidDisplay = false): MutationResult {
        const { configDir, launch } = this.context;
        return this.io.lock(configDir, () => {
            assertClear(configDir);
            const [display, displayRaw] = readDisplay(configDir, this.io, tolerateInvalidDisplay);
            const [settings, settingsRaw] = readSettings(configDir, this.io);
            const { host, installed } = hostFromSettings(settings, launch);
            const [newDisplay, proposedSettings] = mutation(display, settings, host, installed);
            const [collection, collectionRaw] = readProfiles(configDir, this.io);
            const newSettings = collectionRaw === null ? proposedSettings : profileRowsSettings(this,
                proposedSettings === UNCHANGED ? settings : proposedSettings,
                newDisplay === DELETE ? defaultDisplay() : newDisplay === UNCHANGED ? display : newDisplay, collection);
            const displayBytes = newDisplay === DELETE ? null : newDisplay === UNCHANGED ? displayRaw : jsonBytes(validateDisplay(newDisplay));
            const displayChanged = newDisplay !== UNCHANGED && (displayBytes === null ? displayRaw !== null : !displayRaw?.equals(displayBytes));
            // Settings use semantic comparison, retaining unrelated values and their original bytes on a no-op.
            const settingsChanged = newSettings !== UNCHANGED && !equalSettings(newSettings, settings);
            if (!displayChanged && !settingsChanged)
                return { changed: false, effective: this.snapshot(display, settings), backup_dir: null };
            const displayPath = join(configDir, CONFIG_FILENAME), settingsPath = join(configDir, 'settings.json');
            const artifacts = [...(displayChanged ? [artifact(displayPath, displayRaw)] : []), ...(settingsChanged ? [artifact(settingsPath, settingsRaw)] : [])];
            let backup: string | null;
            try {
                backup = commit(configDir, action, artifacts.map(item => ({ ...item, desired: item.path === settingsPath ? Buffer.from(pythonJson(newSettings, { ensureAscii: false, indent: 2, allowNan: true }) + '\n') : displayBytes })), this.io);
            }
            catch (exc) {
                throw new ConfigError('errors.service.configuration_update_failed', { exc: errorDetail(exc), suffix: '' }, 'io_error');
            }
            return {
                changed: true,
                effective: this.snapshot(newDisplay === DELETE ? defaultDisplay() : newDisplay === UNCHANGED ? display : newDisplay, newSettings === UNCHANGED ? settings : newSettings),
                backup_dir: backup,
            };
        });
    }
    apply(value: unknown, expectedRevision?: string, beforeCommit?: () => void): MutationResult {
        const parsed = validateDraft(value, true);
        return this.mutate('config-apply', (display, settings) => {
            beforeCommit?.();
            const current = this.snapshot(display, settings);
            if (expectedRevision !== undefined && current.revision !== expectedRevision)
                throw new ConfigError('errors.service.status_line_configuration_changed_while_the_editor', {}, 'configuration_conflict');
            this.assertRowOwnership(settings, current.installation);
            return [parsed.display, settingsWithHost(settings, this.context.launch, parsed.host)];
        });
    }
    reset(): MutationResult {
        return this.mutate('config-reset', (_display, settings, _host, installed) => [DELETE, installed ? settingsWithHost(settings, this.context.launch, DEFAULT_HOST) : UNCHANGED], true);
    }
}
