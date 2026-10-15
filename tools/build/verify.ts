import * as fs from 'node:fs';
import { resolve, basename, dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { readTar, sha256, sums } from './files.js';
import { BUSINESS, NATIVE, TARGETS, PACKAGE, version, type Candidate } from './model.js';
export function verifyContents(entries: Map<string, Buffer>, commit: string) {
    const read = (name: string) => { const bytes = entries.get(name); if (!bytes) throw new Error('Missing candidate resource: ' + name); return JSON.parse(bytes.toString('utf8')); };
    const source = read('candidate.json') as Candidate, manifest = read('package.json');
    assert.match(commit, /^[a-f0-9]{40}$/u, 'Fixed source SHA required');
    assert.equal(source.commit, commit, 'Wrong source commit');
    assert.equal(source.schema_version, 1); assert.equal(source.dirty, false);
    assert.equal(source.name, PACKAGE); assert.equal(manifest.name, PACKAGE);
    assert.equal(source.version, version(commit)); assert.equal(manifest.version, source.version);
    assert.equal(manifest.private, true); assert.equal(manifest.scripts, undefined);
    assert.equal(manifest.devDependencies, undefined);
    assert.deepEqual(manifest.bin, { 'claude-statusline': 'bin/claude-statusline.js' });
    assert.equal(source.node, 'v24.21.0'); assert.equal(source.npm, '11.19.0'); assert.equal(source.typescript, '5.9.3');
    assert.equal(source.application_version, '2.0.0');
    assert.deepEqual(source.targets, TARGETS);
    const dependencies = [...BUSINESS.map(name => '@fbincon/statusline-' + name), 'koffi', 'lossless-json', ...NATIVE];
    assert.deepEqual([...manifest.bundleDependencies].sort(), [...dependencies].sort());
    assert.deepEqual(Object.keys({ ...manifest.dependencies, ...manifest.optionalDependencies }).sort(), [...dependencies].sort());
    assert.deepEqual(Object.keys(source.files).sort(), [...entries.keys()].filter(name => name !== 'candidate.json').sort(), 'Candidate inventory mismatch');
    for (const [name, hash] of Object.entries(source.files)) {
        assert.match(hash, /^[a-f0-9]{64}$/u); assert.equal(sha256(entries.get(name)!), hash, 'Changed candidate file: ' + name);
        if (/(?:^|\/)(?:\.git|\.env[^/]*|node_modules\/\.cache|test|tests|__pycache__|validation|archive|\.claude-plugin\/types)(?:\/|$)/u.test(name) || /\.(?:py|pyc|tsbuildinfo|log)$/u.test(name)) throw new Error('Forbidden candidate file: ' + name);
        if (!['bin/claude-statusline.js', 'package.json'].includes(name) && !/^LICENSE[^/]*$/u.test(name) && !dependencies.some(dep => name.startsWith('node_modules/' + dep + '/'))) throw new Error('Unexpected candidate file: ' + name);
    }
    for (const name of ['LICENSE', 'LICENSE-Unicode.txt', 'LICENSE-Wcwidth.txt']) assert(entries.get(name)?.length, 'Missing license');
    for (const short of BUSINESS) {
        const name = '@fbincon/statusline-' + short, root = 'node_modules/' + name;
        assert.equal(read(root + '/package.json').name, name);
        assert([...entries.keys()].some(file => file.startsWith(root + '/dist/src/') && file.endsWith('.js')), 'Missing business package');
    }
    assert(entries.has('node_modules/@fbincon/statusline-cli/dist/src/entry.js'));
    for (const name of ['statusline-native', 'statusline-runtime']) {
        const root = 'node_modules/@fbincon/statusline-cli/resources/' + name;
        const owned = read(root + '/resource-manifest.json');
        const mapping = owned.files;
        assert(mapping && typeof mapping === 'object', 'Missing ownership map');
        for (const [path, hash] of Object.entries(mapping)) assert.equal(sha256(entries.get(root + '/' + path) ?? Buffer.alloc(0)), hash, 'Missing/changed owned resource: ' + path);
        assert(entries.has(root + '/.claude-plugin/plugin.json'));
    }
    for (const name of ['statusline-configure', 'statusline-config']) assert(entries.has('node_modules/@fbincon/statusline-cli/resources/' + name + '/SKILL.md'));
    for (const name of NATIVE) {
        assert.equal(read('node_modules/' + name + '/package.json').version, '3.3.3');
        assert([...entries.keys()].some(file => file.startsWith('node_modules/' + name + '/') && file.endsWith('.node')), 'Missing native prebuild');
    }
    for (const [name, dependency] of Object.entries(source.dependencies)) {
        assert.match(dependency.integrity, /^sha512-[A-Za-z0-9+/]+=*$/u);
        assert.equal(read('node_modules/' + name + '/package.json').version, dependency.version);
        for (const [path, hash] of Object.entries(dependency.files)) assert.equal(source.files['node_modules/' + name + '/' + path], hash, 'Dependency digest differs');
    }
    return { source, entries: [...entries.keys()] };
}
export function verifyCandidate(path: string, commit: string, checksumFile = join(dirname(path), 'SHA256SUMS')) {
    const raw = fs.readFileSync(path), expected = sums(fs.readFileSync(checksumFile, 'utf8'))[basename(path)];
    if (!expected || sha256(raw) !== expected) throw new Error('Candidate checksum mismatch');
    return { tarball: resolve(path), sha256: expected, ...verifyContents(readTar(path), commit) };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const { values } = parseArgs({ options: { artifact: { type: 'string' }, commit: { type: 'string' }, checksums: { type: 'string' }, report: { type: 'string' } } });
    if (!values.artifact || !values.commit) throw new Error('Require --artifact TGZ --commit FULL_SHA [--checksums FILE]');
    const result = verifyCandidate(resolve(values.artifact), values.commit, values.checksums && resolve(values.checksums));
    const report = { status: 'pass', commit: result.source.commit, tarball_sha256: result.sha256, files: result.entries.length, targets: result.source.targets };
    if (values.report) fs.writeFileSync(resolve(values.report), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
}
