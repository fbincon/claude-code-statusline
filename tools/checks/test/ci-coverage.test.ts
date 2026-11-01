import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { removeTree } from '@fbincon/statusline-platform/remove-tree';
import { baselineObligations, COVERAGE_ACTIVATION, COVERAGE_ACTIVATION_PATH, coverageVersionAt, coverageVersionInArchive,
    createCoveragePlan, historyCounts, verifyCoveragePlan } from '../ci-coverage.js';
import { runtimeInputs } from '../runtime-inputs.js';

const inputs = (devShared = false) => runtimeInputs([{ version: 'v22.23.4' }, { version: devShared ? 'v24.21.0' : 'v24.22.2' }], '24.21.0');
function repository(t: test.TestContext) {
    const previous = process.cwd(), root = fs.mkdtempSync(join(tmpdir(), 'coverage-policy-'));
    t.after(() => { process.chdir(previous); removeTree(root); assert(!fs.existsSync(root)); });
    process.chdir(root);
    const git = (...args: string[]) => execFileSync('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
        '-c', 'commit.gpgsign=false', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    const write = (path: string, content: string) => { fs.mkdirSync(dirname(path), { recursive: true }); fs.writeFileSync(path, content); };
    const save = (message: string) => { git('add', '--all'); git('commit', '-qm', message); return git('rev-parse', 'HEAD'); };
    git('init', '-q', '--initial-branch=main');
    write('.node-version', '24.21.0\n'); write('packages/cli/src/management/history.ts', 'history v1');
    for (const name of ['ci-coverage', 'impact-lock', 'runtime-inputs']) write('tools/checks/' + name + '.ts', '// Frozen ' + name + '\n');
    const legacy = save('Legacy source');
    write(COVERAGE_ACTIVATION_PATH, COVERAGE_ACTIVATION); const activated = save('Activate v2');
    return { root, git, write, save, legacy, activated };
}

test('baseline and shared executions have distinct logical and physical history responsibilities', t => {
    const r = repository(t); r.write('packages/core/src/rendering/layout.ts', 'render'); const head = r.save('Unrelated product work');
    const p = createCoveragePlan(r.activated, head, inputs());
    assert.deepEqual(historyCounts(p.obligations), { installed: { full: 1, short: 7 }, runtime: { full: 13, short: 19 }, host: { full: 8, short: 8 } });
    assert.deepEqual(p.obligations, baselineObligations(inputs()));
    assert.equal(p.producers.length, 66); assert.equal(new Set(p.producers.map(s => s.job)).size, 66); assert.equal(new Set(p.producers.map(s => s.receipt)).size, 66);
    for (const row of p.obligations) {
        const fragments = p.producers.filter(spec => spec.obligations.includes(row.id));
        assert.deepEqual(fragments.map(s => s.stage), row.os === 'windows-11-arm' ? ['installed', 'language', 'history'] : ['complete']);
        assert(fragments.every(s => s.id === s.artifact && s.receipt === s.artifact + '/fragment.json'));
    }
    const shared = createCoveragePlan(r.activated, head, inputs(true));
    const target = 'windows-11-arm-x64', selectors = [target, target + '@24.x'];
    assert.equal(shared.producers.length, 56);
    assert.equal(shared.obligations.find(o => o.id === target)?.depth, 'short');
    const owners = shared.producers.filter(s => s.obligations.includes(target + '@24.x'));
    assert.deepEqual(owners.map(s => s.stage), ['installed', 'language', 'history']);
    for (const spec of owners) { assert.equal(spec.job_key, 'installed'); assert.deepEqual(spec.obligations, selectors); assert.equal(spec.depth, 'full'); }
    assert.deepEqual(verifyCoveragePlan(shared, r.activated, head, inputs(true)), shared);
});

test('PR depth uses the unique actual merge base, sees both rename endpoints and rejects reporter-selected reductions', t => {
    const r = repository(t); r.git('switch', '-qc', 'topic');
    r.write('docs/history.md', 'history v1'); fs.unlinkSync('packages/cli/src/management/history.ts');
    const head = r.save('Move managed history outside execution');
    r.git('switch', '-q', 'main'); r.write('docs/new-base.md', 'base'); const base = r.save('Base advanced');
    const p = createCoveragePlan(base, head, inputs()); assert.equal(p.comparison_base, r.activated); assert.equal(p.base, base);
    assert.deepEqual(p.changed_paths, ['docs/history.md', 'packages/cli/src/management/history.ts']);
    assert(p.obligations.every(row => row.depth === 'full'));
    assert.throws(() => createCoveragePlan(base, head, inputs(), 'accepted-main'), /not an ancestor/u);
    assert.throws(() => createCoveragePlan('main', head, inputs()), /immutable/u);
    const forged = structuredClone(p); forged.obligations[0]!.depth = 'short'; forged.producers.pop();
    assert.throws(() => verifyCoveragePlan(forged, base, head, inputs()), /Coverage plan differs/u);
    assert.throws(() => verifyCoveragePlan({ ...p, tree: r.activated }, base, head, inputs()), /Coverage plan differs/u);
    const safe = createCoveragePlan(null, head, inputs()); assert.equal(safe.basis, 'conservative'); assert(safe.producers.every(row => row.depth === 'full'));
    assert.throws(() => createCoveragePlan(null, head, inputs(), 'accepted-main'));
});

test('platform and host changes union their affected lanes; only changes to the locked product dependency closure expand history', t => {
    const r = repository(t);
    const lock = { lockfileVersion: 3, packages: Object.fromEntries(['core', 'platform', 'cli', 'tui'].map(name => ['packages/' + name, {}])) as Record<string, unknown> };
    r.write('package.json', '{"private":true,"scripts":{}}'); r.write('package-lock.json', JSON.stringify(lock)); const base = r.save('Lock workspace inputs');
    r.write('packages/platform/src/windows-command.ts', 'literal windows argv'); r.write('mods/statusline-runtime/hooks/hooks.json', '{}');
    lock.packages['node_modules/dev-only'] = { version: '1.0.0' }; r.write('package-lock.json', JSON.stringify(lock));
    r.write('package.json', '{"private":true,"scripts":{"ci:diagnostic":"node check.js"}}');
    const mixed = r.save('Windows and Runtime host changes');
    const p = createCoveragePlan(base, mixed, inputs(), 'accepted-main');
    assert(p.obligations.filter(row => row.os.startsWith('windows-')).every(row => row.depth === 'full'));
    assert(p.obligations.filter(row => row.host === '2.1.296').every(row => row.depth === 'full'));
    assert(p.obligations.some(row => row.id === 'darwin-2.1.288' && row.depth === 'short'));
    assert(p.obligations.some(row => row.id === 'macos-15-intel-x64' && row.depth === 'short'));
    assert(!p.escalations.some(rule => ['package-lock.json', 'package.json'].includes(rule.path)));
    lock.packages['packages/cli'] = { dependencies: { 'dev-only': '1.0.0' } };
    r.write('package-lock.json', JSON.stringify(lock)); const changed = r.save('Move dependency into product closure');
    assert(createCoveragePlan(mixed, changed, inputs()).obligations.every(row => row.depth === 'full'));
});

test('source activation is immutable across deletion, restoration, tampered archive data and shallow history', t => {
    const r = repository(t);
    assert.equal(coverageVersionAt(r.legacy), 1); assert.equal(coverageVersionAt(r.activated), 2);
    assert.equal(coverageVersionInArchive(new Map()), 1);
    assert.equal(coverageVersionInArchive(new Map([[COVERAGE_ACTIVATION_PATH, Buffer.from(COVERAGE_ACTIVATION)]])), 2);
    assert.throws(() => coverageVersionInArchive(new Map([[COVERAGE_ACTIVATION_PATH, Buffer.from('{}')]])));
    fs.unlinkSync(COVERAGE_ACTIVATION_PATH); const erased = r.save('Remove marker');
    assert.throws(() => coverageVersionAt(erased), /removed or altered/u);
    r.write(COVERAGE_ACTIVATION_PATH, COVERAGE_ACTIVATION); const restored = r.save('Restore marker');
    assert.throws(() => coverageVersionAt(restored), /removed or altered/u);
    r.git('branch', 'erased', erased);
    const shallow = join(r.root, 'shallow'); r.git('clone', '-q', '--depth=1', '--branch', 'erased', pathToFileURL(r.root).href, shallow);
    process.chdir(shallow); assert.throws(() => coverageVersionAt(erased), /shallow/u);
});

test('unfrozen, incorrect development or contradictory derived Node inputs cannot select acceptance', t => {
    const r = repository(t);
    assert.throws(() => createCoveragePlan(null, r.legacy, inputs()), /not activated/u);
    const broken = inputs(); broken.shared.push('24.x'); assert.throws(() => baselineObligations(broken));
    const matrix = inputs(); matrix.matrix.include.pop(); assert.throws(() => baselineObligations(matrix), /Frozen runtime/u);
    const dev = runtimeInputs([{ version: 'v22.23.4' }, { version: 'v24.22.2' }], '24.20.0');
    assert.throws(() => createCoveragePlan(null, r.activated, dev), /Development Node/u);
    const floor = inputs(); floor.versions['22.0.0'] = '22.1.0'; assert.throws(() => baselineObligations(floor));
});

test('unknown paths and empty change sets cannot reduce history coverage', t => {
    const r = repository(t);
    r.git('commit', '--allow-empty', '-qm', 'Empty change'); const empty = r.git('rev-parse', 'HEAD');
    assert.throws(() => createCoveragePlan(r.activated, empty, inputs()), /Empty or invalid/u);
    r.write('unregistered-scheduler.bin', 'unregistered'); const unknown = r.save('Unknown responsibility');
    assert.throws(() => createCoveragePlan(empty, unknown, inputs()), /Unclassified history coverage path/u);
});
