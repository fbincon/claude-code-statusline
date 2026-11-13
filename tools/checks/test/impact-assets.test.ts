import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { checkAssetInputs, checkImageGalleries, pngDimensions } from '../impact-assets.js';

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

const galleryImage = readFileSync('docs/images/showcase/en/daily.png');
const galleryDimensions = pngDimensions(galleryImage);
const galleryDigest = createHash('sha256').update(galleryImage).digest('hex');
function galleryManifest(patch: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        schema_version: 2, kind: 'test gallery', source_commit: 'a'.repeat(40), package_sha256: 'b'.repeat(64),
        model_calls: 0, physical_visual_acceptance: false,
        captures: [{
            file: 'sample.png', png_sha256: galleryDigest, width: galleryDimensions.width,
            height: galleryDimensions.height, bytes: galleryImage.length,
        }],
        ...patch,
    };
}
function galleryFixture(t: TestContext) {
    const root = mkdtempSync(join(tmpdir(), 'galleries '));
    t.after(() => rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }));
    const write = (name: string, body: string | Buffer): void => {
        const path = join(root, name);
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, body);
    };
    write('docs/images/new-gallery/README.md', '# New gallery\n\n**English** | [简体中文](README.zh-CN.md)\n\n**Status:** Earlier feature\n\n## Provenance\n\nSource.\n\n## Capture method\n\nMethod.\n\n## Evidence limits\n\nLimits.\n\n[Back](../README.md)\n');
    write('docs/images/new-gallery/README.zh-CN.md', '# 新图库\n\n[English](README.md) | **简体中文**\n\n**状态：** 较早功能\n\n## 来源\n\n来源。\n\n## 采集方法\n\n方法。\n\n## 证据限制\n\n限制。\n\n[返回](../README.zh-CN.md)\n');
    write('docs/images/new-gallery/captures.json', JSON.stringify(galleryManifest()));
    write('docs/images/new-gallery/sample.png', galleryImage);
    write('docs/images/composition/README.md', '# Legacy\n');
    write('docs/images/composition/README.zh-CN.md', '# 旧图库\n');
    write('docs/images/archive/old/README.md', '# Archive\n');
    const index = (english: string, chinese: string): void => {
        write('docs/images/README.md', `# Images\n\n## Gallery index\n\n| Gallery |\n| --- |\n| [New](new-gallery/README.md) |\n${english}`);
        write('docs/images/README.zh-CN.md', `# 图片\n\n## 图库索引\n\n| 图库 |\n| --- |\n| [新](new-gallery/README.zh-CN.md) |\n${chinese}`);
    };
    index('| [Legacy](composition/README.md) |\n', '| [旧](composition/README.zh-CN.md) |\n');
    return { root, write, index, manifestPath: join(root, 'docs/images/new-gallery/captures.json') };
}
test('gallery schema 2 accepts a new gallery and exempts legacy and archive galleries', t => {
    const fixture = galleryFixture(t);
    assert.deepEqual(checkImageGalleries(fixture.root), []);
    assert.deepEqual(checkImageGalleries(process.cwd()), []);
});
const invalidGalleries: readonly [string, (fixture: ReturnType<typeof galleryFixture>) => void, RegExp][] = [
    ['a missing manifest', fixture => unlinkSync(fixture.manifestPath), /needs a schema 2 manifest/u],
    ['schema 1', fixture => writeFileSync(fixture.manifestPath, JSON.stringify(galleryManifest({ schema_version: 1 }))), /schema_version/u],
    ['a missing source commit', fixture => writeFileSync(fixture.manifestPath, JSON.stringify(galleryManifest({ source_commit: undefined }))), /source_commit/u],
    ['a bad digest', fixture => writeFileSync(fixture.manifestPath, JSON.stringify(galleryManifest({ captures: [{
        file: 'sample.png', png_sha256: '0'.repeat(64), width: galleryDimensions.width,
        height: galleryDimensions.height, bytes: galleryImage.length,
    }] }))), /differs/u],
    ['an unreferenced image', fixture => fixture.write('docs/images/new-gallery/extra.png', galleryImage), /not referenced/u],
    ['a missing index row', fixture => fixture.index('', ''), /must appear exactly once/u],
    ['a duplicate index row', fixture => fixture.index(
        '| [New](new-gallery/README.md) |\n| [Legacy](composition/README.md) |\n',
        '| [新](new-gallery/README.zh-CN.md) |\n| [旧](composition/README.zh-CN.md) |\n'), /must appear exactly once/u],
    ['a missing README heading', fixture => fixture.write('docs/images/new-gallery/README.md',
        '# New gallery\n\n**English** | [简体中文](README.zh-CN.md)\n\n**Status:** Earlier feature\n'), /missing ## Provenance/u],
];
for (const [name, mutate, expected] of invalidGalleries)
    test('gallery schema rejects ' + name, t => {
        const fixture = galleryFixture(t);
        mutate(fixture);
        assert.match(checkImageGalleries(fixture.root).join('\n'), expected);
    });
