import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join, delimiter } from 'node:path';
import { spawnSync } from 'node:child_process';
import { GitInvocation, GitPolicyError, gitEnvironment, filterEntries, filterOverrides } from '../src/git.js';

function fixture(t: TestContext) {
    const root = fs.mkdtempSync(join(tmpdir(), 'git policy 中文 ~(paths) ')), repo = join(root, 'repo spaces'), global = join(root, 'global');
    t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }));
    fs.mkdirSync(repo); fs.writeFileSync(global, '');
    const env = { ...process.env };
    for (const key of Object.keys(env)) if (key.startsWith('GIT_')) delete env[key];
    Object.assign(env, { GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: global, LC_ALL: 'C' });
    const git = (...args: string[]) => {
        const r = spawnSync('git', ['-C', repo, ...args], { env, encoding: 'utf8', timeout: 10000, windowsHide: true });
        assert.equal(r.status, 0, r.stderr); return r.stdout;
    };
    git('init', '-q', '-b', 'main');
    for (const [key, value] of [['user.name','Test'], ['user.email','test@example.invalid'], ['core.autocrlf','false'], ['commit.gpgsign','false']]) git('config', key!, value!);
    fs.writeFileSync(join(repo, 'file.txt'), 'aaaa\n'); git('add', '.'); git('commit', '-qm', 'fixture');
    const marker = join(root, 'marker'), script = join(root, 'probe.cjs');
    fs.writeFileSync(script, "require('fs').appendFileSync(process.argv[2],'called\\n'); if(process.argv[3]==='clean')process.stdout.write(require('fs').readFileSync(0));");
    // Git executes filters with its POSIX shell on all supported platforms.
    const q = (s: string) => "'" + s.replaceAll('\\', '/').replaceAll("'", "'\\''") + "'";
    const command = [process.execPath, script, marker].map(q).join(' ');
    const invocation = (directory = repo) => new GitInvocation(directory, 5000, undefined, undefined, env);
    return { root, repo, global, env, git, marker, command, invocation };
}
const status = ['status', '--porcelain=v2', '--branch', '--untracked-files=all'];
test('repository fsmonitor never runs, while ordinary clean/dirty semantics and config bytes survive', t => {
    const f = fixture(t); f.git('config', 'core.fsmonitor', f.command);
    const before = fs.readFileSync(join(f.repo, '.git/config'));
    const git = f.invocation(), policy = git.worktreePolicy();
    assert.equal(git.command(status, policy).code, 0);
    assert.equal(fs.existsSync(f.marker), false);
    fs.writeFileSync(join(f.repo, 'file.txt'), 'bbbb\n');
    assert.match(git.command(status, policy).stdout.toString(), /1 \.M /u);
    assert.equal(fs.existsSync(f.marker), false);
    assert.deepEqual(fs.readFileSync(join(f.repo, '.git/config')), before);
});
test('same-length clean filter reproduction is blocked before status, including included and worktree configs', t => {
    const f = fixture(t);
    fs.writeFileSync(join(f.repo, '.gitattributes'), '*.txt filter=probe\n');
    f.git('add', '.'); f.git('commit', '-qm', 'filter');
    f.git('config', 'filter.probe.clean', f.command + ' clean');
    fs.writeFileSync(join(f.repo, 'file.txt'), 'bbbb\n');
    fs.utimesSync(join(f.repo, 'file.txt'), new Date(0), new Date(0));
    const before = fs.readFileSync(join(f.repo, '.git/config'));
    assert.throws(() => f.invocation().worktreePolicy(), (e: unknown) => e instanceof GitPolicyError && e.reason === 'filter_blocked');
    assert(!fs.existsSync(f.marker)); assert.deepEqual(fs.readFileSync(join(f.repo, '.git/config')), before);
    f.git('config', '--unset', 'filter.probe.clean');
    const included = join(f.root, 'included'); fs.writeFileSync(included, '[filter "probe"]\nclean = ' + JSON.stringify(f.command + ' clean') + '\n');
    f.git('config', 'include.path', included);
    assert.throws(() => f.invocation().worktreePolicy(), GitPolicyError);
    f.git('config', '--unset', 'include.path'); f.git('config', 'extensions.worktreeConfig', 'true');
    f.git('config', '--worktree', 'filter.probe.clean', f.command + ' clean');
    assert.throws(() => f.invocation().worktreePolicy(), GitPolicyError); assert(!fs.existsSync(f.marker));
    // Exercise the unguarded control only after every protected observation.
    // No prior probe or marker deletion can influence the absence assertion.
    f.git('--no-optional-locks', ...status); assert(fs.existsSync(f.marker), 'baseline executes clean');
});
test('user-managed global filters retain their transformation and configuration', t => {
    const f = fixture(t);
    fs.writeFileSync(join(f.repo, '.gitattributes'), '*.txt filter=probe\n'); f.git('add', '.'); f.git('commit', '-qm', 'filter');
    f.git('config', '--global', 'filter.probe.clean', f.command + ' clean'); fs.writeFileSync(join(f.repo, 'file.txt'), 'bbbb\n');
    fs.utimesSync(join(f.repo, 'file.txt'), new Date(0), new Date(0));
    const before = fs.readFileSync(f.global), git = f.invocation();
    assert.equal(git.command(status, git.worktreePolicy()).code, 0); assert(fs.existsSync(f.marker));
    assert.deepEqual(fs.readFileSync(f.global), before);
});
test('implicit bare discovery is refused and linked worktrees keep the common repository identity', t => {
    const f = fixture(t), bare = join(f.root, 'bare'), tree = join(f.root, 'linked tree');
    f.git('init', '--bare', '-q', bare);
    assert.notEqual(f.invocation(bare).command(['rev-parse', '--is-bare-repository']).code, 0);
    f.git('worktree', 'add', '-qb', 'linked', tree);
    const linked = f.invocation(tree); assert.equal(linked.command(status, linked.worktreePolicy()).code, 0);
    f.git('config', 'filter.bad.clean', f.command); assert.throws(() => f.invocation(tree).worktreePolicy(), GitPolicyError);
});
test('nested submodule filters cannot bypass the parent status policy', t => {
    const f = fixture(t), source = fixture(t);
    f.git('-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', source.repo, 'nested');
    f.git('commit', '-qm', 'submodule');
    const module = join(f.repo, 'nested');
    const configured = spawnSync('git', ['-C', module, 'config', 'filter.hidden.clean', f.command + ' clean'], {env:f.env});
    assert.equal(configured.status, 0);
    assert.throws(() => f.invocation().worktreePolicy(), GitPolicyError); assert(!fs.existsSync(f.marker));
});
test('indirect Git receives policy after both forms of user runtime configuration', t => {
    const f = fixture(t), env = gitEnvironment({ ...f.env, GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'user.name', GIT_CONFIG_VALUE_0: 'Kept', GIT_CONFIG_PARAMETERS: "'core.fsmonitor=unsafe'" });
    const result = spawnSync('git', ['-C', f.repo, 'config', '--get', 'core.fsmonitor'], { env, encoding: 'utf8' });
    assert.equal(result.status, 0); assert.equal(result.stdout.trim(), '');
    assert.equal(spawnSync('git', ['-C', f.repo, 'config', '--get', 'user.name'], { env, encoding: 'utf8' }).stdout.trim(), 'Kept');
    assert.throws(() => gitEnvironment({GIT_CONFIG_COUNT:'-1'}), GitPolicyError);
    assert.throws(() => gitEnvironment({GIT_CONFIG_COUNT:'1'}), GitPolicyError);
});
test('known drivers pin external executables and reject repository shims, operators and unsafe names', t => {
    const f = fixture(t), external = join(f.root, process.platform === 'win32' ? 'git-crypt.exe' : 'git-crypt');
    fs.writeFileSync(external, '', {mode:0o700});
    const entry = (value: string, name = 'crypt') => ({scope:'local', origin:'file:.git/config', key:'filter.' + name + '.clean', name, field:'clean', value});
    assert.equal(filterOverrides([entry('"' + external + '" clean')], [f.repo], f.env).length, 1);
    for (const value of ['"' + external + '" clean; anything', 'node -e anything', 'git-lfs clean -- %f && anything'])
        assert.throws(() => filterOverrides([entry(value)], [f.repo], f.env), GitPolicyError);
    assert.throws(() => filterOverrides([entry('', 'a=b')], [f.repo], f.env), GitPolicyError);
    const local = join(f.repo, process.platform === 'win32' ? 'git-crypt.exe' : 'git-crypt'); fs.writeFileSync(local, '', {mode:0o700});
    assert.throws(() => filterOverrides([entry('"' + local + '" clean')], [f.repo], f.env), GitPolicyError);
    const lfs = join(f.root, process.platform === 'win32' ? 'git-lfs.exe' : 'git-lfs'); fs.writeFileSync(lfs, '', {mode:0o700});
    const lfsEnv = {...f.env, PATH:f.root + delimiter + (f.env.PATH ?? '')};
    assert.match(filterOverrides([entry('git-lfs clean -- %f', 'lfs')], [f.repo], lfsEnv)[0]!, /git-lfs(?:\.exe)?' clean -- %f$/u);
    fs.copyFileSync(lfs, join(f.repo, process.platform === 'win32' ? 'git-lfs.exe' : 'git-lfs'));
    if (process.platform !== 'win32') fs.chmodSync(join(f.repo, 'git-lfs'), 0o700);
    assert.throws(() => filterOverrides([entry('git-lfs clean -- %f', 'lfs')], [f.repo], {...lfsEnv, PATH:f.repo}), GitPolicyError);
    assert.throws(() => filterEntries('local\0file:.git/config\0broken\0'), GitPolicyError);
});
