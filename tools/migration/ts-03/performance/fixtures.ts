import { mkdirSync, writeFileSync, readFileSync, utimesSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { defaultDisplay, defaultItem } from '@fbincon/statusline-core/config/display';
import { updateDisplay } from '@fbincon/statusline-core/config/instances';
import { DEFAULT_HOST } from '@fbincon/statusline-core/config/draft';
import { sha256 } from '@fbincon/statusline-platform/hash';
import type { DisplayDraft, InstanceDraft } from '@fbincon/statusline-core/contracts/ui';
export type Profile = 'small' | 'medium' | 'large';
export interface BenchmarkCase {
    name: string;
    mode: 'command' | 'in_process';
    operation: string;
    profile: Profile;
    cache?: 'cold' | 'warm' | 'append' | 'miss' | 'hit' | 'expired';
}
export const CASES: readonly BenchmarkCase[] = [
    { name: 'command/render-model', mode: 'command', operation: 'model', profile: 'small' },
    ...(['small', 'medium', 'large'] as const).flatMap(profile => [
        { name: `command/${profile}/render-composite`, mode: 'command' as const, operation: 'render', profile, cache: 'warm' as const },
        { name: `command/${profile}/render-subagents`, mode: 'command' as const, operation: 'agents', profile },
    ]),
    { name: 'command/hook', mode: 'command', operation: 'hook', profile: 'small' },
    { name: 'command/ui-preview', mode: 'command', operation: 'preview', profile: 'small' },
    { name: 'command/runtime-observe', mode: 'command', operation: 'runtime', profile: 'large' },
    ...(['small', 'medium', 'large'] as const).flatMap(profile => [
        ...(['cold', 'warm', 'append'] as const).map(cache => ({ name: `in-process/${profile}/transcript/${cache}`, mode: 'in_process' as const, operation: 'usage', profile, cache })),
        ...(['miss', 'hit', 'expired'] as const).map(cache => ({ name: `in-process/${profile}/git/${cache}`, mode: 'in_process' as const, operation: 'git', profile, cache })),
        { name: `in-process/${profile}/agents`, mode: 'in_process' as const, operation: 'agents', profile },
    ]),
    { name: 'in-process/unicode-composition', mode: 'in_process', operation: 'composition', profile: 'small' },
];
export function record(index: number, prefix = 'main'): string {
    return JSON.stringify({ type: 'assistant', message: { id: `${prefix}-${index}`, content: [{ type: 'text', text: 'local fixture '.repeat(8) }], usage: { input_tokens: 12, output_tokens: 5, cache_creation_input_tokens: 3, cache_read_input_tokens: 7 } } }) + '\n';
}
export function createProfile(root: string, dimensions: readonly number[]) {
    const [rows, agents, files] = dimensions as [
        number,
        number,
        number
    ];
    mkdirSync(root, { recursive: true });
    const history = join(root, 'history.jsonl');
    writeFileSync(history, Array.from({ length: rows }, (_, i) => record(i)).join(''));
    utimesSync(history, 1788400000, 1788400000);
    const hashes: Record<string, string> = { 'history.jsonl': sha256(readFileSync(history)) };
    for (let agent = 0; agent < agents; agent++) {
        const relative = `history/subagents/${agent % 2 ? 'nested/' : ''}agent-${agent}.jsonl`, path = join(root, relative);
        mkdirSync(join(root, `history/subagents/${agent % 2 ? 'nested' : ''}`), { recursive: true });
        writeFileSync(path, Array.from({ length: 100 }, (_, i) => record(i, `agent-${agent}`)).join(''));
        utimesSync(path, 1788400000, 1788400000);
        hashes[relative] = sha256(readFileSync(path));
    }
    const project = join(root, 'project');
    mkdirSync(project);
    const git = (...args: string[]) => execFileSync('git', ['-C', project, ...args], { stdio: 'pipe', timeout: 60000, env: { ...process.env, GIT_AUTHOR_DATE: '2026-10-14T00:00:00Z', GIT_COMMITTER_DATE: '2026-10-14T00:00:00Z' } });
    git('init', '-q', '-b', 'main');
    git('config', 'core.autocrlf', 'false');
    for (let i = 0; i < files; i++) {
        const directory = join(project, 'group-' + Math.floor(i / 100));
        mkdirSync(directory, { recursive: true });
        writeFileSync(join(directory, `file-${i}.txt`), 'tracked local benchmark fixture\n');
    }
    git('add', '.');
    git('-c', 'user.name=Benchmark', '-c', 'user.email=benchmark@example.invalid', '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=' + join(root, 'no-hooks'), 'commit', '-qm', 'Local fixture');
    // Dirty status is representative and remains immutable across both sides.
    writeFileSync(join(project, 'group-0/file-0.txt'), 'changed\n');
    writeFileSync(join(project, 'untracked.txt'), 'untracked\n');
    return { rows, agents, files, hashes, git_commit: git('rev-parse', 'HEAD').toString().trim() };
}
export interface Input {
    spec: BenchmarkCase;
    root: string;
    profileRoot: string;
    history: string;
    project: string;
    rows: number;
    agents: number;
    display: DisplayDraft;
    payload: Record<string, unknown>;
    command: string;
    raw: string;
    append: string;
}
export function inputFor(spec: BenchmarkCase, root: string, dimensions: readonly number[], observedAt: number): Input {
    const [rows, agents] = dimensions as [
        number,
        number,
        number
    ], profileRoot = join(root, spec.profile), history = join(profileRoot, 'history.jsonl'), project = join(profileRoot, 'project');
    let ids = ['model-with-effort', 'current-dir', 'git', 'context-remaining', 'tokens', 'input-tokens', 'output-tokens', 'input-tokens'];
    if (spec.operation === 'model')
        ids = ['model-with-effort'];
    if (spec.operation === 'composition' || spec.operation === 'preview')
        ids = ['model-with-effort', 'current-dir', 'context-used', 'session-cost'];
    const seen = new Set<string>(), instances: InstanceDraft[] = ids.map((type_id, i): InstanceDraft => { const id = seen.has(type_id) ? `copy-${i}` : type_id; seen.add(type_id); return { id, type_id, enabled: true, options: { ...defaultItem(), formatting: type_id === 'input-tokens' ? { number_format: id.startsWith('copy') ? 'full' : 'compact' } : {} }, text: null }; });
    const display = updateDisplay(defaultDisplay(), { instances, use_colors: false, directory_style: 'basename', scope_labels: 'off', statusline_language: ['composition', 'preview'].includes(spec.operation) ? 'zh-CN' : 'en' });
    const tasks = Array.from({ length: agents }, (_, i) => ({ id: 'agent-' + i, name: `Review-${i} 👩🏽‍💻`, type: 'local_agent', status: 'completed', description: `Task ${i}: ` + '长目录 é 🇨🇳 1️⃣ '.repeat(4), model: 'claude-sonnet-5', effort: 'high', startTime: 1788400000000, endTime: 1788400078000, _frozen_duration_ms: 78000, tokenCount: 84000, contextWindowSize: 200000 }));
    let payload: Record<string, unknown> = { model: { id: 'claude-sonnet-4-6' }, session_id: 'bench', transcript_path: history, workspace: { current_dir: project }, context_window: { remaining_percentage: 50, used_percentage: 50, context_window_size: 200000 }, cost: { total_cost_usd: 12.34 } };
    let command = 'render';
    if (spec.operation === 'model' || spec.operation === 'composition') {
        delete payload.session_id;
        delete payload.transcript_path;
    }
    if (spec.operation === 'agents') {
        payload = { tasks, columns: 80 };
        command = 'render-subagents';
    }
    if (spec.operation === 'preview') {
        payload = { protocol_version: 25, operation: 'preview', payload: { draft: { display, host: DEFAULT_HOST }, width: 80 } };
        command = 'ui';
    }
    if (spec.operation === 'hook') {
        payload = { hook_event_name: 'UserPromptSubmit', session_id: 'bench', prompt_id: 'p', prompt: 'local fixture' };
        command = 'hook';
    }
    if (spec.operation === 'runtime') {
        const now = observedAt, observations = [{ kind: 'heartbeat', payload: { host_version: '2.1.296', loaded_at_ms: now } }, { kind: 'prompt', payload: {} }, ...tasks.map(() => ({ kind: 'agent_start', payload: { started_at_ms: now } }))].map((event, seq) => ({ session_id: 'bench', epoch: 'e', seq, observed_at_ms: now, source: 'native', kind: event.kind, prompt_id: seq ? 'p' : null, agent_id: seq > 1 ? `agent-${seq - 2}` : null, parent_agent_id: null, turn_id: null, request_id: null, payload: event.payload }));
        payload = { protocol_version: 2, operation: 'observe', payload: { observations } };
        command = 'runtime';
    }
    return { spec, root, profileRoot, history, project, rows, agents, display, payload, command, raw: JSON.stringify(payload), append: record(rows, 'append') };
}
