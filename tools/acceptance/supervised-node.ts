/** Keep TAP away from the process adapter's small control pipes; the parent tails both files. */
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import { join } from 'node:path';

const [directory, ...args] = process.argv.slice(2);
if (!directory || !args.length) throw new Error('Missing supervised Node command');
const stdout = fs.openSync(join(directory, 'stdout'), 'a'), stderr = fs.openSync(join(directory, 'stderr'), 'a');
try {
    const child = spawn(process.execPath, args, { stdio: ['ignore', stdout, stderr], shell: false, windowsHide: true });
    const code = await new Promise<number>((resolve, reject) => {
        child.once('error', reject); child.once('close', status => resolve(status ?? 1));
    });
    process.exitCode = code;
} finally { fs.closeSync(stdout); fs.closeSync(stderr); }
