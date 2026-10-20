import type { ConfigTarget, DisplayProfile, ProfileCollection } from '../contracts/ui.js';
import { validateDisplay, isSchema } from './display.js';
import { ConfigError, object } from './validation.js';

export const PROFILES_FILENAME = 'claude-statusline-profiles.json';
export const PROFILE_FORMAT = 'claude-code-statusline-profile';
export const PROFILE_VERSION = 1;
export const MAX_PROFILES_BYTES = 32 * 1024 * 1024;
export const emptyProfiles = (): ProfileCollection => ({ version: 1, profiles: [], bindings: [] });
export function profileError(reason: string, value = ''): never {
    throw new ConfigError('profiles.error.' + reason, { value }, 'profile_' + reason);
}
export function profileName(value: unknown): string {
    if (typeof value !== 'string' || !value.trim() || [...value].length > 128 || /[\p{Cc}\p{Cs}\p{Zl}\p{Zp}]/u.test(value))
        profileError('name');
    return value.trim().normalize('NFC');
}
export function profileId(value: unknown): string {
    if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/u.test(value)) profileError('invalid');
    return value;
}
export function configTarget(value: unknown): ConfigTarget {
    if (value === undefined) return { kind: 'user' };
    if (!object(value)) return profileError('invalid');
    if (value.kind === 'user' && Object.keys(value).length === 1) return { kind: 'user' };
    if (value.kind === 'profile' && Object.keys(value).length === 2) return { kind: 'profile', id: profileId(value.id) };
    if (value.kind === 'project' && Object.keys(value).length === 2 && typeof value.path === 'string' && value.path && !/[\p{Cc}\p{Cs}]/u.test(value.path))
        return { kind: 'project', path: value.path };
    return profileError('invalid');
}
export function validateProfiles(value: unknown): ProfileCollection {
    if (!object(value) || Object.keys(value).sort().join(',') !== 'bindings,profiles,version' || !isSchema(value.version, 1) ||
        !Array.isArray(value.profiles) || !Array.isArray(value.bindings) || value.profiles.length > 128 || value.bindings.length > 512)
        return profileError('invalid');
    const ids = new Set<string>(), names = new Set<string>(), roots = new Set<string>();
    const profiles = value.profiles.map(raw => {
        if (!object(raw) || Object.keys(raw).sort().join(',') !== 'display,id,name') return profileError('invalid');
        const id = profileId(raw.id), name = profileName(raw.name);
        if (ids.has(id) || names.has(name)) return profileError('duplicate', name);
        ids.add(id); names.add(name);
        return { id, name, display: validateDisplay(raw.display) };
    });
    const bindings = value.bindings.map(raw => {
        if (!object(raw) || Object.keys(raw).sort().join(',') !== 'profile_id,root' ||
            typeof raw.root !== 'string' || !raw.root || /[\p{Cc}\p{Cs}]/u.test(raw.root) || roots.has(raw.root)) return profileError('invalid');
        roots.add(raw.root);
        // Retain a dangling reference so resolution can explain it without rewriting the file.
        return { root: raw.root, profile_id: profileId(raw.profile_id) };
    });
    return { version: 1, profiles, bindings };
}
export function findProfile(collection: ProfileCollection, nameOrId: string): DisplayProfile {
    const found = collection.profiles.find(p => p.id === nameOrId) ?? collection.profiles.find(p => p.name === nameOrId.trim().normalize('NFC'));
    return found ?? profileError('missing', nameOrId);
}
export function importProfile(value: unknown): { name: string; display: DisplayProfile['display'] } {
    if (!object(value) || Object.keys(value).sort().join(',') !== 'display,format,name,version' ||
        value.format !== PROFILE_FORMAT || !isSchema(value.version, PROFILE_VERSION)) return profileError('format');
    return { name: profileName(value.name), display: validateDisplay(value.display) };
}
