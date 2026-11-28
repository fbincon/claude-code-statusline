import type { SourceInspection, SourceDefinition, SourceJob } from '../contracts/ui.js';
import { t, type Language } from '../i18n/messages.js';
import { sourceObservationPending } from './source-observation.js';

export function sourceReason(value: string, language: Language): string {
    return t('sources.error.' + value, language, {}, t('sources.reason.' + value, language, {}, value));
}

export function sourceJobLine(job: SourceJob, language: Language): string {
    if (sourceObservationPending(job)) {
        if (job.state === 'failed') return t('ui.refresh.checking_timeout', language);
        return t('sources.refresh_progress', language);
    }
    return t('sources.refresh_outcome', language, {
        state: t('sources.reason.' + job.state, language), reason: sourceReason(job.reason, language),
    });
}

/** Shared readable presentation; raw observations remain available separately. */
export function sourceSummary(report:SourceInspection,language:Language):string[] {
    const tr=(key:string,params:Record<string,unknown>={})=>t('sources.'+key,language,params),unknown=t('task.unknown',language);
    const {source,view,automatic}=report;
    const reason=(value:string)=>t('sources.error.'+value,language,{},t('sources.reason.'+value,language,{},value));
    const lines=[source.name+' · '+tr(source.enabled?'enabled':'disabled'),tr('summary_state',{state:tr('reason.'+automatic.state),reason:reason(automatic.reason)}),tr('summary_scope',{project:source.scope.project??tr('scope_all'),session:source.scope.session??tr('scope_all'),agent:source.scope.agent??tr('scope_all')}),tr('summary_value',{value:view.value===null?unknown:String(view.value),state:tr('reason.'+view.state),freshness:tr('reason.'+view.freshness)}),tr('summary_reason',{reason:reason(view.reason)})];
    if (view.reason === 'branch_mismatch' && view.fields)
        lines.push(tr('github_branch_mismatch_details', { configured: view.fields.configured_branch, current: view.fields.current_branch }));
    lines.push(tr('summary_success',{value:report.last_success??automatic.last_success??unknown}),tr('summary_next',{value:automatic.next_at??unknown,interval:automatic.interval_seconds}));
    for(const job of report.jobs){
        lines.push(tr('summary_job',{id:job.id,state:tr('reason.'+job.state),reason:reason(job.reason)}));
        lines.push(tr('summary_scope',{project:job.context.project??unknown,session:job.context.session??unknown,agent:job.context.agent??unknown}));
        if(job.context.branch||job.context.head)lines.push((job.context.branch??unknown)+' · '+(job.context.head??unknown));
        if(job.result){lines.push(tr('summary_result',{duration:job.result.duration_ms,code:job.result.exit_code??unknown,time:job.result.finished_at}));if(job.result.summary)lines.push(job.result.summary);}
    }
    return lines;
}

export function sourceObservationLines(report: SourceInspection | null, job: SourceJob | null, language: Language): string[] {
    const tr = (key: string, params: Record<string, unknown> = {}) => t('sources.' + key, language, params);
    if (!report) return job ? [sourceJobLine(job, language)] : [tr('observation_unavailable')];
    const { source, view, automatic } = report;
    const reason = sourceReason(view.reason, language);
    const value = view.value === '' ? '""' : String(view.value);
    const lines = view.value === null ? [tr('no_observation', { reason })]
        : [tr('observed_value', { value: view.unit ? value + ' ' + view.unit : value, freshness: tr('reason.' + view.freshness) })];
    if (job) lines.push(sourceJobLine(job, language));
    if (view.value !== null && view.reason !== 'valid') lines.push(tr('summary_reason', { reason }));
    if (view.value !== null) lines.push(view.observed_at
        ? tr('observed_at', { value: view.observed_at }) : tr('observed_time_missing'));
    if (job?.result) {
        const { finished_at, duration_ms, exit_code, summary } = job.result;
        lines.push(tr('summary_result', { time: finished_at, duration: duration_ms, code: exit_code ?? '—' }));
        if (summary && (source.kind === 'command' || summary !== String(view.value))) lines.push(summary);
    }
    if (report.last_success && view.observed_at !== report.last_success)
        lines.push(tr('summary_success', { value: report.last_success }));
    if (view.reason === 'branch_mismatch' && view.fields)
        lines.push(tr('github_branch_mismatch_details', { configured: view.fields.configured_branch, current: view.fields.current_branch }));
    lines.push(sourceScopeLine(source, language));
    if (source.kind !== 'json') {
        lines.push(tr('summary_state', { state: tr('reason.' + automatic.state), reason: sourceReason(automatic.reason, language) }));
        if (automatic.next_at) lines.push(tr('summary_next', { value: automatic.next_at, interval: automatic.interval_seconds }));
    }
    return lines;
}

function sourceScopeLine(source: SourceDefinition, language: Language): string {
    const all = t('sources.scope_all', language);
    return t('sources.summary_scope', language, {
        project: source.scope.project ?? all, session: source.scope.session ?? all, agent: source.scope.agent ?? all,
    });
}

export function sourceReviewLines(source:SourceDefinition,language:Language):string[]{
    const tr=(key:string)=>t('sources.'+key,language);
    const primary = source.kind === 'json' ? ['path', 'pointer']
        : source.kind === 'github' ? ['host', 'repository', 'account', 'branch', 'pr'] : ['executable', 'args', 'cwd', 'input'];
    const fieldLine = ([key, value]: [string, unknown]) => {
        const display = key === 'branch' && value === null ? tr('github_branch_follow')
            : (key === 'pointer' || key === 'observed_at_pointer') && value === '' ? tr('pointer_root')
            : typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value ?? '—');
        return tr('field.' + key) + ': ' + display;
    };
    const settings = Object.entries(source.settings);
    return [...primary.map(key => fieldLine([key, source.settings[key as keyof SourceDefinition['settings']]])),
        sourceScopeLine(source, language), tr('access_' + source.kind),
        ...settings.filter(([key]) => !primary.includes(key)).map(fieldLine),
        tr('field.name') + ': ' + source.name, tr('field.id') + ': ' + source.id,
        tr('field.ttl_seconds') + ': ' + source.ttl_seconds];
}
