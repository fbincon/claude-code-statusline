import { basename, join } from 'node:path';
import { ownedCommand, splitCommand, normalizedPath } from '@fbincon/statusline-platform/commands';
import type { LaunchSpec } from '@fbincon/statusline-platform/launch';
import { readJson } from '@fbincon/statusline-core/json-read';
import { isSchema } from '@fbincon/statusline-core/config/display';
import { object } from '@fbincon/statusline-core/config/validation';
import { decodeUtf8, type Storage } from '../config/storage.js';
import { safeTarget } from './transaction.js';
import { OWNER } from './model.js';
export const BINDING_FILE = 'statusline_runtime/installation.json';
export function skillOwned(raw: Buffer | null): boolean {
    try {
        const value = readJson(decodeUtf8(raw!));
        return object(value) && Object.keys(value).length === 2 && value.owner === OWNER && isSchema(value.schema_version, 1);
    }
    catch {
        return false;
    }
}
export function previousBinding(directory: string, io: Storage): LaunchSpec | null {
    const path = join(directory, BINDING_FILE);
    safeTarget(directory, path);
    const raw = io.read(path);
    if (raw === null)
        return null;
    const value = readJson(decodeUtf8(raw), { duplicate(key) { throw new Error('Duplicate binding field: ' + key); } });
    if (!object(value) || Object.keys(value).sort().join(',') !== 'backend_version,launch,owner,schema_version' || value.owner !== OWNER || !isSchema(value.schema_version, 1) || typeof value.backend_version !== 'string' || !object(value.launch) || Object.keys(value.launch).sort().join(',') !== 'args,executable' || typeof value.launch.executable !== 'string' || !Array.isArray(value.launch.args) || !value.launch.args.every(x => typeof x === 'string' && !x.includes('\0')))
        throw new Error('Untrusted installation binding');
    return value.launch as unknown as LaunchSpec;
}
export function owns(command: unknown, operation: string, launch: LaunchSpec, previous?: LaunchSpec | null): boolean {
    if (ownedCommand(command, operation, launch) || previous && ownedCommand(command, operation, previous))
        return true;
    const argv = splitCommand(command);
    return !!argv && argv.length === 2 && argv[1] === operation && /^(?:claude-statusline|claude-statusline\.exe)$/iu.test(basename(argv[0]!.replaceAll('\\', '/')));
}
export function legacy(command: unknown, script: string): boolean {
    const argv = splitCommand(command);
    return !!argv && argv.length === 2 && /^python(?:[0-9.]+)?(?:\.exe)?$/iu.test(basename(argv[0]!.replaceAll('\\', '/'))) && normalizedPath(argv[1]!) === normalizedPath(script);
}
