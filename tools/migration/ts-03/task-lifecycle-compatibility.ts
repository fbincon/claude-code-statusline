import { canonical, decode } from '@fbincon/statusline-core/json';
import { pythonJson } from '@fbincon/statusline-core/json-text';
import { int, object, type Data } from '@fbincon/statusline-core/runtime/values';

const evidence = new Set(['agent_evidence', 'background_snapshot_wall_ns', 'continuation_wall_ns', 'configuration_prompt', 'registry_observation', 'last_end_evidence']);
export function taskEvidenceProjection(turn: Data): Data {
    return Object.fromEntries(Object.entries(turn).filter(([key]) => !evidence.has(key)));
}

const cases = new Set(['lifecycle-continuation-frozen', 'lifecycle-parallel-reports', 'lifecycle-interrupted', 'lifecycle-failed']);
const stateBefore = new Map<string, readonly string[]>([
    ['lifecycle-parallel-reports:1', ['a']], ['lifecycle-parallel-reports:2', ['a','b']],
    ...[1, 2, 3].map(index => ['lifecycle-interrupted:' + index, ['a']] as const),
]);
function matchesTurn(before: unknown, after: unknown, inline: readonly string[] | undefined): boolean {
    if (!object(before) || !object(after) || Object.keys(before).some(key => evidence.has(key)))
        return false;
    const projected = taskEvidenceProjection(after);
    if (inline && canonical(before.pending_agent_reports) === canonical(inline) && canonical(projected.pending_agent_reports) === canonical([]))
        projected.pending_agent_reports = before.pending_agent_reports;
    return canonical(before) === canonical(projected);
}
export function lifecycleReplayDifference(id: string, path: string, before: unknown, after: unknown): boolean {
    if (!cases.has(id))
        return false;
    const state = /^\/value\/(\d+)\/state$/u.exec(path);
    if (state)
        return matchesTurn(before, after, stateBefore.get(id + ':' + state[1]));
    if (!/^\/files_after\/runtime~1turns~1[a-f0-9]{64}\.json$/u.test(path) || typeof before !== 'string' || typeof after !== 'string')
        return false;
    const settings = { sortKeys: true, compact: true };
    try {
        const previous = decode(before), current = decode(after);
        if (!object(previous) || !object(current) || int(previous.schema) !== 1n || int(current.schema) !== 1n ||
            pythonJson(previous, settings) !== before || pythonJson(current, settings) !== after)
            return false;
        const { lifecycle: oldLedger, ...oldMirror } = previous, { lifecycle: newLedger, ...newMirror } = current;
        if (Object.keys(newMirror).some(key => evidence.has(key)) || !object(oldLedger) || !object(newLedger) ||
            int(oldLedger.schema) !== 4n || int(newLedger.schema) !== 4n)
            return false;
        const { turns: oldTurns, ...oldMetadata } = oldLedger, { turns: newTurns, ...newMetadata } = newLedger;
        const inline = id === 'lifecycle-interrupted' ? ['a'] : undefined;
        return Array.isArray(oldTurns) && Array.isArray(newTurns) && oldTurns.length === newTurns.length &&
            canonical(oldMetadata) === canonical(newMetadata) && matchesTurn(oldMirror, newMirror, inline) &&
            oldTurns.every((turn, index) => matchesTurn(turn, newTurns[index], inline));
    } catch {
        return false;
    }
}
