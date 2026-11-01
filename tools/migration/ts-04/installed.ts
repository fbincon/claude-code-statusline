/** Preserve the TS-04 environment/positional entry while using the current installed supervisor. */
import { resolve } from 'node:path';
import { runInstalled } from '../../acceptance/installed.js';

const artifact = process.env.TS05_CANDIDATE_ARTIFACT, commit = process.env.TS05_CANDIDATE_COMMIT;
if (!artifact || !commit) throw new Error('Require a previously built TS-05 artifact and fixed commit; acceptance never repacks');
const report = resolve(process.argv[2] ?? 'dist/validation/typescript-migration/ts-04/04-e/installed.json');
await runInstalled(artifact, commit, report, process.env.TS05_DIAGNOSTIC_PATTERN);
