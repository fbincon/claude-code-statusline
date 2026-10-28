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
