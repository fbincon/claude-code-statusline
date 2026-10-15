import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256 } from '@fbincon/statusline-platform/hash';
export const repoRoot = fileURLToPath(new URL('../../../../../', import.meta.url));
export const fixtures = join(repoRoot, 'tests/fixtures/migration/ts-01');
export const reference = '9b6d2fab4bf165be280d428a874521bfbf02c7e1';
export const python = process.env.TS03_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
export function checkBaseline(): void {
    const bytes = readFileSync(join(fixtures, 'lock.json'));
    if (sha256(bytes) !== 'a701f70744de7fbc9ffe7c8122fcf4383e690ab052bf7b421008b3c523227bfc')
        throw new Error('Frozen replay lock changed');
    const lock = JSON.parse(bytes.toString('utf8'));
    if (lock.reference_commit !== reference)
        throw new Error('Reference changed');
    for (const [name, hash] of Object.entries(lock.fixtures)) {
        if (sha256(readFileSync(join(fixtures, name))) !== hash)
            throw new Error(`Frozen fixture changed: ${name}`);
    }
    for (const [name, hash] of Object.entries(lock.harness)) {
        if (sha256(readFileSync(join(repoRoot, name))) !== hash)
            throw new Error(`Frozen adapter changed: ${name}`);
    }
}
export function exportReference(): string {
    checkBaseline();
    const directory = mkdtempSync(join(tmpdir(), 'statusline-reference-'));
    try {
        const paths = execFileSync('git', ['ls-tree', '-r', '--name-only', reference, '--', 'src'], { cwd: repoRoot, encoding: 'utf8' }).trim().split('\n');
        for (const path of paths) {
            const bytes = execFileSync('git', ['cat-file', 'blob', `${reference}:${path}`], { cwd: repoRoot, maxBuffer: 8 * 1024 * 1024 });
            const output = join(directory, path);
            mkdirSync(dirname(output), { recursive: true });
            writeFileSync(output, bytes);
            if (sha256(readFileSync(output)) !== sha256(bytes))
                throw new Error(`Reference export mismatch: ${path}`);
        }
        writeFileSync(join(directory, '.reference'), reference);
        return directory;
    }
    catch (error) {
        rmSync(directory, { recursive: true, force: true });
        throw error;
    }
}
export function sourceHashes(): Record<string, string> {
    const hashes: Record<string, string> = {};
    function walk(path: string) {
        for (const entry of readdirSync(join(repoRoot, path), { withFileTypes: true })) {
            if (['node_modules', 'dist'].includes(entry.name) || entry.name.endsWith('.tsbuildinfo'))
                continue;
            const name = path + '/' + entry.name;
            if (entry.isDirectory())
                walk(name);
            else if (entry.isFile())
                hashes[name] = sha256(readFileSync(join(repoRoot, name)));
        }
    }
    for (const path of ['packages', 'tools/typescript', 'tools/migration/ts-03', 'tools/migration/ts-04', 'tools/migration/ts-05', 'tools/generation', 'tools/testing', 'tools/checks', 'tools/release', 'tools/acceptance', 'tools/benchmarks', 'tools/build', 'tests/fixtures/migration/ts-05'])
        walk(path);
    for (const name of ['statusline-native', 'statusline-runtime']) {
        const root = 'mods/' + name;
        for (const relative of readdirSync(join(repoRoot, root), { recursive: true }).map(String)) {
            if (!relative.endsWith('.ts') || relative.split(/[\\/]/u).some(part => ['node_modules', 'types', 'dist'].includes(part)))
                continue;
            const path = root + '/' + relative.replaceAll('\\', '/');
            hashes[path] = sha256(readFileSync(join(repoRoot, path)));
        }
        const manifest = root + '/.claude-plugin/plugin.json';
        hashes[manifest] = sha256(readFileSync(join(repoRoot, manifest)));
    }
    for (const path of ['package.json', 'package-lock.json', 'tsconfig.json', 'tsconfig.base.json', 'tsconfig.tools.json', '.node-version', '.gitattributes', '.github/workflows/typescript.yml', '.github/workflows/native.yml',
        'tools/generate_unicode.py', 'tools/unicode/UNICODE-LICENSE.txt', 'tools/unicode/WCWIDTH-LICENSE.txt', 'mods/statusline-native/lib/generated-unicode.ts', 'mods/statusline-native/lib/unicode.ts'])
        hashes[path] = sha256(readFileSync(join(repoRoot, path)));
    return Object.fromEntries(Object.entries(hashes).sort());
}
