import type { DisplayDraft } from '../contracts/ui.js';
import { int, numeric, object, own, type Data } from '../runtime/values.js';
import { divideIntegers } from '../numbers.js';
import type { RenderEnvironment } from './context.js';
import * as formatters from './formatters.js';
import * as metrics from './metrics.js';
import * as preferences from './preferences.js';
import * as appearance from './appearance.js';
import * as visibility from './visibility.js';
import * as powerline from './powerline.js';
import { literal, fitRow, type Cell } from './components.js';
import { RESET } from './styles.js';
import { trim } from '../runtime/transcript.js';
export const DEFAULT_COLUMNS = 80;
const ICONS = new Map([['pending', '…'], ['running', '⏱'], ['completed', '✓'], ['failed', '✗'], ['killed', '■'], ['paused', '⏳'], ['waiting', '⏳']]);
const DROP = ['current-dir', 'tokens', 'context-window-size', 'context-tokens', 'context-used', 'context-remaining', 'model-with-effort', 'effort', 'model', 'task'];
type Palette = Record<'status' | 'name' | 'model' | 'context' | 'elapsed' | 'task' | 'tokens' | 'directory' | 'separator' | 'reset', string>;
const DEFAULT: Palette = { status: '\x1b[1;38;2;142;211;211m', name: '\x1b[1;38;2;246;226;183m', model: '\x1b[1;38;2;246;226;183m', context: '\x1b[1;38;2;242;181;144m', elapsed: '\x1b[1;38;2;142;211;211m', task: '\x1b[1;38;2;171;223;167m', tokens: '\x1b[1;38;2;233;144;169m', directory: '\x1b[1;38;2;171;223;167m', separator: '\x1b[90m', reset: RESET };
const ANSI: Palette = { status: '\x1b[1;36m', name: '\x1b[1;33m', model: '\x1b[1;33m', context: '\x1b[1;33m', elapsed: '\x1b[1;36m', task: '\x1b[1;32m', tokens: '\x1b[1;35m', directory: '\x1b[1;32m', separator: '\x1b[90m', reset: RESET };
const EMPTY = Object.fromEntries(Object.keys(DEFAULT).map(key => [key, ''])) as Palette;
interface Part {
    item: string;
    text: string;
    style: string;
    used: number | null;
    type: string;
}
function paletteFor(config: DisplayDraft): Palette { return !config.use_colors ? EMPTY : appearance.themedPalette(config.palette === 'ansi' ? ANSI : DEFAULT, config, true); }
function finite(value: unknown): number | null { const n = numeric(value); return n !== null && Number.isFinite(n) ? n : null; }
/** Default Unicode caseless matching; dotted/dotless I and Cherokee retain UCD rules. */
export function caseFold(text: string): string {
    if (/^[\x00-\x7f]*$/u.test(text))
        return text.toLowerCase();
    return [...text].map(char => {
        const code = char.codePointAt(0)!;
        // Python 3.14 uses UCD 16; Node 24's newer casing adds these UCD 17 capitals.
        if ([0x131, 0xa7ce, 0xa7d2, 0xa7d4].includes(code) || code >= 0x16ea0 && code <= 0x16eb8)
            return char;
        return code >= 0x13a0 && code <= 0x13ff || code >= 0xab70 && code <= 0xabbf ? char.toUpperCase() : char.toLowerCase().toUpperCase().toLowerCase();
    }).join('');
}
export function upperFirst(text: string): string {
    const chars = [...text];
    if (!chars.length)
        return '';
    const code = chars[0]!.codePointAt(0)!;
    const unchanged = [0xa7cf, 0xa7d3, 0xa7d5].includes(code) || code >= 0x16ebb && code <= 0x16ed3;
    return (unchanged ? chars[0]! : chars[0]!.toUpperCase()) + chars.slice(1).join('');
}
function model(task: Data): string | null { const value = formatters.sanitizePayloadText(task.model); return value?.replace(/^claude-/u, '') || null; }
function elapsed(task: Data, now: number): string | null {
    if (!['pending', 'running', 'waiting', 'paused'].includes(task.status as string)) {
        const duration = finite(task._frozen_duration_ms);
        return duration !== null && duration >= 0 ? formatters.formatDuration(duration / 1000) : null;
    }
    const start = finite(task.startTime);
    return start === null ? null : formatters.formatDuration(Math.max(0, (now - start) / 1000));
}
function context(task: Data, remaining: boolean, env: RenderEnvironment): string | null {
    const count = finite(task.tokenCount), window = finite(task.contextWindowSize);
    if (count === null || count < 0 || window === null || window <= 0)
        return null;
    const ratio = count * 100 / window;
    if (!Number.isFinite(ratio))
        return null;
    const used = BigInt(Math.trunc(ratio + 0.5)), left = 100n - used;
    return env.language.text(remaining ? 'context.remaining' : 'context.used', { percentage: remaining ? left < 0n ? 0n : left > 100n ? 100n : left : used });
}
function partsFor(task: Data, config: DisplayDraft, now: number, env: RenderEnvironment): Part[] {
    const p = paletteFor(config), language = env.language, text = (key: string, params: Data) => language.text(key, params);
    const type = formatters.sanitizePayloadText(task.type)?.replace(/[_-]+/gu, ' ').split(/\s+/u).filter(Boolean).map(upperFirst).join(' ');
    const name = formatters.sanitizePayloadText(task.name) || type || language.text('agent.fallback');
    const modelName = model(task), effort = language.value('effort', metrics.effortText(task.effort)) as string | null;
    const status = ICONS.get(caseFold(formatters.sanitizePayloadText(task.status) ?? '')) ?? '?', duration = elapsed(task, now);
    const tokens = formatters.humanizeTokens(task.tokenCount), label = formatters.sanitizePayloadText(task.label) || formatters.sanitizePayloadText(task.description), cwd = formatters.sanitizePayloadText(task.cwd);
    const capacity = metrics.tokenCount(task.contextWindowSize);
    const values: Record<string, readonly [
        string | null,
        string
    ]> = {
        status: [status, p.status], 'status-elapsed': [status + (duration ? ' ' + duration : ''), p.elapsed], name: [name, p.name],
        'model-with-effort': [modelName ? modelName + (effort ? '/' + effort : '') : null, p.model], model: [modelName, p.model], effort: [effort, p.model],
        'context-tokens': [metrics.tokenRatio(task.tokenCount, task.contextWindowSize, language), p.context],
        'context-window-size': [capacity !== null && capacity !== 0n ? text('context.window', { value: formatters.humanizeTokens(task.contextWindowSize) }) : null, p.context],
        'context-remaining': [context(task, true, env), p.context], 'context-used': [context(task, false, env), p.context], elapsed: [duration, p.elapsed],
        task: [label && caseFold(label) !== caseFold(name) ? label : null, p.task], tokens: [tokens !== null ? text('tokens.count', { value: tokens }) : null, p.tokens],
        'current-dir': [cwd ? env.directory(cwd, config.directory_style) : null, p.directory],
    };
    const result: Part[] = [];
    for (const node of config.subagents.instances) {
        if (!node.enabled)
            continue;
        const item = node.type_id;
        if (item === 'spacer') {
            result.push({ item: node.id, text: '', style: '', used: null, type: item });
            continue;
        }
        if (item === 'text') {
            const value = literal(node, config, 'subagent');
            if (value)
                result.push({ item: node.id, text: value, style: '', used: null, type: item });
            continue;
        }
        let [value, style] = values[item]!;
        const [fmt, options] = preferences.optionsFor(config, node.id, 'subagent');
        if (item === 'model' || item === 'model-with-effort') {
            const model = preferences.modelName(modelName, fmt);
            value = item === 'model-with-effort' && model && effort ? model + '/' + effort : model;
        }
        else if (item === 'tokens' && fmt.number_format !== 'legacy')
            value = preferences.number(metrics.tokenCount(task.tokenCount), fmt);
        else if (item === 'context-tokens')
            value = metrics.tokenRatio(task.tokenCount, task.contextWindowSize, language, fmt);
        else if (item === 'context-window-size' && fmt.number_format !== 'legacy') {
            const number = preferences.number(task.contextWindowSize, fmt);
            value = number ? text('context.window', { value: number }) : null;
        }
        if (!value)
            continue;
        let risk: number | null = null;
        if (options.visibility !== 'always') {
            risk = visibility.usedPercentage(task, item, 0, 'subagent');
            if (!visibility.visible(options, item, risk))
                continue;
        }
        value = preferences.decorate(value, item, 'subagent', fmt, options, language);
        let maximum = options.max_width;
        if (item === 'task' && config.subagents.task_max_width !== null)
            maximum = maximum ? Math.min(maximum, config.subagents.task_max_width) : config.subagents.task_max_width;
        if (maximum !== null)
            value = formatters.truncateText(value, maximum);
        if (item === 'context-used' || item === 'context-remaining') {
            const count = metrics.tokenCount(task.tokenCount), capacity = metrics.tokenCount(task.contextWindowSize);
            risk = count !== null && capacity ? divideIntegers(count, capacity) * 100 : null;
            const styled = preferences.threshold(style + value, risk, fmt, config, p.context);
            if (value)
                style = styled.slice(0, -value.length);
        }
        result.push({ item: node.id, text: value, style, used: risk, type: item });
    }
    return result;
}
function plain(parts: readonly Part[]): string { return parts.map((part, i) => (i ? parts[i - 1]!.item === 'status' && part.item === 'name' ? ' ' : ' · ' : '') + part.text).join(''); }
function fit(parts: Part[], columns: number): Part[] {
    const width = () => formatters.displayWidth(plain(parts)), remove = (item: string) => { parts = parts.filter(part => part.item !== item); };
    const shorten = (item: string) => { const part = parts.find(p => p.item === item); if (!part)
        return; const text = formatters.truncateText(part.text, Math.max(0, formatters.displayWidth(part.text) - (width() - columns))); parts = text ? parts.map(p => p.item === item ? { ...p, text } : p) : parts.filter(p => p.item !== item); };
    if (width() <= columns)
        return parts;
    shorten('task');
    for (const item of DROP) {
        if (width() <= columns)
            break;
        remove(item);
    }
    if (width() > columns)
        shorten('name');
    if (parts.some(p => ['status', 'status-elapsed'].includes(p.item)))
        for (const item of ['name', 'elapsed']) {
            if (width() <= columns)
                break;
            remove(item);
        }
    while (parts.length > 1 && width() > columns)
        remove([...parts].reverse().find(p => !['status', 'status-elapsed'].includes(p.item))?.item ?? parts.at(-1)!.item);
    if (parts.length && width() > columns) {
        const text = formatters.truncateText(parts[0]!.text, columns, '');
        parts = text ? [{ ...parts[0]!, text }] : [];
    }
    return parts;
}
export function renderTask(task: Data, config: DisplayDraft, env: RenderEnvironment, columns = DEFAULT_COLUMNS, nowMs = env.now() * 1000): string {
    if (!config.subagents.enabled || !config.subagents.instances.some(node => node.enabled))
        return '';
    let parts = partsFor(task, config, nowMs, env);
    const p = paletteFor(config), separator = p.separator ? p.separator + ' · ' + p.reset : ' · ';
    const styled = (part: Part) => part.style + part.text + (part.style ? p.reset : '');
    if (parts.some(part => part.item !== part.type || part.type === 'text' || part.type === 'spacer')) {
        const nodes = new Map(config.subagents.instances.map(node => [node.id, node]));
        const cells: Cell<Part>[] = parts.map(part => { const node = nodes.get(part.item)!; return { id: node.id, text: ['text', 'spacer'].includes(node.type_id) ? styled(part) : appearance.apply(styled(part), config, node.type_id, node.options, 'subagent', part.used), priority: node.options.priority, spacer: node.type_id === 'spacer', payload: part }; });
        return fitRow(cells, columns, config, side => side.map((cell, i) => (i ? side[i - 1]!.payload!.type === 'status' && cell.payload!.type === 'name' ? ' ' : separator : '') + cell.text).join(''));
    }
    if (config.separator_style === 'powerline')
        return powerline.fit(parts.map(part => { const options = preferences.optionsFor(config, part.item, 'subagent')[1]; return { text: appearance.apply(styled(part), config, part.type, options, 'subagent', part.used), priority: options.priority }; }), columns, config);
    if (preferences.legacyFitting(config.subagents.instances.map(node => node.options)))
        while (parts.length > 1 && formatters.displayWidth(plain(parts)) > columns) {
            const priority = (i: number) => preferences.optionsFor(config, parts[i]!.item, 'subagent')[1].priority;
            let victim = 0;
            for (let i = 1; i < parts.length; i++)
                if (priority(i) <= priority(victim))
                    victim = i;
            parts.splice(victim, 1);
        }
    parts = fit(parts, columns);
    const content = parts.map((part, i) => {
        const options = preferences.optionsFor(config, part.item, 'subagent')[1];
        const value = config.theme !== 'classic' || options.foreground !== null || options.background !== null ? appearance.apply(styled(part), config, part.type, options, 'subagent', part.used) : styled(part);
        return (i ? parts[i - 1]!.item === 'status' && part.item === 'name' ? ' ' : separator : '') + value;
    }).join('');
    return formatters.displayWidth(content) > columns ? formatters.truncateText(plain(parts), columns) : content;
}
export function renderPayload(data: unknown, config: DisplayDraft, env: RenderEnvironment, nowMs?: number): {
    id: string;
    content: string;
}[] {
    if (!object(data) || !Array.isArray(data.tasks))
        return [];
    const width = int(data.columns), columns = width !== null && width > 0n ? Number(width) : DEFAULT_COLUMNS, seen = new Set<string>(), result = [];
    let visible = 0, endings: Data | null = null;
    for (let task of data.tasks) {
        if (!object(task) || typeof task.id !== 'string' || !trim(task.id) || seen.has(task.id))
            continue;
        const id = task.id;
        seen.add(id);
        const hidden = config.subagents.visibility === 'running' && task.status !== 'running' || config.subagents.hide_completed && task.status === 'completed' || config.subagents.row_limit !== null && visible >= config.subagents.row_limit;
        let content = '';
        try {
            if (['completed', 'failed', 'killed', 'interrupted'].includes(task.status as string) && !Object.hasOwn(task, '_frozen_duration_ms') && typeof data.session_id === 'string' && data.session_id) {
                endings ??= env.agentEndings(data.session_id);
                const end = numeric(own(endings, id)), start = finite(task.startTime);
                if (end !== null && start !== null && start >= 0 && start <= end)
                    task = { ...task, _frozen_duration_ms: end - start };
            }
            if (!hidden)
                content = renderTask(task, config, env, columns, nowMs);
        }
        catch { /* A malformed task must not break the remaining NDJSON records. */ }
        if (content)
            visible++;
        result.push({ id, content });
    }
    return result;
}
export function previewRows(config: DisplayDraft, columns: number, env: RenderEnvironment): string[] {
    const now = 1788400120000;
    return renderPayload({ columns, tasks: [
            { id: 'preview-running', name: 'Explore', type: 'local_agent', status: 'running', label: 'searching auth flow', startTime: now - 78000, model: 'claude-sonnet-5', effort: 'high', contextWindowSize: 200000, tokenCount: 84000, cwd: '/project/src' },
            { id: 'preview-completed', name: 'Reviewer', type: 'local_agent', status: 'completed', description: 'reviewed lifecycle tests', startTime: now - 42000, _frozen_duration_ms: 42000, model: 'claude-haiku-4-5', contextWindowSize: 200000, tokenCount: 18500, cwd: '/project/tests' },
        ] }, config, env, now).map(item => item.content).filter(Boolean);
}
