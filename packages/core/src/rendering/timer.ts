import { taskElapsed } from '../timing/timer.js';
import type { Sample } from '../timing/sample.js';
import { numeric, object, type Data } from '../runtime/values.js';
import { divideIntegers } from '../numbers.js';
import { coercedFloat } from './coercion.js';
export type Translate = (key: string, params?: Record<string, unknown>) => string;
export function formatDuration(seconds: unknown, nearest = false): string | null {
    const number = coercedFloat(seconds);
    if (number === null || !Number.isFinite(number))
        return null;
    const total = BigInt(Math.max(0, Math.trunc(nearest && number >= 0 ? number + 0.5 : number)));
    const minutes = total % 3600n / 60n, remainder = String(total % 60n).padStart(2, '0');
    return total >= 3600n ? `${total / 3600n}h ${String(minutes).padStart(2, '0')}m ${remainder}s` : `${total / 60n}m ${remainder}s`;
}
export function renderTaskTimer(state: Data | null, sample: Sample, translate: Translate, palette = { timer: '\x1b[1;38;2;142;211;211m', reset: '\x1b[0m' }): string | null {
    if (!state || ['ignored', 'withdrawn'].includes(String(state.status)))
        return null;
    const elapsed = taskElapsed(state, sample), formatted = formatDuration(elapsed === null ? null : divideIntegers(elapsed, 1000000000n), state.status !== 'running');
    if (!formatted)
        return null;
    if (state.status === 'running') {
        if (state.phase === 'stop_pending')
            return `${palette.timer}? ${formatted}+${palette.reset}`;
        if (state.phase === 'waiting_subagents') {
            const count = object(state.active_agents) ? Object.keys(state.active_agents).length : 0;
            return `${palette.timer}⏳ ${translate('statusline.timer.waiting.' + (count === 1 ? 'one' : 'many'), { count })} · ${formatted}${palette.reset}`;
        }
        if (state.phase === 'resuming_main')
            return `${palette.timer}⏳ ${translate('statusline.timer.wrap_up')} · ${formatted}${palette.reset}`;
    }
    const markers: Record<string, string> = { running: '⏱', completed: '✓', interrupted: '■', failed: '✗', unknown: '?' };
    const marker = Object.hasOwn(markers, String(state.status)) ? markers[String(state.status)] : '?';
    return `${palette.timer}${marker} ${formatted}${state.status === 'unknown' ? '+' : ''}${palette.reset}`;
}
