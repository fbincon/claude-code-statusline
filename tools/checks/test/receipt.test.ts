import test from 'node:test';
import assert from 'node:assert/strict';
import { createAcceptanceEnvelope, validateAcceptanceEnvelope, type AcceptanceEnvelope } from '../receipt.js';

const COMMIT = 'a'.repeat(40), FILES = 'b'.repeat(64), ARTIFACT = 'c'.repeat(64), NODE = 'd'.repeat(64);

function envelope(): AcceptanceEnvelope {
    return {
        schema_version: 1,
        kind: 'acceptance-envelope',
        status: 'pass',
        producer: { kind: 'showcase fixed samples' },
        source: { commit: COMMIT, files_sha256: FILES },
        artifact: { sha256: ARTIFACT, filename: 'fixture.tgz', version: '1.2.3' },
        runtime: { node: 'v24.21.0', node_sha256: NODE, platform: 'linux', arch: 'x64', os_release: 'fixture', host: null },
        checks: [{ name: 'fixed samples', status: 'pass', detail: 'Fixture.' }],
        limitations: ['Synthetic fixture.'],
    };
}

test('acceptance envelope accepts exemplar and compatible shapes', () => {
    assert.doesNotThrow(() => validateAcceptanceEnvelope(envelope()));
    assert.equal(createAcceptanceEnvelope(envelope()).kind, 'acceptance-envelope');
    assert.doesNotThrow(() => validateAcceptanceEnvelope({
        ...envelope(),
        producer: { kind: 'official-mod-test-batches' },
        artifact: null,
        runtime: { node: 'v24.21.0', platform: 'linux', arch: 'x64' },
        checks: [{ name: 'official batches', status: 'pass' }],
        produced_at: '2026-11-14T00:00:00.000Z',
    }));
    assert.doesNotThrow(() => validateAcceptanceEnvelope({ ...envelope(), future: { enabled: true }, source: { ...envelope().source, future: true } }));
    assert.doesNotThrow(() => validateAcceptanceEnvelope({
        ...envelope(),
        producer: { ...envelope().producer, future: true },
        source: { ...envelope().source, tree: 'e'.repeat(40), future: true },
        artifact: { ...envelope().artifact!, future: true },
        runtime: { ...envelope().runtime, future: true },
        checks: [{ ...envelope().checks[0]!, future: true }],
    }));
    assert.doesNotThrow(() => validateAcceptanceEnvelope({ ...envelope(), checks: [{ name: 'fixed samples', status: 'pass' }, { name: 'optional', status: 'skip' }] }));
});

test('acceptance envelope rejects invalid identity, checks and limitations', () => {
    for (const value of [null, [], 'x', 1]) assert.throws(() => validateAcceptanceEnvelope(value));
    const cases: [string, (value: any) => void][] = [
        ['missing schema', value => { delete value.schema_version; }],
        ['wrong schema', value => { value.schema_version = 2; }],
        ['wrong kind', value => { value.kind = 'other'; }],
        ['wrong status', value => { value.status = 'fail'; }],
        ['missing producer', value => { delete value.producer; }],
        ['blank producer kind', value => { value.producer.kind = ' '; }],
        ['missing source', value => { delete value.source; }],
        ['short commit', value => { value.source.commit = 'a'.repeat(39); }],
        ['missing files digest', value => { delete value.source.files_sha256; }],
        ['bad files digest', value => { value.source.files_sha256 = 'x'.repeat(64); }],
        ['bad tree', value => { value.source.tree = 'a'.repeat(39); }],
        ['missing artifact', value => { delete value.artifact; }],
        ['string artifact', value => { value.artifact = 'artifact'; }],
        ['bad artifact', value => { value.artifact = { sha256: 'x' }; }],
        ['blank artifact filename', value => { value.artifact.filename = ' '; }],
        ['blank artifact version', value => { value.artifact.version = ' '; }],
        ['missing runtime', value => { delete value.runtime; }],
        ['missing runtime node', value => { delete value.runtime.node; }],
        ['missing runtime platform', value => { delete value.runtime.platform; }],
        ['missing runtime arch', value => { delete value.runtime.arch; }],
        ['bad node digest', value => { value.runtime.node_sha256 = 'x'.repeat(64); }],
        ['blank os release', value => { value.runtime.os_release = ' '; }],
        ['blank host', value => { value.runtime.host = ' '; }],
        ['missing checks', value => { delete value.checks; }],
        ['empty checks', value => { value.checks = []; }],
        ['invalid check status', value => { value.checks = [{ name: 'one', status: 'fail' }]; }],
        ['invalid check entry', value => { value.checks = ['check']; }],
        ['blank check name', value => { value.checks = [{ name: ' ', status: 'pass' }]; }],
        ['duplicate check name', value => { value.checks = [{ name: 'one', status: 'pass' }, { name: 'one', status: 'skip' }]; }],
        ['no passing check', value => { value.checks = [{ name: 'one', status: 'skip' }]; }],
        ['blank check detail', value => { value.checks = [{ name: 'one', status: 'pass', detail: ' ' }]; }],
        ['missing limitations', value => { delete value.limitations; }],
        ['empty limitations', value => { value.limitations = []; }],
        ['blank limitation', value => { value.limitations = [' ']; }],
        ['invalid produced_at', value => { value.produced_at = 'not-a-date'; }],
    ];
    for (const [name, mutate] of cases) {
        const value: any = envelope();
        mutate(value);
        assert.throws(() => validateAcceptanceEnvelope(value), name);
    }
});
