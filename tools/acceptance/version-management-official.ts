import * as fs from 'node:fs';
import { installCandidate } from './install.js';
import { installedVersionManagement, type VersionHost } from './version-management.js';
const [artifact, commit, host, report, trace] = process.argv.slice(2);
if (!artifact || !commit || !host || !report)
    throw new Error('Require artifact, commit, host JSON and report');
const installed = installCandidate(artifact, commit);
try {
    const result = await installedVersionManagement(installed, JSON.parse(host) as VersionHost, trace);
    fs.writeFileSync(report, JSON.stringify(result, null, 2) + '\n');
}
finally {
    installed.cleanup();
}
