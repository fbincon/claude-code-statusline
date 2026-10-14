import { join } from 'node:path';
import { sha256 } from '@fbincon/statusline-platform/hash';
import { decodeUtf8 } from '@fbincon/statusline-platform/utf8';
import { readJson } from '@fbincon/statusline-core/json-read';
import { pythonJson } from '@fbincon/statusline-core/json-text';
import { equalSettings } from '@fbincon/statusline-core/json-equality';
import { int, object, dictionary, own, type Data } from '@fbincon/statusline-core/runtime/values';
import { realPrompt, timestamp, roundedInteger } from '@fbincon/statusline-core/runtime/transcript';
import type { RuntimeContext } from '../context.js';
import { readStored, type RuntimeIO } from '../io.js';
export function readSubmissionChunk(io: RuntimeIO, path: string, cursor: bigint): {
    prompts: Data;
    cursor: bigint;
} {
    const prompts = dictionary();
    const end = io.lines(path, cursor, line => {
        if (!line.includes('"promptId"'))
            return;
        let row: unknown;
        try {
            row = readJson(decodeUtf8(line), { allowBom: true });
        }
        catch {
            return;
        }
        if (!object(row) || row.type !== 'user' || !object(row.message) || !realPrompt(row, row.message.content))
            return;
        const stamp = timestamp(row.timestamp);
        if (typeof row.promptId === 'string' && stamp !== null) {
            prompts[row.promptId] = roundedInteger(stamp * 1e9);
            while (Object.keys(prompts).length > 256)
                delete prompts[Object.keys(prompts)[0]!];
        }
    });
    return { prompts, cursor: end };
}
export class SubmissionIndex {
    constructor(public readonly context: RuntimeContext, public readonly io: RuntimeIO) { }
    time(path: string, promptId: string): bigint | null {
        try {
            const stat = this.io.stat(path), identity = [stat.dev, stat.ino], key = sha256(this.io.resolve(path));
            const target = join(this.context.runtimeRoot, 'submission-index', key + '.json');
            return this.io.lock(target.slice(0, -5) + '.lock', () => {
                let state: Data;
                try {
                    const loaded = readStored(this.io, target, true);
                    state = object(loaded) ? loaded : {};
                }
                catch {
                    state = {};
                }
                let cursor = Object.hasOwn(state, 'cursor') ? int(state.cursor) : 0n;
                if (!equalSettings(state.identity, identity) || cursor === null || cursor > stat.size || int(state.size) === stat.size && int(state.mtime_ns) !== stat.mtimeNs) {
                    state = {};
                    cursor = 0n;
                }
                const prompts = object(state.prompts) ? state.prompts : dictionary();
                const rows = cursor < stat.size ? readSubmissionChunk(this.io, path, cursor) : { prompts: {}, cursor };
                for (const [key, value] of Object.entries(rows.prompts))
                    Object.defineProperty(prompts, key, { value, enumerable: true, configurable: true, writable: true });
                while (Object.keys(prompts).length > 256)
                    delete prompts[Object.keys(prompts)[0]!];
                const updated = { identity, cursor: rows.cursor, size: stat.size, mtime_ns: stat.mtimeNs, prompts };
                if (!equalSettings(updated, state))
                    this.io.write(target, Buffer.from(pythonJson(updated)));
                return int(own(prompts, promptId));
            });
        }
        catch {
            return null;
        }
    }
}
