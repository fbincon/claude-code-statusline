/** Export the accepted parent's verifier and install its integrity-pinned parser dependencies. */
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { git, hash, canonical } from './impact-content.ts';
import { exportBaseVerifiers } from './ci-trust.ts';
import type { MaintenanceRecord } from './impact-evidence.ts';
import { npmEntry } from '../build/files.ts';

export async function withImpactVerifier<T>(base: string, use: (directory: string) => Promise<T>, install = (directory: string) => {
    execFileSync(process.execPath, [npmEntry(), 'ci', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: directory, timeout: 180000, stdio: ['ignore', 'pipe', 'pipe'] });
}): Promise<T> {
    const directory = fs.mkdtempSync(join(tmpdir(), 'impact-verifier-'));
    try {
        exportBaseVerifiers(base, directory);
        for (const path of ['tools/build/impact-package.ts', 'tools/build/files.ts']) {
            const target = join(directory, path); fs.mkdirSync(dirname(target), { recursive: true });
            fs.writeFileSync(target, execFileSync('git', ['show', base + ':' + path]), { flag: 'wx' });
        }
        const original = JSON.parse(git('show', base + ':package-lock.json')), packages: Record<string, any> = {};
        function dependency(name: string) {
            const path = 'node_modules/' + name; if (packages[path]) return;
            const entry = original.packages[path]; assert(entry && entry.integrity && !entry.link, 'Missing independently pinned verifier dependency');
            packages[path] = entry;
            for (const child of Object.keys(entry.dependencies ?? {})) dependency(child);
        }
        for (const name of ['typescript', 'tar']) dependency(name);
        const manifest = { name: 'accepted-impact-verifier', version: '0.0.0', private: true, type: 'module', dependencies: Object.fromEntries(['typescript', 'tar'].map(name => [name, packages['node_modules/' + name].version])) };
        fs.writeFileSync(join(directory, 'package.json'), JSON.stringify(manifest));
        fs.writeFileSync(join(directory, 'package-lock.json'), JSON.stringify({ name: manifest.name, version: manifest.version, lockfileVersion: 3, requires: true, packages: { '': manifest, ...packages } }));
        install(directory);
        return await use(directory);
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
}
export async function independentMaintenance(reused: NonNullable<MaintenanceRecord['reused']>, comparisonDirectory?: string): Promise<string> {
    return withImpactVerifier(reused.integration.base, async directory => {
        const verifier = await import(pathToFileURL(join(directory, 'tools/checks/impact-evidence.ts')).href);
        await verifier.verifyMaintenanceWithBase(reused);
        if (comparisonDirectory) {
            const comparison = JSON.parse(fs.readFileSync(join(comparisonDirectory, 'comparison.json'), 'utf8'));
            const packages = await import(pathToFileURL(join(directory, 'tools/build/impact-package.ts')).href);
            const observed = packages.comparePackages(comparison.base, comparison.head, join(comparisonDirectory, 'base.tgz'), join(comparisonDirectory, 'head.tgz'));
            assert.deepEqual(observed, comparison); assert.equal(observed.equivalent, true);
            assert.equal(observed.head, reused.integration.head); assert.equal(observed.base, reused.integration.base);
        }
        return hash(canonical({ verifier_commit: reused.integration.base, source: reused.source, integration: reused.integration, comparison: comparisonDirectory ? hash(fs.readFileSync(join(comparisonDirectory, 'comparison.json'))) : null }));
    });
}
