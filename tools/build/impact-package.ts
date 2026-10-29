/** Build actual exported inputs; compare runtime members without relabeling either package. */
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import * as tar from 'tar';
import { canonical, emitted, hash, git, messageShape } from '../checks/impact-content.ts';
import { extractFiles, readTar, npmEntry } from './files.ts';

export interface PackageComparison { schema_version: 1; kind: 'package-comparison'; base: string; head: string; base_sha256: string; head_sha256: string; equivalent: boolean; changed_members: string[] }
function projection(entries: ReadonlyMap<string, Buffer>): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [name, raw] of entries) {
        if (['candidate.json', 'README.md', 'LICENSE', 'LICENSE-Unicode.txt', 'LICENSE-Wcwidth.txt'].includes(name) ||
            /^node_modules\/@fbincon\/statusline-[^/]+\/dist\/src\/.*\.(?:js\.map|d\.ts)$/u.test(name)) continue;
        let value: unknown = hash(raw);
        if (/\/resources\/i18n\/locales\/[^/]+\.json$/u.test(name)) value = messageShape(raw);
        else if (name.endsWith('/resource-manifest.json')) {
            const item = JSON.parse(raw.toString());
            value = { ...item, backend_version: '<version>', mod_version: '<version>', files: Object.keys(item.files).sort() };
            for (const [path, digest] of Object.entries(item.files)) assert.equal(hash(entries.get(dirname(name) + '/' + path)!), digest);
        } else if (name === 'package.json' || name.endsWith('/.claude-plugin/plugin.json')) {
            const item = JSON.parse(raw.toString()); value = { ...item, version: '<version>' };
        } else if (/\.(?:js|ts)$/u.test(name)) {
            // Translation modules have separately checked canonical inputs and
            // generated output. Bind their non-message code as well as key shape.
            let text = raw.toString('utf8');
            if (/\/(?:i18n\/(?:generated-locales|locales\/[^/]+|statusline\/[^/]+))\.(?:js|ts)$/u.test(name)) {
                text = text.replace(/((?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\s*:\s*)("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/gu, (_all, prefix: string, literal: string) => {
                    const placeholders = [...literal.matchAll(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/gu)].map(item => item[1]).sort();
                    return prefix + JSON.stringify('<message:' + placeholders.join(',') + '>');
                });
            }
            value = emitted(text, name.endsWith('/editor/themes.js') || name.endsWith('/editor/themes.ts'), name.endsWith('/src/release.js'));
        }
        result[name] = hash(typeof value === 'string' ? value : canonical(value));
    }
    return result;
}
export function comparePackages(base: string, head: string, before: string, after: string): PackageComparison {
    const first = fs.readFileSync(before), second = fs.readFileSync(after), leftEntries = readTar(before), rightEntries = readTar(after);
    for (const [entries, commit] of [[leftEntries, base], [rightEntries, head]] as const) {
        const identity = JSON.parse(entries.get('candidate.json')!.toString()); assert.equal(identity.commit, commit);
        assert.deepEqual(Object.keys(identity.files).sort(), [...entries.keys()].filter(name => name !== 'candidate.json').sort());
        for (const [name, digest] of Object.entries(identity.files)) assert.equal(hash(entries.get(name)!), digest);
    }
    function modes(path: string, projected: Record<string, string>) {
        tar.t({ file: path, sync: true, strict: true, onReadEntry(entry) {
            const name = entry.path.slice('package/'.length);
            if (entry.type === 'File' && Object.hasOwn(projected, name)) { assert.equal(typeof entry.mode, 'number'); projected[name] = hash(canonical({ content: projected[name], mode: entry.mode! & 0o777 })); }
        } });
        return projected;
    }
    const left = modes(before, projection(leftEntries)), right = modes(after, projection(rightEntries));
    const changed = [...new Set([...Object.keys(left), ...Object.keys(right)])].filter(name => left[name] !== right[name]).sort();
    return { schema_version: 1, kind: 'package-comparison', base, head, base_sha256: hash(first), head_sha256: hash(second), equivalent: changed.length === 0, changed_members: changed };
}
export function buildComparisonPackage(commit: string, output: string): string {
    assert.match(commit, /^[a-f0-9]{40}$/u); assert(!fs.existsSync(output), 'Use a new package comparison directory');
    const root = fs.mkdtempSync(join(tmpdir(), 'impact-build-'));
    try {
        const archive = join(root, 'source.tar'), checkout = join(root, 'source');
        execFileSync('git', ['archive', '--format=tar', '--prefix=statusline-source/', '--output=' + archive, commit]);
        const entries = readTar(archive, 'statusline-source/'); extractFiles(entries, checkout);
        const snapshot = { schema_version: 1, commit, files: Object.fromEntries([...entries].map(([name, bytes]) => [name, hash(bytes)]).sort(([a], [b]) => a!.localeCompare(b!, 'en'))) };
        fs.writeFileSync(join(checkout, '.candidate-source.json'), JSON.stringify(snapshot, null, 2) + '\n');
        fs.mkdirSync(output, { recursive: true });
        const env = { ...process.env, npm_config_cache: join(root, 'cache'), npm_config_audit: 'false', npm_config_fund: 'false', TZ: 'UTC', NODE_DISABLE_COMPILE_CACHE: '1' };
        const run = (args: string[]) => execFileSync(process.execPath, args, { cwd: checkout, env, encoding: 'utf8', timeout: 600000, maxBuffer: 16 * 1024 * 1024 });
        const log = run([npmEntry(), 'ci', '--ignore-scripts', '--no-audit', '--no-fund']) + run([npmEntry(), 'run', 'build']) + run(['dist/typescript/tools/generation/resources.js', '--check']);
        fs.writeFileSync(join(output, 'build.log'), log);
        const packed = JSON.parse(run(['dist/typescript/tools/build/pack.js', '--output', output, '--commit', commit, '--channel', 'public']).trim());
        fs.writeFileSync(join(output, 'SHA256SUMS'), hash(fs.readFileSync(packed.tarball)) + '  ' + packed.tarball.split(/[\\/]/u).at(-1) + '\n');
        assert.equal(git('rev-parse', commit + '^{commit}'), commit);
        return packed.tarball;
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
