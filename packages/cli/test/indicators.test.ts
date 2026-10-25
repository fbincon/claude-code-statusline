import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultDisplay, validateDisplay } from '@fbincon/statusline-core/config/display';
import { edit, updateDisplay } from '@fbincon/statusline-core/config/instances';
import { itemFields, setField } from '@fbincon/statusline-core/config/editor-fields';
import { isDraft } from '@fbincon/statusline-core/editor/backend';
import { indicator } from '@fbincon/statusline-core/rendering/indicators';
import { renderTask } from '@fbincon/statusline-core/rendering/subagents';
import { displayWidth } from '@fbincon/statusline-core/rendering/layout';
import { LANGUAGES } from '@fbincon/statusline-core/i18n/registry';
import { Presentation } from '@fbincon/statusline-core/rendering/language';
import { config, env, rendered, agentConfig, task, NOW } from './render-support.js';
import { DEFAULT_HOST } from '@fbincon/statusline-core/config/draft';
import { setup } from './final-support.js';
import { Editor } from '@fbincon/statusline-core/editor/draft';
import { formRows, setFormValue } from '@fbincon/statusline-core/editor/forms';

test('bars preserve numbers, direction, observation validity and raw visibility thresholds', () => {
  const input = { context_window: { used_percentage: 49.6, remaining_percentage: 50.4 } };
  let cfg = config(['context-used']);
  const baseline = rendered(input, cfg);
  cfg = setField(cfg, 'presentation', 'bar', 'main', 'context-used');
  cfg = setField(cfg, 'bar_style', 'ascii', 'main', 'context-used');
  assert.equal(rendered(input, cfg), '[####----] ' + baseline);
  assert.equal(rendered({ context_window: { used_percentage: 0 } }, cfg), '[--------] Context 0% used');
  assert.equal(rendered({ context_window: { used_percentage: 100 } }, cfg), '[########] Context 100% used');
  for (const used_percentage of [null, undefined, -1, Infinity, NaN, 101, true, 'bad'])
    assert.equal(rendered({ context_window: { used_percentage } }, cfg), '');
  cfg = setField(cfg, 'visibility', 'used-at-least', 'main', 'context-used');
  cfg = setField(cfg, 'visibility_threshold', 50, 'main', 'context-used');
  assert.equal(rendered(input, cfg), '');
  let quotas = config(['five-hour-limit']);
  quotas = setField(quotas, 'presentation', 'bar', 'main', 'five-hour-limit');
  quotas = setField(quotas, 'bar_style', 'ascii', 'main', 'five-hour-limit');
  assert.match(rendered({ rate_limits: { five_hour: { used_percentage: 25 } } }, quotas), /^\[######--\].*75%/);
  assert.equal(rendered({ rate_limits: { five_hour: { used_percentage: 25, resets_at: NOW / 1000 } } }, quotas), '');
  quotas = setField(quotas, 'allowance', 'used', 'main', 'five-hour-limit');
  assert.match(rendered({ rate_limits: { five_hour: { used_percentage: 125 } } }, quotas), /^\[########\].*125%/);
});

test('indicator configuration has identical CLI/editor validation and portable identity', () => {
  let cfg = config(['context-used']);
  assert(itemFields('main', 'context-used').some(field => field.key === 'presentation'));
  assert(!itemFields('main', 'model').some(field => field.key === 'presentation'));
  cfg = edit(cfg, 'main', { action: 'set', id: 'context-used', option: 'bar-width', value: '12' }, () => 'unused').config;
  cfg = edit(cfg, 'main', { action: 'copy', id: 'context-used' }, () => 'second-context').config;
  cfg = setField(cfg, 'presentation', 'bar', 'main', 'second-context');
  const reopened = validateDisplay(JSON.parse(JSON.stringify(cfg)));
  assert.deepEqual(reopened, cfg);
  assert.equal(isDraft({ display: reopened, host: DEFAULT_HOST }), true);
  assert.match(rendered({ context_window: { used_percentage: 50 } }, cfg), /Context 50% used.*\[██████░░░░░░\]/);
  for (const width of [0, 3, 21, 4.5, Infinity, 'bad'])
    assert.throws(() => setField(cfg, 'bar_width', width, 'main', 'second-context'));
  const invalid = defaultDisplay();
  invalid.instances[0]!.options.presentation = 'bar';
  assert.throws(() => validateDisplay(invalid));
  assert.equal(isDraft({ display: invalid, host: DEFAULT_HOST }), false);
  const { groups, subagents, ...old } = defaultDisplay();
  const { groups: agentGroups, ...oldAgents } = subagents;
  assert.equal(validateDisplay({ ...old, subagents: oldAgents, schema_version: 10 }).schema_version, 15);
});

test('shared editor forms preview, cancel, save and reopen indicator choices in all languages', t => {
  const f = setup(t, true);
  for (const language of LANGUAGES) {
    const current = f.read(), editor = new Editor(f.call('describe').response.result, current);
    const id = editor.draft.display.instances.find(node => node.type_id === 'context-remaining')!.id;
    editor.detail = { scope: 'main', id };
    const view = { editor, language, message: '' };
    const presentation = formRows(view).find(row => row.spec.key === 'presentation')!;
    assert(presentation);
    assert(setFormValue(view, presentation, 'bar'));
    assert(setFormValue(view, formRows(view).find(row => row.spec.key === 'bar_width')!, '12'));
    assert.equal(f.read().revision, current.revision, 'editing has no save side effect');
    const preview = f.call('preview', { draft: editor.draft, width: 80 });
    assert.equal(preview.status, 0);
    const saved = f.save({ ...current, draft: editor.draft });
    assert.equal(saved.status, 0);
    assert.equal(f.read().draft.display.instances.find((node: any) => node.id === id).options.bar_width, 12);
  }
});

test('bars fit explicit spacer rows and Powerline without exceeding cell bounds', () => {
  for (const separator_style of ['classic', 'compact', 'powerline'] as const)
    for (const use_colors of [false, true]) {
      let cfg = config(['context-used', 'spacer', 'context-remaining'], {
        separator_style, use_colors, theme: 'dark',
        layout: { mode: 'explicit', rows: [['context-used', 'spacer', 'context-remaining']] },
      });
      for (const id of ['context-used', 'context-remaining']) {
        cfg = setField(cfg, 'presentation', 'bar', 'main', id);
        cfg = setField(cfg, 'bar_width', 20, 'main', id);
        cfg = setField(cfg, 'label', '中文👩‍💻', 'main', id);
      }
      for (const width of [4, 12, 40, 80, 120]) {
        const value = rendered({ context_window: { used_percentage: 50, remaining_percentage: 50 } }, cfg, {}, width);
        assert(value.split('\n').every(row => displayWidth(row) <= width));
        assert(!value.includes('\uFFFD'));
      }
    }
});

test('bars retain semantics with labels off, ASCII/no color, narrow rows and independent agents', async () => {
  let cfg = config(['context-used'], { layout: { mode: 'explicit', rows: [['context-used']] } });
  for (const [key, value] of [['presentation', 'bar'], ['labels', 'off'], ['icons', 'ascii'], ['label', '界👩‍💻']] as const)
    cfg = setField(cfg, key, value, 'main', 'context-used');
  for (const lang of LANGUAGES) {
    const { MESSAGES } = await import('@fbincon/statusline-core/i18n/statusline/' + lang);
    const language = new Presentation(lang, MESSAGES);
    const value = indicator({ context_window: { used_percentage: 50 } }, 'context-used', 'main', cfg.instances[0]!.options, { ...cfg.formatting, icons: 'ascii' }, language, 0)!;
    assert.match(value, /^\[####----\]/);
    assert(value.includes('50'));
    for (const width of [40, 80, 120]) {
      const output = rendered({ context_window: { used_percentage: 50 } }, cfg, { language }, width);
      assert(output.split('\n').every(row => displayWidth(row) <= width));
    }
  }
  let agents = agentConfig(['context-used']);
  agents = setField(agents, 'presentation', 'bar', 'subagent', 'context-used');
  agents = setField(agents, 'bar_style', 'ascii', 'subagent', 'context-used');
  assert.match(renderTask(task({ tokenCount: 100000 }), agents, env, 80), /\[####----\]/);
  assert.match(renderTask(task({ tokenCount: 50000 }), agents, env, 80), /\[##------\]/);
  assert.equal(renderTask(task({ tokenCount: null }), agents, env, 80), '');
  let remaining = agentConfig(['context-remaining']);
  const half = task({ tokenCount: 1, contextWindowSize: 200 });
  const numeric = renderTask(half, remaining, env, 80);
  remaining = setField(remaining, 'presentation', 'bar', 'subagent', 'context-remaining');
  assert(renderTask(half, remaining, env, 80).endsWith(numeric));
});
