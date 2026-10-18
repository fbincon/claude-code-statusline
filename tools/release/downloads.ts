/** Verify public GitHub/npm bytes and both registry installation selectors. Never publishes. */
import * as fs from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import assert from 'node:assert/strict';
import { VERSION, PACKAGE_NAME, REPOSITORY_URL } from '@fbincon/statusline-core/release';
import { identity, sourceFilename } from '../build/model.js';
import { npmEntry, sha256 } from '../build/files.js';
import { verifyDelivery } from '../build/verify.js';

const { values } = parseArgs({ options: { commit: { type: 'string' }, output: { type: 'string' } } });
if (!values.commit || !values.output) throw new Error('Require --commit FULL_SHA --output NEW_DIRECTORY');
const product = identity(values.commit, 'preview'), tag = 'v' + VERSION, output = resolve(values.output);
fs.mkdirSync(output);
async function response(url: string, authenticated = false) {
    const headers: Record<string, string> = { 'User-Agent': 'claude-code-statusline-release-verifier' };
    if (authenticated && process.env.GH_TOKEN) headers.Authorization = 'Bearer ' + process.env.GH_TOKEN;
    const result = await fetch(url, { headers, signal: AbortSignal.timeout(120000) });
    if (!result.ok) throw new Error('Download failed: HTTP ' + result.status + ' ' + url);
    return result;
}
const release: any = await (await response('https://api.github.com/repos/fbincon/claude-code-statusline/releases/tags/' + tag, true)).json();
assert.equal(release.tag_name, tag); assert.equal(release.draft, false); assert.equal(release.prerelease, true);
const filename = product.name.replace('@', '').replace('/', '-') + '-' + VERSION + '.tgz';
const names = [filename, sourceFilename(values.commit, 'preview'), 'build-manifest.json', 'SHA256SUMS'];
assert.deepEqual(release.assets.map((asset: any) => asset.name).sort(), [...names].sort(), 'Release asset inventory differs');
for (const name of names) {
    const asset = release.assets.find((row: any) => row.name === name);
    const url = `${REPOSITORY_URL}/releases/download/${tag}/${name}`;
    assert.equal(asset.browser_download_url, url);
    fs.writeFileSync(join(output, name), Buffer.from(await (await response(url)).arrayBuffer()), { flag: 'wx' });
}
const checked = verifyDelivery(join(output, filename), values.commit);
assert.equal(checked.source.channel, 'preview');
const metadata: any = await (await response('https://registry.npmjs.org/' + encodeURIComponent(PACKAGE_NAME))).json();
assert.equal(metadata['dist-tags']?.beta, VERSION);
assert.notEqual(metadata['dist-tags']?.latest, VERSION, 'Preview must not be latest');
const published = metadata.versions?.[VERSION];
assert.equal(published?.name, PACKAGE_NAME); assert.equal(published?.version, VERSION);
const url = new URL(published.dist.tarball);
assert.equal(url.origin, 'https://registry.npmjs.org');
const bytes = Buffer.from(await (await response(url.href)).arrayBuffer());
assert.equal(sha256(bytes), checked.sha256, 'npm and Release package bytes differ');
assert.equal(published.dist.integrity, 'sha512-' + createHash('sha512').update(bytes).digest('base64'));
const installed = [];
for (const selector of [VERSION, 'beta']) {
    const root = fs.mkdtempSync(join(tmpdir(), 'statusline-registry-'));
    try {
        const prefix = join(root, 'prefix'), config = join(root, 'config');
        execFileSync(process.execPath, [npmEntry(), 'install', '--prefix', prefix, '--cache', join(root, 'empty-cache'), '--registry=https://registry.npmjs.org/', '--ignore-scripts', '--no-audit', '--no-fund', PACKAGE_NAME + '@' + selector], { encoding: 'utf8', timeout: 180000, stdio: 'pipe' });
        const packageRoot = join(prefix, 'node_modules', PACKAGE_NAME), entry = join(packageRoot, 'bin/claude-statusline.js');
        assert.deepEqual(JSON.parse(fs.readFileSync(join(packageRoot, 'candidate.json'), 'utf8')), checked.source);
        const run = (args: string[], input = '') => execFileSync(process.execPath, [entry, ...args], { input, encoding: 'utf8', timeout: 30000, env: { ...process.env, CLAUDE_CONFIG_DIR: config } });
        assert.equal(run(['--version']), `claude-statusline ${VERSION}\n`);
        assert(run(['config', 'show', '--config-dir', config]).trim());
        assert(run(['render'], '{"model":{"id":"registry-smoke"},"context_window":{"remaining_percentage":50}}').includes('registry-smoke'));
        installed.push({ selector, status: 'pass', initially_empty_cache: true, lifecycle_scripts: false });
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
fs.writeFileSync(join(output, 'public-downloads.json'), JSON.stringify({ status: 'pass', commit: values.commit, tag, platform: process.platform, arch: process.arch, node: process.version, tarball_sha256: checked.sha256, registry_integrity: published.dist.integrity, installations: installed }, null, 2) + '\n');
console.log(JSON.stringify({ status: 'pass', tag, tarball_sha256: checked.sha256, installations: installed }));
