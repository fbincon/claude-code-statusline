/** Freeze moving runtime selectors once for this candidate, not once per runner. */
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
export const TARGETS = [
    { os: 'ubuntu-24.04', arch: 'x64' }, { os: 'windows-2025', arch: 'x64' }, { os: 'windows-11-arm', arch: 'x64', host_arch: 'arm64' },
    { os: 'macos-14', arch: 'arm64' }, { os: 'macos-15', arch: 'arm64' }, { os: 'macos-15-intel', arch: 'x64' },
    { os: 'macos-26', arch: 'arm64' }, { os: 'macos-26-intel', arch: 'x64' },
];
export function runtimeInputs(index: { version: string }[], development: string) {
    const latest = (major: number) => {
        const versions = index.map(row => row.version.replace(/^v/u, '')).filter(version => new RegExp(`^${major}\\.\\d+\\.\\d+$`, 'u').test(version));
        versions.sort((a, b) => { const aa = a.split('.').map(Number), bb = b.split('.').map(Number); return bb[1]! - aa[1]! || bb[2]! - aa[2]!; });
        assert(versions[0], 'Missing supported Node release'); return versions[0];
    };
    const versions: Record<string, string> = { '22.0.0': '22.0.0', '22.x': latest(22), '24.0.0': '24.0.0', '24.x': latest(24) };
    // A matching development runtime executes the full source suite, which is
    // a strict superset of --runtime, and the same isolated installed suite.
    const shared = Object.keys(versions).filter(key => versions[key] === development);
    const include = Object.entries(versions).filter(([key]) => !shared.includes(key)).flatMap(([node, version]) => TARGETS.map(target => ({ node, version, target })));
    return { schema_version: 1, development, versions, shared, matrix: { include } };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    assert(process.argv[2], 'Require output file');
    const response = await fetch('https://nodejs.org/dist/index.json', { signal: AbortSignal.timeout(30000) }); assert(response.ok);
    const result = runtimeInputs(await response.json() as { version: string }[], fs.readFileSync('.node-version', 'utf8').trim());
    fs.writeFileSync(process.argv[2], JSON.stringify(result, null, 2) + '\n');
    if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `runtime_matrix=${JSON.stringify(result.matrix)}\nshared_runtimes=${JSON.stringify(result.shared)}\n`);
}
