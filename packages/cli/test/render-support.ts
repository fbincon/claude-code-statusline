import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import type { TestContext } from 'node:test';
import type { DisplayDraft, SubagentDraft } from '@fbincon/statusline-core/contracts/ui';
import { defaultDisplay, CONFIG_FILENAME } from '@fbincon/statusline-core/config/display';
import { updateDisplay, updateSubagents } from '@fbincon/statusline-core/config/instances';
import { MESSAGES } from '@fbincon/statusline-core/i18n/statusline/en';
import { Presentation } from '@fbincon/statusline-core/rendering/language';
import { baseEnvironment } from '../src/rendering/environment.js';
import { configuredRows } from '@fbincon/statusline-core/rendering/items';
import { strip } from '@fbincon/statusline-core/rendering/layout';
import type { RenderEnvironment } from '@fbincon/statusline-core/rendering/context';
import type { Data } from '@fbincon/statusline-core/runtime/values';
export { updateDisplay, updateSubagents };
export const NOW = 1788400078000;
export const env = baseEnvironment(new Presentation('en', MESSAGES), { home: '/test/home', now: () => NOW / 1000 });
export function config(items?: readonly string[], updates: Partial<DisplayDraft> = {}): DisplayDraft { return updateDisplay(defaultDisplay(), { use_colors: false, scope_labels: 'off', ...updates, ...(items === undefined ? {} : { items }) }); }
export function agentConfig(items?: readonly string[], updates: Partial<SubagentDraft> = {}, display: Partial<DisplayDraft> = {}): DisplayDraft {
    const base = config(undefined, display);
    return updateDisplay(base, { subagents: updateSubagents(base.subagents, { ...updates, ...(items === undefined ? {} : { items }) }) });
}
export function task(updates: Data = {}): Data { return { id: 'task-1', name: 'Explore', type: 'local_agent', status: 'running', description: 'searching auth flow', label: 'searching auth flow', startTime: 1788400000000, model: 'claude-sonnet-5', effort: 'high', contextWindowSize: 200000, tokenCount: 84000, cwd: '/project', ...updates }; }
export function rendered(data: unknown, cfg: DisplayDraft, sources: Partial<RenderEnvironment> = {}, width = 500): string { return configuredRows(data, cfg, width, { ...env, ...sources }).map(strip).join('\n'); }
export function cli(t: TestContext, command: string, input: string, display?: DisplayDraft | string, extra: NodeJS.ProcessEnv = {}) {
    const root = mkdtempSync(join(tmpdir(), 'ts03-render-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    if (display !== undefined)
        writeFileSync(join(root, CONFIG_FILENAME), typeof display === 'string' ? display : JSON.stringify(display));
    return spawnSync(process.execPath, [fileURLToPath(new URL('../src/entry.js', import.meta.url)), command], { input, encoding: 'utf8', timeout: 10000,
        env: { ...process.env, CLAUDE_CONFIG_DIR: root, CLAUDE_STATUSLINE_RUNTIME_DIR: join(root, 'runtime'), ...extra } });
}
