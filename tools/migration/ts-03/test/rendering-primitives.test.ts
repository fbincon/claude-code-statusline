import { oracle, referenceDirectory as exportReference } from '@fbincon/statusline-test-support/oracle';
import test from 'node:test';
import assert from 'node:assert/strict';

import { rmSync } from 'node:fs';
import { join } from 'node:path';

import { encode, LosslessNumber, pythonFloat } from '@fbincon/statusline-core/json';
import * as layout from '@fbincon/statusline-core/rendering/layout';
import { general } from '@fbincon/statusline-core/rendering/numeric-format';
import { caseFold, upperFirst } from '@fbincon/statusline-core/rendering/subagents';
import { coercedFloat, coercedInteger } from '@fbincon/statusline-core/rendering/coercion';
import { pythonJson } from '@fbincon/statusline-core/json-text';
test('ANSI state and Unicode layout match the frozen Python pipeline at five widths', t => {
    const reference = exportReference();
    t.after(() => rmSync(reference, { recursive: true, force: true }));
    const inputs = ['plain ascii', '中文/é/👩🏽‍💻/🇨🇳/end', '\x1b[31mred\x1b[0m plain', 'a\x1b[1;32ḿb\x1b[0m', '👩\x1b[44m🏽‍💻\x1b[0m tail',
        '\x1b[1;38:2::20:30:40mCJK 中文\x1b[49m tail', '\x1b[38;5;123;48;2;1;2;3mwide text\x1b[m', '/some/中文/path/file', 'C:\\some\\中文\\file', '\x1b[48;9;31munsupported', '\r\n\t\0a', 'क्‍ष/தமிழ்'];
    const cases = inputs.flatMap(text => [2, 4, 8, 12, 20].map(width => ({ text, width })));
    const source = 'import json,sys\nfrom claude_statusline.rendering import layout as l\nr=[]\nfor c in json.load(sys.stdin):\n s,w=c["text"],c["width"]\n r.append({"units":[[u.text,u.width,u.style] for u in l._styled_units(s)],"truncate":l.truncate_styled(s,w),"split":l._split_ansi_text(s,w,True),"reset":l._ensure_reset(s)})\nprint(json.dumps(r))';
    const expected = JSON.parse(oracle(['-B', '-c', source], { input: JSON.stringify(cases), encoding: 'utf8', env: { ...process.env, PYTHONUTF8: '1', PYTHONPATH: join(reference, 'src'), PYTHONDONTWRITEBYTECODE: '1' } }));
    const actual = cases.map(({ text, width }) => ({ units: layout.styledUnits(text).map(u => [u.text, u.width, u.style]), truncate: layout.truncateStyled(text, width), split: layout.splitAnsiText(text, width, true), reset: layout.ensureReset(text) }));
    assert.deepEqual(actual, expected);
});
test('general display formats round 2,092 binary64/precision vectors like Python', () => {
    let seed = 0x78a3n;
    const view = new DataView(new ArrayBuffer(8)), values = [0, -0, .00001, .0001, .0123, 999.5, 9999.5, 9.99999, 1e100, Number.MAX_VALUE, Number.MIN_VALUE];
    for (let i = 0; i < 512; i++) {
        seed = (seed * 6364136223846793005n + 1442695040888963407n) & ((1n << 64n) - 1n);
        view.setBigUint64(0, seed);
        const value = view.getFloat64(0);
        if (Number.isFinite(value))
            values.push(value);
    }
    const input = values.flatMap(value => [1, 3, 6, 17].map(precision => [new LosslessNumber(pythonFloat(value)), precision]));
    const source = 'import json,sys\nprint(json.dumps([format(v,"."+str(p)+"g") for v,p in json.load(sys.stdin)]))';
    const expected = JSON.parse(oracle(['-c', source], { input: encode(input), encoding: 'utf8' }));
    assert.equal(input.length, 2092);
    assert.deepEqual(values.flatMap(value => [1, 3, 6, 17].map(precision => general(value, precision))), expected);
});
test('Unicode case folding and initial capitals preserve Python 3.14 UCD 16 for every code point', () => {
    const source = 'import json,unicodedata as u\nassert u.unidata_version == "16.0.0"\nprint(json.dumps({str(n):[chr(n).casefold(),chr(n).upper()] for n in range(0x110000) if chr(n).casefold()!=chr(n) or chr(n).upper()!=chr(n)}))';
    const expected = JSON.parse(oracle(['-c', source], { encoding: 'utf8' }));
    for (let n = 0; n < 0x110000; n++) {
        const c = String.fromCodePoint(n), row = expected[n] ?? [c, c];
        assert.equal(caseFold(c), row[0], n.toString(16));
        assert.equal(upperFirst(c), row[1], n.toString(16));
    }
});
test('legacy numeric constructors accept Python decimal syntax without JavaScript-only coercions', () => {
    const values: unknown[] = [null, true, false, 0, -0, .5, -1.5, 1e200, 10n ** 400n, '', ' ', '0x10', '0b10', '\ufeff12', '\x1c12', '12\x1f', 'NaN', '-INF', '+Infinity', '1_2', '1__2', '1.2e+03', '12.', '.5', '1_2.0_5e-1_0', '1e999', '١٢٣', '１２３', '\u008512\u0085', '+０_１', '9'.repeat(4301), [], {}];
    for (let n = 0; n < 0x110000; n++) {
        const c = String.fromCodePoint(n);
        if (/\p{Decimal_Number}/u.test(c))
            values.push(c);
    }
    const source = 'import json,sys\ndef read(f,v):\n try: return repr(f(v))\n except (ValueError,TypeError,OverflowError): return None\nprint(json.dumps([[read(int,v),read(float,v)] for v in json.load(sys.stdin)]))';
    const expected = JSON.parse(oracle(['-c', source], { input: pythonJson(values), encoding: 'utf8' }));
    const actual = values.map(value => { const n = coercedFloat(value), i = coercedInteger(value); return [i === null ? null : String(i), n === null ? null : Number.isNaN(n) ? 'nan' : n === Infinity ? 'inf' : n === -Infinity ? '-inf' : pythonFloat(n)]; });
    assert.deepEqual(actual, expected);
});
