import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { removeTree } from '@fbincon/statusline-platform/remove-tree';
import { SHOWCASE_BASELINE, assertBaseline, snapshotDirectory, requireUnchanged, requireRemoved } from '../showcase.js';
import { requireCompact, requireSampleMetadata, sampleMetadata } from '../showcase-driver.js';

test('showcase rejects a different source, package bytes or product version', () => {
    assertBaseline(SHOWCASE_BASELINE);
    for (const mismatch of [{ commit: 'a'.repeat(40) }, { tarball_sha256: 'b'.repeat(64) }, { version: '3.15.0' }])
        assert.throws(() => assertBaseline({ ...SHOWCASE_BASELINE, ...mismatch }), /exact accepted/u);
});

test('showcase checks actual configuration instead of trusting a compact filename', () => {
    requireCompact({ separator_style: 'compact' });
    assert.throws(() => requireCompact({ separator_style: 'powerline', filename: 'daily-compact.png' }), /never Powerline/u);
    assert.throws(() => requireCompact({}), /never Powerline/u);
});

test('fixed sample provenance cannot claim real-session or human evidence', () => {
    const metadata = sampleMetadata('warning'); requireSampleMetadata(metadata);
    for (const change of [{ sample: false }, { actual_session: true }, { input_kind: 'live' }, { human_acceptance: true }, { model_calls: 1 }])
        assert.throws(() => requireSampleMetadata({ ...metadata, ...change }), /fixed sample/u);
    assert.throws(() => sampleMetadata('unobserved-success'), /Unknown/u);
});

test('read-only verification rejects changed bytes, permissions and file presence', () => {
    const root = fs.mkdtempSync(join(tmpdir(), 'showcase-readonly-'));
    try {
        const file = join(root, 'display.json'); fs.writeFileSync(file, '{}', { mode: 0o600 });
        const original = snapshotDirectory(root); requireUnchanged(original, snapshotDirectory(root), 'Preview');
        fs.writeFileSync(file, '{"changed":true}');
        assert.throws(() => requireUnchanged(original, snapshotDirectory(root), 'Preview'), /changed configuration/u);
        fs.writeFileSync(file, '{}');
        if (process.platform !== 'win32') {
            fs.chmodSync(file, 0o644);
            assert.throws(() => requireUnchanged(original, snapshotDirectory(root), 'Preview'), /changed configuration/u);
            fs.chmodSync(file, 0o600);
        }
        fs.writeFileSync(join(root, 'unexpected.json'), '{}');
        assert.throws(() => requireUnchanged(original, snapshotDirectory(root), 'Preview'), /changed configuration/u);
    } finally { removeTree(root); }
});

test('a cleanup failure cannot publish passing restoration evidence', () => {
    const root = fs.mkdtempSync(join(tmpdir(), 'showcase-cleanup-'));
    try { assert.throws(() => requireRemoved(root), /cleanup did not remove/u); }
    finally { removeTree(root); }
    requireRemoved(root);
});
