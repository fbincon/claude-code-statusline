import * as fs from 'node:fs';
import { join } from 'node:path';
import { files } from '../build/files.js';

/** Snapshot the whole cache, including immutable usage pages, outside the timer. */
export class CacheSnapshot {
    constructor(readonly runtime: string, readonly snapshot: string) {}

    capture(): void {
        fs.rmSync(this.snapshot, { recursive: true, force: true });
        fs.mkdirSync(this.snapshot, { recursive: true });
        // Reject links rather than copying an external tree into a benchmark.
        files(this.runtime);
        fs.cpSync(this.runtime, this.snapshot, { recursive: true });
    }

    restore(): void {
        fs.rmSync(this.runtime, { recursive: true, force: true });
        fs.mkdirSync(this.runtime, { recursive: true });
        fs.cpSync(this.snapshot, this.runtime, { recursive: true });
    }
}

/** A copied Git hit must have a fresh timestamp, not the time of priming. */
export function refreshGitCache(runtime: string, expired: boolean): void {
    const directory = join(runtime, 'git_cache');
    if (!fs.existsSync(directory)) return;
    for (const name of fs.readdirSync(directory)) {
        if (!/^[a-f0-9]{64}\.json$/u.test(name)) continue;
        const path = join(directory, name), raw = fs.readFileSync(path, 'utf8');
        if (!/"checked_ns"\s*:\s*\d+/u.test(raw)) throw new Error('Missing Git cache timestamp');
        const stamp = expired ? 0n : BigInt(Date.now()) * 1000000n;
        fs.writeFileSync(path, raw.replace(/("checked_ns"\s*:\s*)\d+/u, (_match, prefix: string) => prefix + stamp));
    }
}
