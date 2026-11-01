import { LANGUAGES } from '@fbincon/statusline-core/i18n/registry';
import { NODE_RUNTIME_RANGE } from '@fbincon/statusline-core/node-runtime';
import { PROTOCOL_VERSION } from '@fbincon/statusline-core/contracts/ui';
import { PACKAGE_COMPATIBILITY } from '@fbincon/statusline-core/management/compatibility';
import { VERSION, REPOSITORY_URL } from '@fbincon/statusline-core/release';
import * as fs from 'node:fs';
import { join } from 'node:path';
import * as tar from 'tar';
import { extractFiles, sha256 } from '../../files.js';
import { BUSINESS, NATIVE, TARGETS, identity, publicChannel, sourceFilename, type Channel } from '../../model.js';
import { analyze } from '../../../generation/i18n/analysis.js';

export function candidateEntries(kind: Channel = 'candidate', commit = 'a'.repeat(40)) {
    const entries = new Map<string, Buffer>(), put = (name: string, value: unknown) => entries.set(name, Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)));
    for (const name of ['LICENSE', 'LICENSE-Unicode.txt', 'LICENSE-Wcwidth.txt', 'bin/claude-statusline.js']) put(name, 'fixture');
    const business = BUSINESS.map(name => '@fbincon/statusline-' + name), dependencies = { ...Object.fromEntries(business.map(name => [name, '0.0.0'])), koffi: '3.3.3', 'lossless-json': '4.3.1' };
    put('package.json', { ...identity(commit, kind), ...(kind !== 'candidate' ? { publishConfig: { registry: 'https://registry.npmjs.org/', access: 'public', tag: kind === 'stable' ? 'latest' : 'beta' }, repository: { type: 'git', url: 'git+' + REPOSITORY_URL + '.git' }, bugs: { url: REPOSITORY_URL + '/issues' } } : {}), engines: { node: NODE_RUNTIME_RANGE }, statuslineCompatibility: PACKAGE_COMPATIBILITY, bin: { 'claude-statusline': 'bin/claude-statusline.js' }, dependencies, optionalDependencies: Object.fromEntries(NATIVE.map(name => [name, '3.3.3'])), bundleDependencies: [...Object.keys(dependencies), ...NATIVE] });
    for (const name of business) { put(`node_modules/${name}/package.json`, { name, version: '0.0.0' }); put(`node_modules/${name}/dist/src/entry.js`, 'export {};'); }
    const languages = LANGUAGES;
    put('node_modules/@fbincon/statusline-core/resources/i18n/languages.json', languages.map(code => ({ code })));
    for (const code of languages) put(`node_modules/@fbincon/statusline-core/resources/i18n/locales/${code}.json`, { example: code });
    for (const name of ['statusline-native', 'statusline-runtime']) {
        const root = 'node_modules/@fbincon/statusline-cli/resources/' + name;
        put(root + '/.claude-plugin/plugin.json', { name, version: VERSION });
        put(root + '/resource-manifest.json', { backend_version: VERSION, mod_version: VERSION, protocol_version: name === 'statusline-native' ? PROTOCOL_VERSION : 3, files: { '.claude-plugin/plugin.json': sha256(entries.get(root + '/.claude-plugin/plugin.json')!) } });
    }
    for (const name of ['statusline-config', 'statusline-configure']) put(`node_modules/@fbincon/statusline-cli/resources/${name}/SKILL.md`, 'template');
    const external: Record<string, any> = {};
    for (const name of ['koffi', 'lossless-json', ...NATIVE]) {
        put(`node_modules/${name}/package.json`, { name, version: name === 'lossless-json' ? '4.3.1' : '3.3.3' });
        if (NATIVE.includes(name)) put(`node_modules/${name}/koffi.node`, 'test-only native placeholder');
        external[name] = { version: name === 'lossless-json' ? '4.3.1' : '3.3.3', integrity: 'sha512-AAAA', files: Object.fromEntries([...entries].filter(([path]) => path.startsWith('node_modules/' + name + '/')).map(([path, raw]) => [path.slice(('node_modules/' + name + '/').length), sha256(raw)])) };
    }
    if (kind !== 'candidate') put('README.md', 'Preview installation');
    put('candidate.json', { schema_version: 1, channel: kind, name: identity(commit, kind).name, version: identity(commit, kind).version, application_version: VERSION, commit, dirty: false, node: 'v24.21.0', npm: '11.19.0', typescript: '5.9.3', lock_sha256: 'b'.repeat(64), source_manifest_sha256: 'c'.repeat(64), source_hashes: { 'package-lock.json': 'b'.repeat(64) }, targets: TARGETS, dependencies: external, files: Object.fromEntries([...entries].map(([path, raw]) => [path, sha256(raw)])) });
    return entries;
}

/** Materialize both archives and checksums consumed by the real compiled evidence issuer. */
export function writeDelivery(root: string, directory: string, commit: string, source: Map<string, Buffer>): Record<string, string> {
    fs.mkdirSync(directory, { recursive: true });
    const channel = publicChannel(), filename = `fbincon-claude-code-statusline-${VERSION}.tgz`;
    const archive = sourceFilename(commit, channel);
    const hashes = (entries: Map<string, Buffer>) => Object.fromEntries([...entries].map(([name, bytes]) => [name, sha256(bytes)]));
    const json = (value: unknown) => Buffer.from(JSON.stringify(value));
    const pack = (prefix: string, name: string, entries: Map<string, Buffer>) => {
        const cwd = join(root, prefix);
        extractFiles(entries, cwd);
        tar.c({ cwd, file: join(directory, name), prefix, gzip: true, sync: true, noDirRecurse: true }, [...entries.keys()]);
        return sha256(fs.readFileSync(join(directory, name)));
    };
    const entries = candidateEntries(channel, commit), candidate = JSON.parse(entries.get('candidate.json')!.toString());
    entries.delete('candidate.json');
    for (const [code, messages] of Object.entries(analyze(source).effective))
        entries.set('node_modules/@fbincon/statusline-core/resources/i18n/locales/' + code + '.json', json(messages));
    const snapshot = json({ commit, files: hashes(source) });
    entries.set('candidate.json', json({ ...candidate, source_manifest_sha256: sha256(snapshot),
        source_hashes: hashes(source), lock_sha256: sha256(source.get('package-lock.json')!), files: hashes(entries) }));
    const tarball = pack('package', filename, entries);
    const archiveHash = pack('statusline-source', archive, new Map(source).set('.candidate-source.json', snapshot));
    const build = { sha256: tarball, bytes: fs.statSync(join(directory, filename)).size, node_sha256: sha256('fixture-node') };
    const manifest = json({ commit, channel, candidate_version: VERSION, candidate: { file: filename, sha256: tarball },
        source: { file: archive, sha256: archiveHash }, byte_identical: true, builds: [build, build] });
    fs.writeFileSync(join(directory, 'build-manifest.json'), manifest);
    const delivery = { [filename]: tarball, [archive]: archiveHash, 'build-manifest.json': sha256(manifest) };
    const sums = Object.entries(delivery).map(([name, hash]) => hash + '  ' + name + '\n').join('');
    fs.writeFileSync(join(directory, 'SHA256SUMS'), sums);
    return { ...delivery, SHA256SUMS: sha256(sums) };
}
