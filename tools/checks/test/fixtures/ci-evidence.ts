import { artifactIdentity, type CompleteEvidence } from '../../ci-evidence.js';
import { TARGETS, HOSTS, runtimeInputs } from '../../runtime-inputs.js';
import { CI_REPOSITORY } from '../../ci-watch.js';
export const commit = 'a'.repeat(40), hash = 'b'.repeat(64), now = Date.now();
export const run = { id: 12, run_attempt: 2, head_sha: commit, head_branch: 'main', event: 'push', repository: { full_name: CI_REPOSITORY }, head_repository: { full_name: CI_REPOSITORY }, path: '.github/workflows/ci.yml', status: 'completed', conclusion: 'success' };
export function fixture() {
    const inputs = runtimeInputs([{ version: 'v22.23.4' }, { version: 'v24.21.0' }], '24.21.0');
    const names = ['ts06-candidate', 'ci-compiled-tests', ...TARGETS.map(target => `ts06-installed-${target.os}-${target.arch}`),
        ...HOSTS.map(host => `ts06-mods-${host.os}-${host.claude}`), ...inputs.matrix.include.map(row => `ts06-runtime-${row.target.os}-${row.target.arch}-${row.node}`)];
    const artifacts = names.map((name, index) => ({ id: 100 + index, name, digest: 'sha256:' + hash, expired: false, expires_at: new Date(now + 86400000).toISOString() }));
    const record: CompleteEvidence = { schema_version: 1, kind: 'complete', repository: CI_REPOSITORY, source_commit: commit, tree: commit, workflow_sha: commit,
        run_id: 12, attempt: 2, event: 'push', branch: 'main', workflow: '.github/workflows/ci.yml', pr: null, created_at: new Date(now).toISOString(), expires_at: new Date(now + 86400000).toISOString(),
        policy_sha256: hash, version: '3.9.1', toolchain: { node: 'v24.21.0', npm: '11.19.0', typescript: '5.9.3', lock_sha256: hash }, coverage: { installations: 8, runtime_installations: 32, hosts: 16, native_capacity_cases: 197 }, inputs,
        acceptance_sha256: hash, input_file_sha256: hash, compiled: { 'compiled-tests.json': hash, 'compiled-tests.tar': hash },
        delivery: Object.fromEntries(['SHA256SUMS', 'build-manifest.json', 'fbincon-claude-code-statusline-3.9.1.tgz', 'claude-code-statusline-3.9.1-source.tar.gz'].map(name => [name, hash])),
        receipts: Object.fromEntries(Array.from({ length: 56 }, (_, index) => ['ts06-case-' + index + '/installed.json', hash])), artifacts: artifacts.map(value => artifactIdentity(value)), executions: [
            ...TARGETS.map(target => ({target:target.os+'-'+target.arch,node:'v24.21.0'})),
            ...TARGETS.flatMap(target => Object.entries(inputs.versions).map(([runtime_case,node])=>({target:target.os+'-'+target.arch,runtime_case,node:'v'+node}))),
            ...HOSTS.map(host=>({target:({'ubuntu-24.04':'linux','windows-2025':'win32','macos-15':'darwin'} as Record<string,string>)[host.os]+'-'+host.claude,host:host.claude,host_sha256:hash,node:'v24.21.0'}))
        ].map((value,index)=>({...value,job_id:index+1,node_sha256:hash,execution:{run_id:12,attempt:1,job:'fixture'}})) };
    for (const row of record.executions.filter(value => inputs.shared.includes(value.runtime_case))) {
        const installed = record.executions.find(value => value.target === row.target && !value.runtime_case && !value.host)!;
        row.job_id = installed.job_id; row.execution = { ...installed.execution, reused_installed: true, source_suite: 'complete-platform-suite' };
    }
    return { record, artifacts };
}
