import { clientKey } from '../fixtures.ts';
import { component } from '../fixtures.ts';
import { expect, test } from 'claude-code/testing';
import { setup, START, RUN, PANE, keys, reply, output, selectSetting, visibleText } from '../fixtures.ts';
import { copyDraft } from '../../lib/editor/draft.ts';
import { differences } from '../../lib/editor/import-differences.ts';
import { t } from '../../lib/i18n/index.ts';
import { PROTOCOL_VERSION } from '../../lib/generated-contracts.ts';

test('Settings file transfers keep the path and its caret on failure and close on success', {timeoutMs: 20000}, async ($, on) => {
  const fixture = setup(on);
  const stored = copyDraft(fixture.store.draft);
  fixture.behavior.process = (request, next) => {
    const { operation } = request;
    if (operation !== 'review_import' && operation !== 'export') return next();
    const { draft, path } = request.payload;
    expect(draft.display.use_colors).toBe(!stored.display.use_colors);
    if (operation === 'export') expect(request.payload.overwrite).toBe(false);
    if (path === '/draft.json') return { value: output(JSON.stringify({
      protocol_version: PROTOCOL_VERSION, error: {
        code: 'io_error', message: operation === 'review_import' ? 'Missing file' : 'Destination exists', localization: null,
      },
    }), 2) };
    return { value: reply(operation === 'review_import' ? { draft, changes: [] } : { path }) };
  };
  await $.session.start(START);
  await $.command.run(RUN);
  const ui = await $.ui.mount({ ...PANE, props: { ...PANE.props, bodyColumns: 72 } });
  await keys(ui, '4', ' ');
  for (const action of ['import', 'export'] as const) {
    const operation = action === 'import' ? 'review_import' : 'export';
    await selectSetting(ui, action + '-file');
    await keys(ui, 'return', {key:'u',ctrl:true}, '/draft.json', 'home', 'right', 'return');
    const failed = (await visibleText(ui)).replace(/ +/gu, ' ');
    expect(failed).toContain(action === 'import' ? 'Missing file' : 'Destination exists');
    expect(failed).toContain('Enter ' + t(action === 'import' ? 'ui.hints.read_file' : 'ui.hints.export_new_file', 'en'));
    await keys(ui, 'x', 'return');
    const paths = fixture.calls.filter(call => call.operation === operation).map(call => call.payload.path);
    expect(paths).toEqual(['/draft.json', '/xdraft.json']);
    expect((await visibleText(ui)).replace(/ +/gu, ' ')).not.toContain('Enter ' +
      t(action === 'import' ? 'ui.hints.read_file' : 'ui.hints.export_new_file', 'en'));
    if (action === 'import') await keys(ui, {key:'g',ctrl:true});
  }
  expect(fixture.store.draft).toEqual(stored);
  expect(fixture.calls.some(call => call.operation === 'apply')).toBe(false);
  await ui.unmount();
});

test('appearance edits save one complete draft without applying host settings', {timeoutMs: 20000}, async ($, on) => {
  const fixture = setup(on);
  fixture.store.draft.display.instances = ['context-used'].map(id=>component(id));
  await $.session.start(START);
  await $.command.run(RUN);
  const ui = await $.ui.mount(PANE);
  await keys(ui, {key:'e',ctrl:true});
  await selectSetting(ui, 'item:visibility');
  await keys(ui, 'right');
  await selectSetting(ui, 'item:visibility_threshold');
  await keys(ui, 'return', {key:'u',ctrl:true}, '8', '5', 'return');
  await selectSetting(ui, 'item:foreground');
  await keys(ui,'return','end','up','up','return',{key:'u',ctrl:true},'#ABCDEF','return',{key:'s',ctrl:true});
  await selectSetting(ui, 'item:background');
  await keys(ui,'return','end','up','up','return',{key:'u',ctrl:true},'ansi:17','return',{key:'s',ctrl:true});
  expect(fixture.calls.some(c => c.operation === 'apply')).toBe(false);
  await keys(ui, {key:'g',ctrl:true}, '4');
  await selectSetting(ui, 'field:theme');
  await keys(ui, 'right');
  await selectSetting(ui, 'separator-style');
  await keys(ui, 'right', 'right', 's');
  const d = fixture.store.draft.display;
  expect(d.theme).toBe('dark');
  expect(d.separator_style).toBe('powerline');
  expect(d.powerline_glyph).toBe('ascii');
  expect(d.instances.find(i=>i.id==='context-used')!.options?.foreground).toBe('#abcdef');
  expect(d.instances.find(i=>i.id==='context-used')!.options?.background).toBe('ansi:17');
  expect(d.instances.find(i=>i.id==='context-used')!.options?.visibility).toBe('used-at-least');
  expect(d.instances.find(i=>i.id==='context-used')!.options?.visibility_threshold).toBe(85);
  expect(fixture.configCalls).toEqual([]);
  expect(fixture.calls.filter(c => c.operation === 'apply').length).toBe(1);
  await ui.unmount();
});

test('item format and explicit layout save a complete draft while text reserves shortcuts', {timeoutMs: 20000}, async ($, on) => {
  const fixture = setup(on);
  await $.session.start(START);
  await $.command.run(RUN);
  const ui = await $.ui.mount(PANE);
  await keys(ui, {key:'E',ctrl:true}, 'return', {key:'U',ctrl:true}, 's', 'F', 'Q', '中', '文', 'return');
  expect(fixture.calls.some((c) => c.operation === 'apply')).toBe(false);
  await selectSetting(ui, 'item:priority');
  await keys(ui, 'return', {key:'u',ctrl:true}, '1', '0', '0', 'return');
  await selectSetting(ui, 'item:max_width');
  await keys(ui, 'return', {key:'u',ctrl:true}, '5', 'return', {key:'g',ctrl:true}, '3', 'home', 'return', 's');
  const d = fixture.store.draft.display;
  expect(d.instances.find(i=>i.id==='model-with-effort')!.options?.label).toBe('sFQ中文');
  expect(d.instances.find(i=>i.id==='model-with-effort')!.options?.priority).toBe(100);
  expect(d.instances.find(i=>i.id==='model-with-effort')!.options?.max_width).toBe(5);
  expect(d.layout).toEqual({mode:'explicit',rows:[['model-with-effort']]});
  expect(fixture.calls.filter((c) => c.operation === 'apply').length).toBe(1);
  expect(fixture.calls.find((c) => c.operation === 'apply')!.payload.expected_revision).toBe('0'.repeat(64));
  await ui.unmount();
});

test('preset/import only replace drafts; export includes unsaved draft and cancel avoids saves', {timeoutMs: 20000}, async ($, on) => {
  const fixture = setup(on);
  fixture.store.shortcuts = { schema_version: 1, bindings: { save: 'Q', close: 'Z', 'close-picker': 'Z' }, revision: '3'.repeat(64), warning: null };
  const imported = copyDraft(fixture.store.draft);
  imported.display.formatting.number_format = 'grouped';
  imported.host.padding = 7;
  const expanded = copyDraft(imported);
  expanded.host.padding = 5;
  fixture.behavior.process = (request, next) => {
    if (request.operation === 'preset') return {value:reply({draft:expanded})};
    if (request.operation === 'review_import') return {value:reply({draft:imported,changes:differences(request.payload.draft, imported)})};
    if (request.operation === 'export') return {value:reply({path:request.payload.path})};
    return next();
  };
  await $.session.start(START);
  await $.command.run(RUN);
  const ui = await $.ui.mount(PANE);
  await keys(ui, '4');
  await selectSetting(ui, 'preset-apply');
  await keys(ui, 'return');
  expect(fixture.calls.some((c) => c.operation === 'preset')).toBe(true);
  expect((await visibleText(ui)).replace(/ +/gu, ' ')).toContain(t('shortcuts.native-preset-applied', 'en', { save: 'Q', close: 'Z' }));
  expect(fixture.store.draft.host.padding).toBe(0);
  await selectSetting(ui, 'import-file');
  await keys(ui, 'return', {key:'u',ctrl:true}, '/', '中', 'space', '文', '.', 'j', 's', 'o', 'n', 'return');
  expect(fixture.calls.find((c) => c.operation === 'review_import')!.payload.path).toBe('/中 文.json');
  await keys(ui, 'a');
  await selectSetting(ui, 'export-file');
  await keys(ui, 'return', 'return');
  const exported = fixture.calls.find((c) => c.operation === 'export')!;
  expect(exported.payload.draft.host.padding).toBe(7);
  expect(exported.payload.overwrite).toBe(false);
  expect(fixture.calls.some((c) => c.operation === 'apply')).toBe(false);
  await keys(ui, 'z');
  expect(fixture.closes).toHaveLength(1);
  expect(fixture.calls.filter(c => c.operation === 'apply')).toHaveLength(0);
  expect(fixture.store.draft.host.padding).toBe(0);
  await ui.unmount();
});

test('actual host row aliases apply separately and unavailable behavior rows remain guidance', {timeoutMs: 20000}, async ($, on) => {
  const fixture = setup(on);
  fixture.store.rows.push({key:'turnDuration',label:'Show turn duration',kind:'boolean',value:true,provider:{plugin:'engine',tier:'core'},isLocked:false});
  await $.session.start(START);
  await $.command.run(RUN);
  const ui = await $.ui.mount({...PANE, props: {...PANE.props, bodyColumns: 120}});
  await keys(ui, '4', 'H');
  await selectSetting(ui, 'host-turnDuration');
  await keys(ui, ' ', 'A');
  expect(fixture.configCalls).toEqual([{key:'turnDuration',value:false}]);
  expect(fixture.calls.some((c) => c.operation === 'apply')).toBe(false);
  await selectSetting(ui, 'host-effort');
  expect(await ui.find({in: await clientKey(ui),type:'Text',text:/Unavailable.*\/effort/})).toBeDefined();
  await keys(ui, ' ', 'a');
  expect(fixture.configCalls.length).toBe(1);
  await ui.unmount();
});

test('changed host kinds and choices are refused per row while independent rows apply', {timeoutMs: 20000}, async ($, on) => {
  const fixture = setup(on);
  fixture.store.rows.push({key:'turnDuration',label:'Show turn duration',kind:'boolean',value:true,provider:{plugin:'engine',tier:'core'},isLocked:false});
  await $.session.start(START);
  await $.command.run(RUN);
  const ui = await $.ui.mount(PANE);
  await keys(ui, '4', 'h');
  await selectSetting(ui, 'host-theme');
  await keys(ui, 'right');
  await selectSetting(ui, 'host-verbose');
  await keys(ui, ' ');
  await selectSetting(ui, 'host-turnDuration');
  await keys(ui, ' ');
  fixture.store.rows = fixture.store.rows.map((row) => row.key === 'theme' ? {...row,kind:'text'} : row.key === 'turnDuration' ? {...row,isLocked:true} : row);
  await keys(ui, 'a');
  expect(fixture.configCalls).toEqual([{key:'verbose',value:true}]);
  await selectSetting(ui, 'host-theme');
  expect(await ui.find({in: await clientKey(ui),type:'Text',text:/Changed elsewhere/})).toBeDefined();
  await keys(ui, 'r', '4', 'h');
  fixture.store.rows = fixture.store.rows.map((row) => row.key === 'theme' ? {...row,kind:'choice',options:['dark','light']} : row);
  await keys(ui, 'r', '4', 'h');
  await selectSetting(ui, 'host-theme');
  await keys(ui, 'right');
  fixture.store.rows = fixture.store.rows.map((row) => row.key === 'theme' ? {...row,options:['dark']} : row);
  await keys(ui, 'a');
  expect(fixture.configCalls.length).toBe(1);
  expect(await ui.find({in: await clientKey(ui),type:'Text',text:/Value no longer fits/})).toBeDefined();
  await ui.unmount();
});

test('theme drafts apply separately, refusals preserve the actual theme and recovery stays themed', {timeoutMs: 20000}, async ($, on) => {
  const fixture = setup(on);
  fixture.behavior.configSet = () => ({ deny: 'Theme locked by policy' });
  await $.session.start(START);
  await $.command.run(RUN);
  const ui = await $.ui.mount(PANE);
  for (const key of ['retry-client', 'close']) {
    const button = (await ui.find({ type: 'Button', key }))!;
    expect(button.props.variant).toBe('primary');
    expect(button.props.dimColor).toBe(false);
  }
  await keys(ui, '4', 'h');
  await selectSetting(ui, 'host-theme');
  await keys(ui, 'right');
  expect(fixture.store.rows.find((row) => row.key === 'theme')!.value).toBe('dark');
  expect(fixture.configCalls).toEqual([]);
  await keys(ui, 'a');
  expect(fixture.store.rows.find((row) => row.key === 'theme')!.value).toBe('dark');
  expect(await ui.find({ in: await clientKey(ui), type: 'Text', text: /Refused: Theme locked/ })).toBeDefined();
  fixture.behavior.configSet = (key, value) => ({ value });
  await keys(ui, 'a');
  expect(fixture.store.rows.find((row) => row.key === 'theme')!.value).toBe('light');
  expect(fixture.calls.some((c) => c.operation === 'apply')).toBe(false);
  await keys(ui, '1');
  expect(await ui.find({ in: await clientKey(ui), type: 'Text', text: 'Configure Status Line' })).toBeDefined();
  await ui.unmount();
});

test('compact Claude preferences distinguish pending changes from the confirmed host value', {timeoutMs: 20000}, async ($, on) => {
  const fixture = setup(on);
  fixture.store.rows[1]!.isLocked = true;
  await $.session.start(START);
  await $.command.run(RUN);
  const ui = await $.ui.mount({ ...PANE, props: { ...PANE.props, bodyColumns: 32, scroll: { offset: 0, bodyRows: 12 } } });
  await ui.resize({ columns: 32, rows: 12 });
  await keys(ui, '4', 'h');
  const readsAtOpen = fixture.configReads;
  await keys(ui, 'a');
  expect(await visibleText(ui)).toContain(t('native.host_no_pending', 'en'));
  expect(fixture.configReads).toBe(readsAtOpen);
  expect(fixture.configCalls).toEqual([]);
  await keys(ui, 'right');
  expect(await visibleText(ui)).toContain('Current dark · Pending light');
  expect(fixture.store.rows[0]!.value).toBe('dark');
  await keys(ui, 'down');
  expect(await visibleText(ui)).toContain('Locked · /config verbose');
  const locked = await visibleText(ui);
  expect(locked).not.toContain('Enter');
  expect(locked).not.toContain('←→');
  await keys(ui, 'right', 'return', ' ', 'a');
  expect(fixture.configCalls).toEqual([{ key: 'theme', value: 'light' }]);
  await keys(ui, 'up');
  expect(await visibleText(ui)).toContain('Current light');
  expect(await visibleText(ui)).not.toContain('Pending light');
  expect(fixture.calls.some(call => call.operation === 'apply')).toBe(false);
  await ui.unmount();
});
