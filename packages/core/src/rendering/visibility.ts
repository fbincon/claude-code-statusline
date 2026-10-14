import { object, int, truth } from '../runtime/values.js';
import { divideIntegers } from '../numbers.js';
import type { ItemOptionsDraft, Scope } from '../contracts/ui.js';
import * as metrics from './metrics.js';
export const RATE_WINDOWS: Readonly<Record<string, string>> = { 'five-hour-limit': 'five_hour', 'weekly-limit': 'seven_day', 'spend-limit': 'spend_limit' };
export function usedPercentage(data: unknown, item: string, now = 0, scope: Scope = 'main'): number | null {
    if (!object(data))
        return null;
    if (item === 'context-used' || item === 'context-remaining') {
        if (scope === 'subagent') {
            const count = metrics.tokenCount(data.tokenCount), capacity = metrics.tokenCount(data.contextWindowSize);
            if (count === null || capacity === null || capacity === 0n)
                return null;
            const value = divideIntegers(count, capacity) * 100;
            return Number.isFinite(value) ? value : null;
        }
        const context = data.context_window;
        if (!object(context))
            return null;
        const used = metrics.finiteNumber(context.used_percentage), remaining = metrics.finiteNumber(context.remaining_percentage);
        return used ?? (remaining !== null && remaining <= 100 ? 100 - remaining : null);
    }
    if (Object.hasOwn(RATE_WINDOWS, item)) {
        const window = metrics.liveRateWindow(data, RATE_WINDOWS[item]!, now);
        return window ? metrics.finiteNumber(window.used_percentage) : null;
    }
    return null;
}
export function visible(options: ItemOptionsDraft, item: string, used: number | null = null, git: unknown = null, point: unknown = null): boolean {
    if (options.visibility === 'always')
        return true;
    if (options.visibility === 'used-at-least')
        return used === null || used >= options.visibility_threshold;
    if (options.visibility === 'git-dirty') {
        if (!object(git) || git.kind !== 'ok')
            return true;
        const keys = ['staged', 'unstaged', 'conflicts', 'untracked'];
        if (item === 'git') {
            keys.push('ahead', 'behind');
            if (git.upstream_gone !== false)
                return true;
        }
        return !keys.every(key => int(git[key]) === 0n);
    }
    if (options.visibility === 'nonzero') {
        if (!object(point) || point.reason !== null || point.partial !== false)
            return true;
        const value = item === 'task-progress' ? object(point.value) ? point.value.total : null : point.value;
        return int(value) !== 0n;
    }
    return true;
}
