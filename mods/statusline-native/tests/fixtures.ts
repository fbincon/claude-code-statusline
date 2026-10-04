import type {
  CommandInfo,
  ConfigRow,
  ConfigSetResult,
  ConfigValue,
  ClientKeyEvent,
  On,
  ProcessRunResult,
} from 'claude-code';
import {
  MAIN_ITEM_IDS,
  FORMAT_DEFAULTS, FORMAT_CHOICES, PRESETS,
  SUBAGENT_ITEM_IDS,
} from '../lib/generated-contracts.ts';
import type {
  Capabilities,
  CatalogItem,
  DescribeResult,
  Draft,
  ReadResult,
  Scope,
} from '../lib/generated-contracts.ts';
import { copyDraft } from '../lib/editor/draft.ts';

export const BASE: Draft = {
  display: {
    schema_version: 3,
    items: ['model-with-effort'],
    use_colors: true,
    palette: 'default',
    directory_style: 'full',
    separator_style: 'classic',
    scope_labels: 'when-subagents',
    subagents: { enabled: true, items: ['status-elapsed', 'name'], item_options: {}, visibility: 'all', hide_completed: false, row_limit: null, task_max_width: null },
    formatting: JSON.parse(JSON.stringify(FORMAT_DEFAULTS)),
    item_options: {}, layout: { mode: 'auto', rows: [] },
  },
  host: { padding: 0, refresh_interval: 1, hide_vim_mode_indicator: false },
};

export const START = {
  surface: 'terminal',
  isInteractive: true,
  cwd: '/work',
} as const;
export const RUN = {
  command: 'statusline-configure-native',
  args: '',
  origin: { kind: 'composer' },
  presentation: { isFullscreen: false, columns: 100 },
} as const;
export const PANE = {
  plugin: 'statusline-native',
  surface: 'terminal',
  component: 'Pane',
  requestId: 'statusline-native',
  viewport: { columns: 100, rows: 30 },
  props: {
    title: 'Statusline configuration',
    isFocused: true,
    bodyColumns: 60,
    placement: 'inline',
    scroll: { offset: 0, bodyRows: 24 },
    view: {},
  },
} as const;

export function capabilities(): Capabilities {
  return {
    host_version: '2.1.288',
    subagent_rows: 'supported',
    native_mod: 'unverified',
    native_mod_loaded: null,
    data_observation: 'not_observed',
  };
}

function catalogItem(scope: Scope, id: CatalogItem['id']): CatalogItem {
  const defaults =
    scope === 'main' ? BASE.display.items : BASE.display.subagents.items;
  const position = (defaults as readonly string[]).indexOf(id);
  return {
    id,
    scope,
    label: id,
    description: 'Description of ' + id,
    group: 'test',
    sources: ['test'],
    examples: [id],
    default_position: position < 0 ? null : position,
    minimum_version: null,
    format_options: ['colors'],
    excludes:
      scope === 'subagent' && id === 'status-elapsed'
        ? ['status', 'elapsed']
        : scope === 'subagent' && (id === 'status' || id === 'elapsed')
          ? ['status-elapsed']
          : [],
    unavailable_reasons: ['not_observed'],
    default_enabled: position >= 0,
    minimum_version_status: 'unknown',
  };
}

export function description(): DescribeResult {
  return {
    backend_version: 'test',
    presets: JSON.parse(JSON.stringify(PRESETS)),
    formatting_options: JSON.parse(JSON.stringify(FORMAT_CHOICES)),
    operations: ['describe', 'read', 'preview', 'apply', 'import', 'export', 'preset'],
    capabilities: capabilities(),
    options: {
      colors: { choices: [true, false] },
      palette: { choices: ['default', 'ansi'] },
      'directory-style': {
        choices: ['full', 'home', 'project-relative', 'basename'],
      },
      'separator-style': { choices: ['classic', 'compact'] },
      'scope-labels': { choices: ['off', 'when-subagents', 'always'] },
      'subagent-statusline': { choices: [true, false] },
      padding: { minimum: 0, maximum: 32 },
      'refresh-interval': { minimum: 1, maximum: 3600, special: 'event' },
      'hide-vim-mode-indicator': { choices: [true, false] },
    },
    catalog: [
      ...MAIN_ITEM_IDS.map((id) => catalogItem('main', id)),
      ...SUBAGENT_ITEM_IDS.map((id) => catalogItem('subagent', id)),
    ],
  };
}

export function readResult(
  draft = BASE,
  revision = '0'.repeat(64),
): ReadResult {
  return {
    backend_version: 'test',
    draft: copyDraft(draft),
    revision,
    installed: true,
    installation: {
      statusLine: { state: 'owned' },
      subagentStatusLine: { state: 'owned' },
    },
    capabilities: capabilities(),
  };
}

export function output(stdout: string, exitCode = 0): ProcessRunResult {
  return {
    exitCode,
    stdout,
    stderr: '',
    isStdoutTruncated: false,
    isStderrTruncated: false,
  };
}

export function reply(result: unknown): ProcessRunResult {
  return output(JSON.stringify({ protocol_version: 2, result }));
}

export function sample(text: string) {
  return {
    sample: true,
    main: [[{ text, bold: false, foreground: null }]],
    subagents: [],
  };
}

export function hostRows(): ConfigRow[] {
  return [
    {
      key: 'theme',
      label: 'Theme',
      kind: 'choice',
      value: 'dark',
      options: ['dark', 'light'],
      provider: { plugin: 'engine', tier: 'core' },
      isLocked: false,
    },
    {
      key: 'verbose',
      label: 'Verbose',
      kind: 'boolean',
      value: false,
      provider: { plugin: 'engine', tier: 'core' },
      isLocked: false,
    },
  ];
}

type ProcessReply = { value: ProcessRunResult } | { deny: string };
interface Behavior {
  process?: (
    request: any,
    next: () => ProcessReply,
  ) => ProcessReply | Promise<ProcessReply>;
  configSet?: (key: string, value: ConfigValue) => ConfigSetResult;
}

export function setup(on: On) {
  const calls: { operation: string; payload: any; argv: readonly string[] }[] =
    [];
  const configCalls: { key: string; value: unknown }[] = [];
  const opens: unknown[] = [];
  const closes: unknown[] = [];
  const behavior: Behavior = {};
  const store = {
    draft: copyDraft(BASE),
    revision: '0'.repeat(64),
    rows: hostRows(),
  };
  const fixture = {
    calls,
    configCalls,
    opens,
    closes,
    store,
    behavior,
    commands: [] as CommandInfo[],
    registrations: [] as string[],
    registered: false,
  };
  on('session.start', () => ({ cwd: '/work' }));
  on('command.list', () => ({ value: fixture.commands }));
  on('command.register', ($, e) => {
    fixture.registrations.push(e.name);
    fixture.registered = true;
    return { value: { command: RUN.command } };
  });
  on('command.run', () => ({ text: 'foreign command' }));
  on('ui.render', () => ({
    type: 'Text',
    props: {},
    children: ['foreign pane'],
  }));
  on('ui.open', ($, e) => {
    opens.push(e);
    return { value: { isPlaced: true } };
  });
  on('ui.close', ($, e) => {
    closes.push(e);
    return { value: undefined };
  });
  // Event dispatch is testable here; API focus is verified through real PTYs.
  on('ui.focus', () => ({}));
  on('clock.after', () => ({ value: undefined }));
  on('ui.panes', () => ({ value: [] }));
  on('ui.toast', () => ({ value: undefined }));
  on('ui.log', () => ({ value: undefined }));
  on('ui.message', () => ({}));
  on('config.list', () => ({ value: store.rows }));
  on('config.set', ($, e) => {
    configCalls.push({ key: e.key, value: e.value });
    const result = behavior.configSet?.(e.key, e.value) || { value: e.value };
    if (result.deny === undefined) {
      store.rows = store.rows.map((row) =>
        row.key === e.key ? { ...row, value: result.value } : row,
      );
    }
    return result;
  });
  on('env.get', ($, e) => ({
    value:
      e.name === 'CLAUDE_CONFIG_DIR'
        ? '/tmp/config 中文 $`'
        : e.name === 'CLAUDE_STATUSLINE_NATIVE_EXECUTABLE'
          ? '/tmp/bin with spaces/claude-statusline'
          : undefined,
  }));
  on('process.run', async ($, e) => {
    const request = JSON.parse(e.init?.stdin || '{}');
    calls.push({ ...request, argv: e.argv });
    const next = (): ProcessReply => {
      if (request.operation === 'describe')
        return { value: reply(description()) };
      if (request.operation === 'read')
        return { value: reply(readResult(store.draft, store.revision)) };
      if (request.operation === 'apply') {
        store.draft = copyDraft(request.payload.draft);
        store.revision = '1'.repeat(64);
        return {
          value: reply({
            ...readResult(store.draft, store.revision),
            changed: true,
            backup_dir: '/backup 中文',
          }),
        };
      }
      const row = (items: string[]) =>
        items.length
          ? [
              [
                {
                  text: items.join(' · ') + ' width=' + request.payload.width,
                  bold: request.payload.draft.display.use_colors,
                  foreground: null,
                },
              ],
            ]
          : [];
      return {
        value: reply({
          sample: true,
          main: row(request.payload.draft.display.items),
          subagents: request.payload.draft.display.subagents.enabled
            ? row(request.payload.draft.display.subagents.items)
            : [],
        }),
      };
    };
    return behavior.process ? behavior.process(request, next) : next();
  });
  return fixture;
}

export async function keys(
  ui: { key: (event: ClientKeyEvent & { in?: string }) => Promise<void> },
  ...events: (string | ClientKeyEvent)[]
) {
  for (const event of events) {
    await ui.key({
      ...(typeof event === 'string' ? { key: event } : event),
      in: 'statusline-client',
    });
  }
}
