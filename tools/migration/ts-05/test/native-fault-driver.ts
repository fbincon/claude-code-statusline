/** Fault injection occurs in a disposable process, against the actual compiled adapters. */
import assert from 'node:assert/strict';
import { nativeApi } from '@fbincon/statusline-platform/native';
import { syncBuiltinESMExports } from 'node:module';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const actualPlatform = process.platform;
const [platform, operation] = process.argv.slice(2), api = nativeApi();
const state: any = { ticks: 9007199254740993n, numer: 125, denom: 3, sequence: 41, fail: '', calls: [], closed: 0 };
const fake = (signature: string) => (...args: any[]) => {
    state.calls.push(signature);
    if (state.fail === 'library') throw new Error('unavailable');
    if (signature.includes('clock_gettime')) { Object.assign(args[1], { sec: 2000000000, nsec: 123 }); return 0; }
    if (signature.includes('mach_timebase_info')) { Object.assign(args[0], { numer: state.numer, denom: state.denom }); return state.fail === 'timebase' ? -1 : 0; }
    if (signature.includes('mach_continuous_time')) return state.ticks;
    if (signature.includes('sysctlbyname')) { assert.equal(args[0], 'kern.bootsessionuuid'); assert.equal(args[3], null); args[1].write(state.fail === 'uuid' ? 'bad' : '12345678-1234-5678-9abc-123456789abc\0'); return state.fail === 'sysctl' ? -1 : 0; }
    if (signature.includes('GetSystemTimePreciseAsFileTime')) { args[0].writeBigUInt64LE(133800000000000000n); return; }
    if (signature.includes('GetTickCount64')) return 1000n;
    if (signature.includes('NtQuerySystemInformation')) { args[1].fill(state.fail === 'zero-guid' ? 0 : 1); args[3][0] = state.fail === 'short-guid' ? 31 : 32; return state.fail === 'ntquery' ? -1 : 0; }
    if (signature.includes('ReadProcessMemory')) { assert.equal(args[1], 0x7ffe02c4); args[2].writeUInt32LE(state.fail === 'zero-sequence' ? 0 : state.sequence); args[4][0] = state.fail === 'short-read' ? 3 : 4; return state.fail === 'read' ? 0 : 1; }
    if (signature.includes('proc_pidinfo')) {
        assert.equal(args[0], 42); assert.equal(args[1], 3); assert.equal(args[4], 136);
        args[3].writeUInt32LE(state.fail === 'wrong-pid' ? 43 : 42, 12);
        args[3].writeUInt32LE(state.fail === 'bad-state' ? 6 : 2, 4);
        args[3].writeBigUInt64LE(state.fail === 'zero-time' ? 0n : BigInt(Date.UTC(2026, 9, 2, 1, 2, 3) / 1000), 120);
        return state.fail === 'short-info' ? 135 : 136;
    }
    if (signature.includes('OpenProcess')) return state.fail === 'access' ? null : 1;
    if (signature.includes('GetCurrentProcess')) return 1;
    if (signature.includes('GetProcessTimes')) { args[1].writeBigUInt64LE(133800000000001237n); return state.fail === 'times' ? 0 : 1; }
    if (signature.includes('FileTimeToSystemTime')) return state.fail === 'utc' ? 0 : 1;
    if (signature.includes('SystemTimeToTzSpecificLocalTimeEx')) return state.fail === 'local' ? 0 : 1;
    if (signature.includes('SystemTimeToFileTime')) { args[1].writeBigUInt64LE(133800000000000000n); return state.fail === 'filetime' ? 0 : 1; }
    if (signature.includes('CloseHandle')) { state.closed++; return true; }
    if (signature.includes('GetFileAttributesW')) return state.fail === 'reparse' ? 0x400 : 0x80;
    throw new Error('Unexpected native call: ' + signature);
};
Object.defineProperty(api, 'load', { value: () => ({ func: fake }) });
Object.defineProperty(process, 'platform', { value: platform });
if (operation === 'clock') {
    const { nativeSample, sample } = await import('@fbincon/statusline-platform/clocks');
    const first = nativeSample(); assert(first.boot_id); assert(first.boot_ns! > 0n);
    if (platform === 'darwin') {
        assert.equal(first.boot_ns, 375299968947541375n);
        assert(state.calls.some((s: string) => s.includes('uint64_t mach_continuous_time')));
        for (const fail of ['timebase', 'sysctl', 'uuid', 'library']) { state.fail = fail; const value = sample(); assert.equal(value.boot_id, null); assert.equal(value.boot_ns, null); assert(value.wall_ns > 0n); }
        state.fail = ''; for (const key of ['numer', 'denom']) { const old = state[key]; state[key] = 0; assert.equal(nativeSample().boot_id, null); state[key] = old; }
    } else {
        state.sequence++; assert.notEqual(nativeSample().boot_id, first.boot_id);
        for (const fail of ['ntquery', 'short-guid', 'zero-guid', 'read', 'short-read', 'zero-sequence', 'library']) { state.fail = fail; const value = sample(); assert.equal(value.boot_id, null); assert.equal(value.boot_ns, null); assert(value.wall_ns > 0n); }
    }
} else if (operation === 'process') {
    const { processToken } = await import('@fbincon/statusline-platform/processes');
    assert.equal(processToken(42), platform === 'darwin' ? 'Fri Oct  2 01:02:03 2026' : '638711232000001230');
    for (const fail of platform === 'darwin' ? ['library', 'short-info', 'wrong-pid', 'zero-time', 'bad-state'] : ['access', 'times', 'utc', 'local', 'filetime']) { state.fail = fail; assert.equal(processToken(42), null); }
    assert.equal(processToken(-1), null); assert.equal(processToken(1.2), null);
    if (platform === 'win32') assert.equal(state.closed, 5);
} else if (operation === 'files') {
    const root = fs.mkdtempSync(join(tmpdir(), 'ts05-native-fault-')), path = join(root, 'state'); fs.writeFileSync(path, 'old');
    const originalSync = fs.fsyncSync, originalRename = fs.renameSync, originalUnlink = fs.unlinkSync, originalClose = fs.closeSync, originalOpen = fs.openSync;
    let attempts = 0, closes = 0;
    try {
        const { atomicWrite, durableUnlink, privateDirectory, isLinkOrReparse, syncDirectory } = await import('@fbincon/statusline-platform/files');
        if (platform === 'win32') {
            assert.equal(isLinkOrReparse(path), false); state.fail = 'reparse'; assert.equal(isLinkOrReparse(path), true); state.fail = '';
            fs.chmodSync = () => { throw new Error('Windows chmod must not be called'); }; syncBuiltinESMExports(); privateDirectory(root);
            fs.renameSync = (a, b) => { if (++attempts < 3) throw Object.assign(new Error('sharing'), { code: 'EPERM' }); originalRename(a, b); }; syncBuiltinESMExports();
            atomicWrite(path, 'new'); assert.equal(attempts, 3); assert.equal(fs.readFileSync(path, 'utf8'), 'new');
            attempts = 0; fs.unlinkSync = a => { if (++attempts < 3) throw Object.assign(new Error('sharing'), { code: 'EPERM' }); originalUnlink(a); }; syncBuiltinESMExports();
            durableUnlink(path); assert.equal(attempts, 3); assert.equal(fs.existsSync(path), false);
        } else {
            if (actualPlatform === 'win32') fs.openSync = (name, flags, mode) => originalOpen(flags === 'r' && fs.statSync(name).isDirectory() ? path : name, flags, mode);
            fs.fsyncSync = () => { throw Object.assign(new Error('unsupported'), { code: 'EINVAL' }); };
            fs.closeSync = fd => { closes++; originalClose(fd); }; syncBuiltinESMExports();
            assert.equal(syncDirectory(path), false); assert.equal(closes, 1);
            assert.throws(() => atomicWrite(path, 'bad')); assert.equal(fs.readFileSync(path, 'utf8'), 'old'); assert.equal(fs.readdirSync(root).length, 1);
            fs.fsyncSync = () => { throw Object.assign(new Error('disk full'), { code: 'ENOSPC' }); }; syncBuiltinESMExports(); assert.throws(() => syncDirectory(path));
        }
    } finally { fs.fsyncSync = originalSync; fs.renameSync = originalRename; fs.unlinkSync = originalUnlink; fs.closeSync = originalClose; fs.openSync = originalOpen; syncBuiltinESMExports(); fs.rmSync(root, { recursive: true, force: true }); }
} else throw new Error('Unknown native fault scenario');
console.log(JSON.stringify({ platform, operation, status: 'pass', native_calls: state.calls.length }));
