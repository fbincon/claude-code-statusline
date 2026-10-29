/** Run only registered checks, issue a scoped receipt, never complete candidate acceptance. */
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { parseArgs } from 'node:util';
import { assertPlan, type ImpactPlan, type ImpactTask, type Check } from './impact-plan.ts';
import { canonical, git, hash } from './impact-content.ts';
import { checkAssets } from './impact-assets.ts';
import { checkDocs } from './docs.ts';

export interface ScopedReceipt {
    schema_version: 1; kind: 'scoped-checks'; status: 'pass' | 'fail'; commit: string; plan_sha256: string;
    task: ImpactTask; checks: Check[]; node: string; platform: string; started_at: string; completed_at: string;
    execution: { run_id: string | null; attempt: string | null; job: string | null }; package_sha256?: string; error?: string;
}
export function scopedTests(check: Check, root = '.'): string[] {
    const directory = ['core', 'platform', 'cli', 'tui'].includes(check) ? `packages/${check}/dist/test` :
        check === 'migration' ? 'dist/typescript/tools/migration' : `dist/typescript/tools/${check}/test`;
    if (!fs.existsSync(join(root, directory))) throw new Error('Missing test family: ' + check);
    const found = fs.readdirSync(join(root, directory), { recursive: true }).map(String).filter(name => name.endsWith('.test.js'))
        .map(name => join(directory, name)).filter(name => !name.endsWith(join('ts-04', 'test', 'installed.test.js'))).sort();
    assert(found.length, 'Empty selected test family: ' + check); return found;
}
export async function runScoped(plan: ImpactPlan, taskId: string, reportPath: string, artifact?: string): Promise<ScopedReceipt> {
    assertPlan(plan); assert.equal(git('rev-parse', 'HEAD'), plan.head);
    assert.equal(git('diff', '--name-only', 'HEAD', '--'), '', 'Scoped checks require unchanged tracked source');
    const task = plan.tasks.find(item => item.id === taskId); assert(task, 'Unknown task');
    const expectedPlatform = task.os.startsWith('ubuntu') ? 'linux' : task.os.startsWith('windows') ? 'win32' : 'darwin';
    assert.equal(process.platform, expectedPlatform, 'Task must execute on its declared platform');
    const receipt: ScopedReceipt = { schema_version: 1, kind: 'scoped-checks', status: 'fail', commit: plan.head, plan_sha256: hash(canonical(plan)), task,
        checks: [], node: process.version, platform: process.platform, started_at: new Date().toISOString(), completed_at: '',
        execution: { run_id: process.env.GITHUB_RUN_ID ?? null, attempt: process.env.GITHUB_RUN_ATTEMPT ?? null, job: process.env.GITHUB_JOB ?? null } };
    const run = (args: string[], env = process.env) => {
        const result = spawnSync(process.execPath, args, { env, stdio: 'inherit', timeout: 900000 });
        assert.equal(result.error, undefined); assert.equal(result.status, 0, 'Scoped check failed: ' + args.join(' '));
    };
    try {
        if (task.checks.some(check => !['actions', 'docs', 'assets'].includes(check))) {
            const { npmEntry } = await import('../build/files.ts'); run([npmEntry(), 'run', 'build']);
        }
        for (const check of task.checks) {
            if (check === 'actions') run(['tools/checks/actions.ts']);
            else if (check === 'docs') {
                const result = checkDocs(process.cwd(), plan.changes.filter(item => item.category === 'documentation').map(item => item.path)); assert.deepEqual(result.errors, [], result.errors.join('\n'));
                git('diff', '--check', plan.base, plan.head, '--');
            } else if (check === 'assets') checkAssets(process.cwd(), plan.changes.map(item => item.path));
            else if (check === 'generation') { run(['dist/typescript/tools/generation/resources.js', '--check']); run(['--test', '--test-concurrency=1', ...scopedTests(check)]); }
            else if (check === 'archive') run(['dist/typescript/tools/checks/archive.js']);
            else if (check === 'approval') {
                const { sourceStableApproval, assessApprovalRegistry } = await import('../release/approval.ts');
                const registry = assessApprovalRegistry(JSON.parse(fs.readFileSync('docs/releases/approvals/registry.json', 'utf8')));
                const entries = new Map(['docs/releases/approvals/registry.json', ...registry.approvals.map(item => item.path)].map(path => [path, fs.readFileSync(path)]));
                for (const registration of registry.approvals) sourceStableApproval(entries, registration.version);
            } else if (check === 'packaging') {
                const { buildComparisonPackage } = await import('../build/impact-package.ts');
                const temporary = fs.mkdtempSync(join(tmpdir(), 'impact-install-'));
                try {
                    const packed = artifact ?? buildComparisonPackage(plan.head, join(temporary, 'package'));
                    receipt.package_sha256 = hash(fs.readFileSync(packed));
                    run(['dist/typescript/tools/acceptance/integration-smoke.js', '--artifact', resolve(packed), '--source', plan.head, '--integration', plan.head, '--target', task.os, '--report', join(temporary, 'smoke.json')]);
                } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
            } else if (check === 'native' || check === 'runtime') {
                assert(task.host); const { claudeLaunch } = await import('@fbincon/statusline-platform/commands');
                const { isolatedHostEnvironment, prepareModTypes, recordModHost } = await import(pathToFileURL(resolve('dist/typescript/tools/acceptance/mod-types.js')).href);
                const host = claudeLaunch('claude'), temporary = fs.mkdtempSync(join(tmpdir(), 'impact-host-'));
                try {
                    const env = isolatedHostEnvironment(process.env, temporary), plugin = 'mods/statusline-' + check;
                    const version = spawnSync(host.executable, [...host.args, '--version'], { env, encoding: 'utf8', timeout: 10000 });
                    assert.equal(version.status, 0); assert(version.stdout.includes(task.host)); recordModHost(plugin, task.host);
                    for (const command of ['validate', 'test']) {
                        const result = spawnSync(host.executable, [...host.args, 'plugin', command, ...(command === 'validate' ? ['--strict'] : []), plugin], { env, stdio: 'inherit', timeout: 600000 });
                        assert.equal(result.error, undefined); assert.equal(result.status, 0, 'Scoped Mod check failed');
                    }
                    if (task.host !== '2.1.296') { await prepareModTypes(plugin); run(['node_modules/typescript/bin/tsc', '--noEmit', '--project', plugin + '/tsconfig.json']); }
                } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
            } else run(['--test', '--test-concurrency=1', ...scopedTests(check)]);
            receipt.checks.push(check);
        }
        receipt.status = 'pass';
    } catch (error) { receipt.error = error instanceof Error ? error.message : String(error); throw error; }
    finally {
        receipt.completed_at = new Date().toISOString(); fs.mkdirSync(dirname(reportPath), { recursive: true });
        fs.writeFileSync(reportPath, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
    }
    return receipt;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const { values } = parseArgs({ options: { plan: { type: 'string' }, task: { type: 'string' }, report: { type: 'string' }, artifact: { type: 'string' } } });
    assert(values.plan && values.task && values.report, 'Use ci:check -- --plan FILE --task ID --report FILE [--artifact TGZ]');
    await runScoped(JSON.parse(fs.readFileSync(values.plan, 'utf8')), values.task, resolve(values.report), values.artifact);
}
