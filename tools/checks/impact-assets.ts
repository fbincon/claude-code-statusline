/** Offline validation of maintained media and inspectable capture metadata. */
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { dirname, extname, resolve, relative, isAbsolute } from 'node:path';
import { crc32, inflateSync } from 'node:zlib';
import { hash } from './impact-content.ts';

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
export function checkAssets(root: string, paths: readonly string[]): void {
    const selected = new Set(paths);
    for (const name of paths.filter(name => /^docs\/.*\.(?:png|jpe?g|gif|webp|svg|mp4|webm)$/u.test(name))) {
        const parent = dirname(resolve(root, name));
        if (fs.existsSync(parent)) for (const sibling of fs.readdirSync(parent).filter(file => file.endsWith('.json'))) selected.add(relative(root, resolve(parent, sibling)).replaceAll('\\', '/'));
    }
    for (const name of selected) {
        if (!name.startsWith('docs/') || !/\.(?:png|jpe?g|gif|webp|svg|mp4|webm|pdf|json)$/u.test(name)) continue;
        const path = resolve(root, name); if (!fs.existsSync(path)) continue;
        assert(fs.lstatSync(path).isFile()); const raw = fs.readFileSync(path); checkAsset(name, raw);
        if (!name.endsWith('.json')) continue;
        const record = JSON.parse(raw.toString());
        if (!Array.isArray(record.captures)) continue;
        for (const capture of record.captures) {
            assert(typeof capture.file === 'string');
            const image = resolve(dirname(path), capture.file), rel = relative(root, image);
            assert(!isAbsolute(rel) && rel !== '..' && !rel.startsWith('../') && !rel.startsWith('..\\'), 'Capture escapes repository');
            const pixels = fs.readFileSync(image); checkAsset(image, pixels);
            if (capture.png_sha256 !== undefined) assert.equal(hash(pixels), capture.png_sha256, 'Capture digest differs');
            if (image.endsWith('.png') && capture.width !== undefined) assert.deepEqual(pngDimensions(pixels), { width: capture.width, height: capture.height });
            if (capture.source_sha256 !== undefined) assert.match(capture.source_sha256, /^[a-f0-9]{64}$/u);
            // Raw PTY/font sources may intentionally be ignored. Their recorded
            // identities are not claims that CI reproduced those observations.
        }
    }
}
