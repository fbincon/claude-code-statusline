import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { removeTree } from '@fbincon/statusline-platform/remove-tree';
import { defaultDisplay, validateDisplay } from '@fbincon/statusline-core/config/display';
import { applyPreset } from '@fbincon/statusline-core/config/presets';
import { SHOWCASE_BASELINE, assertBaseline, snapshotDirectory, requireUnchanged, requireRemoved } from '../showcase.js';
import { SCENES, SHOWCASE_GRADIENTS, applyShowcaseVisuals, requireShowcaseVisuals, requireColorObservation,
    requireSampleMetadata, sampleMetadata } from '../showcase-driver.js';
import { Capture } from '../../migration/ts-04/capture.js';

test('showcase rejects a different source, package bytes or product version', () => {
    assertBaseline(SHOWCASE_BASELINE);
    for (const mismatch of [{ commit: 'a'.repeat(40) }, { tarball_sha256: 'b'.repeat(64) }, { version: '3.15.0' }])
        assert.throws(() => assertBaseline({ ...SHOWCASE_BASELINE, ...mismatch }), /exact accepted/u);
});

test('showcase rejects Powerline, ASCII overrides, missing color and scope-specific gradient drift', () => {
    const config = defaultDisplay(); applyShowcaseVisuals(config); requireShowcaseVisuals(validateDisplay(config));
    for (const mutate of [
        (c: any) => c.separator_style = 'powerline',
        (c: any) => c.separator_style = 'compact',
        (c: any) => c.formatting.icons = 'ascii',
        (c: any) => c.formatting.model_name = 'short',
        (c: any) => c.use_colors = false,
        (c: any) => c.instances[0].options.icon = 'M',
        (c: any) => c.instances[0].options.formatting.labels = 'off',
        (c: any) => c.instances[0].options.background_gradient = ['#123456', '#654321'],
        (c: any) => c.powerline.row_background_gradient = ['#123456', '#654321'],
        (c: any) => delete c.instances[0].options.foreground_gradient,
        (c: any) => c.subagents.instances.find((n: any) => n.type_id === 'model-with-effort').options.foreground_gradient = [...SHOWCASE_GRADIENTS['current-dir'].dark],
    ]) {
        const invalid = structuredClone(config); mutate(invalid);
        assert.throws(() => requireShowcaseVisuals(invalid));
    }
    const plain = structuredClone(config); plain.use_colors = false;
    assert.doesNotThrow(() => requireShowcaseVisuals(plain, { allowNoColor: true }));
});

test('all five derived scenes have reviewed light/dark gradients without hidden preset decorations', () => {
    for (const scene of SCENES) for (const appearance of ['dark', 'light'] as const) {
        const config = applyPreset(defaultDisplay(), scene.preset, () => { throw new Error('Unexpected duplicate'); });
        applyShowcaseVisuals(config, appearance);
        const validated = validateDisplay(config);
        requireShowcaseVisuals(validated, { appearance });
        const foreign = appearance === 'light' ? SHOWCASE_GRADIENTS['model-with-effort'].dark : SHOWCASE_GRADIENTS['model-with-effort'].light;
        const model = validated.subagents.instances.find(node => node.type_id === 'model-with-effort');
        if (model) { model.options.foreground_gradient = [...foreign]; assert.throws(() => requireShowcaseVisuals(validated, { appearance })); }
    }
});

test('component gradients are distinct by type and retain readable light/dark stops', () => {
    const luminance = (color: string) => [1, 3, 5].map(offset => parseInt(color.slice(offset, offset + 2), 16) / 255)
        .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
        .reduce((sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i]!, 0);
    for (const appearance of ['dark', 'light'] as const) {
        const seen = new Set<string>(), background = luminance(appearance === 'light' ? '#ffffff' : '#17191e');
        for (const [type, gradient] of Object.entries(SHOWCASE_GRADIENTS)) {
            assert(!seen.has(JSON.stringify(gradient[appearance])), 'Different types share a complete color scale: ' + type);
            seen.add(JSON.stringify(gradient[appearance]));
            for (const stop of gradient[appearance]) {
                const foreground = luminance(stop), contrast = (Math.max(background, foreground) + 0.05) / (Math.min(background, foreground) + 0.05);
                assert(contrast >= 4.5, 'Unreadable gradient stop on its intended background: ' + type + ' ' + stop);
            }
        }
    }
});

test('color evidence requires matching foreground SGR and surviving chromatic text cells', () => {
    for (const ansi of ['\x1b[38;2;251;207;232m甲\x1b[38;2;34;211;238m✓\x1b[0m', '\x1b[38;5;219m甲\x1b[38;5;45m✓\x1b[0m']) {
        const capture = new Capture(12, 1); capture.feed(ansi);
        const evidence = requireColorObservation(ansi, capture.buffer);
        assert.equal(evidence.chromatic_cells, 2); assert.equal(evidence.matching_foreground_colors.length, 2);
        assert.throws(() => requireColorObservation('plain output', capture.buffer), /foreground SGR/u);
        const blank = new Capture(12, 1); blank.feed('neutral text');
        assert.throws(() => requireColorObservation(ansi, blank.buffer), /foreground text cells/u);
    }
    const backgroundOnly = new Capture(12, 1), raw = '\x1b[48;2;251;207;232mA\x1b[48;2;34;211;238mB';
    backgroundOnly.feed(raw);
    assert.throws(() => requireColorObservation(raw, backgroundOnly.buffer), /foreground SGR/u);
    const wrong = new Capture(12, 1); wrong.feed('\x1b[38;2;34;211;238mA\x1b[38;2;59;130;246mB');
    assert.throws(() => requireColorObservation('\x1b[38;5;219mA\x1b[38;5;45mB', wrong.buffer), /matching raw terminal/u);
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
