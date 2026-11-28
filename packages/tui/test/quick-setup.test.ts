import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, plain } from './fixtures.js';
import { receivePreset, type QuickSetup } from '@fbincon/statusline-core/editor/quick-setup';
import { applyPreset } from '@fbincon/statusline-core/config/presets';
import { performProfileAction } from '@fbincon/statusline-core/editor/profile-manager';
import { Session, type Backend } from '../src/session.js';
import { t } from '@fbincon/statusline-core/i18n/messages';
import { SetupState } from '@fbincon/statusline-core/editor/setup';
import { setupFrame } from '../src/setup.js';

test('loading a quick setup candidate shows the appearance step and keeps the display save key inactive', async () => {
  const state = fixture(), editor = state.editor;
  editor.shortcuts.snapshot.bindings = { save: 'Z' };
  const calls: string[] = [];
  const session = new Session(state, { request(operation: string) {
    calls.push(operation);
    if (operation === 'preset') return { draft: editor.draft };
    if (operation === 'preview') return state.preview;
    throw new Error('Unexpected ' + operation);
  } } as Backend);
  await session.key({ key: 'p', ctrl: true });
  await session.key({ key: 'return' });
  assert.equal(editor.quick?.step, 'appearance');
  assert(plain(state).join('\n').includes(t('quick.preset-ready', 'en')));
  assert.equal(await session.key({ key: 'z' }), null);
  assert.equal(editor.quick?.step, 'appearance');
  assert(!calls.includes('apply'));
  await session.key({ key: 'escape' });
  assert(!plain(state).join('\n').includes(t('quick.preset-ready', 'en')));
});

test('quick setup cancels without changing dirty drafts and only accepts at the final step', () => {
  const state=fixture(), e=state.editor; const quick = () => e.quick as QuickSetup; e.draft.display.use_colors=false;
  const original=JSON.stringify(e.draft);
  state.key({key:'p',ctrl:true}); assert.ok(e.quick);
  assert.equal(state.key({key:'return'}),'transfer');
  receivePreset(quick(),{display:applyPreset(quick().base.display,e.preset,()=> 'new'),host:quick().base.host});
  state.key({key:'right'});state.key({key:'escape'});
  assert.equal(e.quick,null);assert.equal(JSON.stringify(e.draft),original);
  state.key({key:'p',ctrl:true});state.key({key:'return'});
  receivePreset(quick(),{display:applyPreset(quick().base.display,e.preset,()=> 'new'),host:quick().base.host});
  state.key({key:'end'});state.key({key:'return'});
  assert.ok(plain(state).join('\n').includes('Continue editing'));
  assert.equal(state.key({key:'return'}),null);assert.equal(e.quick,null);
  assert.equal(e.draft.display.layout.mode,'explicit');assert.equal(e.baseline.draft.display.layout.mode,'auto');
});
test('Quick setup saves a copy without replacing a pre-existing dirty draft', async () => {
  const state=fixture(),e=state.editor;e.draft.display.use_colors=false;
  const original=JSON.stringify(e.draft);
  state.key({key:'p',ctrl:true});state.key({key:'end'});state.key({key:'return'});
  receivePreset(e.quick!,{display:applyPreset(e.quick!.base.display,e.preset,()=> 'new'),host:e.quick!.base.host});
  state.key({key:'end'});state.key({key:'return'});state.key({key:'down'});state.key({key:'down'});
  assert.equal(state.key({key:'return'}),'profiles');
  await performProfileAction(e,{request:async operation=>{assert.equal(operation,'profiles_read');return {version:1,revision:'1'.repeat(64),profiles:[],bindings:[]} as never;}});
  assert.equal(e.profiles!.page,'form');assert.equal(e.profiles!.candidate!.theme,'light');
  state.key({key:'escape'});state.key({key:'escape'});
  assert.equal(JSON.stringify(e.draft),original);
});

test('the appearance next action stays visible at 64×18 and the first reverse page moves', () => {
  for (const language of ['en', 'zh-CN'] as const) {
    const state = fixture(language), e = state.editor;
    const key = (key: string, ctrl = false) => state.key({ key, ctrl }, 64, 18);
    key('p', true); key('return');
    const quick = e.quick!;
    const candidate = structuredClone(e.draft);
    quick.preset = 'agent-focus';
    candidate.display.subagents.enabled = false;
    receivePreset(quick, candidate);
    const screen = () => plain(state, 64, 18).join('\n');
    assert(screen().includes(t('quick.next', language)));
    for (let index = 0; index < 20; index++) key('pagedown');
    const last = screen();
    key('pageup');
    assert.notEqual(screen(), last);
    key('end'); key('return');
    assert.equal(quick.step, 'review');
    key('escape'); assert.equal(e.modified, false);
  }
});

test('first setup review leads with the available save action and the integration blocker', () => {
  for (const language of ['en', 'zh-CN'] as const) {
    const sample = fixture(language), draft = sample.editor.draft;
    const state = new SetupState({
      checks: [{ level: 'WARN', message: 'Host detected 2.1.204' }], resources: ['/sample/settings.json'],
      notes: [], draft, hasDisplay: true, canSave: true, canIntegrate: false,
    }, language);
    const adapter = { preset: () => draft, preview: () => sample.preview!, language: () => {},
      review: () => Array.from({ length: 24 }, (_, index) => 'Change ' + (index + 1)) };
    state.key('return'); state.key('return');
    const screen = () => setupFrame(state, adapter, 64, 18, 0);
    assert(screen().includes('> ' + t('setup.save', language)));
    assert(screen().includes('Host detected 2.1.204'));
    assert(!screen().includes('/sample/settings.json'));
    assert.equal(state.key('return'), 'save');
  }
});
