import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import {
    ACCEPTANCE_PRODUCERS, checkAcceptanceProducers, validateKnownExceptions,
    type AcceptanceProducer, type Role, type ValidationPath, type EnvelopeStatus,
} from '../acceptance-producers.js';

const EN_HEADER = '| File | Role | Primary outputs | Promotable | Evidence class | Envelope | Validation | Notes |';
const ZH_HEADER = '| 文件 | 角色 | 主要输出 | 可晋升 | 证据类别 | Envelope | 校验 | 说明 |';
const SEPARATOR = '| --- | --- | --- | --- | --- | --- | --- | --- |';
const ANCHOR = '<a id="acceptance-receipt-producers"></a>';
const START = '<!-- acceptance-producers:start -->';
const END = '<!-- acceptance-producers:end -->';

type Row = AcceptanceProducer & { notes?: string };

function table(rows: readonly Row[], language: 'en' | 'zh'): string {
    const outputs = (row: Row) => row.outputs.length ? row.outputs.map(value => '`' + value + '`').join(' · ') : 'none';
    return [
        ANCHOR,
        '',
        language === 'en' ? '## Acceptance receipt producers' : '## 验收回执生产者',
        '',
        START,
        language === 'en' ? EN_HEADER : ZH_HEADER,
        SEPARATOR,
        ...rows.map(row => `| \`${row.file}\` | \`${row.role}\` | ${outputs(row)} | ${row.promotable ? 'yes' : 'no'} | \`${row.evidence}\` | \`${row.envelope}\` | \`${row.validation}\` | ${row.notes ?? 'Fixture.'} |`),
        END,
        '',
    ].join('\n');
}

function write(root: string, name: string, body: string): void {
    const path = join(root, name);
    fs.mkdirSync(dirname(path), { recursive: true });
    fs.writeFileSync(path, body);
}

interface Options {
    body?: string;
    files?: readonly string[];
    directories?: readonly string[];
    extraFiles?: readonly string[];
    en?: string;
    zh?: string;
}

function run(rows: readonly AcceptanceProducer[], options: Options = {}): string[] {
    const root = fs.mkdtempSync(join(tmpdir(), 'acceptance producers '));
    try {
        const body = options.body ?? 'export const createAcceptanceEnvelope = () => {};\n';
        for (const file of options.files ?? rows.map(row => row.file)) write(root, 'tools/acceptance/' + file, body);
        for (const directory of options.directories ?? []) fs.mkdirSync(join(root, 'tools/acceptance', directory), { recursive: true });
        for (const file of options.extraFiles ?? []) write(root, 'tools/acceptance/' + file, body);
        write(root, 'docs/development/testing.md', options.en ?? table(rows, 'en'));
        write(root, 'docs/development/testing.zh-CN.md', options.zh ?? table(rows, 'zh'));
        return checkAcceptanceProducers(root, rows);
    } finally {
        fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
}

const producer: AcceptanceProducer = { file: 'alpha.ts', role: 'producer', outputs: ['alpha.json'], promotable: true, evidence: 'complete-acceptance', envelope: 'planned', validation: 'ci' };
const helper: AcceptanceProducer = { file: 'beta.ts', role: 'helper', outputs: [], promotable: false, evidence: 'none', envelope: 'not-applicable', validation: 'none' };
const adopted: AcceptanceProducer = { file: 'gamma.ts', role: 'producer', outputs: ['gamma.json'], promotable: false, evidence: 'demonstration', envelope: 'adopted', validation: 'manual' };
const valid = [producer, helper, adopted] as const;

test('acceptance producer registry accepts consistent entries and ignores non-top-level modules', () => {
    assert.deepEqual(run(valid), []);
    assert.deepEqual(run(valid, { extraFiles: ['test/ignored.test.ts', 'node_modules/pkg/ignored.ts'] }), []);
    assert.deepEqual(run(valid, { en: table(valid, 'en').replaceAll('\n', '\r\n') }), []);
    const promoted: AcceptanceProducer = { file: 'delta.ts', role: 'producer', outputs: ['delta.json'], promotable: true, evidence: 'complete-acceptance', envelope: 'adopted', validation: 'ci' };
    assert.deepEqual(run([promoted]), []);
    const promotedOfficial: AcceptanceProducer = { file: 'delta.ts', role: 'producer', outputs: ['delta.json'], promotable: true, evidence: 'official-host', envelope: 'adopted', validation: 'official-host' };
    assert.deepEqual(run([promotedOfficial]), []);
    const promotedSmoke: AcceptanceProducer = { file: 'epsilon.ts', role: 'producer', outputs: ['epsilon.json'], promotable: true, evidence: 'additional-smoke', envelope: 'adopted', validation: 'ci' };
    assert.deepEqual(run([promotedSmoke]), []);
});

test('acceptance producer registry rejects filesystem drift', () => {
    assert.match(run(valid, { files: ['alpha.ts', 'beta.ts'] }).join('\n'), /gamma\.ts: registered acceptance producer does not exist/u);
    assert.match(run(valid, { extraFiles: ['extra.ts'] }).join('\n'), /extra\.ts: unregistered acceptance producer/u);
    assert.match(run(valid, { directories: ['x.ts'] }).join('\n'), /x\.ts: \.ts entry must be a regular file/u);
    assert.match(run([producer, helper, producer]).join('\n'), /duplicate entry alpha\.ts/u);
    assert.match(run([helper, producer]).join('\n'), /entries must be sorted by file name/u);
    assert.match(run(valid, { en: table([helper, producer], 'en') }).join('\n'), /beta\.ts file differs from canonical/u);
});

test('acceptance producer registry rejects invalid entry combinations', () => {
    const cases: [string, AcceptanceProducer, RegExp][] = [
        ['unknown role', { ...producer, role: 'other' as Role }, /unknown role/u],
        ['empty producer outputs', { ...producer, outputs: [] }, /require outputs/u],
        ['producer validation none', { ...producer, validation: 'none' as ValidationPath }, /require a validation path/u],
        ['non-boolean promotable', { ...producer, promotable: 'yes' as unknown as boolean }, /promotable must be boolean/u],
        ['bad output token', { ...producer, outputs: ['Bad Token'] }, /invalid output token/u],
        ['duplicate outputs', { ...producer, outputs: ['alpha.json', 'alpha.json'] }, /outputs must be unique/u],
        ['planned not promotable', { ...producer, promotable: false }, /planned envelope must be promotable|complete-acceptance evidence must be promotable/u],
        ['adopted non-demo', { ...producer, envelope: 'adopted', promotable: false, evidence: 'manual' }, /adopted envelope requires|manual evidence must not be promotable/u],
        ['embedded on helper', { ...helper, envelope: 'embedded-via-parent' }, /helper, wrapper and driver entries must use envelope not-applicable|embedded-via-parent requires role producer/u],
        ['blocked additional-smoke', { ...producer, evidence: 'additional-smoke', envelope: 'blocked-reader-first' }, /additional-smoke evidence must use envelope adopted or planned|blocked-reader-first requires complete-acceptance/u],
        ['diagnostic-opt-out on producer', { ...producer, envelope: 'diagnostic-opt-out' }, /diagnostic-opt-out requires role diagnostic/u],
        ['manual-opt-out on diagnostic', { ...producer, role: 'diagnostic', evidence: 'diagnostic', envelope: 'manual-opt-out' }, /diagnostic entries must use envelope diagnostic-opt-out|manual-opt-out requires manual, paid or physical/u],
        ['not-applicable promotable', { ...producer, envelope: 'not-applicable' }, /not-applicable envelope must not be promotable/u],
        ['legacy promotable', { ...producer, evidence: 'legacy' }, /legacy evidence must not be promotable|legacy evidence must use envelope not-applicable/u],
        ['diagnostic role wrong evidence', { ...producer, role: 'diagnostic' }, /diagnostic entries must use evidence diagnostic/u],
        ['helper with output', { ...helper, outputs: ['beta.json'] }, /helper, wrapper and driver entries must not declare outputs/u],
        ['helper validation', { ...helper, validation: 'ci' as ValidationPath }, /helper, wrapper and driver entries must use validation none/u],
    ];
    for (const [name, entry, expected] of cases) assert.match(run([entry]).join('\n'), expected, name);
    assert.match(run([adopted], { body: 'export {};\n' }).join('\n'), /adopted envelope requires createAcceptanceEnvelope or validateAcceptanceEnvelope/u);
});

test('acceptance producer registry rejects documentation drift', () => {
    const en = table(valid, 'en');
    const zh = table(valid, 'zh');
    assert.match(run(valid, { en: en.replace(ANCHOR, '<!-- no anchor -->') }).join('\n'), /expected exactly one acceptance producer registry anchor, found 0/u);
    assert.match(run(valid, { en: en.replace(START, '') }).join('\n'), /expected exactly one acceptance producer start marker/u);
    assert.match(run(valid, { en: en.replace(END, '') }).join('\n'), /expected exactly one acceptance producer end marker/u);
    assert.match(run(valid, { en: en.replace(START, START + '\n' + START) }).join('\n'), /expected exactly one acceptance producer start marker/u);
    const swapped = en.split('\n');
    const start = swapped.indexOf(START), end = swapped.indexOf(END);
    [swapped[start], swapped[end]] = [swapped[end]!, swapped[start]!];
    assert.match(run(valid, { en: swapped.join('\n') }).join('\n'), /end marker precedes the start marker/u);
    assert.match(run(valid, { en: en.replace(EN_HEADER, EN_HEADER.replace('Role', 'Kind')) }).join('\n'), /header does not match the template/u);
    assert.match(run(valid, { en: en.replace(SEPARATOR, SEPARATOR.replace('---', '--')) }).join('\n'), /separator is malformed/u);
    assert.match(run(valid, { en: en.replace(SEPARATOR, '| --- | --- | --- | --- | --- | --- | --- |') }).join('\n'), /separator is malformed/u);
    assert.match(run(valid, { en: en.replace(ANCHOR, ANCHOR + '\n' + ANCHOR) }).join('\n'), /expected exactly one acceptance producer registry anchor, found 2/u);
    assert.match(run(valid, { en: en.replace('## Acceptance receipt producers', '## Other section') }).join('\n'), /anchor must be followed by ## Acceptance receipt producers/u);
    const moved = en.replace(ANCHOR + '\n\n', '').replace(END, END + '\n' + ANCHOR);
    assert.match(run(valid, { en: moved }).join('\n'), /anchor must precede the table/u);
    assert.match(run(valid, { en: table([...valid, { ...producer, file: 'extra.ts' }], 'en') }).join('\n'), /has 4 rows, expected 3/u);
    assert.match(run(valid, { en: table([producer, producer, helper], 'en') }).join('\n'), /duplicate registry row alpha\.ts/u);
    const short = [ANCHOR, '', '## Acceptance receipt producers', '', START, END].join('\n');
    assert.match(run(valid, { en: short }).join('\n'), /missing header, separator or rows/u);
    assert.match(run(valid, { en: en.replace(' | Fixture. |', ' |') }).join('\n'), /must have exactly 8 columns/u);
    assert.match(run(valid, { en: en.replace('| `alpha.ts` |', '| alpha.ts |') }).join('\n'), /invalid File cell/u);
    assert.match(run(valid, { en: en.replace(' | Fixture. |', ' |  |') }).join('\n'), /invalid machine or Notes cell/u);
    assert.match(run(valid, { en: en.replace(' | Fixture. |', ' | Fixture | extra |') }).join('\n'), /must have exactly 8 columns/u);
    assert.match(run(valid, { zh: zh.replace('`complete-acceptance`', '`official-host`') }).join('\n'), /evidence differs from canonical/u);
    assert.match(run(valid, { zh: table([producer, helper], 'zh') }).join('\n'), /has 2 rows, expected 3/u);
    assert.match(run(valid, { en: table([helper, producer], 'en') }).join('\n'), /beta\.ts file differs from canonical/u);
});

test('acceptance producer registry locks known exceptions', () => {
    assert.deepEqual(validateKnownExceptions(ACCEPTANCE_PRODUCERS), []);
    const mutated = ACCEPTANCE_PRODUCERS.map(entry => entry.file === 'physical.ts'
        ? { ...entry, envelope: 'planned' as EnvelopeStatus }
        : entry);
    assert.match(validateKnownExceptions(mutated).join('\n'), /physical\.ts must remain/u);
    const missing = ACCEPTANCE_PRODUCERS.filter(entry => entry.file !== 'integration-smoke.ts');
    assert.match(validateKnownExceptions(missing).join('\n'), /missing fixed entry integration-smoke\.ts/u);
    const extra = [...ACCEPTANCE_PRODUCERS, { file: 'new-producer.ts', role: 'producer', outputs: ['new.json'], promotable: true, evidence: 'complete-acceptance', envelope: 'planned', validation: 'ci' } satisfies AcceptanceProducer];
    assert.match(validateKnownExceptions(extra).join('\n'), /new-producer\.ts must not use planned/u);
    const blocked = [...ACCEPTANCE_PRODUCERS, { file: 'new-producer.ts', role: 'producer', outputs: ['new.json'], promotable: true, evidence: 'complete-acceptance', envelope: 'blocked-reader-first', validation: 'ci' } satisfies AcceptanceProducer];
    assert.match(validateKnownExceptions(blocked).join('\n'), /new-producer\.ts must not use blocked-reader-first/u);
});

test('repository acceptance producer registry is complete and synchronized', () => {
    assert.deepEqual(checkAcceptanceProducers(process.cwd()), []);
    assert.deepEqual(validateKnownExceptions(ACCEPTANCE_PRODUCERS), []);
    assert.equal(ACCEPTANCE_PRODUCERS.length, 60);
    for (const path of ['docs/development/testing.md', 'docs/development/testing.zh-CN.md'])
        assert.ok(fs.readFileSync(join(process.cwd(), path), 'utf8').includes(ANCHOR));
});
