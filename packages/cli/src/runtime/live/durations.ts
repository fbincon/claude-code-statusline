import { join } from 'node:path';
import { sha256 } from '@fbincon/statusline-platform/hash';
import { pythonJson } from '@fbincon/statusline-core/json-text';
import { number, MAX_AGENTS, MAX_SESSIONS } from '@fbincon/statusline-core/runtime/live/model';
import { object, own, numeric, dictionary, type Data } from '@fbincon/statusline-core/runtime/values';
import { float } from '@fbincon/statusline-core/runtime/transcript';
import type { RuntimeContext } from '../context.js';
import { readStored, runtimeIO, type RuntimeIO } from '../io.js';
import { LiveStore } from './store.js';
export class AgentDurations {
    readonly live: LiveStore;
    constructor(public readonly context: RuntimeContext, public readonly io: RuntimeIO = runtimeIO()) { this.live = new LiveStore(context, io); }
    directory(): string { return join(this.context.runtimeRoot, 'agent-durations'); }
    path(session: string): string { return join(this.directory(), sha256(session) + '.json'); }
    load(session: string): Record<string, Data> {
        try {
            const data = readStored(this.io, this.path(session), true);
            if (object(data) && data.session_id === session && object(data.agents))
                return data.agents as Record<string, Data>;
        }
        catch { /* No trustworthy duration evidence. */ }
        return dictionary();
    }
    observe(data: unknown, nowMs: unknown = float(this.context.nowMs())): void {
        if (!object(data) || !['SubagentStart', 'SubagentStop'].includes(data.hook_event_name as string))
            return;
        const session = data.session_id, agent = data.agent_id;
        if (typeof session !== 'string' || typeof agent !== 'string' || !session || !agent)
            return;
        number(nowMs, 'agent observation time');
        const target = this.path(session);
        this.io.lock(target.slice(0, -5) + '.lock', () => {
            const agents = this.load(session), record = own(agents, agent);
            if (data.hook_event_name === 'SubagentStart') {
                const owners = (this.live.tasks.load(session)?.turns ?? []).filter(row => row.agent_ids.includes(agent));
                if (owners.length !== 1)
                    return;
                if (record === undefined)
                    agents[agent] = { prompt_id: owners[0]!.prompt_id, started_at_ms: nowMs, ended_at_ms: null };
            }
            else if (record && record.ended_at_ms === null && numeric(nowMs)! >= numeric(record.started_at_ms)!)
                record.ended_at_ms = nowMs;
            else
                return;
            while (Object.keys(agents).length > MAX_AGENTS)
                delete agents[Object.keys(agents).reduce((best, key) => numeric(agents[key]!.started_at_ms)! < numeric(agents[best]!.started_at_ms)! ? key : best)];
            this.io.write(target, Buffer.from(pythonJson({ session_id: session, agents }, { allowNan: true })));
        });
        const entries = this.io.entries(this.directory()).filter(entry => entry.name.endsWith('.json')).map(entry => ({ ...entry, stamp: this.io.stat(entry.path).mtimeNs })).sort((a, b) => a.stamp > b.stamp ? -1 : a.stamp < b.stamp ? 1 : 0);
        for (const entry of entries.slice(MAX_SESSIONS))
            this.io.lock(entry.path.slice(0, -5) + '.lock', () => this.io.remove(entry.path));
    }
    endedAt(session: string): Data {
        const result: Data = dictionary();
        for (const agents of [this.live.load(session)?.agents ?? {}, this.load(session)])
            for (const [key, row] of Object.entries(agents)) {
                const value = object(row) ? numeric(row.ended_at_ms) : null;
                if (value !== null && value >= 0)
                    result[key] = row.ended_at_ms;
            }
        return result;
    }
}
