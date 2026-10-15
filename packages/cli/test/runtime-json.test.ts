import test from 'node:test';
import assert from 'node:assert/strict';
import { readDataJson, dumpDataJson } from '../src/runtime/json-data.js';
import { readJson } from '@fbincon/statusline-core/json-read';
import { canonical, integer } from '@fbincon/statusline-core/json';
import { pythonJson } from '@fbincon/statusline-core/json-text';
import { dictionary } from '@fbincon/statusline-core/runtime/values';
import { UsageCollector } from '../src/runtime/usage.js';
import { setup, fs, join } from './runtime-support.js';
test('internal cache/transcript parsing preserves exact numeric kinds and ordered keys', () => {
    const vectors = [
        '{"n":9007199254740993,"f":1.0,"z":-0.0,"i":-0,"e":1e20,"tiny":1e-7}',
        '{"10":1,"2":2,"1":3,"\\u0030":4,"x":5}',
        '{"outer":{"\\u0031":1,"2":2},"escaped":"text \\\"1\\\": 2"}',
        '{"__proto__":3,"constructor":4,"isLosslessNumber":true,"value":"7"}',
        '{"x":1,"\\u0078":2,"a":[true,null,"中文 👩🏽‍💻"]}',
        '{"legacy":NaN,"positive":Infinity,"negative":-Infinity,"overflow":1e400}',
        '{"4294967295":1,"4294967294":2,"00":3,"-1":4}',
        '{"a":"\\\\u0031","b":{"c":0},"number-looking value":"123"}',
        '{"\\u0000statusline:number":1,"f":1.0}',
        '{"\\u0000statusline:\\u006eumber":0,"f":2.0}',
        '{"text":"version 1.5; 9007199254740993, -0","quoted":"\\\"1.5\\\" and \\\\","n":2.0}',
    ];
    for (const raw of vectors)
        assert.equal(pythonJson(readDataJson(raw), { ensureAscii: false, allowNan: true }), pythonJson(readJson(raw), { ensureAscii: false, allowNan: true }), raw);
    const value = readDataJson('{"whole":1,"fraction":1.0}') as Record<string, unknown>;
    assert.equal(integer(value.whole), 1n);
    assert.throws(() => integer(value.fraction));
    for (const raw of ['{', '[1,]', '"bad\\x"', '{"n":01}', '01.0', '-01.0', '000000000000000001', '1.e2', '1e+', '1.0true', '[1.0 2.0]', '\ufeff{}'])
        assert.throws(() => readDataJson(raw), { message: (() => { try {
                readJson(raw);
            }
            catch (error) {
                return (error as Error).message;
            } })() });
});
test('data integer accumulation is exact across the safe-integer boundary and long literals', () => {
    for (let i = -96n; i <= 96n; i++) {
        for (const sign of [1n, -1n]) {
            const raw = String((9007199254740991n + i) * sign);
            assert.equal(integer(readDataJson(raw)), BigInt(raw));
        }
    }
    for (const raw of ['0', '-0', '1234567890123456789012345678901234567890', '1.0000000000000001', '-0e99', '1e400', '1e-400'])
        assert.equal(pythonJson(readDataJson(raw), { allowNan: true }), pythonJson(readJson(raw), { allowNan: true }));
    for (const raw of ['[00]', '[01]', '[-01]', '[1.]', '[1e-]', '[truefalse]', '{"x" 1}', '{"x":1,}', '["a\n"]', '["a\\u00xz"]', '["a\\\\\n"]', '{}x', '[1,,2]'])
        assert.throws(() => readDataJson(raw), { message: (() => { try { readJson(raw); } catch (error) { return (error as Error).message; } })() });
});
test('large counter subtrees keep exact values, order and native grammar validation', () => {
    const ordinary = Array.from({ length: 300 }, (_, i) => `"message-${i}":{"i":${i},"o":2,"cc":0,"cr":1}`).join(',');
    const tails = ['"text":"escaped \\\" } ] \\\\ tail"', '"n":9007199254740993', '"f":1.0,"z":-0.0', '"10":1,"2":2,"\\u0030":3', '"x":1,"\\u0078":2', '"__proto__":{"future":true}', '"legacy":NaN'];
    for (const tail of tails) {
        const raw = `{"ns":1788400000000000001,"ids":{${ordinary},${tail}},"future":[1.0,2]}`;
        assert.equal(pythonJson(readDataJson(raw), { allowNan: true }), pythonJson(readJson(raw), { allowNan: true }));
    }
    for (const tail of ['"x":01', '"x":[1,]', '"x":true false', '"x":"bad\\x"', '"x":[1}', '"x":1,']) {
        const raw = `{"ns":1788400000000000001,"ids":{${ordinary},${tail}}}`;
        assert.throws(() => readDataJson(raw), { message: (() => { try { readJson(raw); } catch (error) { return (error as Error).message; } })() });
    }
});
test('cache serialization exactly matches Python layout, Unicode escapes and numeric spellings', () => {
    for (const raw of [
        '{"n":9007199254740993,"f":1.0,"z":-0.0,"e":1e20,"tiny":1e-7}',
        '{"10":1,"2":2,"nested":{"9":3,"1":4}}',
        '{"unicode":"中文 👩🏽‍💻 é 🇨🇳 1️⃣","surrogate":"\\ud800","control":"\\u007f"}',
        '{"separators":",: \\\"text\\\"","colon:key":true,"null":null}',
        '{"legacy":NaN,"positive":Infinity,"negative":-Infinity,"overflow":1e400}',
        '{"__proto__":1,"constructor":2,"toJSON":3}',
    ]) {
        const value = readDataJson(raw);
        assert.equal(dumpDataJson(value), pythonJson(value, { allowNan: true }), raw);
    }
    const ids = dictionary(Array.from({ length: 100 }, (_, i) => ['message-' + i, { i: BigInt(i), o: 0n, cc: 3n, cr: 4n }] as const));
    assert.equal(dumpDataJson({ ids }), pythonJson({ ids }, { allowNan: true }));
    ids['2'] = { i: 99n, o: 0n, cc: 3n, cr: 4n };
    assert.equal(dumpDataJson({ ids }), pythonJson({ ids }, { allowNan: true }));
});
test('usage cache restores mutable session/message order before new integer IDs arrive', t => {
    const f = setup(t), source = new UsageCollector(f.context), ids = dictionary([['letter', { i: 1, o: 2, cc: 3, cr: 4 }]]);
    fs.mkdirSync(f.context.cacheRoot, { recursive: true });
    fs.writeFileSync(source.path(), pythonJson({ sessions: { original: { files: {}, ids, base: { i: 0, o: 0, cc: 0, cr: 0 }, future: { unknown: 1.5 } } } }));
    const loaded = source.load().state;
    loaded.sessions['9'] = loaded.sessions.original!;
    loaded.sessions.original!.ids['2'] = { i: 5n, o: 0n, cc: 0n, cr: 0n };
    assert.deepEqual(Object.keys(loaded.sessions), ['original', '9']);
    assert.deepEqual(Object.keys(loaded.sessions.original!.ids), ['letter', '2']);
    assert.equal(canonical(loaded.sessions.original!.future), '{"unknown":1.5}');
    assert.ok(!fs.existsSync(join(f.root, 'claude-statusline.json')));
});
test('cache fast paths match the exact parser/serializer for nested numeric, duplicate and escaped-key vectors', () => {
    let seed = 0x13579bdf;
    const next = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed >>> 0; };
    const atoms = ['0', '-0', '1', '1.0', '-0.0', '0.125', '1e+20', '1e-400', '9007199254740993', '123456789012345678901234567890', 'true', 'false', 'null', '"中文 👩🏽‍💻"', '"1.25, 9999999999999999: text"', '"\\\"quoted 1e20\\\" \\\\"'];
    const keys = ['a', 'b', '__proto__', 'constructor', '10', '2', '\u0000statusline:number', 'quoted " 1.5', '中文', '1e20'];
    const value = (depth: number): string => {
        const kind = next() % 5;
        if (!depth || kind > 1)
            return atoms[next() % atoms.length]!;
        if (kind === 0)
            return '[' + Array.from({ length: next() % 4 }, () => value(depth - 1)).join(',') + ']';
        return '{' + Array.from({ length: next() % 5 }, () => JSON.stringify(keys[next() % keys.length]) + ':' + value(depth - 1)).join(',') + '}';
    };
    for (let index = 0; index < 512; index++) {
        const raw = value(4), expected = pythonJson(readJson(raw), { allowNan: true });
        const parsed = readDataJson(raw);
        assert.equal(pythonJson(parsed, { allowNan: true }), expected, raw);
        assert.equal(dumpDataJson(parsed), expected, raw);
    }
});
