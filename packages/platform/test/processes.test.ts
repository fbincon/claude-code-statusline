import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { decodeDarwinProcess } from '../src/darwin-process.js';
import { processToken, processMatches } from '../src/processes.js';
test('Darwin native identity retains exact historical UTC spacing and rejects malformed kernel responses', () => {
    const bytes = Buffer.alloc(136); bytes.writeUInt32LE(42, 12); bytes.writeUInt32LE(2, 4);
    bytes.writeBigUInt64LE(BigInt(Date.UTC(2026, 9, 2, 1, 2, 3) / 1000), 120); bytes.writeBigUInt64LE(123456n, 128);
    assert.deepEqual(decodeDarwinProcess(bytes, 42), { token: 'Fri Oct  2 01:02:03 2026', alive: true });
    bytes.writeUInt32LE(5, 4); assert.equal(decodeDarwinProcess(bytes, 42)?.alive, false);
    assert.equal(decodeDarwinProcess(bytes, 43), null); assert.equal(decodeDarwinProcess(bytes.subarray(1), 42), null);
    bytes.writeUInt32LE(6, 4); assert.equal(decodeDarwinProcess(bytes, 42), null);
    bytes.writeUInt32LE(2, 4); bytes.writeBigUInt64LE(1000000n, 128); assert.equal(decodeDarwinProcess(bytes, 42), null);
    bytes.writeBigUInt64LE(0n, 128); bytes.writeBigUInt64LE(0n, 120); assert.equal(decodeDarwinProcess(bytes, 42), null);
});
test('actual Darwin native identity agrees with the historical ps contract and stays fresh', { skip: process.platform !== 'darwin' }, () => {
    const expected = execFileSync('/bin/ps', ['-o', 'lstart=', '-p', String(process.pid)], { encoding: 'utf8', env: { ...process.env, LC_ALL: 'C', TZ: 'UTC' }, timeout: 5000 }).trim();
    assert(expected);
    for (let sample = 0; sample < 1000; sample++) assert.equal(processToken(process.pid), expected);
    assert.equal(processMatches(process.pid, expected), true); assert.equal(processMatches(process.pid, 'wrong'), false);
    assert.equal(processToken(0), null); assert.equal(processMatches(0, expected), false);
});
