/** Documentation-only samples of a fixed public package, with independent collector identity. */
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { release } from 'node:os';
import { installCandidate } from './install.js';
import { verifyDelivery } from '../build/verify.js';
import { sha256 } from '../build/files.js';
import { Capture } from '../migration/ts-04/capture.js';
import { renderCapture } from './render-capture.js';
import { SCENES, SAMPLE_SCENARIOS, requireCompact, requireSampleMetadata } from './showcase-driver.js';
import { repoRoot } from '../migration/ts-03/common.js';

export const SHOWCASE_BASELINE = { version: '3.16.0', commit: 'c89a2ca088099ccd3ceb76baf59ecf11d84b08f0',
    tarball_sha256: '2030ef2f8d386b2fcb1f616fb49ce6f16eed92ec21ea22486799da68151b8c8a' } as const;
export function assertBaseline(identity: { version: string; commit: string; tarball_sha256: string }): void {
    assert.deepEqual(identity, SHOWCASE_BASELINE, 'Showcase requires the exact accepted v3.16.0 public package');
}

export function snapshotDirectory(directory: string): Record<string, { sha256: string; mode: number }> {
    if (!fs.existsSync(directory)) return {};
    const snapshot: Record<string, { sha256: string; mode: number }> = {};
    const visit = (path: string) => {
        for (const name of fs.readdirSync(path).sort()) {
            const child = join(path, name), stat = fs.lstatSync(child);
            if (stat.isDirectory()) visit(child);
            else { assert(stat.isFile(), 'Unexpected link or special file in isolated configuration');
                snapshot[relative(directory, child).replaceAll('\\', '/')] = { sha256: sha256(fs.readFileSync(child)), mode: stat.mode & 0o777 }; }
        }
    };
    visit(directory); return snapshot;
}
export function requireUnchanged(before: ReturnType<typeof snapshotDirectory>, after: ReturnType<typeof snapshotDirectory>, label: string): void {
    assert.deepEqual(after, before, label + ' changed configuration bytes, modes or file presence');
}
export function requireRemoved(path: string): void { assert(!fs.existsSync(path), 'Isolated installation cleanup did not remove its owned directory'); }

export interface ShowcaseOptions { artifact: string; commit: string; output: string; fonts: string[] }
export function collectShowcase(options: ShowcaseOptions) {
    assert.match(options.commit, /^[a-f0-9]{40}$/u, 'Require an exact product commit');
    assert(options.fonts.length > 0, 'Require explicit fonts');
    const artifactPath = resolve(options.artifact), output = resolve(options.output), fonts = options.fonts.map(path => resolve(path));
    assert.equal(options.commit, SHOWCASE_BASELINE.commit, 'Wrong showcase product commit');
    assert.equal(sha256(fs.readFileSync(artifactPath)), SHOWCASE_BASELINE.tarball_sha256, 'Wrong showcase package bytes');
    const artifact = verifyDelivery(artifactPath, options.commit);
    assertBaseline({ version: artifact.source.application_version, commit: artifact.source.commit, tarball_sha256: artifact.sha256 });
    for (const path of fonts) assert(fs.statSync(path).isFile(), 'A font must be a regular file');
    fs.mkdirSync(output);
    const installed = installCandidate(artifactPath, options.commit), captures: Record<string, unknown>[] = [], journeys: Record<string, unknown>[] = [];
    let success = false;
    try {
        const driverSource = fileURLToPath(new URL('./showcase-driver.js', import.meta.url)), driver = join(installed.temporary, 'showcase-driver.mjs');
        fs.copyFileSync(driverSource, driver);
        execFileSync(installed.node, [driver, installed.modules, output], { cwd: installed.temporary, env: installed.env, timeout: 120000 });
        const samples = JSON.parse(fs.readFileSync(join(output, 'samples.json'), 'utf8'));
        assert.equal(samples.records.length, SCENES.length * 2 * 3 * 3 * SAMPLE_SCENARIOS.length);
        assert.equal(samples.gallery.length, SCENES.length * 2);
        for (const record of [...samples.records, ...samples.gallery]) requireSampleMetadata(record);
        const run = (args: string[]) => execFileSync(installed.node, [installed.entry, ...args], {
            cwd: installed.temporary, env: installed.env, encoding: 'utf8', timeout: 30000,
        });
        run(['install', '--no-native-editor', '--no-experimental-slash-tui', '--no-live-metrics']);
        for (const scene of SCENES) {
            const file = join(output, 'examples', scene.id + '.json'), profile = JSON.parse(fs.readFileSync(file, 'utf8'));
            requireCompact(profile.display);
            let before = snapshotDirectory(installed.env.CLAUDE_CONFIG_DIR);
            const candidate = JSON.parse(run(['config', 'profile', 'import', file, '--dry-run', '--json']));
            assert.equal(candidate.name, scene.name); assert.deepEqual(candidate.display, profile.display);
            requireUnchanged(before, snapshotDirectory(installed.env.CLAUDE_CONFIG_DIR), 'Profile import dry run');
            run(['config', 'profile', 'import', file, '--json']);
            before = snapshotDirectory(installed.env.CLAUDE_CONFIG_DIR);
            const sample = JSON.parse(run(['config', 'profile', 'preview', scene.name, '--scenario', 'normal', '--width', String(scene.columns), '--json']));
            assert.equal(sample.sample, true); assert.equal(sample.scenario, 'normal');
            assert(sample.main.length > 0, 'Imported profile preview must contain main rows');
            requireUnchanged(before, snapshotDirectory(installed.env.CLAUDE_CONFIG_DIR), 'Saved-profile preview');
            const exported = join(installed.temporary, scene.id + '-exported.json');
            run(['config', 'profile', 'export', scene.name, exported, '--json']);
            assert.deepEqual(JSON.parse(fs.readFileSync(exported, 'utf8')), profile, 'Profile export/reopen differs');
            requireUnchanged(before, snapshotDirectory(installed.env.CLAUDE_CONFIG_DIR), 'Profile export');
            run(['config', 'profile', 'activate', scene.name, '--json']);
            assert.deepEqual(JSON.parse(fs.readFileSync(join(installed.env.CLAUDE_CONFIG_DIR, 'claude-statusline.json'), 'utf8')), profile.display, 'Explicit profile activation differs');
            journeys.push({ scene: scene.id, profile: scene.name, import_dry_run_readonly: true, import_export_equal: true,
                saved_preview_readonly: true, activation_readback_equal: true, config_sha256: sha256(fs.readFileSync(file)) });
        }
        for (const record of samples.gallery) {
            const lines = [...record.main, ...record.subagents], raw = Buffer.from(lines.join('\r\n'));
            const terminal = new Capture(record.columns, Math.max(1, lines.length)); terminal.feed(raw);
            const light = record.scene === 'light', cells = { columns: terminal.columns, rows: terminal.rows, cells: terminal.buffer,
                terminal_foreground: light ? '#17191e' : '#dedee7', terminal_background: light ? '#ffffff' : '#17191e' };
            const image = renderCapture(cells, [0, 0, cells.columns, cells.rows], fonts), directory = join(output, record.language);
            fs.mkdirSync(directory, { recursive: true });
            const file = record.scene + '.png', json = JSON.stringify(cells, null, 2) + '\n';
            fs.writeFileSync(join(directory, file), image.png, { flag: 'wx' });
            fs.writeFileSync(join(directory, record.scene + '.cells.json'), json, { flag: 'wx' });
            fs.writeFileSync(join(directory, record.scene + '.ansi'), raw, { flag: 'wx' });
            const { main: _main, subagents: _subagents, ...metadata } = record;
            captures.push({ file: record.language + '/' + file, ...metadata, rows: cells.rows,
                width: image.width, height: image.height, png_sha256: sha256(image.png), cells_sha256: sha256(json), ansi_sha256: sha256(raw) });
        }
        const collectorFiles = ['showcase.ts', 'showcase-driver.ts', 'render-capture.ts', 'install.ts'].map(name => 'tools/acceptance/' + name);
        const collector = { commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim(),
            working_tree_changes: Boolean(execFileSync('git', ['status', '--porcelain=v1', '--', ...collectorFiles], { cwd: repoRoot, encoding: 'utf8' }).trim()),
            files: Object.fromEntries(collectorFiles.map(path => [path, sha256(fs.readFileSync(join(repoRoot, path)))])),
            compiled_files: Object.fromEntries(['showcase.js', 'showcase-driver.js', 'render-capture.js'].map(name => [name, sha256(fs.readFileSync(fileURLToPath(new URL('./' + name, import.meta.url))))])),
            note: 'Collector identity is independent of the unchanged public product. This is demonstration evidence, not a complete product acceptance receipt.' };
        const provenance = { product: SHOWCASE_BASELINE, collector, kind: 'installed fixed-sample terminal-cell reconstruction; not an OS screenshot',
            platform: process.platform, architecture: process.arch, kernel: release(), node: process.version,
            node_sha256: sha256(fs.readFileSync(process.execPath)), resvg: '2.6.2',
            terminal: 'xterm-256color cell reconstruction', host: null, model_calls: 0,
            physical_visual_acceptance: false, human_acceptance: false,
            fonts: Object.fromEntries(fonts.map(path => [basename(path), sha256(fs.readFileSync(path))])), captures };
        fs.writeFileSync(join(output, 'provenance.json'), JSON.stringify(provenance, null, 2) + '\n', { flag: 'wx' });
        fs.writeFileSync(join(output, 'sample-validation.json'), JSON.stringify({ status: 'pass', product: SHOWCASE_BASELINE,
            matrix_cases: samples.records.length, languages: ['en', 'zh-CN'], widths: [40, 80, 120],
            appearances: ['dark', 'light', 'no-color'], scenarios: SAMPLE_SCENARIOS,
            checks: ['compact separators', 'whole-row width bounds', 'valid Unicode output', 'no SGR with colors off', 'truthful synthetic provenance'], journeys }, null, 2) + '\n', { flag: 'wx' });
        success = true;
    } finally {
        installed.cleanup(); requireRemoved(installed.temporary);
    }
    assert(success);
    const receipt = { status: 'pass', kind: 'showcase fixed samples', product: SHOWCASE_BASELINE, captures: captures.length,
        matrix_cases: SCENES.length * 2 * 3 * 3 * SAMPLE_SCENARIOS.length, profiles: journeys.length,
        isolated_installation_removed: true, model_calls: 0 };
    fs.writeFileSync(join(output, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
    return { ...receipt, output };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const { values } = parseArgs({ options: { artifact: { type: 'string' }, commit: { type: 'string' }, output: { type: 'string' }, font: { type: 'string', multiple: true } } });
    if (!values.artifact || !values.commit || !values.output || !values.font?.length)
        throw new Error('Require --artifact PUBLIC_TGZ --commit PRODUCT_SHA --output NEW_DIRECTORY --font FILE [--font FILE]');
    console.log(JSON.stringify(collectShowcase({ artifact: values.artifact, commit: values.commit, output: values.output, fonts: values.font })));
}
