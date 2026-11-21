import * as fs from 'node:fs';
import { installCandidate } from './install.js';
import { phaseSync, phaseAsync } from './installed-supervisor.js';
import { installedHistoryProfile, installedVersionManagement, type VersionHost } from './version-management.js';
const [artifact, commit, host, report, trace, depth, baseline] = process.argv.slice(2);
if (!artifact || !commit || !host || !report)
    throw new Error('Require artifact, commit, host JSON and report');
if (depth !== undefined && depth !== 'full' && depth !== 'short' && depth !== 'plugin-recovery') throw new Error('Unknown history profile');
const installed = phaseSync('official-install', () => installCandidate(artifact, commit));
let result: Record<string, unknown>;
try {
    if (depth === 'plugin-recovery') {
        if (!trace || !baseline) throw new Error('Plugin recovery requires both fixture archives and the baseline host executable');
        const { pluginRecovery } = await import('./version-management/plugin-recovery.js');
        result = await phaseAsync('official-histories', () => pluginRecovery(installed, trace, host, baseline));
    } else {
        const official = JSON.parse(host) as VersionHost;
        result = await phaseAsync('official-histories', () => depth ? installedHistoryProfile(installed, depth, official, trace) : installedVersionManagement(installed, official, trace));
    }
}
catch (error) {
    if (depth === 'plugin-recovery') result = { status: 'fail', commit, tarball_sha256: installed.packed.sha256, error: String(error).slice(0, 8000) };
    throw error;
}
finally {
    phaseSync('official-cleanup-and-report', () => {
        installed.cleanup();
        if (fs.existsSync(installed.temporary)) throw new Error('Official installation fixture cleanup failed');
        if (result) fs.writeFileSync(report, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
    });
}
