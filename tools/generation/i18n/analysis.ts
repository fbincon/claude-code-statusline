/** Build-only, deterministic language analysis. No filesystem, Git, clock or network access. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export const RESOURCE_ROOT = 'packages/core/resources/i18n/';
export const DATA_ROOT = 'tools/generation/i18n/data/';
export const POLICY_PATH = DATA_ROOT + 'policy.json';
export const STATES = ['accepted', 'missing', 'stale', 'pending_validation', 'obsolete', 'invalid'] as const;
export type State = typeof STATES[number];
export type Level = 'A' | 'B' | 'C';
export type Inputs = ReadonlyMap<string, Uint8Array>;
export interface Context { version: number; description: string; terms: string[]; cell_budget?: number }
export interface Contract { key: string; english: string; placeholders: string[]; context: Context; terms: Record<string, unknown> }
export interface Acceptance { source: string; translation: string; method: 'baseline_accepted' | 'validated_accepted'; validation_version: 1; evidence: string }
export interface History { schema_version: 1; contracts: Record<string, Contract>; entries: Record<string, Record<string, Acceptance[]>> }
export interface LanguageRow {
    level: Level; total: number; present: number; current_valid: number; accepted: number;
    missing: string[]; stale: string[]; pending_validation: string[]; obsolete: string[]; invalid: string[];
    fallback: string[]; methods: Record<string, number>;
}
export interface LanguageReport {
    schema_version: 1; kind: 'language-readiness'; inputs: Record<string, string>; inputs_sha256: string;
    catalog_sha256: string; effective_sha256: string; origins_sha256: string;
    languages: Record<string, LanguageRow>; development_ready: boolean; release_ready: boolean;
    checks: string[]; disclosure: { language: string; accepted: number; total: number; fallback: string[] }[];
}
export interface Analysis {
    registry: { code: string; name: string }[]; raw: Record<string, Record<string, string>>;
    effective: Record<string, Record<string, string>>; origins: Record<string, Record<string, string>>;
    contracts: Record<string, Contract>; signatures: Record<string, string>;
    states: Record<string, Record<string, State>>; report: LanguageReport;
}
export const hash = (value: string | Uint8Array): string => createHash('sha256').update(value).digest('hex');
export const canonical = (value: unknown): string => JSON.stringify(value, (_key, item) =>
    item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
export const signature = (contract: Contract): string => hash(canonical({ signature_version: 1, ...contract }));
const HASH = /^[a-f0-9]{64}$/u;
const object = (value: any, label: string): Record<string, any> => {
    assert(value && typeof value === 'object' && !Array.isArray(value), 'Invalid ' + label); return value;
};

/** JSON.parse supplies syntax validation; the token walk additionally rejects duplicate object keys. */
export function parseJson(bytes: Uint8Array): any {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes), value = JSON.parse(text);
    const tokens = text.match(/"(?:\\.|[^"\\])*"|[{}\[\]:,]|true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/gu) ?? [];
    const stack: (Set<string> | null)[] = [];
    for (const [i, token] of tokens.entries()) {
        if (token === '{') stack.push(new Set());
        else if (token === '[') stack.push(null);
        else if (token === '}' || token === ']') stack.pop();
        else if (token.startsWith('"') && tokens[i + 1] === ':') {
            const key = JSON.parse(token), keys = stack.at(-1); assert(keys && !keys.has(key), 'Duplicate JSON key: ' + key); keys.add(key);
        }
    }
    return value;
}
export function readJson(inputs: Inputs, path: string): any {
    const bytes = inputs.get(path); assert(bytes, 'Missing language input: ' + path); return parseJson(bytes);
}
export function placeholders(text: string): string[] {
    const names = new Set<string>();
    for (let i = 0; i < text.length; i++) {
        if ((text[i] === '{' || text[i] === '}') && text[i + 1] === text[i]) { i++; continue; }
        assert.notEqual(text[i], '}', 'Unmatched translation brace');
        if (text[i] !== '{') continue;
        const end = text.indexOf('}', i + 1), name = text.slice(i + 1, end);
        assert(end >= 0 && /^[A-Za-z_][A-Za-z_0-9]*$/u.test(name), 'Only named, unformatted placeholders are supported');
        names.add(name); i = end;
    }
    return [...names].sort();
}
export function safeText(value: unknown, key: string, english = ''): asserts value is string {
    assert(typeof value === 'string' && !/\p{Cs}/u.test(value) && !/\p{Cc}/u.test(value.replaceAll('\n', '').replaceAll('\t', '')), 'Unsafe translation: ' + key);
    assert(value.trim() || !english.trim(), 'Empty translation: ' + key);
    if (key.startsWith('statusline.')) assert(!/[\p{Cc}\p{Cs}\p{Zl}\p{Zp}]/u.test(value), 'Unsafe statusline message: ' + key);
    if (/^statusline\.(prefix|short|values|live\.label)\./u.test(key)) assert.equal(placeholders(value).length, 0, 'Statusline label has placeholders');
}
export function contextFor(key: string, entries: Record<string, unknown>): Context {
    const value = Object.hasOwn(entries, key) ? object(entries[key], 'message context') : { version: 1, description: key, terms: [] };
    assert(Number.isSafeInteger(value.version) && value.version > 0 && typeof value.description === 'string' && value.description.trim(), 'Invalid context version/description');
    assert(Array.isArray(value.terms) && value.terms.every((term: unknown) => typeof term === 'string') && new Set(value.terms).size === value.terms.length, 'Invalid context terms');
    assert(value.cell_budget === undefined || Number.isSafeInteger(value.cell_budget) && value.cell_budget > 0, 'Invalid cell budget');
    assert(Object.keys(value).every(key => ['version', 'description', 'terms', 'cell_budget'].includes(key)), 'Unknown context field');
    return { version: value.version, description: value.description, terms: [...value.terms].sort(), ...(value.cell_budget === undefined ? {} : { cell_budget: value.cell_budget }) };
}
export function languageInputPath(path: string): boolean {
    return path.startsWith(RESOURCE_ROOT) || path.startsWith(DATA_ROOT) ||
        path === 'tools/generation/resources.ts' || /^tools\/generation\/i18n\/[^/]+\.ts$/u.test(path);
}
export function requiresLanguageEvidence(inputs: Inputs): boolean {
    if (inputs.has(POLICY_PATH)) return true;
    assert(![...inputs.keys()].some(path => path.startsWith(DATA_ROOT)), 'Missing activated language policy');
    const release = inputs.get('packages/core/src/release.ts');
    const version = release && new TextDecoder().decode(release).match(/export const VERSION = ['"](\d+)\.(\d+)\./u);
    assert(!release || version, 'Cannot verify legacy language source identity');
    assert(!version || Number(version[1]) < 3 || Number(version[1]) === 3 && Number(version[2]) < 15, 'Missing activated language policy');
    return false;
}

export function analyze(inputs: Inputs): Analysis {
    assert(inputs.has('tools/generation/resources.ts') && inputs.has('tools/generation/i18n/analysis.ts'), 'Missing generator identity');
    const registry = readJson(inputs, RESOURCE_ROOT + 'languages.json');
    assert(Array.isArray(registry) && registry.length && registry[0]?.code === 'en', 'English must be the first language');
    const codes = new Set<string>(), modules = new Set<string>();
    for (const entry of registry) {
        assert(entry && Object.keys(entry).sort().join(',') === 'code,name' && typeof entry.code === 'string' && /^[a-z]{2,3}(?:-[A-Z][a-z]{3})?(?:-(?:[A-Z]{2}|[0-9]{3}))?$/u.test(entry.code), 'Invalid language registry entry');
        const module = entry.code.replaceAll('-', '_').toLowerCase();
        assert(!codes.has(entry.code) && !modules.has(module) && typeof entry.name === 'string' && entry.name.trim() && !/[\p{Cc}\p{Cs}]/u.test(entry.name), 'Duplicate or unsafe language registry entry');
        codes.add(entry.code); modules.add(module);
    }
    assert.deepEqual([...inputs.keys()].filter(path => path.startsWith(RESOURCE_ROOT + 'locales/') && path.endsWith('.json')).sort(), [...codes].map(code => RESOURCE_ROOT + 'locales/' + code + '.json').sort(), 'Registry/resource mismatch');
    const policy = readJson(inputs, POLICY_PATH), contexts = readJson(inputs, DATA_ROOT + 'context.json'), terminology = readJson(inputs, DATA_ROOT + 'terminology.json');
    const history = readJson(inputs, DATA_ROOT + 'history.json') as History, provenance = readJson(inputs, DATA_ROOT + 'provenance.json');
    for (const value of [policy, contexts, terminology, history, provenance]) assert.equal(value.schema_version, 1, 'Unsupported language input schema');
    assert.equal(policy.signature_version, 1); assert.equal(policy.validation_version, 1);
    assert.deepEqual(Object.keys(object(policy.languages, 'support policy')).sort(), [...codes].sort(), 'Unclassified language');
    for (const code of codes) {
        assert(['A', 'B', 'C'].includes(policy.languages[code]), 'Invalid support level');
        if (['en', 'zh-CN'].includes(code)) assert.equal(policy.languages[code], 'A', 'Core language cannot be demoted');
        if (['zh-TW', 'zh-HK', 'ja', 'ko', 'es', 'fr', 'de', 'pt-BR', 'ru', 'id'].includes(code)) assert.equal(policy.languages[code], 'B', 'Official language cannot be demoted');
    }
    object(contexts.entries, 'contexts'); object(terminology.entries, 'terminology'); object(history.contracts, 'historical contracts'); object(history.entries, 'historical entries'); object(provenance.records, 'acceptance provenance');
    for (const [id, contract] of Object.entries(history.contracts)) {
        assert(HASH.test(id) && signature(contract) === id, 'Historical contract identity differs');
        safeText(contract.english, contract.key); assert.deepEqual(placeholders(contract.english), contract.placeholders);
        assert.deepEqual(contextFor(contract.key, { [contract.key]: contract.context }), contract.context);
    }
    for (const [id, proof] of Object.entries(provenance.records) as [string, any][]) {
        assert(['baseline_accepted', 'validated_accepted'].includes(proof.method) && Array.isArray(proof.checks) && proof.checks.length && proof.checks.every((check: unknown) => typeof check === 'string'), 'Invalid acceptance evidence: ' + id);
        assert(Array.isArray(proof.limitations) && proof.limitations.every((item: unknown) => typeof item === 'string'), 'Missing acceptance limitations');
        if (proof.method === 'baseline_accepted') {
            assert(/^[a-f0-9]{40}$/u.test(proof.source_commit) && Number.isSafeInteger(proof.run_id) && proof.run_id > 0 && HASH.test(proof.artifact_sha256), 'Unverified baseline evidence');
            for (const [path, digest] of Object.entries(object(proof.files, 'baseline files'))) assert(inputs.has(path) && hash(inputs.get(path)!) === digest, 'Baseline snapshot differs');
        }
    }
    const raw = Object.fromEntries([...codes].map(code => [code, object(readJson(inputs, RESOURCE_ROOT + 'locales/' + code + '.json'), 'language pack')])) as Analysis['raw'];
    const english = raw.en!, keys = Object.keys(english).sort(); assert(keys.length, 'Empty English catalog');
    const contracts: Analysis['contracts'] = {}, signatures: Analysis['signatures'] = {};
    for (const key of keys) {
        safeText(english[key], key); const context = contextFor(key, contexts.entries);
        const terms = Object.fromEntries(context.terms.map(id => {
            const term = object(terminology.entries[id], 'referenced term');
            assert(Number.isSafeInteger(term.version) && term.version > 0, 'Invalid terminology version');
            assert(typeof term.description === 'string' && term.description.trim(), 'Missing terminology meaning');
            return [id, term];
        }));
        contracts[key] = { key, english: english[key]!, placeholders: placeholders(english[key]!), context, terms };
        signatures[key] = signature(contracts[key]!);
    }
    const effective: Analysis['effective'] = {}, origins: Analysis['origins'] = {}, states: Analysis['states'] = {}, rows: LanguageReport['languages'] = {};
    const baselinePacks = new Map<string, Record<string, string>>(), baselineDigests = new Map<string, string>();
    const baselinePack = (code: string) => {
        if (!baselinePacks.has(code)) baselinePacks.set(code, readJson(inputs, DATA_ROOT + 'baseline/locales/' + code + '.json'));
        return baselinePacks.get(code)!;
    };
    const verifyRecord = (record: Acceptance, code: string, key: string): Contract => {
        assert(record && HASH.test(record.source) && HASH.test(record.translation) && record.validation_version === 1, 'Invalid acceptance identity');
        const contract = history.contracts[record.source]; assert(contract && contract.key === key, 'Acceptance has no verified contract');
        const proof = provenance.records[record.evidence]; assert(proof && proof.method === record.method, 'Acceptance has no matching evidence');
        if (record.method === 'baseline_accepted') {
            const baseline = baselinePack(code), source = baselinePack('en');
            for (const language of ['en', code]) {
                const path = DATA_ROOT + 'baseline/locales/' + language + '.json';
                if (!baselineDigests.has(path)) baselineDigests.set(path, hash(inputs.get(path)!));
                assert(proof.files[path] === baselineDigests.get(path), 'Unbound baseline language snapshot');
            }
            assert(Object.hasOwn(baseline, key) && hash(baseline[key]!) === record.translation && source[key] === contract.english && proof.signatures[key] === record.source, 'Baseline does not cover this entry');
        } else {
            assert(proof.entries?.[code]?.[key]?.source === record.source && proof.entries[code][key].translation === record.translation, 'Validation does not cover this entry');
        }
        return contract;
    };
    for (const { code } of registry) {
        const accepted = readJson(inputs, DATA_ROOT + 'accepted/' + code + '.json'); assert.equal(accepted.schema_version, 1); assert.equal(accepted.language, code); object(accepted.entries, 'accepted entries');
        const old = object(history.entries[code] ?? {}, 'language history');
        for (const [key, record] of Object.entries(accepted.entries)) verifyRecord(record as Acceptance, code, key);
        for (const [key, records] of Object.entries(old)) { assert(Array.isArray(records), 'Invalid historical records'); for (const record of records) verifyRecord(record, code, key); }
        const row: LanguageRow = { level: policy.languages[code], total: keys.length, present: 0, current_valid: 0, accepted: 0, missing: [], stale: [], pending_validation: [], obsolete: [], invalid: [], fallback: [], methods: {} };
        rows[code] = row; effective[code] = {}; origins[code] = {}; states[code] = {};
        for (const key of [...new Set([...keys, ...Object.keys(raw[code]!)])].sort()) {
            const exists = Object.hasOwn(raw[code]!, key), current = Object.hasOwn(english, key), value = raw[code]![key];
            const record = accepted.entries[key] as Acceptance | undefined, prior = [...(record ? [record] : []), ...(old[key] ?? [])] as Acceptance[];
            let state: State = 'missing';
            if (exists) {
                if (current) row.present++;
                try {
                    safeText(value, key, current ? english[key] : '');
                    const fields = placeholders(value!), digest = hash(value!);
                    const historical = prior.find(item => item.translation === digest);
                    if (!current) {
                        assert(historical, 'Unexplained extra key');
                        assert.deepEqual(fields, history.contracts[historical.source]!.placeholders, 'Retired template differs from its historical contract');
                        state = 'obsolete';
                    }
                    else if (canonical(fields) !== canonical(contracts[key]!.placeholders)) {
                        assert(historical && canonical(fields) === canonical(history.contracts[historical.source]!.placeholders), 'New placeholder mismatch'); state = 'stale';
                    } else {
                        if (record && record.source === signatures[key] && record.translation === digest) state = 'accepted';
                        else if (historical && historical.source !== signatures[key]) state = 'stale';
                        else state = 'pending_validation';
                        if (state !== 'stale') row.current_valid++;
                    }
                } catch { state = 'invalid'; }
            }
            states[code]![key] = state;
            if (state === 'accepted') { row.accepted++; row.methods[record!.method] = (row.methods[record!.method] ?? 0) + 1; }
            else row[state].push(key);
            if (current) {
                effective[code]![key] = state === 'accepted' ? value! : english[key]!;
                origins[code]![key] = state === 'accepted' ? code : 'en';
                if (code !== 'en' && state !== 'accepted') row.fallback.push(key);
            }
        }
    }
    const bound = Object.fromEntries([...inputs].filter(([path]) => languageInputPath(path)).sort(([a], [b]) => a < b ? -1 : 1).map(([path, bytes]) => [path, hash(bytes)]));
    const safe = Object.values(rows).every(row => row.invalid.length === 0);
    const complete = (row: LanguageRow) => row.accepted === row.total && row.invalid.length === 0;
    const report: LanguageReport = { schema_version: 1, kind: 'language-readiness', inputs: bound, inputs_sha256: hash(canonical(bound)), catalog_sha256: hash(canonical(signatures)),
        effective_sha256: hash(canonical(effective)), origins_sha256: hash(canonical(origins)), languages: rows,
        development_ready: safe && Object.values(rows).filter(row => row.level === 'A').every(complete),
        release_ready: safe && Object.values(rows).filter(row => row.level !== 'C').every(complete),
        checks: ['registry', 'duplicate-keys', 'text-safety', 'templates', 'source-signatures', 'translation-hashes', 'acceptance-provenance', 'historical-contracts'],
        disclosure: Object.entries(rows).filter(([, row]) => row.level === 'C').map(([language, row]) => ({ language, accepted: row.accepted, total: row.total, fallback: row.fallback })) };
    return { registry, raw, effective, origins, contracts, signatures, states, report };
}
export function assertReady(report: LanguageReport, release = false): void {
    assert(release ? report.release_ready : report.development_ready, (release ? 'Release' : 'Development') + ' language gate failed: ' +
        Object.entries(report.languages).filter(([, row]) => row.invalid.length || (release ? row.level !== 'C' : row.level === 'A') && row.accepted !== row.total)
            .map(([code, row]) => `${code} ${row.accepted}/${row.total}, invalid=${row.invalid.length}`).join('; '));
}
