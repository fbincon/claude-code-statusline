import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { withLock, atomicWrite } from '@fbincon/statusline-platform/files';
interface Attempt {
    id: string;
    case: string;
    cap_usd: number;
    known_usd: number;
    reserved_usd: number;
    status: string;
    cost_known?: boolean;
}
interface Ledger {
    authorized_total_usd: number;
    attempts: Attempt[];
    known_total_usd?: number;
    reserved_total_usd?: number;
}
function read(path: string): Ledger {
    const value = JSON.parse(readFileSync(path, 'utf8')) as Ledger;
    if (value.authorized_total_usd !== 10 || !Array.isArray(value.attempts))
        throw new Error('Expected the existing shared authorized USD 10 ledger');
    const seen = new Set<string>();
    for (const row of value.attempts) {
        if (!row.id || seen.has(row.id) || ![row.cap_usd, row.known_usd, row.reserved_usd].every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0) || !['reserved', 'finished'].includes(row.status))
            throw new Error('Invalid budget ledger entry');
        seen.add(row.id);
    }
    return value;
}
const lockPath = (path: string) => path.slice(0, path.length - extname(path).length) + '.lock';
const spent = (value: Ledger) => value.attempts.reduce((sum, row) => sum + row.known_usd + row.reserved_usd, 0);
function write(path: string, value: Ledger): void {
    value.known_total_usd = value.attempts.reduce((sum, row) => sum + row.known_usd, 0);
    value.reserved_total_usd = value.attempts.reduce((sum, row) => sum + row.reserved_usd, 0);
    atomicWrite(path, JSON.stringify(value, null, 2) + '\n');
}
export function reserve(path: string, name: string, cap: number): string {
    if (typeof cap !== 'number' || !Number.isFinite(cap) || cap <= 0 || cap > 10)
        throw new Error('Call cap must be finite and in (0, 10]');
    return withLock(lockPath(path), () => {
        const value = read(path);
        if (value.attempts.some(row => row.cost_known === false))
            throw new Error('An unknown-cost attempt blocks new paid calls');
        if (spent(value) + cap > 10)
            throw new Error('Shared USD 10 budget exhausted');
        const id = randomUUID();
        value.attempts.push({ id, case: name, cap_usd: cap, known_usd: 0, reserved_usd: cap, status: 'reserved' });
        write(path, value);
        return id;
    });
}
export function settle(path: string, identity: string, cost: unknown): number {
    return withLock(lockPath(path), () => {
        const value = read(path), row = value.attempts.find(row => row.id === identity);
        if (!row)
            throw new Error('Unknown reservation');
        if (row.status === 'finished')
            return spent(value);
        const known = typeof cost === 'number' && Number.isFinite(cost) && cost >= 0;
        Object.assign(row, { status: 'finished', known_usd: known ? cost : 0, reserved_usd: known ? 0 : row.cap_usd, cost_known: known });
        write(path, value);
        return spent(value);
    });
}
