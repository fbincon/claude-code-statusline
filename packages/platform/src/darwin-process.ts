/** Read the supported 64-bit proc_bsdinfo ABI; preserve the historical C/UTC ps token. */
import { nativeFunction } from './native.js';
const SIZE = 136;
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// Apple XNU bsd/sys/proc_info.h: PROC_PIDTBSDINFO, pbi_pid, pbi_status,
// pbi_start_tvsec/usec. Never accept a short structure or a different PID.
export function decodeDarwinProcess(bytes: Buffer, pid: number): { token: string; alive: boolean } | null {
    if (bytes.length !== SIZE || bytes.readUInt32LE(12) !== pid) return null;
    const status = bytes.readUInt32LE(4), seconds = bytes.readBigUInt64LE(120), micros = bytes.readBigUInt64LE(128);
    if (status < 1 || status > 5 || seconds === 0n || seconds > 8640000000000n || micros >= 1000000n) return null;
    const date = new Date(Number(seconds) * 1000), year = date.getUTCFullYear();
    if (!Number.isFinite(year) || year < 1970 || year > 9999) return null;
    const two = (value: number) => String(value).padStart(2, '0');
    const token = `${DAYS[date.getUTCDay()]} ${MONTHS[date.getUTCMonth()]} ${String(date.getUTCDate()).padStart(2, ' ')} ${two(date.getUTCHours())}:${two(date.getUTCMinutes())}:${two(date.getUTCSeconds())} ${year}`;
    return { token, alive: status !== 5 };
}
export function darwinProcess(pid: number): { token: string; alive: boolean } | null {
    if (!Number.isSafeInteger(pid) || pid <= 0 || pid > 0x7fffffff) return null;
    try {
        const bytes = Buffer.alloc(SIZE);
        const count = nativeFunction('/usr/lib/libproc.dylib', 'int proc_pidinfo(int pid, int flavor, uint64_t arg, _Out_ void *buffer, int size)')(pid, 3, 0, bytes, SIZE);
        return count === SIZE ? decodeDarwinProcess(bytes, pid) : null;
    } catch { return null; }
}
