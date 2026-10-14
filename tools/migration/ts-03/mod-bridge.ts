/** Isolated host acceptance binding; the installed product never calls this harness. */
import { appendFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { main } from '@fbincon/statusline-cli/main';
const [receipt, ...args] = process.argv.slice(2);
if (!receipt || !args.length)
    throw new Error('Usage: mod-bridge RECEIPT COMMAND ...');
const input = readFileSync(0).toString('utf8');
let stdout = '', stderr = '';
const launch = { executable: process.execPath, args: [fileURLToPath(import.meta.url), receipt] };
const status = await main(args, { launch, stdin: () => input, stdout: value => { stdout += value; }, stderr: value => { stderr += value; } });
appendFileSync(receipt, JSON.stringify({ command: args[0], args: args.slice(1), request: input, status, stdout, stderr }) + '\n', { mode: 0o600 });
process.stdout.write(stdout);
process.stderr.write(stderr);
process.exitCode = status;
