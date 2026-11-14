import assert from 'node:assert/strict';

const COMMIT = /^[a-f0-9]{40}$/u;
const HASH = /^[a-f0-9]{64}$/u;
const STATES = new Set(['pass', 'skip']);

export interface AcceptanceEnvelopeSource {
    commit: string;
    files_sha256: string;
    tree?: string;
}
export interface AcceptanceEnvelopeArtifact {
    sha256: string;
    filename?: string;
    version?: string;
}
export interface AcceptanceEnvelopeRuntime {
    node: string;
    node_sha256?: string;
    platform: string;
    arch: string;
    os_release?: string;
    host?: string | null;
}
export interface AcceptanceEnvelopeCheck {
    name: string;
    status: 'pass' | 'skip';
    detail?: string;
}
export interface AcceptanceEnvelope {
    schema_version: 1;
    kind: 'acceptance-envelope';
    status: 'pass';
    producer: { kind: string };
    source: AcceptanceEnvelopeSource;
    artifact: AcceptanceEnvelopeArtifact | null;
    runtime: AcceptanceEnvelopeRuntime;
    checks: AcceptanceEnvelopeCheck[];
    limitations: string[];
    produced_at?: string;
    [key: string]: unknown;
}

function object(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function text(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}

/** Validate a promotable acceptance receipt envelope without wrapping existing CI evidence formats. */
export function validateAcceptanceEnvelope(value: unknown): asserts value is AcceptanceEnvelope {
    assert(object(value), 'Acceptance envelope must be an object');
    const envelope: Record<string, unknown> = value;
    assert.equal(envelope.schema_version, 1, 'Unsupported acceptance envelope schema');
    assert.equal(envelope.kind, 'acceptance-envelope', 'Unexpected acceptance envelope kind');
    assert.equal(envelope.status, 'pass', 'Acceptance envelope must describe passing evidence');
    const producer = envelope.producer;
    assert(object(producer) && text(producer.kind), 'Acceptance envelope requires a producer kind');
    const source = envelope.source;
    assert(object(source), 'Acceptance envelope requires source identity');
    assert(text(source.commit) && COMMIT.test(source.commit), 'Acceptance envelope requires a source commit');
    assert(text(source.files_sha256) && HASH.test(source.files_sha256), 'Acceptance envelope requires a source file digest');
    if (source.tree !== undefined) assert(text(source.tree) && COMMIT.test(source.tree), 'Invalid acceptance envelope source tree');
    const artifact = envelope.artifact;
    assert(artifact === null || object(artifact), 'Acceptance envelope artifact must be an object or null');
    if (object(artifact)) {
        assert(text(artifact.sha256) && HASH.test(artifact.sha256), 'Invalid acceptance envelope artifact digest');
        if (artifact.filename !== undefined) assert(text(artifact.filename), 'Invalid acceptance envelope artifact filename');
        if (artifact.version !== undefined) assert(text(artifact.version), 'Invalid acceptance envelope artifact version');
    }
    const runtime = envelope.runtime;
    assert(object(runtime) && text(runtime.node) && text(runtime.platform) && text(runtime.arch), 'Acceptance envelope requires runtime identity');
    if (runtime.node_sha256 !== undefined) assert(text(runtime.node_sha256) && HASH.test(runtime.node_sha256), 'Invalid acceptance envelope Node digest');
    if (runtime.os_release !== undefined) assert(text(runtime.os_release), 'Invalid acceptance envelope OS release');
    if (runtime.host !== undefined && runtime.host !== null) assert(text(runtime.host), 'Invalid acceptance envelope host');
    assert(Array.isArray(envelope.checks) && envelope.checks.length > 0, 'Acceptance envelope requires checks');
    const names = new Set<string>();
    let passes = 0;
    for (const check of envelope.checks) {
        assert(object(check) && text(check.name) && STATES.has(check.status as string), 'Invalid acceptance envelope check');
        const name = check.name;
        assert(!names.has(name), 'Duplicate acceptance envelope check: ' + name);
        names.add(name);
        if (check.status === 'pass') passes++;
        if (check.detail !== undefined) assert(text(check.detail), 'Invalid acceptance envelope check detail');
    }
    assert(passes > 0, 'Acceptance envelope requires at least one passing check');
    assert(Array.isArray(envelope.limitations) && envelope.limitations.length > 0, 'Acceptance envelope requires limitations');
    for (const limitation of envelope.limitations) assert(text(limitation), 'Invalid acceptance envelope limitation');
    if (envelope.produced_at !== undefined) assert(text(envelope.produced_at) && !Number.isNaN(Date.parse(envelope.produced_at)), 'Invalid acceptance envelope timestamp');
}

/** Validate before returning so producers cannot emit an unchecked envelope. */
export function createAcceptanceEnvelope(value: AcceptanceEnvelope): AcceptanceEnvelope {
    validateAcceptanceEnvelope(value);
    return value;
}
