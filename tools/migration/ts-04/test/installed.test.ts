import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync, execFileSync } from 'node:child_process';
import { installCandidate, PACKAGE } from '../package.js';
import { repoRoot, sourceHashes } from '../../ts-03/common.js';
import { openPty } from './pty.js';
import { startWindows } from '@fbincon/statusline-platform/terminal/launchers';
import { Capture } from '../capture.js';
import { POWERSHELL_FLAGS, powershellEnvironment, powershellIsolation, runShell, type ShellReceipt } from '../shell.js';
import { sha256 } from '../../../build/files.js';
let installed: ReturnType<typeof installCandidate>;
const checks = { package: false, modules: false, rendering: false, entry: false, relocation: false, shell: false, native_protocol: false, external_editor: false, recovery: false, python_upgrade: false };
let driver: string, report: Record<string, unknown> = {};
const shellReceipts: ShellReceipt[] = [];
before(() => {
    installed = installCandidate();
    driver = join(installed.temporary, 'acceptance-driver.mjs');
    fs.copyFileSync(fileURLToPath(new URL('./installed-driver.js', import.meta.url)), driver);
    report = { schema_version: 1, stage: 'TS-05', target: process.env.TS05_TARGET ?? 'local', node: process.version, node_sha256: sha256(fs.readFileSync(process.execPath)), platform: process.platform, process_arch: process.arch, commit: installed.packed.source.commit, source_hashes: installed.packed.source.source_hashes, harness_hashes: sourceHashes(), tarball_sha256: installed.packed.sha256, lifecycle_scripts: false, offline_install: true, initially_empty_npm_cache: true, path_excludes_python_and_compilers: true, outside_checkout: true, checks };
});
after(() => {
    const path = process.env.TS04_INSTALLED_REPORT;
    if (path) {
        fs.mkdirSync(dirname(path), { recursive: true });
        fs.writeFileSync(path, JSON.stringify({ ...report, status: Object.values(checks).every(Boolean) ? 'pass' : 'fail', checks, shell_receipts: shellReceipts }, null, 2) + '\n');
    }
    installed?.cleanup();
});
function invoke(args: string[], config: string, input = '', environment: NodeJS.ProcessEnv = {}) {
    return spawnSync(installed.node, [installed.entry, ...args], { cwd: installed.directory, env: { ...installed.env, CLAUDE_CONFIG_DIR: config, ...environment }, input, encoding: 'utf8', timeout: 30000 });
}
function run(args: string[], config: string, input = '', environment: NodeJS.ProcessEnv = {}): string {
    const result = invoke(args, config, input, environment);
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr + result.stdout);
    return result.stdout;
}
function setup(name: string): string {
    const config = join(installed.temporary, name);
    fs.mkdirSync(config, { mode: 0o700 });
    fs.writeFileSync(join(config, 'settings.json'), '{"env":{"KEEP":"unchanged"}}\n', { mode: 0o600 });
    run(['install', '--config-dir', config, '--no-native-editor', '--no-native-timing', '--no-live-metrics'], config);
    return config;
}
function ui(config: string, operation: string, payload: unknown = {}) {
    const result = JSON.parse(run(['ui', '--config-dir', config], config, JSON.stringify({ protocol_version: 11, operation, payload })));
    assert.equal(result.protocol_version, 11);
    assert.ok(result.result);
    return result.result;
}
test('private packed candidate contains only compiled business entry points and complete owned resources', () => {
    const manifest = JSON.parse(fs.readFileSync(join(installed.root, 'package.json'), 'utf8'));
    assert.equal(manifest.name, PACKAGE);
    assert.equal(manifest.private, true);
    assert.equal(manifest.scripts, undefined);
    assert.deepEqual(Object.keys(manifest.bin), ['claude-statusline']);
    for (const name of ['LICENSE', 'LICENSE-Unicode.txt', 'LICENSE-Wcwidth.txt'])
        assert.ok(fs.statSync(join(installed.root, name)).size > 0);
    assert.ok(installed.packed.entries.some((name: string) => name.endsWith('statusline-cli/dist/src/entry.js')));
    assert.equal(installed.packed.entries.some((name: string) => name.includes('src/claude_statusline') || name.includes('/test/')), false);
    for (const name of ['statusline-native', 'statusline-runtime']) {
        const resource = join(installed.modules, 'statusline-cli/resources', name);
        assert.ok(fs.existsSync(join(resource, 'resource-manifest.json')));
        assert.ok(fs.existsSync(join(resource, '.claude-plugin/plugin.json')));
    }
    checks.package = true;
});
test('tests.integration.test_compatibility.CompatibilityTests.test_forwarded_functions_and_types_share_identity', () => {
    const receipt = join(installed.temporary, 'modules.json');
    const result = spawnSync(installed.node, [driver, installed.modules, 'modules', '', receipt], { cwd: installed.directory, env: installed.env, encoding: 'utf8', timeout: 10000 });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(fs.readFileSync(receipt, 'utf8')), { same_binding: true, literal_argv: ['中文 & $`/entry.js'], clock_available: true, tui: true });
    checks.modules = true;
});
test('tests.integration.test_compatibility.CompatibilityTests.test_legacy_render_modules_match_cli_output', () => {
    const config = join(installed.temporary, 'golden-render');
    fs.mkdirSync(config);
    const corpus = JSON.parse(fs.readFileSync(join(repoRoot, 'tests/fixtures/migration/ts-01/cases.json'), 'utf8')), expected = JSON.parse(fs.readFileSync(join(repoRoot, 'tests/fixtures/migration/ts-01/expected.json'), 'utf8'));
    const cases = corpus.cases.filter((row: any) => row.kind === 'render');
    for (const row of cases) {
        fs.writeFileSync(join(config, 'claude-statusline.json'), JSON.stringify(corpus.configs[row.config_id]));
        const actual = run(['render'], config, JSON.stringify(row.input.payload), { COLUMNS: String(row.input.width + 2) });
        assert.equal(actual, expected[row.id].value.join('\n') + (expected[row.id].value.length ? '\n' : ''), row.id);
    }
    assert.ok(cases.length >= 10);
    report.render_cases = cases.length;
    checks.rendering = true;
});
test('tests.integration.test_compatibility.CompatibilityTests.test_legacy_terminal_entry_point_preserves_error_exit_code', () => {
    const result = invoke(['configure', '--config-dir', join(installed.temporary, 'non-tty')], join(installed.temporary, 'non-tty'));
    assert.equal(result.status, 2);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /terminals/u);
    assert.equal(fs.existsSync(join(installed.temporary, 'non-tty')), false);
    checks.entry = true;
});
test('tests.integration.test_compatibility.CompatibilityTests.test_terminal_script_uses_package_root_after_relocation', () => {
    const config = setup('relocation-config'), previous = JSON.parse(fs.readFileSync(join(config, 'settings.json'), 'utf8')).statusLine.command;
    const directory = join(installed.temporary, 'moved prefix 中文 &');
    fs.renameSync(installed.directory, directory);
    installed.directory = directory;
    installed.root = join(directory, 'node_modules', PACKAGE);
    installed.modules = join(installed.root, 'node_modules/@fbincon');
    installed.entry = join(installed.modules, 'statusline-cli/dist/src/entry.js');
    installed.bin = join(directory, 'node_modules/.bin/claude-statusline');
    assert.equal(run(['--version'], config).trim(), 'claude-statusline 2.0.0');
    run(['install', '--config-dir', config], config);
    const saved = JSON.parse(fs.readFileSync(join(config, 'settings.json'), 'utf8'));
    assert.notEqual(saved.statusLine.command, previous);
    assert.equal(saved.env.KEEP, 'unchanged');
    assert.ok(saved.statusLine.command.includes('moved prefix'));
    checks.relocation = true;
});
test('tests.integration.test_windows_shells.WindowsShellSmokeTests.test_installed_main_and_subagent_commands_match_in_both_shells', () => {
    const config = setup('shell-config'), payload = JSON.stringify({ model: { id: 'claude-installed' }, columns: 80, tasks: [{ id: 'child', name: '中文 child', status: 'completed', description: 'done' }] });
    for (const operation of ['render', 'render-subagents']) {
        const expected = run([operation], config, payload);
        assert.ok(expected.length > 0);
        if (operation === 'render-subagents')
            assert.equal(JSON.parse(expected.trim()).id, 'child');
        if (process.platform === 'win32') {
            const ps = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe'), quote = (value: string) => "'" + value.replaceAll("'", "''") + "'";
            const input = join(installed.temporary, 'shell-input.json');
            fs.writeFileSync(input, payload);
            const checkpoint = join(installed.temporary, `powershell-${operation}.phases`);
            const mark = (phase: string) => `[IO.File]::AppendAllText(${quote(checkpoint)}, ${quote(phase + '\n')}); `;
            const command = mark('started') + powershellIsolation(installed.env) + `[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false); $OutputEncoding = [Text.UTF8Encoding]::new($false); ` + mark('encoding') + `$source = Get-Content -Raw -Encoding UTF8 ${quote(input)}; ` + mark('read') + `$source | & ${quote(installed.bin + '.ps1')} ${operation}; $status = $LASTEXITCODE; ` + mark('completed') + `exit $status`;
            const executed = runShell(ps, [...POWERSHELL_FLAGS, command], operation, powershellEnvironment({ ...installed.env, CLAUDE_CONFIG_DIR: config }));
            report.powershell_profile = 'OS profile for shell initialization with -NoProfile; isolated product paths restored before Node';
            shellReceipts.push(executed.receipt);
            const result = executed.result;
            report.powershell_phases = { ...(report.powershell_phases as object ?? {}), [operation]: fs.existsSync(checkpoint) ? fs.readFileSync(checkpoint, 'utf8').trim().split('\n') : [] };
            if (result.status !== 0) {
                const commands = [
                    { name: 'isolated-startup', text: '[Console]::WriteLine("ready")', env: { ...installed.env } },
                    { name: 'original-startup', text: '[Console]::WriteLine("ready")', env: { ...process.env } },
                    { name: 'direct-node', text: `[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false); $OutputEncoding = [Text.UTF8Encoding]::new($false); Get-Content -Raw -Encoding UTF8 ${quote(input)} | & ${quote(installed.node)} ${quote(installed.entry)} ${operation}; exit $LASTEXITCODE`, env: { ...installed.env, CLAUDE_CONFIG_DIR: config } },
                ];
                report.shell_diagnostics = commands.map(probe => { const observed = runShell(ps, [...POWERSHELL_FLAGS, probe.text], probe.name, probe.env); return { ...observed.receipt, stdout: observed.result.stdout }; });
            }
            assert.equal(result.status, 0, JSON.stringify(executed.receipt));
            assert.equal(result.stdout.replaceAll('\r\n', '\n'), expected);
            const bash = process.env.TS04_GIT_BASH ?? join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Git/bin/bash.exe');
            const executedBash = runShell(bash, ['--noprofile', '--norc', '-c', 'export PATH="$(cygpath -u "$TS04_NODE_DIR"):/usr/bin"; "$(cygpath -u "$TS04_BIN")" "$TS04_OPERATION"'], operation, { ...installed.env, CLAUDE_CONFIG_DIR: config, TS04_NODE_DIR: installed.nodeDir, TS04_BIN: installed.bin, TS04_OPERATION: operation }, payload);
            shellReceipts.push(executedBash.receipt);
            const shell = executedBash.result;
            assert.equal(shell.status, 0, JSON.stringify(executedBash.receipt));
            assert.equal(shell.stdout, expected);
        }
        else {
            const result = spawnSync(installed.bin, [operation], { env: { ...installed.env, CLAUDE_CONFIG_DIR: config }, input: payload, encoding: 'utf8', timeout: 10000 });
            assert.equal(result.status, 0, result.stderr);
            assert.equal(result.stdout, expected);
        }
    }
    report.shells = process.platform === 'win32' ? ['PowerShell .ps1', 'Git Bash npm shim'] : ['POSIX npm bin'];
    checks.shell = true;
});
test('installed native-editor protocol supports describe, preview, revision-bound save and portable export', () => {
    const config = setup('native-protocol');
    const described = ui(config, 'describe');
    assert.equal(described.backend_version, '2.0.0');
    const current = ui(config, 'read');
    current.draft.display.use_colors = false;
    current.draft.host.padding = 4;
    const preview = ui(config, 'preview', { draft: current.draft, width: 80 });
    assert.ok(preview);
    ui(config, 'apply', { draft: current.draft, expected_revision: current.revision });
    assert.equal(ui(config, 'read').draft.host.padding, 4);
    assert.equal(JSON.parse(fs.readFileSync(join(config, 'settings.json'), 'utf8')).env.KEEP, 'unchanged');
    const stale = invoke(['ui', '--config-dir', config], config, JSON.stringify({ protocol_version: 11, operation: 'apply', payload: { draft: current.draft, expected_revision: current.revision } }));
    assert.equal(stale.status, 2);
    assert.equal(JSON.parse(stale.stdout).error.code, 'configuration_conflict');
    const exported = join(installed.temporary, 'portable.json');
    run(['config', '--config-dir', config, 'export', exported], config);
    assert.ok(fs.statSync(exported).size > 0);
    checks.native_protocol = true;
});
test('installed external editor saves and cancels in a real native terminal', { timeout: 45000 }, async () => {
    const config = setup('external-editor');
    for (const choice of ['save', 'cancel']) {
        const path = join(config, 'claude-statusline.json'), before = fs.existsSync(path) ? fs.readFileSync(path) : null;
        let output: string, columns = 100, rows = 30;
        if (process.platform === 'win32') {
            const receipt = join(installed.temporary, 'console-' + choice + '.json'), child = startWindows([installed.node, driver, installed.modules, 'windows-editor', config, receipt, choice], installed.directory, installed.env);
            try {
                const stop = performance.now() + 16000;
                while (child.code() === null && performance.now() < stop)
                    await new Promise(resolve => setTimeout(resolve, 20));
                assert.equal(child.code(), 0, fs.existsSync(receipt) ? fs.readFileSync(receipt, 'utf8') : 'No Windows console receipt');
                const saved = JSON.parse(fs.readFileSync(receipt, 'utf8'));
                assert.equal(saved.before_mode, saved.after_mode);
                assert.equal(saved.before_output_mode, saved.after_output_mode);
                output = saved.output;
                columns = saved.columns;
                rows = saved.rows;
            }
            finally {
                child.close();
            }
        }
        else {
            const p = openPty(config, 100, 30, installed.env, 'en', { executable: installed.node, args: [installed.entry, '--language', 'en', 'configure', '--config-dir', config] });
            try {
                await p.wait(value => value.includes('Preview (sample data)'));
                p.send(choice === 'save' ? ' \x13' : ' \x1b');
                await p.exited();
                assert.equal(p.child.exitCode, 0);
                assert.deepEqual(p.attributes(), p.before);
                output = p.captured().toString('utf8');
            }
            finally {
                await p.close();
            }
        }
        assert.ok(output.includes('Preview (sample data)'));
        assert.ok(output.includes('\x1b[?1049l'));
        const capture = new Capture(columns, rows);
        capture.feed(output);
        assert.ok((capture.lastAlternate ?? capture.buffer).map(row => row.map(cell => cell.data).join('')).join('\n').includes('Preview (sample data)'));
        if (choice === 'save')
            assert.equal(JSON.parse(fs.readFileSync(path, 'utf8')).instances.find((item: any) => item.id === 'model-with-effort').enabled, false);
        else
            assert.deepEqual(fs.readFileSync(path), before);
    }
    checks.external_editor = true;
});
test('installed recovery restores interrupted editor publication without Python', () => {
    const config = setup('recover-config');
    run(['config', '--config-dir', config, 'set', 'colors', 'on'], config);
    const before = ['settings.json', 'claude-statusline.json'].map(name => fs.readFileSync(join(config, name)));
    const result = spawnSync(installed.node, [driver, installed.modules, 'crash', config], { cwd: installed.directory, env: installed.env, timeout: 15000 });
    assert.equal(result.error, undefined);
    assert.notEqual(result.status, 0);
    const directory = join(config, 'statusline_runtime/transactions');
    assert.equal(fs.readdirSync(directory).filter(name => name.endsWith('.json')).length, 1);
    run(['recover', '--config-dir', config, '--dry-run'], config);
    run(['recover', '--config-dir', config], config);
    for (const [index, name] of ['settings.json', 'claude-statusline.json'].entries())
        assert.deepEqual(fs.readFileSync(join(config, name)), before[index]);
    assert.deepEqual(fs.readdirSync(directory), []);
    assert.match(run(['recover', '--config-dir', config], config), /No unfinished/u);
    checks.recovery = true;
});
test('installed candidate upgrades owned Python entry bytes while preserving opt-outs and the old environment', () => {
    const config = join(installed.temporary, 'python-upgrade'), python = join(installed.temporary, 'retained-pipx', process.platform === 'win32' ? 'claude-statusline.exe' : 'claude-statusline');
    fs.mkdirSync(dirname(python));
    fs.writeFileSync(python, 'old environment stays available');
    fs.mkdirSync(config);
    const raw = JSON.stringify({ statusLine: { type: 'command', command: JSON.stringify(python.replaceAll('\\', '/')) + ' render', padding: 2 }, env: { KEEP: 'yes' } });
    fs.writeFileSync(join(config, 'settings.json'), raw, { mode: 0o600 });
    const corpus = JSON.parse(fs.readFileSync(join(repoRoot, 'tests/fixtures/migration/ts-01/cases.json'), 'utf8'));
    const fixture = corpus.cases.find((row: any) => row.id === 'production-en-40');
    const display = JSON.stringify(corpus.configs[fixture.config_id]);
    fs.writeFileSync(join(config, 'claude-statusline.json'), display, { mode: 0o600 });
    fs.writeFileSync(join(config, 'claude-statusline-features.json'), '{"schema_version":1,"experimental_slash_tui":false}\n', { mode: 0o600 });
    run(['install', '--config-dir', config, '--no-native-editor', '--no-native-timing', '--no-live-metrics'], config);
    const value = JSON.parse(fs.readFileSync(join(config, 'settings.json'), 'utf8'));
    assert.equal(value.statusLine.padding, 2);
    assert.equal(value.env.KEEP, 'yes');
    assert.ok(value.statusLine.command.includes('entry.js'));
    assert.equal(fs.existsSync(join(config, 'skills/statusline-configure/SKILL.md')), false);
    assert.equal(fs.readFileSync(python, 'utf8'), 'old environment stays available');
    const backups = join(config, 'backups/statusline');
    const settingsBackup = fs.readdirSync(backups).map(name => join(backups, name, 'settings.json.before')).find(path => fs.existsSync(path) && fs.readFileSync(path, 'utf8') === raw);
    assert.ok(settingsBackup);
    run(['config', '--config-dir', config, 'set', 'colors', 'off'], config);
    const displayBackup = fs.readdirSync(backups).map(name => join(backups, name, 'claude-statusline.json.before')).find(path => fs.existsSync(path) && fs.readFileSync(path, 'utf8') === display);
    assert.ok(displayBackup);
    run(['uninstall', '--config-dir', config], config);
    // Deliberate downgrade: select the exact compatible before-images after
    // removing owned TS integration. Python is only the historical test oracle;
    // none of the candidate operations above had it on PATH.
    fs.copyFileSync(settingsBackup, join(config, 'settings.json'));
    fs.copyFileSync(displayBackup, join(config, 'claude-statusline.json'));
    const expected = JSON.parse(fs.readFileSync(join(repoRoot, 'tests/fixtures/migration/ts-01/expected.json'), 'utf8'))[fixture.id].value.join('\n') + '\n';
    assert.equal(run(['render'], config, JSON.stringify(fixture.input.payload), { COLUMNS: String(fixture.input.width + 2) }), expected);
    assert.equal(fs.readFileSync(join(config, 'settings.json'), 'utf8'), raw);
    assert.equal(fs.readFileSync(join(config, 'claude-statusline.json'), 'utf8'), display);
    report.compatible_backup_golden_replay = true;
    report.compatible_backup = { settings: raw, display, payload: fixture.input.payload, columns: fixture.input.width + 2, expected };
    checks.python_upgrade = true;
});
