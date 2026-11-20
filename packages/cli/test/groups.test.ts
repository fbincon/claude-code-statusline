import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultDisplay, defaultItem, validateDisplay } from '@fbincon/statusline-core/config/display';
import { edit, updateDisplay } from '@fbincon/statusline-core/config/instances';
import { editGroup, validGroups } from '@fbincon/statusline-core/editor/groups';
import { isDraft } from '@fbincon/statusline-core/editor/backend';
import { Editor } from '@fbincon/statusline-core/editor/draft';
import { openGroups, groupsKey, groupsView } from '@fbincon/statusline-core/editor/group-manager';
import { DEFAULT_HOST } from '@fbincon/statusline-core/config/draft';
import { displayWidth, strip, styledUnits } from '@fbincon/statusline-core/rendering/layout';
import { parse } from '@fbincon/statusline-core/rendering/styles';
import { configuredRows } from '@fbincon/statusline-core/rendering/items';
import { RenderTrace } from '@fbincon/statusline-core/rendering/trace';
import { renderTask } from '@fbincon/statusline-core/rendering/subagents';
import { exportFile, importFile } from '../src/config/transfer.js';
import { configCommand } from '../src/config/commands.js';
import { LANGUAGES } from '@fbincon/statusline-core/i18n/registry';
import type { DisplayDraft, InstanceDraft } from '@fbincon/statusline-core/contracts/ui';
import { config, env, NOW, rendered, task } from './render-support.js';
import { setup, join, readFileSync } from './final-support.js';

const node = (id: string, type_id: string, text: string | null = null): InstanceDraft => ({ id, type_id, enabled: true, text, options: defaultItem() });
function fixture(): DisplayDraft {
  const instances = [node('decoration', 'text', 'DECOR'), node('context', 'context-used'), node('cost', 'session-cost')];
  return updateDisplay(config([]), { instances, layout: { mode: 'explicit', rows: [instances.map(n => n.id)] } });
}
function grouped(display = fixture(), shared_powerline = false) {
  return editGroup(display, 'main', { action: 'create', id: 'context-group', member_ids: ['decoration', 'context'], primary_id: 'context', shared_powerline }, () => 'unused');
}
test('group validation rejects noncontinuous, nested, cross-row, spacer and invalid primary references without mutation', () => {
  const display = grouped(), before = JSON.stringify(display);
  assert(validGroups(display.groups, display.instances, display.layout));
  assert(isDraft({ display, host: DEFAULT_HOST }));
  const g = display.groups[0]!;
  for (const patch of [
    { member_ids: ['decoration'] }, { member_ids: ['context', 'decoration'] },
    { member_ids: ['decoration', 'cost'], primary_id: 'cost' },
    { primary_id: 'decoration' }, { primary_id: 'unknown' }, { link_visibility: 1 },
  ]) assert.throws(() => validateDisplay({ ...display, groups: [{ ...g, ...patch }] }));
  assert.throws(() => validateDisplay({ ...display, groups: [g, { ...g, id: 'overlap' }] }));
  assert.throws(() => validateDisplay({ ...display, layout: { mode: 'explicit', rows: [['decoration'], ['context', 'cost']] } }));
  assert.throws(() => validateDisplay({ ...display, instances: display.instances.map(n => n.id === 'decoration' ? node('decoration', 'spacer') : n) }));
  assert.equal(JSON.stringify(display), before);
});
test('group copy, instance copy, delete and ungroup preserve identities and options', () => {
  let display = grouped(); let serial = 0;
  display = editGroup(display, 'main', { action: 'copy', id: 'context-group' }, () => 'copy-' + ++serial);
  assert.equal(display.groups.length, 2);
  assert.deepEqual(display.groups[1]!.member_ids, ['copy-1', 'copy-2']);
  assert.equal(display.groups[1]!.primary_id, 'copy-2');
  display = edit(display, 'main', { action: 'copy', id: 'decoration' }, () => 'standalone').config;
  assert.equal(display.instances.findIndex(n => n.id === 'standalone'), 2);
  assert(!display.groups.some(g => g.member_ids.includes('standalone')));
  display = edit(display, 'main', { action: 'remove', id: 'context' }, () => 'unused').config;
  assert.equal(display.groups.length, 1);
  assert(display.instances.some(n => n.id === 'decoration'));
  display = editGroup(display, 'main', { action: 'ungroup', id: display.groups[0]!.id }, () => 'unused');
  assert.equal(display.groups.length, 0);
  assert.equal(display.instances.find(n => n.id === 'copy-1')!.text, 'DECOR');
});
test('primary final visibility governs decoration while other metrics retain their own values', () => {
  let display = grouped();
  assert(!rendered({ cost: { total_cost_usd: 1 } }, display).includes('DECOR'));
  display.instances[1]!.options.visibility = 'used-at-least';
  assert(!rendered({ context_window: { used_percentage: 50 }, cost: { total_cost_usd: 1 } }, display).includes('DECOR'));
  display = editGroup(display, 'main', { action: 'set', id: 'context-group', member_ids: ['decoration', 'context', 'cost'] }, () => 'unused');
  const trace = new RenderTrace(display); trace.begin('main', 'main');
  const output = rendered({ cost: { total_cost_usd: 0 } }, display, { trace });
  assert.match(output, /0.00/); assert(!output.includes('DECOR'));
  assert.equal(trace.layouts('main', 'decoration')[0]!.outcome, 'group_hidden');
  display = editGroup(display, 'main', { action: 'set', id: 'context-group', link_visibility: false }, () => 'unused');
  assert(rendered({ cost: { total_cost_usd: 1 } }, display).includes('DECOR'));
});
test('groups remain atomic in auto, explicit, spacer and narrow Powerline layouts', () => {
  for (const separator_style of ['classic', 'compact', 'powerline'] as const)
    for (const mode of ['auto', 'explicit'] as const)
      for (const use_colors of [false, true]) {
        let display = grouped();
        display = updateDisplay(display, { separator_style, use_colors, layout: { mode, rows: mode === 'auto' ? [] : [['decoration', 'context', 'cost']] } });
        display.groups[0]!.shared_powerline = true;
        const data = { context_window: { used_percentage: 85 }, cost: { total_cost_usd: 10 } };
        for (const width of [2, 4, 12, 40, 80, 120]) {
          const output = rendered(data, display, {}, width);
          for (const row of output.split('\n')) {
            assert(displayWidth(row) <= width, JSON.stringify({ separator_style, mode, width, row }));
            if (row.includes('DECOR')) assert(row.includes('85%'), 'decorations never wrap away from their primary');
          }
        }
      }
});

test('explicit groups preserve semantic separators for adjacent standalone components on every main row', () => {
  const layout = { mode: 'explicit' as const, rows: [
    ['model-with-effort', 'thinking', 'fast-mode', 'hostname', 'project-name', 'current-dir'],
    ['context-tokens', 'context-used', 'context-window-size', 'tokens', 'session-cost', 'cache-state', 'cache-expires'],
    ['run-state', 'last-tool', 'task-progress', 'output-rate', 'active-agents'],
  ] };
  const input = {
    model: { id: 'claude-sonnet-5-5' }, effort: { level: 'high' }, thinking: { enabled: true }, fast_mode: true,
    workspace: { current_dir: '/test/sample/subdir', project_dir: '/test/sample' },
    context_window: { used_percentage: 34, context_window_size: 1000000, total_input_tokens: 343100 },
    cost: { total_cost_usd: 0.23 }, prompt_cache: { warm: true, expires_at: NOW / 1000 + 300 },
  };
  const sources = {
    ...env, hostname: () => 'test-host', live: () => ({}),
    usage: () => ({ hit: '0', miss: '0', out: '0', last_prompt: null, entry: {}, counts: null }),
  };
  for (const separator_style of ['classic', 'compact'] as const) for (const use_colors of [false, true]) {
    let display = config(layout.rows.flat(), { layout, separator_style, use_colors });
    display.instances.find(n => n.id === 'context-used')!.options.presentation = 'bar';
    display = editGroup(display, 'main', {
      action: 'create', id: 'context-block', member_ids: ['context-tokens', 'context-used'], primary_id: 'context-tokens',
    }, () => 'unused');
    const outer = separator_style === 'classic' ? ' | ' : ' · ';
    const rows = configuredRows(input, display, 150, sources);
    assert.deepEqual(rows.map(strip), [
      ['claude-sonnet-5-5 high · thinking · fast', 'Host test-host · Project sample · /test/sample/subdir'].join(outer),
      ['Context 343.1K / 1M [███░░░░░] Context 34% used', '1M window', 'hit 0 · miss 0 · out 0 · Cost $0.23 · Cache warm · Cache TTL 5m 0s'].join(outer),
      'State — · Tool — · Tasks — · Rate — · Agents —',
    ]);
    assert(rows.every(row => displayWidth(row) <= 150));
    if (use_colors) {
      assert(rows.every(row => row.endsWith('\x1b[0m')));
      for (const dot of styledUnits(rows[0]!).filter(unit => unit.text === '·'))
        assert.deepEqual(parse(dot.style).foreground, ['ansi', 8]);
    } else assert.deepEqual(rows, rows.map(strip));
  }
});

test('ordinary grouped rows join surviving standalone neighbors after fitting and respect physical boundaries', () => {
  const instances = [
    node('model', 'model'), node('decoration', 'text', 'DEC'), node('context', 'context-used'),
    node('thinking', 'thinking'), node('fast', 'fast-mode'),
  ];
  instances[2]!.options.priority = 0;
  instances[2]!.options.formatting.labels = 'off';
  const output = 'M · thinking · fast';
  const ids = instances.map(n => n.id);
  const display = grouped(updateDisplay(config([]), { instances, layout: { mode: 'explicit', rows: [ids] } }));
  const input = { model: { id: 'M' }, thinking: { enabled: true }, fast_mode: true, context_window: { used_percentage: 50 } };
  const trace = new RenderTrace(display);
  trace.begin('main', 'main');
  assert.equal(rendered(input, display, { trace }, 19), output);
  for (const id of ['context', 'decoration']) assert.equal(trace.layouts('main', id)[0]!.outcome, 'priority_omitted');
  for (const id of ['model', 'thinking', 'fast']) assert.equal(trace.layouts('main', id)[0]!.outcome, 'visible');
  const automatic = updateDisplay(display, { layout: { mode: 'auto', rows: [] } });
  assert.equal(rendered(input, automatic, {}, 19), 'M | DEC 50% used\nthinking · fast');
  const spaced = updateDisplay(display, {
    instances: [...instances.slice(0, 3), node('gap', 'spacer'), ...instances.slice(3)],
    layout: { mode: 'explicit', rows: [['model', 'decoration', 'context', 'gap', 'thinking', 'fast']] },
  });
  assert.equal(rendered({ ...input, context_window: {} }, spaced, {}, 32), 'M' + ' '.repeat(16) + 'thinking · fast');
});

test('an adaptive unit that cannot fit leaves neither separators nor a scope-only row', () => {
  const context = node('context', 'context-used');
  context.options.presentation = 'adaptive';
  const instances = [node('left', 'model'), context, node('right', 'model')];
  const input = { model: { id: 'M' }, context_window: { used_percentage: 50 } };
  for (const mode of ['auto', 'explicit'] as const) {
    const display = updateDisplay(config([]), {
      instances, layout: { mode, rows: mode === 'auto' ? [] : [['left', 'context', 'right']] },
    });
    const trace = new RenderTrace(display);
    trace.begin('main', 'main');
    assert.equal(rendered(input, display, { trace }, 5), 'M · M');
    assert.equal(trace.layouts('main', 'context')[0]!.outcome, 'width_omitted');
    assert.equal(trace.layouts('main', 'right')[0]!.outcome, 'visible');
    const onlyIndicator = updateDisplay(display, {
      scope_labels: 'always', instances: [context], layout: { mode, rows: mode === 'auto' ? [] : [['context']] },
    });
    assert.deepEqual(configuredRows(input, onlyIndicator, 5, env), []);
  }
});

test('Powerline keeps standalone semantic neighbors separate and shares only explicit groups', () => {
  const instances = [node('model', 'model'), node('thinking', 'thinking'), node('decoration', 'text', 'DECOR'), node('context', 'context-used')];
  const layout = { mode: 'explicit' as const, rows: [instances.map(n => n.id)] };
  const input = { model: { id: 'M' }, thinking: { enabled: true }, context_window: { used_percentage: 50 } };
  for (const use_colors of [false, true]) for (const shared of [false, true]) {
    const display = grouped(updateDisplay(config([]), { instances, layout, separator_style: 'powerline', use_colors }), shared);
    display.powerline.padding = 'none';
    display.powerline.end_cap = false;
    assert.equal(rendered(input, display), shared ? 'M>thinking>DECOR Context 50% used' : 'M>thinking>DECOR>Context 50% used');
  }
});

test('shared Powerline changes only backgrounds and preserves member foregrounds and saved backgrounds', () => {
  let display = grouped(); display.separator_style = 'powerline'; display.use_colors = true;
  display.instances[0]!.options.foreground = '#123456'; display.instances[0]!.options.background = '#654321';
  display.instances[1]!.options.background = '#abcdef'; display.groups[0]!.shared_powerline = true;
  const text = configuredRows({ context_window: { used_percentage: 50 } }, display, 120, env).join('');
  const decoration = styledUnits(text).find(u => u.text === 'D')!;
  assert.deepEqual(parse(decoration.style).foreground, ['rgb', '#123456']);
  assert.deepEqual(parse(decoration.style).background, ['rgb', '#abcdef']);
  assert.equal(display.instances[0]!.options.background, '#654321');
});

test('explicit spacers preserve group alignment and moves keep whole groups together', () => {
  let display = grouped();
  display.instances.splice(2, 0, node('gap', 'spacer'));
  display.layout = { mode: 'explicit', rows: [['decoration', 'context', 'gap', 'cost']] };
  display.instances[0]!.options.priority = 0;
  display.instances[1]!.options.priority = 100;
  display.instances[3]!.options.priority = 1;
  for (const separator_style of ['classic', 'powerline'] as const) {
    display.separator_style = separator_style;
    for (const width of [4, 12, 40, 80]) {
      const row = rendered({ context_window: { used_percentage: 85 }, cost: { total_cost_usd: 10 } }, display, {}, width);
      assert(displayWidth(row) <= width);
      if (row.includes('DECOR')) assert(row.includes('85%'));
      if (width === 80) assert.equal(displayWidth(row), width);
    }
  }
  display = editGroup(display, 'main', { action: 'move', id: 'context-group', after: 'cost' }, () => 'unused');
  assert.deepEqual(display.layout.rows, [['gap', 'cost', 'decoration', 'context']]);
  assert.deepEqual(validateDisplay(display).groups, display.groups);
  const before = JSON.stringify(display);
  assert.throws(() => edit(display, 'main', { action: 'add', type_id: 'text', after: 'missing' }, () => 'extra'));
  assert.equal(JSON.stringify(display), before);
});

test('agent grouping evaluates each agent independently', () => {
  const display = defaultDisplay(); display.use_colors = false;
  display.subagents.instances = [node('decoration', 'text', 'DECOR'), node('context', 'context-used')];
  const groupedAgents = editGroup(display, 'subagent', { action: 'create', member_ids: ['decoration', 'context'], primary_id: 'context' }, () => 'agent-group');
  assert.match(renderTask(task(), groupedAgents, env, 80), /DECOR.*42%/);
  assert.equal(renderTask(task({ tokenCount: null }), groupedAgents, env, 80), '');
});

test('user scope identifiers cannot alias synthetic labels or leave labels alone on narrow rows', () => {
  const display = grouped(); display.groups[0]!.id = 'scope';
  display.instances = display.instances.filter(n => n.id !== 'cost');
  display.layout = { mode: 'auto', rows: [] };
  const input = { context_window: { used_percentage: 50 } };
  assert(rendered(input, validateDisplay(display)).includes('50%'));
  display.scope_labels = 'always';
  for (const width of [2, 4, 12, 24, 80]) {
    const rows = rendered(input, display, {}, width).split('\n');
    assert.equal(rows.length, 1, 'scope labels cannot occupy a row without group content');
    assert(rows.every(row => displayWidth(row) <= width && row.trim() !== env.language.text('scope.main')));
  }
  display.groups[0]!.member_ids[1] = 'scope'; display.groups[0]!.primary_id = 'scope'; display.instances[1]!.id = 'scope';
  assert(rendered(input, validateDisplay(display)).includes('50%'));
});
test('CLI, both editors shared group operations, import and save conflicts use the same draft rules', t => {
  const f = setup(t, true), initial = f.read(); initial.draft.display = fixture(); assert.equal(f.save(initial).status, 0);
  configCommand(['group', 'main', 'create', 'group', '--members', 'decoration,context', '--primary', 'context'], f.service);
  const saved = f.read(), bytes = readFileSync(f.displayPath);
  assert.throws(() => configCommand(['group', 'main', 'set', 'group', 'primary', 'decoration'], f.service));
  assert.deepEqual(readFileSync(f.displayPath), bytes);
  const file = join(f.root, 'groups.json'); exportFile(file, saved.draft, f.root);
  assert.deepEqual(importFile(file, saved.draft).display.groups, saved.draft.display.groups);
  for (const language of LANGUAGES) {
    const e = new Editor(f.call('describe').response.result, saved);
    openGroups(e); e.groupManager!.cursor = 1;
    groupsKey(e, { key: 'enter' }); groupsKey(e, { key: 'enter' });
    e.groupManager!.cursor = 4; groupsKey(e, { key: 'right' });
    const rows = groupsView(e, language, 64, 12);
    assert(rows.length <= 12); assert(!rows.some(row => row.text.includes('composition.groups.')));
    groupsKey(e, { key: 'escape' }); assert.deepEqual(e.draft, saved.draft, 'cancel discards uncommitted form choices');
    e.groupManager!.cursor = 1; groupsKey(e, { key: 'enter' }); groupsKey(e, { key: 'enter' });
    e.groupManager!.cursor = 4; groupsKey(e, { key: 'right' }); e.groupManager!.cursor = 5; groupsKey(e, { key: 'enter' });
    assert.equal(e.draft.display.groups[0]!.shared_powerline, true);
    assert.deepEqual(readFileSync(f.displayPath), bytes, 'group editing does not save implicitly');
  }
  configCommand(['group', 'main', 'set', 'group', 'powerline', 'on'], f.service);
  assert.equal(f.save(saved).status, 2, 'stale draft cannot overwrite a group edit');
});
