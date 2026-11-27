import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/** One private IPC channel. Each request consumes one reply before the next can start. */
export class ObservationProcess {
    private child?: ChildProcess;
    private exited: Promise<void> = Promise.resolve();
    private queue: Promise<void> = Promise.resolve();
    private closed = false;

    constructor(private readonly entry: URL) {}

    request(message: object, signal: AbortSignal): Promise<unknown> {
        const result = this.queue.then(() => this.exchange(message, signal));
        this.queue = result.then(() => {}, () => {});
        return result;
    }

    private start(): ChildProcess {
        const child = spawn(process.execPath, [fileURLToPath(this.entry)], {
            stdio: ['ignore', 'ignore', 'ignore', 'ipc'], serialization: 'advanced', windowsHide: true, shell: false,
        });
        this.child = child;
        child.on('error', () => this.stop(child));
        this.exited = new Promise(resolve => {
            const ended = () => {
                child.off('exit', ended);
                child.off('close', ended);
                if (this.child === child) this.child = undefined;
                resolve();
            };
            child.once('exit', ended);
            child.once('close', ended); // A failed spawn can close without starting a process.
        });
        return child;
    }

    private stop(child: ChildProcess): void {
        if (child !== this.child) return;
        this.child = undefined;
        child.kill('SIGKILL');
    }

    private async exchange(message: object, signal: AbortSignal): Promise<unknown> {
        // On Windows a retiring reader can still hold files in the private editor copy.
        if (!this.child) await this.exited;
        signal.throwIfAborted();
        if (this.closed) throw new Error('Observation process is closed');
        const child = this.child ?? this.start();
        return new Promise((resolve, reject) => {
            let settled = false;
            const cleanup = () => {
                settled = true;
                clearTimeout(timer);
                signal.removeEventListener('abort', aborted);
                child.off('message', received);
                child.off('error', failed);
                child.off('exit', ended);
                child.off('close', ended);
            };
            const received = (reply: unknown) => { cleanup(); resolve(reply); };
            const failed = (error: unknown) => {
                if (settled) return;
                cleanup();
                this.stop(child);
                reject(error);
            };
            const ended = () => failed(new Error('Observation process exited before replying'));
            const aborted = () => failed(signal.reason);
            const timer = setTimeout(() => failed(new Error('Observation timed out')), 30_000);
            child.once('message', received);
            child.once('error', failed);
            child.once('exit', ended);
            child.once('close', ended);
            signal.addEventListener('abort', aborted, { once: true });
            try {
                child.send(message, error => { if (error) failed(error); });
            } catch (error) { failed(error); }
        });
    }

    async close(): Promise<void> {
        this.closed = true;
        if (this.child) this.stop(this.child);
        await this.exited;
    }
}
