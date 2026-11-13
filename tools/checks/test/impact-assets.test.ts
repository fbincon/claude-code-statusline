import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { checkAssetInputs, pngDimensions } from '../impact-assets.js';

const image = readFileSync('docs/images/showcase/en/daily.png');
const dimensions = pngDimensions(image);
const digest = createHash('sha256').update(image).digest('hex');
const manifest = 'docs/images/showcase/test-manifest.json';
const imagePath = 'docs/images/showcase/en/daily.png';

function check(record: unknown, paths = [manifest]): void {
    checkAssetInputs(paths, {
        read(path) {
            if (path === manifest) return Buffer.from(JSON.stringify(record));
            if (path === imagePath) return image;
            return undefined;
        },
        jsonFiles() { return []; },
    });
}

test('validates captures, images, frames and records rows', () => {
    check({ captures: [{ file: 'en/daily.png', png_sha256: digest, width: dimensions.width, height: dimensions.height, bytes: image.length }] });
    check({ images: [{ file: 'en/daily.png', sha256: digest, width: dimensions.width, height: dimensions.height, bytes: image.length }] });
    check({ frames: [{ name: 'en/daily', png_sha256: digest, width: dimensions.width, height: dimensions.height }] });
    check({ records: [{ file: 'en/daily.png', png_sha256: digest }] });
});

test('skips fileless capture rows without weakening path checks', () => {
    check({ captures: [{ language: 'en', page: 'main', png_sha256: digest }] });
    assert.throws(() => check({ captures: [{ file: '../../../../outside.png', png_sha256: digest }] }), /escapes repository/);
});

test('rejects mismatched digests, byte counts and dimensions', () => {
    assert.throws(() => check({ captures: [{ file: 'en/daily.png', png_sha256: '0'.repeat(64) }] }), /digest differs/);
    assert.throws(() => check({ images: [{ file: 'en/daily.png', sha256: digest, bytes: image.length + 1 }] }), /byte count differs/);
    assert.throws(() => check({ frames: [{ name: 'en/daily.png', png_sha256: digest, width: dimensions.width + 1, height: dimensions.height }] }), /Expected values to be strictly deep-equal/);
});

test('auto-selects a manifest whose rows reference changed media', () => {
    checkAssetInputs([imagePath], {
        read(path) {
            if (path === manifest) return Buffer.from(JSON.stringify({ images: [{ file: 'en/daily.png', sha256: digest }] }));
            if (path === imagePath) return image;
            return undefined;
        },
        jsonFiles() { return [manifest]; },
    });
});
