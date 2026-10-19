import * as fs from 'node:fs';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { atomicWrite, durableUnlink, isLinkOrReparse, privateDirectory, fileIdentity, sameFileIdentity } from '../files.js';
import { processToken, processMatches } from '../processes.js';
import { decodeUtf8 } from '../utf8.js';
import { decode, isLosslessNumber, safeInteger } from '@fbincon/statusline-core/json';
import type { LaunchSpec } from '@fbincon/statusline-core/integration/binding';
export const RESULT_ENV = 'CLAUDE_STATUSLINE_SLASH_RESULT', DEADLINE_ENV = 'CLAUDE_STATUSLINE_SLASH_DEADLINE_SECONDS';
export const REQUEST_ENV = 'CLAUDE_STATUSLINE_EDITOR_REQUEST', NONCE_ENV = 'CLAUDE_STATUSLINE_EDITOR_NONCE';
export const RESULT_LIMIT = 16 * 1024, DEADLINE_SECONDS = 570, LAUNCH_TIMEOUT = 585000;
export interface BridgeResult {
    schema_version: 1;
    outcome: 'updated' | 'already-current' | 'cancelled' | 'interrupted' | 'timed-out' | 'error';
    exit_code: number;
    message: string;
}
export interface Request {
    schema_version: 1;
    nonce: string;
    parent: number;
    parent_token: string;
    startup: number;
    expires: number;
    configDir: string;
    backend: LaunchSpec;
    cwd: string;
}
export class EditorRevoked extends Error {
    constructor() { super('Editor request revoked or parent identity changed'); this.name = 'EditorRevoked'; }
}
const json = (value: unknown) => JSON.stringify(value, null, 2) + '\n';
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
function strict(raw: Buffer): unknown {
    function value(input: unknown): unknown {
        if (isLosslessNumber(input))
            return safeInteger(input);
        if (Array.isArray(input))
            return input.map(value);
        if (object(input))
            return Object.fromEntries(Object.entries(input).map(([key, item]) => [key, value(item)]));
        return input;
    }
    return value(decode(decodeUtf8(raw)));
}
export function resultPath(configDir: string, raw: string): string {
    if (!isAbsolute(raw) || raw !== resolve(raw) || raw.includes('\0') || basename(raw) !== 'result.json' || dirname(dirname(raw)) !== join(configDir, 'statusline_runtime/slash_tui') || !/^invocation-[A-Za-z0-9_.-]+$/u.test(basename(dirname(raw))))
        throw new Error('Invalid slash TUI result path');
    for (const path of [configDir, join(configDir, 'statusline_runtime'), dirname(dirname(raw)), dirname(raw)]) {
        if (isLinkOrReparse(path) || !fs.lstatSync(path).isDirectory())
            throw new Error('Invalid slash TUI result directory');
    }
    if (process.platform !== 'win32' && (fs.statSync(dirname(raw)).mode & 0o777) !== 0o700)
        throw new Error('Slash TUI result directory is not private');
    return raw;
}
export function readPrivate(path: string, configDir: string): Buffer {
    resultPath(configDir, join(dirname(path), 'result.json'));
    const before = fs.lstatSync(path, { bigint: true });
    if (!before.isFile() || isLinkOrReparse(path) || before.size > RESULT_LIMIT)
        throw new Error('Invalid or oversized invocation file');
    if (process.platform !== 'win32' && (before.mode & 0o777n) !== 0o600n)
        throw new Error('Invocation file is not private');
    const identity = fileIdentity(path, before);
    const fd = fs.openSync(path, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
    try {
        const after = fs.fstatSync(fd, { bigint: true });
        if (!after.isFile() || !sameFileIdentity(identity, after) || after.size > RESULT_LIMIT)
            throw new Error('Invocation file changed while opening');
        const buffer = Buffer.alloc(RESULT_LIMIT + 1);
        let count = 0, read = 0;
        while (count < buffer.length && (read = fs.readSync(fd, buffer, count, buffer.length - count, null)))
            count += read;
        if (count > RESULT_LIMIT)
            throw new Error('Invocation file exceeds 16 KiB');
        return buffer.subarray(0, count);
    }
    finally {
        fs.closeSync(fd);
    }
}
export function readResult(path: string, configDir: string): BridgeResult {
    const value = strict(readPrivate(path, configDir));
    if (!object(value) || Object.keys(value).sort().join(',') !== 'exit_code,message,outcome,schema_version' || value.schema_version !== 1 || !['updated', 'already-current', 'cancelled', 'interrupted', 'timed-out', 'error'].includes(String(value.outcome)) || typeof value.exit_code !== 'number' || !Number.isInteger(value.exit_code) || value.exit_code < 0 || value.exit_code > 255 || typeof value.message !== 'string' || /[\x00-\x08\x0b-\x1f\x7f]/u.test(value.message))
        throw new Error('Invalid interactive editor result');
    if (['updated', 'already-current', 'cancelled', 'timed-out'].includes(String(value.outcome)) && value.exit_code !== 0)
        throw new Error('Successful result has an abnormal exit');
    return value as unknown as BridgeResult;
}
export function writeResult(path: string, configDir: string, outcome: Omit<BridgeResult, 'schema_version'>): void {
    resultPath(configDir, path);
    const body = json({ schema_version: 1, ...outcome });
    if (Buffer.byteLength(body) > RESULT_LIMIT)
        throw new Error('Interactive result exceeds 16 KiB');
    atomicWrite(path, body);
}
export function deadline(env: NodeJS.ProcessEnv, now = performance.now()): number {
    const raw = env[DEADLINE_ENV] ?? '', seconds = Number(raw);
    if (!raw.trim() || !Number.isFinite(seconds) || seconds <= 0 || seconds > DEADLINE_SECONDS)
        throw new Error('Invalid slash TUI deadline');
    return now + seconds * 1000;
}
export function prepare(configDir: string, backend: LaunchSpec, cwd: string, now = Date.now()) {
    const base = join(configDir, 'statusline_runtime/slash_tui');
    for (const path of [configDir, dirname(base), base])
        if (isLinkOrReparse(path))
            throw new Error('Runtime path is a symbolic link or reparse point');
    const token = processToken(process.pid);
    if (!token)
        throw new Error('Cannot establish launcher parent identity');
    privateDirectory(base);
    cleanupStale(base, now);
    const directory = fs.mkdtempSync(join(base, 'invocation-'));
    if (process.platform !== 'win32')
        fs.chmodSync(directory, 0o700);
    const request: Request = { schema_version: 1, nonce: randomUUID(), parent: process.pid, parent_token: token, startup: now + 30000, expires: now + LAUNCH_TIMEOUT, configDir, backend, cwd };
    const path = join(directory, 'request.json');
    atomicWrite(path, json(request));
    return { directory, path, request, result: join(directory, 'result.json') };
}
export function requestGuard(configDir: string, path: string, nonce: string, backend: LaunchSpec, now = Date.now()): () => void {
    if (basename(path) !== 'request.json' || !/^[0-9a-f-]{36}$/u.test(nonce))
        throw new Error('Invalid editor request');
    const original = readPrivate(path, configDir), value = strict(original);
    if (!object(value) || Object.keys(value).sort().join(',') !== 'backend,configDir,cwd,expires,nonce,parent,parent_token,schema_version,startup' || value.schema_version !== 1 || value.nonce !== nonce || value.configDir !== configDir || typeof value.cwd !== 'string' || !isAbsolute(value.cwd) || typeof value.parent !== 'number' || !Number.isSafeInteger(value.parent) || value.parent <= 0 || typeof value.parent_token !== 'string' || !value.parent_token || value.parent_token.length > 128 || typeof value.startup !== 'number' || typeof value.expires !== 'number' || !Number.isFinite(value.startup) || !Number.isFinite(value.expires) || value.startup < now || value.expires < now || value.expires - now > LAUNCH_TIMEOUT || !object(value.backend) || Object.keys(value.backend).sort().join(',') !== 'args,executable' || value.backend.executable !== backend.executable || JSON.stringify(value.backend.args) !== JSON.stringify(backend.args))
        throw new Error('Expired or mismatched editor request');
    const parent = value.parent, token = value.parent_token;
    const guard = () => {
        try {
            if (readPrivate(path, configDir).equals(original) && processMatches(parent, token))
                return;
        }
        catch { /* Missing and replaced requests revoke the lease. */ }
        throw new EditorRevoked();
    };
    guard();
    const ownToken = processToken(process.pid);
    if (!ownToken)
        throw new Error('Cannot establish editor identity');
    fs.writeFileSync(join(dirname(path), 'started.json'), json({ schema_version: 1, nonce, pid: process.pid, token: ownToken }), { mode: 0o600, flag: 'wx' });
    return guard;
}
export function started(directory: string, configDir: string, nonce: string): {
    pid: number;
    token: string;
} {
    const value = strict(readPrivate(join(directory, 'started.json'), configDir));
    if (!object(value) || Object.keys(value).sort().join(',') !== 'nonce,pid,schema_version,token' || value.schema_version !== 1 || value.nonce !== nonce || typeof value.pid !== 'number' || !Number.isSafeInteger(value.pid) || value.pid <= 0 || typeof value.token !== 'string' || !value.token || value.token.length > 128)
        throw new Error('Invalid editor handshake');
    return { pid: value.pid, token: value.token };
}
export function cleanup(directory: string): void {
    // Only known files of this invocation are removed. Unknown files and links survive.
    for (const name of ['request.json', 'started.json', 'result.json', 'terminal.command']) {
        const path = join(directory, name);
        try {
            if (!isLinkOrReparse(path) && fs.lstatSync(path).isFile())
                durableUnlink(path);
        }
        catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
                throw error;
        }
    }
    try {
        fs.rmdirSync(directory);
    }
    catch (error) {
        if (!['ENOTEMPTY', 'EEXIST', 'ENOENT'].includes((error as NodeJS.ErrnoException).code ?? ''))
            throw error;
    }
}
export function cleanupStale(base: string, now = Date.now()): void {
    if (!fs.existsSync(base) || isLinkOrReparse(base))
        return;
    for (const entry of fs.readdirSync(base, { withFileTypes: true }).slice(0, 1024)) {
        const path = join(base, entry.name);
        if (!entry.isDirectory() || !/^invocation-[A-Za-z0-9_.-]+$/u.test(entry.name) || isLinkOrReparse(path) || now - fs.lstatSync(path).mtimeMs < 86400000)
            continue;
        try {
            const names = fs.readdirSync(path);
            if (names.some(name => !['request.json', 'started.json', 'result.json', 'terminal.command'].includes(name) || isLinkOrReparse(join(path, name)) || !fs.lstatSync(join(path, name)).isFile()))
                continue;
            const configDir = dirname(dirname(base));
            if (names.includes('request.json')) {
                const request = strict(readPrivate(join(path, 'request.json'), configDir)) as Request;
                if (processMatches(request.parent, request.parent_token))
                    continue;
            }
            if (names.includes('started.json')) {
                const editor = strict(readPrivate(join(path, 'started.json'), configDir)) as { pid: number; token: string };
                if (processMatches(editor.pid, editor.token))
                    continue;
            }
            // Python invocations predate request.json. An old directory containing
            // only known, regular artifacts remains safe to remove.
            cleanup(path);
        }
        catch { /* Unverifiable ownership is retained. */ }
    }
}
