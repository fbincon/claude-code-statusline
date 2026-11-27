import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { removeTree } from '@fbincon/statusline-platform/remove-tree';
import { createImpactPlan, tasksFor, assertPlan, impactPolicy, scheduleMaintenance } from '../impact-plan.js';
import { DOCUMENT_CONTENT_PATHS } from '../impact-documentation.js';
import { emitted, productInputs, runtimeLock, canonical, hash, tree } from '../impact-content.js';
import { checkAssets, pngDimensions } from '../impact-assets.js';
import { validateScopedReceipt, maintenanceSourceKind } from '../impact-evidence.js';
import { assessImpactNeeds, selectImpact } from '../impact-workflow.js';
import { runScopedTestFiles, scopedTests } from '../impact-runner.js';
import { runScopedModTests } from '../impact-mod-batches.js';
import { checkScopedSchedule, familyAdmissionMs, familyEnvelopeMs, scopedModFiles, scopedSourceFiles, scopedTaskBudget } from '../impact-budget.js';
import { OFFICIAL_TEST_TIMEOUT_MS } from '../../acceptance/official-tests.js';
import { partitionScopedTasks } from '../impact-schedule.js';
import { productResponsibilities, runProductChecks, supplementPlan, validateProductChecks, type ProductCheckReceipt } from '../impact-product.js';

function repository(t: any) {
    const root = fs.mkdtempSync(join(tmpdir(), 'impact-test-')), previous = process.cwd();
    const git = (...args: string[]) => execFileSync('git', ['-C', root, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const write = (path: string, value: string) => { fs.mkdirSync(join(root, path, '..'), { recursive: true }); fs.writeFileSync(join(root, path), value); };
    git('init', '--initial-branch=main');
    write('tools/checks/impact-plan.ts', '// Trusted protocol fixture\n'); write('.node-version', '24.21.0\n');
    write('package-lock.json', JSON.stringify({ lockfileVersion: 3, packages: Object.fromEntries(['core', 'platform', 'cli', 'tui'].map(name => ['packages/' + name, { name, version: '0.0.0' }])) }));
    git('add', '.'); git('commit', '-m', 'baseline'); process.chdir(root);
    const commit = () => { git('add', '-A'); git('commit', '-m', 'change'); return git('rev-parse', 'HEAD'); };
    t.after(() => { process.chdir(previous); removeTree(root); assert(!fs.existsSync(root)); });
    return { root, git, write, commit };
}
test('source-backed documentation selects its consuming checks on additions, deletions and renames', t => {
    const { git, write, commit } = repository(t);
    write('tools/checks/impact-documentation.ts', '// Source-backed documentation suite registration\n'); commit();
    for (const path of DOCUMENT_CONTENT_PATHS) {
        const base = git('rev-parse', 'HEAD'); write(path, '# Current guide');
        const plan = createImpactPlan(base, commit());
        assert.equal(plan.route, 'maintenance'); assert.deepEqual(plan.checks, ['actions', 'checks', 'docs']);
        // The accepted first parent's verifier compares per-file reasons exactly.
        // The introduction PR already selects checks through its tool changes;
        // preserve its existing documentation reason for independent promotion.
        assert.deepEqual(plan.changes, [{ path, category: 'documentation', reason: 'Maintained documentation or community template' }]);
        assert.deepEqual(plan.tasks.map(task => [task.id, task.checks]), [
            ['linux', ['actions', 'checks', 'docs']], ['windows', ['checks']], ['macos', ['checks']],
        ]);
    }
    let base = git('rev-parse', 'HEAD');
    git('mv', 'docs/EXTENSIONS.md', 'docs/moved.md');
    assert.deepEqual(createImpactPlan(base, commit()).checks, ['actions', 'checks', 'docs']);
    base = git('rev-parse', 'HEAD'); git('rm', 'docs/EXTENSIONS.zh-CN.md');
    assert.deepEqual(createImpactPlan(base, commit()).checks, ['actions', 'checks', 'docs']);
    base = git('rev-parse', 'HEAD'); write('docs/development/history/unrelated.md', '# Historical record');
    assert.deepEqual(createImpactPlan(base, commit()).checks, ['actions', 'docs']);
    base = git('rev-parse', 'HEAD'); write('tools/checks/impact-documentation.ts', 'export const DOCUMENT_CONTENT_PATHS = [];');
    const head = commit(); assert.notEqual(impactPolicy(base), impactPolicy(head), 'Consumed page registration is a policy input');
});
test('a product and screenshot change must execute assets on the actual immutable bytes', t => {
    const png = fs.readFileSync('docs/images/draft-history-reuse/native-draft-history.png');
    const another = fs.readFileSync('docs/images/typescript/v3.16.0/native/fr/settings.png');
    const {git, write, commit} = repository(t), base = git('rev-parse','HEAD');
    write('packages/core/src/render.ts','export const sample = 1;\n');
    const folder = 'docs/images/example', image = folder + '/sample.png', manifest = 'docs/images/capture.json';
    const capture = (sha: string) => JSON.stringify({captures:[{file:'example/sample.png',png_sha256:sha}]});
    write(manifest,capture(hash(png))); fs.mkdirSync(folder); fs.writeFileSync(image,png);
    const source = (head: string) => ({source_commit:head,tree:git('rev-parse',head + '^{tree}'),event:'pull_request',
        pr:{base,head,base_ref:'main',number:190,draft:false},run_id:44,attempt:1});
    const good = source(commit()), impact = createImpactPlan(base,good.source_commit);
    assert.equal(impact.route,'product'); assert.deepEqual(productResponsibilities(impact.checks),{covered:['actions','docs'],additional:['assets']});
    const plan = supplementPlan(good); assert.deepEqual(plan.checks,['assets']);
    const inputs_sha256 = runProductChecks(good.source_commit,plan);
    const receipt: ProductCheckReceipt = {schema_version:1,kind:'supplemental-product-checks',status:'pass',commit:good.source_commit,tree:good.tree,
        plan,inputs_sha256,run_id:44,attempt:1,job:'Complete candidate evidence',job_id:13,started_at:new Date().toISOString(),completed_at:new Date().toISOString()};
    validateProductChecks({...good,product_checks:receipt});
    assert.throws(() => validateProductChecks(good),/Missing original supplemental/);
    assert.throws(() => validateProductChecks({...good,product_checks:{...receipt,plan:{...plan,checks:[]}}}),/omitted/);
    assert.throws(() => validateProductChecks({...good,product_checks:{...receipt,attempt:2}}));
    write(manifest,capture('f'.repeat(64))); const wrongHash = source(commit());
    assert.throws(() => runProductChecks(wrongHash.source_commit,supplementPlan(wrongHash)),/Capture digest/);
    write(manifest,capture(hash(png))); write(folder + '/new.png','broken PNG'); const corrupt = source(commit());
    assert.throws(() => runProductChecks(corrupt.source_commit,supplementPlan(corrupt)),/PNG/);
    validateProductChecks({...good,product_checks:receipt}); // The checkout now contains both a later change and an invalid image.
    fs.unlinkSync(folder + '/new.png'); fs.writeFileSync(image,another); const changedImage = source(commit());
    changedImage.pr.base = good.source_commit;
    const images = supplementPlan(changedImage);
    assert.deepEqual(images.paths,[image]);
    assert.throws(() => runProductChecks(changedImage.source_commit,images), /Capture digest/);
});
test('maintenance categories form a union; product source and bundled instructions keep full acceptance', t => {
    const { git, write, commit } = repository(t);
    for (const [path, content, route, check] of [
        ['docs/new.md', '# Documentation', 'maintenance', 'docs'],
        ['docs/images/example.png', 'pixel fixture', 'maintenance', 'assets'],
        ['mods/statusline-native/README.md', '# Mod guide', 'maintenance', 'docs'],
        ['packages/core/test/new.test.ts', 'test fixture', 'maintenance', 'core'],
        ['tools/benchmarks/new.ts', 'tool fixture', 'maintenance', 'benchmarks'],
        ['.github/workflows/new.yml', 'name: fixture', 'maintenance', 'checks'],
        ['docs/releases/approvals/v9.0.0.json', '{}', 'maintenance', 'approval'],
        ['.github/pull_request_template.md', '## Purpose / 目的', 'maintenance', 'docs'],
        ['.github/ISSUE_TEMPLATE/feature_request.yml', 'name: Feature', 'maintenance', 'docs'],
        ['.github/ISSUE_TEMPLATE/feedback.yaml', 'name: Feedback', 'maintenance', 'docs'],
        ['packages/cli/resources/statusline-configure/SKILL.md', 'Run the command', 'product', 'actions'],
        ['packages/tui/src/state.ts', 'export const state = 1;', 'product', 'actions'],
    ]) {
        const base = git('rev-parse', 'HEAD'); write(path!, content!); const plan = createImpactPlan(base, commit());
        assert.equal(plan.route, route, path); assert(plan.checks.includes(check as any), path);
    }
    const base = git('rev-parse', 'HEAD'); write('docs/mixed.md', '# Mixed'); write('tools/checks/new.ts', 'export {};');
    const mixed = createImpactPlan(base, commit()); assert.equal(mixed.route, 'maintenance'); assert(mixed.checks.includes('docs') && mixed.checks.includes('checks'));
    const nestedBase = git('rev-parse', 'HEAD'); write('.github/ISSUE_TEMPLATE/nested/feature.yml', 'name: Nested'); const nested = createImpactPlan(nestedBase, commit());
    assert.equal(nested.route, 'maintenance'); assert(nested.checks.includes('checks') && !nested.checks.includes('docs'), 'nested Issue form must remain policy, not documentation');
});
test('unknown files and executable renames do not hide behind documentation extensions', t => {
    const { git, write, commit } = repository(t);
    let base = git('rev-parse', 'HEAD'); write('unregistered/input.bin', 'unknown'); const unknown = createImpactPlan(base, commit());
    assert.equal(unknown.route, 'blocked'); assert.deepEqual(unknown.unknown, ['unregistered/input.bin']);
    write('packages/cli/src/move.ts', 'export const execute = true;'); commit(); base = git('rev-parse', 'HEAD');
    write('docs/README.md', '# Fixture'); git('mv', 'packages/cli/src/move.ts', 'docs/moved.md'); assert.equal(createImpactPlan(base, commit()).route, 'product');
    assert.throws(() => createImpactPlan('0'.repeat(40), base));
});
test('language lifecycle inputs require all consuming checks and actual package comparison', t => {
    const { git, write, commit } = repository(t), base = git('rev-parse', 'HEAD');
    write('tools/generation/i18n/data/accepted/ja.json', '{}');
    const plan = createImpactPlan(base, commit()); assert.equal(plan.route, 'compare'); assert.deepEqual(plan.unknown, []);
    for (const check of ['generation', 'checks', 'release', 'core', 'tui', 'native', 'packaging']) assert(plan.checks.includes(check as any));
});
test('translation values and theme slots are scoped but keys, placeholders and executable operations are core', t => {
    const { git, write, commit } = repository(t), path = 'packages/core/resources/i18n/locales/en.json';
    write(path, '{"hello":"Hello {name}"}'); commit();
    let base = git('rev-parse', 'HEAD'); write(path, '{"hello":"Welcome {name}"}');
    assert.equal(createImpactPlan(base, commit()).route, 'maintenance');
    base = git('rev-parse', 'HEAD'); write(path, '{"hello":"Welcome {other}"}'); assert.equal(createImpactPlan(base, commit()).route, 'product');
    const theme = 'packages/core/src/editor/themes.ts'; write(theme, 'export const theme = {foreground:["#123456"], warning:"#334455"};'); commit();
    base = git('rev-parse', 'HEAD'); write(theme, 'export const theme = {foreground:["#abcdef"], warning:"#445566"};');
    assert.equal(createImpactPlan(base, commit()).route, 'maintenance');
    base = git('rev-parse', 'HEAD'); write(theme, 'export const theme = {foreground:[danger()], warning:"#445566"};');
    assert.equal(createImpactPlan(base, commit()).route, 'product');
});
test('comment and type changes require package comparison; runtime expressions do not normalize away', () => {
    assert.equal(emitted('export const answer: number = 42; // note'), emitted('/* new */ export const answer = 42;'));
    assert.notEqual(emitted('export const answer = 41;'), emitted('export const answer = 42;'));
    assert.notEqual(emitted('export const VERSION = "3.13.0";', false, true), emitted('export const VERSION = compute();', false, true));
});
test('human help literal values are scoped while command selection and expressions stay bound', t => {
    const { git, write, commit } = repository(t), path = 'packages/cli/src/help.ts';
    const source = 'export function helpText(command: string) { const lines = ["Usage: old"]; if (command === "config") lines.push("Old help"); return lines.join("\\n"); }';
    write(path, source); commit(); let base = git('rev-parse', 'HEAD');
    write(path, source.replace('Usage: old', 'Usage: new').replace('Old help', 'New help'));
    assert.equal(createImpactPlan(base, commit()).route, 'maintenance');
    base = git('rev-parse', 'HEAD'); write(path, source.replace('command === "config"', 'command === "install"'));
    assert.equal(createImpactPlan(base, commit()).route, 'product');
});
test('help normalization cannot hide control expressions, lookup keys or call arguments inside output construction', () => {
    const help = (source: string) => emitted(source, false, false, 'help.ts', true);
    const examples = [
        'const lines = [command === "before" ? "yes" : "no"];',
        'const lines = [t("before", language)];',
        'const lines = [commands["before"]];',
        'lines.push(format("before"));',
        'const COMMANDS = { config: "before" };',
        'const lines = ["\\u001bbefore"];',
    ];
    for (const source of examples) assert.notEqual(help(source), help(source.replace('before', 'after')), source);
    assert.equal(help('const lines = [enabled ? "Before" + t("fixed", language) : "Other"];'),
        help('const lines = [enabled ? "After" + t("fixed", language) : "Else"];'));
});
test('workspace descriptions need package comparison while entrypoints remain product behavior', t => {
    const { git, write, commit } = repository(t), path = 'packages/core/package.json';
    write(path, '{"name":"@fbincon/statusline-core","description":"Before","exports":"./src/index.js"}'); commit(); let base = git('rev-parse', 'HEAD');
    write(path, '{"name":"@fbincon/statusline-core","description":"After","exports":"./src/index.js"}'); assert.equal(createImpactPlan(base, commit()).route, 'compare');
    base = git('rev-parse', 'HEAD'); write(path, '{"name":"@fbincon/statusline-core","description":"After","exports":"./other.js"}'); assert.equal(createImpactPlan(base, commit()).route, 'product');
});
test('production import ownership wins over test paths and generated fixtures always check generation', t => {
    const { git, write, commit } = repository(t);
    write('packages/core/src/value.ts', 'export { value } from "../test/shared.js";'); write('packages/core/test/shared.ts', 'export const value = 1;'); commit();
    let base = git('rev-parse', 'HEAD'); write('packages/core/test/shared.ts', 'export const value = 2;');
    const dependency = createImpactPlan(base, commit()); assert.equal(dependency.route, 'compare'); assert(dependency.checks.includes('packaging') && dependency.checks.includes('core'));
    base = git('rev-parse', 'HEAD'); write('mods/statusline-native/tests/generated-fixture.ts', '// Generated by tools/generation/resources.ts; do not edit.\nexport const cases = [];');
    const generated = createImpactPlan(base, commit()); assert.equal(generated.route, 'maintenance'); assert(generated.checks.includes('native') && generated.checks.includes('generation'));
});
test('a non-reused batched main push checks the entire actual push range, including earlier core changes', async t => {
    const { git, write, commit, root } = repository(t);
    write('packages/core/src/value.ts', 'export const value = 1;'); const base = commit();
    write('packages/core/src/value.ts', 'export const value = 2;'); commit(); write('docs/last.md', '# Last commit'); const head = commit();
    const keys = ['CI_EVENT', 'CI_BASE', 'CI_REF_NAME', 'GITHUB_OUTPUT', 'GITHUB_STEP_SUMMARY'] as const;
    const saved = Object.fromEntries(keys.map(key => [key, process.env[key]]));
    try {
        process.env.CI_EVENT = 'push'; process.env.CI_BASE = base; process.env.CI_REF_NAME = 'main'; delete process.env.GITHUB_OUTPUT; delete process.env.GITHUB_STEP_SUMMARY;
        const selection = await selectImpact(join(root, 'selection'));
        assert.equal(selection.plan.base, base); assert.equal(selection.plan.head, head); assert.equal(selection.plan.route, 'product');
        assert(selection.plan.changes.some(change => change.path === 'packages/core/src/value.ts' && change.category === 'product'));
    } finally { for (const key of keys) if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; }
});
test('runtime closure includes dependencies mislabeled dev and ignores unrelated development packages', () => {
    const lock: any = { lockfileVersion: 3, packages: Object.fromEntries(['core', 'platform', 'cli', 'tui'].map(name => ['packages/' + name, { version: '0.0.0', dependencies: { runtime: '1.0.0' } }])) };
    lock.packages['node_modules/runtime'] = { version: '1.0.0', integrity: 'sha512-fixture', dev: true };
    lock.packages['node_modules/compiler'] = { version: '1.0.0', dev: true };
    const before = runtimeLock(Buffer.from(JSON.stringify(lock))); lock.packages['node_modules/compiler'].version = '2.0.0';
    assert.equal(runtimeLock(Buffer.from(JSON.stringify(lock))), before);
    lock.packages['node_modules/runtime'].integrity = 'sha512-changed'; assert.notEqual(runtimeLock(Buffer.from(JSON.stringify(lock))), before);
    delete lock.packages['node_modules/runtime']; assert.throws(() => runtimeLock(Buffer.from(JSON.stringify(lock))));
});
test('runtime peers stay in the closure and missing maintenance evidence never falls back to fresh main checks', () => {
    const lock: any = { lockfileVersion: 3, packages: Object.fromEntries(['core', 'platform', 'cli', 'tui'].map(name => ['packages/' + name, { version: '0.0.0', peerDependencies: { peer: '*' } }])) };
    lock.packages['node_modules/peer'] = { version: '1.0.0', integrity: 'sha512-one', dev: true };
    const first = runtimeLock(Buffer.from(JSON.stringify(lock))); lock.packages['node_modules/peer'].integrity = 'sha512-two';
    assert.notEqual(runtimeLock(Buffer.from(JSON.stringify(lock))), first);
    assert.equal(maintenanceSourceKind([{ name: 'ts06-acceptance' }]), 'complete');
    assert.equal(maintenanceSourceKind([{ name: 'ci-maintenance' }]), 'maintenance');
    assert.throws(() => maintenanceSourceKind([])); assert.throws(() => maintenanceSourceKind([{ name: 'ci-impact-plan' }, { name: 'ts06-acceptance' }]));
});
test('product identity excludes maintenance source but binds code, instruction resources and runtime dependencies', t => {
    const { git, write, commit } = repository(t); write('packages/core/src/example.ts', 'export const value = 1;'); commit();
    const base = git('rev-parse', 'HEAD'), before = productInputs(base);
    write('tools/checks/impact-plan.ts', '// Changed validator\n'); write('docs/new.md', '# Notes');
    assert.equal(productInputs(commit()), before);
    write('packages/core/src/example.ts', 'export const value = 2;'); assert.notEqual(productInputs(commit()), before);
});
test('planned targets retain platform and host responsibilities without scheduling unrelated product matrices', () => {
    assert.deepEqual(tasksFor(['docs']).map(task => task.id), ['linux']);
    assert.equal(tasksFor(['checks']).length, 3); assert.equal(tasksFor(['native']).length, 22);
    assert.equal(tasksFor(['runtime']).length, 18);
    assert.deepEqual(tasksFor(['agent-rows']).map(task => task.id), ['ubuntu-24.04', 'windows-2025', 'macos-15']
        .flatMap(os => [os + '-2.1.326', os + '-2.1.332']));
    assert.equal(tasksFor(['native'], false).length, 16);
    assert.equal(tasksFor(['agent-rows'], false).length, 0);
    assert(scopedTests('checks').some(path => path.endsWith('ci-trust.test.js')));
});
test('scoped Mods hand each planned file to an isolated official process and retain failures', async t => {
    const root = fs.mkdtempSync(join(tmpdir(), 'scoped-mod-batches-'));
    t.after(() => { removeTree(root); assert(!fs.existsSync(root)); });
    const source = join(root, 'plugin'), expected = ['tests/a.test.ts', 'tests/b.test.ts'];
    fs.mkdirSync(join(source, 'tests'), { recursive: true });
    for (const path of expected) fs.writeFileSync(join(source, path), '// Test fixture\n');
    const stub = join(root, 'host.cjs');
    fs.writeFileSync(stub, `const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
        const [literal, plugin, test, copy] = process.argv.slice(2);
        assert.deepEqual([literal, plugin, test], ['literal argument &', 'plugin', 'test']);
        const files = fs.readdirSync(path.join(copy, 'tests'));
        assert.equal(files.length, 1);
        const file = 'tests/' + files[0];
        if (process.env.FAIL_FILE === file) process.exit(1);
        if (process.env.MEET_DIRECTORY) {
            fs.writeFileSync(path.join(process.env.MEET_DIRECTORY, files[0]), '');
            const deadline = Date.now() + 10_000, sleeper = new Int32Array(new SharedArrayBuffer(4));
            while (fs.readdirSync(process.env.MEET_DIRECTORY).length < 2) {
                assert(Date.now() < deadline, 'Expected two live scoped workers');
                Atomics.wait(sleeper, 0, 0, 20);
            }
        }
        console.log(file + ':\\n(pass) fixture\\n1 pass\\n0 fail\\nRan 1 test across 1 file. [1ms]');
    `);
    const options = { source, temporary: join(root, 'copies'), logs: join(root, 'pass'), cwd: root,
        host: { executable: process.execPath, args: [stub, 'literal argument &'] }, env: { ...process.env, STATUSLINE_MOD_TEST_JOBS: '1' } };
    await assert.rejects(runScopedModTests(options, expected.slice(0, 1)), /inventory differs/u);
    assert(!fs.existsSync(options.logs));
    let clock = 0;
    const admission = familyAdmissionMs(expected.length);
    const result = await runScopedModTests({ ...options, onCommand() { clock = clock === 0 ? admission - 1 : clock + 20_000; } },
        expected, () => clock);
    assert.deepEqual(result.batches.map(batch => batch.test_files), expected.map(file => [file]));
    assert.deepEqual(result.concurrency, { limit: 1, peak: 1 });
    assert(result.batches.every(batch => batch.timeout_ms === OFFICIAL_TEST_TIMEOUT_MS));
    assert.equal(result.totals.pass, 2); assert(clock > admission, 'Last admitted file can finish after admission closes');
    clock = 0;
    const expiredLogs = join(root, 'expired');
    await assert.rejects(runScopedModTests({ ...options, logs: expiredLogs, onCommand() { clock = admission; } },
        expected, () => clock), /tests\/b\.test\.ts/u);
    assert.match(fs.readFileSync(join(expiredLogs, 'plugin-batch-0002.log'), 'utf8'), /Scoped Mod file admission expired/u);
    const logs = join(root, 'fail');
    await assert.rejects(runScopedModTests({ ...options, logs, env: { ...options.env, FAIL_FILE: expected[1] } }, expected), /tests\/b\.test\.ts/u);
    assert(fs.existsSync(join(logs, 'plugin-batch-0002.log')));
    assert(!fs.existsSync(options.temporary));
    const meet = join(root, 'both-running'); fs.mkdirSync(meet);
    const parallelEnv: NodeJS.ProcessEnv = { ...process.env, MEET_DIRECTORY: meet };
    delete parallelEnv.STATUSLINE_MOD_TEST_JOBS;
    const parallel = await runScopedModTests({ ...options, env: parallelEnv, logs: join(root, 'parallel') }, expected);
    assert.deepEqual(parallel.concurrency, { limit: 4, peak: 2 });
    assert.deepEqual(parallel.test_files, expected); assert.equal(parallel.totals.pass, 2);

    // The 46 native files on Windows 2.1.326 took 716.58 seconds in official batches.
    const nativeFiles = Array.from({ length: 46 }, (_, index) => 'tests/' + String(index).padStart(2, '0') + '.test.ts');
    for (const path of expected) fs.unlinkSync(join(source, path));
    for (const path of nativeFiles) fs.writeFileSync(join(source, path), '// Test fixture\n');
    clock = 0;
    const native = await runScopedModTests({ ...options, logs: join(root, 'native'), onCommand() { clock += 716_582 / nativeFiles.length; } },
        nativeFiles, () => clock);
    assert(clock >= 716_581); assert.equal(native.totals.files, 46); assert.equal(native.totals.pass, 46);
});
test('each scoped test file owns a fresh deadline and any failed file keeps the family failed', async t => {
    const root = fs.mkdtempSync(join(tmpdir(), 'scoped-files-'));
    t.after(() => { removeTree(root); assert(!fs.existsSync(root)); });
    const files = ['one.test.cjs', 'two.test.cjs'].map(name => join(root, name));
    const order = join(root, 'order'), env = { ...process.env };
    // This regression starts its own real Node test runs from inside node:test.
    delete env.NODE_TEST_CONTEXT;
    for (const [i, file] of files.entries()) fs.writeFileSync(file,
        `const test=require('node:test');test('file ${i}',()=>require('node:fs').appendFileSync(${JSON.stringify(order)},'${i}'));`);
    const pass = join(root, 'pass');
    await runScopedTestFiles(files, pass, env);
    const receipt = JSON.parse(fs.readFileSync(pass + '.phases.json', 'utf8'));
    assert.equal(receipt.status, 'pass'); assert.equal(receipt.promotable, false);
    assert.deepEqual(receipt.phases, files.map(name => ({ name, budgetMs: 900_000 })));
    assert.equal(receipt.budget_ms, familyEnvelopeMs(files.length));
    assert.equal(fs.readFileSync(order, 'utf8'), '01');

    fs.appendFileSync(files[0]!, "\nrequire('node:test')('deliberate scoped failure',()=>{throw Error('scoped assertion')});");
    const fail = join(root, 'fail');
    await assert.rejects(runScopedTestFiles(files, fail, env), /one\.test\.cjs/);
    const rejected = JSON.parse(fs.readFileSync(fail + '.phases.json', 'utf8'));
    assert.equal(rejected.status, 'fail');
    assert(rejected.events.some((row: any) => row.name === files[0] && row.event === 'fail'));
    assert.equal(fs.readFileSync(order, 'utf8'), '0101', 'Later selected files still execute after an ordinary assertion failure');
});
test('scheduling budgets use the selected Git source inventory and reject an infeasible hosted task', () => {
    const files = Array.from({ length: 57 }, (_, i) => 'packages/cli/test/test-' + i + '.test.ts');
    const task = tasksFor(['cli', 'docs']).find(row => row.id === 'linux')!;
    assert.equal(scopedSourceFiles('cli', files).length, 57);
    assert.equal(scopedSourceFiles('migration', ['tools/migration/ts-04/test/installed.test.ts']).length, 0);
    assert.equal(scopedTaskBudget(task, files), 25 * 60_000 + 15 * 60_000 + 15 * 60_000 + familyEnvelopeMs(57));
    const oversized = Array.from({ length: 4500 }, (_, i) => 'packages/cli/test/large-' + i + '.test.ts');
    assert.throws(() => scopedTaskBudget(task, oversized), /partition the task/);
    assert.throws(() => partitionScopedTasks([task], oversized), /partition the task/);
});
test('scoped Mod estimates cover the single-worker setting and preserve historical hosted budgets', () => {
    const task = tasksFor(['native']).find(row => row.os === 'windows-2025' && row.host === '2.1.326')!;
    const paths = Array.from({ length: 46 }, (_, index) => 'mods/statusline-native/tests/' + index + '.test.ts');
    const historical = [...paths, 'mods/statusline-runtime/tests/other.test.ts', 'mods/statusline-native/tests/support.ts'];
    const current = [...historical, 'tools/checks/impact-mod-batches.ts'];
    assert.equal(scopedModFiles('native', current).length, 46);
    assert.equal(scopedTaskBudget(task, historical), (25 + 15 + 40) * 60_000);
    assert.equal(scopedTaskBudget(task, current), (25 + 15 + 48) * 60_000);
    assert.equal(scopedTaskBudget({ ...task, host: '2.1.296' }, current), (25 + 15 + 48 - 16) * 60_000);
    assert.throws(() => scopedTaskBudget({ ...task, checks: ['agent-rows'] }, current), /Empty scoped test family/u);
    const oversized = Array.from({ length: 4_000 }, (_, index) => 'mods/statusline-native/tests/large-' + index + '.test.ts');
    assert.throws(() => scopedTaskBudget(task, [...current, ...oversized]), /partition the task/u);
});
test('oversized package-sensitive plans split complete checks while historical tasks keep their identities', t => {
    const { write, commit } = repository(t);
    for (const path of ['packages/cli', 'packages/core', 'packages/tui', 'tools/build', 'tools/checks', 'tools/generation', 'tools/release'])
        write(path + '/test/sample.test.ts', '// Existing scoped tests');
    const base = commit();
    write('docs/new.md', '# Language update');
    write('packages/cli/test/sample.test.ts', '// Regional regressions');
    write('tools/generation/i18n/data/fixture.json', '{}');
    const originalHead = commit();
    const original = createImpactPlan(base, originalHead);
    assert.equal(original.route, 'compare');
    assert.deepEqual(original.tasks, tasksFor(original.checks, false));
    assert.throws(() => scopedTaskBudget(original.tasks[0]!, [...tree(originalHead).keys()]), /partition the task/);
    const comparison = { route: 'maintenance' as const, comparison_sha256: 'a'.repeat(64) };
    assertPlan({ ...original, ...comparison });

    write('tools/checks/impact-schedule.ts', '// Partition scheduling policy');
    const head = commit();
    const plan = createImpactPlan(base, head);
    assert.equal(plan.route, 'compare');
    assert.deepEqual(plan.checks, original.checks);
    const [linux, ...otherTasks] = original.tasks;
    assert.deepEqual(plan.tasks, original.tasks);
    const resolved = scheduleMaintenance({ ...plan, ...comparison });
    assert.deepEqual(resolved.tasks, [
        { ...linux!, checks: linux!.checks.slice(0, -1) },
        { ...linux!, id: 'linux-2', checks: ['tui'] },
        ...otherTasks,
    ]);
    checkScopedSchedule(resolved, [...tree(head).keys()]);
    assertPlan(resolved);
    assert.throws(() => assertPlan({ ...resolved, tasks: original.tasks }));
    assert.throws(() => assertPlan({ ...resolved, tasks: resolved.tasks.filter(task => task.id !== 'linux-2') }));
});
test('an oversized check family is admitted only after package comparison selects maintenance', t => {
    const { write, commit } = repository(t);
    write('tools/checks/impact-schedule.ts', '// Scheduling policy');
    write('tools/generation/test/generation.test.ts', '// Generation family');
    for (let i = 0; i < 3600; i++) write('tools/build/test/case-' + i + '.test.ts', '// Build family');
    write('tools/build/pack.ts', 'export const payload = 1;');
    const base = commit();
    write('tools/build/pack.ts', 'export const payload = 2;');
    const plan = createImpactPlan(base, commit());
    assert.equal(plan.route, 'compare');
    assert.deepEqual(scheduleMaintenance(plan), plan);
    assert.throws(() => assertPlan(plan), /Unresolved impact plan/);

    const comparison_sha256 = 'a'.repeat(64);
    const product = scheduleMaintenance({ ...plan, route: 'product', comparison_sha256 });
    assert.deepEqual(product.tasks, plan.tasks);
    assertPlan(product);
    const maintenance = { ...plan, route: 'maintenance' as const, comparison_sha256 };
    assert.throws(() => scheduleMaintenance(maintenance), /Scoped task linux-2 needs 372 minutes/);
    assert.throws(() => assertPlan(maintenance), /partition the task/);
});
test('scoped receipt cannot substitute another commit, task, plan, result or execution', t => {
    const { git, write, commit } = repository(t), base = git('rev-parse', 'HEAD'); write('docs/test.md', '# Text');
    const plan = createImpactPlan(base, commit()); assertPlan(plan);
    const receipt: any = { schema_version: 1, kind: 'scoped-checks', status: 'pass', commit: plan.head, plan_sha256: hash(canonical(plan)), task: plan.tasks[0], checks: plan.tasks[0]!.checks,
        node: 'v24.21.0', platform: 'linux', started_at: '2026-01-01T00:00:00Z', completed_at: '2026-01-01T00:01:00Z', execution: { run_id: '12', attempt: '1', job: 'scoped' } };
    validateScopedReceipt(receipt, plan, 'linux', 12);
    for (const [key, value] of [['status', 'fail'], ['commit', base], ['plan_sha256', 'a'.repeat(64)], ['checks', []], ['platform', 'win32']])
        assert.throws(() => validateScopedReceipt({ ...receipt, [key as string]: value }, plan, 'linux', 12));
    assert.throws(() => validateScopedReceipt(receipt, plan, 'missing', 12));
    assert.throws(() => validateScopedReceipt(receipt, plan, 'linux', 13));
});
test('maintenance aggregate fails closed on skipped checks, failed scope, draft or unexpected product jobs', () => {
    const needs: any = { scope: { result: 'success', outputs: { route: 'maintenance', draft: 'false', impact_reused: 'false' } }, scoped: { result: 'success' }, maintenance: { result: 'success' } };
    for (const name of ['development', 'candidate', 'installed', 'runtime', 'mods', 'integration', 'promotion']) needs[name] = { result: 'skipped' };
    assessImpactNeeds(needs);
    for (const key of ['scope', 'scoped', 'maintenance']) for (const result of ['failure', 'cancelled', 'skipped']) assert.throws(() => assessImpactNeeds({ ...needs, [key]: { ...needs[key], result } }));
    assert.throws(() => assessImpactNeeds({ ...needs, candidate: { result: 'success' } }));
    needs.scope.outputs.impact_reused = 'true'; assert.throws(() => assessImpactNeeds(needs)); needs.scoped.result = 'skipped'; assessImpactNeeds(needs);
    needs.scope.outputs.draft = 'true'; assert.throws(() => assessImpactNeeds(needs));
});
test('actual PR 181 documentation/media changes choose scoped checks and current capture hashes verify', () => {
    const plan = createImpactPlan('b58227b3aee7ea19dbe52e51fa5cbb42ff113e79', 'b23fe56b0c657617367b94c2dd5bc22fb8f37092');
    assert.equal(plan.route, 'maintenance'); assert.deepEqual(plan.checks, ['actions', 'assets', 'docs']); assert.equal(plan.changes.length, 27);
    checkAssets(process.cwd(), plan.changes.map(item => item.path));
    const image = fs.readFileSync('docs/images/draft-history-reuse/native-draft-history.png'); assert(pngDimensions(image).width > 0);
    const corrupt = Buffer.from(image); corrupt[100] = corrupt[100]! ^ 1; assert.throws(() => pngDimensions(corrupt));
});
