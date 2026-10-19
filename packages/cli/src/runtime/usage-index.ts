import { join } from 'node:path';
import { rmSync } from 'node:fs';
import { BASE, MAX_IDS, usageInt, type Counters, type UsageEntry } from '@fbincon/statusline-core/runtime/usage';
import { dictionary, int, object } from '@fbincon/statusline-core/runtime/values';
import { recordEntries } from '@fbincon/statusline-core/ordered-record';
import { sha256 } from '@fbincon/statusline-platform/hash';
import { safeTarget } from '../integration/paths.js';
import { readDataJson, dumpDataJson } from './json-data.js';
import type { RuntimeIO } from './io.js';

const FIELDS = ['i', 'o', 'cc', 'cr'] as const;
const digest = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
type Page = Record<string, Counters>;

/** Immutable hash-trie pages. The cache's atomic publication is the commit
 * point for pages, totals AND cursors; an interrupted writer leaves only
 * unreachable files. No probabilistic membership filter can drop real usage. */
export class UsageIndex {
    static pruneSessions(root: string, boundary: string, sessions: readonly string[], io: RuntimeIO): void {
        const keep = new Set(sessions.map(sha256));
        for (const entry of io.entries(root)) if (entry.directory && !entry.link && digest(entry.name) && !keep.has(entry.name)) {
            safeTarget(boundary, entry.path);
            rmSync(entry.path, { recursive: true });
        }
    }
    private pages: Record<string, string> = Object.create(null);
    private reference: string | null;
    private dirty = false;
    private staged = new Map<string, Buffer>();
    private stagedBytes = 0;
    constructor(readonly directory: string, readonly boundary: string, readonly io: RuntimeIO, reference: unknown,
        private readonly maxStagedBytes = 32 * 1024 * 1024) {
        if (!Number.isSafeInteger(maxStagedBytes) || maxStagedBytes < 0) throw new Error('Invalid usage index staging bound');
        this.reference = digest(reference) ? reference : null;
        if (reference != null && !this.reference) throw new Error('Invalid usage index reference');
        if (this.reference) {
            const value = this.read('m', this.reference);
            if (!object(value) || int(value.schema_version) !== 1n || !object(value.pages)
                || Object.entries(value.pages).some(([prefix, hash]) => !/^[a-f0-9]{0,64}$/u.test(prefix) || !digest(hash))) throw new Error('Invalid usage index manifest');
            this.pages = Object.assign(Object.create(null), value.pages);
        }
    }
    private read(kind: string, hash: string): unknown {
        const path = join(this.directory, `${kind}-${hash}.json`);
        safeTarget(this.boundary, path);
        const bytes = (kind === 'b' ? this.staged.get(hash) : undefined) ?? this.io.read(path);
        if (!bytes || sha256(bytes) !== hash) throw new Error('Missing or damaged usage index page');
        return readDataJson(bytes.toString('utf8'));
    }
    private write(kind: string, value: unknown): string {
        const bytes = Buffer.from(dumpDataJson(value)), hash = sha256(bytes);
        if (kind === 'b') {
            if (!this.staged.has(hash)) {
                this.staged.set(hash, bytes);
                this.stagedBytes += bytes.length;
            }
            // Keep only a bounded serialized overlay for this locked collection.
            // Overflow uses the same durable publication as the final flush.
            while (this.stagedBytes > this.maxStagedBytes) {
                const [oldest, raw] = this.staged.entries().next().value!;
                this.writeBytes('b', oldest, raw);
                this.unstage(oldest);
            }
        } else this.writeBytes(kind, hash, bytes);
        return hash;
    }
    private unstage(hash: string | undefined): void {
        if (hash === undefined) return;
        const raw = this.staged.get(hash);
        if (raw) {
            this.staged.delete(hash);
            this.stagedBytes -= raw.length;
        }
    }
    private writeBytes(kind: string, hash: string, bytes: Buffer): void {
        const path = join(this.directory, `${kind}-${hash}.json`);
        safeTarget(this.boundary, path);
        this.io.privateDirectory(this.directory);
        const existing = this.io.read(path);
        if (existing === null) this.io.write(path, bytes);
        else if (sha256(existing) !== hash) throw new Error('Damaged usage index page');
    }
    merge(incoming: Page, entry: UsageEntry): void {
        const visit = (prefix: string, rows: [string, Counters][]): void => {
            if (!rows.length) return;
            if (!Object.hasOwn(this.pages, prefix) && Object.keys(this.pages).some(key => key.startsWith(prefix))) {
                const groups = new Map<string, [string, Counters][]>();
                for (const row of rows) {
                    const key = prefix + sha256(row[0])[prefix.length]!;
                    if (key.length > 64) throw new Error('Usage index hash collision exceeds page bound');
                    if (!groups.has(key)) groups.set(key, []);
                    groups.get(key)!.push(row);
                }
                for (const [key, values] of groups) visit(key, values);
                return;
            }
            const raw = this.pages[prefix] ? this.read('b', this.pages[prefix]!) : {};
            if (!object(raw) || Object.keys(raw).length > MAX_IDS) throw new Error('Invalid usage index page');
            const page = dictionary<Counters>();
            for (const [id, value] of recordEntries(raw)) {
                if (!object(value) || !sha256(id).startsWith(prefix) || FIELDS.some(key => int(value[key]) === null || int(value[key])! < 0n)) throw new Error('Invalid usage identity');
                page[id] = Object.fromEntries(FIELDS.map(key => [key, usageInt(value[key])])) as Counters;
            }
            for (const [id, values] of rows) {
                const old = page[id], hot = entry.ids[id];
                // A cold identity already contributes to base. Bring it back
                // into the hot window before applying its per-field maximum.
                if (old && !hot) for (const key of FIELDS) entry.base[key] = usageInt(entry.base[key]) - old[key];
                const next = { ...BASE };
                for (const key of FIELDS) next[key] = [usageInt(old?.[key]), usageInt(hot?.[key]), usageInt(values[key])].reduce((a, b) => a > b ? a : b);
                entry.ids[id] = next;
                page[id] = next;
            }
            this.unstage(this.pages[prefix]);
            delete this.pages[prefix];
            const persist = (key: string, values: [string, Counters][]): void => {
                if (values.length <= MAX_IDS) { this.pages[key] = this.write('b', Object.fromEntries(values)); return; }
                if (key.length === 64) throw new Error('Usage index hash collision exceeds page bound');
                const groups = new Map<string, [string, Counters][]>();
                for (const row of values) {
                    const next = key + sha256(row[0])[key.length]!;
                    if (!groups.has(next)) groups.set(next, []);
                    groups.get(next)!.push(row);
                }
                for (const [next, group] of groups) persist(next, group);
            };
            persist(prefix, Object.entries(page));
            this.dirty = true;
        };
        visit('', recordEntries(incoming));
    }
    publish(): string {
        // Durably publish final pages before the manifest. Intermediate versions
        // of the same page never need disk publication while the lock is held.
        for (const [hash, bytes] of this.staged) this.writeBytes('b', hash, bytes);
        this.staged.clear();
        this.stagedBytes = 0;
        if (!this.reference || this.dirty) this.reference = this.write('m', { schema_version: 1, pages: this.pages });
        this.dirty = false;
        return this.reference;
    }
    /** Run only AFTER the referencing cache commit succeeds. */
    prune(): void {
        const keep = new Set([`m-${this.reference}.json`, ...Object.values(this.pages).map(hash => `b-${hash}.json`)]);
        for (const entry of this.io.entries(this.directory)) {
            if (entry.file && !entry.link && /^[bm]-[a-f0-9]{64}\.json$/u.test(entry.name) && !keep.has(entry.name)) this.io.remove(entry.path);
        }
    }
}
