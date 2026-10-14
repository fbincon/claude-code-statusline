import { delta, trusted, type Sample } from './sample.js';
import { int, object, type Data } from '../runtime/values.js';
export function loadSample(value: unknown): Sample | null {
    if (!object(value))
        return null;
    const wall_ns = int(value.wall_ns);
    if (wall_ns === null)
        return null;
    return { wall_ns, boot_ns: int(value.boot_ns), boot_id: typeof value.boot_id === 'string' && value.boot_id ? value.boot_id : null };
}
export class StatusTimer {
    constructor(public readonly accumulated_ns: bigint, public readonly last_resume: Sample, public readonly waits: readonly string[] = [], public readonly frozen_ns: bigint | null = null, public readonly degraded = false) { }
    static start(now: Sample): StatusTimer { return new StatusTimer(0n, now); }
    static load(value: unknown): StatusTimer | null {
        if (!object(value))
            return null;
        const sample = loadSample(value.last_resume), elapsed = int(value.accumulated_ns), waits = value.waits ?? [], frozen = value.frozen_ns ?? null, degraded = value.degraded ?? false;
        const frozenInteger = int(frozen);
        if (!sample || elapsed === null || elapsed < 0n || !Array.isArray(waits) || waits.length > 256 || waits.some(item => typeof item !== 'string' || !item) || (frozen !== null && (frozenInteger === null || frozenInteger < 0n)) || typeof degraded !== 'boolean' || value.degraded === null || value.waits === null)
            return null;
        return new StatusTimer(elapsed, sample, [...new Set(waits)] as string[], frozenInteger, degraded);
    }
    toDict(): Data { return { accumulated_ns: this.accumulated_ns, last_resume: { ...this.last_resume }, waits: [...this.waits], frozen_ns: this.frozen_ns, degraded: this.degraded }; }
    elapsed(now: Sample): bigint | null {
        if (this.frozen_ns !== null)
            return this.frozen_ns;
        if (this.waits.length)
            return this.accumulated_ns;
        const current = delta(this.last_resume, now);
        return current === null ? null : this.accumulated_ns + current;
    }
    reset(now: Sample, elapsed = 0n): StatusTimer { return new StatusTimer(elapsed, now, this.waits, null, this.degraded); }
    pause(token: string, now: Sample): StatusTimer {
        if (this.frozen_ns !== null || this.waits.includes(token))
            return this;
        const elapsed = this.elapsed(now);
        if (elapsed === null || this.waits.length >= 256)
            return new StatusTimer(this.accumulated_ns, this.last_resume, this.waits, this.frozen_ns, true);
        return new StatusTimer(elapsed, now, [...this.waits, token], null, this.degraded || !trusted(this.last_resume, now));
    }
    resume(token: string, now: Sample): StatusTimer {
        if (this.frozen_ns !== null || !this.waits.includes(token))
            return this;
        return new StatusTimer(this.accumulated_ns, now, this.waits.filter(item => item !== token), null, this.degraded || !trusted(this.last_resume, now));
    }
    trustedSample(now: Sample): boolean { return trusted(this.last_resume, now); }
    reopen(): StatusTimer { return new StatusTimer(this.accumulated_ns, this.last_resume, this.waits, null, this.degraded); }
    finish(now: Sample): StatusTimer {
        if (this.frozen_ns !== null)
            return this;
        return new StatusTimer(this.accumulated_ns, this.last_resume, this.waits, this.elapsed(now), this.degraded || !trusted(this.last_resume, now));
    }
}
export function taskElapsed(record: Data, now: Sample): bigint | null {
    const duration = int(record.duration_ns);
    if (record.status !== 'running' && duration !== null)
        return duration;
    if (record.phase === 'stop_pending' && object(record.stop_candidate))
        return int(record.stop_candidate.duration_ns);
    const start = loadSample({ wall_ns: record.started_wall_ns, boot_ns: record.started_boot_ns, boot_id: record.boot_id });
    const end = record.status === 'running' ? now : loadSample({ wall_ns: record.ended_wall_ns, boot_ns: record.ended_boot_ns, boot_id: record.boot_id });
    return start && end ? delta(start, end) : null;
}
