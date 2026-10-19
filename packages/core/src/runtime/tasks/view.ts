import type { Sample } from '../../timing/sample.js';
import { StatusTimer } from '../../timing/timer.js';
import { float } from '../transcript.js';
import { int, truth, type Data } from '../values.js';
import type { Turn } from './model.js';
export function activePoint(record: Turn | null, enabled: boolean, fresh: boolean, capture: () => Sample): Data {
    const result: Data = { value: null, reason: 'not_observed', source: 'native_task_timing', partial: false, observed_at_ms: null };
    if (!enabled)
        return { ...result, reason: 'native_timing_disabled' };
    if (!record)
        return result;
    if (record.historical_frozen)
        return { ...result, reason: 'incomplete' };
    const reason = truth(record.active_coverage) ? record.active_coverage : 'not_observed';
    if (reason !== 'complete')
        return { ...result, reason };
    if (Object.values(record.native_turns).some(turn => turn.start_observed !== true))
        return { ...result, reason: 'incomplete' };
    if (record.status === 'running' && !fresh)
        return { ...result, reason: 'stale' };
    const timer = StatusTimer.load(record.active_clock);
    if (!timer || record.status !== 'running' && (timer.frozen_ns === null || timer.waits.length))
        return { ...result, reason: 'incomplete' };
    if (timer.degraded || timer.last_resume.boot_id === null || timer.last_resume.boot_ns === null)
        return { ...result, reason: 'abnormal_clock' };
    const now = capture();
    if (timer.frozen_ns === null && !timer.trustedSample(now))
        return { ...result, reason: 'abnormal_clock' };
    const value = timer.elapsed(now);
    return { ...result, value: value === null ? null : float(Number(value) / 1e9), reason: value === null ? 'abnormal_clock' : null, observed_at_ms: float(Number(int(record.updated_wall_ns) ?? 0n) / 1e6) };
}
