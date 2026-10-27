import assert from 'node:assert/strict';

const APPROVALS: Readonly<Record<string, { path: string; approvedOn: string }>> = {
    '3.9.2': { path: 'docs/releases/approvals/v3.9.2.json', approvedOn: '2026-10-28' },
    '3.9.1': { path: 'docs/releases/approvals/v3.9.1.json', approvedOn: '2026-10-26' },
    '3.9.0': { path: 'docs/releases/approvals/v3.9.0.json', approvedOn: '2026-10-26' },
    '3.8.0': { path: 'docs/releases/approvals/v3.8.0.json', approvedOn: '2026-10-24' },
    '3.7.0': { path: 'docs/releases/approvals/v3.7.0.json', approvedOn: '2026-10-24' },
    '3.6.0': { path: 'docs/releases/approvals/v3.6.0.json', approvedOn: '2026-10-23' },
    '3.5.0': { path: 'docs/releases/approvals/v3.5.0.json', approvedOn: '2026-10-23' },
    '3.4.0': { path: 'docs/releases/approvals/v3.4.0.json', approvedOn: '2026-10-20' },
    '3.3.0': { path: 'docs/releases/approvals/v3.3.0.json', approvedOn: '2026-10-20' },
    '3.2.0': { path: 'docs/releases/approvals/v3.2.0.json', approvedOn: '2026-10-19' },
    '3.0.0': { path: 'docs/development/typescript-migration/ts-06/stable-approval.json', approvedOn: '2026-10-18' },
    '3.1.0': { path: 'docs/releases/approvals/v3.1.0.json', approvedOn: '2026-10-18' },
    '3.1.1': { path: 'docs/releases/approvals/v3.1.1.json', approvedOn: '2026-10-18' },
    '3.1.3': { path: 'docs/releases/approvals/v3.1.3.json', approvedOn: '2026-10-19' },
    '3.1.4': { path: 'docs/releases/approvals/v3.1.4.json', approvedOn: '2026-10-19' },
    '3.1.2': { path: 'docs/releases/approvals/v3.1.2.json', approvedOn: '2026-10-19' },
};
export function stableApprovalPath(version: string): string {
    assert(Object.hasOwn(APPROVALS, version), 'No maintainer decision approves this version');
    return APPROVALS[version]!.path;
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
    assert.equal(record.approved_on, APPROVALS[version]!.approvedOn);
    assert(typeof record.authority === 'string' && record.authority.length > 0);
    assert.equal(record.reference, 'https://github.com/fbincon/claude-code-statusline/issues/96');
    assert.deepEqual(record.accepted_gaps, ACCEPTED_GAPS, 'Approval scope differs from the known gaps');
    return record;
}
