import * as fs from 'node:fs';
import { installCandidate } from './install.js';
import { phaseSync, phaseAsync } from './installed-supervisor.js';
import { installedVersionManagement, type VersionHost } from './version-management.js';
const [artifact, commit, host, report, trace] = process.argv.slice(2);
if (!artifact || !commit || !host || !report)
    throw new Error('Require artifact, commit, host JSON and report');
const installed = phaseSync('official-install', () => installCandidate(artifact, commit));
let result: Record<string, unknown>;
try {
    result = await phaseAsync('official-histories', () => installedVersionManagement(installed, JSON.parse(host) as VersionHost, trace));
}
finally {
    phaseSync('official-cleanup-and-report', () => {
        installed.cleanup();
        if (fs.existsSync(installed.temporary)) throw new Error('Official installation fixture cleanup failed');
        if (result) fs.writeFileSync(report, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
    });
}
