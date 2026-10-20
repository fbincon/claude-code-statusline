import * as fs from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Draft } from '@fbincon/statusline-core/contracts/ui';
import { readJson } from '@fbincon/statusline-core/json-read';
import { validateDraft } from '@fbincon/statusline-core/config/draft';
import { isSchema } from '@fbincon/statusline-core/config/display';
import { FORMAT, VERSION, MAX_BYTES, exportText } from '@fbincon/statusline-core/config/transfer';
import { fail, object, ConfigError } from '@fbincon/statusline-core/config/validation';
import { expandUser, resolvedPath } from '@fbincon/statusline-platform/commands';
import { retryWindows, syncDirectory } from '@fbincon/statusline-platform/files';
import { decodeUtf8, errorDetail } from './storage.js';
export function importFile(path: string, current: Draft): Draft {
    const fd = fs.openSync(expandUser(path), 'r');
    let raw: Buffer;
    try {
        const buffer = Buffer.alloc(MAX_BYTES + 1);
        let size = 0, count: number;
        while (size < buffer.length && (count = fs.readSync(fd, buffer, size, buffer.length - size, null)) > 0)
            size += count;
        raw = buffer.subarray(0, size);
    }
    finally {
        fs.closeSync(fd);
    }
    if (raw.length > MAX_BYTES)
        fail('errors.transfer.import_is_larger_than_1_mib');
    let data: unknown;
    try {
        data = readJson(decodeUtf8(raw), {
            allowBom: true,
            duplicate(value0) { return fail('errors.transfer.duplicate_transfer_field', { value0 }); },
            constant(value0) { return fail('errors.transfer.non_finite_transfer_value', { value0 }); },
        });
    }
    catch (exc) {
        if (exc instanceof ConfigError)
            throw exc;
        return fail('errors.transfer.invalid_import_json', { exc: errorDetail(exc) });
    }
    if (object(data) && Object.hasOwn(data, 'schema_version'))
        return validateDraft({ display: data, host: current.host });
    if (!object(data) || Object.keys(data).length !== 3 || !['format', 'version', 'draft'].every(key => Object.hasOwn(data, key)))
        fail('errors.transfer.import_requires_a_portable_envelope_or_a');
    if (data.format !== FORMAT || !isSchema(data.version, VERSION))
        fail('errors.transfer.unsupported_portable_configuration_format_version');
    return validateDraft(data.draft);
}
export function exportFile(path: string, draft: Draft, directory: string, overwrite = false): string {
    const raw = Buffer.from(exportText(draft));
    return exportBytes(path, raw, directory, overwrite);
}
export function exportBytes(path: string, raw: Buffer, directory: string, overwrite = false): string {
    path = resolve(expandUser(path));
    const target = resolvedPath(path), root = resolvedPath(directory);
    const same = (left: string, right: string) => process.platform === 'win32' ? left.toLowerCase() === right.toLowerCase() : left === right;
    const protectedFile = ['settings.json', 'claude-statusline.json', 'claude-statusline-profiles.json', 'claude-statusline-features.json', 'claude-statusline-native.json', 'claude-statusline-runtime.json', 'statusline-ui.json'].some(name => same(target, join(root, name)));
    const ownedDirectory = ['statusline-native', 'statusline-runtime', 'statusline_runtime'].some(name => {
        const rel = relative(join(root, name), target);
        return rel !== '' && rel !== '..' && !rel.startsWith('..' + (process.platform === 'win32' ? '\\' : '/')) && !isAbsolute(rel);
    });
    if (protectedFile || ownedDirectory)
        fail('errors.transfer.export_cannot_replace_live_configuration_or_owned');
    if (raw.length > MAX_BYTES)
        fail('errors.transfer.export_is_larger_than_1_mib');
    const temporary = join(dirname(path), `.statusline-export-${randomUUID()}`);
    const fd = fs.openSync(temporary, 'wx', 0o600);
    try {
        try {
            fs.writeFileSync(fd, raw);
            fs.fsyncSync(fd);
        }
        finally {
            fs.closeSync(fd);
        }
        if (overwrite)
            retryWindows(() => fs.renameSync(temporary, path));
        else
            fs.linkSync(temporary, path);
        syncDirectory(path);
    }
    finally {
        try {
            fs.unlinkSync(temporary);
        }
        catch (e) {
            if ((e as NodeJS.ErrnoException).code !== 'ENOENT')
                throw e;
        }
    }
    return path;
}
