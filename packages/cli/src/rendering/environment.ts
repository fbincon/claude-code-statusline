import { supportsLinks } from '@fbincon/statusline-core/terminal/links';
import { matchesScope, observationContext } from '@fbincon/statusline-core/extensions/model';
import { homedir, release } from 'node:os';
import type { DisplayDraft } from '@fbincon/statusline-core/contracts/ui';
import type { RenderEnvironment } from '@fbincon/statusline-core/rendering/context';
import { Presentation } from '@fbincon/statusline-core/rendering/language';
import { resolveLanguage } from '@fbincon/statusline-core/i18n/registry';
import { liveDirectory } from '@fbincon/statusline-core/rendering/items';
import { sessionTokenCounts } from '@fbincon/statusline-core/runtime/usage';
import { truth, string, object } from '@fbincon/statusline-core/runtime/values';
import { unavailable } from '@fbincon/statusline-core/runtime/live/snapshot';
import { directory, pathName, formatDate, hostName } from '@fbincon/statusline-platform/presentation';
import type { RuntimeContext } from '../runtime/context.js';
export interface EnvironmentOptions {
    configDir?: string;
    home?: string;
    runtime?: RuntimeContext;
    now?: () => number;
    observations?: Partial<RenderEnvironment>;
}
export async function presentation(language: string): Promise<Presentation> {
    // Generation rejects partial shipped packs; a known pack needs no English import.
    const selected = resolveLanguage(language) ?? 'en';
    const { MESSAGES } = await import('@fbincon/statusline-core/i18n/statusline/' + selected);
    return new Presentation(selected, MESSAGES);
}
export function baseEnvironment(language: Presentation, options: EnvironmentOptions = {}): RenderEnvironment {
    const absent = () => { throw new Error('Unselected rendering source was requested'); };
    return { language, links: supportsLinks(process.env), compactStaged: process.platform === 'win32' || process.platform === 'linux' && Boolean(process.env.WSL_INTEROP || process.env.WSL_DISTRO_NAME || release().toLowerCase().includes('microsoft')), now: options.now ?? (() => Date.now() / 1000),
        directory: (value, style, project) => directory(value, style, project, options.home ?? homedir()), basename: pathName, formatDate, hostname: hostName,
        git: absent, branchDiff: absent, usage: () => null, task: absent, activePoint: () => ({ value: null }), hadSubagents: () => false,
        live: () => unavailable('not_observed'), agentEndings: () => ({}), ...options.observations };
}
/** Import sources for enabled components only; each source is collected lazily by RenderState. */
export async function renderEnvironment(config: DisplayDraft, data: unknown, options: EnvironmentOptions = {}, subagents = false): Promise<RenderEnvironment> {
    const env = baseEnvironment(await presentation(config.statusline_language), options), selected = new Set(config.instances.filter(node => node.enabled).map(node => node.type_id));
    const has = (...types: string[]) => types.some(type => selected.has(type)), payload = object(data) ? data : {}, sid = truth(payload.session_id), overrides = options.observations ?? {};
    let context = options.runtime;
    const runtime = async () => context ??= (await import('../runtime/context.js')).runtimeContext(options.configDir);
    const sourceNodes = (subagents ? config.subagents.instances : config.instances).filter(node => node.enabled && ['external-value','github-pr','github-ci'].includes(node.type_id));
    if (sourceNodes.length && !overrides.source) {
        const [{ SourceService }, { contextFor }, { ConfigurationService }, { createStorage }] = await Promise.all([import('../sources/service.js'), import('../sources/context.js'), import('../config/service.js'), import('../config/storage.js')]);
        const sourceService = new SourceService(new ConfigurationService({ configDir: (await runtime()).configDir, launch: {executable:process.execPath,args:[]}, hostVersion:()=>null }, createStorage()));
        const views = new Map<string, import('@fbincon/statusline-core/contracts/ui').SourceView>();
        const contexts = new Map<string, ReturnType<typeof contextFor>>();
        let registry: ReturnType<typeof sourceService.read> | null;
        try { registry = sourceService.read(); } catch { registry = null; }
        env.source = (node, input, agent) => {
            const broken = (): import('@fbincon/statusline-core/contracts/ui').SourceView => ({source_id:null,name:node.source?.hint??'',state:'error',reason:'invalid',observed_at:null,freshness:'unknown',value:null,unit:null});
            if (!registry) return broken();
            const binding = registry.bindings.find(binding => binding.id === node.source?.binding), source = registry.sources.find(source => source.id === binding?.source_id);
            const cwd = liveDirectory(input) ?? liveDirectory(payload), session = typeof payload.session_id === 'string' ? payload.session_id : null;
            const contextKey = JSON.stringify([cwd, session]);
            let context = contexts.get(contextKey);
            if (!context) {
                context = !source?.enabled ? {project:null,session:null,agent:null,branch:null,head:null} : contextFor(cwd, session);
                if (source?.enabled) contexts.set(contextKey, context);
            }
            context = {...context, agent:agent ?? null};
            const key = (source?.id ?? node.source?.binding ?? '') + ':' + JSON.stringify(source && matchesScope(source.scope, context) ? observationContext(source, context) : context);
            let view = views.get(key);
            if (!view) {
                try { view = sourceService.view(node.source, context); } catch { view = broken(); }
                views.set(key, view);
            }
            if (node.type_id.startsWith('github-') && source && source.kind !== 'github') return {...broken(),state:'unsupported',reason:'binding'};
            return view;
        };
    }
    if (subagents) {
        if (typeof payload.session_id === 'string' && payload.session_id && !overrides.agentEndings && Array.isArray(payload.tasks) && payload.tasks.some(task => object(task) && ['completed', 'failed', 'killed', 'interrupted'].includes(task.status as string) && !Object.hasOwn(task, '_frozen_duration_ms'))) {
            const { AgentDurations } = await import('../runtime/live/durations.js'), source = new AgentDurations(await runtime());
            env.agentEndings = session => source.endedAt(session);
        }
        return env;
    }
    if (liveDirectory(data) && has('git', 'git-branch', 'git-changes', 'git-ahead-behind', 'branch-diff')) {
        if (has('git', 'git-branch', 'git-changes', 'git-ahead-behind') && !overrides.git || has('branch-diff') && !overrides.branchDiff) {
            const { GitCollector } = await import('../runtime/git.js'), source = new GitCollector(await runtime());
            if (!overrides.git)
                env.git = (cwd, session) => source.status(cwd, session);
            if (!overrides.branchDiff)
                env.branchDiff = (cwd, base) => cwd ? source.branchDiff(cwd, base) : { value: null, reason: 'not_observed' };
        }
    }
    else if (!overrides.branchDiff)
        env.branchDiff = () => ({ value: null, reason: 'not_observed' });
    if (sid && truth(payload.transcript_path) && has('tokens', 'input-tokens', 'output-tokens', 'task-timer', 'task-active-timer') && (!overrides.usage || has('task-timer') && !overrides.task)) {
        const { UsageCollector } = await import('../runtime/usage.js'), source = new UsageCollector(await runtime());
        if (!overrides.usage)
            env.usage = value => { const totals = source.collect(value); return totals ? { hit: totals[0], miss: totals[1], out: totals[2], last_prompt: totals[3], entry: totals[4], counts: sessionTokenCounts(totals[4]) } : null; };
        if (!overrides.task && has('task-timer')) {
            const { collectTask } = await import('../runtime/tasks/collect.js');
            env.task = (value, usage) => { const data = object(value) ? value : {}; return { state: collectTask(source.tasks, data.session_id, data.prompt_id, usage.last_prompt, usage.entry), sample: source.context.sample() }; };
        }
    }
    if (sid && config.scope_labels === 'when-subagents' && !overrides.hadSubagents) {
        const { TaskStore } = await import('../runtime/tasks/store.js'), store = new TaskStore(await runtime());
        env.hadSubagents = value => {
            if (!object(value) || !truth(value.session_id))
                return false;
            const record = (truth(value.prompt_id) ? store.state(string(value.session_id), string(value.prompt_id)) : null) ?? store.state(string(value.session_id));
            return truth(record?.had_subagents);
        };
    }
    if (sid && has('run-state', 'permission-mode', 'active-agents', 'task-progress', 'last-tool', 'ttft', 'output-rate', 'prompt-input-tokens', 'prompt-output-tokens', 'prompt-cost') && !overrides.live) {
        const [{ LiveStore }, { collectMetrics }] = await Promise.all([import('../runtime/live/store.js'), import('../runtime/live/collect.js')]);
        const store = new LiveStore(await runtime());
        env.live = (value, now) => { const data = object(value) ? value : {}; return collectMetrics(store, data.session_id, data.prompt_id, now); };
    }
    if (sid && has('task-active-timer') && !overrides.activePoint) {
        const [{ LiveStore }, { loadRuntime }, { activePoint }, { fresh }] = await Promise.all([import('../runtime/live/store.js'), import('../config/runtime-preferences.js'), import('@fbincon/statusline-core/runtime/tasks/view'), import('@fbincon/statusline-core/runtime/live/state')]);
        const store = new LiveStore(await runtime());
        env.activePoint = value => {
            const data = object(value) ? value : {};
            let enabled: boolean;
            try {
                enabled = loadRuntime(store.context.configDir).native_timing;
            }
            catch {
                return { value: null, reason: 'source_unavailable' };
            }
            const record = enabled ? store.tasks.state(data.session_id, data.prompt_id) : null;
            return activePoint(record, enabled, record?.status === 'running' ? fresh(store.load(string(data.session_id)), store.context.nowMs()) : true, store.context.sample);
        };
    }
    return env;
}
