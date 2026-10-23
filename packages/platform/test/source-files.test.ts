import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,symlinkSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readSourceFile} from '../src/source-files.js';
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
