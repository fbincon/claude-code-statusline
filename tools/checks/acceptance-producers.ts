/** Classify every non-test top-level tools/acceptance module and verify the
 * bilingual registry projections in the testing guide. */
import * as fs from 'node:fs';
import { join } from 'node:path';

export type Role = 'producer' | 'diagnostic' | 'helper' | 'wrapper' | 'driver';
export type EvidenceClass =
    | 'complete-acceptance'
    | 'additional-smoke'
    | 'official-host'
    | 'demonstration'
    | 'diagnostic'
    | 'manual'
    | 'paid'
    | 'physical'
    | 'legacy'
    | 'none';
export type EnvelopeStatus =
    | 'adopted'
    | 'planned'
    | 'embedded-via-parent'
    | 'blocked-reader-first'
    | 'diagnostic-opt-out'
    | 'manual-opt-out'
    | 'not-applicable';
export type ValidationPath = 'ci' | 'official-host' | 'local' | 'manual' | 'paid' | 'physical' | 'none';

export interface AcceptanceProducer {
    file: string;
    role: Role;
    outputs: readonly string[];
    promotable: boolean;
    evidence: EvidenceClass;
    envelope: EnvelopeStatus;
    validation: ValidationPath;
}

const ROLES = new Set<string>(['producer', 'diagnostic', 'helper', 'wrapper', 'driver']);
const EVIDENCE = new Set<string>(['complete-acceptance', 'additional-smoke', 'official-host', 'demonstration',
    'diagnostic', 'manual', 'paid', 'physical', 'legacy', 'none']);
const ENVELOPES = new Set<string>(['adopted', 'planned', 'embedded-via-parent', 'blocked-reader-first',
    'diagnostic-opt-out', 'manual-opt-out', 'not-applicable']);
const VALIDATIONS = new Set<string>(['ci', 'official-host', 'local', 'manual', 'paid', 'physical', 'none']);
const NON_PRODUCERS = new Set<string>(['helper', 'wrapper', 'driver']);
const PLANNED_ALLOWED = new Set<string>(['installed.ts', 'mods.ts', 'integration-smoke.ts']);
const FILE_PATTERN = /^[a-z0-9][a-z0-9-]*\.ts$/u;
const OUTPUT_PATTERN = /^[a-z0-9][a-z0-9_.:-]*$/u;
const ANCHOR = '<a id="acceptance-receipt-producers"></a>';
const START = '<!-- acceptance-producers:start -->';
const END = '<!-- acceptance-producers:end -->';
const DOCS = ['docs/development/testing.md', 'docs/development/testing.zh-CN.md'] as const;
const HEADERS = [
    ['File', 'Role', 'Primary outputs', 'Promotable', 'Evidence class', 'Envelope', 'Validation', 'Notes'],
    ['文件', '角色', '主要输出', '可晋升', '证据类别', 'Envelope', '校验', '说明'],
] as const;
const HEADINGS = ['## Acceptance receipt producers', '## 验收回执生产者'] as const;
const COLUMNS = ['file', 'role', 'outputs', 'promotable', 'evidence', 'envelope', 'validation'] as const;

export const ACCEPTANCE_PRODUCERS: readonly AcceptanceProducer[] = [
    { file: 'artifact.ts', role: 'helper', outputs: [], promotable: false, evidence: 'none', envelope: 'not-applicable', validation: 'none' },
    { file: 'budget.ts', role: 'helper', outputs: [], promotable: false, evidence: 'none', envelope: 'not-applicable', validation: 'none' },
    { file: 'budgets.ts', role: 'helper', outputs: [], promotable: false, evidence: 'none', envelope: 'not-applicable', validation: 'none' },
    { file: 'diagnostics.ts', role: 'helper', outputs: [], promotable: false, evidence: 'none', envelope: 'not-applicable', validation: 'none' },
    { file: 'editor-capture.ts', role: 'producer', outputs: ['editor-capture.json'], promotable: false, evidence: 'demonstration', envelope: 'adopted', validation: 'manual' },
    { file: 'editor-shells.ts', role: 'helper', outputs: [], promotable: false, evidence: 'none', envelope: 'not-applicable', validation: 'none' },
    { file: 'first-entry.ts', role: 'helper', outputs: [], promotable: false, evidence: 'none', envelope: 'not-applicable', validation: 'none' },
    { file: 'fixture-processes.ts', role: 'helper', outputs: [], promotable: false, evidence: 'none', envelope: 'not-applicable', validation: 'none' },
    { file: 'git-policy.ts', role: 'helper', outputs: [], promotable: false, evidence: 'none', envelope: 'not-applicable', validation: 'none' },
    { file: 'historical-inputs.ts', role: 'helper', outputs: [], promotable: false, evidence: 'none', envelope: 'not-applicable', validation: 'none' },
    { file: 'historical-releases.ts', role: 'helper', outputs: [], promotable: false, evidence: 'none', envelope: 'not-applicable', validation: 'none' },
    { file: 'install.ts', role: 'helper', outputs: [], promotable: false, evidence: 'none', envelope: 'not-applicable', validation: 'none' },
    { file: 'installed-admission.ts', role: 'helper', outputs: [], promotable: false, evidence: 'none', envelope: 'not-applicable', validation: 'none' },
    { file: 'installed-case.ts', role: 'helper', outputs: [], promotable: false, evidence: 'none', envelope: 'not-applicable', validation: 'none' },
    { file: 'installed-commands.ts', role: 'helper', outputs: [], promotable: false, evidence: 'none', envelope: 'not-applicable', validation: 'none' },
    { file: 'installed-language-process.ts', role: 'helper', outputs: [], promotable: false, evidence: 'none', envelope: 'not-applicable', validation: 'none' },
    { file: 'installed-language-worker.ts', role: 'wrapper', outputs: [], promotable: false, evidence: 'none', envelope: 'not-applicable', validation: 'none' },
    { file: 'installed-language.ts', role: 'diagnostic', outputs: ['installed-language-sample'], promotable: false, evidence: 'diagnostic', envelope: 'diagnostic-opt-out', validation: 'ci' },
    { file: 'installed-plan.ts', role: 'helper', outputs: [], promotable: false, evidence: 'none', envelope: 'not-applicable', validation: 'none' },
    { file: 'installed-supervisor.ts', role: 'diagnostic', outputs: ['events.jsonl'], promotable: false, evidence: 'diagnostic', envelope: 'diagnostic-opt-out', validation: 'local' },
    { file: 'installed.ts', role: 'producer', outputs: ['installed.json'], promotable: true, evidence: 'complete-acceptance', envelope: 'planned', validation: 'ci' },
    { file: 'integration-smoke.ts', role: 'producer', outputs: ['smoke.json'], promotable: true, evidence: 'additional-smoke', envelope: 'planned', validation: 'ci' },
    { file: 'language-budget.ts', role: 'helper', outputs: [], promotable: false, evidence: 'none', envelope: 'not-applicable', validation: 'none' },
    { file: 'language-comparison.ts', role: 'diagnostic', outputs: ['installed-language-comparison'], promotable: false, evidence: 'diagnostic', envelope: 'diagnostic-opt-out', validation: 'ci' },
    { file: 'mod-types.ts', role: 'helper', outputs: [], promotable: false, evidence: 'none', envelope: 'not-applicable', validation: 'none' },
    { file: 'mods.ts', role: 'producer', outputs: ['mods.json'], promotable: true, evidence: 'official-host', envelope: 'planned', validation: 'official-host' },
    { file: 'native-capacity-pty.ts', role: 'producer', outputs: ['pty-reports'], promotable: false, evidence: 'manual', envelope: 'manual-opt-out', validation: 'manual' },
    { file: 'native-capacity.ts', role: 'producer', outputs: ['mods.json:capacity'], promotable: true, evidence: 'official-host', envelope: 'embedded-via-parent', validation: 'official-host' },
    { file: 'native-stability.ts', role: 'producer', outputs: ['native-stability.json'], promotable: true, evidence: 'official-host', envelope: 'embedded-via-parent', validation: 'official-host' },
    { file: 'official-tests.ts', role: 'producer', outputs: ['mods.json:official_tests'], promotable: true, evidence: 'official-host', envelope: 'embedded-via-parent', validation: 'official-host' },
    { file: 'paid-evidence.ts', role: 'helper', outputs: [], promotable: false, evidence: 'none', envelope: 'not-applicable', validation: 'none' },
    { file: 'paid.ts', role: 'producer', outputs: ['paid-ledger'], promotable: false, evidence: 'paid', envelope: 'manual-opt-out', validation: 'paid' },
    { file: 'phase-budget.ts', role: 'helper', outputs: [], promotable: false, evidence: 'none', envelope: 'not-applicable', validation: 'none' },
    { file: 'physical-budgets.ts', role: 'helper', outputs: [], promotable: false, evidence: 'none', envelope: 'not-applicable', validation: 'none' },
    { file: 'physical-sections.ts', role: 'helper', outputs: [], promotable: false, evidence: 'none', envelope: 'not-applicable', validation: 'none' },
    { file: 'physical.ts', role: 'producer', outputs: ['fragment.json'], promotable: true, evidence: 'complete-acceptance', envelope: 'blocked-reader-first', validation: 'physical' },
    { file: 'power-evidence.ts', role: 'helper', outputs: [], promotable: false, evidence: 'none', envelope: 'not-applicable', validation: 'none' },
    { file: 'power.ts', role: 'producer', outputs: ['power-observation'], promotable: false, evidence: 'physical', envelope: 'manual-opt-out', validation: 'physical' },
    { file: 'render-capture.ts', role: 'helper', outputs: [], promotable: false, evidence: 'none', envelope: 'not-applicable', validation: 'none' },
    { file: 'runtime-shared.ts', role: 'producer', outputs: ['runtime.json'], promotable: false, evidence: 'legacy', envelope: 'not-applicable', validation: 'local' },
    { file: 'runtime.ts', role: 'producer', outputs: ['runtime.json'], promotable: false, evidence: 'legacy', envelope: 'not-applicable', validation: 'local' },
    { file: 'scoped-test-files.ts', role: 'wrapper', outputs: [], promotable: false, evidence: 'none', envelope: 'not-applicable', validation: 'none' },
    { file: 'setup-appearance-capture.ts', role: 'producer', outputs: ['samples.json'], promotable: false, evidence: 'manual', envelope: 'manual-opt-out', validation: 'manual' },
    { file: 'setup-appearance-driver.ts', role: 'driver', outputs: [], promotable: false, evidence: 'none', envelope: 'not-applicable', validation: 'none' },
    { file: 'short-history.ts', role: 'helper', outputs: [], promotable: false, evidence: 'none', envelope: 'not-applicable', validation: 'none' },
    { file: 'showcase-driver.ts', role: 'driver', outputs: [], promotable: false, evidence: 'none', envelope: 'not-applicable', validation: 'none' },
    { file: 'showcase-journeys.ts', role: 'producer', outputs: ['journey-receipt.json'], promotable: false, evidence: 'manual', envelope: 'manual-opt-out', validation: 'local' },
    { file: 'showcase-operations.ts', role: 'producer', outputs: ['summary.json'], promotable: false, evidence: 'manual', envelope: 'manual-opt-out', validation: 'manual' },
    { file: 'showcase-paid.ts', role: 'producer', outputs: ['receipt.json'], promotable: false, evidence: 'paid', envelope: 'manual-opt-out', validation: 'paid' },
    { file: 'showcase-replay.ts', role: 'producer', outputs: ['replay-receipt.json'], promotable: false, evidence: 'manual', envelope: 'manual-opt-out', validation: 'local' },
    { file: 'showcase.ts', role: 'producer', outputs: ['receipt.json'], promotable: false, evidence: 'demonstration', envelope: 'adopted', validation: 'manual' },
    { file: 'supervised-node.ts', role: 'wrapper', outputs: [], promotable: false, evidence: 'none', envelope: 'not-applicable', validation: 'none' },
    { file: 'task-fixture.ts', role: 'helper', outputs: [], promotable: false, evidence: 'none', envelope: 'not-applicable', validation: 'none' },
    { file: 'task-input-pty.ts', role: 'helper', outputs: [], promotable: false, evidence: 'none', envelope: 'not-applicable', validation: 'none' },
    { file: 'terminal-evidence.ts', role: 'helper', outputs: [], promotable: false, evidence: 'none', envelope: 'not-applicable', validation: 'none' },
    { file: 'terminal.ts', role: 'producer', outputs: ['interaction.json'], promotable: false, evidence: 'physical', envelope: 'manual-opt-out', validation: 'physical' },
    { file: 'trace-process.ts', role: 'wrapper', outputs: [], promotable: false, evidence: 'none', envelope: 'not-applicable', validation: 'none' },
    { file: 'version-management-official.ts', role: 'producer', outputs: ['version-history'], promotable: true, evidence: 'official-host', envelope: 'embedded-via-parent', validation: 'official-host' },
    { file: 'version-management.ts', role: 'helper', outputs: [], promotable: false, evidence: 'none', envelope: 'not-applicable', validation: 'none' },
    { file: 'windows-shell.ts', role: 'helper', outputs: [], promotable: false, evidence: 'none', envelope: 'not-applicable', validation: 'none' },
];

function compare(left: string, right: string): number {
    return left < right ? -1 : left > right ? 1 : 0;
}
function text(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}
function token(cell: string): string | undefined {
    const match = /^`([^`]+)`$/u.exec(cell.trim());
    return match?.[1];
}
function outputsCell(value: string): string[] | undefined {
    if (value.trim() === 'none') return [];
    const parts = value.split(' · ');
    const result: string[] = [];
    for (const part of parts) {
        const item = token(part);
        if (!item) return undefined;
        result.push(item);
    }
    return result;
}
function cells(line: string): string[] | undefined {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return undefined;
    return trimmed.slice(1, -1).split('|').map(cell => cell.trim());
}
function sameValues(left: readonly string[], right: readonly string[]): boolean {
    return left.length === right.length && left.every((value, index) => value === right[index]);
}
function entryError(entry: AcceptanceProducer, message: string): string {
    return 'tools/acceptance/' + entry.file + ': ' + message;
}

function validateEntry(entry: AcceptanceProducer): string[] {
    const errors: string[] = [];
    const fail = (message: string) => errors.push(entryError(entry, message));
    if (!text(entry.file) || !FILE_PATTERN.test(entry.file) || entry.file.includes('/'))
        fail('file must be a top-level lowercase .ts basename');
    if (!ROLES.has(entry.role)) fail('unknown role: ' + String(entry.role));
    if (!EVIDENCE.has(entry.evidence)) fail('unknown evidence class: ' + String(entry.evidence));
    if (!ENVELOPES.has(entry.envelope)) fail('unknown envelope status: ' + String(entry.envelope));
    if (!VALIDATIONS.has(entry.validation)) fail('unknown validation path: ' + String(entry.validation));
    if (typeof entry.promotable !== 'boolean') fail('promotable must be boolean');
    if (!Array.isArray(entry.outputs)) fail('outputs must be an array');
    else {
        if (new Set(entry.outputs).size !== entry.outputs.length) fail('outputs must be unique');
        for (const output of entry.outputs)
            if (typeof output !== 'string' || !OUTPUT_PATTERN.test(output)) fail('invalid output token: ' + String(output));
    }
    const outputs = Array.isArray(entry.outputs) ? entry.outputs : [];
    if (NON_PRODUCERS.has(entry.role)) {
        if (outputs.length) fail('helper, wrapper and driver entries must not declare outputs');
        if (entry.promotable) fail('helper, wrapper and driver entries must not be promotable');
        if (entry.evidence !== 'none') fail('helper, wrapper and driver entries must use evidence none');
        if (entry.envelope !== 'not-applicable') fail('helper, wrapper and driver entries must use envelope not-applicable');
        if (entry.validation !== 'none') fail('helper, wrapper and driver entries must use validation none');
    } else {
        if (!outputs.length) fail('producer and diagnostic entries require outputs');
        if (entry.validation === 'none') fail('producer and diagnostic entries require a validation path');
    }
    if (entry.role === 'diagnostic') {
        if (entry.promotable) fail('diagnostic entries must not be promotable');
        if (entry.evidence !== 'diagnostic') fail('diagnostic entries must use evidence diagnostic');
        if (entry.envelope !== 'diagnostic-opt-out') fail('diagnostic entries must use envelope diagnostic-opt-out');
    }
    if (entry.evidence === 'none' && !NON_PRODUCERS.has(entry.role))
        fail('evidence none is only valid for helper, wrapper and driver entries');
    if (entry.evidence === 'diagnostic' && entry.role !== 'diagnostic')
        fail('evidence diagnostic is only valid for diagnostic entries');
    if (entry.evidence === 'legacy') {
        if (entry.promotable) fail('legacy evidence must not be promotable');
        if (entry.envelope !== 'not-applicable') fail('legacy evidence must use envelope not-applicable');
    }
    if (entry.evidence === 'demonstration' && entry.promotable)
        fail('demonstration evidence must not be promotable');
    if (entry.evidence === 'additional-smoke') {
        if (!entry.promotable) fail('additional-smoke evidence must be promotable');
        if (!['adopted', 'planned'].includes(entry.envelope))
            fail('additional-smoke evidence must use envelope adopted or planned');
    }
    if (['manual', 'paid', 'physical'].includes(entry.evidence)) {
        if (entry.promotable) fail(entry.evidence + ' evidence must not be promotable');
        if (entry.envelope !== 'manual-opt-out') fail(entry.evidence + ' evidence must use envelope manual-opt-out');
    }
    if (entry.evidence === 'complete-acceptance') {
        if (!entry.promotable) fail('complete-acceptance evidence must be promotable');
        if (!['adopted', 'planned', 'blocked-reader-first'].includes(entry.envelope))
            fail('complete-acceptance evidence must use envelope adopted, planned or blocked-reader-first');
    }
    if (entry.evidence === 'official-host') {
        if (!entry.promotable) fail('official-host evidence must be promotable');
        if (!['adopted', 'planned', 'embedded-via-parent'].includes(entry.envelope))
            fail('official-host evidence must use envelope adopted, planned or embedded-via-parent');
    }
    if (entry.envelope === 'adopted' && !entry.promotable && entry.evidence !== 'demonstration')
        fail('adopted envelope requires promotable evidence or demonstration evidence');
    if (entry.envelope === 'planned') {
        if (!entry.promotable) fail('planned envelope must be promotable');
        if (!['complete-acceptance', 'additional-smoke', 'official-host'].includes(entry.evidence))
            fail('planned envelope requires complete-acceptance, additional-smoke or official-host evidence');
    }
    if (entry.envelope === 'embedded-via-parent') {
        if (entry.role !== 'producer') fail('embedded-via-parent requires role producer');
        if (!entry.promotable) fail('embedded-via-parent must be promotable');
        if (!['complete-acceptance', 'official-host'].includes(entry.evidence))
            fail('embedded-via-parent requires complete-acceptance or official-host evidence');
    }
    if (entry.envelope === 'blocked-reader-first') {
        if (entry.role !== 'producer') fail('blocked-reader-first requires role producer');
        if (!entry.promotable) fail('blocked-reader-first must be promotable');
        if (entry.evidence !== 'complete-acceptance')
            fail('blocked-reader-first requires complete-acceptance evidence');
    }
    if (entry.envelope === 'diagnostic-opt-out') {
        if (entry.role !== 'diagnostic') fail('diagnostic-opt-out requires role diagnostic');
        if (entry.evidence !== 'diagnostic') fail('diagnostic-opt-out requires evidence diagnostic');
        if (entry.promotable) fail('diagnostic-opt-out must not be promotable');
    }
    if (entry.envelope === 'manual-opt-out') {
        if (entry.role !== 'producer') fail('manual-opt-out requires role producer');
        if (entry.promotable) fail('manual-opt-out must not be promotable');
        if (!['manual', 'paid', 'physical'].includes(entry.evidence))
            fail('manual-opt-out requires manual, paid or physical evidence');
    }
    if (entry.envelope === 'not-applicable' && entry.promotable)
        fail('not-applicable envelope must not be promotable');
    return errors;
}

/** Lock the decisions that must not be silently reclassified. */
export function validateKnownExceptions(entries: readonly AcceptanceProducer[]): string[] {
    const errors: string[] = [];
    const byFile = new Map(entries.map(entry => [entry.file, entry]));
    const expect = (file: string, predicate: (entry: AcceptanceProducer) => boolean, message: string) => {
        const entry = byFile.get(file);
        if (!entry) errors.push('acceptance producer registry: missing fixed entry ' + file);
        else if (!predicate(entry)) errors.push('acceptance producer registry: ' + file + ' must ' + message);
    };
    expect('physical.ts', entry => entry.role === 'producer' && entry.promotable
        && entry.evidence === 'complete-acceptance' && entry.envelope === 'blocked-reader-first',
    'remain a promotable complete-acceptance producer with blocked-reader-first envelope');
    for (const file of ['official-tests.ts', 'native-capacity.ts', 'native-stability.ts', 'version-management-official.ts'])
        expect(file, entry => entry.role === 'producer' && entry.promotable
            && entry.evidence === 'official-host' && entry.envelope === 'embedded-via-parent',
        'remain a promotable official-host producer with embedded-via-parent envelope');
    for (const file of ['showcase.ts', 'editor-capture.ts'])
        expect(file, entry => entry.role === 'producer' && !entry.promotable
            && entry.evidence === 'demonstration' && entry.envelope === 'adopted',
        'remain a non-promotable demonstration producer with adopted envelope');
    for (const file of ['installed.ts', 'mods.ts'])
        expect(file, entry => entry.role === 'producer' && entry.promotable && entry.envelope === 'planned',
            'remain a promotable producer with planned envelope');
    expect('integration-smoke.ts', entry => entry.role === 'producer' && entry.promotable
        && entry.evidence === 'additional-smoke' && entry.envelope === 'planned',
    'remain a promotable additional-smoke producer with planned envelope');
    for (const file of ['runtime.ts', 'runtime-shared.ts'])
        expect(file, entry => entry.role === 'producer' && !entry.promotable
            && entry.evidence === 'legacy' && entry.envelope === 'not-applicable',
        'remain a non-promotable legacy producer with not-applicable envelope');
    for (const entry of entries)
        if (entry.envelope === 'planned' && !PLANNED_ALLOWED.has(entry.file))
            errors.push('acceptance producer registry: ' + entry.file + ' must not use planned; new producers must adopt the envelope');
    for (const entry of entries)
        if (entry.envelope === 'blocked-reader-first' && entry.file !== 'physical.ts')
            errors.push('acceptance producer registry: ' + entry.file + ' must not use blocked-reader-first; only physical.ts is reader-blocked');
    return errors;
}

function validateVocabularyUsage(entries: readonly AcceptanceProducer[]): string[] {
    const errors: string[] = [];
    const used = {
        role: new Set<string>(entries.map(entry => entry.role)),
        evidence: new Set<string>(entries.map(entry => entry.evidence)),
        envelope: new Set<string>(entries.map(entry => entry.envelope)),
        validation: new Set<string>(entries.map(entry => entry.validation)),
    };
    for (const [name, values] of [['role', ROLES], ['evidence', EVIDENCE], ['envelope', ENVELOPES], ['validation', VALIDATIONS]] as const)
        for (const value of values)
            if (!used[name].has(value)) errors.push('acceptance producer registry: unused ' + name + ' token ' + value);
    return errors;
}

function scanFiles(root: string, errors: string[]): string[] | undefined {
    const directory = join(root, 'tools', 'acceptance');
    if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) return undefined;
    const files: string[] = [];
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (!entry.name.endsWith('.ts')) continue;
        if (!entry.isFile()) {
            errors.push('tools/acceptance/' + entry.name + ': .ts entry must be a regular file');
            continue;
        }
        files.push(entry.name);
    }
    return files.sort(compare);
}

function parseTable(root: string, path: string, expectedHeader: readonly string[], expectedHeading: string, entries: readonly AcceptanceProducer[]): string[] {
    const errors: string[] = [];
    const source = fs.readFileSync(join(root, path), 'utf8').replaceAll('\r\n', '\n');
    const lines = source.split('\n');
    const anchors = lines.map((line, index) => line.includes(ANCHOR) ? index : -1).filter(index => index >= 0);
    const starts = lines.map((line, index) => line.trim() === START ? index : -1).filter(index => index >= 0);
    const ends = lines.map((line, index) => line.trim() === END ? index : -1).filter(index => index >= 0);
    if (anchors.length !== 1) errors.push(path + ': expected exactly one acceptance producer registry anchor, found ' + anchors.length);
    if (starts.length !== 1) errors.push(path + ': expected exactly one acceptance producer start marker, found ' + starts.length);
    if (ends.length !== 1) errors.push(path + ': expected exactly one acceptance producer end marker, found ' + ends.length);
    if (starts.length !== 1 || ends.length !== 1) return errors;
    const start = starts[0]!, end = ends[0]!;
    if (start > end) errors.push(path + ': acceptance producer end marker precedes the start marker');
    if (anchors.length === 1) {
        const anchor = anchors[0]!;
        if (anchor > start) errors.push(path + ': acceptance producer anchor must precede the table');
        else {
            const next = lines.slice(anchor + 1).find(line => line.trim());
            if (next !== expectedHeading) errors.push(path + ': acceptance producer anchor must be followed by ' + expectedHeading);
        }
    }
    const block = lines.slice(start + 1, end).filter(line => line.trim());
    if (block.length < 3) { errors.push(path + ': acceptance producer table is missing header, separator or rows'); return errors; }
    const header = cells(block[0]!);
    if (!header || !sameValues(header, expectedHeader)) errors.push(path + ': acceptance producer table header does not match the template');
    const separator = cells(block[1]!);
    if (!separator || separator.length !== expectedHeader.length || !separator.every(cell => /^:?-{3,}:?$/u.test(cell)))
        errors.push(path + ': acceptance producer table separator is malformed');
    const rows = block.slice(2);
    if (rows.length !== entries.length)
        errors.push(path + ': acceptance producer table has ' + rows.length + ' rows, expected ' + entries.length);
    const limit = Math.min(rows.length, entries.length);
    const seen = new Set<string>();
    for (let index = 0; index < limit; index++) {
        const row = cells(rows[index]!);
        const entry = entries[index]!;
        if (!row || row.length !== 8) { errors.push(path + ': row ' + (index + 1) + ' must have exactly 8 columns'); continue; }
        const file = token(row[0]!), role = token(row[1]!), evidence = token(row[4]!), envelope = token(row[5]!), validation = token(row[6]!);
        const outputs = outputsCell(row[2]!);
        const promotable = row[3] === 'yes' ? true : row[3] === 'no' ? false : undefined;
        const notes = row[7]!;
        if (!file || !FILE_PATTERN.test(file) || file.includes('/')) { errors.push(path + ': row ' + (index + 1) + ' has an invalid File cell'); continue; }
        if (!role || !evidence || !envelope || !validation || promotable === undefined || outputs === undefined || !notes) {
            errors.push(path + ': row ' + (index + 1) + ' has an invalid machine or Notes cell');
            continue;
        }
        if (seen.has(file)) errors.push(path + ': duplicate registry row ' + file);
        seen.add(file);
        const values: Record<(typeof COLUMNS)[number], unknown> = {
            file, role, outputs, promotable, evidence, envelope, validation,
        };
        for (const column of COLUMNS) {
            const expected = entry[column];
            const actual = values[column];
            const equal = column === 'outputs' ? Array.isArray(actual) && sameValues(actual as string[], expected as readonly string[]) : actual === expected;
            if (!equal) errors.push(path + ': ' + file + ' ' + column + ' differs from canonical (expected ' + JSON.stringify(expected) + ', found ' + JSON.stringify(actual) + ')');
        }
    }
    if (rows.length > entries.length) errors.push(path + ': unexpected extra registry rows');
    return errors;
}

/** Validate the TypeScript registry, the filesystem inventory and both docs projections. */
export function checkAcceptanceProducers(root: string, entries: readonly AcceptanceProducer[] = ACCEPTANCE_PRODUCERS): string[] {
    const directory = join(root, 'tools', 'acceptance');
    if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) return [];
    if (DOCS.some(path => !fs.existsSync(join(root, path)))) return [];
    const errors: string[] = [];
    const canonical = entries === ACCEPTANCE_PRODUCERS;
    if (canonical) {
        errors.push(...validateKnownExceptions(entries));
        errors.push(...validateVocabularyUsage(entries));
    }
    const files: string[] = [];
    for (const entry of entries) {
        if (files.includes(entry.file)) errors.push('acceptance producer registry: duplicate entry ' + entry.file);
        files.push(entry.file);
        errors.push(...validateEntry(entry));
    }
    const sorted = [...files].sort(compare);
    if (!sameValues(files, sorted))
        errors.push('acceptance producer registry: entries must be sorted by file name');
    const found = scanFiles(root, errors);
    if (found) {
        for (const file of found) if (!files.includes(file)) errors.push('tools/acceptance/' + file + ': unregistered acceptance producer');
        for (const file of files) if (!found.includes(file)) errors.push('tools/acceptance/' + file + ': registered acceptance producer does not exist');
    }
    const directoryPath = join(root, 'tools', 'acceptance');
    for (const entry of entries) {
        if (entry.envelope !== 'adopted') continue;
        const path = join(directoryPath, entry.file);
        if (!fs.existsSync(path)) continue;
        const source = fs.readFileSync(path, 'utf8');
        if (!/createAcceptanceEnvelope|validateAcceptanceEnvelope/u.test(source))
            errors.push(entryError(entry, 'adopted envelope requires createAcceptanceEnvelope or validateAcceptanceEnvelope'));
    }
    errors.push(...parseTable(root, DOCS[0], HEADERS[0], HEADINGS[0], entries));
    errors.push(...parseTable(root, DOCS[1], HEADERS[1], HEADINGS[1], entries));
    return errors;
}
