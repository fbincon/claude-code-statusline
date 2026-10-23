import { randomUUID } from 'node:crypto';
import type { Language } from '@fbincon/statusline-core/i18n/messages';
import { t } from '@fbincon/statusline-core/i18n/messages';
import { object, ConfigError } from '@fbincon/statusline-core/config/validation';
import { sourceError, SOURCE_TYPES } from '@fbincon/statusline-core/extensions/model';
import { readJson } from '@fbincon/statusline-core/json-read';
import { readSourceFile } from '@fbincon/statusline-platform/source-files';
import { decodeUtf8 } from '@fbincon/statusline-platform/utf8';
import { resolve, join } from 'node:path';
import { expandUser } from '@fbincon/statusline-platform/commands';
import type { ConfigurationService } from '../config/service.js';
import { ProfileService } from '../config/profiles.js';
import { findProfile } from '@fbincon/statusline-core/config/profiles';
import { SourceService } from './service.js';
import { contextFor } from './context.js';
export async function sourceCommand(args: readonly string[], configuration: ConfigurationService, language: Language): Promise<string> {
    const service = new SourceService(configuration), [action, ...rest] = args;
    if (action === '_worker' && rest.length === 1) {
        await service.work(rest[0]!);
        return '';
    }
    const p: string[] = [], flags: Record<string, string | boolean> = {};
    const values = ['--file', '--review', '--project', '--session', '--agent', '--instance', '--scope', '--profile', '--binding', '--interval'];
    let literal = false;
    for (let i = 0; i < rest.length; i++) {
        const token = rest[i]!;
        if (!literal && token === '--') {
            literal = true;
            continue;
        }
        if (!literal && token.startsWith('--')) {
            if (Object.hasOwn(flags, token))
                sourceError('invalid');
            if (values.includes(token)) {
                const value = rest[++i];
                if (value === undefined || value.startsWith('--'))
                    sourceError('invalid');
                flags[token] = value;
            }
            else if (['--json', '--no-wait', '--user'].includes(token))
                flags[token] = true;
            else
                sourceError('invalid');
        }
        else
            p.push(token);
    }
    if (!['list', 'add', 'edit', 'review', 'enable', 'disable', 'remove', 'bind', 'unbind', 'refresh', 'status', 'cancel', 'diagnose', 'auto-on', 'auto-off'].includes(action ?? '') || p.length !== (action === 'list' ? 0 : 1))
        sourceError('invalid');
    const id = p[0], pretty = (value: unknown) => JSON.stringify(value, null, 2), current = service.read();
    if (action === 'list')
        return flags['--json'] ? pretty(current) : current.sources.map(source => `${source.id}  ${source.name}  ${source.kind}  ${t('sources.' + (source.enabled ? 'enabled' : 'disabled'), language)}`).join('\n') || t('sources.empty', language);
    if (action === 'review')
        return pretty(service.review(id));
    if (action === 'status')
        return pretty(service.job(id));
    if (action === 'cancel')
        return pretty(service.cancel(id));
    if (action === 'refresh' || action === 'diagnose') {
        const source = service.source(id), context = contextFor(typeof flags['--project'] === 'string' ? flags['--project'] : source.scope.project ?? process.cwd(), typeof flags['--session'] === 'string' ? flags['--session'] : null, typeof flags['--agent'] === 'string' ? flags['--agent'] : null);
        if (action === 'diagnose')
            return pretty(service.diagnose(id, context));
        let job = service.start(id, context, randomUUID());
        if (flags['--no-wait'])
            return pretty(job);
        const cancel = () => { try {
            job = service.cancel(job.id);
        }
        catch { /* Read the durable result below. */ } };
        process.once('SIGINT', cancel);
        process.once('SIGTERM', cancel);
        try {
            while (job.state === 'running') {
                await new Promise(r => setTimeout(r, 100));
                job = service.job(job.id);
            }
        }
        finally {
            process.removeListener('SIGINT', cancel);
            process.removeListener('SIGTERM', cancel);
        }
        return pretty(job);
    }
    const payload: Record<string, unknown> = { action, id, expected_revision: current.revision };
    if (action === 'add' || action === 'edit') {
        if (typeof flags['--file'] !== 'string')
            sourceError('invalid');
        const bytes = readSourceFile(resolve(expandUser(flags['--file'])));
        if (!bytes)
            sourceError('missing_file');
        const source = readJson(decodeUtf8(bytes), { duplicate: () => sourceError('invalid'), constant: () => sourceError('type') });
        if (!object(source))
            sourceError('invalid');
        payload.source = { name: id, ttl_seconds: 300, scope: { project: null, session: null, agent: null }, ...source };
    }
    if (action === 'enable' || action === 'auto-on')
        payload.review_revision = flags['--review'];
    if (action === 'auto-on' && flags['--interval'] !== undefined) payload.interval_seconds = Number(flags['--interval']);
    if (action === 'unbind')
        payload.binding = flags['--binding'];
    if (action === 'bind') {
        if (typeof flags['--instance'] !== 'string')
            sourceError('invalid');
        const profiles = new ProfileService(configuration), target = typeof flags['--profile'] === 'string' ? { kind: 'profile', id: findProfile(profiles.read(), flags['--profile']).id } : typeof flags['--project'] === 'string' ? { kind: 'project', path: resolve(expandUser(flags['--project'])) } : { kind: 'user' };
        const display = profiles.readTarget(target), scope = flags['--scope'] ?? 'main';
        if (scope !== 'main' && scope !== 'subagent')
            sourceError('invalid');
        const node = (scope === 'main' ? display.display.instances : display.display.subagents.instances).find(node => node.id === flags['--instance']);
        if (!node || !SOURCE_TYPES.includes(node.type_id) || node.type_id.startsWith('github-') && service.source(id).kind !== 'github')
            sourceError('binding');
        const result = service.mutate(payload);
        node.source = result.binding;
        profiles.applyTarget({ display: display.display, host: display.host }, display.revision, target);
        return pretty(result);
    }
    return pretty(service.mutate(payload));
}
