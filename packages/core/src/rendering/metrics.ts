import { int, numeric, object, string } from '../runtime/values.js';
import { DEFAULT_FORMATTING } from '../config/defaults.js';
import type { FormattingDraft } from '../contracts/ui.js';
import * as formatters from './formatters.js';
import * as preferences from './preferences.js';
import { general } from './numeric-format.js';
import type { Presentation } from './language.js';
export function finiteNumber(value: unknown): number | null { const number = numeric(value); return number !== null && Number.isFinite(number) && number >= 0 ? number : null; }
export function tokenCount(value: unknown): bigint | null { const n = int(value); return n !== null && finiteNumber(value) !== null ? n : null; }
export function tokenRatio(used: unknown, capacity: unknown, language: Presentation, fmt: FormattingDraft = DEFAULT_FORMATTING): string | null {
    const count = tokenCount(used), window = tokenCount(capacity);
    return count === null || window === null || window === 0n ? null : language.text('context.tokens', { count: preferences.number(count, fmt), window: preferences.number(window, fmt) });
}
export function contextTokens(context: unknown, language: Presentation, fmt: FormattingDraft = DEFAULT_FORMATTING): string | null {
    if (!object(context))
        return null;
    let count: bigint | null;
    if (Object.hasOwn(context, 'current_usage')) {
        const usage = context.current_usage;
        if (!object(usage))
            return null;
        const parts = ['input_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens'].map(field => tokenCount(usage[field]));
        if (parts.some(v => v === null))
            return null;
        count = parts.reduce<bigint>((n, v) => n + v!, 0n);
    }
    else
        count = tokenCount(context.total_input_tokens);
    return tokenRatio(count, context.context_window_size, language, fmt);
}
export function modelName(data: unknown): string | null { return formatters.sanitizePayloadText(formatters.deepGet(data, ['model', 'id'])) || formatters.sanitizePayloadText(formatters.deepGet(data, ['model', 'display_name'])); }
export function effortText(value: unknown): string | null { if (typeof value === 'string')
    return formatters.sanitizePayloadText(value); const number = finiteNumber(value); return number === null ? null : int(value) === null ? general(number) : string(value); }
export function liveRateWindow(data: unknown, field: string, now: number): Record<string, unknown> | null {
    const window = formatters.deepGet(data, ['rate_limits', field]);
    if (!object(window))
        return null;
    if (Object.hasOwn(window, 'resets_at')) {
        const reset = finiteNumber(window.resets_at);
        if (reset === null || reset <= now)
            return null;
    }
    return window;
}
export function countdown(value: unknown, now: number): string | null {
    const expires = finiteNumber(value);
    if (expires === null || expires <= now)
        return null;
    const seconds = BigInt(Math.ceil(expires - now));
    return seconds >= 86400n ? `${seconds / 86400n}d ${seconds % 86400n / 3600n}h` : seconds >= 3600n ? `${seconds / 3600n}h ${seconds % 3600n / 60n}m` : seconds >= 60n ? `${seconds / 60n}m ${seconds % 60n}s` : `${seconds}s`;
}
export function sessionMetric(cost: unknown, item: string, fmt: FormattingDraft, language: Presentation): string | null {
    if (!object(cost))
        return null;
    if (item === 'lines-changed') {
        const added = tokenCount(cost.total_lines_added), removed = tokenCount(cost.total_lines_removed);
        return added === null || removed === null ? null : `+${preferences.number(added, fmt, string)}/-${preferences.number(removed, fmt, string)}`;
    }
    const fields: Record<string, string> = { 'session-cost': 'total_cost_usd', 'session-duration': 'total_duration_ms', 'api-duration': 'total_api_duration_ms' }, number = finiteNumber(cost[fields[item]!]);
    if (number === null)
        return null;
    return item === 'session-cost' ? language.text('cost.session', { value: preferences.money(number, fmt) }) : language.text(item === 'session-duration' ? 'duration.session' : 'duration.api', { value: formatters.formatDuration(number / 1000) });
}
export function cacheMetric(cache: unknown, item: string, now: number, fmt: FormattingDraft, language: Presentation): string | null {
    if (!object(cache))
        return null;
    if (item === 'cache-misses' || item === 'api-requests') {
        const count = tokenCount(cache[item === 'cache-misses' ? 'misses' : 'requests']);
        return count === null ? null : language.text(item === 'cache-misses' ? 'cache.misses' : 'api.requests', { value: preferences.number(count, fmt, string) });
    }
    if (cache.caching_observed === false)
        return item === 'cache-state' ? language.text('cache.unobserved') : null;
    if (cache.warm === false)
        return item === 'cache-state' ? language.text('cache.cold') : null;
    if (cache.warm !== true)
        return null;
    const expires = finiteNumber(cache.expires_at);
    if (expires === null)
        return null;
    const remaining = countdown(expires, now);
    return item === 'cache-state' ? language.text(remaining ? 'cache.warm' : 'cache.cold') : remaining ? language.text('cache.ttl', { value: remaining }) : null;
}
export function spendMetric(window: unknown, item: string, fmt: FormattingDraft, language: Presentation): string | null {
    if (!object(window))
        return null;
    if (item === 'spend-period')
        return typeof window.period === 'string' && ['daily', 'weekly', 'monthly'].includes(window.period) ? language.text('spend.period', { value: language.value('period', window.period) }) : null;
    const used = finiteNumber(window.used_usd), limit = finiteNumber(window.limit_usd);
    return used === null || limit === null ? null : language.text('spend.amount', { used: preferences.money(used, fmt), limit: preferences.money(limit, fmt) });
}

/** A derived hourly estimate, with no pricing assumptions or additional observations. */
export function costRateValue(cost: unknown, basis: 'session' | 'api'): number | null {
    if (!object(cost)) return null;
    const usd = finiteNumber(cost.total_cost_usd), duration = finiteNumber(cost[basis === 'api' ? 'total_api_duration_ms' : 'total_duration_ms']);
    if (usd === null || duration === null || duration < 60000) return null;
    const rate = usd * (3600000 / duration);
    return Number.isFinite(rate) ? rate : null;
}
export function costRate(cost: unknown, basis: 'session' | 'api', fmt: FormattingDraft, language: Presentation): string | null {
    const rate = costRateValue(cost, basis);
    return rate === null ? null : language.text('cost.rate_' + basis, { value: preferences.money(rate, fmt) });
}
