import { object, int, type Data } from './values.js';
import { trim } from './transcript.js';
export const GIT_CACHE_VERSION = 2, GIT_CACHE_TTL_NS = 500000000n, GIT_CACHE_MAX_AGE_NS = 7n * 24n * 60n * 60n * 1000000000n, GIT_CACHE_MAX_FILES = 128;
export function validGitResult(value: unknown): value is Data {
    if (!object(value))
        return false;
    if (value.kind === 'not_repo' || value.kind === 'error')
        return true;
    if (value.kind !== 'ok' || typeof value.branch !== 'string' || !value.branch || typeof value.upstream_gone !== 'boolean')
        return false;
    if (['oid', 'upstream'].some(key => value[key] != null && typeof value[key] !== 'string'))
        return false;
    return ['ahead', 'behind', 'staged', 'unstaged', 'conflicts', 'untracked'].every(key => { const count = int(value[key]); return count !== null && count >= 0n; });
}
function decimal(value: string): bigint {
    const raw = trim(value);
    if (!/^[+-]?\d(?:_?\d)*$/u.test(raw))
        throw new Error('Invalid integer');
    return BigInt(raw.replaceAll('_', ''));
}
export function parsePorcelain(raw: string): Data {
    const error = { kind: 'error' };
    let oid: string | null = null, head: string | null = null, upstream: string | null = null, ahead = 0n, behind = 0n, abSeen = false;
    let staged = 0n, unstaged = 0n, conflicts = 0n, untracked = 0n;
    for (const line of raw.split(/\r\n|[\n\r\v\f\x1c-\x1e\x85\u2028\u2029]/u)) {
        if (line.startsWith('# ')) {
            const at = line.indexOf(' ', 2), key = line.slice(2, at), value = at < 0 ? '' : line.slice(at + 1);
            if (at < 0 || !value)
                return error;
            if (key === 'branch.oid')
                oid = value;
            else if (key === 'branch.head')
                head = value;
            else if (key === 'branch.upstream')
                upstream = value;
            else if (key === 'branch.ab') {
                const fields = trim(value).split(/[\p{White_Space}\x1c-\x1f]+/u);
                if (fields.length !== 2 || !fields[0]!.startsWith('+') || !fields[1]!.startsWith('-'))
                    return error;
                try {
                    ahead = decimal(fields[0]!.slice(1));
                    behind = decimal(fields[1]!.slice(1));
                }
                catch {
                    return error;
                }
                if (ahead < 0n || behind < 0n)
                    return error;
                abSeen = true;
            }
            continue;
        }
        if (line.startsWith('1 ') || line.startsWith('2 ')) {
            const at = line.indexOf(' ', 2), xy = line.slice(2, at);
            if (at < 0 || [...xy].length !== 2)
                return error;
            const [x, y] = [...xy];
            if (x !== '.') {
                if (!'MTADRC'.includes(x!))
                    return error;
                staged++;
            }
            if (y !== '.') {
                if (!'MTADRC'.includes(y!))
                    return error;
                unstaged++;
            }
        }
        else if (line.startsWith('u '))
            conflicts++;
        else if (line.startsWith('? '))
            untracked++;
        else if (line.startsWith('! '))
            continue;
        else if (line)
            return error;
    }
    if (!head || !oid || head === '(detached)' && oid === '(initial)')
        return error;
    return { kind: 'ok', branch: head === '(detached)' ? 'HEAD@' + oid.slice(0, 7) : head, oid: oid === '(initial)' ? null : oid, upstream,
        ahead, behind, upstream_gone: upstream !== null && !abSeen, staged, unstaged, conflicts, untracked };
}
export function numstat(raw: Uint8Array): {
    files: bigint;
    added: bigint;
    removed: bigint;
} {
    // Names are opaque bytes. Only the two decimal counters are decoded.
    const rows: Uint8Array[] = [];
    let start = 0;
    for (let i = 0; i < raw.length; i++)
        if (raw[i] === 0) {
            rows.push(raw.subarray(start, i));
            start = i + 1;
        }
    rows.push(raw.subarray(start));
    const result = { files: 0n, added: 0n, removed: 0n }, ascii = (bytes: Uint8Array) => String.fromCharCode(...bytes);
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i]!;
        if (!row.length)
            continue;
        const first = row.indexOf(9), second = row.indexOf(9, first + 1);
        if (first < 0 || second < 0)
            throw new Error('Invalid numstat');
        if (second === row.length - 1) {
            if (i + 2 >= rows.length)
                throw new Error('Truncated rename');
            i += 2;
        }
        const added = ascii(row.subarray(0, first)), removed = ascii(row.subarray(first + 1, second));
        if (added !== '-' || removed !== '-') {
            result.added += decimal(added);
            result.removed += decimal(removed);
        }
        result.files++;
    }
    return result;
}
