import * as fs from 'node:fs';
import { join, dirname, resolve, relative, isAbsolute, sep, delimiter } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { spawnSync, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { NATIVE, RUNTIME } from '@fbincon/statusline-cli/integration/model';
import { bundledFiles } from '@fbincon/statusline-cli/integration/resources';
import { repoRoot, sourceHashes } from '../ts-03/common.js';
export const PACKAGE = '@fbincon/statusline-ts04-candidate';
export function npmEntry(): string {
    const found = [process.env.npm_execpath, join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'), join(dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js')].find(path => path && fs.existsSync(path));
    if (!found)
        throw new Error('Run with the pinned npm runtime');
    return found;
}
export const sha256 = (value: Buffer): string => createHash('sha256').update(value).digest('hex');
export function packCandidate(destination: string) {
    const temporary = fs.mkdtempSync(join(tmpdir(), 'ts04 pack ')), stage = join(temporary, 'package');
    fs.mkdirSync(stage);
    fs.mkdirSync(destination, { recursive: true });
    try {
        const bundled = ['core', 'platform', 'cli', 'tui'].map(name => '@fbincon/statusline-' + name);
        for (const short of ['core', 'platform', 'cli', 'tui']) {
            const name = '@fbincon/statusline-' + short, target = join(stage, 'node_modules', name), source = join(repoRoot, 'packages', short);
            fs.mkdirSync(join(target, 'dist'), { recursive: true });
            fs.cpSync(join(source, 'dist/src'), join(target, 'dist/src'), { recursive: true });
            fs.copyFileSync(join(source, 'package.json'), join(target, 'package.json'));
            if (fs.existsSync(join(source, 'resources')))
                fs.cpSync(join(source, 'resources'), join(target, 'resources'), { recursive: true });
        }
        // Bundle the pinned prebuilt runtime dependencies as well, so acceptance
        // can install the candidate offline with every lifecycle script disabled.
        const native = `@koromix/koffi-${process.platform}-${process.arch}`;
        for (const [name, version] of [['koffi', '3.3.3'], ['lossless-json', '4.3.1'], [native, '3.3.3']] as const) {
            const source = join(repoRoot, 'node_modules', name);
            if (JSON.parse(fs.readFileSync(join(source, 'package.json'), 'utf8')).version !== version)
                throw new Error('Unexpected candidate dependency version');
            fs.cpSync(source, join(stage, 'node_modules', name), { recursive: true });
            bundled.push(name);
        }
        for (const spec of [NATIVE, RUNTIME]) {
            const target = join(stage, 'node_modules/@fbincon/statusline-cli/resources', spec.name);
            for (const [name, raw] of bundledFiles(spec).files) {
                const path = join(target, name);
                fs.mkdirSync(dirname(path), { recursive: true });
                fs.writeFileSync(path, raw);
            }
        }
        fs.mkdirSync(join(stage, 'bin'));
        fs.writeFileSync(join(stage, 'bin/claude-statusline.js'), '#!/usr/bin/env node\nimport "../node_modules/@fbincon/statusline-cli/dist/src/entry.js";\n', { mode: 0o755 });
        const dependencies = { ...Object.fromEntries(bundled.map(name => [name, '0.0.0'])), koffi: '3.3.3', 'lossless-json': '4.3.1', [native]: '3.3.3' };
        fs.writeFileSync(join(stage, 'package.json'), JSON.stringify({ name: PACKAGE, version: '0.0.0-ts04', private: true, type: 'module', description: 'Private TS-04 installed acceptance candidate; not a release', license: 'MIT AND Unicode-3.0', engines: { node: '>=24.21.0 <25' }, os: [process.platform], cpu: [process.arch], bin: { 'claude-statusline': 'bin/claude-statusline.js' }, dependencies, bundleDependencies: bundled, files: ['bin', 'candidate.json', 'LICENSE*', 'NOTICE*'] }, null, 2) + '\n');
        for (const name of fs.readdirSync(repoRoot).filter(name => /^(?:LICENSE|NOTICE)/u.test(name)))
            if (fs.statSync(join(repoRoot, name)).isFile())
                fs.copyFileSync(join(repoRoot, name), join(stage, name));
        fs.copyFileSync(join(repoRoot, 'tools/unicode/UNICODE-LICENSE.txt'), join(stage, 'LICENSE-Unicode.txt'));
        fs.copyFileSync(join(repoRoot, 'tools/unicode/WCWIDTH-LICENSE.txt'), join(stage, 'LICENSE-Wcwidth.txt'));
        const source = { commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim(), dirty: Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: repoRoot, encoding: 'utf8' }).trim()), node: process.version, source_hashes: sourceHashes() };
        fs.writeFileSync(join(stage, 'candidate.json'), JSON.stringify(source, null, 2) + '\n');
        const packed = JSON.parse(execFileSync(process.execPath, [npmEntry(), 'pack', '--offline', '--ignore-scripts', '--json', '--pack-destination', resolve(destination)], { cwd: stage, encoding: 'utf8', timeout: 60000, maxBuffer: 8 * 1024 * 1024 }))[0];
        const tarball = join(destination, packed.filename);
        if (!packed.bundled?.includes('@fbincon/statusline-cli'))
            throw new Error('Candidate workspace dependencies were not bundled');
        return { tarball, sha256: sha256(fs.readFileSync(tarball)), entries: packed.files.map((file: {
                path: string;
            }) => file.path), source };
    }
    finally {
        fs.rmSync(temporary, { recursive: true, force: true });
    }
}
export function installCandidate() {
    const temporary = fs.realpathSync.native(fs.mkdtempSync(join(tmpdir(), 'ts04 installed 中文 $` & '))), packed = packCandidate(temporary), directory = join(temporary, 'prefix'), nodeDir = join(temporary, 'node-bin');
    fs.mkdirSync(directory);
    fs.mkdirSync(nodeDir);
    const node = join(nodeDir, process.platform === 'win32' ? 'node.exe' : 'node');
    fs.copyFileSync(process.execPath, node);
    if (process.platform !== 'win32')
        fs.chmodSync(node, 0o700);
    const env = { ...process.env, PATH: nodeDir, NODE_PATH: '', TERM: 'xterm-256color', CLAUDE_CONFIG_DIR: join(temporary, 'config'), HOME: join(temporary, 'home'), USERPROFILE: join(temporary, 'home'), npm_config_audit: 'false', npm_config_fund: 'false' };
    fs.writeFileSync(join(directory, 'package.json'), '{"name":"ts04-isolated-acceptance","version":"0.0.0","private":true}\n');
    const installed = spawnSync(node, [npmEntry(), 'install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', packed.tarball], { cwd: directory, env, encoding: 'utf8', timeout: 180000, maxBuffer: 8 * 1024 * 1024 });
    fs.writeFileSync(join(temporary, 'install.log'), installed.stdout + installed.stderr);
    if (installed.error || installed.status !== 0) {
        fs.rmSync(temporary, { recursive: true, force: true });
        throw new Error('Isolated candidate installation failed: ' + installed.stderr);
    }
    const root = join(directory, 'node_modules', PACKAGE), modules = join(root, 'node_modules/@fbincon'), entry = join(modules, 'statusline-cli/dist/src/entry.js'), bin = join(directory, 'node_modules/.bin/claude-statusline');
    const outside = relative(fs.realpathSync.native(repoRoot), fs.realpathSync.native(root));
    // On Windows a candidate on another drive produces an absolute relative()
    // result. Canonicalize both prefixes before checking same-drive ancestry.
    if (!isAbsolute(outside) && outside !== '..' && !outside.startsWith('..' + sep))
        throw new Error('Candidate must be installed outside the checkout');
    return { temporary, directory, nodeDir, node, env, root, modules, entry, bin, packed, cleanup: () => fs.rmSync(temporary, { recursive: true, force: true }) };
}
/** The official macOS host uses the OS security utility when loading plugin
 * options, including non-sensitive inputs. Keep that system capability without
 * exposing Python, compilers or the rest of the developer's PATH to acceptance.
 */
export function officialEnvironment(candidate: ReturnType<typeof installCandidate>): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = { ...candidate.env, ANTHROPIC_API_KEY: 'ts04-synthetic-not-a-real-key', ANTHROPIC_BASE_URL: 'http://127.0.0.1:9', DISABLE_AUTOUPDATER: '1', CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1' };
    fs.mkdirSync(candidate.env.HOME, { recursive: true, mode: 0o700 });
    if (process.platform === 'darwin') {
        const directory = join(candidate.temporary, 'host-system-tools');
        fs.mkdirSync(directory, { mode: 0o700 });
        fs.accessSync('/usr/bin/security', fs.constants.X_OK);
        fs.symlinkSync('/usr/bin/security', join(directory, 'security'));
        env.PATH = candidate.nodeDir + delimiter + directory;
    }
    delete env.CLAUDECODE;
    return env;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    if (process.argv.length !== 3)
        throw new Error('Usage: package OUTPUT_DIRECTORY');
    const result = packCandidate(resolve(process.argv[2]!));
    console.log(JSON.stringify({ tarball: result.tarball, sha256: result.sha256, files: result.entries.length }));
}
