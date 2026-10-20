import { join } from 'node:path';
import type { ConfigTarget, DisplayDraft, ProfileCollection, ResolvedConfiguration } from '@fbincon/statusline-core/contracts/ui';
import { emptyProfiles, PROFILES_FILENAME, MAX_PROFILES_BYTES, validateProfiles, profileError } from '@fbincon/statusline-core/config/profiles';
import { readJson } from '@fbincon/statusline-core/json-read';
import { projectPaths, type ProjectPaths } from '@fbincon/statusline-platform/project-paths';
import { decodeUtf8 } from '@fbincon/statusline-platform/utf8';
import type { Storage } from '../config/storage.js';

export function readProfiles(directory: string, io: Pick<Storage, 'read'>): [ProfileCollection, Buffer | null] {
    const raw = io.read(join(directory, PROFILES_FILENAME));
    if (raw === null) return [emptyProfiles(), null];
    if (raw.length > MAX_PROFILES_BYTES) return profileError('size');
    try {
        return [validateProfiles(readJson(decodeUtf8(raw), { duplicate() { return profileError('invalid'); } })), raw];
    } catch { return profileError('invalid'); }
}
export function resolveProfile(display: DisplayDraft, collection: ProfileCollection, target: ConfigTarget, paths: ProjectPaths = projectPaths):
    { display: DisplayDraft; configuration: ResolvedConfiguration } {
    const configuration: ResolvedConfiguration = { target, profile_id: null, profile_name: null, project_root: null, reason: 'user_default', shared_projects: [] };
    let id: string | null = null;
    if (target.kind === 'profile') id = target.id;
    if (target.kind === 'project') {
        if (!collection.bindings.length) return { display, configuration: { ...configuration, reason: 'unbound' } };
        const current = paths.canonical(target.path);
        if (!current) return { display, configuration: { ...configuration, reason: 'path_unavailable' } };
        const candidates = collection.bindings.flatMap(binding => {
            const root = paths.canonical(binding.root);
            return root && paths.contains(root, current) ? [{ ...binding, depth: paths.depth(root) }] : [];
        }).sort((a, b) => b.depth - a.depth || a.root.localeCompare(b.root));
        if (!candidates.length) return { display, configuration: { ...configuration, reason: 'unbound' } };
        const match = candidates[0]!;
        if (candidates[1]?.depth === match.depth && candidates[1].profile_id !== match.profile_id)
            return { display, configuration: { ...configuration, reason: 'ambiguous_binding' } };
        id = match.profile_id; configuration.project_root = match.root;
    }
    if (!id) return { display, configuration };
    const profile = collection.profiles.find(p => p.id === id);
    if (!profile) return { display, configuration: { ...configuration, reason: 'missing_profile' } };
    return { display: profile.display, configuration: { ...configuration, profile_id: id, profile_name: profile.name, reason: 'profile',
        shared_projects: collection.bindings.filter(b => b.profile_id === id).map(b => b.root) } };
}
export function resolvedDisplay(directory: string, io: Pick<Storage, 'read'>, display: DisplayDraft, target: ConfigTarget) {
    try {
        const [collection] = readProfiles(directory, io);
        return resolveProfile(display, collection, target);
    } catch {
        return { display, configuration: { target, profile_id: null, profile_name: null, project_root: null, reason: 'invalid_collection', shared_projects: [] } satisfies ResolvedConfiguration };
    }
}
