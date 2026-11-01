import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { LANGUAGES } from '@fbincon/statusline-core/i18n/registry';
import { reserveInstallFixture } from './install.js';
import { installedPhases, type InstalledSelection } from './installed-plan.js';
import { PLATFORM_SOURCE_MS, requireHostedBudget, supervisionBudget } from './budgets.js';
import { superviseInstalled } from './installed-supervisor.js';

export async function runInstalled(artifact: string, commit: string, report: string, pattern?: string, env = process.env, selection?: InstalledSelection): Promise<void> {
    assert(!selection || !pattern, 'Physical stages cannot use a diagnostic test pattern');
    const phases = installedPhases(process.platform === 'win32', LANGUAGES.length, pattern, selection);
    if (env.GITHUB_ACTIONS && !selection) requireHostedBudget(supervisionBudget(phases), PLATFORM_SOURCE_MS);
    const args = ['--test', '--test-concurrency=1', ...(pattern ? ['--test-name-pattern', pattern] : []),
        fileURLToPath(new URL('../migration/ts-04/test/installed.test.js', import.meta.url))];
    const target = resolve(report), pending = target + '.' + randomUUID() + '.pending';
    fs.mkdirSync(dirname(target), { recursive: true });
    const fixture = reserveInstallFixture();
    try {
        await superviseInstalled(args, phases, { ...env, TS05_CANDIDATE_ARTIFACT: resolve(artifact), TS05_CANDIDATE_COMMIT: commit,
            TS04_INSTALLED_REPORT: target, TS05_PENDING_RECEIPT: pending, TS05_DIAGNOSTIC_PATTERN: pattern ?? '',
            TS05_PHYSICAL_STAGE: selection?.stage ?? '', TS05_PHYSICAL_DEPTH: selection?.depth ?? '',
            TS05_RESERVED_FIXTURE: fixture }, target, { fixture });
        const receipt = JSON.parse(fs.readFileSync(pending, 'utf8'));
        assert.equal(receipt.status, pattern ? 'fail' : 'pass', 'Incomplete installed acceptance');
        fs.renameSync(pending, target);
    } catch (error) {
        let partial: Record<string, unknown> = {};
        try { partial = JSON.parse(fs.readFileSync(pending, 'utf8')); } catch { /* Worker can die before teardown. */ }
        fs.writeFileSync(pending, JSON.stringify({ ...partial, status: 'fail', error: error instanceof Error ? error.message : String(error) }, null, 2) + '\n');
        fs.renameSync(pending, target); throw error;
    }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const { values } = parseArgs({ options: { artifact: { type: 'string' }, commit: { type: 'string' }, report: { type: 'string' }, 'diagnostic-pattern': { type: 'string' } } });
    if (!values.artifact || !values.commit || !values.report) throw new Error('Usage: test:installed -- --artifact TGZ --commit FULL_SHA --report FILE');
    await runInstalled(values.artifact, values.commit, values.report, values['diagnostic-pattern']);
}
