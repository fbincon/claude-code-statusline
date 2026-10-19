import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import * as tar from 'tar';
import { CacheSnapshot, refreshGitCache } from '../installed-state.js';
import { benchmarkInstalled, commandSignature, summarize, verifyInstalled, verifyPair, INSTALLED_CASES } from '../installed.js';
import { sha256 } from '../../build/files.js';

test('installed benchmark restores the complete immutable index and removes later pages', t => {
    const root = fs.mkdtempSync(join(tmpdir(), 'installed benchmark '));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const runtime = join(root, 'runtime'), page = join(runtime, 'statusline_usage_v2', 'session');
    fs.mkdirSync(page, { recursive: true });
    fs.writeFileSync(join(runtime, 'statusline_usage_v2/state.json'), 'committed cursor');
    fs.writeFileSync(join(page, 'old.json'), 'committed page');
    const cache = new CacheSnapshot(runtime, join(root, 'snapshot'));
    cache.capture();
    fs.writeFileSync(join(page, 'new.json'), 'unreachable page');
    fs.writeFileSync(join(page, 'old.json'), 'modified page');
    fs.writeFileSync(join(runtime, 'statusline_usage_v2/state.json'), 'later cursor');
    cache.restore();
    assert.equal(fs.readFileSync(join(page, 'old.json'), 'utf8'), 'committed page');
    assert.equal(fs.existsSync(join(page, 'new.json')), false);
    assert.equal(fs.readFileSync(join(runtime, 'statusline_usage_v2/state.json'), 'utf8'), 'committed cursor');
    fs.rmSync(runtime, { recursive: true }); fs.mkdirSync(runtime);
    cache.capture(); cache.restore();
    assert.deepEqual(fs.readdirSync(runtime), []);
});

test('Git timestamp refresh preserves exact integer bytes and does not warm an expired case', t => {
    const root = fs.mkdtempSync(join(tmpdir(), 'installed git '));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    fs.mkdirSync(join(root, 'git_cache'));
    const path = join(root, 'git_cache', 'a'.repeat(64) + '.json');
    fs.writeFileSync(path, '{"checked_ns":1,"untouched":9007199254740993}');
    refreshGitCache(root, false);
    assert.match(fs.readFileSync(path, 'utf8'), /"checked_ns":\d{19},"untouched":9007199254740993/u);
    refreshGitCache(root, true);
    assert.equal(fs.readFileSync(path, 'utf8'), '{"checked_ns":0,"untouched":9007199254740993}');
});

test('benchmark summaries retain p95 outliers and peak RSS rather than heap or the last sample', () => {
    const rows = [1, 2, 3, 4, 100].map((ms, index) => ({ ms, peak_rss_bytes: index === 1 ? 99 : 10, output_sha256: 'same' }));
    assert.deepEqual(summarize(rows), { p50_ms: 3, p95_ms: 100, peak_rss_bytes: 99 });
});

test('paired comparison rejects output or collector regressions while permitting fewer internal I/O operations', () => {
    const row = (output_sha256: string, usage_calls = 1, reads = 100) => ({ case: 'render', diagnostic: {
        output_sha256, counts: { usage_calls, transcript_reads: 0, git_calls: 0, reads },
    } });
    verifyPair(row('same'), row('same', 1, 2));
    assert.throws(() => verifyPair(row('before'), row('different')), /output differs/u);
    assert.throws(() => verifyPair(row('same'), row('same', 2)), /Collector count/u);
});

test('command comparison normalizes backend version only and rejects lost hook state', t => {
    const root = fs.mkdtempSync(join(tmpdir(), 'installed signature '));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const response = (backend_version: string, accepted = 3) => JSON.stringify({ protocol_version: 2, result: { backend_version, accepted } });
    assert.equal(commandSignature('runtime', response('3.1.3'), root), commandSignature('runtime', response('3.1.4'), root));
    assert.notEqual(commandSignature('runtime', response('3.1.3'), root), commandSignature('runtime', response('3.1.4', 2), root));
    assert.throws(() => commandSignature('hook', '', root));
    fs.mkdirSync(join(root, 'turns')); fs.writeFileSync(join(root, 'turns/s.json'), '{"status":"running","prompt_id":"p"}');
    assert.equal(commandSignature('hook', '', root), sha256('{"records":1,"status":"running","prompt_id":"p"}'));
    assert.throws(() => commandSignature('hook', 'noise', root));
});

test('installed source verification rejects modified and unexpected runtime files', t => {
    const root = fs.mkdtempSync(join(tmpdir(), 'installed identity '));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    fs.writeFileSync(join(root, 'entry.js'), 'original');
    const artifact = { root, sha256: 'unused', commit: 'unused', version: 'unused', files: { 'entry.js': sha256('original') } };
    verifyInstalled(artifact);
    fs.writeFileSync(join(root, 'unexpected.js'), 'extra');
    assert.throws(() => verifyInstalled(artifact), /inventory/u);
    fs.rmSync(join(root, 'unexpected.js')); fs.writeFileSync(join(root, 'entry.js'), 'changed');
    assert.throws(() => verifyInstalled(artifact), /changed/u);
    assert.equal(INSTALLED_CASES.length, 36);
});

test('artifact mode measures the real installed bin in a fresh child without loading unused collectors', { skip: process.platform !== 'linux' }, t => {
    const root = fs.mkdtempSync(join(tmpdir(), 'installed entry with spaces '));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const source = join(root, 'package');
    fs.mkdirSync(source);
    const put = (name: string, value: string) => {
        const path = join(source, name);
        fs.mkdirSync(join(path, '..'), { recursive: true });
        fs.writeFileSync(path, value);
    };
    put('package.json', '{"type":"module","bin":{"claude-statusline":"bin/claude-statusline.js"}}');
    put('bin/claude-statusline.js', 'import { main } from "../node_modules/@fbincon/statusline-cli/dist/src/main.js"; await main(process.argv.slice(2), { stdout: text => process.stdout.write(text) });');
    for (const area of ['cli', 'core']) put(`node_modules/@fbincon/statusline-${area}/package.json`, '{"type":"module"}');
    put('node_modules/@fbincon/statusline-cli/dist/src/main.js', 'export async function main(args, env) { if (args.join() !== "render") throw new Error("wrong entry"); env.stdout("installed output\\n"); return 0; }');
    put('node_modules/@fbincon/statusline-cli/dist/src/runtime/usage.js', 'throw new Error("unused collector was loaded");');
    put('node_modules/@fbincon/statusline-core/dist/src/json-text.js', 'export const pythonJson = JSON.stringify;');
    const entries = fs.readdirSync(source, { recursive: true }).map(String).filter(name => fs.statSync(join(source, name)).isFile());
    put('candidate.json', JSON.stringify({ schema_version: 1, dirty: false, commit: 'a'.repeat(40), application_version: 'fixture',
        files: Object.fromEntries(entries.map(name => [name.replaceAll('\\', '/'), sha256(fs.readFileSync(join(source, name)))])) }));
    const artifact = join(root, 'artifact.tgz');
    tar.c({ cwd: root, file: artifact, gzip: true, sync: true }, ['package']);
    const report = benchmarkInstalled(artifact, join(root, 'output'), ['small'], 1, true, 'command/render-model');
    assert.equal(report.records.length, 1);
    assert.equal(report.records[0]!.samples[0]!.output_sha256, sha256('installed output\n'));
    assert(report.records[0]!.samples[0]!.peak_rss_bytes > 0);
    assert.equal(report.method.compile_cache, false);
});
