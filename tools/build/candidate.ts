import * as fs from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import * as tar from 'tar';
import { repoRoot } from '../migration/ts-03/common.js';
import { files, sha256, npmEntry, readTar, extractFiles } from './files.js';
import { identity, sourceFilename, channel, type Channel } from './model.js';
import { verifyCandidate } from './verify.js';

/** Check exported bytes against Git's independent blob identities before making a manifest. */
export function verifyGitSource(entries: ReadonlyMap<string, Buffer>, tree: string): void {
    assert(tree.endsWith('\0'), 'Incomplete Git source inventory');
    assert(!entries.has('.candidate-source.json'), 'Reserved source manifest is tracked');
    const expected = new Map<string, string>();
    for (const row of tree.slice(0, -1).split('\0')) {
        const separator = row.indexOf('\t'), header = row.slice(0, separator), name = row.slice(separator + 1);
        const match = /^(100644|100755) blob ([a-f0-9]{40})$/u.exec(header);
        assert(separator > 0 && match && name && !expected.has(name), 'Unsupported or duplicate Git source entry');
        expected.set(name, match[2]!);
    }
    assert.deepEqual([...entries.keys()].sort(), [...expected.keys()].sort(), 'Git source inventory differs');
    for (const [name, object] of expected) {
        const bytes = entries.get(name)!;
        const actual = createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
        assert.equal(actual, object, 'Git source bytes differ: ' + name);
    }
}

export async function buildCandidate(commit: string, output: string, sourceArchive?: string, kind: Channel = 'candidate') {
    const product = identity(commit, kind);
    if (!/^[a-f0-9]{40}$/u.test(commit)) throw new Error('Use an immutable full 40-character commit SHA');
    if (fs.existsSync(output)) throw new Error('Candidate output directory must be new');
    const temporary = fs.mkdtempSync(join(tmpdir(), 'ts05 independent builds '));
    fs.mkdirSync(output, { recursive: true });
    const started = new Date().toISOString(), builds: any[] = [];
    try {
        let original: Map<string, Buffer>;
        if (sourceArchive) original = readTar(sourceArchive, 'statusline-source/');
        else {
            const archive = join(temporary, 'source.tar');
            execFileSync('git', ['archive', '--format=tar', '--prefix=statusline-source/', '--output=' + archive, commit], { cwd: repoRoot, timeout: 60000 });
            original = readTar(archive, 'statusline-source/');
            const tree = execFileSync('git', ['ls-tree', '-rz', '--full-tree', commit], { cwd: repoRoot, encoding: 'utf8', timeout: 60000, maxBuffer: 16 * 1024 * 1024 });
            verifyGitSource(original, tree);
            original.set('.candidate-source.json', Buffer.from(JSON.stringify({ schema_version: 1, commit, files: Object.fromEntries([...original].map(([name, bytes]) => [name, sha256(bytes)]).sort(([a], [b]) => a! < b! ? -1 : 1)) }, null, 2) + '\n'));
        }
        const source = JSON.parse(original.get('.candidate-source.json')?.toString() ?? '{}');
        if (source.commit !== commit || source.schema_version !== 1) throw new Error('Source archive identity differs');
        if (JSON.stringify(Object.keys(source.files).sort()) !== JSON.stringify([...original.keys()].filter(name => name !== '.candidate-source.json').sort())) throw new Error('Source archive inventory differs');
        for (const [name, hash] of Object.entries(source.files)) if (sha256(original.get(name)!) !== hash) throw new Error('Source archive hash mismatch');
        const sourceName = sourceFilename(commit, kind), sourceRoot = join(temporary, 'source');
        fs.mkdirSync(sourceRoot); extractFiles(original, sourceRoot);
        tar.c({ cwd: sourceRoot, file: join(output, sourceName), sync: true, gzip: true, portable: true, noMtime: true, prefix: 'statusline-source', noDirRecurse: true }, files(sourceRoot));
        for (const round of [1, 2]) {
            const root = join(temporary, 'clean-' + round), artifacts = join(temporary, 'artifacts-' + round), cache = join(temporary, 'empty-npm-cache-' + round);
            fs.mkdirSync(root); fs.mkdirSync(artifacts); extractFiles(original, root);
            const env = { ...process.env, npm_config_cache: cache, npm_config_audit: 'false', npm_config_fund: 'false', TZ: 'UTC', NODE_DISABLE_COMPILE_CACHE: '1' };
            const run = (args: string[]) => execFileSync(process.execPath, args, { cwd: root, env, encoding: 'utf8', timeout: 600000, maxBuffer: 16 * 1024 * 1024 });
            const log = run([npmEntry(), 'ci', '--ignore-scripts', '--no-audit', '--no-fund']) + run([npmEntry(), 'run', 'build']) + run(['dist/typescript/tools/generation/resources.js', '--check']);
            fs.writeFileSync(join(output, `build-${round}.log`), log);
            const result = JSON.parse(run(['dist/typescript/tools/build/pack.js', '--output', artifacts, '--commit', commit, '--channel', kind]).trim());
            const bytes = fs.readFileSync(result.tarball);
            if (round === 1) fs.copyFileSync(result.tarball, join(output, basename(result.tarball)));
            else if (!bytes.equals(fs.readFileSync(join(output, basename(result.tarball))))) throw new Error('Independent builds differ byte for byte');
            builds.push({ round, sha256: sha256(bytes), bytes: bytes.length, node_sha256: sha256(fs.readFileSync(process.execPath)) });
        }
        const artifact = fs.readdirSync(output).find(name => name === product.name.replace('@', '').replace('/', '-') + '-' + product.version + '.tgz' && name.endsWith('.tgz'))!;
        const manifest = { schema_version: 1, commit, channel: kind, candidate_version: product.version, candidate: { file: artifact, sha256: builds[0].sha256 }, source: { file: sourceName, sha256: sha256(fs.readFileSync(join(output, sourceName))) }, byte_identical: true, builds };
        fs.writeFileSync(join(output, 'build-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
        const named = [artifact, sourceName, 'build-manifest.json'];
        fs.writeFileSync(join(output, 'SHA256SUMS'), named.map(name => sha256(fs.readFileSync(join(output, name))) + '  ' + name).join('\n') + '\n');
        verifyCandidate(join(output, artifact), commit);
        fs.writeFileSync(join(output, 'build-report.json'), JSON.stringify({ status: 'pass', started, finished: new Date().toISOString(), source_directory: repoRoot, temporary_directory: temporary, node_path: process.execPath, ...manifest }, null, 2) + '\n');
        return manifest;
    } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const { values } = parseArgs({ options: { commit: { type: 'string' }, output: { type: 'string' }, source: { type: 'string' }, channel: { type: 'string', default: 'candidate' } } });
    if (!values.commit || !values.output) throw new Error('Usage: candidate:build -- --commit FULL_SHA --output NEW_DIRECTORY [--source SOURCE_TGZ]');
    console.log(JSON.stringify(await buildCandidate(values.commit, resolve(values.output), values.source && resolve(values.source), channel(values.channel))));
}
