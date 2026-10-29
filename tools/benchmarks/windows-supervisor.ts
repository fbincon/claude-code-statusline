/** Compare the retained historical supervisor with the current adapter on the same runner. */
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { windowsJobScript } from '@fbincon/statusline-platform/windows-source-job';
import { windowsSourceEnvironment } from '@fbincon/statusline-platform/windows-source-environment';
import { runSourceProcess, sourceEnvironment } from '@fbincon/statusline-platform/source-process';
assert.equal(process.platform, 'win32'); assert(process.argv[2]);
const environment = sourceEnvironment(), args = ['-e', 'process.stdout.write("supervisor-probe")'];
const old: any[] = [], current: any[] = [];
for (let sample = 0; sample < 3; sample++) {
    const started = performance.now();
    const result = spawnSync(join(process.env.SystemRoot ?? 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe'),
        ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(windowsJobScript, 'utf16le').toString('base64')], {
            cwd: process.cwd(), env: { ...windowsSourceEnvironment(environment), STATUSLINE_SOURCE_LAUNCH: JSON.stringify({ executable: process.execPath, args, cwd: process.cwd(), environment }) },
            encoding: 'utf8', timeout: 30000, windowsHide: true,
        });
    old.push({ elapsed_ms: performance.now() - started, status: result.status, correct_output: result.stdout === 'supervisor-probe', error: result.error?.name ?? null });
    const next = performance.now(); const actual = await runSourceProcess({ executable: process.execPath, args, cwd: process.cwd(), input: '', timeoutMs: 30000, environment });
    current.push({ elapsed_ms: performance.now() - next, status: actual.code, reason: actual.reason, correct_output: actual.stdout === 'supervisor-probe' });
    assert.equal(actual.reason, 'completed'); assert.equal(actual.stdout, 'supervisor-probe');
}
const median = (values: any[]) => values.map(value => value.elapsed_ms).sort((a, b) => a - b)[1];
const report = { schema_version: 1, node: process.version, platform: process.platform, arch: process.arch, runner: process.env.RUNNER_NAME, old, current,
    old_median_ms: median(old), current_median_ms: median(current), improvement: 1 - median(current) / median(old) };
fs.mkdirSync(dirname(resolve(process.argv[2])), { recursive: true }); fs.writeFileSync(process.argv[2], JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report));
