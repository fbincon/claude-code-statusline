import { VERSION, REPOSITORY_URL } from '@fbincon/statusline-core/release';
import { NODE_RUNTIME_RANGE } from '@fbincon/statusline-core/node-runtime';
import { LANGUAGES } from '@fbincon/statusline-core/i18n/registry';
import { PROTOCOL_VERSION } from '@fbincon/statusline-core/contracts/ui';
import { PACKAGE_COMPATIBILITY } from '@fbincon/statusline-core/management/compatibility';
import * as fs from 'node:fs';
import { resolve, basename, dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { readTar, sha256, sums, verifyChecksums } from './files.js';
import { BUSINESS, NATIVE, TARGETS, identity, sourceFilename, channel, type Candidate } from './model.js';
export function verifyContents(entries: Map<string, Buffer>, commit: string) {
    const read = (name: string) => { const bytes = entries.get(name); if (!bytes) throw new Error('Missing candidate resource: ' + name); return JSON.parse(bytes.toString('utf8')); };
    const source = read('candidate.json') as Candidate, manifest = read('package.json');
    assert.match(commit, /^[a-f0-9]{40}$/u, 'Fixed source SHA required');
    assert.equal(source.commit, commit, 'Wrong source commit');
    assert.equal(source.schema_version, 1); assert.equal(source.dirty, false);
    const kind = channel(source.channel ?? 'candidate'), product = identity(commit, kind);
    assert(source.channel === undefined || source.channel === kind, 'Artifact channel must be canonical');
    assert.equal(source.name, product.name); assert.equal(manifest.name, product.name);
    assert.equal(source.version, product.version); assert.equal(manifest.version, source.version);
    assert.equal(manifest.private, product.private); assert.equal(manifest.scripts, undefined);
    assert.equal(manifest.devDependencies, undefined);
    assert.deepEqual(manifest.engines, { node: NODE_RUNTIME_RANGE });
    assert.deepEqual(manifest.statuslineCompatibility,PACKAGE_COMPATIBILITY);
    if (kind !== 'candidate') {
        assert.deepEqual(manifest.publishConfig, { registry: 'https://registry.npmjs.org/', access: 'public', tag: kind === 'stable' ? 'latest' : 'beta' });
        assert.deepEqual(manifest.repository, { type: 'git', url: 'git+' + REPOSITORY_URL + '.git' });
        assert.equal(manifest.bugs?.url, REPOSITORY_URL + '/issues');
        assert(entries.get('README.md')?.length, 'Missing npm installation guide');
    }
    assert.deepEqual(manifest.bin, { 'claude-statusline': 'bin/claude-statusline.js' });
    assert.equal(source.node, 'v24.21.0'); assert.equal(source.npm, '11.19.0'); assert.equal(source.typescript, '5.9.3');
    assert.equal(source.application_version, VERSION);
    assert.deepEqual(source.targets, TARGETS);
    const dependencies = [...BUSINESS.map(name => '@fbincon/statusline-' + name), 'koffi', 'lossless-json', ...NATIVE];
    assert.deepEqual([...manifest.bundleDependencies].sort(), [...dependencies].sort());
    assert.deepEqual(Object.keys({ ...manifest.dependencies, ...manifest.optionalDependencies }).sort(), [...dependencies].sort());
    for (const name of BUSINESS.map(short => '@fbincon/statusline-' + short)) assert.equal(manifest.dependencies[name], '0.0.0');
    assert.equal(manifest.dependencies.koffi, '3.3.3'); assert.equal(manifest.dependencies['lossless-json'], '4.3.1');
    for (const name of NATIVE) assert.equal(manifest.optionalDependencies[name], '3.3.3');
    assert.deepEqual(Object.keys(source.dependencies).sort(), ['koffi', 'lossless-json', ...NATIVE].sort());
    assert.match(source.source_manifest_sha256, /^[a-f0-9]{64}$/u);
    assert.equal(source.lock_sha256, source.source_hashes['package-lock.json']);
    assert.deepEqual(Object.keys(source.files).sort(), [...entries.keys()].filter(name => name !== 'candidate.json').sort(), 'Candidate inventory mismatch');
    for (const [name, hash] of Object.entries(source.files)) {
        assert.match(hash, /^[a-f0-9]{64}$/u); assert.equal(sha256(entries.get(name)!), hash, 'Changed candidate file: ' + name);
        if (/(?:^|\/)(?:\.git|\.env[^/]*|node_modules\/\.cache|test|tests|__pycache__|validation|archive|\.claude-plugin\/types)(?:\/|$)/u.test(name) || /\.(?:py|pyc|tsbuildinfo|log)$/u.test(name)) throw new Error('Forbidden candidate file: ' + name);
        if (!['bin/claude-statusline.js', 'package.json', ...(kind !== 'candidate' ? ['README.md'] : [])].includes(name) && !/^LICENSE[^/]*$/u.test(name) && !dependencies.some(dep => name.startsWith('node_modules/' + dep + '/'))) throw new Error('Unexpected candidate file: ' + name);
    }
    for (const name of ['LICENSE', 'LICENSE-Unicode.txt', 'LICENSE-Wcwidth.txt']) assert(entries.get(name)?.length, 'Missing license');
    for (const short of BUSINESS) {
        const name = '@fbincon/statusline-' + short, root = 'node_modules/' + name;
        assert.equal(read(root + '/package.json').name, name);
        assert([...entries.keys()].some(file => file.startsWith(root + '/dist/src/') && file.endsWith('.js')), 'Missing business package');
        for (const file of entries.keys()) if (file.startsWith(root + '/') && file !== root + '/package.json') {
            const path = file.slice(root.length + 1);
            const compiled = /^dist\/src\/.+\.(?:js|d\.ts)(?:\.map)?$/u.test(path);
            const language = short === 'core' && (path === 'resources/i18n/languages.json' || LANGUAGES.some(code => path === `resources/i18n/locales/${code}.json`));
            const cliResource = short === 'cli' && /^resources\/statusline-(?:native\/|runtime\/|config\/SKILL\.md$|configure\/SKILL\.md$)/u.test(path);
            assert(compiled || language || cliResource, 'Unexpected business resource: ' + path);
        }
    }
    assert(entries.has('node_modules/@fbincon/statusline-cli/dist/src/entry.js'));
    const languages = read('node_modules/@fbincon/statusline-core/resources/i18n/languages.json').map((row: any) => row.code);
    assert.deepEqual(languages, [...LANGUAGES]);
    for (const code of languages) assert(entries.has('node_modules/@fbincon/statusline-core/resources/i18n/locales/' + code + '.json'), 'Missing language pack');
    for (const name of ['statusline-native', 'statusline-runtime']) {
        const root = 'node_modules/@fbincon/statusline-cli/resources/' + name;
        const owned = read(root + '/resource-manifest.json');
        assert.equal(owned.backend_version, VERSION); assert.equal(owned.mod_version, VERSION);
        assert.equal(owned.protocol_version, name === 'statusline-native' ? PROTOCOL_VERSION : 3);
        assert.equal(read(root + '/.claude-plugin/plugin.json').version, VERSION);
        const mapping = owned.files;
        assert(mapping && typeof mapping === 'object', 'Missing ownership map');
        for (const [path, hash] of Object.entries(mapping)) assert.equal(sha256(entries.get(root + '/' + path) ?? Buffer.alloc(0)), hash, 'Missing/changed owned resource: ' + path);
        assert(entries.has(root + '/.claude-plugin/plugin.json'));
        assert.deepEqual([...entries.keys()].filter(file => file.startsWith(root + '/') && file !== root + '/resource-manifest.json').map(file => file.slice(root.length + 1)).sort(), Object.keys(mapping).sort(), 'Unowned Mod resource');
    }
    for (const name of ['statusline-configure', 'statusline-config']) assert(entries.has('node_modules/@fbincon/statusline-cli/resources/' + name + '/SKILL.md'));
    for (const name of NATIVE) {
        assert.equal(read('node_modules/' + name + '/package.json').version, '3.3.3');
        assert([...entries.keys()].some(file => file.startsWith('node_modules/' + name + '/') && file.endsWith('.node')), 'Missing native prebuild');
    }
    for (const [name, dependency] of Object.entries(source.dependencies)) {
        assert.match(dependency.integrity, /^sha512-[A-Za-z0-9+/]+=*$/u);
        assert.equal(read('node_modules/' + name + '/package.json').version, dependency.version);
        assert.deepEqual(Object.keys(dependency.files).sort(), [...entries.keys()].filter(path => path.startsWith('node_modules/' + name + '/')).map(path => path.slice(('node_modules/' + name + '/').length)).sort(), 'Incomplete dependency inventory');
        for (const [path, hash] of Object.entries(dependency.files)) assert.equal(source.files['node_modules/' + name + '/' + path], hash, 'Dependency digest differs');
    }
    return { source, entries: [...entries.keys()] };
}
export function verifyCandidate(path: string, commit: string, checksumFile = join(dirname(path), 'SHA256SUMS')) {
    const raw = fs.readFileSync(path), expected = sums(fs.readFileSync(checksumFile, 'utf8'))[basename(path)];
    if (!expected || sha256(raw) !== expected) throw new Error('Candidate checksum mismatch');
    return { tarball: resolve(path), sha256: expected, ...verifyContents(readTar(path), commit) };
}
export function verifyDelivery(path: string, commit: string) {
    const candidate = verifyCandidate(path, commit), directory = dirname(path), sourceName = sourceFilename(commit, candidate.source.channel ?? 'candidate');
    verifyChecksums(directory, [basename(path), sourceName, 'build-manifest.json']);
    const manifest = JSON.parse(fs.readFileSync(join(directory, 'build-manifest.json'), 'utf8'));
    assert.equal(manifest.commit, commit); assert.equal(manifest.candidate.file, basename(path));
    assert.equal(manifest.channel, candidate.source.channel ?? 'candidate'); assert.equal(manifest.candidate_version, candidate.source.version);
    assert.equal(manifest.candidate.sha256, candidate.sha256); assert.equal(manifest.source.file, sourceName);
    assert.equal(manifest.source.sha256, sha256(fs.readFileSync(join(directory, sourceName))));
    assert.equal(manifest.byte_identical, true); assert.equal(manifest.builds.length, 2);
    for (const round of manifest.builds) { assert.equal(round.sha256, candidate.sha256); assert.equal(round.bytes, fs.statSync(path).size); assert.match(round.node_sha256, /^[a-f0-9]{64}$/u); }
    const entries = readTar(join(directory, sourceName), 'statusline-source/'), raw = entries.get('.candidate-source.json');
    assert(raw); assert.equal(sha256(raw), candidate.source.source_manifest_sha256);
    const snapshot = JSON.parse(raw.toString()); assert.equal(snapshot.commit, commit);
    assert.deepEqual(Object.keys(snapshot.files).sort(), [...entries.keys()].filter(name => name !== '.candidate-source.json').sort());
    for (const [name, hash] of Object.entries(snapshot.files)) assert.equal(sha256(entries.get(name)!), hash, 'Source archive differs');
    return { ...candidate, sourceEntries: entries };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const { values } = parseArgs({ options: { artifact: { type: 'string' }, commit: { type: 'string' }, checksums: { type: 'string' }, report: { type: 'string' }, release: { type: 'boolean' } } });
    if (!values.artifact || !values.commit) throw new Error('Require --artifact TGZ --commit FULL_SHA [--checksums FILE]');
    const result = values.checksums ? verifyCandidate(resolve(values.artifact), values.commit, resolve(values.checksums)) : verifyDelivery(resolve(values.artifact), values.commit);
    if (values.release) assert(['preview', 'stable'].includes(result.source.channel ?? ''), 'A public release package is required');
    const report = { status: 'pass', commit: result.source.commit, tarball_sha256: result.sha256, files: result.entries.length, targets: result.source.targets };
    if (values.report) fs.writeFileSync(resolve(values.report), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
}
