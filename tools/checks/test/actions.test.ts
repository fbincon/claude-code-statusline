import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { checkActions } from '../actions.js';
import { repoRoot } from '../../migration/ts-03/common.js';

const SHA = 'a'.repeat(40), PIN = `actions/example@${SHA}`, DIGEST = 'b'.repeat(64);
function fixture(t: TestContext) {
    const root = fs.mkdtempSync(join(tmpdir(), 'actions identities '));
    t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }));
    const write = (name: string, source: string) => {
        const path = join(root, name); fs.mkdirSync(dirname(path), { recursive: true }); fs.writeFileSync(path, source);
    };
    const workflow = (steps: string, name = 'test.yml') => write('.github/workflows/' + name, `name: fixture\non: push\njobs:\n  test:\n    runs-on: ubuntu-24.04\n    steps:\n${steps}\n`);
    return { root, write, workflow, check: () => checkActions(root) };
}

test('all maintained workflows have complete, commented Action identities', () => {
    const result = checkActions(repoRoot);
    assert.deepEqual(result.errors, []);
    assert(result.files > 0);
    assert(result.references.length > 0);
    assert(result.references.every(reference => reference.version));
});

test('checkout aliases use the same canonical boundary as their workflow files', t => {
    const f = fixture(t);
    f.workflow(`      - uses: ${PIN} # v1.2.3`);
    const alias = join(f.root, 'checkout alias');
    fs.symlinkSync(f.root, alias, process.platform === 'win32' ? 'junction' : 'dir');
    assert.deepEqual(checkActions(alias), f.check());
    assert.deepEqual(checkActions(alias).errors, []);
});

test('step subpaths and remote reusable workflows use the same pin policy', t => {
    const f = fixture(t);
    f.write('.github/workflows/reuse.yaml', `on: workflow_call\njobs:\n  call:\n    uses: owner/repo/.github/workflows/test.yml@${SHA} # v2.3.4\n`);
    f.workflow(`      - uses: owner/repo/sub/action@${SHA} # v2.3.4`);
    const result = f.check();
    assert.deepEqual(result.errors, []); assert.equal(result.references.length, 2);
});

test('tags, branches, short SHAs, expressions and missing version comments fail', t => {
    const f = fixture(t);
    for (const reference of ['actions/example@v4', 'actions/example@main', 'actions/example@abcdef0', 'actions/example@' + 'g'.repeat(40), '${{ matrix.action }}']) {
        f.workflow(`      - uses: ${reference} # v4.0.0`);
        assert(f.check().errors.some(error => error.includes('FULL_40_CHARACTER_COMMIT_SHA')), reference);
    }
    for (const comment of ['', '# v4', '# latest', '# reviewed']) {
        f.workflow(`      - uses: ${PIN} ${comment}`);
        assert(f.check().errors.some(error => error.includes('version comment')), comment);
    }
    f.workflow('      - uses: 123');
    assert(f.check().errors.some(error => error.includes('uses must be a string')));
});

test('quoted keys, flow mappings, aliases and folded scalars cannot hide uses', t => {
    const f = fixture(t);
    f.workflow(`      - "uses": '${PIN}' # v1.2.3\n      - {uses: "${PIN}"} # v1.2.3\n      - uses: &pinned ${PIN} # v1.2.3\n      - uses: *pinned\n      - uses: >- # v1.2.3\n          ${PIN}`, 'test.yaml');
    let result = f.check();
    assert.deepEqual(result.errors, []); assert.equal(result.references.length, 5);
    f.workflow('      - {"uses": "actions/example@main"} # v1.2.3', 'test.yaml');
    result = f.check(); assert(result.errors.some(error => error.includes('FULL_40_CHARACTER_COMMIT_SHA')));
});

test('local composite Actions are followed once and their dependencies are checked', t => {
    const f = fixture(t);
    f.workflow('      - uses: ./.github/actions/one\n      - uses: ./.github/actions/one');
    f.write('.github/actions/one/action.yml', 'runs:\n  using: composite\n  steps:\n    - uses: ./.github/actions/two\n');
    f.write('.github/actions/two/action.yaml', `runs:\n  using: composite\n  steps:\n    - uses: ${PIN} # v1.2.3\n`);
    let result = f.check();
    assert.deepEqual(result.errors, []); assert.equal(result.files, 3); assert.equal(result.references.length, 4);
    f.write('.github/actions/two/action.yaml', 'runs:\n  using: composite\n  steps:\n    - uses: actions/example@main # v1.2.3\n');
    result = f.check();
    assert(result.errors.some(error => error.startsWith('.github/actions/two/action.yaml:4:') && error.includes('COMMIT_SHA')));
});

test('local JavaScript and Docker Actions and local reusable workflows remain usable', t => {
    const f = fixture(t);
    f.workflow('      - uses: ./javascript\n      - uses: ./container');
    f.write('javascript/action.yml', 'runs:\n  using: node20\n  main: index.js\n');
    f.write('container/action.yaml', 'runs:\n  using: docker\n  image: Dockerfile\n');
    f.write('.github/workflows/reuse.yaml', 'on: workflow_call\njobs:\n  local:\n    uses: ./.github/workflows/test.yml\n');
    assert.deepEqual(f.check().errors, []);
});

test('missing local definitions and references outside the repository fail', t => {
    const f = fixture(t);
    for (const reference of ['./missing', './../outside']) {
        f.workflow(`      - uses: ${reference}`); assert(f.check().errors.length, reference);
    }
    f.workflow('      - uses: ./local');
    f.write('local/action.yml', 'runs: {using: composite, steps: []}');
    f.write('local/action.yaml', 'runs: {using: composite, steps: []}');
    assert(f.check().errors.some(error => error.includes('exactly one')));
    f.write('.github/workflows/reuse.yml', 'jobs:\n  local:\n    uses: ./elsewhere.yml\n');
    assert(f.check().errors.some(error => error.includes('Local reusable workflow')));
});

test('Docker step references require the complete SHA-256 digest', t => {
    const f = fixture(t);
    f.workflow(`      - uses: docker://alpine@sha256:${DIGEST}`);
    assert.deepEqual(f.check().errors, []);
    for (const reference of ['docker://alpine:latest', 'docker://alpine@sha256:abcdef']) {
        f.workflow(`      - uses: ${reference}`); assert(f.check().errors.some(error => error.includes('FULL_DIGEST')));
    }
    f.write('.github/workflows/reuse.yml', `jobs:\n  call:\n    uses: docker://alpine@sha256:${DIGEST}\n`);
    assert(f.check().errors.some(error => error.includes('in a step')));
});

test('comments, environment strings and run blocks are not dependency references', t => {
    const f = fixture(t);
    f.workflow('      # - uses: actions/example@main\n      - run: |\n          uses: actions/example@main\n        env:\n          uses: actions/example@main');
    const result = f.check(); assert.deepEqual(result.errors, []); assert.equal(result.references.length, 0);
});

test('invalid YAML, duplicate keys, multiple documents and empty inventories fail closed', t => {
    const f = fixture(t);
    assert(f.check().errors.length);
    fs.mkdirSync(join(f.root, '.github/workflows'), { recursive: true });
    assert(f.check().errors.some(error => error.includes('No workflow files')));
    for (const source of ['jobs: [', 'jobs: {}\njobs: {}', 'jobs: {}\n---\njobs: {}', 'jobs: []', 'jobs:\n  test:\n    steps: {}', 'jobs:\n  test:\n    steps:\n      - uses: *missing']) {
        f.write('.github/workflows/test.yml', source); assert(f.check().errors.length, source);
    }
});

test('CLI reports a source line and exits unsuccessfully for an omitted pin', t => {
    const f = fixture(t); f.workflow('      - uses: actions/example@main # v1.2.3');
    const cli = fileURLToPath(new URL('../actions.js', import.meta.url));
    const result = spawnSync(process.execPath, [cli, '--root', f.root], { encoding: 'utf8' });
    assert.equal(result.status, 1); assert.match(result.stderr, /test\.yml:7: External reference/u);
    assert.match(result.stdout, /1 files, 1 references, 1 errors/u);
});

test('Dependabot updates only Actions within their current majors in one weekly PR', () => {
    const config = parse(fs.readFileSync(join(repoRoot, '.github/dependabot.yml'), 'utf8'));
    assert.equal(config.version, 2); assert.equal(config.updates.length, 1);
    const update = config.updates[0];
    assert.equal(update['package-ecosystem'], 'github-actions'); assert.equal(update.directory, '/');
    assert.deepEqual(update.schedule, { interval: 'weekly', day: 'monday', time: '09:00', timezone: 'Asia/Shanghai' });
    assert.equal(update['open-pull-requests-limit'], 1);
    assert.deepEqual(update.groups['github-actions'], { patterns: ['*'], 'update-types': ['minor', 'patch'] });
    assert.deepEqual(update.ignore, [{ 'dependency-name': '*', 'update-types': ['version-update:semver-major'] }]);
});
