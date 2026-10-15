import test from 'node:test';
import assert from 'node:assert/strict';
import { renderCapture } from '../render-capture.js';
import { Capture } from '../../migration/ts-04/capture.js';
test('captured RGB backgrounds survive cropping and PNG reconstruction', () => {
    const capture = new Capture(4, 2);
    capture.feed('\x1b[48;2;1;2;3m  \x1b[0m');
    const record = { columns: 4, rows: 2, cells: capture.buffer }, image = renderCapture(record, [0, 0, 2, 1]);
    assert.equal(image.width, 48);
    assert.equal(image.height, 48);
    assert.equal(image.png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    const pixel = (13 * image.width + 13) * 4;
    assert.deepEqual([...image.pixels.subarray(pixel, pixel + 4)], [1, 2, 3, 255]);
    assert.throws(() => renderCapture(record, [3, 0, 2, 1]));
});
test('terminal reconstruction escapes literal markup and preserves grapheme cell text', () => {
    const capture = new Capture(12, 2);
    capture.feed('<&中文é');
    const image = renderCapture({ columns: 12, rows: 2, cells: capture.buffer }, [0, 0, 12, 2]);
    assert.ok(image.svg.includes('&lt;'));
    assert.ok(image.svg.includes('&amp;'));
    assert.ok(image.svg.includes('中文') || image.svg.includes('中'));
    assert.ok(image.svg.includes('é'));
});
