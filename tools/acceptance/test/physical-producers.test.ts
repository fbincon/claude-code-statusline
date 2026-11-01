import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { ACTIONS_PREPARATION_MS, ACTIONS_UPLOAD_MS, HANDOFF_MS, HOSTED_JOB_MS, requireHostedBudget, supervisionBudget } from '../budgets.js';
import { APPEARANCE_CASE, HISTORY_CASE, LANGUAGE_CASE, installedPhases, physicalSelection, type InstalledStage } from '../installed-plan.js';
import { admitOfficialCommand, officialPhases, physicalJobBudget, requiresStability, sourcePhases, STABILITY_PHASE } from '../physical-budgets.js';
import { observedNpm } from '../physical.js';
import { installedHarnessEnvironment } from '../physical-sections.js';

test('the installed harness and its source children inherit the Python and compiler guard', () => {
    const child = `const {execFileSync}=require('node:child_process'),assert=require('node:assert/strict');
        for(const tool of ['python','gcc']) assert.throws(()=>execFileSync('/missing-fixture/'+tool), /Python-free validation rejected/);`;
    const parent = `require('node:child_process').execFileSync(process.execPath,['-e',process.argv[1]],{stdio:'inherit'});`;
    const result = spawnSync(process.execPath, ['-e', parent, child], {
        env: installedHarnessEnvironment(process.env), encoding: 'utf8', timeout: 10_000,
    });
    assert.ifError(result.error); assert.equal(result.status, 0, result.stderr);
});

test('physical stages partition all 28 installed cases and preserve the shared relocated fixture order', () => {
    const cases = (stage: InstalledStage) => installedPhases(false, 12, undefined, { stage, depth: 'full' })
        .slice(2, -1).map(p => p.name).flatMap(name => name === 'appearance/setup' ? [APPEARANCE_CASE] : name.startsWith('appearance/') ? [] : [name]);
    const all = cases('complete'), installed = cases('installed');
    assert.equal(all.length, 28); assert.equal(new Set(all).size, 28);
    assert.deepEqual(cases('language'), [LANGUAGE_CASE]); assert.deepEqual(cases('history'), [HISTORY_CASE]);
    assert.deepEqual(installed, all.filter(name => name !== LANGUAGE_CASE && name !== HISTORY_CASE));
    const positions = ['after_relocation', 'both_shells', 'native-editor protocol', 'external editor saves', 'recovery restores', 'source operations']
        .map(key => installed.findIndex(name => name.includes(key)));
    assert(positions.every((index, i) => index >= 0 && (!i || index > positions[i - 1]!)));
    assert.throws(() => physicalSelection({ TS05_PHYSICAL_STAGE: 'language', TS05_PHYSICAL_DEPTH: 'short', TS05_DIAGNOSTIC_PATTERN: 'installed' }));
    assert.throws(() => physicalSelection({ TS05_PHYSICAL_STAGE: 'all' }));
});

test('each physical budget preserves its admitted command, history and stability on a hosted runner', () => {
    for (const windows of [true, false]) for (const depth of ['full', 'short'] as const) {
        for (const stage of ['complete', 'installed', 'language', 'history'] as const)
            requireHostedBudget(supervisionBudget(installedPhases(windows, 12, undefined, { stage, depth })),
                stage === 'complete' || stage === 'installed' ? supervisionBudget(sourcePhases(true)) : 0);
        for (const stable of [true, false]) {
            const { official, history } = officialPhases(windows, depth, stable);
            assert.equal(supervisionBudget([official]) + supervisionBudget(history) + (stable ? supervisionBudget([STABILITY_PHASE]) : 0) +
                ACTIONS_PREPARATION_MS + ACTIONS_UPLOAD_MS, HOSTED_JOB_MS);
            assert(official.budgetMs >= 600_000);
            admitOfficialCommand(0, official.budgetMs, 300_000, official.budgetMs - 300_000 - HANDOFF_MS);
            assert.throws(() => admitOfficialCommand(0, official.budgetMs, 300_000, official.budgetMs - 300_000 - HANDOFF_MS + 1));
        }
    }
    assert(requiresStability('windows-2025', '2.1.294')); assert(!requiresStability('ubuntu-24.04', '2.1.294'));
});

test('matrix preflight rejects growth before dispatch and preserves independent shard and runtime allowances', () => {
    const base = { os: 'windows-11-arm', job_key: 'installed', host: null, depth: 'full', stage: 'complete' } as const;
    const expected = supervisionBudget(installedPhases(true, 12, undefined, base)) + supervisionBudget(sourcePhases(true)) +
        ACTIONS_PREPARATION_MS + ACTIONS_UPLOAD_MS;
    assert.equal(physicalJobBudget(base, 12), expected);
    assert(physicalJobBudget({ ...base, job_key: 'runtime' }, 12) < expected);
    assert.throws(() => physicalJobBudget(base, 100), /partition/);
    assert.throws(() => physicalJobBudget({ ...base, stage: 'language' }, 100), /partition/);
    assert.equal(physicalJobBudget({ ...base, stage: 'history' }, 100), physicalJobBudget({ ...base, stage: 'history' }, 12));
    assert.equal(physicalJobBudget({ ...base, os: 'windows-2025', host: '2.1.294', job_key: 'mods' }, 12), HOSTED_JOB_MS);
});

test('npm identity binds the implementation invoked by the observed npm entry', t => {
    const root = fs.mkdtempSync(join(tmpdir(), 'physical-npm-')), entry = join(root, 'bin/npm-cli.js'), original = process.env.npm_execpath;
    t.after(() => {
        if (original === undefined) delete process.env.npm_execpath; else process.env.npm_execpath = original;
        fs.rmSync(root, { recursive: true, force: true });
    });
    fs.mkdirSync(join(root, 'bin')); fs.writeFileSync(join(root, 'package.json'), '{"name":"npm","version":"1.2.3"}');
    fs.writeFileSync(entry, "console.log(require('../version.cjs'))\n");
    fs.writeFileSync(join(root, 'version.cjs'), "module.exports='1.2.3'\n"); process.env.npm_execpath = entry;
    const before = observedNpm(); fs.appendFileSync(join(root, 'version.cjs'), '// different implementation\n');
    const after = observedNpm(); assert.equal(before.npm, '1.2.3'); assert.equal(after.npm, before.npm); assert.notEqual(after.npm_sha256, before.npm_sha256);
});
