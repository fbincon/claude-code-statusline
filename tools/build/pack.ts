import * as fs from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { NATIVE as EDITOR, RUNTIME, VERSION } from '@fbincon/statusline-cli/integration/model';
import { bundledFiles } from '@fbincon/statusline-cli/integration/resources';
import { repoRoot, sourceHashes } from '../migration/ts-03/common.js';
import { files, sha256, npmEntry, readTar, extractFiles } from './files.js';
import { BUSINESS, NATIVE, TARGETS, PACKAGE, version, type Candidate } from './model.js';
import { verifyContents } from './verify.js';

export function runtimeFile(name: string, path: string): boolean {
    if (name.startsWith('@koromix/')) return true;
    if (name === 'lossless-json') return path === 'package.json' || /^(?:LICENSE|README)/u.test(path) || path.startsWith('lib/') && !/\.test\./u.test(path);
    if (name === 'koffi') return ['package.json', 'LICENSE.txt', 'README.md', 'index.js', 'index.cjs', 'index.d.ts', 'indirect.js', 'indirect.cjs',
        'src/koffi/index.js', 'src/koffi/index.cjs', 'src/koffi/indirect.js', 'src/koffi/indirect.cjs', 'src/koffi/src/static.js', 'src/koffi/src/static.cjs'].includes(path);
    return false;
}
export async function dependency(name: string, lock: any, destination: string, temporary: string) {
    const record = lock.packages['node_modules/' + name];
    if (!record || !/^https:\/\/registry\.npmjs\.org\//u.test(record.resolved) || !/^sha512-/u.test(record.integrity)) throw new Error('Missing locked registry dependency: ' + name);
    const response = await fetch(record.resolved, { signal: AbortSignal.timeout(60000), redirect: 'error' });
    if (!response.ok) throw new Error('Locked dependency download failed: ' + name + ' HTTP ' + response.status);
    const raw = Buffer.from(await response.arrayBuffer());
    if ('sha512-' + createHash('sha512').update(raw).digest('base64') !== record.integrity) throw new Error('Dependency integrity failure: ' + name);
    const archive = join(temporary, name.replaceAll('/', '-') + '.tgz'); fs.writeFileSync(archive, raw);
    const entries = readTar(archive), manifest = JSON.parse(entries.get('package.json')!.toString());
    if (manifest.name !== name || manifest.version !== record.version) throw new Error('Unexpected locked dependency identity');
    const selected = new Map([...entries].filter(([path]) => runtimeFile(name, path)));
    extractFiles(selected, destination);
    return { version: record.version as string, integrity: record.integrity as string,
        files: Object.fromEntries([...selected].sort(([a], [b]) => a < b ? -1 : 1).map(([path, bytes]) => [path, sha256(bytes)])) };
}
export async function packCandidate(destination: string, commit: string) {
    const temporary = fs.mkdtempSync(join(tmpdir(), 'ts05 package ')), stage = join(temporary, 'package');
    fs.mkdirSync(stage); fs.mkdirSync(destination, { recursive: true });
    try {
        const sourceBytes = fs.readFileSync(join(repoRoot, '.candidate-source.json')), snapshot = JSON.parse(sourceBytes.toString());
        if (snapshot.commit !== commit) throw new Error('Build does not match exported source');
        for (const [name, hash] of Object.entries(snapshot.files)) if (sha256(fs.readFileSync(join(repoRoot, name))) !== hash) throw new Error('Source changed before candidate packaging: ' + name);
        const lockBytes = fs.readFileSync(join(repoRoot, 'package-lock.json')), lock = JSON.parse(lockBytes.toString());
        const npm = execFileSync(process.execPath, [npmEntry(), '--version'], { encoding: 'utf8' }).trim();
        if (process.version !== 'v24.21.0' || npm !== '11.19.0' || lock.packages['node_modules/typescript'].version !== '5.9.3') throw new Error('Unexpected build runtime');
        for (const short of BUSINESS) {
            const source = join(repoRoot, 'packages', short), target = join(stage, 'node_modules/@fbincon/statusline-' + short);
            fs.mkdirSync(join(target, 'dist'), { recursive: true });
            fs.cpSync(join(source, 'dist/src'), join(target, 'dist/src'), { recursive: true });
            fs.copyFileSync(join(source, 'package.json'), join(target, 'package.json'));
            if (fs.existsSync(join(source, 'resources'))) fs.cpSync(join(source, 'resources'), join(target, 'resources'), { recursive: true });
        }
        const dependencies: Candidate['dependencies'] = {};
        for (const name of ['koffi', 'lossless-json', ...NATIVE]) dependencies[name] = await dependency(name, lock, join(stage, 'node_modules', name), temporary);
        for (const spec of [EDITOR, RUNTIME]) for (const [name, raw] of bundledFiles(spec).files) {
            const path = join(stage, 'node_modules/@fbincon/statusline-cli/resources', spec.name, name);
            fs.mkdirSync(dirname(path), { recursive: true }); fs.writeFileSync(path, raw);
        }
        fs.mkdirSync(join(stage, 'bin'));
        fs.writeFileSync(join(stage, 'bin/claude-statusline.js'), '#!/usr/bin/env node\nimport "../node_modules/@fbincon/statusline-cli/dist/src/entry.js";\n', { mode: 0o755 });
        const business = BUSINESS.map(short => '@fbincon/statusline-' + short);
        const manifest = { name: PACKAGE, version: version(commit), private: true, type: 'module', description: 'TS-05 engineering candidate; public delivery belongs to TS-06', license: 'MIT AND Unicode-3.0', engines: { node: '>=24.21.0 <25' },
            bin: { 'claude-statusline': 'bin/claude-statusline.js' }, dependencies: { ...Object.fromEntries(business.map(name => [name, '0.0.0'])), koffi: '3.3.3', 'lossless-json': '4.3.1' },
            optionalDependencies: Object.fromEntries(NATIVE.map(name => [name, '3.3.3'])), bundleDependencies: [...business, 'koffi', 'lossless-json', ...NATIVE], files: ['bin', 'candidate.json', 'LICENSE*'] };
        fs.writeFileSync(join(stage, 'package.json'), JSON.stringify(manifest, null, 2) + '\n');
        for (const name of ['LICENSE']) fs.copyFileSync(join(repoRoot, name), join(stage, name));
        fs.copyFileSync(join(repoRoot, 'tools/unicode/UNICODE-LICENSE.txt'), join(stage, 'LICENSE-Unicode.txt'));
        fs.copyFileSync(join(repoRoot, 'tools/unicode/WCWIDTH-LICENSE.txt'), join(stage, 'LICENSE-Wcwidth.txt'));
        // npm determines bundled package contents; verify that it did not omit any staged runtime file.
        const pack = (dry = false) => JSON.parse(execFileSync(process.execPath, [npmEntry(), 'pack', '--offline', '--ignore-scripts', '--json', '--pack-destination', resolve(destination), ...(dry ? ['--dry-run'] : [])], { cwd: stage, encoding: 'utf8', timeout: 120000, maxBuffer: 16 * 1024 * 1024 }))[0];
        const intended = files(stage), listed: string[] = pack(true).files.map((row: any) => row.path);
        if (JSON.stringify([...listed].sort()) !== JSON.stringify([...intended].sort())) throw new Error('npm omitted staged runtime files: ' + intended.filter(name => !listed.includes(name)).join(', '));
        const source: Candidate = { schema_version: 1, name: PACKAGE, version: version(commit), application_version: VERSION, commit, dirty: false, node: process.version, npm, typescript: '5.9.3',
            lock_sha256: sha256(lockBytes), source_manifest_sha256: sha256(sourceBytes), source_hashes: sourceHashes(), targets: TARGETS, dependencies,
            files: Object.fromEntries([...listed].sort().map(name => [name, sha256(fs.readFileSync(join(stage, name)))])) };
        fs.writeFileSync(join(stage, 'candidate.json'), JSON.stringify(source, null, 2) + '\n');
        const result = pack(), tarball = join(destination, result.filename);
        const checked = verifyContents(readTar(tarball), commit);
        return { tarball, sha256: sha256(fs.readFileSync(tarball)), ...checked };
    } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const { values } = parseArgs({ options: { output: { type: 'string' }, commit: { type: 'string' } } });
    if (!values.output || !values.commit) throw new Error('Internal pack worker requires --output and --commit');
    const result = await packCandidate(resolve(values.output), values.commit);
    console.log(JSON.stringify({ tarball: result.tarball, sha256: result.sha256, files: result.entries.length }));
}
