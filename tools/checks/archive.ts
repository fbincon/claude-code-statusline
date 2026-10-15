import * as fs from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { repoRoot } from '../migration/ts-03/common.js';
import { sha256 } from '../build/files.js';
export function checkArchive(root = repoRoot) {
    const bytes = fs.readFileSync(join(root, 'archive/python/manifest.json'));
    if (sha256(bytes) !== fs.readFileSync(join(root, 'archive/python/manifest.sha256'), 'utf8').trim()) throw new Error('Python archive manifest changed');
    const manifest = JSON.parse(bytes.toString()), snapshot = JSON.parse(fs.readFileSync(join(root, 'tools/migration/ts-05/snapshot.json'), 'utf8'));
    if (!/^[a-f0-9]{40}$/u.test(manifest.reference_commit) || manifest.baseline_commit !== snapshot.commit) throw new Error('Wrong archive reference');
    for (const [name, row] of Object.entries(manifest.files) as [string, any][]) {
        if (!row.path.startsWith('archive/python/') || row.path.split('/').includes('..') || fs.lstatSync(join(root, row.path)).isSymbolicLink()) throw new Error('Unsafe archive path');
        if (sha256(fs.readFileSync(join(root, row.path))) !== row.sha256) throw new Error('Archived bytes changed: ' + name);
    }
    for (const [name, hash] of Object.entries(snapshot.sources)) if (manifest.files[name]?.sha256 !== hash) throw new Error('Python responsibility snapshot is not preserved: ' + name);
    return { status: 'pass', python_sources: Object.keys(snapshot.sources).length, archived_files: Object.keys(manifest.files).length, reference_commit: manifest.reference_commit, manifest_sha256: sha256(bytes) };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) console.log(JSON.stringify(checkArchive()));
