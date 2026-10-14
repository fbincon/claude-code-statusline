import type { DisplayDraft } from '../contracts/ui.js';
import type { Data } from '../runtime/values.js';
import type { RenderEnvironment } from './context.js';
import { configuredRows, RenderState } from './items.js';
export const SAMPLE_NOW = 1788400120;
/** Fixtures share the real renderer while replacing every live observation. */
export class SampleRenderState extends RenderState {
    override branchData() { return { value: { files: 3, added: 42, removed: 7 }, reason: null }; }
    override liveData(): Data { return Object.fromEntries(Object.entries({ 'run-state': 'waiting agents', 'permission-mode': 'plan', 'active-agents': 2, 'task-progress': { completed: 3, total: 5 }, 'last-tool': { name: 'Read', status: 'success' }, ttft: 0.42, 'output-rate': 36.5, 'prompt-input-tokens': 48000, 'prompt-output-tokens': 2000, 'prompt-cost': 0.0123 }).map(([key, value]) => [key, { value, partial: key === 'permission-mode' }])); }
    override totals() { return { hit: '1.2M', miss: '87.5K', out: '22.4K', last_prompt: null, entry: {}, counts: this.rawTotals() }; }
    override rawTotals() { return { hit: 1200000n, miss: 87500n, out: 22400n, input_tokens: 1287500n }; }
    override now() { return SAMPLE_NOW; }
    override hadSubagents() { return true; }
    override git() { return { text: this.palette.branch + 'Git feature/statusline-tui ↑1 ~2 ?1' + this.palette.reset, group: 'repo' }; }
    override gitData() { return { kind: 'ok', branch: 'feature/statusline-tui', oid: 'abc1234', upstream: 'origin/feature/statusline-tui', upstream_gone: false, ahead: 1, behind: 0, staged: 0, unstaged: 2, conflicts: 0, untracked: 1 }; }
    override promptTimer() { return { text: this.palette.timer + '✓ 1m 42s' + this.palette.reset }; }
    override activeTimer() { return { text: this.palette.timer + this.text('active', { value: '1m 30s' }) + this.palette.reset }; }
    override hostname() { return { text: this.palette.directory + this.text('host', { value: 'devbox' }) + this.palette.reset, group: 'location' }; }
}
export function samplePreviewData(home: string): Data {
    const project = home.replace(/\/$/u, '') + '/projects/claude-code-statusline';
    return {
        model: { id: 'claude-opus' }, effort: { level: 'high' }, fast_mode: true, thinking: { enabled: true },
        workspace: { current_dir: project + '/src', project_dir: project, repo: { owner: 'example', name: 'claude-code-statusline' } },
        pr: { number: 42, review_state: 'approved' }, worktree: { name: 'statusline-tui' },
        context_window: { remaining_percentage: 73, used_percentage: 27, context_window_size: 200000, total_input_tokens: 54000, current_usage: { input_tokens: 35000, cache_creation_input_tokens: 12000, cache_read_input_tokens: 7000, output_tokens: 2000 } },
        rate_limits: { five_hour: { used_percentage: 18, resets_at: SAMPLE_NOW + 7980 }, seven_day: { used_percentage: 36, resets_at: SAMPLE_NOW + 525600 }, spend_limit: { used_percentage: 9, resets_at: SAMPLE_NOW + 864000, used_usd: 31.50, limit_usd: 350, period: 'monthly' } },
        prompt_cache: { hit_ratio: 0.91, cache_write_tokens: 352000, warm: true, caching_observed: true, expires_at: SAMPLE_NOW + 260, misses: 2, requests: 14 },
        output_style: { name: 'Default' }, version: '2.1.289', session_name: 'demo-session', session_id: 'demo-session',
        cost: { total_cost_usd: 0.12, total_duration_ms: 750000, total_api_duration_ms: 75000, total_lines_added: 156, total_lines_removed: 23 },
        agent: { name: 'reviewer' }, vim: { mode: 'NORMAL' },
    };
}
export function previewRows(config: DisplayDraft, width: number, env: RenderEnvironment, home: string, padding = 0): string[] {
    width = Math.max(2, Math.trunc(width));
    padding = Math.min(Math.max(0, Math.trunc(padding)), width - 2);
    return configuredRows(samplePreviewData(home), config, width - padding, env, (...args) => new SampleRenderState(...args)).map(row => ' '.repeat(padding) + row);
}
