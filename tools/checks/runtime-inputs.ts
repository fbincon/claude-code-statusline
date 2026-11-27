/** Freeze moving runtime selectors once for this candidate, not once per runner. */
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
export async function readRuntimeIndex(request: typeof fetch = fetch, sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))) {
    const transient = (error: any): boolean => error?.name === 'TimeoutError' || ['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_SOCKET'].includes(error?.code) || Boolean(error?.cause && transient(error.cause));
    for (let attempt = 1; attempt <= 3; attempt++) {
        let retry = false;
        try {
            const response = await request('https://nodejs.org/dist/index.json', { signal: AbortSignal.timeout(30000), redirect: 'error' });
            if (!response.ok) { retry = [408, 429, 500, 502, 503, 504].includes(response.status); await response.body?.cancel(); throw new Error('Runtime index HTTP ' + response.status); }
            assert(response.body); const chunks: Buffer[] = []; let size = 0;
            for await (const chunk of response.body) { size += chunk.length; assert(size < 8 * 1024 * 1024, 'Runtime index exceeds bound'); chunks.push(Buffer.from(chunk)); }
            const bytes = Buffer.concat(chunks), rows = JSON.parse(bytes.toString('utf8'));
            assert(Array.isArray(rows) && rows.every(row => row && typeof row.version === 'string'), 'Invalid runtime index');
            return { rows, index_sha256: createHash('sha256').update(bytes).digest('hex'), resolved_at: new Date().toISOString() };
        } catch (error) { if (attempt === 3 || !(retry || transient(error))) throw error; await sleep(attempt * 1000); }
    }
    throw new Error('Runtime index attempts exhausted');
}
/** The original runner registry remains available to archived acceptance. */
export const LEGACY_TARGETS = [
    { os: 'ubuntu-24.04', arch: 'x64' }, { os: 'windows-2025', arch: 'x64' }, { os: 'windows-11-arm', arch: 'x64', host_arch: 'arm64' },
    { os: 'macos-14', arch: 'arm64' }, { os: 'macos-15', arch: 'arm64' }, { os: 'macos-15-intel', arch: 'x64' },
    { os: 'macos-26', arch: 'arm64' }, { os: 'macos-26-intel', arch: 'x64' },
];
export const TARGETS = LEGACY_TARGETS.filter(target => target.os !== 'macos-14');
export type RunnerPolicy = 'legacy' | 'current';
export function runnerTargets(policy: RunnerPolicy) {
    return policy === 'legacy' ? LEGACY_TARGETS : TARGETS;
}
export const AGENT_ROWS_MANIFEST = 'mods/statusline-agent-rows/.claude-plugin/plugin.json';
export const AGENT_ROW_HOSTS = ['2.1.326', '2.1.332'] as const;
export function officialModsForHost(version: string, agentRows: boolean): string[] {
    assert.match(version, /^2\.1\.\d+$/u, 'Expected a pinned official host');
    const patch = Number(version.split('.')[2]);
    return ['statusline-native', ...(patch >= 289 ? ['statusline-runtime'] : []),
        ...(agentRows && patch >= 326 ? ['statusline-agent-rows'] : [])];
}
export const LEGACY_HOSTS = [
    ...['2.1.287', '2.1.288', '2.1.289', '2.1.294', '2.1.296', '2.1.310'].map(claude => ({ os: 'ubuntu-24.04', claude })),
    ...['windows-2025', 'macos-15'].flatMap(os => ['2.1.288', '2.1.289', '2.1.294', '2.1.296', '2.1.310'].map(claude => ({ os, claude }))),
];
export const HOSTS = [...LEGACY_HOSTS, ...['ubuntu-24.04', 'windows-2025', 'macos-15']
    .flatMap(os => AGENT_ROW_HOSTS.map(claude => ({ os, claude })))];
export function runtimeInputs(index: { version: string }[], development: string, policy: RunnerPolicy = 'current') {
    const latest = (major: number) => {
        const versions = index.map(row => row.version.replace(/^v/u, '')).filter(version => new RegExp(`^${major}\\.\\d+\\.\\d+$`, 'u').test(version));
        versions.sort((a, b) => { const aa = a.split('.').map(Number), bb = b.split('.').map(Number); return bb[1]! - aa[1]! || bb[2]! - aa[2]!; });
        assert(versions[0], 'Missing supported Node release'); return versions[0];
    };
    const versions: Record<string, string> = { '22.0.0': '22.0.0', '22.x': latest(22), '24.0.0': '24.0.0', '24.x': latest(24) };
    // A matching development runtime executes the full source suite, which is
    // a strict superset of --runtime, and the same isolated installed suite.
    const shared = Object.keys(versions).filter(key => versions[key] === development);
    const include = Object.entries(versions).filter(([key]) => !shared.includes(key))
        .flatMap(([node, version]) => runnerTargets(policy).map(target => ({ node, version, target })));
    return { schema_version: 1, development, versions, shared, matrix: { include } };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    assert(process.argv[2], 'Require output file');
    const index = await readRuntimeIndex();
    const result = { ...runtimeInputs(index.rows, fs.readFileSync('.node-version', 'utf8').trim()), index_sha256: index.index_sha256, resolved_at: index.resolved_at };
    fs.writeFileSync(process.argv[2], JSON.stringify(result, null, 2) + '\n');
    if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `runtime_matrix=${JSON.stringify(result.matrix)}\nshared_runtimes=${JSON.stringify(result.shared)}\n`);
}
