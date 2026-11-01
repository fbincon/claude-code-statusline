import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { LANGUAGES } from '@fbincon/statusline-core/i18n/registry';
import { removeTree } from '@fbincon/statusline-platform/remove-tree';
import { sha256 } from '../../build/files.js';
import { compareLanguageSamples, comparisonPhases, makeRemovable } from '../language-comparison.js';
import { FIXTURE_CLEANUP_MS, requireHostedBudget, supervisionBudget } from '../budgets.js';
import { languageAcceptanceBudget } from '../language-budget.js';

const commit = 'a'.repeat(40), hash = 'b'.repeat(64);
type Sample = Parameters<typeof compareLanguageSamples>[0][number];
function samples(): Sample[] {
    const modes = ['baseline', 'optimized', 'optimized', 'baseline', 'baseline', 'optimized'] as const;
    const times = [600, 100, 252, 500, 700, 250];
    return modes.map((mode, i) => {
        const resources = LANGUAGES.map(language => ({ language, entries: 1, sha256: hash }));
        const pairs = LANGUAGES.flatMap(ui => LANGUAGES.map(output => ({ ui_language: ui, output_language: output,
            preview_sample: true, readonly_preview: true, reopened_ui: ui, reopened_output: output, render_sha256: hash })));
        return {
            schema_version: 1, status: 'pass', mode, promotable: false, commit, tarball_sha256: hash,
            node: process.version, platform: process.platform, arch: process.arch, target: process.env.TS05_TARGET ?? 'local',
            candidate_launches: mode === 'baseline' ? 3 + LANGUAGES.length + 6 * pairs.length : 3 + 7 * LANGUAGES.length + pairs.length,
            elapsed_ms: times[i]!, combinations: pairs.length,
            obligations_sha256: sha256(JSON.stringify(pairs.map(pair => [pair.ui_language, pair.output_language]))),
            content_sha256: sha256(JSON.stringify({ resources, pairs })), resources, pairs,
        };
    });
}

test('three interleaved pairs retain each observed run and compare medians on the same input', () => {
    const rows = samples();
    const result = compareLanguageSamples(rows, commit, hash);
    assert.deepEqual(result.baseline_ms, [600, 500, 700]);
    assert.deepEqual(result.optimized_ms, [100, 252, 250]);
    assert.equal(result.baseline_median_ms, 600); assert.equal(result.optimized_median_ms, 250);
    assert(result.faster);
    for (const sample of rows) sample.elapsed_ms = 100;
    assert.equal(compareLanguageSamples(rows, commit, hash).faster, false);
});

test('the hosted envelope fits all six legal samples, their independent cleanup and publication', () => {
    for (const windows of [true, false]) {
        const phases = comparisonPhases(windows, LANGUAGES.length);
        assert.equal(phases.filter(phase => phase.name === 'offline-install').length, 1);
        const samples = phases.filter(phase => phase.name.startsWith('round-'));
        assert.equal(samples.length, 6);
        assert(samples.every(phase => phase.budgetMs >= languageAcceptanceBudget(LANGUAGES.length) + FIXTURE_CLEANUP_MS));
        requireHostedBudget(supervisionBudget(phases), FIXTURE_CLEANUP_MS);
    }
});

test('removing write protection from a fixture never follows a directory link or junction', t => {
    const root = fs.mkdtempSync(join(tmpdir(), 'language-cleanup-'));
    const owned = join(root, 'owned'), outside = join(root, 'outside');
    t.after(() => { makeRemovable(root); removeTree(root); assert(!fs.existsSync(root)); });
    for (const directory of [owned, outside]) {
        fs.mkdirSync(directory);
        fs.writeFileSync(join(directory, 'sentinel'), 'original'); fs.chmodSync(join(directory, 'sentinel'), 0o400);
    }
    fs.symlinkSync(outside, join(owned, 'link'), process.platform === 'win32' ? 'junction' : 'dir');
    const original = fs.statSync(join(outside, 'sentinel')).mode;
    makeRemovable(owned);
    assert(fs.statSync(join(owned, 'sentinel')).mode & 0o200);
    assert.equal(fs.statSync(join(outside, 'sentinel')).mode, original);
});

test('a failed supervised comparison retains its phase diagnostic and publishes no comparison', t => {
    const root = fs.mkdtempSync(join(tmpdir(), 'language-bad-input-'));
    t.after(() => { removeTree(root); assert(!fs.existsSync(root)); });
    const artifact = join(root, 'input.tgz'), output = join(root, 'result');
    fs.writeFileSync(artifact, 'wrong bytes');
    fs.writeFileSync(join(root, 'SHA256SUMS'), hash + '  input.tgz\n');
    const cli = fileURLToPath(new URL('../language-comparison.js', import.meta.url));
    const run = spawnSync(process.execPath, [cli, '--artifact', artifact, '--commit', commit, '--sha256', hash, '--output', output],
        { encoding: 'utf8', timeout: 120_000 });
    assert.ifError(run.error); assert.equal(run.status, 1, run.stderr);
    const phases = JSON.parse(fs.readFileSync(join(output, 'comparison.phases.json'), 'utf8'));
    assert.equal(phases.status, 'fail'); assert.equal(phases.promotable, false);
    assert(!fs.existsSync(join(output, 'comparison.json')));
});

test('diagnostics reject incomplete pairs, semantic drift, incorrect launch counts or identity', () => {
    const mutations: ((rows: Sample[]) => void)[] = [
        rows => { rows.pop(); },
        rows => { rows[1]!.pairs[2] = { ...rows[1]!.pairs[0]! }; },
        rows => { rows[1]!.pairs[0]!.reopened_ui = 'wrong'; },
        rows => {
            const sample = rows[1]!;
            sample.pairs[0]!.render_sha256 = 'c'.repeat(64);
            sample.content_sha256 = sha256(JSON.stringify({ resources: sample.resources, pairs: sample.pairs }));
        },
        rows => { rows[1]!.obligations_sha256 = 'c'.repeat(64); },
        rows => { rows[1]!.content_sha256 = 'c'.repeat(64); },
        rows => { rows[1]!.tarball_sha256 = 'c'.repeat(64); },
        rows => { rows[1]!.node = 'v0.0.0'; },
        rows => { rows[1]!.promotable = true; },
        rows => { rows[0]!.candidate_launches--; },
        rows => { rows[1]!.candidate_launches++; },
        rows => { rows.reverse(); },
    ];
    for (const mutate of mutations) {
        const rows = samples(); mutate(rows); assert.throws(() => compareLanguageSamples(rows, commit, hash));
    }
});
