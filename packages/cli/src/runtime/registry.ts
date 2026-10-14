import { int, object, string, truth, type Data } from '@fbincon/statusline-core/runtime/values';
import type { RuntimeContext } from './context.js';
import { readStored, runtimeIO, type RuntimeIO } from './io.js';
export function registryStatus(context: RuntimeContext, sessionId: unknown, io: RuntimeIO = runtimeIO()): Data | null {
    if (!truth(sessionId))
        return null;
    let entries;
    try {
        entries = io.entries(context.sessionsDir);
    }
    catch {
        return null;
    }
    let best: Data | null = null, bestStamp: bigint | null = null;
    for (const entry of entries) {
        if (!entry.file || entry.link || !/^\d+\.json$/u.test(entry.name))
            continue;
        let data: unknown;
        try {
            data = readStored(io, entry.path);
        }
        catch {
            continue;
        }
        if (!object(data))
            continue;
        const pid = int(data.pid), updated = int(data.statusUpdatedAt);
        if (data.sessionId !== string(sessionId) || pid === null || pid !== BigInt(entry.name.slice(0, -5)) || updated === null)
            continue;
        const token = context.processToken(Number(pid));
        if (token === null || (truth(data.procStart) ? string(data.procStart) : '') !== token)
            continue;
        const stamp = updated * 1000000n;
        if (bestStamp === null || stamp > bestStamp) {
            bestStamp = stamp;
            best = { status: data.status ?? null, status_updated_wall_ns: stamp, pid };
        }
    }
    return best;
}
