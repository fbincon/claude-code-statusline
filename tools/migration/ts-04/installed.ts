import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const report = resolve(process.argv[2] ?? 'dist/validation/typescript-migration/ts-04/04-e/installed.json');
mkdirSync(dirname(report), { recursive: true });
const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1', fileURLToPath(new URL('./test/installed.test.js', import.meta.url))], { env: { ...process.env, TS04_INSTALLED_REPORT: report }, stdio: 'inherit' });
if (result.error)
    throw result.error;
process.exitCode = result.status ?? 1;
