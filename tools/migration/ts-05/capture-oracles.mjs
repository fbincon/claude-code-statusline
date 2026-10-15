/** Explicit archival capture only; never loaded by the ordinary test runner. */
import cp from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
const original = cp.execFileSync, root = process.cwd();
const sha = raw => createHash('sha256').update(raw).digest('hex');
const directory = resolve(process.env.TS05_ORACLE_OUTPUT || 'tests/fixtures/migration/ts-05/oracles');
const version = original('python3', ['--version'], { encoding: 'utf8' }).trim();
if (version !== 'Python 3.14.4') throw new Error('Capture requires Python 3.14.4');
const executable = original('python3', ['-c', 'import sys;print(sys.executable)'], { encoding: 'utf8' }).trim();
mkdirSync(directory, { recursive: true });
cp.execFileSync = function(executable, args, options) {
  const result = original.apply(this, arguments);
  if (!/python(?:3)?(?:\.exe)?$/u.test(String(executable)) || !new Error().stack?.includes('.test.js')) return result;
  if (!args.includes('-c') && !args.some(a=>a.endsWith('runtime-oracle.py'))) return result;
  const command = args.filter(a=>a!=='-B').map(a=>a.replaceAll(root, '$ROOT').replaceAll('\\', '/'));
  // Only file arguments have path separators normalized; inline Python is literal.
  if (args.includes('-c')) command[command.indexOf('-c')+1] = args[args.indexOf('-c')+1];
  const input = options?.input?.toString() ?? '';
  const identity = JSON.stringify({ command, input });
  const file = join(directory, sha(identity)+'.json');
  const record = { schema_version: 1, reference_commit: '9b6d2fab4bf165be280d428a874521bfbf02c7e1', python: version,
    harness_commit: '250ea02', command, input, output: result.toString(), output_sha256: sha(result), identity_sha256: sha(identity) };
  if (existsSync(file) && readFileSync(file,'utf8') !== JSON.stringify(record)+'\n') throw new Error('Non-deterministic oracle: '+file);
  writeFileSync(file,JSON.stringify(record)+'\n');
  return result;
};
syncBuiltinESMExports();
