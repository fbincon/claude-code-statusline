import type { TestContext } from 'node:test';
import { setup, plain } from './runtime-support.js';
import { updateTurnMetadata } from '@fbincon/statusline-core/runtime/transcript';
import { renderTaskTimer } from '@fbincon/statusline-core/rendering/timer';
import { MESSAGES } from '@fbincon/statusline-core/i18n/statusline/en';
import type { Data } from '@fbincon/statusline-core/runtime/values';
export function promptLine(prompt: string, second: number, content = 'continue'): Data { return { type: 'user', timestamp: new Date(second * 1000).toISOString(), promptId: prompt, origin: { kind: 'human' }, promptSource: 'queued', message: { role: 'user', content } }; }
export function assistantLine(second: number): Data { return { type: 'assistant', timestamp: new Date(second * 1000).toISOString(), message: { role: 'assistant', content: [{ type: 'text', text: 'done' }] } }; }
export function durationLine(second: number, duration: unknown): Data { return { type: 'system', subtype: 'turn_duration', timestamp: new Date(second * 1000).toISOString(), durationMs: duration }; }
export function lifecycle(t: TestContext) {
    const f = setup(t);
    const event = (name: string, second: number, prompt: string | null = 'p', extra: Data = {}, session = 's') => {
        const wall = BigInt(Math.trunc(second * 1e9));
        f.clock(wall);
        f.tasks.handle({ session_id: session, prompt_id: prompt, hook_event_name: name, ...extra });
        const state = f.tasks.store.state(session, prompt);
        if (name === 'Stop' && !extra.agent_id && state && !Object.keys(state.active_agents).length && !(state.prompt_aliases.length && state.pending_agent_reports.length) && ['running', 'completed'].includes(state.status))
            f.tasks.confirm(session, prompt, wall);
        return plain(f.tasks.store.state(session, prompt));
    };
    return { ...f, event, state: (prompt: string | null = 'p', session = 's') => plain(f.tasks.store.state(session, prompt)),
        feed(lines: unknown[], entry: Data = {}, session = 's') { const observations = updateTurnMetadata(entry, lines); if (observations.length)
            f.tasks.transcript(session, observations); return entry; },
        duration(second: number, milliseconds: unknown = 1000, prompt: string | null = 'p') { f.tasks.transcript('s', [{ kind: 'turn_duration', prompt_id: prompt, wall_ns: BigInt(Math.trunc(second * 1e9)), duration_ms: milliseconds }]); },
        render(state: Data | null) { return renderTaskTimer(state, f.context.sample(), (key, params = {}) => ((MESSAGES as Record<string, string>)[key] ?? key).replace(/\{(\w+)\}/gu, (_, name: string) => String(params[name])), { timer: '', reset: '' }); },
        task() { event('UserPromptSubmit', 1); event('SubagentStart', 2, 'p', { agent_id: 'a' }); event('Stop', 3); event('SubagentStop', 4, 'p', { agent_id: 'a' }); },
    };
}
