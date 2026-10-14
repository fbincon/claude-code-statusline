import { LosslessNumber, pythonFloat } from '../json.js';
import { numeric, object, truth, string, type Data } from './values.js';
import { agentNotificationId } from './tasks/model.js';
import { divideIntegers } from '../numbers.js';
const SPACE = '[\\p{White_Space}\\x1c-\\x1f]';
export function trim(value: string): string { return value.replace(new RegExp('^' + SPACE + '+|' + SPACE + '+$', 'gu'), ''); }
export function float(value: number): LosslessNumber { return new LosslessNumber(pythonFloat(value)); }
export function roundedInteger(value: number): bigint {
    const floor = Math.floor(value), fraction = value - floor;
    return BigInt(fraction > 0.5 || fraction === 0.5 && floor % 2 !== 0 ? floor + 1 : floor);
}
/** ISO transcript seconds use the same binary64 precision as datetime.timestamp. */
export function timestamp(value: unknown): number | null {
    if (typeof value !== 'string')
        return null;
    let raw = trim(value);
    if (raw.endsWith('Z'))
        raw = raw.slice(0, -1) + '+00:00';
    const date = raw.match(/^(\d{4})(-?)(?:(\d{2})\2(\d{2})|W(\d{2})(?:\2([1-7]))?)/u);
    if (!date)
        return null;
    const year = Number(date[1]);
    if (year < 1)
        return null;
    const calendar = new Date(0);
    calendar.setUTCHours(0, 0, 0, 0);
    if (date[5] !== undefined) {
        const week = Number(date[5]), weekday = Number(date[6] ?? 1);
        if (week < 1 || week > 53)
            return null;
        calendar.setUTCFullYear(year, 0, 4);
        calendar.setUTCDate(calendar.getUTCDate() - (calendar.getUTCDay() + 6) % 7 + (week - 1) * 7 + weekday - 1);
        const thursday = new Date(calendar.getTime());
        thursday.setUTCDate(thursday.getUTCDate() + 4 - weekday);
        if (thursday.getUTCFullYear() !== year || calendar.getUTCFullYear() > 9999)
            return null;
    }
    else {
        const month = Number(date[3]), day = Number(date[4]);
        if (month < 1 || month > 12 || day < 1)
            return null;
        calendar.setUTCFullYear(year, month - 1, day);
        if (calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day)
            return null;
    }
    const tail = raw.slice(date[0].length);
    // fromisoformat accepts one arbitrary Unicode separator and compact times.
    const time = tail ? tail.slice([...tail][0]!.length).match(/^(\d{2})(?:(:?)(\d{2})(?:\2(\d{2}))?)?(?:[.,](\d+))?([+-].*)?$/u) : null;
    if (tail && !time || time?.[5] !== undefined && time[4] === undefined)
        return null;
    const hour = Number(time?.[1] ?? 0), minute = Number(time?.[3] ?? 0), second = Number(time?.[4] ?? 0), micro = BigInt((time?.[5] ?? '').slice(0, 6).padEnd(6, '0'));
    if (hour > 23 || minute > 59 || second > 59)
        return null;
    calendar.setUTCHours(hour, minute, second, 0);
    const zone = time?.[6];
    if (zone === undefined) {
        const local = new Date(0);
        local.setFullYear(calendar.getUTCFullYear(), calendar.getUTCMonth(), calendar.getUTCDate());
        local.setHours(hour, minute, second, 0);
        // Python's naive timestamp conversion probes the previous day for fold.
        if (year === 1 && calendar.getUTCMonth() === 0 && calendar.getUTCDate() === 1)
            return null;
        return local.getTime() / 1000 + Number(micro) / 1e6;
    }
    const offset = zone.match(/^([+-])(\d{2})(?:(:?)(\d{2})(?:\3(\d{2}))?)?(?:[.,](\d+))?$/u);
    if (!offset || offset[6] !== undefined && offset[5] === undefined)
        return null;
    const seconds = Number(offset[2]) * 3600 + Number(offset[4] ?? 0) * 60 + Number(offset[5] ?? 0);
    let micros = seconds === 0 ? 0n : BigInt(seconds) * 1000000n + BigInt((offset[6] ?? '').slice(0, 6).padEnd(6, '0'));
    if (micros >= 86400000000n)
        return null;
    if (offset[1] === '-')
        micros = -micros;
    return divideIntegers(BigInt(calendar.getTime()) * 1000n + micro - micros, 1000000n);
}
const LOCAL_PREFIXES = ['<command-name>', '<local-command-', '<bash-input>', '<bash-stdout>'];
export function localCommand(content: unknown): boolean {
    return typeof content === 'string' && LOCAL_PREFIXES.some(prefix => content.replace(new RegExp('^' + SPACE + '+', 'u'), '').startsWith(prefix));
}
export function realPrompt(record: Data, content: unknown): boolean {
    if (typeof content !== 'string' || truth(record.isMeta) || localCommand(content))
        return false;
    const origin = object(record.origin) ? record.origin.kind ?? null : null;
    return origin === 'human' || ['typed', 'queued', 'sdk'].includes(String(record.promptSource)) && (origin === null || origin === 'human');
}
export interface TurnEvents {
    prompt: Data | null;
    interrupt: Data | null;
    local_command: Data | null;
    assistant_activity: number | null;
    observations: Data[];
}
export function turnEvents(lines: readonly unknown[], promptContext: unknown = null): TurnEvents {
    const result: TurnEvents = { prompt: null, interrupt: null, local_command: null, assistant_activity: null, observations: [] };
    for (const row of lines) {
        if (!object(row))
            continue;
        const ts = timestamp(row.timestamp);
        if (row.type === 'assistant') {
            if (ts !== null) {
                if (result.assistant_activity === null || ts > result.assistant_activity)
                    result.assistant_activity = ts;
                result.observations.push({ kind: 'assistant', wall_ns: roundedInteger(ts * 1e9), prompt_id: truth(row.promptId) ? row.promptId : promptContext });
            }
            continue;
        }
        if (row.type === 'system' && row.subtype === 'stop_hook_summary') {
            if (ts !== null && row.preventedContinuation === false && Array.isArray(row.hookErrors) && !row.hookErrors.length && (row.hookAdditionalContext == null || Array.isArray(row.hookAdditionalContext) && !row.hookAdditionalContext.length) && !truth(row.stopReason))
                result.observations.push({ kind: 'confirmed_stop', wall_ns: roundedInteger(ts * 1e9), prompt_id: truth(row.promptId) ? row.promptId : promptContext });
            continue;
        }
        if (row.type === 'system' && row.subtype === 'turn_duration') {
            const duration = numeric(row.durationMs);
            if (ts !== null && duration !== null && Number.isFinite(duration) && duration >= 0 && duration <= 1e15)
                result.observations.push({ kind: 'turn_duration', wall_ns: roundedInteger(ts * 1e9), duration_ms: row.durationMs, prompt_id: truth(row.promptId) ? row.promptId : promptContext });
            continue;
        }
        if (row.type !== 'user' || !object(row.message) || row.message.role !== 'user')
            continue;
        const promptId = truth(row.promptId) ? string(row.promptId) : null;
        if (truth(row.interruptedMessageId) && ts !== null) {
            const candidate = { ts: float(ts), prompt_id: promptId };
            if (!result.interrupt || ts > numeric(result.interrupt.ts)!)
                result.interrupt = candidate;
            result.observations.push({ kind: 'interrupt', prompt_id: promptId, wall_ns: roundedInteger(ts * 1e9) });
        }
        const content = row.message.content;
        const notificationText = Array.isArray(content) ? content.filter(part => object(part) && part.type === 'text').map(part => {
            const value = (part as Data).text ?? (Object.hasOwn(part, 'text') ? null : '');
            if (typeof value !== 'string')
                throw new TypeError('Transcript text part must be a string');
            return value;
        }).join('\n') : content;
        const agentId = agentNotificationId(notificationText), notification = truth(row.isMeta) || object(row.origin) && row.origin.kind === 'task-notification';
        if (agentId && ts !== null && notification) {
            result.observations.push({ kind: 'agent_notification', agent_id: agentId, prompt_id: promptId, wall_ns: roundedInteger(ts * 1e9) });
            if (promptId)
                promptContext = promptId;
            continue;
        }
        if (ts === null || typeof content !== 'string')
            continue;
        const candidate = { ts: float(ts), prompt_id: promptId };
        if (localCommand(content)) {
            if (!result.local_command || ts > numeric(result.local_command.ts)!)
                result.local_command = candidate;
            result.observations.push({ kind: 'local_command', prompt_id: promptId, wall_ns: roundedInteger(ts * 1e9) });
        }
        else if (realPrompt(row, content)) {
            promptContext = promptId;
            if (!result.prompt || ts > numeric(result.prompt.ts)!)
                result.prompt = candidate;
            result.observations.push({ kind: 'prompt', prompt_id: promptId, wall_ns: roundedInteger(ts * 1e9) });
        }
    }
    return result;
}
export function updateTurnMetadata(entry: Data, lines: readonly unknown[], resetContext = false): Data[] {
    const result = turnEvents(lines, resetContext ? null : entry.transcript_prompt_id ?? null);
    for (const event of result.observations)
        if (event.kind === 'prompt')
            entry.transcript_prompt_id = event.prompt_id;
    if (result.prompt && numeric(result.prompt.ts)! > (numeric(entry.last_pt) ?? 0)) {
        entry.last_pt = result.prompt.ts;
        entry.last_prompt_id = result.prompt.prompt_id;
    }
    for (const [key, value] of [['last_interrupt', result.interrupt], ['last_local_command', result.local_command]] as const) {
        const old = entry[key];
        if (value && numeric(value.ts)! > (object(old) ? numeric(old.ts) ?? 0 : 0))
            entry[key] = value;
    }
    if (result.assistant_activity !== null && result.assistant_activity > (numeric(entry.last_assistant_ts) ?? 0))
        entry.last_assistant_ts = float(result.assistant_activity);
    return result.observations;
}
