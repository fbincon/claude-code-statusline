import * as fs from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { atomicWrite, durableUnlink, withLock } from '@fbincon/statusline-platform/files';
import { decodeUtf8 } from '@fbincon/statusline-platform/utf8';
import { errorDescription } from '@fbincon/statusline-platform/errors';
export { decodeUtf8 };
import { readJson } from '@fbincon/statusline-core/json-read';
import { pythonJson } from '@fbincon/statusline-core/json-text';
import { ConfigError, fail, object } from '@fbincon/statusline-core/config/validation';
import { CONFIG_FILENAME, defaultDisplay, validateDisplay } from '@fbincon/statusline-core/config/display';
import type { DisplayDraft } from '@fbincon/statusline-core/contracts/ui';
export interface Artifact {
    name: string;
    path: string;
    raw: Buffer | null;
}
export interface Storage {
    read(path: string): Buffer | null;
    write(path: string, raw: Buffer): void;
    remove(path: string): void;
    lock<T>(directory: string, action: () => T): T;
    backup(directory: string, action: string, artifacts: Artifact[]): string;
}
export function jsonBytes(value: unknown): Buffer { return Buffer.from(pythonJson(value, { ensureAscii: false, indent: 2 }) + '\n'); }
export const errorDetail = errorDescription;
export function privateDirectory(path: string): void {
    fs.mkdirSync(path, { recursive: true, mode: 0o700 });
    if (process.platform !== 'win32') {
        try {
            fs.chmodSync(path, 0o700);
        }
        catch { /* Match best-effort legacy permissions. */ }
    }
}
export function timestamp(now: Date): string {
    const pad = (n: number, size = 2) => String(n).padStart(size, '0');
    const zone = -now.getTimezoneOffset();
    return `${pad(now.getFullYear(), 4)}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}${now.getMilliseconds() ? '.' + pad(now.getMilliseconds(), 3) + '000' : ''}${zone < 0 ? '-' : '+'}${pad(Math.floor(Math.abs(zone) / 60))}:${pad(Math.abs(zone) % 60)}`;
}
export function createStorage(now: () => Date = () => new Date()): Storage {
    return {
        read(path) { try {
            return fs.readFileSync(path);
        }
        catch (e) {
            if ((e as NodeJS.ErrnoException).code === 'ENOENT')
                return null;
            throw e;
        } },
        write(path, raw) { atomicWrite(path, raw); },
        remove: durableUnlink,
        lock(directory, action) { const runtime = join(directory, 'statusline_runtime'); privateDirectory(runtime); return withLock(join(runtime, 'install.lock'), action); },
        backup(directory, action, artifacts) {
            try {
                const root = join(directory, 'backups/statusline');
                privateDirectory(root);
                const stamp = timestamp(now()).slice(0, 19).replaceAll('-', '').replaceAll(':', '').replace('T', '-');
                const base = join(root, `cli-${action}-${stamp}`);
                let path = base, suffix = 1;
                for (;;) {
                    try {
                        fs.mkdirSync(path, { mode: 0o700 });
                        break;
                    }
                    catch (e) {
                        if ((e as NodeJS.ErrnoException).code !== 'EEXIST')
                            throw e;
                        path = `${base}-${suffix++}`;
                    }
                }
                const recorded = artifacts.map(artifact => {
                    const state = artifact.raw === null ? 'absent' : 'before';
                    const target = join(path, `${artifact.name}.${state}`);
                    privateDirectory(dirname(target));
                    fs.writeFileSync(target, artifact.raw ?? Buffer.alloc(0), { mode: 0o600, flag: 'wx' });
                    return { path: artifact.path, state };
                });
                const metadata: Record<string, unknown> = { action, created_at: timestamp(now()), artifacts: recorded };
                const settings = artifacts.find(artifact => artifact.name === 'settings.json');
                if (settings)
                    metadata.settings_path = settings.path;
                fs.writeFileSync(join(path, 'metadata.json'), jsonBytes(metadata), { mode: 0o600, flag: 'wx' });
                return path;
            }
            catch (exc) {
                return fail('errors.storage.cannot_back_up_statusline_configuration', { exc: errorDetail(exc) });
            }
        },
    };
}
export function readDisplay(directory: string, io: Storage, tolerateInvalid = false): [
    DisplayDraft,
    Buffer | null
] {
    const path = join(directory, CONFIG_FILENAME);
    let raw: Buffer | null;
    try {
        raw = io.read(path);
    }
    catch (exc) {
        return fail('errors.display.cannot_read', { path, exc: errorDetail(exc) });
    }
    if (raw === null)
        return [defaultDisplay(), null];
    try {
        let data: unknown;
        try {
            data = readJson(decodeUtf8(raw), { duplicate(key) { throw new SyntaxError(`duplicate JSON field: ${key}`); } });
        }
        catch (exc) {
            return fail('errors.display.invalid_json_in', { path, exc: errorDetail(exc) });
        }
        return [validateDisplay(data), raw];
    }
    catch (exc) {
        if (tolerateInvalid && exc instanceof ConfigError)
            return [defaultDisplay(), raw];
        throw exc;
    }
}
export function readSettings(directory: string, io: Storage): [
    Record<string, unknown>,
    Buffer | null
] {
    const settings_path = join(directory, 'settings.json');
    let raw: Buffer | null;
    try {
        raw = io.read(settings_path);
    }
    catch (exc) {
        return fail('errors.storage.cannot_read', { settings_path, exc: errorDetail(exc) });
    }
    if (raw === null)
        return [{}, null];
    let data: unknown;
    try {
        data = readJson(decodeUtf8(raw));
    }
    catch (exc) {
        return fail('errors.storage.invalid_json_in', { settings_path, exc: errorDetail(exc) });
    }
    if (!object(data))
        fail('errors.storage.must_contain_a_json_object', { settings_path });
    return [data, raw];
}
export function artifact(path: string, raw: Buffer | null): Artifact { return { name: basename(path), path, raw }; }
