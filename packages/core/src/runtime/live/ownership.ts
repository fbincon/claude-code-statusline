import { object, own, truth, string } from '../values.js';
import type { Observation } from './model.js';
import type { LiveState } from './state.js';
export function canonicalPrompt(state: LiveState, value: unknown): string | null {
    let prompt = typeof value === 'string' ? value : null;
    for (let index = 0; index < 32; index++) {
        let target = prompt === null ? undefined : own(state.prompt_aliases, prompt);
        if (object(target)) {
            const agent = typeof target.agent_id === 'string' ? own(state.agents, target.agent_id) : undefined;
            target = agent && agent.epoch === target.epoch ? agent.prompt_id : null;
            if (target === null)
                return null;
        }
        if (!truth(target) || target === prompt)
            break;
        prompt = typeof target === 'string' ? target : null;
    }
    return prompt !== null && Object.hasOwn(state.prompts, prompt) ? prompt : null;
}
export function turnKey(epoch: string, turnId: unknown, agentId: unknown = null): string { return epoch + ':' + (truth(agentId) ? string(agentId) : 'main') + ':' + string(turnId); }
export function owner(state: LiveState, observation: Observation, parent = false): string | null {
    const agentId = parent ? observation.parent_agent_id : observation.agent_id;
    if (observation.turn_id) {
        const turn = own(state.turns, turnKey(observation.epoch, observation.turn_id, agentId));
        if (turn)
            return turn.prompt_id as string | null;
    }
    if (agentId && Object.hasOwn(state.agents, agentId)) {
        const agent = state.agents[agentId]!;
        return agent.epoch === observation.epoch ? agent.prompt_id as string | null : null;
    }
    const target = canonicalPrompt(state, observation.prompt_id);
    return target && state.prompts[target]!.epoch === observation.epoch ? target : null;
}
export function pendingOwner(state: LiveState, epoch: string): string | null {
    const bound = new Set(Object.values(state.turns).filter(turn => turn.agent_id === null).map(turn => turn.prompt_id));
    const candidates = Object.entries(state.prompts).filter(([key, prompt]) => prompt.epoch === epoch && !bound.has(key) && !truth(prompt.terminal)).map(([key]) => key);
    if (candidates.length === 1)
        return candidates[0]!;
    if (!candidates.length && state.active_prompt_id !== null) {
        const prompt = own(state.prompts, state.active_prompt_id);
        if (prompt?.epoch === epoch && !truth(prompt.terminal))
            return state.active_prompt_id;
    }
    return null;
}
