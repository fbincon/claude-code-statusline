/** Short integration proof for the original package; never a replacement for PR acceptance. */
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join, resolve, dirname, delimiter } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { VERSION } from '@fbincon/statusline-core/release';
import { PROTOCOL_VERSION } from '@fbincon/statusline-core/contracts/ui';
import { installCandidate } from './install.js';
import { sha256 } from '../build/files.js';
import { git } from '../checks/ci-evidence.js';
import { retainLog } from './diagnostics.js';
const { values } = parseArgs({ options: { artifact: { type: 'string' }, source: { type: 'string' }, integration: { type: 'string' }, target: { type: 'string' }, report: { type: 'string' } } });
assert(values.artifact && values.source && values.integration && values.target && values.report);
assert.match(values.integration, /^[a-f0-9]{40}$/u);
assert.equal(git('rev-parse', 'HEAD'), values.integration);
assert.equal(git('rev-parse', values.integration + '^{tree}'), git('rev-parse', values.source + '^{tree}'), 'Integration must execute the accepted source tree');
git('merge-base', '--is-ancestor', values.source, values.integration);
const reportPath = resolve(values.report), started = performance.now();
const checks: string[] = [], phases: any[] = [];
let installed: ReturnType<typeof installCandidate> | undefined;
const report: any = { schema_version: 1, kind: 'integration-smoke', status: 'fail', target: values.target, integration_commit: values.integration,
    source_commit: values.source, node: process.version, node_sha256: sha256(fs.readFileSync(process.execPath)), platform: process.platform, arch: process.arch,
    checks, phases, model_calls: 0, lifecycle_scripts: false, execution: { run_id: process.env.GITHUB_RUN_ID, attempt: process.env.GITHUB_RUN_ATTEMPT, job: process.env.GITHUB_JOB } };
try {
    installed = installCandidate(resolve(values.artifact), values.source); report.tarball_sha256 = installed.packed.sha256;
    checks.push('offline-empty-cache-install');
    const config = installed.env.CLAUDE_CONFIG_DIR;
    fs.mkdirSync(config, { recursive: true }); fs.writeFileSync(join(config, 'settings.json'), '{"env":{"KEEP":"unchanged"}}\n');
    const invoke = (args: string[], input = '') => {
        const before = performance.now(), result = spawnSync(installed!.node, [installed!.entry, ...args], { cwd: installed!.directory,
            env: { ...installed!.env, PATH: dirname(installed!.bin) + delimiter + installed!.env.PATH }, input, encoding: 'utf8', timeout: 30000, maxBuffer: 2 * 1024 * 1024 });
        const log = retainLog(join(dirname(reportPath), 'logs'), `${phases.length}-${args[0]!.replaceAll('-', '')}.log`, (result.stdout ?? '') + (result.stderr ?? ''));
        phases.push({ command: args[0], elapsed_ms: performance.now() - before, status: result.status, log });
        assert.equal(result.error, undefined); assert.equal(result.status, 0, (result.stdout ?? '') + (result.stderr ?? '')); return result.stdout;
    };
    assert.equal(invoke(['--version']).trim(), 'claude-statusline ' + VERSION); checks.push('version');
    invoke(['install', '--config-dir', config, '--no-native-editor', '--no-native-timing', '--no-live-metrics']); checks.push('install');
    invoke(['doctor', '--config-dir', config]); checks.push('doctor');
    assert(invoke(['render'], JSON.stringify({ model: { id: 'integration-model' }, columns: 80 })).trim().length > 0); checks.push('render');
    const ui = (operation: string, payload: unknown = {}) => {
        const result = JSON.parse(invoke(['ui', '--config-dir', config], JSON.stringify({ protocol_version: PROTOCOL_VERSION, operation, payload })));
        assert.equal(result.protocol_version, PROTOCOL_VERSION); assert(result.result); return result.result;
    };
    const current = ui('read'); current.draft.display.use_colors = false;
    ui('apply', { draft: current.draft, expected_revision: current.revision });
    assert.equal(ui('read').draft.display.use_colors, false); checks.push('configuration-read-write');
    invoke(['uninstall', '--config-dir', config]);
    const settings = JSON.parse(fs.readFileSync(join(config, 'settings.json'), 'utf8'));
    assert.equal(settings.env.KEEP, 'unchanged'); assert.equal(settings.statusLine, undefined); checks.push('uninstall-preserves-unowned-settings');
    installed.cleanup(); installed = undefined; report.status = 'pass';
} finally {
    try { installed?.cleanup(); }
    finally { report.elapsed_ms = performance.now() - started; fs.mkdirSync(dirname(reportPath), { recursive: true }); fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' }); }
}
