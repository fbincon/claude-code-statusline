import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export const APPROVAL_REGISTRY_PATH = 'docs/releases/approvals/registry.json';
const LEGACY_APPROVAL_PATH = 'tools/release/approval.ts';
const STABLE_VERSION = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u;
export interface ApprovalRegistration { version: string; path: string; approved_on: string }
export interface ApprovalRegistry { schema_version: 1; approvals: ApprovalRegistration[] }

/** Registrations are reviewed release data, read from the same verified source as the approval. */
export function assessApprovalRegistry(value: unknown): ApprovalRegistry {
    assert(value && typeof value === 'object' && !Array.isArray(value), 'Missing approval registry');
    const registry = value as ApprovalRegistry;
    assert.equal(registry.schema_version, 1);
    assert(Array.isArray(registry.approvals) && registry.approvals.length > 0, 'Empty approval registry');
    const versions = new Set<string>(), paths = new Set<string>();
    for (const row of registry.approvals) {
        assert(row && typeof row === 'object' && !Array.isArray(row));
        assert.deepEqual(Object.keys(row).sort(), ['approved_on', 'path', 'version']);
        assert.match(row.version, STABLE_VERSION, 'Approval requires a stable version');
        assert.match(row.path, /^docs\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+\.json$/u, 'Invalid approval path');
        assert.match(row.approved_on, /^\d{4}-\d{2}-\d{2}$/u, 'Invalid approval date');
        const date = new Date(row.approved_on + 'T00:00:00.000Z');
        assert(Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === row.approved_on, 'Invalid approval date');
        assert(!versions.has(row.version) && !paths.has(row.path), 'Duplicate approval registration');
        versions.add(row.version); paths.add(row.path);
    }
    return registry;
}

function registration(version: string, registry: ApprovalRegistry): ApprovalRegistration {
    assert.match(version, STABLE_VERSION, 'Approval requires a stable version');
    const rows = registry.approvals.filter(row => row.version === version);
    assert.equal(rows.length, 1, 'No unique maintainer decision approves this version');
    return rows[0]!;
}
export function stableApprovalPath(version: string, registry: ApprovalRegistry): string {
    return registration(version, registry).path;
}
export const UNVERIFIED_GATES = ['physical-macos-sleep', 'macos-14-intel-desktop-power', 'windows-10-desktop', 'wsl-desktop-popup', 'remaining-target-power-and-human-visual'];
export const ACCEPTED_GAPS = [...UNVERIFIED_GATES, 'claude-2.1.296-exact-declarations'];

/** A version-limited maintainer decision, never a substitute for passing CI. */
export function assessStableApproval(value: unknown, version: string, registry: ApprovalRegistry) {
    const expected = registration(version, registry);
    assert(value && typeof value === 'object' && !Array.isArray(value), 'Missing stable approval');
    const record = value as Record<string, unknown>;
    assert.equal(record.schema_version, 1);
    assert.equal(record.version, version, 'Approval belongs to another version');
    assert.equal(record.decision, 'accept-known-gaps');
    assert.equal(record.approved_by, 'fbincon');
    assert.equal(record.approved_on, expected.approved_on, 'Approval date differs from its registration');
    assert(typeof record.authority === 'string' && record.authority.trim().length > 0);
    assert.equal(record.reference, 'https://github.com/fbincon/claude-code-statusline/issues/96');
    assert.deepEqual(record.accepted_gaps, ACCEPTED_GAPS, 'Approval scope differs from the known gaps');
    return record;
}

/** Read the former literal table only from a verified historical archive; never execute its code. */
function legacyRegistry(bytes: Buffer | undefined): ApprovalRegistry {
    const block = bytes?.toString('utf8').match(/^const APPROVALS: Readonly<Record<string, \{ path: string; approvedOn: string \}>> = \{\r?\n([\s\S]*?)^\};$/mu);
    assert(block, 'Verified source archive is missing the approval registry');
    const approvals = block[1]!.trim().split(/\r?\n/u).map(line => {
        const row = line.match(/^\s*'([^']+)': \{ path: '([^']+)', approvedOn: '([^']+)' \},$/u);
        assert(row, 'Invalid historical approval registration');
        return { version: row[1]!, path: row[2]!, approved_on: row[3]! };
    });
    return assessApprovalRegistry({ schema_version: 1, approvals });
}

/** Both data files must come from the immutable source archive, never the current checkout. */
export function sourceStableApproval(entries: ReadonlyMap<string, Buffer>, version: string) {
    const rawRegistry = entries.get(APPROVAL_REGISTRY_PATH);
    const registry = rawRegistry === undefined ? legacyRegistry(entries.get(LEGACY_APPROVAL_PATH)) :
        assessApprovalRegistry(JSON.parse(rawRegistry.toString('utf8')));
    const path = stableApprovalPath(version, registry), raw = entries.get(path);
    assert(raw, 'Verified source archive is missing the maintainer approval');
    const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
    return { path, sha256: sha256(raw), record: assessStableApproval(JSON.parse(raw.toString('utf8')), version, registry),
        ...(rawRegistry === undefined ? {} : { registry: { path: APPROVAL_REGISTRY_PATH, sha256: sha256(rawRegistry) } }) };
}
