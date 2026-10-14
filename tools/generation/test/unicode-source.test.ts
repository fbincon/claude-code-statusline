import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as generated from '@fbincon/statusline-core/unicode/generated-unicode';
import { ROOT, unicodeOutputs } from '../resources.js';
test('tests.integration.test_unicode_generation.UnicodeGenerationTests.test_decoded_tables_match_every_pinned_reference_interval', () => {
    const tables = JSON.parse(readFileSync(join(ROOT, 'tools/unicode/data.json'), 'utf8')).tables as Record<string, number[][]>;
    const keys = ['ZERO_WIDTH', 'WIDE_EASTASIAN', 'VS16_NARROW_TO_WIDE', 'VS15_WIDE_TO_NARROW', 'CATEGORY_MC', 'EXTENDED_PICTOGRAPHIC', 'INCB_LINKER', 'INCB_CONSONANT', 'INCB_EXTEND'] as const;
    for (const name of keys)
        assert.deepEqual(generated[name](), tables[name]);
    const order = (a: number[], b: number[]) => a[0]! - b[0]! || a[1]! - b[1]!;
    assert.deepEqual(generated.VIRAMA(), [...tables.ISC_VIRAMA!, ...tables.ISC_INVISIBLE_STACKER!].sort(order));
    const properties = ['CR', 'LF', 'CONTROL', 'EXTEND', 'ZWJ', 'REGIONAL_INDICATOR', 'PREPEND', 'SPACINGMARK', 'L', 'V', 'T'];
    assert.deepEqual(generated.BREAK_PROPERTIES(), properties.flatMap((name, index) => tables['GRAPHEME_' + name]!.map(([lo, hi]) => [lo!, hi!, index + 1])).sort(order));
});
test('tests.integration.test_unicode_generation.UnicodeGenerationTests.test_crlf_checkout_produces_the_same_tables_fixtures_and_provenance', t => {
    const root = mkdtempSync(join(tmpdir(), 'ts03-crlf-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    cpSync(join(ROOT, 'tools/unicode'), join(root, 'tools/unicode'), { recursive: true });
    mkdirSync(join(root, 'tests/fixtures'), { recursive: true });
    cpSync(join(ROOT, 'tests/fixtures/graphemes.json'), join(root, 'tests/fixtures/graphemes.json'));
    for (const name of readdirSync(join(root, 'tools/unicode'))) {
        const path = join(root, 'tools/unicode', name);
        writeFileSync(path, readFileSync(path, 'utf8').replaceAll('\r\n', '\n').replaceAll('\n', '\r\n'));
    }
    assert.deepEqual(unicodeOutputs(root), unicodeOutputs(ROOT));
});
