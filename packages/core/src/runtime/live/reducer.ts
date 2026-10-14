import { numeric, own, truth, dictionary, maxNumber, minNumber, type Data } from '../values.js';
import * as model from './model.js';
import { owner, pendingOwner, turnKey } from './ownership.js';
import { applyRequest, reconcileRequests } from './requests.js';
import type { LiveState } from './state.js';
export function trimTable(values: Record<string, Data>, maximum: number, stamp = 'updated_at_ms'): void {
    const keys = Object.keys(values);
    if (keys.length > maximum)
        for (const key of keys.sort((a, b) => (numeric(values[a]![stamp]) ?? 0) - (numeric(values[b]![stamp]) ?? 0)).slice(0, -maximum))
            delete values[key];
}
export function applyObservation(state: LiveState, o: model.Observation, metadataOnly = false): boolean {
    const epoch = o.epoch, kind = o.kind, stamp = o.observed_at_ms;
    if (!Object.hasOwn(state.epochs, epoch)) {
        if (kind !== 'heartbeat')
            return false;
        const loaded = o.payload.loaded_at_ms;
        if (state.loaded_at_ms !== null && numeric(loaded)! <= numeric(state.loaded_at_ms)!)
            return false;
        state.epochs[epoch] = { seen: [], floor: -1, high: -1, updated_at_ms: loaded };
        Object.assign(state, { epoch, loaded_at_ms: loaded, heartbeat_at_ms: null, invalidated: null, current_prompt_id: null, permission: null,
            active_prompt_id: null, current_main_turn_id: null, agent_snapshot: null, checklists: dictionary(), prompt_aliases: dictionary(), prompt_links: dictionary() });
        for (const prompt of Object.values(state.prompts))
            if (!truth(prompt.terminal))
                prompt.complete = false;
        trimTable(state.epochs, model.MAX_EPOCHS);
    }
    const ledger = state.epochs[epoch]!, seq = numeric(o.seq)!;
    if (seq <= numeric(ledger.floor)! || ledger.seen.some(value => numeric(value) === seq))
        return false;
    const gap = seq > numeric(ledger.high)! + 1;
    ledger.seen.push(o.seq);
    ledger.seen.sort((a, b) => numeric(a)! - numeric(b)!);
    ledger.high = maxNumber(o.seq, ledger.high);
    if (ledger.seen.length > model.MAX_SEEN) {
        ledger.floor = ledger.seen[ledger.seen.length - model.MAX_SEEN - 1]!;
        ledger.seen = ledger.seen.slice(-model.MAX_SEEN);
    }
    const current = epoch === state.epoch;
    if (metadataOnly)
        return true;
    if (kind === 'heartbeat') {
        if (current && (state.heartbeat_at_ms === null || numeric(stamp)! >= numeric(state.heartbeat_at_ms)!)) {
            state.heartbeat_at_ms = stamp;
            state.host_version = o.payload.host_version;
        }
        return true;
    }
    if (kind === 'invalidate') {
        if (current)
            state.invalidated = o.payload.reason;
        return true;
    }
    const promptId = o.prompt_id;
    if (kind === 'prompt') {
        if (!current)
            return true;
        const previous = own(state.prompts, state.current_prompt_id);
        if (previous && numeric(previous.updated_at_ms)! > numeric(stamp)!)
            return true;
        if (!Object.hasOwn(state.prompts, promptId!))
            state.prompts[promptId!] = { updated_at_ms: stamp, started_at_ms: stamp, epoch, source: o.source, complete: !gap, terminal: false };
        state.current_prompt_id = promptId;
        trimTable(state.prompts, model.MAX_PROMPTS);
    }
    else if (kind === 'permission') {
        const previous = state.permission;
        if (current && o.agent_id === null && (previous === null || numeric(stamp)! >= numeric(previous.observed_at_ms)!))
            state.permission = { ...o.payload, observed_at_ms: stamp, source: o.source };
    }
    else if (kind === 'prompt_link') {
        const target = o.payload.message_id as string;
        if (current) {
            state.prompt_links[promptId!] = target;
            while (Object.keys(state.prompt_links).length > model.MAX_AGENTS)
                delete state.prompt_links[Object.keys(state.prompt_links)[0]!];
            state.prompt_aliases[promptId!] = target;
            if (!Object.hasOwn(state.prompts, target) && !Object.hasOwn(state.prompts, promptId!)) {
                state.prompts[target] = { epoch, started_at_ms: stamp, updated_at_ms: stamp, complete: !gap, terminal: false, source: 'otel' };
                state.current_prompt_id = target;
                trimTable(state.prompts, model.MAX_PROMPTS);
            }
        }
    }
    else if (kind === 'prompt_alias') {
        const agent = own(state.agents, o.payload.agent_id), fresh = !Object.hasOwn(state.prompt_aliases, promptId!);
        if (current && !Object.hasOwn(state.prompts, promptId!)) {
            state.prompt_aliases[promptId!] = agent && agent.epoch === epoch ? agent.prompt_id : { agent_id: o.payload.agent_id, epoch };
            while (Object.keys(state.prompt_aliases).length > model.MAX_AGENTS)
                delete state.prompt_aliases[Object.keys(state.prompt_aliases)[0]!];
        }
        if (current && fresh && o.source === 'classic_hook' && o.agent_id === null && agent && agent.ended_at_ms !== null) {
            const target = agent.prompt_id, prompt = own(state.prompts, target);
            if (prompt) {
                prompt.terminal = false;
                state.active_prompt_id = target as string | null;
            }
        }
    }
    else if (['wait_start', 'wait_end', 'wait_unknown'].includes(kind)) {
        state.wait_events[epoch + ':' + seq] = { ...o };
        trimTable(state.wait_events, model.MAX_SEEN, 'observed_at_ms');
    }
    else if (kind === 'turn_start' || kind === 'turn_end') {
        if (!current)
            return true;
        const key = turnKey(epoch, o.turn_id, o.agent_id);
        let turn = own(state.turns, key);
        if (!turn) {
            let target = owner(state, o);
            if (target === null && o.agent_id === null)
                target = pendingOwner(state, epoch);
            turn = { prompt_id: target, agent_id: o.agent_id, started_at_ms: stamp, ended_at_ms: null, status: 'running', updated_at_ms: stamp, epoch };
            state.turns[key] = turn;
            if (current && o.agent_id === null) {
                state.current_main_turn_id = key;
                state.active_prompt_id = target;
            }
        }
        if (kind === 'turn_end' && turn.ended_at_ms === null && numeric(stamp)! >= numeric(turn.started_at_ms)!) {
            Object.assign(turn, { ended_at_ms: stamp, status: o.payload.status, updated_at_ms: stamp });
            if (Object.hasOwn(o.payload, 'duration_ms')) {
                turn.duration_ms = o.payload.duration_ms;
                turn.wait_coverage = o.payload.wait_coverage;
            }
            const prompt = own(state.prompts, turn.prompt_id);
            if (prompt && o.agent_id === null)
                prompt.terminal = !Object.values(state.agents).some(agent => agent.prompt_id === turn!.prompt_id && agent.ended_at_ms === null);
        }
        trimTable(state.turns, model.MAX_TURNS);
    }
    else if (kind === 'agents') {
        const previous = state.agent_snapshot;
        if (current && (previous === null || numeric(stamp)! >= numeric(previous.observed_at_ms)!))
            state.agent_snapshot = { agents: o.payload.agents, observed_at_ms: stamp };
    }
    else if (kind === 'tool_start' || kind === 'tool_end') {
        const target = owner(state, o), key = epoch + ':' + o.request_id;
        let record = own(state.tools, key);
        if (!record) {
            record = { prompt_id: target, agent_id: o.agent_id, name: o.payload.name, started_at_ms: stamp, updated_at_ms: stamp, status: 'started', turn_key: o.turn_id ? turnKey(epoch, o.turn_id, o.agent_id) : null };
            state.tools[key] = record;
        }
        if (record.prompt_id === null)
            record.prompt_id = target;
        if (target === null || record.prompt_id === target) {
            if (kind === 'tool_start')
                record.started_at_ms = minNumber(record.started_at_ms, stamp);
            else {
                const ranks = ['started', 'success', 'error', 'denied', 'interrupted'];
                if (ranks.indexOf(o.payload.status as string) > ranks.indexOf(record.status as string))
                    record.status = o.payload.status;
            }
            record.updated_at_ms = maxNumber(stamp, record.updated_at_ms);
            trimTable(state.tools, model.MAX_TOOLS);
        }
    }
    else if (kind === 'task_snapshot' || kind === 'task_update') {
        const target = owner(state, o);
        if (current && (target || o.turn_id) && o.agent_id === null) {
            const provider = (target || turnKey(epoch, o.turn_id)) + ':' + o.payload.provider;
            let previous = own(state.checklists, provider);
            if (!previous) {
                previous = { prompt_id: target, turn_key: o.turn_id ? turnKey(epoch, o.turn_id) : null, tasks: dictionary(), complete: false, updated_at_ms: 0 };
                state.checklists[provider] = previous;
            }
            if (numeric(stamp)! >= numeric(previous.updated_at_ms)!) {
                if (kind === 'task_snapshot') {
                    previous.tasks = dictionary((o.payload.tasks as Data[]).filter(row => row.status !== 'deleted').map(row => [row.id as string, row.status]));
                    previous.complete = true;
                }
                else {
                    const tasks = previous.tasks as Data, task = o.payload.id as string, status = o.payload.status;
                    if (status === 'deleted')
                        delete tasks[task];
                    else {
                        if (!Object.hasOwn(tasks, task))
                            previous.complete = false;
                        if (Object.keys(tasks).length < model.MAX_TASKS || Object.hasOwn(tasks, task))
                            tasks[task] = status;
                    }
                }
                previous.updated_at_ms = stamp;
            }
        }
    }
    else if (kind === 'agent_start' || kind === 'agent_end') {
        const agentId = o.agent_id!, target = owner(state, o, kind === 'agent_start' && o.source === 'native');
        let record = own(state.agents, agentId);
        if (!record) {
            record = { prompt_id: target, epoch, started_at_ms: null, ended_at_ms: null, status: null, updated_at_ms: stamp, parent_agent_id: o.parent_agent_id, parent_turn_key: o.turn_id && o.source === 'native' ? turnKey(epoch, o.turn_id, o.parent_agent_id) : null };
            state.agents[agentId] = record;
        }
        if (target !== null && record.prompt_id !== target) {
            if (kind === 'agent_start' && o.source === 'native' && target)
                record.prompt_id = target;
            else
                return true;
        }
        if (record.epoch !== epoch)
            return true;
        if (kind === 'agent_start' && o.source === 'native') {
            record.parent_agent_id = o.parent_agent_id;
            record.parent_turn_key = o.turn_id ? turnKey(epoch, o.turn_id, o.parent_agent_id) : null;
            for (const turn of Object.values(state.turns))
                if (turn.agent_id === agentId && turn.prompt_id === null)
                    turn.prompt_id = target;
            reconcileRequests(state, agentId, target);
        }
        const field = kind === 'agent_start' ? 'started_at_ms' : 'ended_at_ms', observed = o.payload[field];
        if (record[field] === null || numeric(observed)! < numeric(record[field])!)
            record[field] = observed;
        if (kind === 'agent_end') {
            const rank = [null, 'completed', 'failed', 'killed', 'interrupted'];
            if (rank.indexOf(o.payload.status as string) > rank.indexOf(record.status as string))
                record.status = o.payload.status;
        }
        record.updated_at_ms = maxNumber(stamp, record.updated_at_ms);
        trimTable(state.agents, model.MAX_AGENTS);
    }
    else if (['request_start', 'request_first', 'request_end', 'request_cost', 'turn_usage'].includes(kind))
        applyRequest(state, o);
    if (gap && current)
        for (const prompt of Object.values(state.prompts))
            if (!truth(prompt.terminal))
                prompt.complete = false;
    return true;
}
