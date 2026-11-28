import type {
    BindingReview, Operation, ResultFor, Scope, SourceContext, SourceDefinition, SourceInspection, SourceJob, SourceReview, SourcesResult,
} from '../contracts/ui.js';
import { renderMessage, t, text, type Language, type LocalizedText } from '../i18n/messages.js';
import { clip } from '../unicode/index.js';
import { BackendError } from './backend.js';
import type { Editor } from './draft.js';
import { hintLine, wrapEditorLine, type EditorLine } from './hints.js';
import { clone } from './history.js';
import { itemDetailWindow } from './item-detail.js';
import { compatibleSource, observationContext, sameContext } from './source-compatibility.js';
import {
    applicableJob, clearSourceReadError, sourceObservationJob, sourceObservationPending, sourceObservationTarget, sourceReadFailed, verifySourceInspection,
} from './source-observation.js';
import { sourceJobLine, sourceObservationLines, sourceReviewLines } from './source-summary.js';
import { inputKey, prefixedInputView, textInput, type TextInput, type TextKey } from './text-input.js';

type Action = 'edit' | 'review' | 'disable' | 'remove' | 'bind' | 'unbind' | 'refresh' | 'cancel' | 'diagnose' | 'auto-review' | 'auto-off' | 'checks' | 'raw';
type Page = 'list' | 'actions' | 'kind' | 'form' | 'review' | 'remove' | 'bind' | 'unbind' | 'diagnose' | 'auto-review' | 'checks' | 'raw' | 'cancel' | 'bindings' | 'binding-cleanup';
type Effect = 'load' | 'reload-library' | 'inspect-current' | 'observe-job' | 'save' | 'enable' | 'close' | 'auto-on' |
    'bindings' | 'binding-cleanup' | Exclude<Action, 'edit' | 'unbind'>;
type Target = { scope: Scope; id: string };

export interface SourceManager {
    library: SourcesResult | null;
    context: SourceContext | null;
    owner: string;
    closed: boolean;
    page: Page;
    listCursor: number;
    refreshList: boolean;
    observation: { id: string; revision: string; context: SourceContext; job?: SourceJob } | null;
    inspection: SourceInspection | null;
    bindingReview: BindingReview | null;
    bindingSelection: string | null;
    bindingChanged: (Target & { action: 'bound' | 'unbound' }) | null;
    cancelJob: SourceJob | null;
    offset: number;
    automaticInterval: number;
    cursor: number;
    scroll: number;
    selected: string | null;
    action: Action | null;
    kind: SourceDefinition['kind'];
    editing: boolean;
    fields: { key: string; input: TextInput }[];
    review: SourceReview | null;
    details: string[];
    jobs: SourceJob[];
    message: LocalizedText | null;
    effect: Effect | null;
    target: Target | null;
}

export interface SourceBackend {
    request<O extends Operation>(operation: O, payload?: unknown): ResultFor<O> | Promise<ResultFor<O>>;
}

const kinds = ['json', 'github', 'command'] as const;
const readingPages = new Set<Page>(['review', 'diagnose', 'auto-review', 'checks', 'raw', 'cancel', 'remove', 'binding-cleanup']);
const scrollKeys = ['up', 'down', 'pageup', 'pagedown', 'home', 'end'];
const requiredFields = { json: ['id', 'path'], github: ['id', 'project', 'repository', 'account'], command: ['id', 'executable', 'cwd'] };

export function openSources(editor: Editor): void {
    editor.sources = {
        library: null, context: null, owner: 'editor-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2),
        closed: false, page: 'list', listCursor: 0, refreshList: false, observation: null, inspection: null, bindingReview: null,
        bindingSelection: null, bindingChanged: null, cancelJob: null, offset: 0, automaticInterval: 300, cursor: 0, scroll: 0,
        selected: null, action: null, kind: 'json', editing: false, fields: [], review: null, details: [], jobs: [], message: null,
        effect: 'load', target: null,
    };
}

function source(editor: Editor): SourceDefinition | undefined {
    return editor.sources?.library?.sources.find(s => s.id === editor.sources?.selected);
}

export function receiveSources(view: SourceManager, next: SourcesResult): void {
    const old = view.library?.sources ?? [];
    const id = old[view.cursor]?.id;
    const index = id ? next.sources.findIndex(source => source.id === id)
        : view.library ? next.sources.length + view.cursor - old.length : 0;
    view.library = next;
    view.cursor = index < 0 ? next.sources.length : index;
}

function returnToList(editor: Editor): void {
    const m = editor.sources!;
    const current = m.library?.sources.findIndex(entry => entry.id === m.selected) ?? -1;
    m.page = 'list';
    m.cursor = current < 0 ? Math.min(m.listCursor, (m.library?.sources.length ?? 0) + 1) : current;
    m.scroll = 0;
    if (m.library) {
        if (editor.shortcuts.surface === 'terminal') m.refreshList = true;
        else m.effect = 'reload-library';
    }
}

function showActions(m: SourceManager, action: Action | null = m.action): void {
    m.page = 'actions';
    m.action = action;
    m.cursor = 0;
    m.scroll = 0;
    m.offset = 0;
    m.details = [];
}

type Group = 'refresh_group' | 'binding_group' | 'manage_group';
export function sourceActions(editor: Editor): { group: Group; id: Action; label: string }[] {
    const selected = source(editor);
    if (!selected) return [];
    const view = editor.sources!;
    const job = sourceObservationJob(editor);
    const pending = job && sourceObservationPending(job);
    const rows: { group: Group; id: Action; label: string }[] = [];
    const add = (group: Group, id: Action, label = id as string) => rows.push({ group, id, label: 'sources.' + label });
    if (selected.enabled && !pending) add('refresh_group', 'refresh');
    if (!selected.enabled) add('refresh_group', 'review');
    add('refresh_group', 'diagnose', pending ? 'status' : 'diagnose');
    if (selected.enabled && job?.state === 'running') add('refresh_group', 'cancel');
    if (selected.kind === 'github') add('refresh_group', 'checks');
    add('refresh_group', 'raw');
    if (editor.saveState === 'idle' && !editor.packageLocked) {
        add('binding_group', 'bind');
        add('binding_group', 'unbind');
    }
    if (selected.enabled && selected.kind !== 'json') {
        add('manage_group', 'auto-review');
        if (view.library?.automatic.some(policy => policy.source_id === selected.id && policy.enabled))
            add('manage_group', 'auto-off');
    }
    add('manage_group', 'edit', selected.enabled ? 'edit' : 'edit_disabled');
    if (selected.enabled) add('manage_group', 'disable');
    add('manage_group', 'remove');
    return rows;
}

function selectedAction(editor: Editor) {
    const rows = sourceActions(editor);
    return rows.find(row => row.id === editor.sources!.action) ?? rows[0];
}

function targets(editor: Editor, includeBound = false): Target[] {
    const m = editor.sources!;
    const selected = source(editor);
    if (!selected) return [];
    const sourceBindings = new Set(m.library?.bindings.filter(binding => binding.source_id === selected.id).map(binding => binding.id));
    return (['main', 'subagent'] as const).flatMap(scope =>
        (scope === 'main' ? editor.draft.display : editor.draft.display.subagents).instances
            .filter(node => {
                const bound = node.source?.binding != null && sourceBindings.has(node.source.binding);
                return m.page === 'unbind' ? bound : compatibleSource(node, selected, m.context) && (includeBound || !bound);
            })
            .map(node => ({ scope, id: node.id })));
}

function form(editor: Editor, kind: SourceDefinition['kind'], editing = false): void {
    const m = editor.sources!;
    const current = editing ? source(editor) : undefined;
    const settings = current?.settings ?? {};
    const project = current ? current.scope.project ?? '' : m.context?.project ?? '';
    const common = { name: current?.name ?? '', project, session: current?.scope.session ?? '', agent: current?.scope.agent ?? '',
        ttl_seconds: current?.ttl_seconds ?? 300 };
    const fields = kind === 'json' ? {
        path: settings.path ?? '', pointer: settings.pointer ?? '/value', ...common,
        observed_at_pointer: settings.observed_at_pointer ?? '/observed_at', unit: settings.unit ?? '',
    } : kind === 'github' ? {
        project, repository: settings.repository ?? '', account: settings.account ?? '', branch: settings.branch ?? '',
        ...Object.fromEntries(Object.entries(common).filter(([key]) => key !== 'project')),
        host: settings.host ?? 'github.com', pr: settings.pr ?? '',
    } : {
        executable: settings.executable ?? '', cwd: settings.cwd ?? m.context?.project ?? '',
        ...common, args: JSON.stringify(settings.args ?? []), input: JSON.stringify(settings.input ?? {}),
        output: settings.output ?? 'json', timeout_ms: settings.timeout_ms ?? 5000,
    };
    m.kind = kind;
    m.editing = editing;
    m.page = 'form';
    m.cursor = editing ? 1 : 0;
    m.scroll = 0;
    m.message = null;
    m.fields = [{ key: 'id', input: textInput(current?.id ?? '') },
        ...Object.entries(fields).map(([key, value]) => ({ key, input: textInput(String(value)) }))];
}

export function sourcesControls(editor: Editor): {
    enter: string | null;
    back: 'back' | 'close';
    movement: 'select' | 'scroll' | 'fields' | null;
    page: boolean;
    adjust: boolean;
    reload: 'registry' | 'observation' | null;
} {
    const m = editor.sources!;
    const result: ReturnType<typeof sourcesControls> = { enter: null, back: m.page === 'list' ? 'close' : 'back', movement: null,
        page: false, adjust: false, reload: null };
    const actions: Record<string, string> = { review: 'enable', remove: 'remove', 'auto-review': 'apply_auto',
        'binding-cleanup': 'delete_binding', cancel: 'cancel', bind: 'bind', unbind: 'unbind' };
    if (readingPages.has(m.page)) result.movement = 'scroll';
    if (m.page === 'list') {
        result.reload = 'registry';
        if (m.library) { result.enter = 'sources.open'; result.movement = 'select'; }
    } else if (m.page === 'kind') {
        result.enter = 'sources.open'; result.movement = 'select';
    } else if (m.page === 'actions') {
        result.enter = selectedAction(editor) ? 'sources.open' : null;
        result.movement = result.enter ? 'select' : null;
        if (source(editor)) result.reload = 'observation';
    } else if (m.page === 'form') {
        result.enter = m.cursor < m.fields.length - 1 ? 'sources.next_field' : 'sources.save';
        result.movement = 'fields';
    } else if (m.page === 'bind' || m.page === 'unbind') {
        if (targets(editor).length && editor.saveState === 'idle') {
            result.enter = 'sources.' + actions[m.page]; result.movement = 'select';
        }
    } else if (m.page === 'bindings') {
        if (m.bindingReview?.rows.length) result.movement = 'select';
        if (m.bindingReview?.rows[m.cursor]?.removable) result.enter = 'sources.review_binding';
        result.page = (m.bindingReview?.total ?? 0) > 16;
    } else {
        if (actions[m.page]) result.enter = 'sources.' + actions[m.page];
        result.adjust = m.page === 'auto-review';
        if (['diagnose', 'raw', 'checks'].includes(m.page)) result.reload = 'observation';
        if (m.page === 'checks') result.page = (m.inspection?.total ?? 0) > 16;
    }
    return result;
}

function move(cursor: number, key: string, count: number, page: number): number {
    const step = key === 'up' ? -1 : key === 'down' ? 1 : key === 'pageup' ? -page : page;
    return Math.max(0, Math.min(count - 1, key === 'home' ? 0 : key === 'end' ? count - 1 : cursor + step));
}

function clearNotice(m: SourceManager): void {
    m.message = null;
    m.bindingChanged = null;
}

function goBack(editor: Editor): void {
    const m = editor.sources!;
    clearNotice(m);
    m.effect = null;
    m.scroll = 0;
    if (m.page === 'list') m.effect = 'close';
    else if (['actions', 'kind', 'bindings'].includes(m.page)) returnToList(editor);
    else if (m.page === 'form' && !m.editing) {
        m.page = 'kind';
        m.cursor = kinds.indexOf(m.kind);
    } else if (m.page === 'binding-cleanup') m.page = 'bindings';
    else showActions(m);
}

function applyBinding(editor: Editor, target: Target, change: 'bound' | 'unbound', sourceReference: NonNullable<ReturnType<Editor['instance']>>['source']): void {
    const m = editor.sources!;
    const draft = clone(editor.draft);
    const node = (target.scope === 'main' ? draft.display : draft.display.subagents).instances.find(node => node.id === target.id);
    if (!node) { m.message = text('sources.error.binding'); return; }
    node.source = sourceReference;
    if (!editor.commitDraft(draft)) {
        m.message = editor.compositionError;
        return;
    }
    m.bindingChanged = { ...target, action: change };
    showActions(m);
}

export function sourcesKey(editor: Editor, event: TextKey, language: Language = 'en', width = 80, height = 18): 'sources' | null {
    const m = editor.sources;
    if (!m) return null;
    const key = event.key === 'return' ? 'enter' : event.key;
    const commandKey = !event.text && !event.paste && !event.meta;
    const plain = commandKey && !event.ctrl;
    if (commandKey && (key === 'escape' || event.ctrl && key.toLowerCase() === 'g')) {
        goBack(editor);
        return m.effect ? 'sources' : null;
    }
    if (m.page === 'form') {
        if (plain && ['tab', 'up', 'down'].includes(key)) {
            m.cursor = move(m.cursor, key === 'tab' ? 'down' : key, m.fields.length, 1);
            m.message = null;
        } else if ((plain && key === 'enter') || editor.shortcuts.action('source-form', event) === 'save-source') {
            if (plain && key === 'enter' && m.cursor < m.fields.length - 1) { m.cursor++; m.message = null; }
            else m.effect = 'save';
        } else {
            const field = m.fields[m.cursor];
            if (field && (!m.editing || field.key !== 'id')) {
                const changed = inputKey(field.input.value, field.input, event, 8192);
                field.input = changed.state;
                m.message = changed.error ? text('input.' + changed.error, { limit: 8192 }) : null;
            }
        }
        return m.effect ? 'sources' : null;
    }
    const controls = sourcesControls(editor);
    if (controls.reload && editor.shortcuts.action('sources', event) === 'reload-sources') {
        m.effect = controls.reload === 'registry' ? m.library ? 'reload-library' : 'load' : 'observe-job';
        return 'sources';
    }
    if (!plain) return null;
    if (controls.page && (key === 'left' || key === 'right')) {
        const total = m.page === 'checks' ? m.inspection?.total : m.bindingReview?.total;
        const lastPage = Math.max(0, Math.floor(((total ?? 1) - 1) / 16)) * 16;
        const offset = Math.max(0, Math.min(m.offset + (key === 'left' ? -16 : 16), lastPage));
        if (offset === m.offset) return null;
        m.offset = offset;
        m.cursor = 0;
        m.effect = m.page === 'checks' ? 'checks' : 'bindings';
        return 'sources';
    }
    if (controls.adjust && (key === 'left' || key === 'right')) {
        m.automaticInterval = Math.max(60, Math.min(86400, m.automaticInterval + (key === 'left' ? -60 : 60)));
        return null;
    }
    if (scrollKeys.includes(key)) {
        if (controls.movement === 'scroll') m.scroll = reportWindow(editor, language, width, height, key).start;
        else if (controls.movement === 'select') {
            const capacity = Math.max(1, height - headerRows(editor, language, width, height).length);
            if (m.page === 'actions') {
                const rows = sourceActions(editor);
                const active = rows.findIndex(row => row.id === selectedAction(editor)?.id);
                m.action = rows[move(active, key, rows.length, capacity)]?.id ?? null;
            } else {
                const count = m.page === 'list' ? (m.library?.sources.length ?? 0) + 2 : m.page === 'kind' ? kinds.length
                    : m.page === 'bindings' ? m.bindingReview?.rows.length ?? 0 : targets(editor).length;
                m.cursor = move(m.cursor, key, count, capacity);
            }
        }
        return null;
    }
    if (key !== 'enter' || !controls.enter) return null;
    clearNotice(m);
    if (m.page === 'list') {
        m.listCursor = m.cursor;
        const selected = m.library?.sources[m.cursor];
        if (selected) {
            m.selected = selected.id;
            m.observation = null;
            m.inspection = null;
            showActions(m, null);
            m.effect = 'inspect-current';
        } else if (m.cursor === (m.library?.sources.length ?? 0) + 1) {
            m.selected = null;
            m.offset = 0;
            m.effect = 'bindings';
        } else {
            m.selected = null;
            m.page = 'kind';
            m.cursor = 0;
        }
    } else if (m.page === 'kind') form(editor, kinds[m.cursor]!);
    else if (m.page === 'actions') {
        const action = selectedAction(editor)!.id;
        m.action = action;
        m.offset = 0;
        m.scroll = 0;
        if (action === 'edit') form(editor, source(editor)!.kind, true);
        else if (action === 'cancel') {
            m.cancelJob = sourceObservationJob(editor);
            m.page = 'cancel';
        } else if (action === 'bind' || action === 'unbind' || action === 'remove') {
            m.page = action;
            m.cursor = 0;
        } else m.effect = action;
    } else if (m.page === 'bindings') {
        m.bindingSelection = m.bindingReview!.rows[m.cursor]!.id;
        m.page = 'binding-cleanup';
        m.scroll = 0;
    } else if (m.page === 'bind' || m.page === 'unbind') {
        if (!editor.canMutateDraft()) { m.message = editor.compositionError; return null; }
        const target = targets(editor)[m.cursor];
        if (target && m.page === 'bind') {
            m.target = target;
            m.effect = 'bind';
        } else if (target) {
            const node = editor.instance(target.scope, target.id);
            if (node?.source) applyBinding(editor, target, 'unbound', { ...node.source, binding: null });
        }
    } else if (m.page === 'review') m.effect = 'enable';
    else if (m.page === 'auto-review') m.effect = 'auto-on';
    else if (m.page === 'remove' || m.page === 'binding-cleanup' || m.page === 'cancel') m.effect = m.page;
    return m.effect ? 'sources' : null;
}

export async function closeSources(editor: Editor, backend: SourceBackend): Promise<void> {
    const m = editor.sources;
    if (!m) return;
    m.closed = true;
    let failed: unknown;
    for (const job of m.jobs.filter(sourceObservationPending)) {
        try { await backend.request('source_release', { id: job.id, owner: m.owner }); }
        catch (error) { failed = error; }
    }
    if (failed) throw failed;
    if (editor.sources === m) editor.sources = null;
}

function sourceValues(m: SourceManager): Record<string, unknown> {
    const values = Object.fromEntries(m.fields.map(field => [field.key, field.input.value]));
    const required = requiredFields[m.kind].find(key => !values[key]?.trim());
    if (required) throw new BackendError('invalid', text('sources.error.required', { sourceField: required }));
    const { id, name, project, session, agent, ttl_seconds, ...settings } = values;
    const parsed: Record<string, unknown> = { ...settings };
    for (const key of ['args', 'input']) {
        if (!(key in parsed)) continue;
        try { parsed[key] = JSON.parse(String(parsed[key])); }
        catch { throw new BackendError('invalid', text('sources.error.invalid_json', { sourceField: key })); }
    }
    if ('timeout_ms' in parsed) parsed.timeout_ms = Number(parsed.timeout_ms);
    if ('pr' in parsed) parsed.pr = parsed.pr === '' ? null : Number(parsed.pr);
    if ('branch' in parsed && parsed.branch === '') parsed.branch = null;
    return { action: m.editing ? 'edit' : 'add', id, source: {
        name: name || id, kind: m.kind, scope: { project: project || null, session: session || null, agent: agent || null },
        ttl_seconds: Number(ttl_seconds), settings: parsed,
    } };
}

function receiveInspection(m: SourceManager, report: SourceInspection, context: SourceContext, job?: SourceJob): void {
    m.inspection = report;
    m.observation = { id: report.source.id, revision: report.source.revision, context, ...(job && { job }) };
    m.jobs = m.jobs.map(previous => report.jobs.find(updated => updated.id === previous.id) ?? previous);
    clearSourceReadError(m);
}

async function sourceRead(editor: Editor, backend: SourceBackend, effect: Effect): Promise<void> {
    const m = editor.sources!;
    const selected = source(editor);
    if (!selected) return;
    const active = () => editor.sources === m && !m.closed && m.selected === selected.id;
    if (effect === 'observe-job') {
        const target = sourceObservationTarget(editor);
        if (target) {
            try { (await target.read(backend, true))(); }
            catch (error) { target.failed(error); }
            return;
        }
    }
    const context = await backend.request('source_context', { project: selected.scope.project ?? m.context?.project ?? null,
        session: selected.scope.session, agent: selected.scope.agent });
    if (!active()) return;
    if (effect === 'refresh') {
        const job = await backend.request('source_refresh', { id: selected.id, context, owner: m.owner });
        if (!active()) { await backend.request('source_release', { id: job.id, owner: m.owner }); return; }
        if (!applicableJob(job, selected, context)) {
            await backend.request('source_release', { id: job.id, owner: m.owner });
            throw new BackendError('source_identity', text('sources.error.identity'));
        }
        if (!m.observation || !sameContext(observationContext(selected, m.observation.context), observationContext(selected, context)))
            m.inspection = null;
        m.observation = { id: selected.id, revision: selected.revision, context, job };
        m.jobs = [...m.jobs.filter(previous => previous.id !== job.id), job];
        m.page = 'diagnose';
        m.scroll = 0;
        return;
    }
    let job = m.observation?.job ?? m.jobs.findLast(previous => applicableJob(previous, selected, context));
    if (job && !applicableJob(job, selected, context)) job = undefined;
    if (effect === 'cancel') {
        const reviewed = m.cancelJob;
        if (!reviewed) return;
        const current = await backend.request('source_status', { id: reviewed.id });
        if (!active()) return;
        if (current.id !== reviewed.id || current.identity !== reviewed.identity || current.owner !== reviewed.owner ||
            !applicableJob(current, selected, context)) throw new BackendError('source_identity', text('sources.error.identity'));
        job = current.state === 'running' ? await backend.request('source_cancel', { id: current.id }) : current;
        if (!active()) return;
        if (job.id !== current.id || job.identity !== current.identity || job.owner !== current.owner ||
            !applicableJob(job, selected, context)) throw new BackendError('source_identity', text('sources.error.identity'));
        m.cancelJob = null;
        m.observation = { id: selected.id, revision: selected.revision, context, job };
        m.jobs = m.jobs.map(previous => previous.id === job?.id ? job : previous);
        m.page = 'diagnose';
        m.scroll = 0;
    }
    const report = verifySourceInspection(await backend.request('source_inspect', {
        id: selected.id, context, offset: m.offset,
    }), selected, m.offset, context);
    if (!active()) return;
    receiveInspection(m, report, context, job);
    if (effect === 'checks' || effect === 'diagnose' || effect === 'raw') {
        m.page = effect;
        m.scroll = 0;
    }
}

export async function performSourceAction(editor: Editor, backend: SourceBackend): Promise<void> {
    const m = editor.sources;
    const effect = m?.effect;
    if (!m || !effect) return;
    m.effect = null;
    if (effect !== 'observe-job') m.message = null;
    try {
        const generation = editor.mutationGeneration;
        if (effect === 'bind' && !editor.canMutateDraft()) { m.message = editor.compositionError; return; }
        if (effect === 'close') { await closeSources(editor, backend); return; }
        if (effect === 'load' || effect === 'reload-library') {
            const result = await backend.request('sources_read', {});
            if (m.closed || editor.sources !== m) return;
            receiveSources(m, result);
            m.refreshList = false;
            if (effect === 'load') {
                const target = editor.baseline.configuration;
                m.context = await backend.request('source_context', {
                    project: target?.project_root ?? (target?.target.kind === 'project' ? target.target.path : null), session: null, agent: null,
                });
                if (!m.closed && editor.sources === m) await registerBindings(editor, backend);
            }
            return;
        }
        if (effect === 'bindings' || effect === 'binding-cleanup') {
            m.bindingReview = effect === 'bindings' ? await backend.request('source_bindings_review', { offset: m.offset })
                : await backend.request('source_bindings_cleanup', { revision: m.bindingReview!.revision, ids: [m.bindingSelection] });
            m.page = 'bindings';
            m.cursor = 0;
            m.scroll = 0;
            return;
        }
        if (effect === 'review' || effect === 'auto-review') {
            m.review = await backend.request('source_review', { id: m.selected });
            m.page = effect;
            m.automaticInterval = m.library?.automatic.find(policy => policy.source_id === m.selected)?.interval_seconds ??
                (m.review.source.kind === 'command' ? 300 : Math.max(60, Math.min(86400, m.review.source.ttl_seconds)));
            m.scroll = 0;
            return;
        }
        if (['inspect-current', 'observe-job', 'cancel', 'refresh', 'diagnose', 'checks', 'raw'].includes(effect)) {
            await sourceRead(editor, backend, effect);
            return;
        }
        const payload: Record<string, unknown> = { action: effect, id: m.selected, expected_revision: m.library!.revision };
        if (effect === 'save') Object.assign(payload, sourceValues(m));
        if (effect === 'bind') {
            payload.binding = m.target ? editor.instance(m.target.scope, m.target.id)?.source?.binding : null;
            payload.draft_owner = editor.sourceDraftOwner;
            await registerBindings(editor, backend);
            if (!editor.canMutateDraft(generation) || editor.sources !== m || m.closed) {
                m.message = editor.compositionError;
                return;
            }
        }
        if (effect === 'enable' || effect === 'auto-on') payload.review_revision = m.review?.review_revision;
        if (effect === 'auto-on') payload.interval_seconds = m.automaticInterval;
        const result = await backend.request('sources_apply', payload);
        if (m.closed || editor.sources !== m) return;
        m.library = result;
        m.refreshList = false;
        if (effect === 'bind' && m.target && result.binding) {
            if (result.binding.binding) registeredBindings.get(editor)?.add(result.binding.binding);
            if (!editor.canMutateDraft(generation)) { m.message = editor.compositionError; return; }
            applyBinding(editor, m.target, 'bound', result.binding);
            return;
        }
        m.observation = null;
        m.inspection = null;
        const notices = { save: 'saved', enable: 'enabled_saved', disable: 'disabled_saved', remove: 'removed_saved',
            'auto-on': 'automatic_saved', 'auto-off': 'automatic_disabled' } as const;
        const notice = notices[effect as keyof typeof notices] ?? 'saved';
        m.message = text('sources.' + notice);
        if (effect === 'remove') {
            m.selected = null;
            m.page = 'list';
            m.cursor = Math.min(m.listCursor, result.sources.length);
            m.scroll = 0;
        } else {
            m.selected = String(payload.id);
            showActions(m, null);
        }
    } catch (error) {
        const reason = error instanceof BackendError && error.localization ? error.localization : text('sources.failed');
        const index = m.page === 'form' ? m.fields.findIndex(field => field.key === reason.params.sourceField) : -1;
        if (index >= 0) {
            m.cursor = index;
            m.message = text('sources.field_error', { field: text('sources.field.' + m.fields[index]!.key), reason });
        } else m.message = reason;
    }
}

type SourceRow = EditorLine & { selected: boolean; heading?: boolean };
const row = (value: string | EditorLine, selected = false, heading = false): SourceRow =>
    ({ ...(typeof value === 'string' ? { text: value } : value), selected, heading });

export function sourcesTitle(editor: Editor, language: Language): string {
    const m = editor.sources!;
    const pages: Partial<Record<Page, string>> = { kind: 'new_title', form: m.editing ? 'edit_title' : 'new_title',
        review: 'review_title', 'auto-review': 'auto-review', bind: 'bind', unbind: 'unbind', diagnose: 'diagnose', checks: 'checks',
        raw: 'raw', remove: 'remove', cancel: 'cancel', bindings: 'bindings', 'binding-cleanup': 'bindings' };
    return t('sources.' + (pages[m.page] ?? 'title'), language);
}

function componentLabel(editor: Editor, target: Target, language: Language): string {
    return t('sources.component', language, { scope: t('sources.scope_' + target.scope, language),
        name: editor.instanceLabel(target.scope, target.id, language) });
}

function headerRows(editor: Editor, language: Language, width: number, height: number): SourceRow[] {
    const m = editor.sources!;
    const tr = (key: string) => t('sources.' + key, language);
    const rows: SourceRow[] = [];
    const current = m.page === 'review' || m.page === 'auto-review' ? m.review?.source ?? source(editor) : source(editor);
    if (current && m.page !== 'list' && m.page !== 'bindings' && m.page !== 'binding-cleanup') {
        rows.push(row(clip(current.name, width), false, true),
            row(clip(tr(current.kind === 'command' ? 'kind_command' : current.kind) + ' · ' + tr(current.enabled ? 'enabled' : 'disabled'), width)));
    }
    if (m.message) rows.push(...wrapEditorLine({ text: renderMessage(m.message, language) }, width).map(line => row(line)));
    if (m.bindingChanged) {
        const key = m.bindingChanged.action === 'bound' && !current?.enabled ? 'bound_disabled' : m.bindingChanged.action;
        const notice = hintLine('sources.' + key, language,
            { save: editor.shortcuts.hint('list', 'save') }, { component: componentLabel(editor, m.bindingChanged, language) });
        rows.push(...wrapEditorLine(notice, width).map(line => row(line)));
    }
    if (m.page === 'list' && m.library?.sources.length === 0) rows.push(row(tr('empty')));
    if (m.page === 'actions' && editor.saveState !== 'idle')
        rows.push(...wrapEditorLine({ text: tr('binding_locked') }, width).map(line => row(line)));
    if (m.page === 'form' && !m.editing) {
        const help = m.kind === 'json' ? 'json_example' : m.kind === 'github' ? 'github_branch_help' : 'command_form_help';
        rows.push(...wrapEditorLine({ text: tr(help) }, width).map(line => row(line)));
    }
    if (m.page === 'form') rows.push(row(tr('required_fields')));
    return rows.slice(0, Math.max(0, height - 1));
}

function reportRows(editor: Editor, language: Language): (string | EditorLine)[] {
    const m = editor.sources!;
    const tr = (key: string, params: Record<string, unknown> = {}) => t('sources.' + key, language, params);
    if (m.page === 'review' || m.page === 'auto-review') {
        const lines = m.review ? sourceReviewLines(m.review.source, language) : [];
        return m.page === 'review' ? lines
            : [tr('interval') + ': ' + m.automaticInterval + ' s', tr('automatic_scope'), ...lines];
    }
    if (m.page === 'cancel') return m.cancelJob ? [tr('cancel_scope'),
        tr('summary_job', { id: m.cancelJob.id, state: tr('reason.' + m.cancelJob.state), reason: sourceJobLine(m.cancelJob, language) }),
        tr('summary_scope', { project: m.cancelJob.context.project ?? tr('scope_all'), session: m.cancelJob.context.session ?? tr('scope_all'),
            agent: m.cancelJob.context.agent ?? tr('scope_all') })] : [];
    if (m.page === 'remove') return [tr('remove_scope'), source(editor)?.name ?? '', source(editor)?.id ?? ''];
    if (m.page === 'binding-cleanup') return [hintLine('sources.binding_cleanup_confirm', language,
        { enter: 'Enter', back: editor.shortcuts.surface === 'native' ? 'Ctrl+G' : 'Esc/Ctrl+G' }), m.bindingSelection ?? ''];
    if (m.page === 'checks') {
        const report = m.inspection;
        if (!report?.checks.length) return [tr('checks_empty')];
        const { repository, branch } = report.source.settings;
        const context = report.checks_context;
        return [[repository, context?.branch ?? branch, context?.head].filter(Boolean).join(' · '),
            tr('observed_at', { value: report.checks_observed_at ?? '—' }),
            ...report.checks.flatMap(check => [
                `${check.name} · ${check.state} · ${tr('check.' + check.bucket)}`, ...(check.url ? [check.url] : []),
            ]),
            `${report.offset + 1}–${report.offset + report.checks.length}/${report.total}`];
    }
    if (m.details.length) return m.details;
    if (m.page === 'raw' && m.inspection) return JSON.stringify(m.inspection, null, 2).split('\n');
    return sourceObservationLines(m.inspection, sourceObservationJob(editor), language);
}

function reportWindow(editor: Editor, language: Language, width: number, height: number, key?: string) {
    const header = headerRows(editor, language, width, height);
    const rows = reportRows(editor, language).flatMap(line => wrapEditorLine(typeof line === 'string' ? { text: line } : line, width));
    const available = Math.max(1, height - header.length);
    const showRange = rows.length > available && available > 1;
    const page = itemDetailWindow(rows, editor.sources!.scroll, available - Number(showRange), key);
    return { start: page.start, rows: [...header, ...page.rows.map(line => row(line)), ...(showRange ? [row(page.summary)] : [])] };
}

export function sourcesView(editor: Editor, language: Language, width: number, height: number): SourceRow[] {
    const m = editor.sources!;
    if (readingPages.has(m.page)) return reportWindow(editor, language, width, height).rows;
    const tr = (key: string, params: Record<string, unknown> = {}) => t('sources.' + key, language, params);
    const header = headerRows(editor, language, width, height);
    const entries: SourceRow[] = [];
    if (m.page === 'list' && m.library) {
        m.library.sources.forEach((entry, i) => entries.push(row(
            `${entry.name} · ${tr(entry.kind)} · ${tr(entry.enabled ? 'enabled' : 'disabled')}`, m.cursor === i)));
        entries.push(row('+ ' + tr('add'), m.cursor === m.library.sources.length),
            row(tr('bindings'), m.cursor === m.library.sources.length + 1));
    } else if (m.page === 'bindings') {
        if (m.bindingReview?.uncertain) entries.push(row(tr('bindings_uncertain')));
        if (!m.bindingReview?.rows.length) entries.push(row(tr('bindings_empty')));
        m.bindingReview?.rows.forEach((binding, i) => entries.push(row(
            `${binding.id} · ${binding.source_id} · ${tr(binding.removable ? 'binding_unused' : 'binding_protected')}${binding.duplicate ? ' · ' + tr('binding_duplicate') : ''} · ${binding.references.join(', ')}`, m.cursor === i)));
    } else if (m.page === 'actions') {
        let group: Group | undefined;
        const selected = selectedAction(editor)?.id;
        for (const action of sourceActions(editor)) {
            if (group !== action.group) entries.push(row(tr(action.group), false, true));
            group = action.group;
            entries.push(row(t(action.label, language), selected === action.id));
        }
    } else if (m.page === 'kind') kinds.forEach((kind, i) => entries.push(row(tr(kind), m.cursor === i)));
    else if (m.page === 'form') {
        m.fields.forEach((field, i) => {
            const label = (requiredFields[m.kind].includes(field.key) && (!m.editing || field.key !== 'id') ? '* ' : '') + tr('field.' + field.key) + ': ';
            const selected = m.cursor === i;
            entries.push(row(selected && (!m.editing || field.key !== 'id')
                ? prefixedInputView(label, { ...field.input }, width) : clip(label + field.input.value, width), selected));
        });
    } else if (m.page === 'bind' || m.page === 'unbind') {
        const rows = targets(editor);
        if (!rows.length) {
            const reason = m.page === 'unbind' ? 'no_unbind' : targets(editor, true).length ? 'already_bound' : 'no_components';
            entries.push(...wrapEditorLine({ text: tr(reason) }, width).map(line => row(line)));
        } else {
            const effect = m.page === 'bind' && !source(editor)?.enabled ? 'binding_effect_disabled' : 'binding_effect';
            entries.push(...wrapEditorLine({ text: tr(effect) }, width).map(line => row(line)),
                ...rows.map((target, i) => row(componentLabel(editor, target, language), m.cursor === i)));
        }
    }
    const capacity = Math.max(1, height - header.length);
    const selected = Math.max(0, entries.findIndex(entry => entry.selected));
    const start = Math.max(0, selected - capacity + 1);
    return [...header, ...entries.slice(start, start + capacity)];
}

export function draftBindings(editor: Editor): string[] {
    return [...new Set([editor.draft, editor.baseline.draft, ...editor.history.undo.map(entry => entry.draft), ...editor.history.redo.map(entry => entry.draft)]
        .flatMap(draft => [...draft.display.instances, ...draft.display.subagents.instances].flatMap(node => node.source?.binding ? [node.source.binding] : [])))];
}
const registeredBindings = new WeakMap<Editor, Set<string>>();
async function registerBindings(editor: Editor, backend: SourceBackend): Promise<void> {
    const bindings = draftBindings(editor);
    const previous = editor.shortcuts.surface === 'terminal' ? registeredBindings.get(editor) : undefined;
    if (previous && bindings.every(id => previous.has(id))) return;
    editor.sourceDraftRegistered = true;
    await backend.request('source_draft', { owner: editor.sourceDraftOwner, bindings, close: false });
    if (editor.shortcuts.surface === 'terminal' && editor.sourceDraftRegistered)
        registeredBindings.set(editor, new Set([...(previous ?? []), ...bindings]));
}
export async function closeSourceDraft(editor: Editor, backend: SourceBackend): Promise<void> {
    if (!editor.sourceDraftRegistered) return;
    await backend.request('source_draft', { owner: editor.sourceDraftOwner, bindings: [], close: true });
    editor.sourceDraftRegistered = false;
    registeredBindings.delete(editor);
}
