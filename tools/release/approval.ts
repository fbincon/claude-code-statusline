import assert from 'node:assert/strict';

const APPROVALS: Readonly<Record<string, string>> = {
    '3.0.0': 'docs/development/typescript-migration/ts-06/stable-approval.json',
    '3.1.0': 'docs/releases/approvals/v3.1.0.json',
    '3.1.1': 'docs/releases/approvals/v3.1.1.json',
};
export function stableApprovalPath(version: string): string {
    assert(Object.hasOwn(APPROVALS, version), 'No maintainer decision approves this version');
    return APPROVALS[version]!;
}
export const UNVERIFIED_GATES = ['physical-macos-sleep', 'macos-14-intel-desktop-power', 'windows-10-desktop', 'wsl-desktop-popup', 'remaining-target-power-and-human-visual'];
export const ACCEPTED_GAPS = [...UNVERIFIED_GATES, 'claude-2.1.296-exact-declarations'];

/** A version-limited maintainer decision, never a substitute for passing CI. */
export function assessStableApproval(value: unknown, version: string) {
    stableApprovalPath(version);
    assert(value && typeof value === 'object' && !Array.isArray(value), 'Missing stable approval');
    const record = value as Record<string, unknown>;
    assert.equal(record.schema_version, 1);
    assert.equal(record.version, version, 'Approval belongs to another version');
    assert.equal(record.decision, 'accept-known-gaps');
    assert.equal(record.approved_by, 'fbincon');
    assert.equal(record.approved_on, '2026-10-18');
    assert(typeof record.authority === 'string' && record.authority.length > 0);
    assert.equal(record.reference, 'https://github.com/fbincon/claude-code-statusline/issues/96');
    assert.deepEqual(record.accepted_gaps, ACCEPTED_GAPS, 'Approval scope differs from the known gaps');
    return record;
}
