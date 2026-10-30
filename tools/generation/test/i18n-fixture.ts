/** Small, self-contained catalogs for lifecycle and accepted-base compatibility tests. */
import { DATA_ROOT, RESOURCE_ROOT, canonical, contextFor, hash, placeholders, readJson, signature, type Acceptance, type Contract, type History } from '../i18n/analysis.js';

export const put = (inputs: Map<string, Uint8Array>, path: string, value: unknown) => inputs.set(path, Buffer.from(JSON.stringify(value)));
export function fixture(community = false, communityCode = 'pl'): Map<string, Uint8Array> {
    const inputs = new Map<string, Uint8Array>();
    inputs.set('tools/generation/resources.ts', Buffer.from('// Synthetic generator identity\n'));
    inputs.set('tools/generation/i18n/analysis.ts', Buffer.from('// Synthetic analysis identity\n'));
    const codes = ['en', 'zh-CN', 'ja', ...(community ? [communityCode] : [])];
    put(inputs, RESOURCE_ROOT + 'languages.json', codes.map(code => ({ code, name: code })));
    const english = { hello: 'Hello {name}', 'statusline.example': 'Count {count}', term: 'Git' };
    for (const code of codes) put(inputs, RESOURCE_ROOT + 'locales/' + code + '.json', { ...english, ...(code === 'en' ? {} : { hello: code + ' {name}' }) });
    put(inputs, DATA_ROOT + 'policy.json', { schema_version: 1, signature_version: 1, validation_version: 1, languages: Object.fromEntries(codes.map(code => [code, code === 'ja' ? 'B' : code === communityCode ? 'C' : 'A'])) });
    put(inputs, DATA_ROOT + 'context.json', { schema_version: 1, entries: {} });
    put(inputs, DATA_ROOT + 'terminology.json', { schema_version: 1, entries: {} });
    put(inputs, DATA_ROOT + 'history.json', { schema_version: 1, contracts: {}, entries: {} });
    put(inputs, DATA_ROOT + 'provenance.json', { schema_version: 1, records: {} });
    for (const code of codes) put(inputs, DATA_ROOT + 'accepted/' + code + '.json', { schema_version: 1, language: code, entries: {} });
    acceptFixture(inputs, codes);
    return inputs;
}
export function acceptFixture(inputs: Map<string, Uint8Array>, codes: string[], selected?: string[]): void {
    const english = readJson(inputs, RESOURCE_ROOT + 'locales/en.json'), contexts = readJson(inputs, DATA_ROOT + 'context.json');
    const terminology = readJson(inputs, DATA_ROOT + 'terminology.json'), history = readJson(inputs, DATA_ROOT + 'history.json') as History;
    const proof = { method: 'validated_accepted', checks: ['fixture-structural', 'fixture-context'], limitations: ['Synthetic fixture; no native-speaker claim'], entries: {} as Record<string, Record<string, { source: string; translation: string }>> };
    const updated = new Map<string, any>();
    for (const code of codes) {
        const raw = readJson(inputs, RESOURCE_ROOT + 'locales/' + code + '.json'), accepted = readJson(inputs, DATA_ROOT + 'accepted/' + code + '.json');
        proof.entries[code] = {};
        for (const key of selected ?? Object.keys(english)) {
            const context = contextFor(key, contexts.entries), contract: Contract = { key, english: english[key], placeholders: placeholders(english[key]), context,
                terms: Object.fromEntries(context.terms.map(id => [id, terminology.entries[id]])) };
            const source = signature(contract), translation = hash(raw[key]); history.contracts[source] = contract;
            const old = accepted.entries[key] as Acceptance | undefined;
            if (old) ((history.entries[code] ??= {})[key] ??= []).push(old);
            accepted.entries[key] = { source, translation, method: 'validated_accepted', validation_version: 1, evidence: '' };
            proof.entries[code]![key] = { source, translation };
        }
        updated.set(code, accepted);
    }
    const id = hash(canonical(proof)), provenance = readJson(inputs, DATA_ROOT + 'provenance.json'); provenance.records[id] = proof;
    for (const [code, accepted] of updated) {
        for (const key of Object.keys(proof.entries[code]!)) accepted.entries[key].evidence = id;
        put(inputs, DATA_ROOT + 'accepted/' + code + '.json', accepted);
    }
    put(inputs, DATA_ROOT + 'provenance.json', provenance); put(inputs, DATA_ROOT + 'history.json', history);
}
export function editPack(inputs: Map<string, Uint8Array>, code: string, edit: (pack: Record<string, string>) => void): void {
    const path = RESOURCE_ROOT + 'locales/' + code + '.json', value = readJson(inputs, path); edit(value); put(inputs, path, value);
}
