import { VERSION } from '@fbincon/statusline-core/release';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join, dirname, delimiter } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync, execFileSync } from 'node:child_process';
import { installCandidate, PACKAGE } from '../package.js';
import { repoRoot, sourceHashes } from '../../ts-03/common.js';
import { openPty } from './pty.js';
import { startWindows } from '@fbincon/statusline-platform/terminal/launchers';
import * as bridge from '@fbincon/statusline-platform/terminal/bridge';
import { Capture } from '../capture.js';
import { POWERSHELL_FLAGS, POWERSHELL_BOOTSTRAP, powershellEnvironment, powershellIsolation, runShell, type ShellReceipt } from '../shell.js';
import { sha256 } from '../../../build/files.js';
import { installedGitPolicy } from '../../../acceptance/git-policy.js';
let installed: ReturnType<typeof installCandidate>;
const checks = { package: false, modules: false, rendering: false, entry: false, relocation: false, shell: false, native_protocol: false, external_editor: false, recovery: false, python_upgrade: false, setup: false, extensions: false, indicators: false, groups: false, automatic_refresh: false, cost_rates: false, git_policy: false };
let driver: string, report: Record<string, unknown> = {};
const shellReceipts: ShellReceipt[] = [];
before(() => {
    installed = installCandidate();
    driver = join(installed.temporary, 'acceptance-driver.mjs');
    fs.copyFileSync(fileURLToPath(new URL('./installed-driver.js', import.meta.url)), driver);
    report = { schema_version: 1, stage: installed.packed.source.channel && installed.packed.source.channel !== 'candidate' ? 'TS-06' : 'TS-05', target: process.env.TS05_TARGET ?? 'local', node: process.version, node_sha256: sha256(fs.readFileSync(process.execPath)), platform: process.platform, process_arch: process.arch, commit: installed.packed.source.commit, source_hashes: installed.packed.source.source_hashes, harness_hashes: sourceHashes(), tarball_sha256: installed.packed.sha256, lifecycle_scripts: false, offline_install: true, initially_empty_npm_cache: true, path_excludes_python_and_compilers: true, outside_checkout: true, checks };
    report.powershell_setup = JSON.parse(process.env.TS05_POWERSHELL_SETUP ?? 'null');
});
after(() => {
    // Do not publish a passing receipt if teardown itself fails.
    installed?.cleanup();
    const path = process.env.TS04_INSTALLED_REPORT;
    if (path) {
        fs.mkdirSync(dirname(path), { recursive: true });
        fs.writeFileSync(path, JSON.stringify({ ...report, status: Object.values(checks).every(Boolean) ? 'pass' : 'fail', checks, shell_receipts: shellReceipts }, null, 2) + '\n');
    }
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
function ui(config: string, operation: string, payload: unknown = {}, environment: NodeJS.ProcessEnv = {}) {
    const result = JSON.parse(run(['ui', '--config-dir', config], config, JSON.stringify({ protocol_version: 21, operation, payload }), environment));
    assert.equal(result.protocol_version, 21);
    assert.ok(result.result);
    return result.result;
}
test('installed Git policy blocks repository programs without inventing a clean worktree', async () => {
    report.git_policy_cases = await installedGitPolicy(installed); checks.git_policy = true;
});
test('installed groups retain linked visibility, remapped copies and portable references', () => {
    const config = setup('groups');
    run(['config', 'set-items', 'context-used', 'session-cost'], config);
    run(['config', 'set', 'colors', 'off'], config);
    const current = ui(config, 'read'), metric = current.draft.display.instances.find((n: any) => n.id === 'context-used');
    current.draft.display.instances.unshift({ ...metric, id: 'decoration', type_id: 'text', text: 'DECOR', options: { ...metric.options } });
    ui(config, 'apply', { draft: current.draft, expected_revision: current.revision });
    run(['config', 'group', 'main', 'create', 'group', '--members', 'decoration,context-used', '--primary', 'context-used', '--powerline', 'on'], config);
    assert(run(['render'], config, JSON.stringify({ context_window: { used_percentage: 50 } })).includes('DECOR'));
    assert(!run(['render'], config, JSON.stringify({ cost: { total_cost_usd: 0 } })).includes('DECOR'));
    run(['config', 'group', 'main', 'copy', 'group'], config);
    const groups = JSON.parse(run(['config', 'group', 'main', 'list', '--json'], config));
    assert.equal(groups.length, 2); assert.notEqual(groups[1].primary_id, groups[0].primary_id);
    const portable = join(installed.temporary, 'groups-portable.json'); run(['config', 'export', portable], config);
    run(['config', 'group', 'main', 'ungroup', 'group'], config); run(['config', 'import', portable], config);
    assert.deepEqual(JSON.parse(run(['config', 'group', 'main', 'list', '--json'], config)), groups);
    report.group_cases = 4; checks.groups = true;
});
test('installed indicators retain defaults, independent agent values and portable options', () => {
    const config = setup('indicators');
    run(['config', 'set-items', 'context-used'], config);
    run(['config', 'set', 'colors', 'off'], config);
    run(['config', 'set', 'scope-labels', 'off'], config);
    const payload = JSON.stringify({ context_window: { used_percentage: 50 } });
    assert(!run(['render'], config, payload).includes('[####'));
    run(['config', 'instance', 'main', 'set', 'context-used', 'presentation', 'bar'], config);
    run(['config', 'instance', 'main', 'set', 'context-used', 'bar-style', 'ascii'], config);
    assert(run(['render'], config, payload).includes('[####----]'));
    run(['config', 'subagents', 'set-items', 'context-used'], config);
    run(['config', 'instance', 'subagent', 'set', 'context-used', 'presentation', 'bar'], config);
    run(['config', 'instance', 'subagent', 'set', 'context-used', 'bar-style', 'ascii'], config);
    const child = JSON.stringify({ tasks: [{ id: 'a', status: 'running', tokenCount: 25, contextWindowSize: 100 }] });
    assert(run(['render-subagents'], config, child).includes('[##------]'));
    const portable = join(installed.temporary, 'indicator-portable.json');
    run(['config', 'export', portable], config);
    run(['config', 'instance', 'main', 'set', 'context-used', 'presentation', 'numeric'], config);
    run(['config', 'import', portable], config);
    assert(run(['render'], config, payload).includes('[####----]'));
    report.indicator_cases = 3; checks.indicators = true;
});
test('installed derived rates retain denominators, the observation window and portable choices', () => {
    const config = setup('cost-rates'); run(['config', 'set-items', 'session-cost-rate'], config);
    const data = { cost: { total_cost_usd: 2, total_duration_ms: 3600000, total_api_duration_ms: 600000 } };
    const session = run(['render'], config, JSON.stringify(data)); assert(session.includes('2.00') && session.includes('session'));
    run(['config', 'instance', 'main', 'set', 'session-cost-rate', 'cost-rate-basis', 'api'], config);
    const api = run(['render'], config, JSON.stringify(data)); assert(api.includes('12.00') && api.includes('API'));
    assert(run(['render'], config, JSON.stringify({ cost: { total_cost_usd: 0, total_api_duration_ms: 60000 } })).includes('0.00'));
    assert.equal(run(['render'], config, JSON.stringify({ cost: { total_cost_usd: 1, total_api_duration_ms: 59999 } })).trim(), '');
    const file = join(installed.temporary, 'cost-rate-portable.json'); run(['config', 'export', file], config);
    assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).draft.display.instances.find((n: any) => n.type_id === 'session-cost-rate').options.cost_rate_basis, 'api');
    report.cost_rate_cases = 4; checks.cost_rates = true;
});
test('installed automatic policies remain separate from display and unsupported lifecycle work', () => {
    const config = setup('automatic-refresh'), project = join(installed.temporary, 'automatic project');
    fs.mkdirSync(project);
    const before = fs.readFileSync(join(config, 'settings.json'));
    const mutation = (action: string, extra = {}) => ui(config, 'sources_apply', { action, id: 'forge', expected_revision: ui(config, 'sources_read').revision, ...extra });
    assert.deepEqual(ui(config, 'sources_read').automatic, []);
    mutation('add', { source: { name: 'Forge', kind: 'github', scope: { project, session: null, agent: null }, ttl_seconds: 300, settings: { repository: 'example/project', branch: 'main', account: 'example' } } });
    const reviewed = ui(config, 'source_review', { id: 'forge' }).review_revision;
    mutation('enable', { review_revision: reviewed });
    run(['source', 'auto-on', 'forge', '--review', reviewed, '--interval', '120', '--json'], config);
    assert.equal(ui(config, 'sources_read').automatic[0].interval_seconds, 120);
    assert.deepEqual(fs.readFileSync(join(config, 'settings.json')), before);
    for (const host_version of ['2.1.288', '2.1.294']) {
        const result = JSON.parse(run(['runtime'], config, JSON.stringify({ protocol_version: 3, operation: 'source_lifecycle', payload: { session_id: 'automatic-' + host_version.replaceAll('.', '-'), epoch: 'installed', seq: 0, project, host_version, event: 'tick' } })));
        assert.equal(result.result.scheduled, 0, 'unsupported hosts and projects without Git identity cannot dispatch');
    }
    run(['source', 'auto-off', 'forge', '--json'], config);
    const library = ui(config, 'sources_read');
    assert.equal(library.automatic[0].enabled, false); assert.equal(library.sources[0].enabled, true);
    const exported = join(project, 'portable.json'); run(['config', 'export', exported], config);
    assert(!fs.readFileSync(exported, 'utf8').includes('auth_revision'));
    report.automatic_refresh_cases = 4; checks.automatic_refresh = true;
});
test('installed sources preserve opt-in, literal commands, portable isolation and OSC8 output',()=>{
    const config=setup('extensions'), directory=installed.temporary, data=join(directory,'source 中文.json');fs.writeFileSync(data,'{"value":0}');
    const mutation=(action:string,id:string,extra={})=>ui(config,'sources_apply',{action,id,expected_revision:ui(config,'sources_read').revision,...extra});
    mutation('add','queue',{source:{name:'Queue',kind:'json',scope:{project:null,session:null,agent:null},ttl_seconds:300,settings:{path:data}}});
    run(['config','set-items','external-value'],config);
    run(['source','bind','queue','--instance','external-value','--json'],config);
    const payload=JSON.stringify({cwd:directory,session_id:'extension-test'});
    assert(!run(['render'],config,payload).includes('Queue: 0'));
    mutation('enable','queue',{review_revision:ui(config,'source_review',{id:'queue'}).review_revision});
    assert(run(['render'],config,payload).includes('Queue: 0'));
    run(['config','subagents','set-items','external-value'],config);
    run(['source','bind','queue','--instance','external-value','--scope','subagent','--json'],config);
    for(const columns of [40,80,120]) {
        const narrow={cwd:directory,session_id:'extension-test',columns,tasks:[{id:'child',cwd:directory,status:'running'}]};
        assert(run(['render'],config,JSON.stringify(narrow)).includes('Queue: 0'));
        assert(run(['render-subagents'],config,JSON.stringify(narrow)).includes('Queue: 0'));
    }
    const portable=join(directory,'extension-portable.json');run(['config','export',portable],config);
    const shared=JSON.parse(fs.readFileSync(portable,'utf8'));assert.equal(shared.draft.display.instances.find((node:any)=>node.type_id==='external-value').source.binding,null);
    assert(!fs.readFileSync(portable,'utf8').includes(data));
    mutation('disable','queue');assert(!run(['render'],config,payload).includes('Queue: 0'));
    // Functional installation smoke uses the existing maximum command budget.
    // Windows ARM emulation also starts the bounded PowerShell Job supervisor;
    // deadline/cancellation tests retain their separate short budgets.
    mutation('add','command',{source:{name:'Command',kind:'command',scope:{project:null,session:null,agent:null},ttl_seconds:300,settings:{executable:installed.node,args:['-p','String(42)'],cwd:directory,input:{},output:'text',timeout_ms:30000}}});
    mutation('enable','command',{review_revision:ui(config,'source_review',{id:'command'}).review_revision});
    run(['source','bind','command','--instance','external-value','--json'],config);
    const refreshed=JSON.parse(run(['source','refresh','command','--project',directory,'--json'],config));assert.equal(refreshed.state,'completed');
    assert(run(['render'],config,payload).includes('Command: 42'));
    run(['config','set-items','current-dir'],config);run(['config','instance','main','set','current-dir','link','on'],config);
    const linked=run(['render'],config,payload);assert(linked.includes('\x1b]8;;file:///'));assert(linked.includes('\x1b]8;;\x1b\\'));
    run(['config','instance','main','set','current-dir','link','off'],config);assert(!run(['render'],config,payload).includes('\x1b]8;'));
    report.extension_cases=4;checks.extensions=true;
});
test('private packed candidate contains only compiled business entry points and complete owned resources', () => {
    const manifest = JSON.parse(fs.readFileSync(join(installed.root, 'package.json'), 'utf8'));
    assert.equal(manifest.name, installed.packed.source.name);
    assert.equal(manifest.private, (installed.packed.source.channel ?? 'candidate') === 'candidate');
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
    const diagnosticConfig = join(installed.temporary, 'diagnostic readonly');
    const payload = { version: '2.1.296', session_id: 'synthetic-session', prompt_id: 'synthetic-prompt', workspace: { git_worktree: 'feature-linked' },
        prompt_cache: { misses: 2, hit_ratio: 0.91, cache_write_tokens: 352000, last_miss_cause: { causes: ['tools_changed', 'future_cause'], tools_added: 0, tools_removed: 2, system_char_delta: -12 } } };
    assert.equal(JSON.parse(run(['diagnose', '--input', '-', '--input-only', '--json'], diagnosticConfig, JSON.stringify(payload))).sample, false);
    assert.equal(fs.existsSync(diagnosticConfig), false);
    run(['config', 'set-items', 'worktree', 'cache-miss-reason', 'prompt-cache'], diagnosticConfig);
    const inputPath = join(installed.temporary, '输入 snapshot.json');
    fs.writeFileSync(inputPath, JSON.stringify(payload));
    const snapshot = () => Object.fromEntries(fs.readdirSync(diagnosticConfig, { recursive: true }).map(String)
        .filter(name => fs.statSync(join(diagnosticConfig, name)).isFile()).sort().map(name => [name, fs.readFileSync(join(diagnosticConfig, name)).toString('hex')]));
    for (const language of ['en', 'zh-CN', 'zh-TW', 'zh-HK', 'ja', 'ko']) {
        run(['config', 'set', 'statusline-language', language], diagnosticConfig);
        const before = snapshot();
        for (const width of [40, 80, 120]) {
            const args = ['--language', language, 'diagnose', '--input', inputPath, '--width', String(width)];
            const diagnosis = JSON.parse(run([...args, '--json'], diagnosticConfig));
            assert.equal(diagnosis.sample, false);
            assert.equal(diagnosis.host_fields.worktree.selected_source, 'workspace.git_worktree');
            assert.equal(diagnosis.host_fields.cache_miss.tools_added, 0);
            assert.ok(diagnosis.output.length > 0);
            assert.ok(!JSON.stringify(diagnosis.output).includes('statusline.'));
            assert.ok(!run(args, diagnosticConfig).includes('diagnose.'));
        }
        assert.deepEqual(snapshot(), before);
    }
    const before = snapshot(), invalid = invoke(['diagnose', '--input', '-', '--json'], diagnosticConfig, '{');
    assert.equal(invalid.status, 2); assert.ok(JSON.parse(invalid.stdout).error); assert.deepEqual(snapshot(), before);
    report.diagnostic_cases = 20;
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
    installed.root = join(directory, 'node_modules', installed.packed.source.name);
    installed.modules = join(installed.root, 'node_modules/@fbincon');
    installed.entry = join(installed.modules, 'statusline-cli/dist/src/entry.js');
    installed.bin = join(directory, 'node_modules/.bin/claude-statusline');
    assert.equal(run(['--version'], config).trim(), `claude-statusline ${VERSION}`);
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
            const readInput = `$source = [IO.File]::ReadAllText(${quote(input)}, [Text.Encoding]::UTF8); `;
            const encoding = `[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false); $OutputEncoding = [Text.UTF8Encoding]::new($false); `;
            const command = mark('started') + POWERSHELL_BOOTSTRAP + mark('modules') + powershellIsolation(installed.env) + encoding + mark('encoding') + readInput + mark('read') + `$source | & ${quote(installed.bin + '.ps1')} ${operation}; $status = $LASTEXITCODE; ` + mark('completed') + `exit $status`;
            const executed = runShell(ps, [...POWERSHELL_FLAGS, command], operation, powershellEnvironment({ ...installed.env, CLAUDE_CONFIG_DIR: config }));
            report.powershell_profile = 'OS profile with -NoProfile, explicit built-in Management/Utility, no automatic module search; isolated product paths restored before Node';
            shellReceipts.push(executed.receipt);
            const result = executed.result;
            report.powershell_phases = { ...(report.powershell_phases as object ?? {}), [operation]: fs.existsSync(checkpoint) ? fs.readFileSync(checkpoint, 'utf8').trim().split('\n') : [] };
            if (result.status !== 0) {
                const traceModule = join(installed.temporary, 'node-stdin-trace.cjs');
                fs.writeFileSync(traceModule, `const fs = require('node:fs');
const record = event => fs.appendFileSync(process.env.TS05_NODE_TRACE, JSON.stringify({ event, pid: process.pid, at: Date.now() }) + '\\n');
record('node-start');
const original = fs.readFileSync;
fs.readFileSync = function(file, ...args) { if (file === 0) record('stdin-start'); const result = original.call(this, file, ...args); if (file === 0) record('stdin-end:' + result.length); return result; };
require('node:module').syncBuiltinESMExports();
process.on('exit', code => record('exit:' + code));
`);
                const traced = (name: string) => powershellEnvironment({ ...installed.env, CLAUDE_CONFIG_DIR: config, NODE_OPTIONS: '--import=' + pathToFileURL(traceModule).href, TS05_NODE_TRACE: join(installed.temporary, name + '.node-trace') });
                const direct = encoding + readInput + `$source | & ${quote(installed.node)} ${quote(installed.entry)} ${operation}; exit $LASTEXITCODE`;
                const commands = [
                    { name: 'isolated-startup', text: '[Console]::WriteLine("ready")', env: { ...installed.env } },
                    { name: 'original-startup', text: '[Console]::WriteLine("ready")', env: { ...process.env } },
                    { name: 'original-input', text: `$source = Get-Content -LiteralPath ${quote(input)} -Raw -Encoding UTF8; [Console]::WriteLine($source.Length)`, env: { ...process.env } },
                    { name: 'node-version', text: `& ${quote(installed.node)} --version; exit $LASTEXITCODE`, env: { ...installed.env } },
                    { name: 'original-node', text: direct, env: { ...process.env, CLAUDE_CONFIG_DIR: config } },
                    { name: 'direct-node', text: POWERSHELL_BOOTSTRAP + powershellIsolation(installed.env) + direct, env: traced('direct-node') },
                    { name: 'shim-traced', text: command, env: traced('shim-traced') },
                ];
                report.shell_diagnostics = commands.map(probe => {
                    const observed = runShell(ps, [...POWERSHELL_FLAGS, probe.text], probe.name, probe.env);
                    const trace = join(installed.temporary, probe.name + '.node-trace');
                    return { ...observed.receipt, stdout: observed.result.stdout, node_trace: fs.existsSync(trace) ? fs.readFileSync(trace, 'utf8').trim().split('\n').map(line => JSON.parse(line)) : [] };
                });
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
    const pathEnv = { PATH: dirname(installed.bin) + delimiter + installed.env.PATH };
    const settingsPath = join(config, 'settings.json'), settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    settings.statusLine.command = 'claude-statusline render';
    if (settings.subagentStatusLine) settings.subagentStatusLine.command = 'claude-statusline render-subagents';
    fs.writeFileSync(settingsPath, JSON.stringify(settings));
    const diagnostic = invoke(['doctor', '--config-dir', config], config, '', pathEnv);
    assert.equal(diagnostic.status, 0, diagnostic.stdout + diagnostic.stderr);
    assert.ok(!diagnostic.stdout.includes('PATH selects another entry'));
    const described = ui(config, 'describe');
    assert.equal(described.backend_version, VERSION);
    const current = ui(config, 'read', {}, pathEnv);
    current.draft.display.use_colors = false;
    current.draft.host.padding = 4;
    const preview = ui(config, 'preview', { draft: current.draft, width: 80 });
    assert.ok(preview);
    ui(config, 'apply', { draft: current.draft, expected_revision: current.revision }, pathEnv);
    assert.equal(ui(config, 'read', {}, pathEnv).draft.host.padding, 4);
    // Return to the explicit binding for the remaining independent assertions.
    run(['install', '--config-dir', config, '--no-native-editor', '--no-native-timing', '--no-live-metrics'], config);
    assert.equal(JSON.parse(fs.readFileSync(join(config, 'settings.json'), 'utf8')).env.KEEP, 'unchanged');
    const stale = invoke(['ui', '--config-dir', config], config, JSON.stringify({ protocol_version: 21, operation: 'apply', payload: { draft: current.draft, expected_revision: current.revision } }));
    assert.equal(stale.status, 2);
    assert.equal(JSON.parse(stale.stdout).error.code, 'configuration_conflict');
    const exported = join(installed.temporary, 'portable.json');
    run(['config', '--config-dir', config, 'export', exported], config);
    assert.ok(fs.statSync(exported).size > 0);
    const project = join(installed.temporary, 'bound project 中文'), nested = join(project, 'nested'), outside = join(installed.temporary, 'unbound project');
    fs.mkdirSync(nested, { recursive: true }); fs.mkdirSync(outside);
    const library = ui(config, 'profiles_read'), candidate = structuredClone(ui(config, 'read').draft.display);
    candidate.statusline_language = 'ko';
    const created = ui(config, 'profiles_apply', { action: 'save', name: 'Installed scheme', display: candidate, bind_path: project, expected_revision: library.revision });
    const scoped = ui(config, 'read', { target: { kind: 'project', path: nested } });
    assert.equal(scoped.configuration.profile_name, 'Installed scheme'); assert.equal(scoped.draft.display.statusline_language, 'ko');
    assert.notEqual(ui(config, 'read').draft.display.statusline_language, 'ko');
    assert.equal(JSON.parse(run(['config','project','resolve',outside,'--json'],config)).reason, 'unbound');
    scoped.draft.display.statusline_language = 'ja';
    ui(config,'apply',{draft:scoped.draft,expected_revision:scoped.revision,target:{kind:'project',path:nested}});
    assert.equal(ui(config,'profiles_read').profiles[0].display.statusline_language,'ja');
    const schemeFile=join(installed.temporary,'scheme export.json');
    run(['config','profile','export','Installed scheme',schemeFile],config);
    assert.equal(JSON.parse(run(['config','profile','import',schemeFile,'--dry-run'],config)).display.statusline_language,'ja');
    const diagnosis=JSON.parse(run(['diagnose','--input','-','--input-only','--json'],config,JSON.stringify({cwd:nested,model:{id:'installed'}})));
    assert.equal(diagnosis.configuration.profile_id,created.profiles[0].id);
    const missingTasks=join(installed.temporary,'task readonly missing');
    const task=JSON.parse(run(['task','show','--session-id','synthetic-session','--json'],missingTasks));
    assert.equal(task.prompt_id,null); assert.equal(task.version,1); assert.equal(fs.existsSync(missingTasks),false);
    report.profile_project_task_cases = 8;
    checks.native_protocol = true;
});
test('installed setup checks, previews, cancels, saves and integrates in a real terminal', { timeout: 90000 }, async () => {
    const readonly = join(installed.temporary, 'setup readonly');
    const dry = invoke(['setup', '--dry-run'], readonly);
    assert([0,1].includes(dry.status!), dry.stdout + dry.stderr);
    assert.equal(fs.existsSync(readonly), false);
    assert.equal(invoke(['setup'], readonly).status, 2);
    assert.equal(fs.existsSync(readonly), false);
    for (const choice of ['cancel','save','integrate']) {
        const config = join(installed.temporary, 'setup ' + choice);
        fs.mkdirSync(config);
        fs.writeFileSync(join(config,'claude-statusline-native.json'),'{"schema_version":1,"native_editor":false}');
        fs.writeFileSync(join(config,'claude-statusline-features.json'),'{"schema_version":1,"experimental_slash_tui":false}');
        if (process.platform === 'win32') {
            const receipt=join(installed.temporary,'setup-console-'+choice+'.json');
            const child=startWindows([installed.node,driver,installed.modules,'windows-setup',config,receipt,choice],installed.directory,installed.env);
            try {
                const stop=performance.now()+20000;
                while(child.code()===null && performance.now()<stop) await new Promise(resolve=>setTimeout(resolve,20));
                assert.equal(child.code(),0,fs.existsSync(receipt)?fs.readFileSync(receipt,'utf8'):'No setup console receipt');
                const result=JSON.parse(fs.readFileSync(receipt,'utf8'));
                assert.equal(result.status,0);assert.equal(result.before_mode,result.after_mode);assert.equal(result.before_output_mode,result.after_output_mode);
            } finally { child.close(); }
        } else {
            const pty=openPty(config,100,30,installed.env,'en',{executable:installed.node,args:[driver,installed.modules,'setup-console',config],cwd:installed.directory});
            try {
                await pty.wait(text=>text.includes('Environment and configuration checks'));
                if(choice==='cancel') pty.send('\x1b');
                else {
                    pty.send('\r');await pty.wait(text=>text.includes('2. Choose a display'));
                    pty.send('\r');await pty.wait(text=>text.includes('Daily development'));
                    pty.send('\r');await pty.wait(text=>text.includes('Statusline theme'));
                    pty.send('\x1b[F\r');await pty.wait(text=>text.includes('4. Review before applying'));
                    pty.send((choice==='save'?'\x1b[B':'')+'\r');
                }
                await pty.exited();assert.equal(pty.child.exitCode,0,pty.captured().toString('utf8').slice(-3000));
                assert.deepEqual(pty.attributes(),pty.before);
            } finally { pty.close(); }
        }
        const displayPath=join(config,'claude-statusline.json');
        assert.equal(fs.existsSync(displayPath),choice!=='cancel');
        assert.equal(fs.existsSync(join(config,'settings.json')),choice==='integrate');
        if(choice!=='cancel') {
            const display=JSON.parse(fs.readFileSync(displayPath,'utf8'));
            assert.equal(display.schema_version,13);assert.equal(display.theme,'terminal');
            assert.equal(display.instances.find((node:any)=>node.type_id==='session-cost').enabled,false);
        }
    }
    report.setup_cases=3;report.setup_host_version='synthetic 2.1.258; file integration and terminal journey';checks.setup=true;
});
test('installed external editor saves and cancels in a real native terminal', { timeout: 45000 }, async () => {
    const config = setup('external-editor');
    const settingsPath = join(config, 'settings.json'), settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    settings.statusLine.command = 'claude-statusline render';
    fs.writeFileSync(settingsPath, JSON.stringify(settings));
    const pathEnv = { ...installed.env, PATH: dirname(installed.bin) + delimiter + installed.env.PATH };
    for (const choice of ['save', 'cancel']) {
        const path = join(config, 'claude-statusline.json'), before = fs.existsSync(path) ? fs.readFileSync(path) : null;
        let output: string, columns = 100, rows = 30;
        if (process.platform === 'win32') {
            const invocation = bridge.prepare(config, { executable: installed.node, args: [installed.entry] }, installed.directory);
            const env = { ...pathEnv, [bridge.REQUEST_ENV]: invocation.path, [bridge.NONCE_ENV]: invocation.request.nonce, [bridge.RESULT_ENV]: invocation.result, [bridge.DEADLINE_ENV]: '30' };
            const receipt = join(installed.temporary, 'console-' + choice + '.json'), child = startWindows([installed.node, driver, installed.modules, 'windows-editor', config, receipt, choice], installed.directory, env);
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
                assert.equal(bridge.started(invocation.directory, config, invocation.request.nonce).pid > 0, true);
                assert.equal(bridge.readResult(invocation.result, config).outcome, choice === 'save' ? 'updated' : 'cancelled');
                report.windows_bridge = { request: true, started: true, result: true, save: true, cancel: true };
            }
            finally {
                child.close();
                bridge.cleanup(invocation.directory);
            }
        }
        else {
            const p = openPty(config, 100, 30, pathEnv, 'en', { executable: installed.node, args: [installed.entry, '--language', 'en', 'configure', '--config-dir', config] });
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
