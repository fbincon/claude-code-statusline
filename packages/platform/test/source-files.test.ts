import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,symlinkSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readSourceFile} from '../src/source-files.js';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { FileChangedError } from '../src/files.js';
test('source files reject oversized, linked and special inputs without blocking',t=>{
    const root=mkdtempSync(join(tmpdir(),'source files '));t.after(()=>rmSync(root,{recursive:true,force:true}));
    const path=join(root,'data.json');assert.equal(readSourceFile(path),null);
    writeFileSync(path,'{"value":0}');assert.equal(readSourceFile(path)?.toString(),'{"value":0}');
    writeFileSync(path,'x'.repeat(1048577));assert.throws(()=>readSourceFile(path));
    assert.throws(()=>readSourceFile(root));
    if(process.platform!=='win32'){
        const linked=join(root,'link');symlinkSync(path,linked);assert.throws(()=>readSourceFile(linked));
        const fifo=join(root,'fifo');execFileSync('mkfifo',[fifo]);assert.throws(()=>readSourceFile(fifo));
    }
});

for (const swaps of [1, 3]) test(`atomic source replacement retries complete snapshots, bounded at three attempts: ${swaps}`, t => {
    const root = mkdtempSync(join(tmpdir(), 'source replace ')), path = join(root, 'job.json');
    writeFileSync(path, 'old');
    const replacements = Array.from({ length: swaps }, (_, i) => { const file = join(root, String(i)); writeFileSync(file, 'new-' + i); return file; });
    const open = fs.openSync; let attempts = 0;
    t.mock.method(fs, 'openSync', (...args: Parameters<typeof fs.openSync>) => {
        if (String(args[0]) === path) {
            const replacement = replacements[attempts++];
            if (replacement) fs.renameSync(replacement, path);
        }
        return open(...args);
    });
    syncBuiltinESMExports();
    try {
        if (swaps === 1) { assert.equal(readSourceFile(path)?.toString(), 'new-0'); assert.equal(attempts, 2); }
        else { assert.throws(() => readSourceFile(path), FileChangedError); assert.equal(attempts, 3); }
    } finally { t.mock.restoreAll(); syncBuiltinESMExports(); rmSync(root, { recursive: true, force: true }); }
});

test('a replacement symlink cannot become a readable source during retry', { skip: process.platform === 'win32' }, t => {
    const root = mkdtempSync(join(tmpdir(), 'source link race ')), path = join(root, 'job.json'), outside = join(root, 'other');
    writeFileSync(path, 'old'); writeFileSync(outside, 'not a source');
    const open = fs.openSync; let switched = false;
    t.mock.method(fs, 'openSync', (...args: Parameters<typeof fs.openSync>) => {
        if (String(args[0]) === path && !switched) { switched = true; fs.unlinkSync(path); symlinkSync(outside, path); }
        return open(...args);
    });
    syncBuiltinESMExports();
    try { assert.throws(() => readSourceFile(path)); assert.equal(fs.readFileSync(outside, 'utf8'), 'not a source'); }
    finally { t.mock.restoreAll(); syncBuiltinESMExports(); rmSync(root, { recursive: true, force: true }); }
});
