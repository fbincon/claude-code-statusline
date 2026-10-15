import * as fs from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { claudeLaunch, detectClaudeVersion } from '@fbincon/statusline-platform/commands';
import { installCandidate } from './package.js';
const path = resolve(process.argv[2] ?? 'dist/validation/typescript-migration/ts-04/04-e/official-installed.json');
fs.mkdirSync(dirname(path), { recursive: true });
const candidate = installCandidate(), host = claudeLaunch(), version = detectClaudeVersion();
try {
    if (!version || version[0] !== 2 || version[1] !== 1 || version[2]! < 287)
        throw new Error('A fixed supported official host is required for this acceptance: ' + JSON.stringify({ host, version }));
    const driver = join(candidate.temporary, 'official-driver.mjs'), request = join(candidate.temporary, 'request.json'), receipt = join(candidate.temporary, 'result.json');
    fs.copyFileSync(fileURLToPath(new URL('./test/installed-driver.js', import.meta.url)), driver);
    fs.writeFileSync(request, JSON.stringify({ host, version }));
    const result = spawnSync(candidate.node, [driver, candidate.modules, 'official', join(candidate.temporary, 'official config 中文 &'), receipt, request], { cwd: candidate.directory, env: { ...candidate.env, ANTHROPIC_API_KEY: 'ts04-synthetic-not-a-real-key', ANTHROPIC_BASE_URL: 'http://127.0.0.1:9', DISABLE_AUTOUPDATER: '1', CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1' }, encoding: 'utf8', timeout: 300000, maxBuffer: 4 * 1024 * 1024 });
    const report = { status: result.status === 0 ? 'pass' : 'fail', source: candidate.packed.source, tarball_sha256: candidate.packed.sha256, result: fs.existsSync(receipt) ? JSON.parse(fs.readFileSync(receipt, 'utf8')) : null, error: result.status === 0 ? null : (result.stderr + result.stdout).slice(-4000) };
    fs.writeFileSync(path, JSON.stringify(report, null, 2) + '\n');
    if (result.error || result.status !== 0)
        throw new Error('Installed official acceptance failed: ' + report.error);
    console.log(JSON.stringify({ status: report.status, ...report.result }));
}
finally {
    candidate.cleanup();
}
