import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultDisplay, defaultItem, validateDisplay } from '../src/config/display.js';
import { parseGradient, gradientName, validGradient, GRADIENT_PRESETS } from '../src/editor/gradients.js';
import { interpolate, paintGradient, segmentPaint } from '../src/rendering/gradients.js';
import { strip, styledUnits, displayWidth, layoutSegments } from '../src/rendering/layout.js';
import { parse } from '../src/rendering/styles.js';
import { row } from '../src/rendering/powerline.js';
import { apply } from '../src/rendering/appearance.js';

test('gradient presets expand to normalized portable colors and reject incomplete or unsafe stops', () => {
  for (const [name,colors] of Object.entries(GRADIENT_PRESETS)) {
    assert.deepEqual(parseGradient(name), colors); assert.equal(gradientName(colors), name);
  }
  assert.deepEqual(parseGradient('#AABBCC, #001122'), ['#aabbcc','#001122']);
  assert.equal(parseGradient('off'), null);
  for (const value of [[], ['#ffffff'], Array(6).fill('#ffffff'), ['default','#ffffff'], ['ansi:1','#ffffff'], ['#ff0000','bad'], {}])
    assert.equal(validGradient(value), false);
  const d = defaultDisplay(); d.instances[0]!.options.foreground_gradient = parseGradient('ocean');
  assert.deepEqual(validateDisplay(d), d);
  assert.throws(()=>validateDisplay({...d,schema_version:13}));
  const { foreground_gradient: _, ...oldOptions } = d.instances[0]!.options;
  d.instances[0]!.options=oldOptions;
  assert.equal(validateDisplay({...d,schema_version:13}).schema_version,17);
  assert.deepEqual(interpolate(['#000000','#ffffff'],.5), ['rgb','#808080']);
});
test('visible grapheme endpoints, links, color fallback and no-color text remain intact', () => {
  const d=defaultDisplay(), text='中文👩🏽‍💻é', colors=['#123456','#abcdef'];
  const linked='\x1b]8;;https://example.com\x1b\\'+text+'\x1b]8;;\x1b\\';
  const output=paintGradient(linked,colors,'foreground',d), units=styledUnits(output);
  assert.equal(strip(output),text); assert.equal(displayWidth(output),displayWidth(text));
  assert.deepEqual(parse(units[0]!.style).foreground,['rgb',colors[0]]);
  assert.deepEqual(parse(units.at(-1)!.style).foreground,['rgb',colors[1]]);
  assert(units.every(unit=>unit.link==='https://example.com/'));
  d.palette='ansi';assert(styledUnits(paintGradient(text,colors,'foreground',d)).every(unit=>parse(unit.style).foreground?.[0]==='ansi'));
  d.use_colors=false;assert.equal(paintGradient(text,colors,'foreground',d),text);
});
test('Powerline padding and adjacent caps use the final gradient edges', () => {
  const d=defaultDisplay();d.separator_style='powerline';d.powerline_glyph='powerline';d.powerline.start_cap=true;
  d.instances=[{id:'one',type_id:'text',enabled:true,text:'AB',options:{...defaultItem(),background_gradient:['#112233','#445566']}},
    {id:'two',type_id:'text',enabled:true,text:'CD',options:{...defaultItem(),background_gradient:['#778899','#aabbcc']}}];
  const units=styledUnits(row([{id:'one',text:'AB'},{id:'two',text:'CD'}],d));
  const separators=units.filter(u=>u.text==='\ue0b0');
  assert.deepEqual(parse(separators[0]!.style).foreground,['rgb','#445566']);
  assert.deepEqual(parse(separators[0]!.style).background,['rgb','#778899']);
  assert.deepEqual(parse(separators.at(-1)!.style).foreground,['rgb','#aabbcc']);
  const start=units.find(u=>u.text==='\ue0b2')!;
  assert.deepEqual(parse(start.style).foreground,['rgb','#112233']);
});
test('coalesced semantic fragments retain separate gradient endpoints after wrapping', () => {
  const d=defaultDisplay(), colors=['#111111','#eeeeee'];
  const text='AAAA BBBB', paint=segmentPaint([{text:'AAAA',paint:t=>paintGradient(t,colors,'foreground',d)},{text:' '},{text:'BBBB',paint:t=>paintGradient(t,colors,'foreground',d)}]);
  const rows=layoutSegments([{text,paint}],3);
  assert.equal(rows.map(strip).join(''),text);
  for (const value of rows) assert(displayWidth(value)<=3);
  assert.deepEqual(parse(styledUnits(rows[0]!)[0]!.style).foreground,['rgb','#111111']);
  assert.deepEqual(parse(styledUnits(rows[0]!).at(-1)!.style).foreground,['rgb','#eeeeee']);
});
test('background gradients protect nearly matching warning colors without changing the warning foreground', () => {
  const d=defaultDisplay();d.separator_style='powerline';d.formatting.thresholds.enabled=true;
  const warning=apply('WARN',d,'context-used',defaultItem(),'main',95);
  const output=paintGradient(warning,['#f28686','#ee8585'],'background',d);
  for(const unit of styledUnits(output)) {
    assert.deepEqual(parse(unit.style).foreground,['rgb','#f28686']);
    assert.deepEqual(parse(unit.style).background,['rgb','#000000']);
  }
});
