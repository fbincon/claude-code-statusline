/** One official Claude validation per machine, across checkouts and isolated test environments. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import { userInfo } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { sample } from '@fbincon/statusline-platform/clocks';
import { isLinkOrReparse, lock } from '@fbincon/statusline-platform/files';
import { nativeApi, nativeFunction, winError } from '@fbincon/statusline-platform/native';
import { readPrivateState } from '@fbincon/statusline-platform/private-state';
import { processAlive, processToken } from '@fbincon/statusline-platform/processes';

const KIND = 'claude-statusline-official-host-v1';
const LIMIT = 4 * 1024 * 1024;
export const HOST_GATE_WAIT_MS = 3 * 60 * 60_000;
type ProcessRow = { token: string | null; parent: number; session: number };
type Census = Record<string, ProcessRow>;
interface Claim { kind: typeof KIND; id: string; account: string; host: string; pid: number; token: string; boot: string | null; pidNamespace: string; initial: Census }
interface Options { timeoutMs?: number; signal?: AbortSignal; /** Isolated scope for subprocess tests only. */ directory?: string }

function windowsDirectory(): string {
    const buffer = Buffer.alloc(32_768 * 2);
    const size = nativeFunction('kernel32.dll', 'uint32_t GetWindowsDirectoryW(_Out_ void *buffer, uint32_t size)')(buffer, buffer.length / 2);
    assert(size > 0 && size < buffer.length / 2, 'Cannot identify the machine Windows directory');
    return buffer.toString('utf16le', 0, size * 2);
}

function command(file: string, args: string[]) {
    const result = spawnSync(file, args, { encoding: 'utf8', windowsHide: true, timeout: 12_000, maxBuffer: LIMIT });
    assert.ifError(result.error); assert.equal(result.status, 0, 'Cannot inspect validation process ownership');
    return result;
}

function windowsParents(): Map<number, number> {
    const k = (declaration: string) => nativeFunction('kernel32.dll', declaration);
    const handle = k('void *CreateToolhelp32Snapshot(uint32_t flags, uint32_t pid)')(2, 0);
    const wide = process.arch !== 'ia32', invalid = wide ? 0xffffffffffffffffn : 0xffffffffn;
    if (!handle || nativeApi().address(handle) === invalid) throw winError('CreateToolhelp32Snapshot');
    const parents = new Map<number, number>();
    try {
        // PROCESSENTRY32W aligns th32DefaultHeapID to the native pointer size.
        const entry = Buffer.alloc(wide ? 568 : 556); entry.writeUInt32LE(entry.length);
        const first = k('bool Process32FirstW(void *snapshot, _Inout_ void *entry)'), errorCode = k('uint32_t GetLastError()');
        const next = k('bool Process32NextW(void *snapshot, _Inout_ void *entry)');
        if (!first(handle, entry)) throw winError('Process32FirstW');
        do { parents.set(entry.readUInt32LE(8), entry.readUInt32LE(wide ? 32 : 24)); } while (next(handle, entry));
        if (errorCode() !== 18) throw winError('Process32NextW');
    } finally { k('bool CloseHandle(void *handle)')(handle); }
    return parents;
}

export function defaultHostGateDirectory(): string {
    return process.platform === 'win32' ? join(windowsDirectory(), 'Temp') : '/tmp';
}

/** Include all processes of the OS account. Only birth identities and ancestry are stored. */
function census(): Census {
    const rows: Census = {};
    if (process.platform === 'linux') {
        const uid = process.geteuid!();
        for (const pid of fs.readdirSync('/proc').filter(name => /^\d+$/u.test(name))) {
            try {
                if (fs.statSync('/proc/' + pid).uid !== uid) continue;
                const raw = fs.readFileSync('/proc/' + pid + '/stat', 'utf8');
                const fields = raw.slice(raw.lastIndexOf(')') + 2).trim().split(/\s+/u);
                if (!['Z', 'X'].includes(fields[0]!)) rows[pid] = { token: fields[19] ?? null, parent: Number(fields[1]), session: Number(fields[3]) };
            } catch (error) { if (!['ENOENT', 'ESRCH'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error; }
        }
    } else if (process.platform === 'darwin') {
        const uid = process.geteuid!(), ps = command('/bin/ps', ['-axo', 'pid=,ppid=,uid=,stat=']);
        const getSession = nativeFunction('/usr/lib/libSystem.B.dylib', 'int getsid(int pid)');
        for (const line of ps.stdout.trim().split('\n')) {
            const [id, parent, user, state] = line.trim().split(/\s+/u), pid = Number(id);
            if (Number(user) !== uid || pid === ps.pid || state?.startsWith('Z')) continue;
            rows[pid] = { token: processToken(pid), parent: Number(parent), session: Number(getSession(pid)) };
        }
    } else {
        assert.equal(process.platform, 'win32');
        const system = join(windowsDirectory(), 'System32');
        const name = Buffer.alloc(4096 * 2), size = [name.length / 2];
        if (!nativeFunction('secur32.dll', 'uint8_t GetUserNameExW(uint32_t format, _Out_ void *name, _Inout_ uint32_t *size)')(2, name, size))
            throw winError('GetUserNameExW');
        const user = name.toString('utf16le', 0, size[0]! * 2), parents = windowsParents();
        const list = command(join(system, 'tasklist.exe'), ['/FI', 'USERNAME eq ' + user, '/FO', 'CSV', '/NH']);
        for (const line of list.stdout.trim().split(/\r?\n/u)) {
            const match = /^"(?:[^"\r\n]|"")*","(\d+)"/u.exec(line);
            assert(match, 'Incomplete Windows validation process inventory');
            const pid = Number(match[1]);
            if (pid !== list.pid) rows[pid] = { token: processToken(pid), parent: parents.get(pid) ?? 0, session: 0 };
        }
    }
    assert(rows[process.pid]?.token, 'Cannot establish a complete validation process inventory');
    return rows;
}

function ancestors(pid: number, rows: Census): Set<number> {
    const result = new Set<number>();
    while (pid > 0 && !result.has(pid)) { result.add(pid); pid = rows[pid]?.parent ?? 0; }
    return result;
}

/** A killed parent can leave detached or reparented workers behind. Never infer their exit from the parent alone. */
function possibleSurvivors(claim: Claim, now: Census, waiting: Set<number>): number[] {
    const adopters = ancestors(claim.pid, claim.initial), originalSession = claim.initial[claim.pid]!.session;
    const old = new Set<number>(), independentSessions = new Set<number>();
    for (const [id, row] of Object.entries(now)) {
        const baseline = claim.initial[id];
        if (!baseline || !row.token || baseline.token !== row.token) continue;
        old.add(Number(id));
        // A POSIX descendant may create a new session. It cannot join another surviving session.
        if (row.session > 0 && row.session === baseline.session && row.session !== originalSession) independentSessions.add(row.session);
    }
    return Object.entries(now).filter(([id, row]) => {
        const pid = Number(id);
        if (waiting.has(pid) || old.has(pid) || independentSessions.has(row.session)) return false;
        // An orphan may be adopted by an original ancestor (or init), never by an unrelated existing process.
        return ![...ancestors(row.parent, now)].some(parent => old.has(parent) && !adopters.has(parent));
    }).map(([id]) => Number(id));
}

function readClaim(path: string): Claim | null {
    let raw: Buffer;
    try { raw = readPrivateState(path, LIMIT); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
    const c = JSON.parse(raw.toString('utf8')) as Claim;
    assert(c.kind === KIND && typeof c.id === 'string' && /^[0-9a-f-]{36}$/u.test(c.id) && typeof c.account === 'string' &&
        typeof c.host === 'string' && Number.isSafeInteger(c.pid) && c.pid > 0 && typeof c.token === 'string' && c.token.length &&
        (c.boot === null || typeof c.boot === 'string') && typeof c.pidNamespace === 'string' && c.initial && c.initial[c.pid]?.token === c.token &&
        Object.values(c.initial).every(row => row && Number.isInteger(row.parent) && Number.isInteger(row.session) &&
            (row.token === null || typeof row.token === 'string')), 'Unrecognized official host gate record; retained');
    return c;
}

function publish(path: string, claim: Claim): boolean {
    const temporary = path + '.' + claim.id;
    const data = JSON.stringify(claim);
    assert(Buffer.byteLength(data) <= LIMIT, 'Official host process inventory exceeds its limit');
    fs.writeFileSync(temporary, data, { flag: 'wx', mode: 0o600, flush: true });
    try {
        try { fs.linkSync(temporary, path); return true; } // Publish complete bytes without replacing another OS account's claim.
        catch (error) { if ((error as NodeJS.ErrnoException).code === 'EEXIST') return false; throw error; }
    } finally { fs.unlinkSync(temporary); }
}

function removeOwned(path: string, id: string): void {
    assert.equal(readClaim(path)?.id, id, 'Official host gate ownership changed; retained');
    fs.unlinkSync(path);
}

function busy(error: unknown): boolean {
    const e = error as Error & { winerror?: number };
    return e.winerror === 33 || e.message === 'flock failed' || e.message === 'Recursive acquisition of a synchronous file lock';
}

function waiters(path: string, now: Census, pidNamespace: string, boot: string | null): Set<number> {
    const result = new Set<number>();
    for (const name of fs.readdirSync(path)) {
        const match = /^(\d+)-([0-9a-f-]{36})\.json$/u.exec(name);
        if (!match) continue;
        const pid = Number(match[1]);
        let ticket;
        try { ticket = JSON.parse(readPrivateState(join(path, name), 1024).toString('utf8')); }
        catch { continue; } // A waiter may finish or cancel during the observation. Unknown records never excuse a PID.
        if (ticket.id === match[2] && ticket.pid === pid && ticket.pidNamespace === pidNamespace && ticket.boot === boot &&
            typeof ticket.token === 'string' && ticket.token === now[pid]?.token) result.add(pid);
    }
    return result;
}

/** Take the gate before probing or running a host. Release only after the caller has drained its workers. */
export async function acquireHostVersionGate(host: string, options: Options = {}): Promise<() => void> {
    const timeout = options.timeoutMs ?? HOST_GATE_WAIT_MS;
    assert(host.trim().length && host.length <= 200 && Number.isFinite(timeout) && timeout >= 0, 'Invalid official host gate request');
    const directory = options.directory ?? defaultHostGateDirectory();
    const user = userInfo(), account = createHash('sha256').update(JSON.stringify([user.uid, user.username, user.homedir])).digest('hex');
    const path = join(directory, KIND + '.json'), mutex = join(directory, KIND + '-' + account + '.lock');
    const pidNamespace = process.platform === 'linux' ? fs.readlinkSync('/proc/self/ns/pid') : process.platform;
    const waiting = mutex + '.waiting'; fs.mkdirSync(waiting, { recursive: true, mode: 0o700 });
    const info = fs.lstatSync(waiting); assert(info.isDirectory() && !isLinkOrReparse(waiting) &&
        (process.platform === 'win32' || info.uid === user.uid && (info.mode & 0o077) === 0), 'Unsafe official host queue directory');
    const token = processToken(process.pid); assert(token, 'Cannot identify the validation process');
    const id = randomUUID(), ticket = join(waiting, `${process.pid}-${id}.json`), boot = sample().boot_id;
    const ticketBytes = JSON.stringify({ id, pid: process.pid, token, pidNamespace, boot });
    fs.writeFileSync(ticket, ticketBytes, { flag: 'wx', mode: 0o600 });
    let release: (() => void) | undefined;
    try { release = await acquire(); return release; }
    finally {
        try { assert.equal(readPrivateState(ticket, 1024).toString('utf8'), ticketBytes, 'Official queue ticket changed'); fs.unlinkSync(ticket); }
        catch (error) { release?.(); throw error; }
    }

    async function acquire() {
    const deadline = performance.now() + timeout;
    let reason = 'another validation owns the machine gate';
    do {
        options.signal?.throwIfAborted();
        let unlock: (() => void) | undefined;
        try { unlock = lock(mutex, true); } catch (error) { if (!busy(error)) throw error; }
        if (unlock) {
            let claimed = false;
            try {
                let meta: fs.Stats | undefined | null;
                try { meta = fs.lstatSync(path, { throwIfNoEntry: false }); }
                catch (error) { if (!['EACCES', 'EPERM'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error; meta = null; }
                if (meta === null || meta && process.platform !== 'win32' && meta.uid !== user.uid) reason = 'another OS account owns the machine gate';
                else {
                    let previous: Claim | null | undefined;
                    try { previous = readClaim(path); }
                    catch (error) {
                        if (!meta || !['EACCES', 'EPERM'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error;
                        reason = 'another OS account owns an inaccessible machine claim';
                    }
                    let available = previous === null;
                    if (previous?.account === account) {
                        if (boot && previous.boot && boot !== previous.boot) available = true;
                        else if (previous.pidNamespace === pidNamespace && processAlive(previous.pid, previous.token) === false) {
                            const now = census(), remaining = possibleSurvivors(previous, now, waiters(waiting, now, pidNamespace, boot));
                            available = remaining.length === 0;
                            reason = 'previous ' + previous.host + ' exited; possible surviving processes: ' + remaining.slice(0, 12).join(', ');
                        } else reason = 'previous ' + previous.host + ' owner is live or unverifiable';
                        if (available) removeOwned(path, previous.id);
                    }
                    if (available) {
                        const initial = census(), token = initial[process.pid]!.token!;
                        const claim: Claim = { kind: KIND, id: randomUUID(), account, host, pid: process.pid, token, boot, pidNamespace, initial };
                        if (publish(path, claim)) {
                            claimed = true;
                            let active = true;
                            return () => { if (active) { active = false; try { removeOwned(path, claim.id); } finally { unlock!(); } } };
                        }
                    }
                }
            } finally { if (!claimed) unlock(); }
        }
        const left = deadline - performance.now();
        if (left <= 0) break;
        await delay(Math.min(250, left), undefined, { signal: options.signal });
    } while (performance.now() <= deadline);
    throw new Error('Timed out waiting for the official host gate for ' + host + ': ' + reason);
    }
}
