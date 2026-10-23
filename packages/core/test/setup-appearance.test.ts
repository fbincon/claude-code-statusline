import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultDisplay, defaultItem, validateDisplay } from '../src/config/display.js';
import { DEFAULT_HOST } from '../src/config/draft.js';
import { DEFAULT_POWERLINE } from '../src/config/defaults.js';
import { applyPreset, COMPLETE_SCHEMES } from '../src/config/presets.js';
import { isDraft } from '../src/editor/backend.js';
import { setField } from '../src/config/editor-fields.js';
import { SetupState, type SetupFacts } from '../src/editor/setup.js';
import { fit, wrap, row, cursor, type Block } from '../src/rendering/powerline.js';
import { fitRow } from '../src/rendering/components.js';
import { apply } from '../src/rendering/appearance.js';
import { displayWidth, strip, styledUnits } from '../src/rendering/layout.js';
import { parse } from '../src/rendering/styles.js';
import { decorate } from '../src/rendering/preferences.js';
import { Presentation } from '../src/rendering/language.js';
import { MESSAGES } from '../src/i18n/statusline/en.js';

test('schema 8 migrates in memory to strict schema 9 with legacy appearance defaults', () => {
    const { powerline: _, groups, subagents, ...old } = defaultDisplay();
    const { groups: agentGroups, ...oldAgents } = subagents;
    const legacy = { ...old, subagents: oldAgents, schema_version: 8 }, original = JSON.stringify(legacy);
    const current = validateDisplay(legacy);
    assert.deepEqual(current.powerline, DEFAULT_POWERLINE);
    assert.equal(current.schema_version, 13);
    assert.equal(JSON.stringify(legacy), original);
    assert(isDraft({ display: current, host: DEFAULT_HOST }));
    for (const invalid of [{ ...current.powerline, padding: 'center' }, { ...current.powerline, arbitrary: 'x' }, { ...current.powerline, start_cap: 1 }]) {
        assert.throws(() => validateDisplay({ ...current, powerline: invalid }));
        assert(!isDraft({ display: { ...current, powerline: invalid }, host: DEFAULT_HOST }));
    }
    assert.equal(setField(current, 'powerline.padding', 'left').powerline.padding, 'left');
    assert.equal(setField(current, 'powerline.start_cap', 'on').powerline.start_cap, true);
});
test('complete schemes isolate drafts, retain output language and subagent opt-out, and keep stable identities', () => {
    const original = defaultDisplay(); original.subagents.enabled = false; original.statusline_language = 'ko';
    const before = JSON.stringify(original);
    for (const name of COMPLETE_SCHEMES) {
        const scheme = applyPreset(original, name, () => 'new-copy');
        assert.equal(scheme.statusline_language, 'ko'); assert.equal(scheme.subagents.enabled, false);
        assert.equal(scheme.theme, 'terminal'); assert.equal(scheme.separator_style, 'compact');
        assert.deepEqual(validateDisplay(scheme), scheme);
        assert.deepEqual(applyPreset(original, name, () => 'other-copy'), scheme);
    }
    assert.equal(JSON.stringify(original), before);
    const agents = applyPreset(original, 'agent-focus', () => 'unused');
    assert.equal(agents.subagents.visibility, 'all'); assert.equal(agents.subagents.hide_completed, true); assert.equal(agents.subagents.row_limit, null);
    assert.equal(applyPreset(original, 'daily-development', () => 'unused').instances.find(node => node.type_id === 'session-cost')!.enabled, false);
});
test('ASCII representations preserve distinguishable task and agent states', () => {
    const config = applyPreset(defaultDisplay(), 'agent-focus', () => 'unused'), language = new Presentation('en', MESSAGES);
    for (const [symbol, expected] of [['✓','ok'],['⏱','run'],['✗','fail'],['■','stop'],['…','pending']])
        assert.match(decorate(symbol!, 'status', 'subagent', config.formatting, defaultItem(), language), new RegExp(expected!));
});
test('Powerline decorations, one-sided padding and tiny widths never overflow or leave empty rows', () => {
    const d = defaultDisplay(); d.separator_style = 'powerline'; d.use_colors = false;
    const values = [{ id: 'a', text: '中文👩🏽‍💻é', priority: 100 }, { id: 'b', text: '' }, { id: 'c', text: 'tail', priority: 1 }];
    assert.equal(row([{ text: 'A' }, { text: 'B' }], d), ' A > B >');
    for (const padding of ['none','left','right','both'] as const)
        for (const separator of ['arrow','slash','bar','none'] as const)
            for (const start_cap of [false, true]) for (const end_cap of [false, true]) {
                d.powerline = { ...d.powerline, padding, separator, start_cap, end_cap };
                assert.equal(row([{ text: '' }], d), '');
                for (const columns of [1,2,3,4,5,10,40,80,120]) {
                    const fitted = fit(values, columns, d), wrapped = wrap(values, Math.max(2, columns), d);
                    assert(displayWidth(fitted) <= columns, JSON.stringify({ d, columns, fitted }));
                    for (const line of wrapped) { assert(line); assert(displayWidth(line) <= Math.max(2, columns)); assert(!line.includes('\x1b')); }
                }
            }
});
test('color sequence follows surviving blocks across lines and keeps explicit channels', () => {
    const d = defaultDisplay(); d.separator_style = 'powerline'; d.theme = 'dark';
    d.instances = ['a','b','c'].map(id => ({ id, type_id: 'text', text: id, enabled: true, options: defaultItem() }));
    const blocks: Block[] = d.instances.map(node => ({ id: node.id, text: apply(node.text!, d, 'text', node.options), priority: node.id === 'b' ? 1 : 100 }));
    const background = (value: string, letter: string) => parse(styledUnits(value).find(unit => unit.text === letter)!.style).background;
    d.powerline.color_mode = 'continuous';
    const colors = cursor(), first = fit(blocks.slice(0, 1), 30, d, undefined, colors), second = fit(blocks.slice(2), 30, d, undefined, colors);
    assert.notDeepEqual(background(first, 'a'), background(second, 'c'));
    d.powerline.color_mode = 'restart';
    assert.deepEqual(background(fit(blocks.slice(0,1),30,d,undefined,colors),'a'), background(fit(blocks.slice(2),30,d,undefined,colors),'c'));
    d.powerline.color_mode = 'continuous'; colors.index = 0;
    fit(blocks, 3, d, undefined, colors); assert.equal(colors.index, 2, 'hidden blocks do not consume colors');
    d.instances[0]!.options.background = '#123456';
    assert.deepEqual(background(fit([{ id: 'a', text: apply('a',d,'text',d.instances[0]!.options) }],30,d),'a'), ['rgb','#123456']);
    const cells = [{ id: 'a', text: blocks[0]!.text, priority: 100 }, { id: 'gap', text: '', spacer: true, priority: 50 }, { id: 'c', text: blocks[2]!.text, priority: 100 }];
    d.powerline.color_mode = 'restart';
    const spacerRow = fitRow(cells, 20, d, side => side.map(c => c.text).join(''));
    assert.equal(displayWidth(spacerRow), 20);
    assert.notDeepEqual(background(spacerRow,'a'),background(spacerRow,'c'));
    assert.equal(strip(fitRow([{id:'gap',text:'',spacer:true,priority:50}],20,d,()=>'')), '');
});
test('automatic wrapped fragments keep one continuous color slot per component', () => {
    const d=defaultDisplay();d.separator_style='powerline';d.theme='dark';d.powerline.color_mode='continuous';
    d.instances=['a','b'].map(id=>({id,type_id:'text',text:id,enabled:true,options:defaultItem()}));
    const colors=cursor(),rows=wrap([{id:'a',text:apply('aaaaaaaaaa',d,'text',defaultItem())},{id:'b',text:apply('b',d,'text',defaultItem())}],6,d,colors);
    const backgrounds=rows.flatMap(line=>styledUnits(line).filter(unit=>unit.text==='a').map(unit=>JSON.stringify(parse(unit.style).background)));
    assert.equal(new Set(backgrounds).size,1);assert.equal(colors.index,2);
});
test('ANSI sequence colors cannot conceal warning and critical text on an equal inherited background', () => {
    for (const [position, used, foreground] of [[3, 75, 3], [4, 95, 1]]) {
        const d = defaultDisplay(); d.separator_style = 'powerline'; d.theme = 'terminal';
        d.powerline.color_mode = 'continuous'; d.formatting.thresholds.enabled = true;
        d.instances = [{id:'risk',type_id:'context-used',enabled:true,text:null,options:defaultItem()}];
        const colors = cursor(); colors.index = position!;
        const rendered = fit([{id:'risk',text:apply('R',d,'context-used',d.instances[0]!.options,'main',used)}],20,d,undefined,colors);
        const style = parse(styledUnits(rendered).find(unit=>unit.text==='R')!.style);
        assert.deepEqual(style.foreground, ['ansi', foreground]);
        assert.deepEqual(style.background, ['ansi', 0]);
        d.instances[0]!.options.background = 'ansi:' + foreground;
        const explicit = fit([{id:'risk',text:apply('R',d,'context-used',d.instances[0]!.options,'main',used)}],20,d);
        assert.deepEqual(parse(styledUnits(explicit).find(unit=>unit.text==='R')!.style).background, ['ansi', foreground]);
    }
});
test('setup cancels drafts, defaults existing users to keep, and blocks unavailable integration', () => {
    const facts: SetupFacts = { checks: [], resources: [], notes: [], draft: { display: defaultDisplay(), host: DEFAULT_HOST }, hasDisplay: true, canSave: true, canIntegrate: false };
    const original = JSON.stringify(facts.draft), state = new SetupState(facts, 'en');
    state.key('return'); assert.equal(state.phase,'choice'); assert.equal(state.selected,0);
    state.key('return'); assert.equal(state.phase,'review'); assert.equal(state.key('return'),null);
    state.key('down'); assert.equal(state.key('return'),'save');
    assert.equal(state.key('escape'),'cancel'); assert.equal(JSON.stringify(facts.draft),original);
    const fresh = new SetupState({ ...facts, hasDisplay:false },'en'); fresh.key('return'); fresh.key('return');
    assert.equal(fresh.quick!.preset,'daily-development'); assert.equal(fresh.key('return'),'preset');
    fresh.receive({ ...facts.draft!, display: applyPreset(facts.draft!.display,'daily-development',()=> 'unused') });
    fresh.key('right'); assert.equal(fresh.key('escape'),'cancel'); assert.equal(JSON.stringify(facts.draft),original);
});
