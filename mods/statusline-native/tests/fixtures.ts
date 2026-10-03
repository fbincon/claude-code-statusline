import type { ProcessRunResult } from 'claude-code';
import { MAIN_ITEM_IDS, SUBAGENT_ITEM_IDS } from '../lib/generated-contracts.ts';
import type { Draft } from '../lib/generated-contracts.ts';

export const BASE: Draft = {
  display: { schema_version: 2, items: ['model-with-effort'], use_colors: true,
    palette: 'default', directory_style: 'full', separator_style: 'classic', scope_labels: 'when-subagents',
    subagents: { enabled: true, items: ['status-elapsed', 'name'] } },
  host: { padding: 0, refresh_interval: 1, hide_vim_mode_indicator: false },
};
export const START = { surface: 'terminal', isInteractive: true, cwd: '/work' } as const;
export const RUN = { command: 'statusline-configure-native', args: '', origin: { kind: 'composer' },
  presentation: { isFullscreen: false, columns: 100 } } as const;
export const PANE = { plugin: 'statusline-native', surface: 'terminal', component: 'Pane',
  requestId: 'statusline-native', viewport: { columns: 100, rows: 30 },
  props: { title: 'Probe', isFocused: true, bodyColumns: 60, placement: 'inline',
    scroll: { offset: 0, bodyRows: 10 }, view: {} } } as const;

export function description() {
  return { backend_version: 'test', operations: ['describe', 'read', 'preview', 'apply'], options: {}, capabilities: {},
    catalog: [...MAIN_ITEM_IDS.map(id => ({ id, scope: 'main', label: id, description: id, default_enabled: false, excludes: [] })),
      ...SUBAGENT_ITEM_IDS.map(id => ({ id, scope: 'subagent', label: id, description: id, default_enabled: false, excludes: [] }))] };
}
export function readResult(draft = BASE) {
  return { backend_version: 'test', draft, revision: '0'.repeat(64), installed: true, installation: {}, capabilities: {} };
}
export function output(stdout: string, exitCode = 0): ProcessRunResult {
  return { exitCode, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false };
}
export function reply(result: unknown): ProcessRunResult {
  return output(JSON.stringify({ protocol_version: 1, result }));
}
export function sample(text: string) {
  return { sample: true, main: [[{ text, bold: false, foreground: null }]], subagents: [] };
}
