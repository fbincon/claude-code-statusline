import { isScenario } from '@fbincon/statusline-core/editor/preview-settings';
import { selectiveImport } from './selective-import.js';
import type { ConfigTarget } from '@fbincon/statusline-core/contracts/ui';
import type { Language } from '@fbincon/statusline-core/i18n/messages';
import { findProfile, profileError } from '@fbincon/statusline-core/config/profiles';
import { t } from '@fbincon/statusline-core/i18n/messages';
import { pythonJson } from '@fbincon/statusline-core/json-text';
import { explicitProjectPath } from '@fbincon/statusline-platform/project-paths';
import type { ConfigurationService } from './service.js';
import { ProfileService } from './profiles.js';
import { ArgumentError } from './arguments.js';
import { readDisplay } from './storage.js';
import { previewAdapter } from '../rendering/preview.js';

export function profileArguments(args: readonly string[]) {
    const [group, action, ...rest] = args, positional: string[] = [], flags: Record<string, string | boolean> = {};
    const commands = group === 'profile' ? ['list','save','rename','delete','preview','activate','import','export'] : group === 'project' ? ['list','bind','unbind','resolve'] : [];
    if (!commands.includes(action ?? '')) throw new ArgumentError('Unknown profile/project command');
    const allowed = new Set(['--json', ...(['save','import','export','bind'].includes(action!) ? ['--overwrite'] : []),
        ...(action === 'import' ? ['--name','--dry-run','--select','--user','--profile','--project'] : []), ...(action === 'save' ? ['--bind'] : []), ...(action === 'preview' ? ['--width','--scenario'] : [])]);
    let literal = false;
    for (let i = 0; i < rest.length; i++) {
        const token = rest[i]!;
        if (!literal && token === '--') { literal = true; continue; }
        if (!literal && token.startsWith('-')) {
            if (!allowed.has(token) || flags[token] !== undefined) throw new ArgumentError('Unknown or repeated option: ' + token);
            if (['--scenario','--name','--bind','--width','--select','--profile','--project'].includes(token)) {
                const value = rest[++i];
                if (!value || value.startsWith('--')) throw new ArgumentError(token + ' requires a value');
                flags[token] = value;
            } else flags[token] = true;
        } else positional.push(token);
    }
    const count = action === 'list' ? 0 : ['rename','export','bind'].includes(action!) ? 2 : 1;
    if (positional.length !== count && !(action === 'resolve' && positional.length === 0)) throw new ArgumentError('Wrong number of profile/project arguments');
    return { group, action: action!, positional, flags };
}
export function editorTarget(args: readonly string[], profiles: ProfileService, cwd: string): ConfigTarget {
    if (!args.length) return { kind: 'project', path: cwd };
    if (args.length === 1 && args[0] === '--user') return { kind: 'user' };
    if (args.length === 2 && args[0] === '--project') return { kind: 'project', path: explicitProjectPath(args[1]!) };
    if (args.length === 2 && args[0] === '--profile') return { kind: 'profile', id: findProfile(profiles.read(), args[1]!).id };
    throw new ArgumentError('configure accepts --user, --project PATH, or --profile NAME');
}
export async function profileCommand(args: readonly string[], service: ConfigurationService, language: Language): Promise<string> {
    const { group, action, positional: p, flags } = profileArguments(args), profiles = new ProfileService(service);
    if (action === 'import' && flags['--select'] !== undefined) return selectiveImport(service, p[0]!, Object.fromEntries(Object.entries(flags).map(([key, value]) => [key.slice(2), value])), true);
    if (action === 'import' && ['--user','--profile','--project'].some(key => flags[key] !== undefined)) throw new ArgumentError('Target options require --select');
    const library = profiles.read(), pretty = (value: unknown) => pythonJson(value, { ensureAscii: false, indent: 2 });
    if (group === 'project' && action === 'resolve') {
        const current = profiles.readTarget({ kind: 'project', path: explicitProjectPath(p[0] ?? process.cwd()) });
        return flags['--json'] ? pretty(current.configuration) : t('profiles.resolution', language, { name: current.configuration.profile_name ?? t('profiles.user', language),
            root: current.configuration.project_root ?? '—', reason: t('profiles.reason.' + current.configuration.reason, language) });
    }
    if (action === 'list') {
        if (flags['--json']) return pretty(group === 'profile' ? library : { bindings: library.bindings, revision: library.revision });
        const rows = group === 'profile' ? library.profiles.map(p => `${p.id}  ${p.name}`) : library.bindings.map(b => `${b.root} → ${library.profiles.find(p => p.id === b.profile_id)?.name ?? b.profile_id}`);
        return rows.join('\n') || t('profiles.empty', language);
    }
    if (action === 'preview') {
        const profile = findProfile(library, p[0]!), width = flags['--width'] ?? '120';
        if (typeof width !== 'string' || !/^\d+$/u.test(width) || Number(width) < 2 || Number(width) > 10000) profileError('width');
        const scenario=flags['--scenario']??'normal';if(!isScenario(scenario))throw new ArgumentError(t('preview.invalid_scenario',language));
        const result = (await previewAdapter())({ display: profile.display, host: { padding: 0, refresh_interval: 'event', hide_vim_mode_indicator: false } }, Number(width),undefined,scenario);
        return flags['--json'] ? pretty(result) : t('profiles.sample', language)+' · '+t('preview.scenario.'+scenario,language)+' · '+width+'c' + '\n' + [...result.main, ...result.subagents].map(row => row.map(span => span.text).join('')).join('\n');
    }
    if (action === 'export') {
        const profile = findProfile(library, p[0]!);
        const result = profiles.export(p[1]!, profile.name, profile.display, flags['--overwrite'] === true);
        return flags['--json'] ? pretty(result) : result.path;
    }
    const payload: Record<string, unknown> = { action, expected_revision: library.revision, overwrite: flags['--overwrite'] === true };
    if (action === 'save') Object.assign(payload, { name: p[0], display: readDisplay(service.context.configDir, service.io)[0], ...(flags['--bind'] ? { bind_path: flags['--bind'] } : {}) });
    else if (action === 'import') {
        const candidate = profiles.import(p[0]!);
        if (flags['--dry-run']) return pretty(candidate);
        Object.assign(payload, { action: 'save', name: flags['--name'] ?? candidate.name, display: candidate.display });
    } else if (action === 'unbind') payload.path = explicitProjectPath(p[0]!);
    else {
        payload.id = findProfile(library, p[action === 'bind' ? 1 : 0]!).id;
        if (action === 'bind') payload.path = explicitProjectPath(p[0]!);
        if (action === 'rename') payload.name = p[1];
    }
    const result = profiles.mutate(payload);
    return flags['--json'] ? pretty(result) : t(result.changed ? 'profiles.saved' : 'profiles.unchanged', language);
}
