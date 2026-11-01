/** The platform adapter terminates its own POSIX group/Windows Job Object.
 * Nested POSIX group leaders need independent ownership checks before a signal. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { processAlive, processToken } from '@fbincon/statusline-platform/processes';

export type Owner = { pid: number; token: string };
type ProcessRow = { parent: number; group: number };
function snapshot(): Map<number, ProcessRow> {
    const table = new Map<number, ProcessRow>();
    const text = execFileSync('/bin/ps', ['-axo', 'pid=,ppid=,pgid='], { encoding: 'utf8', timeout: 3_000, maxBuffer: 4 * 1024 * 1024 });
    for (const row of text.trim().split('\n')) {
        const [pid, parent, group] = row.trim().split(/\s+/u).map(Number);
        if (pid && parent !== undefined && group !== undefined) table.set(pid, { parent, group });
    }
    return table;
}
function ancestry(pid: number, root: number, rows: Map<number, ProcessRow>): number[] {
    const chain: number[] = [];
    while (pid > 0 && !chain.includes(pid)) {
        chain.push(pid); if (pid === root) return chain;
        pid = rows.get(pid)?.parent ?? 0;
    }
    return [];
}
export function stopNestedOwners(root: Owner | null): Owner[] {
    if (process.platform === 'win32' || !root) return [];
    const live = processAlive(root.pid, root.token);
    if (live === false) return [];
    assert.equal(live, true, 'Unverifiable acceptance root process; retaining fixture');
    const initial = snapshot(), owned: Owner[] = [];
    const groups = [...initial.entries()].filter(([pid, row]) => pid !== root.pid && row.group === pid)
        .map(([pid]) => ancestry(pid, root.pid, initial)).filter(chain => chain.length).sort((a, b) => b.length - a.length);
    for (const chain of groups) {
        const pid = chain[0]!;
        const identities: (string | null)[] = chain.map((member): string | null => member === root.pid ? root.token : processToken(member));
        const current = snapshot();
        // An exited group leader can no longer authorize signalling its numeric group.
        if (!current.has(pid)) continue;
        assert.deepEqual(ancestry(pid, root.pid, current), chain, 'Acceptance descendant ancestry changed; retaining fixture');
        assert.equal(current.get(pid)?.group, pid, 'Acceptance process group changed');
        for (const [index, member] of chain.entries()) {
            const token: string | null | undefined = identities[index]; assert(token, 'Unverifiable acceptance descendant birth identity');
            assert.equal(processAlive(member, token), true, 'Acceptance ancestor identity changed; retaining fixture');
        }
        try { process.kill(-pid, 'SIGKILL'); }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; }
        owned.push({ pid, token: identities[0]! });
    }
    return owned;
}
export async function requireStopped(owners: Owner[]): Promise<void> {
    const deadline = performance.now() + 5_000;
    while (owners.some(entry => processAlive(entry.pid, entry.token) !== false)) {
        if (performance.now() >= deadline) throw new Error('Acceptance worker group exit unverifiable; retaining fixture');
        await new Promise(resolve => setTimeout(resolve, 25));
    }
}
