import test from 'node:test';
import assert from 'node:assert/strict';
import { languageEvidence, verifyLanguageEvidence, verifyPackLanguages } from '../i18n-evidence.js';
import { DATA_ROOT, analyze, readJson } from '../../generation/i18n/analysis.js';
import { fixture, editPack, put } from '../../generation/test/i18n-fixture.js';
const commit = 'a'.repeat(40);
test('only pre-activation sources may omit language evidence; report downgrade and wrong source fail', () => {
    const legacy = new Map([['packages/core/src/release.ts', Buffer.from("export const VERSION = '3.14.0';")]]);
    assert.equal(languageEvidence(legacy, commit), undefined); verifyLanguageEvidence(undefined, legacy, commit, true);
    legacy.set('packages/core/src/release.ts', Buffer.from("export const VERSION = '3.15.0';")); assert.throws(() => languageEvidence(legacy, commit), /Missing activated/);
    const inputs = fixture(), evidence = languageEvidence(inputs, commit)!;
    verifyLanguageEvidence(evidence, inputs, commit, true);
    for (const value of [undefined, { ...evidence, schema_version: 0 }, { ...evidence, source_commit: 'b'.repeat(40) }, { ...evidence, report_sha256: '0'.repeat(64) }])
        assert.throws(() => verifyLanguageEvidence(value as any, inputs, commit));
    const policy = readJson(inputs, DATA_ROOT + 'policy.json'); policy.extra = 'changed'; put(inputs, DATA_ROOT + 'policy.json', policy);
    assert.throws(() => verifyLanguageEvidence(evidence, inputs, commit), /immutable inputs/);
});
test('development evidence with B fallback cannot authorize either public channel', () => {
    const inputs = fixture(); editPack(inputs, 'ja', pack => { delete pack.hello; });
    const evidence = languageEvidence(inputs, commit)!; verifyLanguageEvidence(evidence, inputs, commit);
    assert.throws(() => verifyLanguageEvidence(evidence, inputs, commit, true), /Release language gate/);
    evidence.report.release_ready = true; assert.throws(() => verifyLanguageEvidence(evidence, inputs, commit), /immutable inputs/);
});
test('package checks bind effective JSON and reject raw fallback templates or build-only history', () => {
    const inputs = fixture(); editPack(inputs, 'ja', pack => { delete pack.hello; });
    const analysis = analyze(inputs), entries = new Map<string, Uint8Array>();
    for (const { code } of analysis.registry) entries.set(`node_modules/@fbincon/statusline-core/resources/i18n/locales/${code}.json`, Buffer.from(JSON.stringify(analysis.effective[code])));
    verifyPackLanguages(inputs, entries);
    const path = 'node_modules/@fbincon/statusline-core/resources/i18n/locales/ja.json', original = entries.get(path)!;
    entries.set(path, Buffer.from(JSON.stringify(analysis.raw.ja))); assert.throws(() => verifyPackLanguages(inputs, entries), /effective resource/);
    entries.set(path, original); entries.set('tools/generation/i18n/data/history.json', Buffer.from('{}'));
    assert.throws(() => verifyPackLanguages(inputs, entries), /leaked/);
});
