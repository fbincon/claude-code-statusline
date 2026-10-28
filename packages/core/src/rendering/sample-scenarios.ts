import type { PreviewScenario } from '../editor/preview-settings.js';
import type { Data } from '../runtime/values.js';
import type { SourceView, InstanceDraft } from '../contracts/ui.js';
import { sampleSource } from './extensions.js';
export const SAMPLE_NOW = 1788400120;
export function sampleAgents(scenario: PreviewScenario): Data[] {
    if (scenario === 'no-agents' || scenario === 'missing')
        return [];
    const now = SAMPLE_NOW * 1000;
    const tasks: Data[] = [
        { id: 'preview-running', name: 'Explore', type: 'local_agent', status: 'running', label: 'searching auth flow', startTime: now - 78000, model: 'claude-sonnet-5', effort: 'high', contextWindowSize: 200000, tokenCount: 84000, cwd: '/project/src' },
        { id: 'preview-completed', name: 'Reviewer', type: 'local_agent', status: 'completed', description: 'reviewed lifecycle tests', startTime: now - 42000, _frozen_duration_ms: 42000, model: 'claude-haiku-4-5', contextWindowSize: 200000, tokenCount: 18500, cwd: '/project/tests' },
    ];
    if (scenario === 'many-agents')
        return Array.from({ length: 24 }, (_, i) => ({ ...tasks[i % 2], id: 'preview-agent-' + i, name: 'Agent ' + (i + 1) }));
    for (const task of tasks) {
        if (scenario === 'warning' || scenario === 'critical' || scenario === 'zero')
            task.tokenCount = scenario === 'zero' ? 0 : scenario === 'warning' ? 160000 : 190000;
        if (scenario === 'long-content') {
            task.name = '研究与审阅 👩🏽‍💻 é '.repeat(8);
            task.label = 'Review long component and configuration labels '.repeat(8);
            task.cwd = '/project/very-long-directory/'.repeat(8);
        }
    }
    return tasks;
}
export function scenarioSource(scenario: PreviewScenario): (node: InstanceDraft) => SourceView {
    return node => {
        const view = sampleSource(node);
        if (scenario === 'missing')
            return { ...view, state: 'missing', reason: 'missing', value: null, fields: undefined, observed_at: null, freshness: 'unknown' };
        if (scenario === 'source-stale')
            return { ...view, observed_at: new Date((SAMPLE_NOW - 7200) * 1000).toISOString(), freshness: 'stale' };
        if (scenario === 'source-failed')
            return { ...view, state: 'error', reason: 'failed', value: null, fields: undefined };
        if (scenario === 'zero')
            return { ...view, value: 0 };
        return view;
    };
}
