import type { ReadStream, WriteStream } from 'node:tty';
import { KeyDecoder, type Key } from './input.js';
import { captureWindowsModes } from './windows-modes.js';
export interface TerminalClient<T> {
    draw(columns: number, rows: number): string;
    key(key: Key, columns: number, rows: number): T | null | Promise<T | null>;
    interrupted(signal: NodeJS.Signals): T;
    timeout(): T;
    guard?(): void;
}
export interface TerminalOptions {
    input?: ReadStream;
    output?: WriteStream;
    deadline?: number;
    now?: () => number;
    term?: string;
}
/** The sole raw-mode owner. Exit handlers never leave a queued read keeping Node alive. */
export async function terminal<T>(client: TerminalClient<T>, options: TerminalOptions = {}): Promise<T> {
    const input = options.input ?? process.stdin, output = options.output ?? process.stdout;
    if (!input.isTTY || !output.isTTY || typeof input.setRawMode !== 'function')
        throw new Error('TTY required');
    if (process.platform !== 'win32' && (options.term ?? process.env.TERM) === 'dumb')
        throw new Error('Interactive configuration requires an ANSI/VT terminal');
    const now = options.now ?? (() => performance.now()), decoder = new KeyDecoder();
    const raw = input.isRaw, flowing = input.readableFlowing;
    const restoreConsoleModes = captureWindowsModes(input === process.stdin, output === process.stdout);
    let escapeTimer: ReturnType<typeof setTimeout> | undefined, poll: ReturnType<typeof setInterval> | undefined;
    let closed = false, queued = 0, chain = Promise.resolve(), drainWait: (() => void) | null = null;
    const size = () => [output.columns || 80, output.rows || 24] as const;
    return new Promise<T>((resolve, reject) => {
        const cleanup = () => {
            if (closed)
                return;
            closed = true;
            clearTimeout(escapeTimer);
            clearInterval(poll);
            drainWait?.();
            input.off('data', data);
            input.off('error', failed);
            input.off('end', ended);
            output.off('resize', resize);
            output.off('error', failed);
            for (const [signal, handler] of handlers)
                process.off(signal, handler);
            try {
                input.setRawMode(raw);
            }
            catch { /* Continue restoring output even when input disappeared. */ }
            input.pause();
            if (input === process.stdin)
                input.destroy();
            else if (flowing === true)
                input.resume();
            try {
                output.write('\x1b[0m\x1b[?2004l\x1b[?25h\x1b[?1049l');
            }
            catch { /* A closed terminal cannot receive restoration bytes. */ }
            try { restoreConsoleModes(); }
            catch (error) { return error; }
        };
        const finish = (value: T) => { const error = cleanup(); error ? reject(error) : resolve(value); };
        const failed = (error: unknown) => { const restoration = cleanup(); reject(restoration ? new AggregateError([error, restoration], 'Terminal cleanup failed') : error); };
        const ended = () => finish(client.interrupted('SIGHUP'));
        const draw = async () => {
            if (closed)
                return;
            try {
                const content = client.draw(...size());
                await new Promise<void>(resolve => {
                    const done = () => { output.off('drain', done); if (drainWait === done)
                        drainWait = null; resolve(); };
                    drainWait = done;
                    if (output.write(content))
                        done();
                    else
                        output.once('drain', done);
                });
            }
            catch (error) {
                failed(error);
            }
        };
        const enqueue = (keys: Key[]) => {
            if (!keys.length || closed)
                return;
            if (queued + keys.length > 4096) {
                failed(new Error('Terminal input queue exceeded its bound'));
                return;
            }
            queued += keys.length;
            chain = chain.then(async () => {
                for (const key of keys) {
                    queued--;
                    if (closed)
                        return;
                    client.guard?.();
                    if (options.deadline !== undefined && now() >= options.deadline) {
                        finish(client.timeout());
                        return;
                    }
                    const value = await client.key(key, ...size());
                    if (closed)
                        return;
                    if (value !== null) {
                        finish(value);
                        return;
                    }
                }
                await draw();
            }).catch(failed);
        };
        const data = (chunk: Buffer) => {
            if (closed)
                return;
            clearTimeout(escapeTimer);
            enqueue(decoder.push(chunk));
            if (decoder.pendingEscape)
                escapeTimer = setTimeout(() => enqueue(decoder.flushEscape()), 25);
        };
        const resize = () => enqueue([{ key: 'resize' }]);
        const signals: NodeJS.Signals[] = process.platform === 'win32' ? ['SIGINT', 'SIGTERM', 'SIGBREAK'] : ['SIGINT', 'SIGTERM', 'SIGHUP'];
        const handlers = signals.map(signal => [signal, () => finish(client.interrupted(signal))] as const);
        try {
            client.guard?.();
            input.setRawMode(true);
            input.on('data', data);
            input.on('error', failed);
            input.on('end', ended);
            output.on('resize', resize);
            output.on('error', failed);
            for (const [signal, handler] of handlers)
                process.on(signal, handler);
            output.write('\x1b[?1049h\x1b[?25l\x1b[?2004h');
            chain = draw();
            if (closed)
                return;
            input.resume();
            poll = setInterval(() => {
                if (closed)
                    return;
                try {
                    client.guard?.();
                    if (options.deadline !== undefined && now() >= options.deadline)
                        finish(client.timeout());
                }
                catch (error) {
                    failed(error);
                }
            }, 250);
        }
        catch (error) {
            failed(error);
        }
    });
}
