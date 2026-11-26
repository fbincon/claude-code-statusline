import { int, numeric, own, truth, maxNumber, compareNumbers, multiplyInteger } from '../values.js';
import { float } from '../transcript.js';
import { divideIntegers } from '../../numbers.js';
import type { TaskStore } from '../tasks/model.js';
import type { LiveState } from './state.js';
import { MAX_AGENTS, MAX_PROMPTS } from './model.js';
import { canonicalPrompt } from './ownership.js';
import { reconcileRequests } from './requests.js';
/** Read existing completed task windows and explicit identities; never guess text. */
export function reconcileBindings(state: LiveState, history: TaskStore | null): void {
    const tasks = history?.turns ?? [];
    const assign = (key: string, turn: LiveState['turns'][string], prompt: string) => {
        turn.prompt_id = prompt;
        delete turn.pending_prompt_ids;
        if (turn.ended_at_ms !== null && !Object.values(state.agents).some(agent => agent.prompt_id === prompt && agent.ended_at_ms === null))
            state.prompts[prompt]!.terminal = true;
        if (key === state.current_main_turn_id) {
            state.active_prompt_id = prompt;
            if (state.current_prompt_id === null)
                state.current_prompt_id = prompt;
        }
    };
    for (const [key, turn] of Object.entries(state.turns)) {
        if (turn.agent_id !== null || turn.prompt_id !== null || Array.isArray(turn.pending_prompt_ids))
            continue;
        const started = multiplyInteger(turn.started_at_ms, 1000000n);
        const candidates = tasks.filter(row => ['completed', 'failed', 'interrupted'].includes(row.status) && int(row.started_wall_ns) !== null && int(row.ended_wall_ns) !== null && compareNumbers(row.started_wall_ns, started) <= 0 && compareNumbers(started, row.ended_wall_ns) <= 0);
        if (candidates.length !== 1)
            continue;
        const row = candidates[0]!, prompt = row.prompt_id, epoch = typeof turn.epoch === 'string' ? turn.epoch : key.split(':', 1)[0]!;
        const ledger = own(state.epochs, epoch), startMs = divideIntegers(int(row.started_wall_ns)!, 1000000n);
        const complete = ledger && numeric(ledger.floor) === -1 && ledger.seen.length === (numeric(ledger.high) ?? -2) + 1 && numeric(state.loaded_at_ms)! <= startMs;
        if (!Object.hasOwn(state.prompts, prompt))
            state.prompts[prompt] = { epoch, started_at_ms: float(startMs), updated_at_ms: float(divideIntegers(int(row.ended_wall_ns)!, 1000000n)), complete: Boolean(complete), terminal: true, source: 'lifecycle_window' };
        assign(key, turn, prompt);
    }
    const claimed = new Map<string, number>();
    for (const row of tasks)
        for (const id of new Set([row.prompt_id, ...row.prompt_aliases]))
            claimed.set(id, (claimed.get(id) ?? 0) + 1);
    for (const row of tasks) {
        const identities = new Set([row.prompt_id, ...row.prompt_aliases]);
        for (const alias of [...identities]) {
            const target = own(state.prompt_links, alias);
            if (target !== undefined && (target === row.prompt_id || !claimed.has(target)))
                identities.add(target);
        }
        if ([...identities].some(id => (claimed.get(id) ?? 0) > 1))
            continue;
        const candidates = Object.keys(state.prompts).filter(key => identities.has(key));
        if (!candidates.length)
            continue;
        const canonical = candidates.reduce((best, key) => {
            const next = state.prompts[key]!, current = state.prompts[best]!;
            if ((next.epoch === state.epoch) !== (current.epoch === state.epoch))
                return next.epoch === state.epoch ? key : best;
            return numeric(next.started_at_ms)! < numeric(current.started_at_ms)! ? key : best;
        });
        if (['completed', 'failed', 'interrupted'].includes(row.status)) {
            state.prompts[canonical]!.terminal = true;
            state.prompts[canonical]!.updated_at_ms = maxNumber(state.prompts[canonical]!.updated_at_ms, float(Number(int(row.ended_wall_ns) ?? 0n) / 1e6));
        }
        const aliasTarget = own(state.prompt_aliases, canonical);
        if (typeof aliasTarget === 'string' && identities.has(aliasTarget))
            delete state.prompt_aliases[canonical];
        for (const alias of identities)
            if (alias !== canonical)
                state.prompt_aliases[alias] = canonical;
    }
    for (const [alias, target] of Object.entries(state.prompt_aliases)) {
        if (typeof target !== 'string' || alias === target)
            continue;
        const source = own(state.prompts, alias), destination = own(state.prompts, target);
        if (!source)
            continue;
        if (!destination)
            state.prompts[target] = { ...source, source: 'explicit_prompt_link' };
        else if (source.epoch === destination.epoch) {
            destination.updated_at_ms = maxNumber(destination.updated_at_ms, source.updated_at_ms);
            destination.terminal ||= source.terminal;
        }
        for (const table of [state.turns, state.agents, state.requests, state.tools, state.checklists, state.costs])
            for (const row of Object.values(table))
                if (row.prompt_id === alias)
                    row.prompt_id = target;
        if (state.active_prompt_id === alias)
            state.active_prompt_id = target;
        if (state.current_prompt_id === alias)
            state.current_prompt_id = target;
        delete state.prompts[alias];
    }
    for (const [key, turn] of Object.entries(state.turns)) {
        if (turn.prompt_id !== null || turn.agent_id !== null || !Array.isArray(turn.pending_prompt_ids))
            continue;
        const candidates = turn.pending_prompt_ids.map(id => canonicalPrompt(state, id)), prompt = candidates[0];
        if (prompt && candidates.every(id => id === prompt) && state.prompts[prompt]!.epoch === turn.epoch)
            assign(key, turn, prompt);
    }
    for (let index = 0; index < 32; index++) {
        let changed = false;
        for (const [identity, agent] of Object.entries(state.agents)) {
            if (agent.prompt_id !== null)
                continue;
            const parentTurn = own(state.turns, agent.parent_turn_key), parent = own(state.agents, agent.parent_agent_id);
            const target = truth(parentTurn?.prompt_id) ? parentTurn!.prompt_id : parent?.prompt_id ?? null;
            if (target !== null) {
                agent.prompt_id = target;
                reconcileRequests(state, identity, target);
                changed = true;
            }
        }
        if (!changed)
            break;
    }
    for (const turn of Object.values(state.turns))
        if (turn.prompt_id === null && truth(turn.agent_id)) {
            const agent = own(state.agents, turn.agent_id);
            if (agent)
                turn.prompt_id = agent.prompt_id;
        }
    for (const table of [state.requests, state.tools, state.checklists])
        for (const row of Object.values(table)) {
            const turn = own(state.turns, row.turn_key);
            if (row.prompt_id === null && turn)
                row.prompt_id = turn.prompt_id;
        }
    for (const row of Object.values(state.costs))
        if (row.prompt_id === null) {
            const target = canonicalPrompt(state, row.owner_alias);
            if (target && Object.values(state.turns).some(turn => turn.prompt_id === target && numeric(turn.started_at_ms)! <= numeric(row.updated_at_ms)!))
                row.prompt_id = target;
        }
    for (const key of Object.keys(state.prompts).sort((a, b) => numeric(state.prompts[a]!.updated_at_ms)! - numeric(state.prompts[b]!.updated_at_ms)!).slice(0, -MAX_PROMPTS))
        delete state.prompts[key];
    for (const alias of Object.keys(state.prompt_aliases).slice(0, -MAX_AGENTS))
        delete state.prompt_aliases[alias];
}
