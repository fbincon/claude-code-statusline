import type { Sample } from '../../timing/sample.js';
import { StatusTimer } from '../../timing/timer.js';
import { int, numeric, own, object, truth, string, compareNumbers, type Data } from '../values.js';
import { roundedInteger } from '../transcript.js';
import type { LiveState } from '../live/state.js';
import { findTurn, rememberId, type TaskStore, type Turn } from './model.js';
import { applyPrompt, finishRecord } from './transitions.js';
import { startSubagent, stopSubagent } from './agents.js';
export function nativeSample(wall: bigint, capture: () => Sample, record: Turn | null = null, starting = false): Sample {
    const boot = record ? int(record.started_boot_ns) : null, started = record ? int(record.started_wall_ns) : null;
    if (starting && record && boot !== null && started !== null) {
        const offset = wall - started;
        if (offset >= 0n && truth(record.boot_id))
            return { wall_ns: wall, boot_ns: boot + offset, boot_id: record.boot_id as string };
    }
    const captured = capture(), delay = captured.wall_ns - wall;
    return captured.boot_id && captured.boot_ns !== null && delay >= 0n && delay <= 2000000000n ? { wall_ns: wall, boot_ns: captured.boot_ns - delay, boot_id: captured.boot_id } : { wall_ns: wall, boot_ns: null, boot_id: null };
}
export function linkTask(history: TaskStore, alias: string, target: string): void {
    const original = findTurn(history, alias), message = findTurn(history, target);
    if (original && message && original !== message) {
        const earlier = int(message.started_wall_ns), previous = int(original.started_wall_ns);
        if (original.status === 'running' && !original.historical_frozen && earlier !== null && previous !== null && earlier < previous) {
            let boot = int(original.started_boot_ns), domain: unknown;
            const offset = previous - earlier, messageBoot = int(message.started_boot_ns);
            if (messageBoot !== null && truth(message.boot_id)) {
                boot = messageBoot;
                domain = message.boot_id;
            }
            else {
                boot = boot !== null && offset >= 0n && offset <= boot ? boot - offset : null;
                domain = boot !== null ? original.boot_id : null;
            }
            Object.assign(original, { started_wall_ns: earlier, started_boot_ns: boot, boot_id: domain, start_source: message.start_source, submission_verified: message.submission_verified });
        }
        for (const item of message.prompt_aliases)
            rememberId(original, 'prompt_aliases', item);
        history.turns.splice(history.turns.indexOf(message), 1);
    }
    const record = original ?? message;
    if (record) {
        for (const key of [alias, target])
            if (key !== record.prompt_id)
                rememberId(record, 'prompt_aliases', key);
        if (history.current_prompt_id === alias || history.current_prompt_id === target)
            history.current_prompt_id = record.prompt_id;
    }
}
export function observeNative(history: TaskStore, state: LiveState, capture: () => Sample, completeTiming = true): string | null {
    const epoch = state.epoch!, ledger = own(state.epochs, epoch);
    const contiguous = ledger !== undefined && numeric(ledger.floor) === -1 && ledger.seen.length === (numeric(ledger.high) ?? -2) + 1;
    const pending: {
        key: string;
        record: Turn;
        turn: Data;
        previous: Data | undefined;
        agent: unknown;
    }[] = [];
    const links = () => { for (const [alias, target] of Object.entries(state.prompt_aliases))
        if (typeof target === 'string')
            linkTask(history, alias, target); };
    links();
    for (const [prompt, info] of Object.entries(state.prompts)) {
        if (info.epoch !== epoch || info.source === 'lifecycle_window')
            continue;
        const linked = Object.hasOwn(state.prompt_aliases, prompt) || Object.values(state.prompt_aliases).includes(prompt);
        if (info.source === 'native' && history.turns.length && !linked)
            continue;
        if (!findTurn(history, prompt))
            applyPrompt(history, prompt, roundedInteger(numeric(info.started_at_ms)! * 1e6));
    }
    links();
    const turns = Object.entries(state.turns).sort((a, b) => numeric(a[1].started_at_ms)! - numeric(b[1].started_at_ms)!);
    for (const [key, turn] of turns) {
        if (turn.epoch !== epoch || turn.prompt_id === null)
            continue;
        const record = findTurn(history, turn.prompt_id);
        if (!record || record.historical_frozen)
            continue;
        if (Object.values(record.native_turns).some(loop => loop.epoch !== epoch))
            record.active_coverage = 'incomplete';
        const previous = own(record.native_turns, key), started = roundedInteger(numeric(turn.started_at_ms)! * 1e6), agent = turn.agent_id;
        if (turn.start_observed !== true) record.active_coverage = 'incomplete';
        if (!previous && agent === null && record.status === 'completed' && record.end_source === 'native_turn_end' && started > (int(record.ended_wall_ns) || started) && record.report_aliases.length && history.current_prompt_id === record.prompt_id) {
            Object.assign(record, { status: 'running', ended_wall_ns: null, ended_boot_ns: null, duration_ns: null, end_source: null, end_reason: null, phase: 'main' });
        }
        if (!previous || record.active_clock == null) {
            const candidate = record.stop_candidate;
            if (object(candidate) && started > int(candidate.wall_ns)!) {
                record.stop_candidate = null;
                record.phase = 'main';
            }
            if (record.active_clock == null)
                record.active_clock = StatusTimer.start(nativeSample(started, capture, record, true)).toDict();
            else {
                const timer = StatusTimer.load(record.active_clock);
                if (timer)
                    record.active_clock = timer.reopen().toDict();
            }
            if (completeTiming && contiguous && record.active_coverage === 'not_observed')
                record.active_coverage = 'complete';
            if (truth(agent))
                startSubagent(history, record.prompt_id, { agent_id: agent }, started);
        }
        Object.defineProperty(record.native_turns, key, { value: { ...turn, confirmed_end: previous !== undefined && truth(previous.confirmed_end) }, enumerable: true, configurable: true, writable: true });
        if (!contiguous || truth(state.invalidated) && turn.ended_at_ms === null)
            record.active_coverage = 'incomplete';
        pending.push({ key, record, turn, previous, agent });
    }
    const starts = new Map<string, number>();
    const identity = (event: Data) => JSON.stringify([event.epoch, event.agent_id, event.turn_id, event.request_id]);
    for (const event of Object.values(state.wait_events))
        if (event.kind === 'wait_start') {
            const id = identity(event), sequence = numeric(event.seq)!;
            starts.set(id, Math.min(starts.get(id) ?? sequence, sequence));
        }
    for (const observation of Object.values(state.wait_events).sort((a, b) => numeric(a.seq)! - numeric(b.seq)!)) {
        if (observation.epoch !== epoch || !observation.kind.startsWith('wait_'))
            continue;
        const key = epoch + ':' + (observation.agent_id || 'main') + ':' + string(observation.turn_id), turn = own(state.turns, key);
        const record = turn && turn.prompt_id !== null ? findTurn(history, turn.prompt_id) : null;
        if (!record)
            continue;
        const sequence = numeric(observation.seq)!;
        if (observation.kind === 'wait_end' && (starts.get(identity(observation)) ?? sequence + 1) >= sequence)
            record.active_coverage = 'incomplete';
        if (!rememberId(record, 'native_wait_seen', epoch + ':' + sequence))
            continue;
        if (observation.kind === 'wait_unknown') {
            record.active_coverage = 'wait_coverage_missing';
            continue;
        }
        let timer = StatusTimer.load(record.active_clock);
        if (!timer)
            continue;
        const token = key + ':' + observation.request_id, now = nativeSample(roundedInteger(numeric(observation.observed_at_ms)! * 1e6), capture);
        if (observation.kind === 'wait_start') {
            if (truth(record.active_agents))
                record.active_coverage = 'incomplete';
            else
                timer = timer.pause(token, now);
        }
        else
            timer = timer.resume(token, now);
        record.active_clock = timer.toDict();
    }
    for (const { key, record, turn, previous, agent } of pending) {
        const pendingExit = record.end_source === 'hook_session_end';
        const laterEnding = agent === null && record.end_source === 'native_turn_end' && turn.ended_at_ms !== null && truth(record.ended_wall_ns) && compareNumbers(numeric(turn.ended_at_ms)! * 1e6, record.ended_wall_ns) > 0;
        if (turn.ended_at_ms === null || previous?.confirmed_end === true && !pendingExit && !laterEnding)
            continue;
        record.native_turns[key]!.confirmed_end = true;
        const ended = roundedInteger(numeric(turn.ended_at_ms)! * 1e6);
        if (truth(agent)) {
            if (!completeTiming || !truth(turn.wait_coverage))
                record.active_coverage = 'wait_coverage_missing';
            stopSubagent(history, record.prompt_id, { agent_id: agent }, ended);
        }
        else {
            if (Object.values(record.native_turns).some(loop => loop.agent_id === null && numeric(loop.started_at_ms)! > numeric(turn.started_at_ms)!))
                continue;
            if (laterEnding) {
                Object.assign(record, { status: 'running', ended_wall_ns: null, ended_boot_ns: null, duration_ns: null, end_source: null, end_reason: null });
                const timer = StatusTimer.load(record.active_clock);
                if (timer)
                    record.active_clock = timer.reopen().toDict();
            }
            if (Object.hasOwn(turn, 'duration_ms'))
                record.native_duration_ms = turn.duration_ms;
            if (!completeTiming || !truth(turn.wait_coverage))
                record.active_coverage = 'wait_coverage_missing';
            else if (['not_observed', 'complete'].includes(String(record.active_coverage)))
                record.active_coverage = contiguous ? 'complete' : 'incomplete';
            const reports = record.report_aliases.length && record.pending_agent_reports.length;
            const activeNative = Object.values(record.native_turns).some(loop => loop.agent_id !== null && numeric(loop.started_at_ms)! <= numeric(turn.ended_at_ms)! && (loop.ended_at_ms === null || numeric(loop.ended_at_ms)! > numeric(turn.ended_at_ms)!));
            if (turn.status === 'completed' && (truth(record.active_agents) || reports || activeNative))
                continue;
            const candidate = record.stop_candidate;
            let sample = nativeSample(ended, capture);
            if (object(candidate)) {
                const wall = int(candidate.wall_ns)!;
                if (ended - wall >= 0n && ended - wall <= 2000000000n) {
                    const boot = int(candidate.boot_ns);
                    sample = { wall_ns: ended, boot_ns: boot === null ? null : boot + ended - wall, boot_id: typeof candidate.boot_id === 'string' ? candidate.boot_id : null };
                }
            }
            const confirmed = finishRecord(record, turn.status as string, sample.wall_ns, sample.boot_ns, sample.boot_id, 'native_turn_end', 'native_main_end', null, ended);
            if (confirmed || record.status === turn.status && record.status !== 'running') {
                const timer = StatusTimer.load(record.active_clock);
                if (timer)
                    record.active_clock = timer.finish(confirmed ? sample : { wall_ns: int(record.ended_wall_ns)!, boot_ns: int(record.ended_boot_ns), boot_id: typeof record.boot_id === 'string' ? record.boot_id : null }).toDict();
            }
        }
        while (Object.keys(record.native_turns).length > 256)
            delete record.native_turns[Object.keys(record.native_turns)[0]!];
    }
    return history.current_prompt_id;
}
