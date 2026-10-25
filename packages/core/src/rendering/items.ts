import { foregroundPaint, segmentPaint, type Paint, type PaintedPart } from './gradients.js';
import { alignedRows } from './alignment.js';
import { groupedRows, SCOPE_LABEL_ID } from './groups.js';
import { indicator } from './indicators.js';
import { externalPresentation } from './extensions.js';
import { fileLink, safeLink } from '../terminal/links.js';
import type { DisplayDraft, FormattingDraft, InstanceDraft } from '../contracts/ui.js';
import { int, numeric, truth, string, object, own, type Data } from '../runtime/values.js';
import { roundedInteger } from '../runtime/transcript.js';
import type { RenderEnvironment, UsageObservation, TaskObservation } from './context.js';
import type { Palette } from './palette.js';
import { paletteFor, separators } from './palette.js';
import { deepGet, sanitizePayloadText, formatDuration, humanizeApiTokens } from './formatters.js';
import { renderTaskTimer } from './timer.js';
import * as metrics from './metrics.js';
import { worktreeEvidence, cacheMissText } from './host-fields.js';
import * as preferences from './preferences.js';
import * as visibility from './visibility.js';
import * as git from './git.js';
import * as live from './live.js';
import * as appearance from './appearance.js';
import * as layout from './layout.js';
import * as powerline from './powerline.js';
import { literal, fitRow, type Cell } from './components.js';
import { DEFAULT_ITEM } from '../config/defaults.js';
import { coercedFloat } from './coercion.js';
export interface RenderedItem {
    paint?: Paint;
    text: string;
    group?: string | null;
    prefer_slash_breaks?: boolean;
}
const RATE_LIMIT_ITEMS: Record<string, readonly [
    string,
    string
]> = { 'five-hour-limit': ['five_hour', '5h'], 'weekly-limit': ['seven_day', 'weekly'], 'spend-limit': ['spend_limit', 'spend'] };
const RESET_ITEMS: Record<string, readonly [
    string,
    string
]> = { 'five-hour-reset': ['five_hour', '5h'], 'weekly-reset': ['seven_day', 'weekly'] };
const LIVE_ITEMS = new Set(['run-state', 'permission-mode', 'active-agents', 'task-progress', 'last-tool', 'ttft', 'output-rate', 'prompt-input-tokens', 'prompt-output-tokens', 'prompt-cost']);
const SESSION_ITEMS = new Set(['session-cost', 'session-duration', 'api-duration', 'lines-changed']);
const CACHE_ITEMS = new Set(['cache-state', 'cache-expires', 'cache-misses', 'api-requests']);
const GIT_ITEMS = new Set(['git-branch', 'git-changes', 'git-ahead-behind']);
const SPEND_ITEMS = new Set(['spend-amount', 'spend-period']);
export function liveDirectory(data: unknown): string | null {
    for (const path of [['workspace', 'current_dir'], ['cwd'], ['worktree', 'path'], ['workspace', 'project_dir']]) {
        const value = deepGet(data, path);
        if (typeof value === 'string' && value)
            return value;
    }
    return null;
}
export function enabledIds(config: DisplayDraft): string[] { return config.instances.filter(node => node.enabled).map(node => node.id); }
export class RenderState {
    readonly data: Data;
    readonly liveDir: string | null;
    readonly instances: Map<string, InstanceDraft>;
    fmt: FormattingDraft;
    private gitValue: Data | null | undefined;
    private usageValue: UsageObservation | null | undefined;
    private liveValue: Data | undefined;
    private timeValue: number | undefined;
    private branchValue: Data | undefined;
    private activeValue: Data | undefined;
    private taskValue: TaskObservation | undefined;
    constructor(data: unknown, readonly config: DisplayDraft, readonly palette: Palette, readonly inner: string, readonly env: RenderEnvironment) {
        this.data = object(data) ? data : {};
        this.liveDir = liveDirectory(data);
        this.instances = new Map(config.instances.map(node => [node.id, node]));
        this.fmt = config.formatting;
    }
    text(key: string, params: Data = {}): string { return this.env.language.text(key, params); }
    now(): number { return this.timeValue ??= this.env.now(); }
    styled(text: string | null | undefined, style: string, group: string | null = null): RenderedItem | null { return text ? { text: style + text + this.palette.reset, group } : null; }
    liveData(): Data { return this.liveValue ??= this.env.live(this.data, this.now() * 1000); }
    branchData(): Data { return this.branchValue ??= this.env.branchDiff(this.liveDir, this.config.metrics.branch_diff_base_ref); }
    totals(): UsageObservation | null { if (this.usageValue === undefined)
        this.usageValue = this.env.usage(this.data); return this.usageValue; }
    rawTotals() { return this.totals()?.counts ?? null; }
    hadSubagents(): boolean { return this.env.hadSubagents(this.data); }
    gitData(): Data | null { if (!this.liveDir)
        return null; if (this.gitValue === undefined)
        this.gitValue = this.env.git(this.liveDir, this.data.session_id ?? null); return this.gitValue; }
    git(): RenderedItem | null { const result = this.gitData(), text = result ? git.segment(result, this.palette, this.env.language, this.env.compactStaged) : null; return text ? { text, group: 'repo' } : null; }
    hostname(): RenderedItem | null { const name = sanitizePayloadText(this.env.hostname()); return this.styled(name ? this.text('host', { value: name }) : null, this.palette.directory, 'location'); }
    promptTimer(): RenderedItem | null {
        const totals = this.totals();
        const observation = this.taskValue ??= this.env.taskSnapshot ?? (totals ? this.env.task(this.data, totals) : undefined);
        if (!observation) return null;
        const text = renderTaskTimer(observation.state, observation.sample, (key, params) => this.text(key.replace(/^statusline\./u, ''), params), this.palette);
        return text ? { text } : null;
    }
    activeTimer(): RenderedItem | null {
        this.totals();
        const point = this.activeValue ??= this.env.activePoint(this.data);
        if (point.value == null)
            return null;
        return this.styled(this.text('active', { value: formatDuration(point.value) }), this.palette.timer);
    }
    private rateLimit(field: string, label: string): RenderedItem | null {
        const window = metrics.liveRateWindow(this.data, field, this.now());
        if (!window)
            return null;
        const used = window.used_percentage, integer = int(used), number = numeric(used);
        if (number === null || (integer === null && !Number.isFinite(number)) || number < 0)
            return null;
        const left = integer !== null ? integer >= 100n ? 0n : 100n - integer : number >= 100 ? 0n : roundedInteger(100 - number), value = this.fmt.allowance === 'used' ? integer ?? roundedInteger(number) : left;
        const names: Record<string, string> = { '5h': 'five_hour', weekly: 'weekly', spend: 'spend' };
        const phrase = this.text(this.fmt.allowance === 'used' ? 'limit.used' : 'limit.remaining', { label: names[label] ? this.text('limit.' + names[label]) : label, value });
        return this.styled(phrase, this.palette.percentage, 'limits');
    }
    private renderType(item: string): RenderedItem | null {
        const { palette: p, data, fmt, env } = this;
        if (LIVE_ITEMS.has(item))
            return this.styled(live.metric(this.liveData(), item, fmt, env.language), p.percentage, 'activity');
        if (SESSION_ITEMS.has(item))
            return this.styled(metrics.sessionMetric(data.cost, item, fmt, env.language), p.percentage, 'usage');
        if (CACHE_ITEMS.has(item))
            return this.styled(metrics.cacheMetric(data.prompt_cache, item, this.now(), fmt, env.language), p.tokens, 'usage');
        if (SPEND_ITEMS.has(item))
            return this.styled(metrics.spendMetric(metrics.liveRateWindow(data, 'spend_limit', this.now()), item, fmt, env.language), p.percentage, 'limits');
        if (GIT_ITEMS.has(item)) {
            const result = this.gitData();
            return this.styled(git.component(result, item, env.language, env.compactStaged), result?.kind === 'error' ? p.git_error : p.branch, 'repo');
        }
        if (Object.hasOwn(RATE_LIMIT_ITEMS, item))
            return this.rateLimit(...RATE_LIMIT_ITEMS[item]!);
        if (Object.hasOwn(RESET_ITEMS, item)) {
            const [field, label] = RESET_ITEMS[item]!, window = metrics.liveRateWindow(data, field, this.now());
            const value = window ? preferences.resetTime(window.resets_at, this.now(), fmt, metrics.countdown, env.formatDate) : null;
            return this.styled(value ? this.text('reset', { label: this.text(label === '5h' ? 'limit.five_hour' : 'limit.weekly'), value }) : null, p.percentage, 'limits');
        }
        if (item === 'model' || item === 'model-with-effort') {
            const model = preferences.modelName(metrics.modelName(data), fmt);
            if (!model)
                return null;
            const effort = item === 'model-with-effort' ? sanitizePayloadText(deepGet(data, ['effort', 'level'])) : null;
            return this.styled(model + (effort ? ' ' + string(env.language.value('effort', effort)) : ''), p.model, 'model');
        }
        if (item === 'effort')
            return this.styled(env.language.value('effort', sanitizePayloadText(deepGet(data, ['effort', 'level']))) as string | null, p.model, 'model');
        if (item === 'current-dir') {
            if (!this.liveDir)
                return null;
            const project = deepGet(data, ['workspace', 'project_dir']);
            return { text: p.directory + env.directory(this.liveDir, this.config.directory_style, typeof project === 'string' ? project : null) + p.reset, group: 'location', prefer_slash_breaks: true };
        }
        if (item === 'project-name') {
            const value = deepGet(data, ['workspace', 'project_dir']);
            if (typeof value !== 'string' || !value)
                return null;
            const name = sanitizePayloadText(env.basename(value));
            return this.styled(name ? this.text('project', { value: name }) : null, p.directory, 'location');
        }
        if (item === 'hostname')
            return this.hostname();
        if (item === 'git')
            return this.git();
        if (item === 'branch-diff') {
            const value = this.branchData().value;
            return this.styled(value === null ? this.text('diff.empty') : this.text('diff', value as Data), p.branch, 'repo');
        }
        if (item === 'context-remaining') {
            const value = deepGet(data, ['context_window', 'remaining_percentage']);
            if (value === null)
                return null;
            const number = coercedFloat(value);
            if (number === null || Number.isNaN(number))
                return null;
            return this.styled(this.text('context.remaining', { percentage: roundedInteger(number) }), p.percentage, 'context');
        }
        if (item === 'context-used') {
            const value = metrics.finiteNumber(deepGet(data, ['context_window', 'used_percentage']));
            return value !== null && value <= 100 ? this.styled(this.text('context.used', { percentage: roundedInteger(value) }), p.percentage, 'context') : null;
        }
        if (item === 'context-window-size') {
            const value = preferences.number(deepGet(data, ['context_window', 'context_window_size']), fmt);
            return this.styled(value ? this.text('context.window', { value }) : null, p.size, 'context');
        }
        if (item === 'context-tokens')
            return this.styled(metrics.contextTokens(data.context_window, env.language, fmt), p.percentage, 'context');
        if (item === 'tokens') {
            const totals = this.totals();
            if (!totals)
                return null;
            let values: (string | null)[] = [totals.hit, totals.miss, totals.out];
            const counts = this.rawTotals();
            if (fmt.number_format !== 'legacy' && counts)
                values = [counts.hit, counts.miss, counts.out].map(value => preferences.number(value, fmt));
            const labels = ['hit', 'miss', 'out'];
            const parts = values.flatMap((value, i) => value === null ? [] : [p.tokens + this.text('tokens.' + labels[i], { value }) + p.reset]);
            return parts.length ? { text: parts.join(this.inner), group: 'usage' } : null;
        }
        if (item === 'input-tokens' || item === 'output-tokens') {
            const counts = this.rawTotals(), value = counts ? item === 'input-tokens' ? counts.input_tokens : counts.out : null;
            return metrics.tokenCount(value) === null ? null : this.styled(this.text(item === 'input-tokens' ? 'tokens.in' : 'tokens.out', { value: preferences.number(value, fmt, humanizeApiTokens) }), p.tokens, 'usage');
        }
        if (item === 'task-timer')
            return this.promptTimer();
        if (item === 'task-active-timer')
            return this.activeTimer();
        if (item === 'version')
            return typeof data.version === 'string' && data.version ? { text: p.model + 'v' + data.version + p.reset } : null;
        if (item === 'session') {
            const name = sanitizePayloadText(data.session_name), sid = sanitizePayloadText(data.session_id), value = name || (sid ? [...sid].slice(0, 8).join('') : null);
            return this.styled(value ? this.text('session', { value }) : null, p.model);
        }
        if (item === 'session-name') {
            const value = sanitizePayloadText(data.session_name);
            return this.styled(value ? this.text('session', { value }) : null, p.model);
        }
        if (item === 'session-id' || item === 'session-id-short') {
            let value = sanitizePayloadText(data.session_id);
            if (value && item === 'session-id-short')
                value = [...value].slice(0, 8).join('');
            return this.styled(value ? this.text('session.id', { value }) : null, p.model);
        }
        if (item === 'output-style') {
            const value = sanitizePayloadText(deepGet(data, ['output_style', 'name']));
            return this.styled(value ? this.text('style', { value }) : null, p.model);
        }
        if (item === 'cost') {
            const cost = data.cost;
            if (!object(cost))
                return null;
            const usd = numeric(cost.total_cost_usd);
            if (usd === null || !Number.isFinite(usd))
                return null;
            const parts = [p.percentage + this.text('cost.total', { value: preferences.money(usd, fmt) }) + p.reset], ms = numeric(cost.total_duration_ms);
            if (ms !== null && ms > 0) {
                const duration = formatDuration(ms / 1000);
                if (duration)
                    parts.push(p.percentage + duration + p.reset);
            }
            const valid = (v: unknown) => { const n = int(v); return n !== null && n >= 0n ? n : 0n; }, added = valid(cost.total_lines_added), removed = valid(cost.total_lines_removed);
            if (added || removed)
                parts.push(p.percentage + `+${added}/-${removed}` + p.reset);
            return { text: parts.join(this.inner) };
        }
        if (item === 'cache-miss-reason') return this.styled(cacheMissText(data.prompt_cache, env.language), p.tokens, 'usage');
        if (item === 'prompt-cache') {
            const cache = data.prompt_cache;
            if (!object(cache))
                return null;
            const parts: string[] = [], ratio = numeric(cache.hit_ratio);
            if (ratio !== null && Number.isFinite(ratio) && ratio >= 0 && ratio <= 1)
                parts.push(p.tokens + this.text('cache.ratio', { percentage: roundedInteger(ratio * 100) }) + p.reset);
            const written = preferences.number(cache.cache_write_tokens, fmt);
            if (written && written !== '0')
                parts.push(p.tokens + this.text('cache.write', { value: written }) + p.reset);
            return parts.length ? { text: parts.join(this.inner), group: 'usage' } : null;
        }
        if (item === 'fast-mode' || item === 'thinking')
            return truth(item === 'fast-mode' ? data.fast_mode : deepGet(data, ['thinking', 'enabled'])) ? this.styled(this.text(item === 'fast-mode' ? 'fast' : 'thinking'), p.model, 'model') : null;
        if (item === 'agent' || item === 'vim-mode') {
            const value = deepGet(data, item === 'agent' ? ['agent', 'name'] : ['vim', 'mode']);
            return typeof value === 'string' && value ? this.styled(item === 'agent' ? this.text('agent', { value }) : 'vim ' + value, p.timer) : null;
        }
        if (item === 'pr') {
            const pr = data.pr;
            if (!object(pr))
                return null;
            const value = pr.number;
            if (!(typeof value === 'string' && value || int(value) !== null))
                return null;
            let text = p.branch + (pr.kind === 'mr' ? 'MR !' : 'PR #') + string(value);
            if (typeof pr.review_state === 'string' && pr.review_state)
                text += this.inner + string(env.language.value('review', pr.review_state));
            return { text: text + p.reset, group: 'repo' };
        }
        if (item === 'worktree') {
            const evidence = worktreeEvidence(data), value = evidence.session_name ?? evidence.git_name;
            return value ? this.styled(this.text(evidence.session_name ? 'worktree' : 'git_worktree', { value }), p.branch) : null;
        }
        if (item === 'repo') {
            const repo = deepGet(data, ['workspace', 'repo']);
            return object(repo) && typeof repo.owner === 'string' && repo.owner && typeof repo.name === 'string' && repo.name ? this.styled(this.text('repo', { value: repo.owner + '/' + repo.name }), p.branch, 'repo') : null;
        }
        throw new Error('Unknown render item: ' + item);
    }
    render(id: string): RenderedItem | null {
        const [fmt, options] = preferences.optionsFor(this.config, id);
        this.fmt = fmt;
        const node = this.instances.get(id);
        if (node && (!node.enabled || node.type_id === 'spacer'))
            return null;
        const item = node?.type_id ?? id;
        if (item === 'text') {
            const text = literal(node!, this.config, 'main', this.env.trace ? () => this.env.trace!.mark('main',id,'truncated') : undefined);
            if(text) this.env.trace?.mark('main',id,'visible');
            return text ? { text, ...(foregroundPaint(options.foreground_gradient, this.config) ? { paint: foregroundPaint(options.foreground_gradient, this.config) } : {}) } : null;
        }
        let used: number | null = null;
        if (options.visibility !== 'always' || fmt.thresholds.enabled) {
            used = visibility.usedPercentage(this.data, item, Object.hasOwn(RATE_LIMIT_ITEMS, item) ? this.now() : 0);
            if (!visibility.visible(options, item, used, options.visibility === 'git-dirty' ? this.gitData() : null, options.visibility === 'nonzero' ? this.liveData()[item] : null)) {
                this.env.trace?.mark('main',id,'condition_hidden'); return null;
            }
        }
        const external = node && ['external-value','github-pr','github-ci'].includes(item) ? externalPresentation(node, this.env.source?.(node, this.data), this.env, fmt) : null;
        const rendered = external ? { text: external.text } : item === 'session-cost-rate' ? this.styled(metrics.costRate(this.data.cost, options.cost_rate_basis ?? 'session', fmt, this.env.language), this.palette.percentage, 'usage') : options.presentation === 'bar' ? this.styled(indicator(this.data, item, 'main', options, fmt, this.env.language, this.now()), this.palette.percentage) : this.renderType(item);
        if (!rendered)
            return null;
        let text = preferences.threshold(rendered.text, used, fmt, this.config, this.palette.percentage);
        if (!external) text = preferences.decorate(text, item, 'main', fmt, options, this.env.language);
        if (this.config.theme !== 'classic' || this.config.separator_style === 'powerline' || options.foreground !== null || options.background !== null || options.foreground_gradient || options.background_gradient)
            text = appearance.apply(text, this.config, item, options, 'main', used);
        if (options.max_width !== null) {
            if(layout.displayWidth(text)>options.max_width) this.env.trace?.mark('main',id,'truncated');
            text = layout.truncateStyled(text, options.max_width);
        }
        const target = external?.target ?? (item === 'current-dir' ? fileLink(this.liveDir) : item === 'project-name' ? fileLink(deepGet(this.data, ['workspace','project_dir'])) : item === 'pr' ? safeLink(deepGet(this.data, ['pr','url'])) : null);
        text = layout.withLink(text, target, options.link, this.env.links);
        if(text) this.env.trace?.mark('main',id,'visible');
        const paint = foregroundPaint(options.foreground_gradient, this.config, appearance.riskColor(used, this.config));
        return { ...rendered, text, ...(paint ? { paint } : {}) };
    }
}
export type StateFactory = (data: unknown, config: DisplayDraft, palette: Palette, inner: string, env: RenderEnvironment) => RenderState;
export function coalesce(items: readonly RenderedItem[], inner: string): layout.LayoutSegment[] {
    const segments: layout.LayoutSegment[] = [];
    let current: RenderedItem | null = null, parts: PaintedPart[] = [];
    const emit = () => { if (!current) return; const paint = segmentPaint(parts); segments.push({ text: current.text, prefer_slash_breaks: current.prefer_slash_breaks, ...(paint ? { paint } : {}) }); };
    for (const item of items) {
        if (current !== null && item.group && item.group === current.group) {
            current.text += inner + item.text; parts.push({ text: inner }, item);
        } else { emit(); current = { ...item }; parts = [item]; }
    }
    emit(); return segments;
}
const paintSegment = (segment: layout.LayoutSegment) => segment.paint?.(segment.text, 0) ?? segment.text;
export function configuredRows(data: unknown, config: DisplayDraft, width: number, env: RenderEnvironment, factory: StateFactory = (d, c, p, i, e) => new RenderState(d, c, p, i, e), colors = powerline.cursor()): string[] {
    const palette = paletteFor(config), [outer, inner] = separators(config, palette), state = factory(data, config, palette, inner, env), rows: string[] = [];
    const scope = () => config.scope_labels === 'always' || config.scope_labels === 'when-subagents' && state.hadSubagents();
    const label = () => ({ text: palette.timer + env.language.text('scope.main') + palette.reset });
    const nodes = new Map(config.instances.map(node => [node.id, node]));
    if(config.layout.alignments?.length) {
        const cache=new Map<string,RenderedItem|null>(), cached=Object.create(state) as RenderState;
        cached.render=id=>{if(!cache.has(id))cache.set(id,state.render(id));const value=cache.get(id)!;return value?{...value}:null;};
        const showScope=scope();
        const plain={...config,scope_labels:showScope?'always' as const:'off' as const,layout:{...config.layout,alignments:[]}};
        const unitConfig={...plain,scope_labels:'off' as const,powerline:{...plain.powerline,color_mode:plain.powerline.color_mode==='restart'?'continuous' as const:plain.powerline.color_mode}};
        let prefix=showScope?label().text:null;
        if(prefix&&config.separator_style==='powerline') {
            if(!config.groups.length&&!config.instances.some(node=>node.enabled&&node.type_id==='spacer'))
                prefix=appearance.apply(env.language.text('scope.main'),config,'',DEFAULT_ITEM);
            prefix=powerline.row([{text:prefix,sequence:false}],unitConfig,true,true,{...colors});
        }
        return alignedRows(config,Math.max(2,width),outer,prefix,colors,
            (ids,cursor)=>configuredRows(data,{...unitConfig,layout:{...unitConfig.layout,rows:[ids]}},10000,env,()=>cached,cursor).join(''),
            (ids,first,cursor)=>configuredRows(data,{...plain,scope_labels:first?plain.scope_labels:'off',layout:{...plain.layout,rows:[ids]}},width,env,()=>cached,cursor),
            (ids,collapsed)=>ids.forEach(id=>env.trace?.alignment(id,collapsed)));
    }
    if (config.groups.length) {
        for (const ids of config.layout.mode === 'auto' ? [config.instances.map(n => n.id)] : config.layout.rows) {
            const cells: Cell[] = ids.map(id => { const node = nodes.get(id)!, item = node.enabled ? state.render(id) : null; return { id, text: item?.text ?? '', paint: item?.paint, priority: node.options.priority, spacer: node.type_id === 'spacer' && node.enabled }; });
            if (cells.some(c => c.text) && scope() && !rows.length) cells.unshift({ id: SCOPE_LABEL_ID, text: label().text, priority: -1, sequence: false });
            rows.push(...groupedRows(cells, config.groups, config, 'main', width, outer, config.layout.mode === 'auto', env.trace?.fit('main'), colors));
        }
        return rows;
    }
    if (config.instances.some(node => node.enabled && node.type_id === 'spacer')) {
        const showScope = scope();
        for (const row of config.layout.rows) {
            const cells: Cell<RenderedItem>[] = [];
            for (const id of row) {
                const node = nodes.get(id)!;
                if (!node.enabled)
                    continue;
                if (node.type_id === 'spacer') {
                    env.trace?.mark('main',id,'spacer');
                    cells.push({ id, text: '', priority: 50, spacer: true });
                }
                else {
                    const item = state.render(id);
                    if (item?.text)
                        cells.push({ id, text: item.text, priority: node.options.priority, payload: item, paint: item.paint });
                }
            }
            if (!cells.some(c => c.text))
                continue;
            if (showScope && !rows.length) {
                const item = label();
                cells.unshift({ id: 'scope', sequence: false, text: item.text, priority: -1, payload: item });
            }
            const value = fitRow(cells, Math.max(2, width), config, side => coalesce(side.map(c => ({ ...c.payload!, text: c.text })), inner).map(paintSegment).join(outer), layout.displayWidth, env.trace?.fit('main'), colors);
            if (value)
                rows.push(value);
        }
        return rows;
    }
    if (config.separator_style === 'powerline') {
        const showScope = scope();
        for (const ids of config.layout.mode === 'auto' ? [enabledIds(config)] : config.layout.rows) {
            const blocks: powerline.Block[] = [];
            for (const id of ids) {
                const rendered = state.render(id);
                if (rendered?.text)
                    blocks.push({ ...rendered, id, priority: preferences.optionsFor(config, id)[1].priority });
            }
            if (!blocks.length)
                continue;
            if (showScope && !rows.length)
                blocks.unshift({ text: appearance.apply(env.language.text('scope.main'), config, '', DEFAULT_ITEM), priority: -1 });
            rows.push(...(config.layout.mode === 'auto' ? powerline.wrap(blocks, width, config, colors) : [powerline.fit(blocks, Math.max(2, width), config, env.trace?.fit('main'), colors)]));
        }
        return rows;
    }
    if (config.layout.mode === 'auto') {
        const rendered = enabledIds(config).map(id => state.render(id)).filter((item): item is RenderedItem => item !== null && Boolean(item.text));
        if (rendered.length && scope())
            rendered.unshift(label());
        return layout.layoutSegments(coalesce(rendered, inner), width, outer, palette.reset);
    }
    width = Math.max(2, width);
    const showScope = scope();
    for (const row of config.layout.rows) {
        const selected: {
            id: string | null;
            item: RenderedItem;
        }[] = row.flatMap(id => { const item = state.render(id); return item?.text ? [{ id, item }] : []; });
        if (!selected.length)
            continue;
        if (showScope && !rows.length)
            selected.unshift({ id: null, item: label() });
        const joined = () => coalesce(selected.map(v => v.item), inner).map(paintSegment).join(outer);
        let text = joined();
        while (selected.length > 1 && layout.displayWidth(text) > width) {
            const priority = (i: number) => selected[i]!.id === null ? -1 : preferences.optionsFor(config, selected[i]!.id!)[1].priority;
            let victim = 0;
            for (let i = 1; i < selected.length; i++)
                if (priority(i) <= priority(victim))
                    victim = i;
            if(selected[victim]!.id) env.trace?.mark('main',selected[victim]!.id!,'priority_omitted');
            selected.splice(victim, 1);
            text = joined();
        }
        if(layout.displayWidth(text)>width && selected[0]?.id) env.trace?.mark('main',selected[0].id,'truncated');
        if (layout.displayWidth(text) > width && selected[0]?.item.paint) {
            selected[0].item = { ...selected[0].item, text: layout.truncateStyled(selected[0].item.text, width) }; text = joined();
        }
        rows.push(layout.ensureReset(layout.truncateStyled(text, width), palette.reset));
    }
    return rows;
}
