import type { ConfigTarget, Draft } from '@fbincon/statusline-core/contracts/ui';
import { importSelection, selectImport } from '@fbincon/statusline-core/editor/import-selection';
import { differences } from '@fbincon/statusline-core/config/import-review';
import { findProfile } from '@fbincon/statusline-core/config/profiles';
import { validateDraft } from '@fbincon/statusline-core/config/draft';
import { ConfigError } from '@fbincon/statusline-core/config/validation';
import { pythonJson } from '@fbincon/statusline-core/json-text';
import { explicitProjectPath } from '@fbincon/statusline-platform/project-paths';
import { ArgumentError } from './arguments.js';
import { ProfileService } from './profiles.js';
import { importFile } from './transfer.js';
import { draft, type ConfigurationService } from './service.js';

/** Both envelopes reuse the exact same target transaction; neither can import host preferences here. */
export function selectiveImport(service: ConfigurationService, path: string, flags: Record<string, unknown>, profile = false): string {
    if (typeof flags.select !== 'string' || !flags.select.trim()) throw new ArgumentError('--select requires at least one field');
    if (flags.name !== undefined || flags.overwrite !== undefined) throw new ArgumentError('Selective import edits an existing target; --name/--overwrite are not applicable');
    const targets = ['user', 'profile', 'project'].filter(key => flags[key] !== undefined);
    if (targets.length > 1) throw new ArgumentError('Select only one of --user, --profile or --project');
    const profiles = new ProfileService(service);
    const target: ConfigTarget = flags.profile !== undefined ? { kind: 'profile', id: findProfile(profiles.read(), String(flags.profile)).id }
        : flags.project !== undefined ? { kind: 'project', path: explicitProjectPath(String(flags.project)) } : { kind: 'user' };
    const current = profiles.readTarget(target), base = draft(current);
    let selection;
    try { selection = importSelection(flags.select.split(',').map(key => key.trim())); }
    catch { throw new ConfigError('review.selection.invalid'); }
    const incoming: Draft = profile ? { display: profiles.import(path).display, host: base.host } : importFile(path, base);
    const candidate = validateDraft(selectImport(base, incoming, selection), true);
    const review = { selection, configuration: current.configuration, draft: candidate, changes: differences(base, candidate) };
    if (flags['dry-run']) return pythonJson(review, { ensureAscii: false, indent: 2 });
    const result = profiles.applyTarget(candidate, current.revision, target);
    return pythonJson({ ...review, changed: result.changed, backup_dir: result.backup_dir }, { ensureAscii: false, indent: 2 });
}
