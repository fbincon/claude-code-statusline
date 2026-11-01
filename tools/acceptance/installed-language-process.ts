import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { LANGUAGE_OPERATION_MS, LANGUAGE_WORKER_EXIT_MS } from './language-budget.js';

export type LanguageCommand = (label: string, args: string[], input: string) => Promise<string>;
interface WorkerOptions { node: string; entry: string; worker: string; directory: string; env: NodeJS.ProcessEnv }
interface Reply { ready?: boolean; id?: number; code?: number; stdout?: string; stderr?: string }
function withinExitBudget(closed: Promise<unknown>): Promise<boolean> {
    return new Promise(resolve => {
        const timer = setTimeout(() => resolve(false), LANGUAGE_WORKER_EXIT_MS);
        void closed.then(() => { clearTimeout(timer); resolve(true); });
    });
}

/** The parent enforces each call's original hard limit, even while synchronous
 * code inside main() is stuck. A worker never starts or controls other workers. */
export async function withLanguageWorker<T>(options: WorkerOptions, body: (call: LanguageCommand) => Promise<T>,
    timeoutMs = LANGUAGE_OPERATION_MS): Promise<T> {
    const child = fork(options.worker, [options.entry], {
        execPath: options.node, execArgv: [], cwd: options.directory, env: options.env, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });
    let detail = '', sequence = 0;
    child.stderr!.setEncoding('utf8').on('data', (chunk: string) => { detail = (detail + chunk).slice(-4000); });
    let pending: { resolve: (message: Reply) => void; reject: (error: Error) => void } | undefined;
    let failure: Error | undefined;
    child.on('error', error => { failure = error; pending?.reject(error); });
    child.stdout!.on('data', () => {
        // Production output must travel through the selected CLI stream. Direct
        // console output would have polluted a real machine-protocol pipe.
        failure ??= new Error('Unexpected direct stdout from the language CLI');
        pending?.reject(failure);
    });
    child.on('message', (message: Reply) => pending?.resolve(message));
    const reaped = new Promise<void>(resolve => {
        // Manually disconnecting a fork can deliver exit without close. exit
        // confirms the process is reaped; close also covers a failed spawn.
        const exited = (code: number | null, signal: NodeJS.Signals | null) => {
            if (code !== 0 || signal) failure ??= new Error('Language worker exited ' + (signal ?? code) + ': ' + detail);
            pending?.reject(failure ?? new Error('Language worker closed before replying'));
            resolve();
        };
        child.once('exit', exited); child.once('close', exited);
    });
    const closed = Promise.all([reaped, ...[child.stdout!, child.stderr!].map(stream =>
        new Promise<void>(resolve => stream.once('close', resolve)))]);
    const receive = async (label: string, limit: number, request?: { id: number; args: string[]; input: string }) => {
        assert(!pending && child.connected && !failure, 'Unavailable language worker for ' + label + ': ' + (failure ?? detail));
        const start = performance.now();
        let timer: NodeJS.Timeout | undefined;
        try {
            const reply = await new Promise<Reply>((resolve, reject) => {
                pending = { resolve, reject };
                timer = setTimeout(() => reject(new Error('Language operation timed out: ' + label)), limit);
                if (request) child.send(request, error => { if (error) reject(error); });
            });
            assert(performance.now() - start <= limit, 'Language operation timed out: ' + label);
            return reply;
        } finally { clearTimeout(timer); pending = undefined; }
    };
    const call: LanguageCommand = async (label, args, input) => {
        const id = ++sequence, reply = await receive(label, timeoutMs, { id, args, input });
        assert.equal(reply?.id, id, 'Unexpected language reply for ' + label);
        assert.equal(reply.code, 0, label + ': ' + reply.stderr);
        assert(typeof reply.stdout === 'string');
        return reply.stdout;
    };
    let completed = false;
    try {
        assert.deepEqual(await receive('worker startup', LANGUAGE_OPERATION_MS), { ready: true });
        const result = await body(call);
        completed = true; return result;
    } finally {
        if (completed && child.connected) child.disconnect();
        else if (!completed) child.kill('SIGKILL');
        if (!await withinExitBudget(closed)) {
            child.kill('SIGKILL');
            assert(await withinExitBudget(closed), 'Could not confirm language worker exit');
            throw new Error('Language worker did not exit within its cleanup budget');
        }
        if (completed && failure) throw failure;
    }
}
