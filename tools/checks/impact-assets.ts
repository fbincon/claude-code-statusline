/** Offline validation of maintained media and inspectable capture metadata. */
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { extname, join, posix, relative, resolve, sep } from 'node:path';
import { crc32, inflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';

export function pngDimensions(raw: Buffer): { width: number; height: number } {
    assert(raw.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), 'Invalid PNG signature');
    let offset = 8, ended = false; const data: Buffer[] = [];
    const width = raw.readUInt32BE(16), height = raw.readUInt32BE(20);
    assert(width > 0 && height > 0 && width * height <= 100_000_000, 'Invalid PNG geometry');
    while (offset < raw.length) {
        assert(offset + 12 <= raw.length); const length = raw.readUInt32BE(offset), end = offset + 12 + length;
        assert(end <= raw.length); const type = raw.toString('ascii', offset + 4, offset + 8);
        assert.equal(crc32(raw.subarray(offset + 4, end - 4)), raw.readUInt32BE(end - 4), 'PNG checksum mismatch');
        if (offset === 8) assert.equal(type, 'IHDR');
        if (type === 'IDAT') data.push(raw.subarray(offset + 8, end - 4));
        if (type === 'IEND') { assert.equal(end, raw.length); ended = true; }
        offset = end;
    }
    assert(ended && data.length); assert(inflateSync(Buffer.concat(data), { maxOutputLength: 512 * 1024 * 1024 }).length > 0);
    return { width, height };
}
export function checkAsset(path: string, raw: Buffer): void {
    assert(raw.length > 0, 'Empty asset: ' + path);
    const extension = extname(path).toLowerCase();
    if (extension === '.png') pngDimensions(raw);
    else if (extension === '.json') JSON.parse(raw.toString('utf8'));
    else if (extension === '.svg') assert(/<svg(?:\s|>)/u.test(raw.toString()) && /<\/svg\s*>/u.test(raw.toString()), 'Invalid SVG');
    else if (['.jpg', '.jpeg'].includes(extension)) assert(raw[0] === 255 && raw[1] === 216 && raw.at(-2) === 255 && raw.at(-1) === 217, 'Invalid JPEG framing');
    else if (extension === '.gif') assert(/^GIF8[79]a/u.test(raw.toString('ascii', 0, 6)) && raw.at(-1) === 59, 'Invalid GIF framing');
    else if (extension === '.webp') assert(raw.toString('ascii', 0, 4) === 'RIFF' && raw.toString('ascii', 8, 12) === 'WEBP' && raw.readUInt32LE(4) + 8 === raw.length, 'Invalid WebP framing');
    else if (extension === '.mp4') assert(raw.length >= 16 && raw.toString('ascii', 4, 8) === 'ftyp', 'Invalid MP4 container');
    else if (extension === '.webm') assert.equal(raw.readUInt32BE(0), 0x1a45dfa3, 'Invalid WebM container');
    else if (extension === '.pdf') assert(raw.toString('ascii', 0, 5) === '%PDF-' && raw.subarray(-1024).toString().includes('%%EOF'), 'Invalid PDF framing');
    else throw new Error('Unregistered asset type: ' + path);
}
/** Keep capture references relative to their original manifest in either filesystem. */
export interface AssetInputs {
    read(path: string): Buffer | undefined;
    jsonFiles(): string[];
}
const MANIFEST_KEYS = ['captures', 'images', 'frames', 'records'] as const;
type ManifestRow = { file?: unknown; name?: unknown; png_sha256?: unknown; sha256?: unknown; width?: unknown; height?: unknown; bytes?: unknown; source_sha256?: unknown };
/** Rows in maintained image manifests use either an explicit file or a frame name without its .png suffix. */
function rowFile(row: ManifestRow): string | undefined {
    if (typeof row.file === 'string') return row.file;
    if (typeof row.name === 'string') return row.name.includes('.') ? row.name : row.name + '.png';
    return undefined;
}
function manifestRows(record: unknown): ManifestRow[] | undefined {
    if (typeof record !== 'object' || record === null) return undefined;
    for (const key of MANIFEST_KEYS) {
        const rows = (record as Record<string, unknown>)[key];
        if (Array.isArray(rows)) return rows as ManifestRow[];
    }
    return undefined;
}
export function checkAssetInputs(paths: readonly string[], inputs: AssetInputs, observed?: (name: string, bytes: Buffer) => void): void {
    const selected = new Set(paths);
    const changedMedia = new Set(paths.filter(name => /^docs\/.*\.(?:png|jpe?g|gif|webp|svg|mp4|webm|pdf)$/u.test(name)));
    if (changedMedia.size) for (const name of inputs.jsonFiles()) {
        if (selected.has(name)) continue;
        const raw = inputs.read(name);
        if (!raw || !MANIFEST_KEYS.some(key => raw.includes('"' + key + '"'))) continue;
        const rows = manifestRows(JSON.parse(raw.toString('utf8')));
        if (rows?.some(row => {
            const file = rowFile(row);
            return file !== undefined && changedMedia.has(posix.join(posix.dirname(name), file));
        })) selected.add(name);
    }
    for (const name of selected) {
        if (!/^docs\/.*\.(?:png|jpe?g|gif|webp|svg|mp4|webm|pdf|json)$/u.test(name)) continue;
        const raw = inputs.read(name);
        if (raw === undefined) continue; // A deleted image is still checked against its surviving capture manifest.
        checkAsset(name, raw); observed?.(name,raw);
        if (!name.endsWith('.json')) continue;
        const rows = manifestRows(JSON.parse(raw.toString()));
        if (!rows) continue;
        for (const row of rows) {
            const file = rowFile(row);
            if (file === undefined) continue; // Fileless captures (for example language/page matrices) have no path to resolve.
            assert(!posix.isAbsolute(file) && !file.includes('\\') && !/^[a-z]:/iu.test(file), 'Invalid capture path');
            const path = posix.join(posix.dirname(name), file);
            assert(path !== '..' && !path.startsWith('../'), 'Capture escapes repository');
            const pixels = inputs.read(path); assert(pixels, 'Missing referenced capture: ' + path);
            checkAsset(path, pixels); observed?.(path,pixels);
            const digest = typeof row.png_sha256 === 'string' ? row.png_sha256 : typeof row.sha256 === 'string' ? row.sha256 : undefined;
            if (digest !== undefined) assert.equal(createHash('sha256').update(pixels).digest('hex'), digest, 'Capture digest differs');
            if (path.endsWith('.png') && row.width !== undefined) assert.deepEqual(pngDimensions(pixels), { width: row.width, height: row.height });
            if (row.bytes !== undefined) assert.equal(pixels.length, row.bytes, 'Capture byte count differs');
            if (row.source_sha256 !== undefined) assert.match(String(row.source_sha256), /^[a-f0-9]{64}$/u);
        }
    }
}
export function checkAssets(root: string, paths: readonly string[]): void {
    checkAssetInputs(paths, {
        read(name) {
            const path = resolve(root, name);
            if (!fs.existsSync(path)) return undefined;
            assert(fs.lstatSync(path).isFile(), 'Asset must be a regular file');
            return fs.readFileSync(path);
        },
        jsonFiles() {
            const directory = resolve(root,'docs');
            return fs.existsSync(directory) ? fs.readdirSync(directory,{recursive:true,encoding:'utf8'})
                .filter(path => path.endsWith('.json')).map(path => 'docs/' + path.replaceAll('\\','/')) : [];
        },
    });
    const galleries = checkImageGalleries(root);
    assert.deepEqual(galleries, [], galleries.join('\n'));
}
const GALLERY_SCHEMA_VERSION = 2;
const GALLERY_MEDIA = /\.(?:png|jpe?g|gif|webp)$/iu;
const LEGACY_GALLERIES = new Set([
    'adaptive-row-scenarios', 'composition', 'draft-history-reuse', 'native-capacity', 'setup-appearance',
    'showcase', 'source-command-package', 'tui', 'typescript', 'typescript/regional', 'typescript/v3.1.1',
    'typescript/v3.16.0',
]);
function galleryFiles(directory: string): string[] {
    const files: string[] = [];
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) files.push(...galleryFiles(path));
        else if (entry.isFile()) files.push(path);
    }
    return files;
}
function galleryRelative(base: string, path: string): string {
    return relative(base, path).split(sep).join('/');
}
function galleryManifestErrors(path: string, gallery: string, base: string, requireCompleteness: boolean): string[] {
    const errors: string[] = [], manifest = `docs/images/${gallery}/captures.json`;
    const fail = (message: string): void => { errors.push(`${manifest}: ${message}`); };
    let value: Record<string, unknown>;
    try {
        value = JSON.parse(fs.readFileSync(path, 'utf8')) as Record<string, unknown>;
    } catch (error) {
        return [`${manifest}: invalid JSON (${error instanceof Error ? error.message : String(error)})`];
    }
    if (value.schema_version !== GALLERY_SCHEMA_VERSION) fail(`schema_version must be ${GALLERY_SCHEMA_VERSION}`);
    if (typeof value.kind !== 'string' || !value.kind.trim()) fail('kind must be a nonempty string');
    if (typeof value.source_commit !== 'string' || !/^[a-f0-9]{40}$/u.test(value.source_commit)) fail('source_commit must be a 40-hex commit');
    if (value.package_sha256 !== null && (typeof value.package_sha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(value.package_sha256)))
        fail('package_sha256 must be a 64-hex digest or null');
    if (typeof value.model_calls !== 'number' || !Number.isSafeInteger(value.model_calls) || value.model_calls < 0)
        fail('model_calls must be a non-negative integer');
    if (typeof value.physical_visual_acceptance !== 'boolean') fail('physical_visual_acceptance must be a boolean');
    if (!Array.isArray(value.captures) || value.captures.length === 0) {
        fail('captures must be a nonempty array');
        return errors;
    }
    const referenced = new Set<string>();
    for (const [index, raw] of value.captures.entries()) {
        const label = `captures[${index}]`;
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) { fail(label + ' must be an object'); continue; }
        const capture = raw as Record<string, unknown>;
        if (typeof capture.file !== 'string' || !capture.file) { fail(label + '.file must be a nonempty string'); continue; }
        const file = capture.file;
        if (posix.isAbsolute(file) || file.includes('\\') || /^[a-z]:/iu.test(file) || file.split('/').includes('..')) {
            fail(label + '.file must be a relative path inside the gallery');
            continue;
        }
        const resolved = posix.normalize(posix.join(gallery, file)), absolute = join(base, ...resolved.split('/'));
        referenced.add(absolute);
        if (!/\.png$/iu.test(file)) fail(label + '.file must be a PNG');
        if (!fs.existsSync(absolute) || !fs.lstatSync(absolute).isFile()) { fail(label + ' is missing ' + file); continue; }
        const bytes = fs.readFileSync(absolute);
        if (typeof capture.png_sha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(capture.png_sha256))
            fail(label + '.png_sha256 must be a 64-hex digest');
        else if (createHash('sha256').update(bytes).digest('hex') !== capture.png_sha256)
            fail(label + '.png_sha256 differs from ' + file);
        const width = capture.width, height = capture.height;
        if (typeof width !== 'number' || !Number.isSafeInteger(width) || width <= 0 ||
            typeof height !== 'number' || !Number.isSafeInteger(height) || height <= 0) {
            fail(label + ' needs positive width/height');
        } else {
            const dimensions = pngDimensions(bytes);
            if (dimensions.width !== width || dimensions.height !== height) fail(label + ' dimensions differ from ' + file);
        }
        if (typeof capture.bytes !== 'number' || !Number.isSafeInteger(capture.bytes) || capture.bytes <= 0)
            fail(label + '.bytes must be a positive integer');
        else if (bytes.length !== capture.bytes) fail(label + '.bytes differs from ' + file);
    }
    if (requireCompleteness) {
        const directory = join(base, ...gallery.split('/'));
        const images = galleryFiles(directory).filter(file => GALLERY_MEDIA.test(file));
        if (!images.length) fail('gallery needs at least one image');
        for (const image of images)
            if (!referenced.has(image)) errors.push(`${manifest}: image is not referenced: ${galleryRelative(base, image)}`);
    }
    return errors;
}
function galleryReadmeErrors(base: string, gallery: string): string[] {
    const directory = join(base, ...gallery.split('/')), errors: string[] = [];
    for (const [name, nav, status, headings, back] of [
        ['README.md', '**English** | [简体中文](README.zh-CN.md)', '**Status:**',
            ['## Provenance', '## Capture method', '## Evidence limits'], '](../README.md)'],
        ['README.zh-CN.md', '[English](README.md) | **简体中文**', '**状态：**',
            ['## 来源', '## 采集方法', '## 证据限制'], '](../README.zh-CN.md)'],
    ] as const) {
        const path = join(directory, name);
        if (!fs.existsSync(path)) { errors.push(`docs/images/${gallery}/${name}: missing README`); continue; }
        const body = fs.readFileSync(path, 'utf8').replaceAll('\r\n', '\n'), lines = body.split('\n');
        let index = 0;
        while (index < lines.length && (!lines[index]!.trim() || /^<a id="[^"]+"><\/a>$/u.test(lines[index]!.trim()))) index++;
        if (!/^# .+/u.test(lines[index] ?? '')) errors.push(`docs/images/${gallery}/${name}: missing H1`);
        if (!body.includes(nav)) errors.push(`docs/images/${gallery}/${name}: missing language navigation`);
        if (!body.includes(status)) errors.push(`docs/images/${gallery}/${name}: missing status line`);
        for (const heading of headings) if (!body.includes(heading)) errors.push(`docs/images/${gallery}/${name}: missing ${heading}`);
        if (!body.includes(back)) errors.push(`docs/images/${gallery}/${name}: missing gallery index backlink`);
    }
    return errors;
}
function galleryIndexCounts(path: string, heading: string): Map<string, number> {
    const counts = new Map<string, number>();
    if (!fs.existsSync(path)) return counts;
    const body = fs.readFileSync(path, 'utf8').replaceAll('\r\n', '\n'), start = body.indexOf(heading);
    if (start < 0) return counts;
    const section = body.slice(start + heading.length).split(/^## /mu)[0]!;
    for (const match of section.matchAll(/\]\(([^)#]+)(?:#[^)]*)?\)/gu)) {
        const target = posix.normalize(posix.join('docs/images', match[1]!));
        counts.set(target, (counts.get(target) ?? 0) + 1);
    }
    return counts;
}
export function checkImageGalleries(root: string): string[] {
    const base = join(root, 'docs', 'images');
    if (!fs.existsSync(base)) return [];
    const errors: string[] = [], galleries: string[] = [];
    const walk = (directory: string, relativeDirectory: string): void => {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            if (!entry.isDirectory()) continue;
            const childRelative = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
            if (childRelative === 'archive' || childRelative.startsWith('archive/')) continue;
            const child = join(directory, entry.name);
            if (fs.existsSync(join(child, 'README.md'))) galleries.push(childRelative);
            walk(child, childRelative);
        }
    };
    walk(base, '');
    const englishIndex = galleryIndexCounts(join(base, 'README.md'), '## Gallery index');
    const chineseIndex = galleryIndexCounts(join(base, 'README.zh-CN.md'), '## 图库索引');
    for (const gallery of galleries) {
        const englishExpected = `docs/images/${gallery}/README.md`;
        const chineseExpected = `docs/images/${gallery}/README.zh-CN.md`;
        if (englishIndex.get(englishExpected) !== 1) errors.push(`docs/images/README.md: ${gallery} must appear exactly once in the gallery index`);
        if (chineseIndex.get(chineseExpected) !== 1) errors.push(`docs/images/README.zh-CN.md: ${gallery} must appear exactly once in the gallery index`);
        if (!LEGACY_GALLERIES.has(gallery)) {
            const manifestPath = join(base, ...gallery.split('/'), 'captures.json');
            if (!fs.existsSync(manifestPath)) {
                errors.push(`docs/images/${gallery}/captures.json: new gallery needs a schema 2 manifest`);
                continue;
            }
            errors.push(...galleryManifestErrors(manifestPath, gallery, base, true));
            errors.push(...galleryReadmeErrors(base, gallery));
        } else {
            for (const name of ['captures.json', 'provenance.json']) {
                const path = join(base, ...gallery.split('/'), name);
                if (!fs.existsSync(path)) continue;
                try {
                    const value = JSON.parse(fs.readFileSync(path, 'utf8')) as Record<string, unknown>;
                    if (value.schema_version === GALLERY_SCHEMA_VERSION) errors.push(...galleryManifestErrors(path, gallery, base, false));
                } catch { /* Existing v1 manifests are validated by checkAssetInputs when selected. */ }
            }
        }
    }
    return errors;
}
