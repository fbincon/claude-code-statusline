import * as fs from 'node:fs';
import { join, resolve, relative, isAbsolute, sep, delimiter } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { repoRoot } from '../migration/ts-03/common.js';
import { npmEntry } from '../build/files.js';
import { verifyCandidate } from '../build/verify.js';
import { PACKAGE } from '../build/model.js';
export { PACKAGE } from '../build/model.js';
export function installCandidate(artifact = process.env.TS05_CANDIDATE_ARTIFACT, commit = process.env.TS05_CANDIDATE_COMMIT) {
    if (!artifact || !commit) throw new Error("Require a previously built TS-05 artifact and fixed commit; acceptance never repacks");
    const packed = verifyCandidate(resolve(artifact), commit);
    const temporary = fs.realpathSync.native(fs.mkdtempSync(join(tmpdir(), 'ts05 installed 中文 $` & '))), directory = join(temporary, 'prefix'), nodeDir = join(temporary, 'node-bin');
    fs.mkdirSync(directory);
    fs.mkdirSync(nodeDir);
    const node = join(nodeDir, process.platform === 'win32' ? 'node.exe' : 'node');
    fs.copyFileSync(process.execPath, node);
    if (process.platform !== 'win32')
        fs.chmodSync(node, 0o700);
    const inherited = Object.fromEntries(['SYSTEMROOT', 'SystemRoot', 'WINDIR', 'COMSPEC', 'PATHEXT', 'TMP', 'TEMP', 'TMPDIR', 'LANG', 'LC_ALL'].filter(key => process.env[key] !== undefined).map(key => [key, process.env[key]]));
    const env = { ...inherited, PATH: nodeDir, NODE_PATH: '', TERM: 'xterm-256color', CLAUDE_CONFIG_DIR: join(temporary, 'config'), HOME: join(temporary, 'home'), USERPROFILE: join(temporary, 'home'), npm_config_audit: 'false', npm_config_fund: 'false', npm_config_cache: join(temporary, 'empty-npm-cache'), npm_config_update_notifier: 'false' };
    fs.mkdirSync(env.HOME, { recursive: true, mode: 0o700 });
    fs.writeFileSync(join(directory, 'package.json'), '{"name":"ts05-isolated-acceptance","version":"0.0.0","private":true}\n');
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
    const env: NodeJS.ProcessEnv = { ...candidate.env, ANTHROPIC_API_KEY: 'ts05-synthetic-not-a-real-key', ANTHROPIC_BASE_URL: 'http://127.0.0.1:9', DISABLE_AUTOUPDATER: '1', CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1' };
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
