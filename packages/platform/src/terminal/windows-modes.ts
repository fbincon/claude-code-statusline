import { nativeFunction, winError } from '../native.js';

/** libuv's normal mode is a fixed mask, not the caller's complete console mode.
 * Restore the original standard-handle masks after Node stops raw input.
 * https://learn.microsoft.com/en-us/windows/console/setconsolemode
 * https://github.com/libuv/libuv/blob/v1.51.0/src/win/tty.c#L341
 */
export function captureWindowsModes(standardInput: boolean, standardOutput: boolean): () => void {
    if (process.platform !== 'win32' || !standardInput || !standardOutput)
        return () => {};
    const getHandle = nativeFunction('kernel32.dll', 'void *GetStdHandle(uint32_t kind)');
    const getMode = nativeFunction('kernel32.dll', 'bool GetConsoleMode(void *handle, _Out_ uint32_t *mode)');
    const setMode = nativeFunction('kernel32.dll', 'bool SetConsoleMode(void *handle, uint32_t mode)');
    const snapshots = [0xfffffff6, 0xfffffff5].map(kind => {
        const handle = getHandle(kind), mode = [0];
        if (!getMode(handle, mode))
            throw winError('GetConsoleMode');
        return { handle, mode: mode[0]! };
    });
    return () => {
        let failure: unknown;
        for (const saved of snapshots) {
            try {
                if (!setMode(saved.handle, saved.mode))
                    throw winError('SetConsoleMode');
                const actual = [0];
                if (!getMode(saved.handle, actual))
                    throw winError('GetConsoleMode');
                if (actual[0] !== saved.mode)
                    throw new Error('Console mode restoration did not match its original flags');
            } catch (error) { failure ??= error; }
        }
        if (failure) throw failure;
    };
}
