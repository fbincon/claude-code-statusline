import { spawn } from 'node:child_process';
/** Fixed internal worker, literal arguments, no shell or inherited output pipes. */
export function startReviewWorker(entry: string, args: readonly string[], directory: string): number {
    const child = spawn(process.execPath, [entry, ...args], { cwd: directory, env: process.env, stdio: 'ignore', detached: true, windowsHide: true, shell: false });
    child.on('error', () => { }); // The bounded job startup deadline reports unavailable workers.
    child.unref();
    if (!child.pid)
        throw new Error('Review worker could not start');
    return child.pid;
}

/** Keep cancellation inside the native request budget; never infer exit from a signal. */
export function waitReviewExit(stopped: () => boolean, timeoutMs = 10000): boolean {
    const deadline = Date.now() + timeoutMs;
    const wait = new Int32Array(new SharedArrayBuffer(4));
    while (!stopped()) {
        if (Date.now() >= deadline) return false;
        Atomics.wait(wait, 0, 0, 25);
    }
    return true;
}
