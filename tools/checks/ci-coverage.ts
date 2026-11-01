/** Frozen verifier code can run this planner using Node built-ins and immutable Git objects. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { canonical, runtimeLock, runtimeManifest, withoutCiScripts } from './impact-lock.ts';
import { runtimeInputs, TARGETS } from './runtime-inputs.ts';

export const COVERAGE_ACTIVATION_PATH = 'tools/checks/coverage-v2.json';
export const COVERAGE_ACTIVATION = '{"schema_version":2,"policy":"history-profiles-v2"}\n';
const policyFiles = ['tools/checks/ci-coverage.ts', 'tools/checks/impact-lock.ts', 'tools/checks/runtime-inputs.ts', COVERAGE_ACTIVATION_PATH];
const selectors = ['22.0.0', '22.x', '24.0.0', '24.x'];
const versionPattern = /^(?:22|24)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u;
type Depth = 'full' | 'short';
export interface CoverageObligation {
    id: string; kind: 'installed' | 'runtime' | 'host'; target: string; selector: string | null;
    os: string; arch: string; host_arch: string; node: string; host: string | null; depth: Depth;
}
export interface CoverageProducer {
    id: string; job: string; job_key: 'installed' | 'runtime' | 'mods'; artifact: string; receipt: string;
    stage: 'complete' | 'installed' | 'language' | 'history'; obligations: string[];
    os: string; arch: string; host_arch: string; node: string; host: string | null; depth: Depth;
}
type Basis = 'pull_request' | 'accepted-main' | 'conservative';
type Lane = 'none' | 'all' | 'windows' | 'macos' | 'posix' | 'runtime-hosts';
interface Escalation { path: string; installed: Lane; hosts: Lane; reason: string }
export interface CoveragePlan {
    schema_version: 2; kind: 'coverage-plan'; basis: Basis; base: string | null; comparison_base: string | null;
    head: string; tree: string; policy_sha256: string; runtime_inputs_sha256: string; changed_paths: string[]; escalations: Escalation[];
    obligations: CoverageObligation[]; producers: CoverageProducer[];
}
const fullNodes: Record<string, readonly string[]> = {
    'ubuntu-24.04': ['development', ...selectors],
    'windows-2025': ['22.x', '24.0.0'],
    'windows-11-arm': ['22.0.0', '24.x'],
    'macos-14': ['22.0.0'], 'macos-15': ['24.0.0'], 'macos-26': ['24.x'],
    'macos-15-intel': ['22.x'], 'macos-26-intel': ['24.x'],
};
const linux = 'ubuntu-24.04', windows = 'windows-2025', macos = 'macos-15';
const officialOS = [linux, windows, macos];
/** This inventory belongs to v2. A new upstream release does not add a permanent obligation. */
export const FIXED_HOST_POLICY = [
    { version: '2.1.287', os: [linux], full: [linux], reason: 'First Native-capable host', exit: 'Reviewed change to the supported Native floor' },
    { version: '2.1.288', os: officialOS, full: [windows], reason: 'Native-only boundary on all OSes and the historical Windows npm upgrade regression', exit: 'Replacement for both the below-Runtime boundary and the Windows upgrade regression' },
    { version: '2.1.289', os: officialOS, full: officialOS, reason: 'First Runtime-capable host and Windows long-scenario regression', exit: 'Reviewed Runtime floor change with retained Windows stability coverage' },
    { version: '2.1.294', os: officialOS, full: [], reason: 'Exact declaration and Windows repeated native-scenario reference', exit: 'Accepted replacement for both exact-host and unchanged repeated-scenario evidence' },
    { version: '2.1.296', os: officialOS, full: [], reason: 'Known exact-host declaration gap', exit: 'Explicit reviewed change to the gap, retaining its historical unavailable status' },
    { version: '2.1.310', os: officialOS, full: officialOS, reason: 'First interactive declaration path and three-platform native-capacity baseline', exit: 'Reviewed preservation of the declaration boundary and capacity; a newer version alone is insufficient' },
] as const;
function gitBytes(...args: string[]): Buffer {
    return execFileSync('git', ['--no-replace-objects', ...args], { maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
}
const git = (...args: string[]) => gitBytes(...args).toString('utf8').trim();
function checkCommit(commit: string): void {
    assert.match(commit, /^[a-f0-9]{40}$/u, 'Coverage requires an immutable, full commit SHA');
    assert.equal(git('cat-file', '-t', commit), 'commit');
}
function blob(commit: string, path: string): Buffer | undefined {
    const entry = git('ls-tree', commit, '--', path);
    if (!entry) return undefined;
    const fields = /^(100644|100755) blob ([a-f0-9]{40})\t([^\t\n]+)$/u.exec(entry);
    assert(fields && fields[3] === path, 'Coverage policy input must be a regular Git blob: ' + path);
    return gitBytes('cat-file', 'blob', fields[2]!);
}
export function coverageVersionInArchive(entries: ReadonlyMap<string, Uint8Array>): 1 | 2 {
    const marker = entries.get(COVERAGE_ACTIVATION_PATH);
    if (marker === undefined) return 1;
    assert(Buffer.from(marker).equals(Buffer.from(COVERAGE_ACTIVATION)), 'Invalid coverage activation marker');
    return 2;
}
export function coverageVersionAt(commit: string): 1 | 2 {
    checkCommit(commit);
    const marker = blob(commit, COVERAGE_ACTIVATION_PATH);
    assert(!git('log', '--full-history', '--no-renames', '-m', '--diff-filter=DMT', '-1', '--format=%H', commit, '--', COVERAGE_ACTIVATION_PATH),
        'Coverage activation was removed or altered in this history');
    if (marker) return coverageVersionInArchive(new Map([[COVERAGE_ACTIVATION_PATH, marker]]));
    assert.equal(git('rev-parse', '--is-shallow-repository'), 'false', 'Cannot establish absence of coverage activation from shallow history');
    return 1;
}
/** Reconstruct the scheduler's derived matrix from its four frozen exact versions. */
function frozenInputs(value: unknown): ReturnType<typeof runtimeInputs> {
    assert(value && typeof value === 'object'); const inputs = value as ReturnType<typeof runtimeInputs>;
    assert.equal(inputs.schema_version, 1); assert.match(inputs.development, versionPattern);
    assert.deepEqual(Object.keys(inputs.versions).sort(), [...selectors].sort());
    for (const selector of selectors) {
        const node = inputs.versions[selector];
        assert(typeof node === 'string' && versionPattern.test(node) && node.split('.')[0] === selector.split('.')[0], 'Invalid resolved Node');
        if (!selector.endsWith('.x')) assert.equal(node, selector);
    }
    const expected = runtimeInputs(Object.values(inputs.versions).map(version => ({ version })), inputs.development);
    assert.deepEqual(inputs.versions, expected.versions); assert.deepEqual(inputs.shared, expected.shared);
    assert.deepEqual(inputs.matrix, expected.matrix, 'Frozen runtime matrix omitted or changed an execution');
    return expected;
}
export function baselineObligations(value: unknown): CoverageObligation[] {
    const inputs = frozenInputs(value), rows: CoverageObligation[] = [];
    for (const target of TARGETS) {
        const id = target.os + '-' + target.arch, common = { ...target, host_arch: target.host_arch ?? target.arch, target: id, host: null };
        const full = fullNodes[target.os]; assert(full, 'Unregistered installed history target: ' + target.os);
        rows.push({ ...common, id, kind: 'installed', selector: null, node: inputs.development, depth: full.includes('development') ? 'full' : 'short' });
        for (const selector of selectors) rows.push({ ...common, id: id + '@' + selector, kind: 'runtime', selector, node: inputs.versions[selector]!,
            depth: full.includes(selector) ? 'full' : 'short' });
    }
    for (const host of FIXED_HOST_POLICY) for (const os of host.os) {
        const runner = TARGETS.find(target => target.os === os); assert(runner);
        const platform = os === linux ? 'linux' : os === windows ? 'win32' : 'darwin', id = platform + '-' + host.version;
        rows.push({ id, target: id, kind: 'host', selector: null, os, arch: runner.arch, host_arch: runner.host_arch ?? runner.arch,
            node: inputs.development, host: host.version, depth: (host.full as readonly string[]).includes(os) ? 'full' : 'short' });
    }
    return rows;
}
export function historyCounts(obligations: readonly CoverageObligation[]) {
    const result = { installed: { full: 0, short: 0 }, runtime: { full: 0, short: 0 }, host: { full: 0, short: 0 } };
    for (const row of obligations) result[row.kind][row.depth]++;
    return result;
}
function escalation(path: string, base: string, head: string): Escalation | undefined {
    const risk = (installed: Lane, hosts: Lane, reason: string) => ({ path, installed, hosts, reason });
    if (path === 'package-lock.json' || /^(?:packages\/(?:core|platform|cli|tui)\/)?package\.json$/u.test(path)) {
        const before = blob(base, path), after = blob(head, path);
        const identity = path === 'package-lock.json' ? runtimeLock : path === 'package.json' ? withoutCiScripts : runtimeManifest;
        if (!before || !after || canonical(identity(before)) !== canonical(identity(after))) return risk('all', 'all', 'Runtime dependency or package manifest');
        return;
    }
    if (/^(?:\.node-version$|packages\/(?:cli\/src\/(?:management|recovery)\/|core\/src\/(?:management\/|node-runtime\.ts$)|platform\/src\/(?:npm|package-copy|native|files|private-state|processes|source-process|remove-tree)\.ts$)|tools\/(?:build\/(?:pack|candidate|model|files)\.ts$|acceptance\/(?:historical-(?:inputs|releases)|version-management(?:-official)?)\.ts$))/u.test(path) ||
        /^packages\/(?:core|cli)\/src\/(?:[^/]+\/)*(?:[^/]*(?:schema|migration|compatibility|rollback|upgrade)[^/]*|validation|display)\.ts$/u.test(path))
        return risk('all', 'all', 'Shared package execution, recovery, schema, runtime or historical inputs');
    if (/^packages\/platform\/src\/(?:.*\/)?windows[-/]/u.test(path)) return risk('windows', 'windows', 'Windows implementation');
    if (/^packages\/platform\/src\/(?:.*\/)?(?:darwin|macos)[-/]/u.test(path)) return risk('macos', 'macos', 'macOS implementation');
    if (/^packages\/platform\/src\/(?:.*\/)?posix[-/]/u.test(path)) return risk('posix', 'posix', 'POSIX implementation');
    if (/^packages\/platform\/src\/(?:architecture|command|commands|launch|review-worker)\.ts$|^packages\/platform\/src\/terminal\/(?:launchers|pty|bridge)\.ts$/u.test(path) ||
        /^packages\/platform\/src\/(?:[^/]+\/)*(?:[^/]+-)?(?:atomic|lock|locks|locking|filesystem|pty|process)(?:[-.][^/]*)$/u.test(path))
        return risk('all', 'all', 'Cross-platform process or terminal execution');
    if (/^packages\/(?:cli\/src\/integration\/|platform\/src\/plugin-host\.ts$|core\/src\/(?:integration|contracts)\/)/u.test(path))
        return risk('all', 'all', 'Installation, binding or protocol shared across official hosts');
    if (/^mods\/statusline-(?:native|runtime)\/(?:\.claude-plugin\/|hooks\/|.*(?:protocol|binding|marketplace|install|host)\.[jt]s$)/u.test(path))
        return risk('none', path.startsWith('mods/statusline-runtime/') ? 'runtime-hosts' : 'all', 'Official Mod integration');
    // ci:plan owns the ordinary route. A full-route verifier still cannot
    // assign short history to a new source family whose responsibility it does not know.
    assert(/^(?:\.github\/|archive\/|tests\/|examples\/|tools\/(?:checks|release|build|generation|acceptance|benchmarks|migration|typescript|testing|unicode)\/)/u.test(path) ||
        /^packages\/(?:core|platform|cli|tui)\/(?:src\/|resources\/|test\/|README[^/]*\.md$|tsconfig[^/]*\.json$)/u.test(path) ||
        /^mods\/statusline-(?:native|runtime)\/(?:hooks\/|lib\/|ui\/|tests\/|\.claude-plugin\/plugin\.json$|README[^/]*\.md$|package(?:-lock)?\.json$|tsconfig\.json$)/u.test(path) ||
        /^docs\/.*\.(?:md|png|jpe?g|gif|webp|svg|mp4|webm|pdf|json)$/u.test(path) ||
        /^(?:[^/]+\.md|tsconfig[^/]*\.json|\.node-version|\.gitattributes|\.gitignore|LICENSE)$/u.test(path), 'Unclassified history coverage path: ' + path);
    return undefined;
}
function includesLane(lane: Lane, row: CoverageObligation): boolean {
    return lane === 'all' || lane === 'windows' && row.os.startsWith('windows-') || lane === 'macos' && row.os.startsWith('macos-') ||
        lane === 'posix' && !row.os.startsWith('windows-') || lane === 'runtime-hosts' && !!row.host && Number(row.host.split('.')[2]) >= 289;
}
function producers(rows: CoverageObligation[]): CoverageProducer[] {
    const result: CoverageProducer[] = [];
    for (const row of rows) {
        if (row.kind === 'runtime' && rows.some(r => r.kind === 'installed' && r.target === row.target && r.node === row.node)) continue;
        const group = row.kind === 'installed' ? [row, ...rows.filter(r => r.kind === 'runtime' && r.target === row.target && r.node === row.node)] : [row];
        const depth = group.some(r => r.depth === 'full') ? 'full' : 'short';
        const job_key = row.kind === 'host' ? 'mods' : row.kind;
        const display = row.kind === 'host' ? `Mods / ${row.os} / Claude ${row.host}` :
            `${row.kind === 'installed' ? 'Installed' : 'Node ' + row.selector} / ${row.os} / ${row.arch}`;
        const suffix = row.kind === 'host' ? row.os + '-' + row.host : row.target + (row.selector ? '-' + row.selector : '');
        const stages: CoverageProducer['stage'][] = row.os === 'windows-11-arm' ? ['installed', 'language', 'history'] : ['complete'];
        for (const stage of stages) {
            const split = stage !== 'complete', artifact = `ts06-${job_key}-${suffix}${split ? '-' + stage : ''}`;
            result.push({ id: artifact, job_key, job: display + (split ? ' / ' + stage : ''), artifact, receipt: artifact + '/fragment.json', stage,
                obligations: group.map(r => r.id), depth, os: row.os, arch: row.arch, host_arch: row.host_arch, node: row.node, host: row.host });
        }
    }
    return result;
}
/** The caller obtains base and basis from verified PR/main provenance, never from the submitted plan. */
export function createCoveragePlan(base: string | null, head: string, inputs: unknown,
    basis: Basis = base === null ? 'conservative' : 'pull_request'): CoveragePlan {
    assert.equal(coverageVersionAt(head), 2, 'Source has not activated v2 coverage');
    assert(['conservative', 'pull_request', 'accepted-main'].includes(basis));
    assert.equal(base === null, basis === 'conservative');
    const rows = baselineObligations(inputs);
    assert.equal(blob(head, '.node-version')?.toString().trim(), rows.find(row => row.kind === 'installed')!.node, 'Development Node differs from source');
    let comparisonBase: string | null = null;
    if (base !== null) {
        checkCommit(base);
        comparisonBase = git('merge-base', '--all', base, head);
        assert.match(comparisonBase, /^[a-f0-9]{40}$/u, 'A unique actual merge base is required');
        if (basis === 'accepted-main') assert.equal(comparisonBase, base, 'Accepted main boundary is not an ancestor');
        assert.notEqual(comparisonBase, head, 'An empty or reversed change cannot shrink history coverage');
    }
    // --no-renames yields both endpoints. Raw NUL-separated entries also expose
    // links, submodules and type changes without trusting paths from the record.
    const changed: string[] = [];
    if (comparisonBase !== null) {
        const diff = new TextDecoder('utf-8', { fatal: true }).decode(gitBytes('diff', '--no-ext-diff', '--no-textconv', '--no-renames', '--raw', '-z', comparisonBase, head, '--'));
        const fields = diff.split('\0'); assert.equal(fields.pop(), '');
        assert(fields.length > 0 && fields.length % 2 === 0, 'Empty or invalid history comparison');
        for (let i = 0; i < fields.length; i += 2) {
            assert(/^:(?:000000|100644|100755) (?:000000|100644|100755) [a-f0-9]+ [a-f0-9]+ [AMD]$/u.test(fields[i]!), 'Non-regular or unclassified history input: ' + fields[i + 1]);
            changed.push(fields[i + 1]!);
        }
        changed.sort();
    }
    const risks = comparisonBase === null ? [] : changed.flatMap(path => escalation(path, comparisonBase!, head) ?? []);
    for (const row of rows) if (basis === 'conservative' || risks.some(risk => includesLane(row.kind === 'host' ? risk.hosts : risk.installed, row))) row.depth = 'full';
    const policy = policyFiles.map(path => { const bytes = blob(head, path); assert(bytes, 'Missing coverage policy input: ' + path);
        return [path, createHash('sha256').update(bytes).digest('hex')]; });
    return { schema_version: 2, kind: 'coverage-plan', basis, base, comparison_base: comparisonBase, head, tree: git('rev-parse', head + '^{tree}'),
        policy_sha256: createHash('sha256').update(canonical(policy)).digest('hex'), runtime_inputs_sha256: createHash('sha256').update(canonical(inputs)).digest('hex'),
        changed_paths: changed, escalations: risks, obligations: rows, producers: producers(rows) };
}
export function verifyCoveragePlan(value: unknown, base: string | null, head: string, inputs: unknown,
    basis: Basis = base === null ? 'conservative' : 'pull_request'): CoveragePlan {
    const expected = createCoveragePlan(base, head, inputs, basis);
    assert.deepEqual(value, expected, 'Coverage plan differs from immutable source, frozen inputs or trusted comparison');
    return expected;
}
