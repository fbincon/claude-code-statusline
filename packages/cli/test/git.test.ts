import test, { type TestContext } from 'node:test';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { setup, assert, fs, join, plain, pythonJson } from './runtime-support.js';
import { GitCollector } from '../src/runtime/git.js';
import { parsePorcelain, numstat, GIT_CACHE_TTL_NS } from '@fbincon/statusline-core/runtime/git';
import { CommandTimeout, runCommand } from '@fbincon/statusline-platform/command';
const OID = '0123456789abcdef0123456789abcdef01234567';
const ok = (updates = {}) => ({ kind: 'ok', branch: 'main', oid: OID, upstream: null, ahead: 0, behind: 0, upstream_gone: false, staged: 0, unstaged: 0, conflicts: 0, untracked: 0, ...updates });
function git(path: string, ...args: string[]): string { const r = spawnSync('git', ['-C', path, ...args], { encoding: 'utf8', timeout: 10000, windowsHide: true }); assert.equal(r.status, 0, r.stderr); return r.stdout; }
function repository(t: TestContext) {
    const f = setup(t), path = join(f.root, 'repo');
    fs.mkdirSync(path);
    git(path, 'init', '-q', '-b', 'main');
    for (const [key, value] of [['user.name', 'Test'], ['user.email', 'test@example.invalid'], ['commit.gpgsign', 'false'], ['core.autocrlf', 'false'], ['core.hooksPath', join(f.root, 'no-hooks')]])
        git(path, 'config', key!, value!);
    const commit = () => { git(path, 'add', '--all'); git(path, 'commit', '-q', '-m', 'test'); };
    fs.writeFileSync(join(path, 'text'), 'one\ntwo\n');
    commit();
    git(path, 'checkout', '-q', '-b', 'feature');
    const collector = new GitCollector(f.context);
    return { ...f, path, commit, collector };
}
test('tests.rendering.test_statusline_git.GitParserTests.test_all_change_codes_and_all_conflicts', () => {
    const records = [`# branch.oid ${OID}`, '# branch.head main', '# branch.upstream origin/main', '# branch.ab +2 -1'];
    for (const code of 'MTADC')
        records.push(`1 ${code}. N... metadata staged-${code}`, `1 .${code} N... metadata unstaged-${code}`);
    records.push('2 R. N... metadata renamed-new\trenamed-old', '2 .R N... metadata renamed-new\trenamed-old', '1 MM N... metadata both.txt');
    for (const xy of ['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU'])
        records.push(`u ${xy} N... metadata conflict-${xy}`);
    records.push('? nested/one.txt', '? nested/two.txt', '! ignored.log');
    assert.deepEqual(plain(parsePorcelain(records.join('\n') + '\n')), ok({ upstream: 'origin/main', ahead: 2, behind: 1, staged: 7, unstaged: 7, conflicts: 7, untracked: 2 }));
});
test('tests.rendering.test_statusline_git.GitParserTests.test_branch_variants', () => {
    for (const [raw, expected] of [
        [`# branch.oid ${OID}\n# branch.head main\n# branch.upstream origin/main\n# branch.ab +0 -0\n`, ok({ upstream: 'origin/main' })],
        [`# branch.oid ${OID}\n# branch.head local\n`, ok({ branch: 'local' })],
        [`# branch.oid ${OID}\n# branch.head main\n# branch.upstream origin/main\n`, ok({ upstream: 'origin/main', upstream_gone: true })],
        [`# branch.oid ${OID}\n# branch.head (detached)\n`, ok({ branch: 'HEAD@' + OID.slice(0, 7) })],
        ['# branch.oid (initial)\n# branch.head newborn\n', ok({ branch: 'newborn', oid: null })],
    ] as const)
        assert.deepEqual(plain(parsePorcelain(raw)), expected);
});
test('tests.rendering.test_statusline_git.GitParserTests.test_non_repo_and_git_failures_are_distinct', t => {
    const f = setup(t);
    for (const stderr of ['fatal: not a git repository (or any parent): .git\n', 'fatal: detected dubious ownership in repository\n', 'fatal: cannot open .git/index: Permission denied\n', 'fatal: bad object HEAD\n']) {
        const collector = new GitCollector(f.context, undefined, () => ({ code: 128, stdout: Buffer.alloc(0), stderr: Buffer.from(stderr) }));
        assert.deepEqual(collector.uncached(f.root), { kind: stderr.includes('not a git repository') ? 'not_repo' : 'error' });
    }
    for (const error of [new CommandTimeout(), Object.assign(new Error(), { code: 'EACCES' }), Object.assign(new Error(), { code: 'ENOENT' })])
        assert.deepEqual(new GitCollector(f.context, undefined, () => { throw error; }).uncached(f.root), { kind: 'error' });
});
test('tests.rendering.test_statusline_git.GitParserTests.test_malformed_porcelain_is_an_error', () => {
    for (const raw of ['', `# branch.oid ${OID}\n`, `# branch.oid ${OID}\n# branch.head main\n# branch.ab ahead behind\n`, `# branch.oid ${OID}\n# branch.head main\nx unknown\n`, `# branch.oid ${OID}\n# branch.head main\n1 U. metadata\n`])
        assert.deepEqual(parsePorcelain(raw), { kind: 'error' });
});
test('tests.rendering.test_statusline_git.GitCacheTests.test_write_read_permissions_ttl_and_atomicity', t => {
    const f = setup(t), collector = new GitCollector(f.context), now = 1000000000000n;
    f.clock(now);
    collector.writeCache('session-a', f.root, ok({ staged: 1 }));
    const path = collector.path('session-a');
    assert.ok(fs.existsSync(path));
    if (process.platform !== 'win32') {
        assert.equal(fs.statSync(path).mode & 0o777, 0o600);
        assert.equal(fs.statSync(collector.directory()).mode & 0o777, 0o700);
    }
    assert.deepEqual(fs.readdirSync(collector.directory()).filter(n => n.endsWith('.tmp')), []);
    const raw = JSON.parse(fs.readFileSync(path, 'utf8'));
    assert.equal(raw.version, 2);
    assert.equal(raw.cwd, f.root);
    f.clock(now + GIT_CACHE_TTL_NS);
    assert.deepEqual(plain(collector.readCache('session-a', f.root)), ok({ staged: 1 }));
    f.clock(now + GIT_CACHE_TTL_NS + 1n);
    assert.equal(collector.readCache('session-a', f.root), null);
    f.clock(now - 1n);
    assert.equal(collector.readCache('session-a', f.root), null);
});
test('tests.rendering.test_statusline_git.GitCacheTests.test_schema_and_directory_mismatch_are_misses', t => {
    const f = setup(t), collector = new GitCollector(f.context);
    collector.writeCache('session-b', f.root, ok());
    assert.equal(collector.readCache('session-b', join(f.root, 'other')), null);
    fs.writeFileSync(collector.path('legacy'), pythonJson({ checked_ns: f.context.sample().wall_ns, cwd: f.root, value: ['main', 0, 0, 0] }));
    assert.equal(collector.readCache('legacy', f.root), null);
});
test('tests.rendering.test_statusline_git.GitCacheTests.test_git_status_caches_each_session_current_directory', t => {
    const f = setup(t);
    let calls = 0;
    const collector = new GitCollector(f.context, undefined, (spec, options) => { calls++; assert.ok(spec.args.includes('--porcelain=v2')); assert.ok(spec.args.includes('--renames')); assert.ok(spec.args.includes('--untracked-files=all')); assert.equal(options.timeoutMs, 2000); assert.equal(options.environment!.LC_ALL, 'C'); return { code: 0, stdout: Buffer.from(`# branch.oid ${OID}\n# branch.head main\n`), stderr: Buffer.alloc(0) }; });
    collector.status(f.root, 's');
    collector.status(f.root, 's');
    assert.equal(calls, 1);
    collector.status(join(f.root, 'other'), 's');
    assert.equal(calls, 2);
});
test('tests.rendering.test_statusline_git.GitCacheTests.test_pruning_removes_stale_and_oldest_excess_files', t => {
    const f = setup(t), collector = new GitCollector(f.context), now = 1000000000;
    fs.mkdirSync(collector.directory(), { recursive: true });
    f.clock(BigInt(now) * 1000000000n);
    fs.writeFileSync(join(collector.directory(), 'stale.json'), '{}');
    fs.utimesSync(join(collector.directory(), 'stale.json'), now - 10, now - 10);
    for (let i = 0; i < 5; i++) {
        const path = join(collector.directory(), `live-${i}.json`);
        fs.writeFileSync(path, '{}');
        fs.utimesSync(path, now - i / 10, now - i / 10);
    }
    collector.prune(1000000000n, 3);
    assert.deepEqual(fs.readdirSync(collector.directory()).sort(), ['live-0.json', 'live-1.json', 'live-2.json']);
});
test('tests.runtime.test_branch_diff.BranchDiffTests.test_merge_base_excludes_worktree_and_binary_counts_only_files', t => {
    const f = repository(t);
    fs.writeFileSync(join(f.path, 'text'), 'one\nnew\nextra\n');
    fs.writeFileSync(join(f.path, 'binary'), Buffer.from('\0binary'));
    f.commit();
    fs.writeFileSync(join(f.path, 'text'), 'uncommitted');
    const result = plain(f.collector.branchDiff(f.path));
    assert.deepEqual(result.value, { files: 2, added: 2, removed: 1 });
    assert.equal(result.base_ref, 'main');
    git(f.path, 'checkout', '-q', '--detach');
    assert.deepEqual(plain(f.collector.branchDiff(f.path)).value, result.value);
    assert.deepEqual(plain(f.collector.branchDiff(f.path, 'HEAD')).value, { files: 0, added: 0, removed: 0 });
});
test('tests.runtime.test_branch_diff.BranchDiffTests.test_cache_reuses_diff_and_invalidates_when_base_or_head_changes', t => {
    const f = repository(t);
    fs.writeFileSync(join(f.path, 'text'), 'one\ntwo\nthree\n');
    f.commit();
    const first = plain(f.collector.branchDiff(f.path));
    let expensive = 0;
    const collector = new GitCollector(f.context, undefined, (spec, options) => { if (spec.args.includes('diff') || spec.args.includes('merge-base'))
        expensive++; return runCommand(spec, options); });
    assert.deepEqual(plain(collector.branchDiff(f.path)).value, first.value);
    assert.equal(expensive, 0);
    git(f.path, 'branch', '-f', 'main', 'HEAD');
    assert.equal(plain(collector.branchDiff(f.path)).value.files, 0);
    fs.writeFileSync(join(f.path, 'text'), 'new head\n');
    f.commit();
    assert.equal(plain(collector.branchDiff(f.path)).value.files, 1);
});
test('tests.runtime.test_branch_diff.BranchDiffTests.test_unavailable_ref_or_unrelated_history_never_invent_zero', t => {
    const f = repository(t);
    assert.equal(f.collector.branchDiff(f.path, 'missing').reason, 'base_unavailable');
    git(f.path, 'checkout', '-q', '--orphan', 'unrelated');
    fs.writeFileSync(join(f.path, 'other'), 'other');
    f.commit();
    const result = f.collector.branchDiff(f.path, 'main');
    assert.equal(result.reason, 'merge_base_unavailable');
    assert.equal(result.value, null);
});
test('tests.runtime.test_branch_diff.BranchDiffTests.test_origin_head_precedes_local_main_and_timeout_is_shared', t => {
    const f = repository(t);
    git(f.path, 'update-ref', 'refs/remotes/origin/trunk', 'HEAD');
    git(f.path, 'symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/trunk');
    assert.equal(f.collector.branchDiff(f.path).base_ref, 'origin/HEAD');
    assert.equal(new GitCollector(f.context, undefined, () => { throw new CommandTimeout(); }).branchDiff(f.path).reason, 'timeout');
    assert.equal(f.collector.branchDiff(f.path, null, 0).reason, 'timeout');
    let time = 0, calls = 0;
    const collector = new GitCollector(f.context, undefined, (spec, options) => { calls++; assert.equal(options.timeoutMs, 2000); time += 2001; return runCommand(spec, options); }, () => time);
    assert.equal(collector.branchDiff(f.path).reason, 'timeout');
    assert.equal(calls, 1);
});
test('tests.runtime.test_branch_diff.BranchDiffTests.test_nul_filenames_and_rename_numstat_are_parsed', () => {
    assert.deepEqual(plain(numstat(Buffer.from('1\t2\tline\nfile\0-\t-\tbinary\0'))), { files: 2, added: 1, removed: 2 });
    assert.deepEqual(plain(numstat(Buffer.from('1\t0\t\0old\0new\0'))), { files: 1, added: 1, removed: 0 });
    assert.throws(() => numstat(Buffer.from('1\t0\t\0old')));
    assert.throws(() => numstat(Buffer.from('-\t2\tbad\0')));
});
test('tests.runtime.test_branch_diff.BranchDiffTests.test_shallow_clone_without_merge_base_is_unavailable', t => {
    const f = repository(t);
    fs.writeFileSync(join(f.path, 'text'), 'changed\n');
    f.commit();
    const clone = join(f.root, 'clone');
    git(f.root, 'clone', '-q', '--depth', '1', '--branch', 'feature', pathToFileURL(f.path).href, clone);
    assert.equal(f.collector.branchDiff(clone, git(f.path, 'rev-parse', 'main').trim()).value, null);
});
test('tests.rendering.test_statusline_git.GitIntegrationTests.test_real_status_counts_types_rename_both_and_nested_untracked', { skip: process.platform === 'win32' }, t => {
    const f = repository(t);
    for (const name of ['staged-type', 'unstaged-type', 'rename-old', 'both'])
        fs.writeFileSync(join(f.path, name), 'initial\n');
    f.commit();
    fs.unlinkSync(join(f.path, 'staged-type'));
    fs.symlinkSync('target', join(f.path, 'staged-type'));
    git(f.path, 'add', 'staged-type');
    fs.unlinkSync(join(f.path, 'unstaged-type'));
    fs.symlinkSync('target', join(f.path, 'unstaged-type'));
    git(f.path, 'mv', 'rename-old', 'rename-new');
    fs.writeFileSync(join(f.path, 'both'), 'staged\n');
    git(f.path, 'add', 'both');
    fs.appendFileSync(join(f.path, 'both'), 'unstaged\n');
    fs.mkdirSync(join(f.path, 'nested'));
    for (const name of ['nested/one.txt', 'nested/two.txt', 'root-untracked.txt'])
        fs.writeFileSync(join(f.path, name), 'new\n');
    const result = plain(f.collector.uncached(f.path));
    assert.equal(result.kind, 'ok');
    assert.deepEqual([result.staged, result.unstaged, result.conflicts, result.untracked], [3, 2, 0, 3]);
});
test('tests.rendering.test_statusline_git.GitIntegrationTests.test_real_submodule_dirty_state', t => {
    const f = repository(t), source = join(f.root, 'submodule-source');
    fs.mkdirSync(source);
    git(source, 'init', '-q', '-b', 'main');
    git(source, 'config', 'user.name', 'Test');
    git(source, 'config', 'user.email', 'test@example.invalid');
    git(source, 'config', 'commit.gpgsign', 'false');
    fs.writeFileSync(join(source, 'seed.txt'), 'initial\n');
    git(source, 'add', '.');
    git(source, 'commit', '-q', '-m', 'seed');
    git(f.path, '-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', source, 'vendor/lib');
    f.commit();
    fs.writeFileSync(join(f.path, 'vendor/lib/seed.txt'), 'changed\n');
    const result = plain(f.collector.uncached(f.path));
    assert.equal(result.kind, 'ok');
    assert.equal(result.unstaged, 1);
});
test('tests.rendering.test_statusline_git.GitIntegrationTests.test_real_divergence_gone_detached_unborn_and_worktree', t => {
    const f = repository(t), remote = join(f.root, 'remote.git');
    git(f.path, 'checkout', '-q', 'main');
    git(f.root, 'init', '-q', '--bare', '--initial-branch=main', remote);
    git(f.path, 'remote', 'add', 'origin', remote);
    git(f.path, 'push', '-q', '-u', 'origin', 'main');
    const peer = join(f.root, 'peer');
    git(f.root, 'clone', '-q', remote, peer);
    git(peer, 'config', 'user.name', 'Test');
    git(peer, 'config', 'user.email', 'test@example.invalid');
    git(peer, 'config', 'commit.gpgsign', 'false');
    git(peer, 'commit', '-q', '--allow-empty', '-m', 'remote commit');
    git(peer, 'push', '-q', 'origin', 'main');
    git(f.path, 'commit', '-q', '--allow-empty', '-m', 'local commit');
    git(f.path, 'fetch', '-q', 'origin');
    const diverged = plain(f.collector.uncached(f.path));
    assert.deepEqual([diverged.ahead, diverged.behind], [1, 1]);
    const worktree = join(f.root, 'linked-worktree');
    git(f.path, 'worktree', 'add', '-q', '-b', 'linked', worktree);
    assert.equal(f.collector.uncached(worktree).branch, 'linked');
    git(f.path, 'checkout', '-q', '--detach');
    assert.equal(f.collector.uncached(f.path).branch, 'HEAD@' + git(f.path, 'rev-parse', 'HEAD').trim().slice(0, 7));
    git(f.path, 'checkout', '-q', 'main');
    git(f.root, `--git-dir=${remote}`, 'update-ref', '-d', 'refs/heads/main');
    git(f.path, 'fetch', '-q', '--prune', 'origin');
    assert.equal(f.collector.uncached(f.path).upstream_gone, true);
    const unborn = join(f.root, 'unborn');
    fs.mkdirSync(unborn);
    git(unborn, 'init', '-q', '-b', 'newborn');
    const result = f.collector.uncached(unborn);
    assert.equal(result.branch, 'newborn');
    assert.equal(result.oid, null);
});
