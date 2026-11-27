/** Run one official file in an owned POSIX process group or Windows Job Object. */
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSourceProcess } from '@fbincon/statusline-platform/source-process';
import { removeTree } from '@fbincon/statusline-platform/remove-tree';
import type { OfficialCommandOptions, OfficialCommandResult } from '../official-tests.js';

const entry = fileURLToPath(import.meta.url);
type Outcome = { status: number | null; signal?: string | null; error?: string };

/** Keep the existing 8 MiB host-output allowance outside the supervisor's control pipe. */
function captureCommand(directory: string, limit: number, executable: string, args: string[]): void {
    const child = spawn(executable, args, { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    function finish(outcome: Outcome): never {
        fs.writeSync(1, JSON.stringify(outcome));
        // The platform supervisor reaps the process tree when this leader exits.
        process.exit(0);
    }
    for (const name of ['stdout', 'stderr'] as const) {
        const fd = fs.openSync(join(directory, name), 'wx', 0o600);
        let bytes = 0;
        child[name].on('data', (chunk: Buffer) => {
            const remaining = limit - bytes;
            const length = Math.min(chunk.length, remaining);
            for (let offset = 0; offset < length;) offset += fs.writeSync(fd, chunk, offset, length - offset);
            bytes += length;
            if (length < chunk.length) finish({ status: null, error: 'Official host output exceeded its limit' });
        });
        child[name].once('error', error => finish({ status: null, error: error.message }));
    }
    child.once('error', error => finish({ status: null, error: error.message }));
    child.once('close', (status, signal) => finish({ status, signal }));
}

export async function runOfficialTestCommand(executable: string, args: string[], options: OfficialCommandOptions): Promise<OfficialCommandResult> {
    const directory = fs.mkdtempSync(join(tmpdir(), 'official-command-'));
    try {
        let supervisorError = '';
        const run = await runSourceProcess({ executable: process.execPath, args: [entry, directory, String(options.maxBuffer), executable, ...args],
            cwd: options.cwd, environment: options.env, timeoutMs: options.timeout, signal: options.signal, input: '',
            captureStderr: value => { supervisorError = value; } });
        const read = (name: string) => {
            const file = join(directory, name);
            return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
        };
        let outcome: Outcome = { status: null, error: 'Official host ' + run.reason };
        if (run.reason === 'completed') {
            try { outcome = JSON.parse(run.stdout); }
            catch { outcome = { status: null, error: 'Official host supervisor returned no valid result' }; }
        }
        return { stdout: read('stdout'), stderr: read('stderr') + supervisorError, status: outcome.status, signal: outcome.signal,
            ...(outcome.error ? { error: new Error(outcome.error) } : {}) };
    } finally {
        removeTree(directory);
        if (fs.existsSync(directory)) throw new Error('Official test output directory was not removed');
    }
}

if (process.argv[1] && resolve(process.argv[1]) === entry) {
    const [directory, limit, executable, ...args] = process.argv.slice(2);
    if (!directory || !executable || !limit || !Number.isSafeInteger(Number(limit)) || Number(limit) < 1)
        throw new Error('Invalid official test capture request');
    captureCommand(directory, Number(limit), executable, args);
}
