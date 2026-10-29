import type { ClientProps } from '../lib/session.ts';
import type { Frame } from '../ui/frame.ts';
import { LANGUAGES } from '../lib/i18n/index.ts';
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
  THEME_VALUES, MAIN_ITEM_IDS, ITEM_DEFAULTS, OPERATIONS,
  FORMAT_DEFAULTS, FORMAT_CHOICES, PRESETS, EDITOR_FIELDS, POWERLINE_OPTIONS,
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

export function component(type_id: string, enabled = true): import('../lib/generated-contracts.ts').InstanceDraft {
  return {id:type_id,type_id,enabled,text:type_id==='text'?'':null,options:{...ITEM_DEFAULTS,visibility:'always',formatting:{}}};
}

export const BASE: Draft = {
  display: {
    schema_version: 17, groups: [],
    theme: "classic",
    powerline_glyph: "ascii",
    powerline: { padding: "both", separator: "arrow", start_cap: false, end_cap: true, color_mode: "semantic" },
    statusline_language: 'en',
    metrics: { branch_diff_base_ref: null },
    instances: [component('model-with-effort')],
    use_colors: true,
    palette: 'default',
    directory_style: 'full',
    separator_style: 'classic',
    scope_labels: 'when-subagents',
    subagents: { groups: [], enabled: true, instances: [component('status-elapsed'),component('name')], visibility: 'all', hide_completed: false, row_limit: null, task_max_width: null },
    formatting: JSON.parse(JSON.stringify(FORMAT_DEFAULTS)),
    layout: { mode: 'auto', rows: [] },
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
    scope === 'main' ? BASE.display.instances.map(i=>i.id) : BASE.display.subagents.instances.map(i=>i.id);
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
    guidance: {source_kinds: ['official_input'], measurement_scope: scope === 'main' ? 'main' : 'subagent', requirements: ['observed_field'], setup: ['claude-statusline doctor']},
  };
}

export function description(): DescribeResult {
  return {
    backend_version: 'test',
    editor_fields: JSON.parse(JSON.stringify(EDITOR_FIELDS)),
    presets: JSON.parse(JSON.stringify(PRESETS)),
    formatting_options: JSON.parse(JSON.stringify(FORMAT_CHOICES)),
    operations: [...OPERATIONS],
    capabilities: capabilities(),
    options: {
      colors: { choices: [true, false] },
      palette: { choices: ['default', 'ansi'] },
      theme: { choices: [...THEME_VALUES] },
      ...POWERLINE_OPTIONS,
      'powerline-glyph': { choices: ['ascii', 'powerline'] },
      'directory-style': {
        choices: ['full', 'home', 'project-relative', 'basename'],
      },
      'separator-style': { choices: ['classic', 'compact', 'powerline'] },
      'scope-labels': { choices: ['off', 'when-subagents', 'always'] },
      'statusline-language': { choices: [...LANGUAGES] },
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
  return output(JSON.stringify({ protocol_version: 30, result }));
}

export function sample(text: string) {
  return {
    sample: true,
    main: [[{ text, bold: false, background: null, foreground: null }]],
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

export function setup(on: On, executableOverride: string | undefined = '/tmp/bin with spaces/claude-statusline') {
  const calls: { operation: string; payload: any; argv: readonly string[] }[] =
    [];
  const configCalls: { key: string; value: unknown }[] = [];
  const opens: unknown[] = [];
  const closes: unknown[] = [];
  const behavior: Behavior = {};
  const store = {
    uiLanguage: 'en' as import('../lib/i18n/index.ts').Language,
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
    descriptions: {} as Record<string,string>,
    registered: false,
  };
  on('session.start', () => ({ cwd: '/work' }));
  on('session.cwd', () => ({ value: '/work' }));
  on('session.id', () => ({ value: 'session-test' }));
  on('command.list', () => ({ value: fixture.commands }));
  on('command.register', ($, e) => {
    fixture.registrations.push(e.name);
    fixture.descriptions[e.name]=e.description;
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
          ? executableOverride
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
      if (request.operation === 'read_ui_preferences')
        return { value: reply({schema_version: 1, ui_language: store.uiLanguage ?? 'en', warning: null}) };
      if (request.operation === 'source_draft')
        return { value: reply({revision: 'pins'}) };
      if (request.operation === 'review_import') return {value:reply({draft:copyDraft(request.payload.draft),changes:[]})};
      if (request.operation === 'set_ui_language') {
        store.uiLanguage = request.payload.ui_language;
        return { value: reply({schema_version: 1, ui_language: store.uiLanguage, warning: null}) };
      }
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
                  background: null, foreground: null,
                },
              ],
            ]
          : [];
      return {
        value: reply({
          sample: true,
          main: row(request.payload.draft.display.instances.filter((i: {enabled:boolean})=>i.enabled).map((i: {type_id:string})=>i.type_id)),
          subagents: request.payload.draft.display.subagents.enabled
            ? row(request.payload.draft.display.subagents.instances.filter((i: {enabled:boolean})=>i.enabled).map((i: {type_id:string})=>i.type_id))
            : [],
        }),
      };
    };
    return behavior.process ? behavior.process(request, next) : next();
  });
  return fixture;
}

export async function keys(
  ui: { key: (event: ClientKeyEvent & { in?: string }) => Promise<void>; find: (query: {type: 'Client'}) => Promise<any> },
  ...events: (string | ClientKeyEvent)[]
) {
  for (const event of events) {
    await ui.key({
      ...(typeof event === 'string' ? { key: event } : event),
      in: await clientKey(ui),
    });
  }
}

/** Select a stable field identity, independent of optional UI preference rows. */
export async function selectSetting(ui: any, key: string): Promise<void> {
  // Host preferences follow tool settings. Start at that visible edge instead
  // of traversing the whole tool form for each independent host-row assertion.
  const host = key.startsWith('host-');
  await keys(ui, host ? 'end' : 'home');
  for (let i = 0; i < 100; i++) {
    const { frame, epoch } = await presentation(ui);
    const index = frame.findIndex(node => node[1].key === 'setting-' + key);
    if (index >= 0 && nodeText(frame, index).startsWith('›')) return;
    // This navigation never changes the mount epoch. Reuse the observed frame
    // instead of querying the same Client again just to obtain its key.
    await ui.key({ in: 'statusline-client-' + epoch, key: host ? 'up' : 'down' });
  }
  throw new Error('Setting could not be selected: ' + key);
}

/** Inspect only what the Client actually displays, not a private Editor snapshot. */
export async function presentation(ui: any): Promise<ClientProps> {
  return (await ui.find({ type: 'Client' }))!.props.props as ClientProps;
}
export function nodeText(frame: Frame, index: number): string {
  return frame[index]![2].map(child => typeof child === 'string' ? child : nodeText(frame, child)).join('');
}
export async function selectedSetting(ui: any, key: string): Promise<boolean> {
  const { frame } = await presentation(ui);
  const index = frame.findIndex(node => node[1].key === 'setting-' + key);
  return index >= 0 && nodeText(frame, index).startsWith('›');
}
export async function visibleText(ui: any): Promise<string> {
  return (await presentation(ui)).frame.flatMap(node => node[2].filter(child => typeof child === 'string')).join(' ');
}
export function previewDraft(fixture: ReturnType<typeof setup>): Draft {
  const call = fixture.calls.filter(call => call.operation === 'preview' || call.operation === 'explain').at(-1);
  if (!call) throw new Error('The backend has not received a preview request');
  return call.payload.draft;
}

/** Epoch is also the mount identity, so retry replaces a host-unmounted instance. */
export async function clientKey(ui: any): Promise<string> {
  return 'statusline-client-' + (await presentation(ui)).epoch;
}
