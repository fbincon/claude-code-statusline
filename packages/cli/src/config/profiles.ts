import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { ConfigTarget, DisplayDraft, ProfileCollection, ProfilesResult } from '@fbincon/statusline-core/contracts/ui';
import { CONFIG_FILENAME, validateDisplay } from '@fbincon/statusline-core/config/display';
import { validateDraft } from '@fbincon/statusline-core/config/draft';
import { configTarget, findProfile, profileName, profileError, PROFILES_FILENAME, MAX_PROFILES_BYTES, validateProfiles, importProfile, PROFILE_FORMAT, PROFILE_VERSION } from '@fbincon/statusline-core/config/profiles';
import { object, ConfigError, clone } from '@fbincon/statusline-core/config/validation';
import { readJson } from '@fbincon/statusline-core/json-read';
import { equalSettings } from '@fbincon/statusline-core/json-equality';
import { revision } from '@fbincon/statusline-platform/hash';
import { projectPaths, explicitProjectPath } from '@fbincon/statusline-platform/project-paths';
import { commandFor } from '@fbincon/statusline-platform/commands';
import { readDiagnosticFile } from '@fbincon/statusline-platform/diagnostic-files';
import { type ConfigurationService, atLeast } from './service.js';
import { readProfiles, resolveProfile } from '../rendering/configuration.js';
import { artifact, decodeUtf8, jsonBytes, readDisplay, readSettings } from './storage.js';
import { installationIdentity, settingsWithHost } from './host.js';
import { commit } from '../recovery/files.js';
import { assertClear } from '../recovery/journal.js';
import { exportBytes } from './transfer.js';

/** This changes only our display callback, never collection or Claude preferences. */
export function profileRowsSettings(service: ConfigurationService, settings: Record<string, unknown>, display: DisplayDraft, collection: ProfileCollection): Record<string, unknown> {
    const identity = installationIdentity(settings, service.context.launch);
    if (identity.statusLine!.state !== 'owned') return settings;
    const needed = display.subagents.enabled || collection.bindings.some(b => collection.profiles.some(p => p.id === b.profile_id && p.display.subagents.enabled));
    if (!atLeast(service.context.hostVersion(), [2, 1, 205])) return settings;
    if (identity.subagentStatusLine!.state === 'foreign') {
        if (needed) throw new ConfigError('errors.service.claude_code_subagentstatusline_belongs_to_another_renderer', {}, 'ownership_mismatch');
        return settings;
    }
    const updated = { ...settings };
    if (needed) updated.subagentStatusLine = { type: 'command', command: commandFor(service.context.launch, 'render-subagents') };
    else delete updated.subagentStatusLine;
    return updated;
}
export class ProfileService {
    constructor(readonly service: ConfigurationService, readonly nextId: () => string = () => randomUUID().replaceAll('-', '')) {}
    private load() {
        const { configDir } = this.service.context, io = this.service.io;
        const [display, displayRaw] = readDisplay(configDir, io), [settings, settingsRaw] = readSettings(configDir, io);
        const [collection, collectionRaw] = readProfiles(configDir, io);
        const base = this.service.snapshot(display, settings);
        return { display, displayRaw, settings, settingsRaw, collection, collectionRaw, base,
            revision: revision({ profiles_version: 1, collection, configuration: base.revision }) };
    }
    read(): ProfilesResult {
        const loaded = this.load();
        return { ...loaded.collection, revision: loaded.revision };
    }
    readTarget(value?: unknown) {
        const parsed = configTarget(value), target = parsed.kind === 'project' ? { ...parsed, path: explicitProjectPath(parsed.path) } : parsed, loaded = this.load();
        const selected = resolveProfile(loaded.display, loaded.collection, target);
        if (target.kind === 'profile' && !selected.configuration.profile_id) profileError('missing', target.id);
        return { ...this.service.snapshot(selected.display, loaded.settings), configuration: selected.configuration,
            revision: revision({ revision: loaded.revision, target, configuration: selected.configuration }) };
    }
    private publish(action: string, loaded: ReturnType<ProfileService['load']>, display: DisplayDraft, collection: ProfileCollection, requestedSettings = loaded.settings, materializeDefault = false): string | null {
        const { configDir } = this.service.context, io = this.service.io;
        collection = validateProfiles(collection);
        const library = jsonBytes(collection);
        if (library.length > MAX_PROFILES_BYTES) profileError('size');
        const bound = new Set([...loaded.collection.bindings, ...collection.bindings].map(b=>b.profile_id));
        const affectsDisplay = materializeDefault || !equalSettings(display, loaded.display) ||
            !equalSettings(collection.bindings, loaded.collection.bindings) ||
            [...bound].some(id=>!equalSettings(collection.profiles.find(p=>p.id===id)?.display ?? null, loaded.collection.profiles.find(p=>p.id===id)?.display ?? null));
        const settings = affectsDisplay ? profileRowsSettings(this.service, requestedSettings, display, collection) : requestedSettings;
        const changes = [
            ...(!equalSettings(display, loaded.display) || materializeDefault && !loaded.displayRaw?.equals(jsonBytes(display)) ? [{ ...artifact(join(configDir, CONFIG_FILENAME), loaded.displayRaw), desired: jsonBytes(display) }] : []),
            ...(!equalSettings(collection, loaded.collection) ? [{ ...artifact(join(configDir, PROFILES_FILENAME), loaded.collectionRaw), desired: library }] : []),
            ...(!equalSettings(settings, loaded.settings) ? [{ ...artifact(join(configDir, 'settings.json'), loaded.settingsRaw), desired: jsonBytes(settings) }] : []),
        ];
        return commit(configDir, action, changes, io);
    }
    applyTarget(value: unknown, expected: string, targetValue: unknown) {
        const target = configTarget(targetValue), candidate = validateDraft(value, true);
        return this.service.io.lock(this.service.context.configDir, () => {
            assertClear(this.service.context.configDir);
            const current = this.readTarget(target);
            if (current.revision !== expected) profileError('conflict');
            const loaded = this.load();
            if (loaded.base.installation.subagentStatusLine!.state === 'foreign')
                throw new ConfigError('errors.service.claude_code_subagentstatusline_belongs_to_another_renderer', {}, 'ownership_mismatch');
            let display = loaded.display;
            const collection = clone(loaded.collection);
            if (current.configuration.profile_id) {
                findProfile(collection, current.configuration.profile_id).display = candidate.display;
            } else display = candidate.display;
            const settings = settingsWithHost(loaded.settings, this.service.context.launch, candidate.host);
            const backup = this.publish('profile-display', loaded, display, collection, settings, current.configuration.profile_id === null);
            return { changed: backup !== null, effective: this.readTarget(target), backup_dir: backup };
        });
    }
    mutate(payload: unknown): ProfilesResult {
        if (!object(payload) || typeof payload.action !== 'string' || typeof payload.expected_revision !== 'string' ||
            !Object.keys(payload).every(k => ['action','expected_revision','name','id','display','overwrite','path','profile_id','bind_path'].includes(k))) return profileError('invalid');
        return this.service.io.lock(this.service.context.configDir, () => {
            assertClear(this.service.context.configDir);
            const loaded = this.load();
            if (loaded.revision !== payload.expected_revision) profileError('conflict');
            const collection = clone(loaded.collection);
            let display = loaded.display;
            const selected = () => findProfile(collection, typeof payload.id === 'string' ? payload.id : '');
            const bind = (raw: unknown, id: string, replace: boolean) => {
                if (typeof raw !== 'string' || !raw.trim()) profileError('path');
                const root = projectPaths.canonical(explicitProjectPath(raw as string));
                if (!root) return profileError('path');
                const existing = collection.bindings.find(b => b.root === root || projectPaths.canonical(b.root) === root);
                if (existing && existing.profile_id !== id && !replace) profileError('bound', root);
                if (existing) existing.profile_id = id;
                else collection.bindings.push({ root, profile_id: id });
            };
            switch (payload.action) {
                case 'save': {
                    const name = profileName(payload.name), candidate = validateDisplay(payload.display);
                    const existing = collection.profiles.find(p => p.name === name);
                    if (existing && payload.overwrite !== true) profileError('duplicate', name);
                    const profile = existing ?? { id: this.nextId(), name, display: candidate };
                    profile.display = candidate;
                    if (!existing) collection.profiles.push(profile);
                    if (payload.bind_path !== undefined) bind(payload.bind_path, profile.id, payload.overwrite === true);
                    break;
                }
                case 'rename': {
                    const profile = selected(), name = profileName(payload.name);
                    if (collection.profiles.some(p => p.id !== profile.id && p.name === name)) profileError('duplicate', name);
                    profile.name = name; break;
                }
                case 'delete': {
                    const profile = selected();
                    if (collection.bindings.some(b => b.profile_id === profile.id)) profileError('referenced', profile.name);
                    collection.profiles = collection.profiles.filter(p => p.id !== profile.id); break;
                }
                case 'activate': display = clone(selected().display); break;
                case 'bind': bind(payload.path, selected().id, payload.overwrite === true); break;
                case 'unbind': {
                    if (typeof payload.path !== 'string' || !payload.path) profileError('path');
                    const path = explicitProjectPath(payload.path as string), canonical = projectPaths.canonical(path);
                    collection.bindings = collection.bindings.filter(b => b.root !== path && (!canonical || projectPaths.canonical(b.root) !== canonical));
                    break;
                }
                default: return profileError('invalid');
            }
            const backup = this.publish('profile-' + payload.action, loaded, display, collection, loaded.settings, payload.action === 'activate');
            return { ...this.read(), changed: backup !== null, backup_dir: backup };
        });
    }
    import(path: string) {
        const raw = readDiagnosticFile(explicitProjectPath(path), true);
        if (raw === null) return profileError('file', path);
        if (raw.length > 1_048_576) return profileError('size');
        try {
            return importProfile(readJson(decodeUtf8(raw), { allowBom: true, duplicate() { return profileError('invalid'); } }));
        } catch (error) {
            if (error instanceof ConfigError) throw error;
            return profileError('format');
        }
    }
    export(path: string, name: string, display: unknown, overwrite = false) {
        return { path: exportBytes(path, jsonBytes({ format: PROFILE_FORMAT, version: PROFILE_VERSION, name: profileName(name), display: validateDisplay(display) }), this.service.context.configDir, overwrite) };
    }
}
