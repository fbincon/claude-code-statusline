import assert from 'node:assert/strict';
import { digest, git } from './ci-evidence.ts';
import { agentRowsAt } from './ci-coverage.ts';
import { AGENT_ROW_HOSTS } from './runtime-inputs.ts';

export const RELEASE_POLICY_PATH = 'tools/checks/release-ci-v1.json';
const activation = '{"schema_version":1,"policy":"release-smoke"}';
export const releaseWorkflow = '.github/workflows/ci.yml';
export const releasePackageArtifact = 'ci-release-delivery';
export const candidateGate = 'Accept release candidate';
export const integrationGate = 'Accept release integration';
export const tagGate = 'Verify release tag';
export const shaPattern = /^[a-f0-9]{40}$/u;
export const digestPattern = /^[a-f0-9]{64}$/u;
export const versionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/u;
export const hostVersion = '2.1.310';

const platforms = [
    { id: 'linux', os: 'ubuntu-24.04', platform: 'linux', arch: 'x64', host_arch: 'x64' },
    { id: 'windows', os: 'windows-2025', platform: 'win32', arch: 'x64', host_arch: 'x64' },
    { id: 'macos', os: 'macos-15', platform: 'darwin', arch: 'arm64', host_arch: 'arm64' },
] as const;
const installTargets = [
    ...platforms,
    { id: 'windows-arm', os: 'windows-11-arm', platform: 'win32', arch: 'x64', host_arch: 'arm64' },
    { id: 'macos-intel', os: 'macos-15-intel', platform: 'darwin', arch: 'x64', host_arch: 'x64' },
] as const;
export const packageSmokeChecks = [
    'offline-empty-cache-install', 'version', 'install', 'doctor', 'render', 'configuration-read-write', 'uninstall-preserves-unowned-settings',
];
export const buildChecks = ['development', 'independent-builds', 'archive-rebuild', 'release-readiness'];

export type Case = {
    id: string; kind: 'package' | 'host'; node: string;
    os: string; platform: string; arch: string; host_arch: string;
    host?: string;
};
export type Producer = { job: string; os: string; artifact: string };
export const candidateBuild: Producer = { job: 'Build release candidate', os: 'ubuntu-24.04', artifact: 'ci-release-build' };
export const integrationPreflight: Producer = { job: 'Verify release merge', os: 'ubuntu-24.04', artifact: 'ci-release-preflight' };

export function workflowCase(row: Case, phase: 'candidate' | 'main'): Case & Producer {
    return { ...row, job: `Release ${phase} / ${row.id}`, artifact: `ci-release-${phase}-${row.id}` };
}

export function isReleaseBranch(branch: string): boolean {
    return /^release\/[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(branch);
}

function sourceNode(commit: string): string {
    const node = git('show', commit + ':.node-version');
    assert.match(node, /^24\.\d+\.\d+$/u);
    return node;
}

export function sourceVersion(commit: string): string {
    const source = git('show', commit + ':packages/core/src/release.ts');
    const match = /^export const VERSION = '([^']+)';$/mu.exec(source);
    assert(match, 'Missing canonical release version');
    assert.match(match[1]!, versionPattern);
    return match[1]!;
}

export function candidateCases(commit: string) {
    return candidateCasesForNode(sourceNode(commit), agentRowsAt(commit));
}

export function candidateCasesForNode(node: string, agentRows = false) {
    return [
        ...installTargets.map(target => workflowCase({ ...target, id: target.id + '-node22', kind: 'package', node: '22.0.0' }, 'candidate')),
        workflowCase({ ...platforms[0], id: 'linux-node24', kind: 'package', node: '24.0.0' }, 'candidate'),
        ...platforms.map(target => workflowCase({ ...target, id: target.id + '-claude', kind: 'host', node, host: hostVersion }, 'candidate')),
        ...(agentRows ? AGENT_ROW_HOSTS.flatMap(host => platforms.map(target => workflowCase({
            ...target, id: target.id + '-claude-' + host, kind: 'host', node, host,
        }, 'candidate'))) : []),
    ];
}

export function integrationCases(commit: string) {
    const node = sourceNode(commit);
    return platforms.map(target => workflowCase({ ...target, kind: 'package', node }, 'main'));
}

export function releasePolicyAt(commit: string): boolean {
    assert.match(commit, shaPattern);
    assert.equal(git('cat-file', '-t', commit), 'commit');
    assert.equal(git('rev-parse', '--is-shallow-repository'), 'false', 'Release verification requires complete Git history');
    const row = git('ls-tree', commit, '--', RELEASE_POLICY_PATH);
    assert(!git('log', '--full-history', '--no-renames', '-m', '--diff-filter=DMT', '-1', '--format=%H', commit, '--', RELEASE_POLICY_PATH),
        'Release CI policy activation was removed or changed');
    if (!row) return false;
    assert.match(row, /^100644 blob [a-f0-9]{40}\t/u);
    assert.equal(git('show', commit + ':' + RELEASE_POLICY_PATH), activation);
    return true;
}

export function requireReleasePolicyInArchive(entries: ReadonlyMap<string, Buffer>, commit: string): void {
    assert(releasePolicyAt(commit), 'The release CI policy is required for this delivery');
    assert.equal(entries.get(RELEASE_POLICY_PATH)?.toString(), activation + '\n');
}

export function releaseFilenames(version: string) {
    assert.match(version, versionPattern);
    return {
        package: `fbincon-claude-code-statusline-${version}.tgz`,
        source: `claude-code-statusline-${version}-source.tar.gz`,
        manifest: 'build-manifest.json',
        checksums: 'SHA256SUMS',
    };
}

export function validateDeliveryHashes(hashes: Record<string, string>, version: string): void {
    assert.deepEqual(Object.keys(hashes).sort(), Object.values(releaseFilenames(version)).sort());
    for (const hash of Object.values(hashes)) assert.match(hash, digestPattern);
}

export const recordDigest = (record: unknown) => digest(JSON.stringify(record));
