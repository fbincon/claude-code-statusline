/** Pure authoring transitions; callers explicitly publish returned metadata changes. */
import assert from 'node:assert/strict';
import { analyze, canonical, contextFor, DATA_ROOT, hash, placeholders, readJson, RESOURCE_ROOT, safeText, signature, type Acceptance, type Analysis, type Contract, type History, type Inputs } from './analysis.ts';

export interface Validation {
    schema_version: 1; kind: 'language-validation'; status: 'pass'; inputs_sha256: string;
    entries: Record<string, Record<string, { source: string; translation: string }>>;
    checks: string[]; review: string | null; limitations: string[];
}
export function validateSelection(analysis: Analysis, codes: readonly string[], keys: readonly string[], review: string | null): Validation {
    assert(codes.length && keys.length && new Set(codes).size === codes.length && new Set(keys).size === keys.length, 'Select unique languages and keys');
    assert(Object.values(analysis.report.languages).every(row => row.invalid.length === 0), 'Invalid language submissions must be repaired first');
    const entries: Validation['entries'] = {};
    for (const code of [...codes].sort()) {
        assert(Object.hasOwn(analysis.raw, code), 'Unknown language: ' + code); entries[code] = {};
        for (const key of [...keys].sort()) {
            const contract = analysis.contracts[key]; assert(contract, 'Unknown or retired source key: ' + key);
            const value = analysis.raw[code]![key]; safeText(value, key, contract.english);
            assert.deepEqual(placeholders(value), contract.placeholders, 'Translate the current placeholder contract: ' + code + ':' + key);
            entries[code]![key] = { source: analysis.signatures[key]!, translation: hash(value) };
        }
    }
    if (review !== null) assert(typeof review === 'string' && review.trim() && !/[\p{Cc}\p{Cs}]/u.test(review), 'Invalid contextual review');
    return { schema_version: 1, kind: 'language-validation', status: 'pass', inputs_sha256: analysis.report.inputs_sha256, entries,
        checks: [...analysis.report.checks, ...(review ? ['recorded-contextual-review'] : [])], review,
        limitations: ['Structural validation and the recorded contextual review only; no native-speaker, physical or paid-model acceptance is inferred'] };
}
export function acceptValidation(inputs: Inputs, validation: Validation): Map<string, Uint8Array> {
    assert.equal(validation.schema_version, 1); assert.equal(validation.kind, 'language-validation'); assert.equal(validation.status, 'pass');
    assert(validation.review, 'Record contextual review with validate --review before accepting translations');
    const analysis = analyze(inputs), codes = Object.keys(validation.entries), first = validation.entries[codes[0]!]!;
    assert(first, 'Empty validation'); const keys = Object.keys(first);
    for (const code of codes) assert.deepEqual(Object.keys(validation.entries[code]!).sort(), [...keys].sort(), 'Inconsistent validation selection');
    assert.deepEqual(validation, validateSelection(analysis, codes, keys, validation.review), 'Validation is stale or does not match current source, translations, policy or generator');
    const history = readJson(inputs, DATA_ROOT + 'history.json') as History, provenance = readJson(inputs, DATA_ROOT + 'provenance.json');
    const proof = { method: 'validated_accepted', checks: validation.checks, limitations: validation.limitations, entries: validation.entries,
        review: validation.review, validated_inputs_sha256: validation.inputs_sha256 };
    const evidence = hash(canonical(proof)); provenance.records[evidence] = proof;
    const changes = new Map<string, Uint8Array>();
    const put = (path: string, value: unknown) => changes.set(path, Buffer.from(JSON.stringify(value, null, 2) + '\n'));
    for (const code of codes) {
        const path = DATA_ROOT + 'accepted/' + code + '.json', accepted = readJson(inputs, path);
        for (const key of keys) {
            const old = accepted.entries[key] as Acceptance | undefined;
            if (old) {
                const entries = ((history.entries[code] ??= {})[key] ??= []);
                if (!entries.some(record => canonical(record) === canonical(old))) entries.push(old);
            }
            const entry = validation.entries[code]![key]!; history.contracts[entry.source] = analysis.contracts[key]!;
            accepted.entries[key] = { ...entry, method: 'validated_accepted', validation_version: 1, evidence } satisfies Acceptance;
        }
        put(path, accepted);
    }
    put(DATA_ROOT + 'history.json', history); put(DATA_ROOT + 'provenance.json', provenance);
    const updated = new Map(inputs); for (const [path, value] of changes) updated.set(path, value);
    const result = analyze(updated);
    for (const code of codes) for (const key of keys) assert.equal(result.states[code]![key], 'accepted');
    return changes;
}
function sourceContracts(inputs: Inputs): Record<string, Contract> {
    if (inputs.has(DATA_ROOT + 'policy.json')) return analyze(inputs).contracts;
    const english = readJson(inputs, RESOURCE_ROOT + 'locales/en.json');
    return Object.fromEntries(Object.keys(english).sort().map(key => {
        safeText(english[key], key);
        return [key, { key, english: english[key], placeholders: placeholders(english[key]), context: contextFor(key, {}), terms: {} }];
    }));
}
export function freeze(inputs: Inputs, commit: string, base?: { inputs: Inputs; commit: string }) {
    assert.match(commit, /^[a-f0-9]{40}$/u); if (base) assert.match(base.commit, /^[a-f0-9]{40}$/u);
    const current = analyze(inputs), before = base ? sourceContracts(base.inputs) : {}, keys = [...new Set([...Object.keys(current.contracts), ...Object.keys(before)])].sort();
    const items = keys.flatMap(key => {
        const contract = current.contracts[key], previous = before[key];
        let change: 'added' | 'changed' | 'parameters_changed' | 'deleted' | 'unfinished';
        if (base) {
            if (!previous) change = 'added';
            else if (!contract) change = 'deleted';
            else if (canonical(previous.placeholders) !== canonical(contract.placeholders)) change = 'parameters_changed';
            else if (signature(previous) !== signature(contract)) change = 'changed';
            else if (current.registry.some(({ code }) => current.states[code]![key] !== 'accepted')) change = 'unfinished';
            else return [];
        } else {
            if (!current.registry.some(({ code }) => current.states[code]![key] !== 'accepted')) return [];
            change = 'unfinished';
        }
        const selected = contract ?? previous!;
        return [{ key, change, english: selected.english, simplified_chinese: current.raw['zh-CN']?.[key] ?? null,
            placeholders: selected.placeholders, context: selected.context, terminology: selected.terms,
            source_signature: contract ? current.signatures[key] : null, previous_signature: previous ? signature(previous) : null,
            languages: Object.fromEntries(current.registry.map(({ code }) => [code, current.states[code]![key] ?? 'obsolete'])) }];
    });
    const value = { schema_version: 1, kind: 'language-freeze', source_commit: commit, base_commit: base?.commit ?? null,
        inputs_sha256: current.report.inputs_sha256, catalog_sha256: current.report.catalog_sha256, items };
    return { ...value, freeze_sha256: hash(canonical(value)) };
}
