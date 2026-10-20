import type { TaskDetails } from '../contracts/ui.js';
import { t, type Language } from '../i18n/messages.js';
import { wrapText } from './text.js';

/** Both native and CLI presentations retain every evidence source and timestamp. */
export function taskDetailLines(report: TaskDetails, language: Language, width = 100): string[] {
    const tr = (key: string, params: Record<string, unknown> = {}) => t(key, language, params);
    const status = (value: string | null) => value === null ? tr('task.unknown') : t('task.value.' + value, language, {}, value);
    const duration = (value: number | null) => value === null ? tr('task.unknown') : value.toFixed(1) + 's';
    const lines = [
        tr('task.session', { value: report.session_id }), tr('task.prompt', { value: report.prompt_id ?? tr('task.unknown') }),
        tr('task.captured', { value: report.captured_at }),
        tr('task.status', { value: status(report.status), phase: status(report.phase) }),
        tr('task.elapsed', { value: duration(report.elapsed_seconds) }), tr('task.active', { value: duration(report.active_seconds) }),
        tr('task.progress', { value: report.progress ? report.progress.completed + '/' + report.progress.total : tr('task.unknown') }),
        tr('task.agents'),
        ...report.agents.flatMap(agent => [
            `${agent.parent_id ? agent.parent_id + ' → ' : ''}${agent.name ?? agent.id} [${agent.id}]: ${status(agent.status)}`,
            ...agent.evidence.map(e => tr('task.evidence', { source:e.source, scope:e.scope, status:status(e.status), time:e.observed_at ?? tr('task.unknown'), freshness:status(e.freshness) })),
        ]),
        tr('task.sources'),
        ...report.evidence.map(e => tr('task.evidence', { source:e.source, scope:e.scope, status:status(e.status), time:e.observed_at ?? tr('task.unknown'), freshness:status(e.freshness) })),
        ...report.limitations.map(reason => t('task.limit.' + reason, language, {}, reason)),
    ];
    return wrapText(lines.map(line=>line.replace(/\x1b\[[0-?]*[ -/]*[@-~]/gu,'').replace(/[\p{Cc}\p{Cs}]/gu,'')), Math.max(2,width));
}
