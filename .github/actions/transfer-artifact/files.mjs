import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { crc32 } from 'node:zlib';
import { promisify } from 'node:util';

export const MAX_ZIP = 512*1024*1024, MAX_FILES = 12000, MAX_BYTES = 1024*1024*1024;
function component(name) {
    assert(name && !/[<>:"|?*\\/\u0000-\u001f]/u.test(name) && !/[. ]$/u.test(name) &&
        !/^(?:con|nul|prn|aux|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(name),'Unsafe artifact entry');
}
export async function inventory(path, copy) {
    const stat=fs.lstatSync(path), files=[], manifest={}, seen=new Set(); let total=0;
    const root=stat.isDirectory()?path:dirname(path);
    async function visit(name) {
        if(name){component(name.split('/').at(-1));const key=name.toLowerCase();assert(!seen.has(key),'Duplicate artifact entry');seen.add(key);}
        const source=join(root,name), info=fs.lstatSync(source);
        if(info.isDirectory()){
            for (const entry of fs.readdirSync(source).sort()) {
                if(copy && entry.startsWith('.')) continue; // upload-artifact's default excludes hidden files
                await visit(name?name+'/'+entry:entry);
            }
            return;
        }
        assert(info.isFile() && !info.isSymbolicLink(),'Artifact inputs must be regular files');
        assert(files.length<MAX_FILES&&info.size<=MAX_BYTES-total,'Artifact input limit exceeded');
        const destination=copy?join(copy,name):source;
        if(copy){fs.mkdirSync(dirname(destination),{recursive:true});await fs.promises.copyFile(source,destination,fs.constants.COPYFILE_EXCL);}
        const hash=createHash('sha256');for await(const bytes of fs.createReadStream(destination)){total+=bytes.length;assert(total<=MAX_BYTES,'Artifact input limit exceeded');hash.update(bytes);}
        files.push(destination);Object.defineProperty(manifest,name,{value:hash.digest('hex'),enumerable:true});
    }
    if(copy&&!stat.isDirectory())assert(!basename(path).startsWith('.'),'Hidden upload file');
    await visit(stat.isDirectory()?'':basename(path));assert(files.length,'No artifact files');
    return {files,manifest};
}
/** ZIP bytes are authenticated before reading entries. No entry can leave this fresh staging directory. */
export async function extract(yauzl,zip,output) {
    const archive=await promisify(yauzl.open)(zip,{lazyEntries:true,autoClose:false,strictFileNames:true,validateEntrySizes:true});
    fs.mkdirSync(output);let total=0;const paths=new Set(),files=new Set();
    try {
        assert(archive.entryCount>0&&archive.entryCount<=MAX_FILES,'Artifact ZIP entry count exceeds limit');
        for await(const entry of archive.eachEntry()) {
            const dir=entry.fileName.endsWith('/'), name=dir?entry.fileName.slice(0,-1):entry.fileName;
            for (const bit of name.split('/'))component(bit);
            const key=name.toLowerCase();assert(!paths.has(key),'Duplicate ZIP entry');paths.add(key);
            const attr=(entry.externalFileAttributes>>>16)&0o170000;
            assert([0,dir?0o040000:0o100000].includes(attr)&&!(entry.generalPurposeBitFlag&1)&&[0,8].includes(entry.compressionMethod),'Invalid ZIP entry type');
            const target=join(output,name);
            if(dir){fs.mkdirSync(target,{recursive:true});continue;}
            assert(Number.isSafeInteger(entry.uncompressedSize)&&entry.uncompressedSize>=0&&(total+=entry.uncompressedSize)<=MAX_BYTES,'Artifact expanded limit exceeded');
            fs.mkdirSync(dirname(target),{recursive:true}); let size=0,crc=0;
            const check=new Transform({transform(bytes,encoding,done){size+=bytes.length;if(size>entry.uncompressedSize)return done(new Error('Invalid ZIP file size'));crc=crc32(bytes,crc);done(null,bytes);}});
            await pipeline(await promisify(archive.openReadStream.bind(archive))(entry),check,fs.createWriteStream(target,{flags:'wx',mode:0o600}));
            assert.equal(size,entry.uncompressedSize);assert.equal(crc,entry.crc32,'ZIP CRC mismatch');files.add(key);
        }
        assert(files.size,'Empty artifact ZIP');
    } finally {archive.close();}
}
