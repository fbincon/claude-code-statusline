import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze, assertReady, DATA_ROOT, RESOURCE_ROOT, parseJson, readJson, hash } from '../i18n/analysis.js';
import { fixture, acceptFixture, editPack, put } from './i18n-fixture.js';

test('accepted catalogs keep real translations, technical terms and exact origin', () => {
    const result = analyze(fixture()); assertReady(result.report, true);
    assert.equal(result.effective.ja!.hello, 'ja {name}'); assert.equal(result.origins.ja!.term, 'ja');
    assert.equal(result.report.languages.ja!.accepted, 3); assert.deepEqual(result.report.languages.ja!.fallback, []);
});
test('missing and edited official translations pass development but fail release without hiding acceptance state', () => {
    const inputs = fixture(); editPack(inputs, 'ja', pack => { delete pack.hello; pack.term = 'Git revised'; });
    const result = analyze(inputs); assertReady(result.report); assert.throws(() => assertReady(result.report, true), /Release language/);
    assert.equal(result.states.ja!.hello, 'missing'); assert.equal(result.states.ja!.term, 'pending_validation');
    assert.equal(result.effective.ja!.hello, 'Hello {name}'); assert.equal(result.effective.ja!.term, 'Git'); assert.equal(result.origins.ja!.hello, 'en');
    assert.equal(result.report.languages.ja!.present, 2); assert.equal(result.report.languages.ja!.accepted, 1);
    acceptFixture(inputs, ['ja'], ['term']); assert.equal(analyze(inputs).states.ja!.term, 'accepted');
    editPack(inputs, 'zh-CN', pack => { delete pack.hello; }); assert.throws(() => assertReady(analyze(inputs).report), /Development language/);
});
test('new keys and changed English invalidate immediately while current core translations allow B fallback', () => {
    const inputs = fixture();
    editPack(inputs, 'en', pack => { pack.hello = 'Welcome {name}'; pack.added = 'New'; });
    editPack(inputs, 'zh-CN', pack => { pack.hello = '欢迎 {name}'; pack.added = '新增'; });
    acceptFixture(inputs, ['en', 'zh-CN']);
    const result = analyze(inputs); assertReady(result.report);
    assert.equal(result.states.ja!.hello, 'stale'); assert.equal(result.states.ja!.added, 'missing');
    assert.equal(result.effective.ja!.hello, 'Welcome {name}'); assert.equal(result.effective.ja!.added, 'New');
});
test('context and referenced terminology invalidate only affected semantic keys', () => {
    const inputs = fixture();
    put(inputs, DATA_ROOT + 'context.json', { schema_version: 1, entries: { hello: { version: 2, description: 'New contextual meaning', terms: ['greeting'], cell_budget: 40 } } });
    put(inputs, DATA_ROOT + 'terminology.json', { schema_version: 1, entries: { greeting: { version: 1, description: 'Formal greeting' }, unrelated: { version: 1, description: 'Other' } } });
    assert.equal(analyze(inputs).states.ja!.hello, 'stale'); assert.equal(analyze(inputs).states.ja!.term, 'accepted');
    acceptFixture(inputs, ['en', 'zh-CN', 'ja']); const accepted = analyze(inputs);
    const terms = readJson(inputs, DATA_ROOT + 'terminology.json'); terms.entries.unrelated.version++; put(inputs, DATA_ROOT + 'terminology.json', terms);
    assert.deepEqual(analyze(inputs).signatures, accepted.signatures);
    terms.entries.greeting.description = 'Informal greeting'; put(inputs, DATA_ROOT + 'terminology.json', terms);
    assert.equal(analyze(inputs).states.ja!.hello, 'stale');
});
test('old placeholder contracts are quarantined but a newly submitted mismatch is invalid', () => {
    const inputs = fixture(); editPack(inputs, 'en', pack => { pack.hello = 'Hello {person}'; }); editPack(inputs, 'zh-CN', pack => { pack.hello = '你好 {person}'; });
    acceptFixture(inputs, ['en', 'zh-CN']); const result = analyze(inputs); assertReady(result.report);
    assert.equal(result.states.ja!.hello, 'stale'); assert.equal(result.effective.ja!.hello, 'Hello {person}');
    editPack(inputs, 'ja', pack => { pack.hello = 'New {other}'; });
    const invalid = analyze(inputs); assert.equal(invalid.states.ja!.hello, 'invalid'); assert.throws(() => assertReady(invalid.report), /invalid=1/);
});
test('retirement requires accepted historical provenance and removes keys from output and denominators', () => {
    const inputs = fixture(); editPack(inputs, 'en', pack => { delete pack.hello; });
    const result = analyze(inputs); assertReady(result.report, true); assert.equal(result.states.ja!.hello, 'obsolete');
    assert.equal(result.report.languages.ja!.total, 2); assert(!Object.hasOwn(result.effective.ja!, 'hello'));
    editPack(inputs, 'ja', pack => { pack.typo = 'extra'; }); assert.equal(analyze(inputs).states.ja!.typo, 'invalid');
    editPack(inputs, 'ja', pack => { delete pack.typo; pack.hello = 'changed retired entry'; }); assert.equal(analyze(inputs).states.ja!.hello, 'invalid');
});
test('unsafe content, unsupported templates and duplicate keys cannot be hidden by fallback or history', () => {
    for (const value of ['\u001b[31m', '\ud800', '{name.path}', '{name:fmt}', '{name!r}', '{', '}', 42, null]) {
        const inputs = fixture(); editPack(inputs, 'ja', pack => { (pack as any).hello = value; });
        assert.throws(() => assertReady(analyze(inputs).report), String(value));
    }
    for (const value of ['a\nb', 'a\u2028b', 'a\u2029b']) {
        const inputs = fixture(); editPack(inputs, 'ja', pack => { pack['statusline.example'] = value + ' {count}'; });
        assert.equal(analyze(inputs).states.ja!['statusline.example'], 'invalid');
    }
    for (const json of ['{"a":1,"a":2}', '{"nested":{"x":1,"x":2}}', '{"a":{},"a":{}}']) assert.throws(() => parseJson(Buffer.from(json)), /Duplicate/);
    assert.throws(() => parseJson(new Uint8Array([0xff])), /encoded data/);
    assert.deepEqual(parseJson(Buffer.from('{"text":"a:b", "nested":[{"x":1},{"x":2}]}')).nested, [{ x: 1 }, { x: 2 }]);
});
test('baseline acceptance is restricted to the exact recorded source and translations', () => {
    const inputs = fixture(), history = readJson(inputs, DATA_ROOT + 'history.json'), files: Record<string, string> = {}, signatures: Record<string, string> = {};
    for (const code of ['en', 'zh-CN', 'ja']) {
        const path = DATA_ROOT + 'baseline/locales/' + code + '.json'; inputs.set(path, inputs.get(RESOURCE_ROOT + 'locales/' + code + '.json')!); files[path] = hash(inputs.get(path)!);
        const accepted = readJson(inputs, DATA_ROOT + 'accepted/' + code + '.json');
        for (const [key, record] of Object.entries(accepted.entries) as [string, any][]) { record.method = 'baseline_accepted'; record.evidence = 'baseline'; signatures[key] = record.source; }
        put(inputs, DATA_ROOT + 'accepted/' + code + '.json', accepted);
    }
    put(inputs, DATA_ROOT + 'provenance.json', { schema_version: 1, records: { baseline: { method: 'baseline_accepted', source_commit: 'a'.repeat(40), run_id: 1, artifact_sha256: 'b'.repeat(64), files, signatures, checks: ['verified-pr-structural'], limitations: ['No linguistic review is inferred'] } } });
    assertReady(analyze(inputs).report, true);
    const record = readJson(inputs, DATA_ROOT + 'accepted/ja.json'); record.entries.hello.translation = hash('forged'); put(inputs, DATA_ROOT + 'accepted/ja.json', record);
    assert.throws(() => analyze(inputs), /Baseline does not cover/);
    assert(Object.keys(history.contracts).length);
});
test('community disclosure is truthful and official languages cannot be demoted', () => {
    const inputs = fixture(true); editPack(inputs, 'fr', pack => { delete pack.hello; });
    const result = analyze(inputs); assertReady(result.report, true); assert.deepEqual(result.report.disclosure, [{ language: 'fr', accepted: 2, total: 3, fallback: ['hello'] }]);
    const policy = readJson(inputs, DATA_ROOT + 'policy.json'); policy.languages.ja = 'C'; put(inputs, DATA_ROOT + 'policy.json', policy);
    assert.throws(() => analyze(inputs), /cannot be demoted/);
});
test('analysis is reproducible from declared inputs without checkout history and preserves meaningful whitespace', () => {
    const inputs = fixture(), before = analyze(inputs); assert.deepEqual(analyze(new Map([...inputs].reverse())), before);
    editPack(inputs, 'en', pack => { pack.hello += ' '; }); assert.notEqual(analyze(inputs).signatures.hello, before.signatures.hello);
});
