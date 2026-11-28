import { taskInputJourney } from './task-input-pty.js';
import { taskFixture } from './task-fixture.js';
/** Installed, real Claude PTYs for capacity and editor workflows. All inputs are local. */
import * as fs from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import assert from 'node:assert/strict';
import { release } from 'node:os';
import { claudeLaunch } from '@fbincon/statusline-platform/commands';
import { installCandidate, officialEnvironment } from './install.js';
import { verifyDelivery } from '../build/verify.js';
import { sourceHashes } from '../migration/ts-03/common.js';
import { sha256 } from '../build/files.js';
import { nativeCapacityData } from '../generation/native-capacity.js';
import { openPty } from '../migration/ts-04/test/pty.js';
import { Capture, cellColors, cellColumn, showsInputCaret, type Cell } from '../migration/ts-04/capture.js';
import { EDITOR_SHORTCUTS_FILENAME, type Draft } from '@fbincon/statusline-core/contracts/ui';
import { t, type Language } from '@fbincon/statusline-core/i18n/messages';
import { displayWidth } from '@fbincon/statusline-core/unicode/index';

const { values } = parseArgs({ options: {
    artifact: { type: 'string' }, commit: { type: 'string' }, output: { type: 'string' },
    claude: { type: 'string', default: 'claude' }, 'component-picker': { type: 'boolean' }, 'header-controls': { type: 'boolean' },
    'editor-shortcuts': { type: 'boolean' }, 'version-installation': { type: 'boolean' }, 'item-details': { type: 'boolean' },
} });
if (!values.artifact || !values.commit || !values.output) throw new Error('Require --artifact TGZ --commit SHA --output NEW_DIRECTORY [--claude EXECUTABLE] [--component-picker | --header-controls | --editor-shortcuts | --version-installation | --item-details]');
assert([values['component-picker'], values['header-controls'], values['editor-shortcuts'], values['version-installation'], values['item-details']]
    .filter(Boolean).length <= 1, 'Select one focused PTY journey');
if (process.platform !== 'linux') throw new Error('This receipt covers Linux PTYs only');
const artifact = verifyDelivery(resolve(values.artifact), values.commit);
assert.deepEqual(artifact.source.source_hashes, sourceHashes(), 'PTY collector differs from the candidate source');
const output = resolve(values.output); fs.mkdirSync(output);
const installed = installCandidate(values.artifact, values.commit), host = claudeLaunch(values.claude);
const versionRun = spawnSync(host.executable, [...host.args, '--version'], { encoding: 'utf8', timeout: 10000 });
const version = versionRun.stdout.match(/(\d+)\.(\d+)\.(\d+)/u)?.slice(1).map(Number);
assert(versionRun.status === 0 && version?.[2]! >= 289, 'An official host with both Mods is required');
const matrix = nativeCapacityData(), reports: Record<string, unknown>[] = [];
const project = join(installed.temporary, 'project 中文 &'), template = join(installed.temporary, 'template'), shim = join(installed.temporary, 'backend-entry.mjs');
fs.mkdirSync(project); fs.mkdirSync(template);
const cliModule = (path: string) => JSON.stringify(pathToFileURL(join(installed.modules, 'statusline-cli/dist/src', path)).href);
fs.writeFileSync(shim, `import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { main } from ${cliModule('main.js')};

const args = process.argv.slice(2), command = args[0];
const raw = ['ui', 'runtime', 'render', 'render-subagents', 'hook', 'slash-hook'].includes(command) ? fs.readFileSync(0, 'utf8') : '';
const log = path.join(process.env.CLAUDE_CONFIG_DIR, 'backend.jsonl');
const record = value => fs.appendFileSync(log, JSON.stringify(value) + '\\n');

if (command === 'configure') {
  // External editor requests go directly through the in-process protocol.
  const { ConfigurationProtocol } = await import(${cliModule('ui/protocol.js')});
  const handle = ConfigurationProtocol.prototype.handle;
  ConfigurationProtocol.prototype.handle = function (request, diagnostics) {
    const { operation } = JSON.parse(request);
    if (typeof operation === 'string' && (['apply', 'explain', 'source_refresh', 'sources_apply'].includes(operation) || operation.startsWith('package_')))
        record({ command, operation, phase: 'request' });
    const result = handle.call(this, request, diagnostics);
    if (operation === 'explain') record({ command, operation, phase: 'complete', status: result.status });
    return result;
  };
}

let operation = null, sourceValue = null, preview = {};
try {
  const request = JSON.parse(raw);
  operation = request.operation ?? null;
  if (operation === 'preview') preview = {
    width: request.payload.width,
    draft_sha256: createHash('sha256').update(JSON.stringify(request.payload.draft)).digest('hex'),
  };
} catch { /* Only JSON requests carry operation and preview data. */ }
record({ command, operation, phase: 'request' });
process.exitCode = await main(args, {
  launch: { executable: process.execPath, args: [${JSON.stringify(shim)}] },
  hostVersion: () => ${JSON.stringify(version)},
  stdin: () => raw,
  stdout(value) {
    process.stdout.write(value);
    if (operation === 'source_inspect') {
      try { sourceValue = JSON.parse(value).result?.view?.value ?? null; }
      catch { /* A partial response cannot supply the source value. */ }
    }
  },
});
record({ command, operation, phase: 'complete', status: process.exitCode, ...preview,
  ...(operation === 'source_inspect' ? { source_value: sourceValue } : {}),
});
`);
const env = officialEnvironment(installed);
function command(executable: string, args: string[], environment = env, timeout = 180000) {
    const result = spawnSync(executable, args, { cwd: project, env: environment, encoding: 'utf8', timeout, maxBuffer: 8 * 1024 * 1024 });
    if (result.status !== 0 || result.error) throw new Error('Acceptance command failed: ' + JSON.stringify({ args, status: result.status, error: result.error?.message, stderr: result.stderr, stdout: result.stdout.slice(-3000) }));
    return result.stdout;
}
const record = (path: string, value: unknown) => fs.writeFileSync(path, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
function caseData(name: string): any {
    const row = matrix.cases.find(row => row.name === name); assert(row, 'Unknown fixture ' + name);
    return Object.fromEntries(Object.entries(row.editor).map(([key, index]) => [key, structuredClone(matrix.values[index])]));
}
const failures = /props serializes to more than|a tree serializing to more than|too many nodes|too deep|a hook returned a tree that does not validate|instance unmounted|returned a tree that does not validate/u;
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
function assertShortcutHelp(screen: Capture): void {
    const lines = screen.buffer.map(row => row.map(cell => cell.data).join(''));
    const top = lines.findIndex(line => /[┌╭]─ Keyboard shortcuts ─/u.test(line));
    const bottom = lines.findIndex((line, index) => index > top && /[└╰]──+/u.test(line));
    assert(top >= 0 && bottom > top, 'Shortcut content must have a frame');
    const body = lines.slice(top + 1, bottom);
    assert(body.some(line => line.includes('─ Editor and draft ─')), 'Shortcut group divider is inside the frame');
    assert(body.some(line => /OPTION +(?:VALUE|CURRENT KEY +DEFAULT KEY)/u.test(line)), 'Shortcut columns are inside the frame');
    for (const label of ['Save shortcuts', 'Restore all defaults', 'Read saved'])
        assert(body[0]?.includes('[' + label + ']'), 'Shortcut button is at the top of the frame: ' + label);
    assert.match(body.at(-1) ?? '', /Terminal (?:Ctrl\+S|Z) \[Ctrl\+S\] · Client (?:S|Z) \[S\]/u,
        'Selected keys are pinned against the bottom edge');
    const toolbar = screen.buffer.slice(top + 1, top + 3);
    const footer = screen.buffer.slice(bottom + 1, bottom + 2);
    for (const [area, key, label] of [[toolbar, 'Tab', 'to actions'], [footer, '/', 'filter'],
        [footer, 'Enter', 'change'], [footer, 'Delete', 'reset key'], [footer, 'Ctrl+G', 'back']] as const) {
        const hint = `${key} ${label}`;
        assert.ok(area.some(row => row.some((cell, start) => {
            if (!cell.bold || cell.data !== key[0]) return false;
            const cells = row.slice(start, start + hint.length);
            return cells.map(value => value.data).join('') === hint && cells.every((value, index) => value.bold === (index < key.length));
        })), `Missing styled shortcut help: ${hint}`);
    }
}

const detailLabel = 'Probe 样例';
const detailPreview = detailLabel + ' Opus high';

function reportRange(text: string) {
    const match = /\b(\d+)–(\d+)\/(\d+)\b/u.exec(text);
    return match ? { start: Number(match[1]), end: Number(match[2]), total: Number(match[3]) } : null;
}

function showsText(screen: Capture, text: string, bold: boolean): boolean {
    return screen.buffer.some(row => {
        const start = cellColumn(row, text);
        return start >= 0 && row.slice(start, start + displayWidth(text))
            .every(cell => !cell.data.trim() || cell.bold === bold);
    });
}

async function runCase(name: string, fixtureName: string, action: string, external = false, language: Language = 'en') {
    const directory = join(output, name); fs.mkdirSync(directory);
    const config = join(installed.temporary, name);
    // The live-command journey reruns the real installer, whose ownership
    // checks correctly refuse registrations copied from another config root.
    if (action === 'live-command') fs.mkdirSync(config); else fs.cpSync(template, config, { recursive: true });
    const data = caseData(fixtureName), draft = (fixtureName === 'import-four-gradients' ? data.review.result.draft : data.draft) as Draft;
    const itemDetails = action === 'item-details';
    if (itemDetails) {
        const item = draft.display.instances[0]!;
        assert.equal(item.type_id, 'model-with-effort');
        // The catalog example retains the full model ID. The preview follows the configured label and short model format.
        item.options.label = detailLabel;
        draft.display.formatting.model_name = 'short';
    }
    record(join(config, '.claude.json'), { hasCompletedOnboarding: true, theme: 'dark', projects: { [project]: { hasTrustDialogAccepted: true } } });
    record(join(config, 'claude-statusline.json'), draft.display);
    record(join(config, 'statusline-ui.json'), { schema_version: 1, ui_language: language });
    const shortcutPath = join(config, EDITOR_SHORTCUTS_FILENAME);
    let legacyShortcuts: { bytes: Buffer; mode: number } | undefined;
    if (action === 'editor-shortcuts') {
        record(shortcutPath, {
            schema_version: 1, bindings: { close: 'M', search: 'Y', undo: 'Ctrl+Z', redo: 'U', 'reload-profiles': 'Ctrl+D', 'reload-sources': 'Ctrl+X' },
        });
        legacyShortcuts = { bytes: fs.readFileSync(shortcutPath), mode: fs.statSync(shortcutPath).mode };
    } else if (action === 'shortcut-preset') {
        record(shortcutPath, { schema_version: 1, bindings: { save: 'Q', close: 'Z', 'close-picker': 'Z' } });
    }
    if (data.profiles?.library) { const { revision: _, ...library } = data.profiles.library; record(join(config, 'claude-statusline-profiles.json'), library); }
    if (data.sources?.library) { const { revision: _, ...library } = data.sources.library; record(join(config, 'claude-statusline-sources.json'), library); }
    const importPath = join(config, 'identical-display.json');const imported=structuredClone(draft.display);if(action==='style-reuse'){imported.instances[0]!.options.foreground='#abcdef';imported.instances[0]!.options.label='Copied style';}record(importPath, imported);
    const diagnosticPath=join(config,'explicit input 中文.json');record(diagnosticPath,{session_id:'explicit-file',version:'2.1.310',model:{id:'File-input-model'},context_window:{used_percentage:95,remaining_percentage:5}});
    const taskEvidence=taskFixture(config,'task-pty');
    if(action==='live-command'){
        const spec=join(config,'controlled-command.json');record(spec,{name:'Controlled active-session command',kind:'command',scope:{project,session:null,agent:null},ttl_seconds:300,settings:{executable:installed.node,args:['-e','process.stdout.write("live-session-command")'],cwd:project,input:{session:'session'},output:'text',timeout_ms:5000}});
        const cli=(args:string[])=>command(installed.node,[installed.entry,'source','--config-dir',config,...args],{...env,CLAUDE_CONFIG_DIR:config});
        cli(['add','pty-command','--file',spec]);const review=JSON.parse(cli(['review','pty-command','--json'])).review_revision;
        cli(['enable','pty-command','--review',review]);cli(['auto-on','pty-command','--review',review,'--interval','300']);
        // Policy approval and host integration are independent commit points.
        const refresh=join(config,'refresh-host.mjs');
        fs.writeFileSync(refresh,`import{install,installContext}from ${JSON.stringify(pathToFileURL(join(installed.modules,'statusline-cli/dist/src/integration/install.js')).href)};import{PluginHost}from ${JSON.stringify(pathToFileURL(join(installed.modules,'statusline-platform/dist/src/plugin-host.js')).href)};const directory=process.argv[2];const context=installContext(directory,{executable:process.execPath,args:[${JSON.stringify(shim)}]},${JSON.stringify(version)},undefined,()=>new PluginHost(directory,${JSON.stringify(host)}));const result=install(context,{native:true,external:true,nativeTiming:true,liveMetrics:false});if(result.failed)throw new Error(JSON.stringify(result.messages));`);
        command(installed.node,[refresh,config],{...env,CLAUDE_CONFIG_DIR:config});
    }
    const displayPath = join(config, 'claude-statusline.json');
    const before = fs.readFileSync(displayPath), beforeMode = fs.statSync(displayPath).mode;
    const preferences = itemDetails ? ['settings.json', 'statusline-ui.json'].map(file => {
        const path = join(config, file);
        return { path, bytes: fs.readFileSync(path), mode: fs.statSync(path).mode };
    }) : [];
    const pickerSave = action === 'picker-save';
    const pickerDiscard = action === 'picker-discard';
    fs.writeFileSync(join(config, 'backend.jsonl'), '');
    const hostLog = join(directory, 'host.log'), environment = { ...env, CLAUDE_CONFIG_DIR: config, COLORTERM: 'truecolor' };
    const nativeTask = action === 'native-task';
    const compactTask = nativeTask && name === 'native-task-viewer';
    const header = action === 'header-controls';
    const initialColumns = header ? 190 : nativeTask ? compactTask ? 80 : 140 : external ? 120 : 200;
    const initialRows = itemDetails ? 26 : header ? 40 : nativeTask ? compactTask ? 24 : 44 : action === 'tall' ? 220 : external ? 32 : 50;
    let columns = initialColumns, rows = initialRows;
    const p = openPty(config, columns, rows, environment, language, external
        ? { executable: installed.node, args: [shim, 'configure', '--config-dir', config], cwd: project }
        : { executable: host.executable, args: [...host.args, '--debug-file', hostLog, '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}'], cwd: project });
    let screen = new Capture(columns, rows), offset = 0, accepted = false;
    const steps: { name: string; elapsed_ms: number }[] = [], start = Date.now();
    const records = () => fs.readFileSync(join(config, 'backend.jsonl'), 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line));
    const completed = (operation: string) => records().some(row => row.operation === operation && row.phase === 'complete' && row.status === 0);
    const applyRequests = () => records().filter(row => row.operation === 'apply' && row.phase === 'request').length;
    const read = () => {
        const bytes = p.captured(), next = bytes.subarray(offset); offset = bytes.length; screen.feed(next);
        if (next.includes(Buffer.from('\x1b[6n'))) p.send('\x1b[1;1R');
        const text = screen.buffer.map(row => row.map(cell => cell.data).join('')).join('\n');
        if (!accepted && !external && text.includes('ANTHROPIC_API_KEY')) { p.send('\x1b[A\r'); accepted = true; }
        if (fs.existsSync(hostLog)) assert(!failures.test(fs.readFileSync(hostLog, 'utf8')), 'Host refused a presentation');
        return text;
    };
    const until = async (predicate: (text: string) => boolean, label: string, timeout = 15000) => {
        const stop = Date.now() + timeout;
        while (Date.now() < stop && p.child.exitCode === null) {
            if (predicate(read())) { steps.push({ name: label, elapsed_ms: Date.now() - start }); return; }
            await delay(50);
        }
        throw new Error('PTY condition failed: ' + label + '\n' + read().slice(-3000));
    };
    const key = async (bytes: string, label: string) => { p.send(bytes); await delay(180); read(); steps.push({ name: label, elapsed_ms: Date.now() - start }); };
    const capture = (label: string) => { read(); record(join(directory, label + '.cells.json'), { columns, rows, cells: screen.buffer, terminal_foreground: '#dedee7', terminal_background: '#17191e' }); fs.writeFileSync(join(directory, label + '.txt'), screen.buffer.map(row => row.map(cell => cell.data).join('')).join('\n')); };
    let status = 'fail', error: string | null = null, bodyColumns: number | undefined;
    const title = t('native.ui.client.draw.configure_status_line', language);
    try {
        if (!external) {
            await until(text => text.includes('❯') && fs.existsSync(hostLog) && fs.readFileSync(hostLog, 'utf8').includes('$.command.register (statusline-native): /statusline-configure-native listed'), 'host command ready', 30000);
            if (!nativeTask) await key('/statusline-configure-native\r', 'open native command');
        }
        if (!nativeTask) await until(text => text.includes(title) && text.includes('[x]') && (external || completed('preview')), 'main and preview visible');
        if (!external && !nativeTask) {
            let clicked = false;
            for (let y = 0; y < screen.buffer.length && !clicked; y++) {
                const row = screen.buffer[y]!, x = row.findIndex((cell, i) => cell.data === '[' && row[i + 1]?.data === 'x' && row[i + 2]?.data === ']');
                if (x >= 0) { await key(`\x1b[<0;${x + 2};${y + 1}M\x1b[<0;${x + 2};${y + 1}m`, 'focus Client'); clicked = true; }
            }
            assert(clicked, 'No observed Client item to focus');
        }
        if (!nativeTask) capture('before');
        if (header) {
            const retry = '[ ' + t('native.hooks.register.retry', language) + ' ]';
            const close = '[ ' + t('native.hooks.register.close', language) + ' ]';
            await until(text => text.split('\n').some(line => {
                const start = line.indexOf(title), a = line.indexOf(retry), b = line.indexOf(close);
                return start >= 0 && a > start + title.length && b >= a + retry.length + 1 &&
                    b + close.length - start === 72;
            }), 'title and both complete controls fit the 72-cell row');
            bodyColumns = 72;
            capture('header');
            const previews = () => records().filter(row => row.operation === 'preview' && row.phase === 'complete' && row.status === 0);
            const initial = previews().at(-1)!;
            assert.equal(initial.width, 70, 'Framed Client did not request a 70-cell preview');
            await key(' ', 'edit the draft');
            await until(() => previews().at(-1)?.draft_sha256 !== initial.draft_sha256, 'draft preview changed');
            const edited = previews().at(-1)!;
            // The backend logs completion before the host installs the new Button handlers.
            await delay(350);
            const click = async (label: string) => {
                read();
                for (const [y, row] of screen.buffer.entries()) {
                    const x = row.findIndex((_, i) => row.slice(i, i + label.length).map(cell => cell.data).join('') === label);
                    if (x >= 0) {
                        await key('\x1b[<0;' + (x + 3) + ';' + (y + 1) + 'M\x1b[<0;' + (x + 3) + ';' + (y + 1) + 'm', 'click ' + label);
                        return;
                    }
                }
                assert.fail('No visible control ' + label);
            };
            const count = previews().length;
            await click(retry);
            await until(() => previews().length > count, 'Retry restarted the Client');
            assert.equal(previews().at(-1)?.draft_sha256, edited.draft_sha256, 'Retry lost the unsaved draft');
            await delay(350);
            await click(close);
            await until(text => !text.includes(title) && !text.includes(retry) && !text.includes(close), 'Close dismissed the pane');
            assert(!records().some(row => row.operation === 'apply'), 'Closing applied the draft');
        } else if (pickerSave || pickerDiscard) {
            const marker = (text: string, value: string) =>
                text.split('\n').some(line => /›\s+\[/u.test(line) && line.includes('[' + value + ']'));
            const query = async (id: string) => {
                await key('/', 'open search');
                await key('\x15', 'clear search');
                await key(id, 'type ' + id);
                await key('\r', 'accept search');
            };
            for (const scope of ['main', 'subagent'] as const) {
                if (scope === 'subagent') await key(external ? '\t' : '2', 'switch to subagents');
                const catalog = matrix.description.catalog.filter(item => item.scope === scope);
                const categories = ['all', ...new Set(catalog.map(item => item.group))];
                await key('\x06', 'choose a category');
                await until(text => text.includes('› All categories'), 'category choices visible');
                await key('\x1b[H', 'first category');
                for (let i = 0; i < categories.indexOf('model'); i++) await key('\x1b[B', 'next category');
                await key('\r', 'confirm Model category');
                const totals = t('composition.category_counts', 'en', {
                    configured: 1, unconfigured: catalog.filter(item => item.group === 'model').length - 1,
                });
                await until(text => text.includes(totals), 'configured and unconfigured counts visible');
                await query('model-with-effort');
                await key('\r', 'toggle the configured model instance with Enter');
                await until(text => marker(text, ' '), 'configured instance disabled in the draft');
                await key(external ? '\x01' : 'a', 'open component catalog');
                await until(text => text.includes('Component catalog') && text.includes('model-with-effort') && marker(text, '–'), 'inherited search and disabled type');
                await key('\r', 'enable the existing instance');
                await until(text => text.includes('Enabled in draft') && marker(text, 'x'), 'enabled instance reused');
                await key('\x15', 'clear the catalog search');
                const modelTypes = catalog.filter(item => item.group === 'model');
                for (const id of ['effort', 'model']) {
                    await key('\x1b[H', 'first catalog type');
                    const index = modelTypes.findIndex(item => item.id === id);
                    assert.ok(index >= 0, id + ' is missing from the model category');
                    for (let i = 0; i < index; i++) await key('\x1b[B', 'next catalog type');
                    await until(text => marker(text, ' '), 'unconfigured ' + id);
                    await key(id === 'effort' ? '\r' : ' ', 'add ' + id + ' to draft');
                    await until(text => text.includes('Component catalog') && text.includes('Added to draft') && marker(text, 'x'), 'selected type updated in place');
                }
                await key('\r', 'activate the enabled type again');
                await until(text => text.includes('Already enabled') && marker(text, 'x'), 'duplicate prevented');
                await key('\x07', 'return to the configured list');
                await until(text => text.includes('Configured components') && text.includes('model-with-effort') && !text.includes('Component catalog'), 'configured filters restored');
                await key('\x07', 'clear the configured list filters');
                await until(text => text.includes('All categories') && !text.includes('Filter: model-with-effort'), 'all configured instances visible');
            }
            assert.deepEqual(fs.readFileSync(displayPath), before);
            assert.equal(fs.statSync(displayPath).mode, beforeMode);
            assert.equal(applyRequests(), 0, 'Activating configured or catalog rows applied the draft');
            await until(text => text.includes('Preview'), 'sample preview visible before save');
            capture('after');
            if (pickerSave) {
                if (external) {
                    await key('\x13', 'save with external Ctrl+S');
                    await p.exited();
                } else {
                    await key('s', 'save with Native S');
                    await until(text => completed('apply') && /saved/iu.test(text), 'saved draft visible');
                }
                assert.equal(applyRequests(), 1, 'Explicit save must apply the draft exactly once');
                const saved = JSON.parse(fs.readFileSync(displayPath, 'utf8')) as Draft['display'];
                for (const scope of ['main', 'subagent'] as const) {
                    const instances = scope === 'main' ? saved.instances : saved.subagents.instances;
                    const anchor = instances.findIndex(item => item.id === 'model-with-effort');
                    assert.ok(anchor >= 0);
                    assert.deepEqual(instances.slice(anchor, anchor + 3).map(item => item.type_id), ['model-with-effort', 'effort', 'model']);
                    const listing = JSON.parse(command(installed.node, [shim, 'config', '--config-dir', config,
                        ...(scope === 'subagent' ? ['subagents'] : []), 'list-items', '--json'], environment));
                    for (const id of ['model-with-effort', 'effort', 'model']) {
                        const row = listing.find((item: { id: string }) => item.id === id);
                        assert.equal(row?.enabled, true);
                        assert.equal(row?.instance_ids.length, 1);
                    }
                }
            }
        } else if(action==='draft-history') {
            await key(external?'\x04':'d','one logical copy');await until(text=>text.includes('Configure Status Line *'),'copy retained');
            await key(external?'\x1a':'\x1f',external?'undo copy (Ctrl+Z)':'undo copy (Ctrl+_)');await until(text=>text.includes('Configure Status Line')&&!text.includes('Configure Status Line *'),'undo restored baseline');
            await key('\x12','redo copy');await until(text=>text.includes('Configure Status Line *'),'redo restored draft');
            await key('\x14','review changes');await until(text=>text.includes('Changes and history'),'history visible');
            await key('c','compare current file');await until(text=>text.includes('Baseline → current file'),'current revision compared');
            await key('\t','replacement comparison');capture('after');await key('e','export retained draft');await key('\x15','clear export path');
            const exportPath=join(directory,'retained-draft.json');await key(exportPath,'literal export path');await key('\r','export draft');await until(()=>fs.existsSync(exportPath),'draft export exists');assert(JSON.parse(fs.readFileSync(exportPath,'utf8')).draft.display.instances.length===draft.display.instances.length+1);
            await key('u','history page undo');await key('r','history page redo');await key('u','history page undo again');
            await key('q','return from review');await until(text=>text.includes('Configure Status Line')&&!text.includes('Configure Status Line *'),'original draft restored');
        } else if(action==='alignment-repair') {
            await key(external?'\x18':'x','delete referenced primary');await until(text=>text.includes('Review structural edit'),'repair proposal visible');capture('after');
            await key('a','accept atomic structural repair');await until(text=>text.includes('Configure Status Line *'),'structural edit retained');await key(external?'\x1a':'\x1f','undo complete repair');await until(text=>text.includes('Configure Status Line')&&!text.includes('Configure Status Line *'),'structure and references restored');
        } else if(action==='style-reuse') {
            await key('\x05','destination details');await key('\x1b[H','first detail');
            for(let i=0;i<15&&!read().split('\n').some(line=>line.includes('›')&&line.includes('Copy / paste visual style'));i++)await key('\x1b[B','find visual reuse');
            await key('\r','choose style source');await key('\x1b[B\r','portable style file');await key('\x15','clear source path');await key(importPath,'literal style path');await key('\r','read style file');
            await key('\x1b[B\r','source component');await key('\x1b[F\r','review selected visual fields');await until(text=>text.includes('Candidate only'),'style candidate visible');capture('after');
            await key('a','accept visual fields');await until(text=>text.includes('Applied to draft'),'style applied');await key('q','close reuse');await key('\x07','leave destination details');await key(external?'\x1a':'\x1f','undo style paste');await until(text=>text.includes('Configure Status Line')&&!text.includes('Configure Status Line *'),'original style restored');
        } else if(action==='group-reuse') {
            await key(external?'\t\t\t':'4','settings');await key('\x1b[H','first setting');
            for(let i=0;i<90&&!read().split('\n').some(line=>line.includes('›')&&line.includes('Reuse complete groups'));i++)await key('\x1b[B','find group reuse');
            await key('\r\r','select current source');await key('\x1b[B ','select first whole group');await key('\x1b[F\r','review dependencies');await until(text=>text.includes('Outside references require'),'outside references explicit');
            await key('x','expand reference closure');await key('\t','inspect mapped identities');capture('after');await key('a','accept complete group closure');await until(text=>text.includes('Applied to draft'),'groups accepted');
            await key('q','return from group reuse');await key(external?'\x1a':'\x1f','undo whole import');await until(text=>text.includes('Configure Status Line')&&!text.includes('Configure Status Line *'),'groups and rows restored');
        } else if(['version-status','package-cleanup','external-task'].includes(action)) {
            await key(external?'\x04':'d','unsaved copy');
            await key(external?'\t\t\t':'4','settings');await key('\x1b[H','first setting');
            const label=action==='external-task'?'Task details':'Version and installation';
            for(let i=0;i<90&&!read().split('\n').some(line=>line.includes('›')&&line.includes(label));i++)await key('\x1b[B','select read-only entry');
            await until(text=>text.split('\n').some(line=>line.includes('›')&&line.includes(label)),'read-only entry selected');
            await key('\r','open read-only view');
            if(action==='external-task'){
                await key('task-pty\r','read explicit task');await until(text=>text.includes('captured-task'),'task identity visible');
                await key('/agent-alpha\r','search agent');await key('e','show evidence');await key('r','manual refresh');
                await until(text=>text.includes('captured-task'),'task retained');capture('after');await key('q','return to editor');
                assert.deepEqual(fs.readFileSync(taskEvidence.path),taskEvidence.bytes);
            } else {
                await until(text=>text.includes('Local status'),'local status boundary visible');
                const installationGroup = '─ ' + t('package.ui.installation_actions', 'en') + ' ─';
                await until(text => text.includes(installationGroup), 'installation actions are separated by a group divider');
                const selected = (text: string, label: string) => text.split('\n').some(line => line.includes('›') && line.includes(label));
                const select = async (label: string) => {
                    await key('\x1b[H', 'first row');
                    for (let i = 0; i < 36 && !selected(read(), label); i++) await key('\x1b[B', 'seek ' + label);
                    await until(text => selected(text, label), label + ' selected');
                };
                const resize = (nextColumns: number, nextRows: number) => {
                    columns = nextColumns;
                    rows = nextRows;
                    offset = p.captured().length;
                    screen = new Capture(columns, rows);
                    p.resize(columns, rows);
                };
                const installation = t('package.ui.installation_details', 'en');
                const history = t('package.ui.history_title', 'en');
                await select(installation);
                await key('\r', 'open installation details');
                await until(text => selected(text, 'Enter edit · Prefix:'), 'editable prefix identified');
                // Select an owned temporary prefix to exercise local reads without depending on the real installation.
                await key('\r\x15', 'edit and clear the prefix');
                await key(project, 'type a literal prefix containing spaces and Unicode');
                await key('\r', 'inspect the selected prefix');
                await until(text => selected(text, 'Enter edit · Prefix:'), 'prefix selection restored after reading');
                await key('q', 'return from installation details');
                await until(text => selected(text, installation), 'installation details restored');
                if (action === 'package-cleanup') {
                    await select(history);
                    await key('\r', 'open recovery and history');
                    const cleanup = t('package.ui.cleanup_review', 'en');
                    await select(cleanup);
                    await key('\r', 'review local cleanup');
                    await until(text => text.includes(t('package.ui.cleanup_notice', 'en').slice(0, 32)), 'cleanup read completed');
                    capture('after');
                    await key(external ? '\x1b' : 'q', 'return from cleanup');
                    await until(text => selected(text, cleanup), 'cleanup entry restored');
                    await key('q', 'return from history');
                    await until(text => selected(text, history), 'history entry restored');
                } else {
                    await select('Enter choose · Channel:');
                    const versionGroup = '─ ' + t('package.ui.version_options', 'en') + ' ─';
                    await until(text => text.includes(versionGroup), 'version options are separated by a group divider after specifying a prefix');
                    await key('\r', 'open channel choices');
                    await until(text => text.includes('latest') && text.includes('beta') &&
                        selected(text, 'Use installation channel'), 'all available channels and the current value visible');
                    await key('\x1b[F\r', 'select beta');
                    await until(text => selected(text, 'Channel: beta'), 'channel selection restored after choosing beta');
                    await key('\r\x1b[H', 'reopen channel choices and highlight the inherited value');
                    if (external) {
                        resize(64, 18);
                        await until(text => selected(text, 'Use installation channel'), 'channel chooser available at 64×18');
                        capture('compact');
                    }
                    await key(external ? '\x1b' : '\x07', 'cancel the pending channel choice');
                    await until(text => selected(text, 'Channel: beta'), 'cancel preserves beta and restores the channel row');
                    capture('after');
                    if (external) {
                        resize(initialColumns, initialRows);
                        await until(text => selected(text, 'Channel: beta'), 'channel selection retained after resize');
                    }
                }
                await key('q', 'return to the selected Settings row');
                await until(text => selected(text, label), 'settings row restored');
                assert(!records().some(row => ['package_review_start', 'package_execute_start', 'package_cleanup_apply'].includes(row.operation)),
                    'Browsing started a review or requested a package change');
            }
            await until(text=>text.includes('Configure Status Line *'),'unsaved draft retained');
        } else if(action==='live-command'){
            const jobs=()=>{const folder=join(config,'statusline_runtime/sources/jobs');return fs.existsSync(folder)?fs.readdirSync(folder).filter(name=>name.endsWith('.json')).map(name=>JSON.parse(fs.readFileSync(join(folder,name),'utf8'))).filter(job=>job.source_id==='pty-command'):[];};
            await until(()=>jobs().some(job=>job.state==='completed'),'actual runtime lease dispatched the controlled command',25000);
            const observed=jobs();assert.equal(observed.length,1);assert.equal(observed[0].result.summary,'live-session-command');assert.equal(observed[0].result.exit_code,0);assert.equal(typeof observed[0].context.session,'string');
            await key('\x19','show controlled source');await until(text=>text.includes('Controlled active-session command'),'controlled source visible');await key('\r','controlled source actions');await key('\x1b[B'.repeat(7)+'\r','read execution summary');await until(()=>completed('source_inspect'),'saved controlled result read');assert(records().some(row=>row.operation==='source_inspect'&&row.phase==='complete'&&row.source_value==='live-session-command'));capture('after');await key('\x07','return to source library');await key('\x07','return to retained editor');
        } else if(nativeTask){
            const selected = () => {
                read();
                return screen.buffer.map(line => line.map(cell => cell.bold ? cell.data : ' ').join('').trim()).join('\n');
            };
            const clickText = async (text: string) => {
                read();
                for (const [y,row] of screen.buffer.entries()) {
                    const x = row.findIndex((_, i) => row.slice(i,i + text.length).map(cell => cell.data).join('') === text);
                    if (x >= 0) {
                        await key(`\x1b[<0;${x + 1};${y + 1}M\x1b[<0;${x + 1};${y + 1}m`, 'click visible report row ' + text);
                        return;
                    }
                }
                assert.fail('No visible report row contains ' + text);
            };
            await taskInputJourney(config, { key, read, until, selected, capture, clickText,
                reads: () => records().filter(row => row.operation === 'task_details' && row.phase === 'complete').length }, compactTask);
        } else if(action==='colors') {
            await key(external?'\t\t\t':'4','settings');await key('\x1b[H','first setting');
            for(let i=0;i<80&&!/›.*Statusline theme/u.test(read());i++)await key('\x1b[B','find theme');
            await until(text=>/›.*Statusline theme/u.test(text),'theme selected');await key('\r','open color selector');
            await until(text=>text.includes('Colors and gradients'),'color selector visible');
            await key('\x1b[B'.repeat(4)+'\r','preview ocean theme');await until(text=>text.includes('Ocean'),'new theme candidate visible');capture('after');await key('\x07','cancel candidate');
        } else if(action==='scenarios') {
            await key('\x16','warning sample');await until(text=>text.includes('Warning'),'sample identity visible');
            await key('\x17','40-column sample');await until(text=>text.includes('40c'),'sample width visible');capture('after');
        } else if(action==='diagnose-file') {
            await key('\x0c','open file diagnosis');await until(text=>text.includes('Diagnose input file'),'file form visible');
            await key('\r','edit file path');await key(diagnosticPath,'insert explicit input path');await key('\r','accept path');
            await key('\x1b[B'.repeat(4)+'\r','diagnose input only');await until(text=>(external||completed('diagnose_file'))&&text.includes('File diagnosis output')&&text.includes('File-input-model')&&text.includes('Evidence: supplied input only'),'file result visible');capture('after');
            await key('\x07','back to form');await key('\x07','back to retained editor');
        } else if (action === 'editor-shortcuts') {
            const preference = shortcutPath, languageBytes = fs.readFileSync(join(config, 'statusline-ui.json'));
            const settingsPath = join(config, 'settings.json');
            const settingsBytes = fs.readFileSync(settingsPath), settingsMode = fs.statSync(settingsPath).mode;
            assert.ok(legacyShortcuts);
            const { bytes: legacy, mode: preferenceMode } = legacyShortcuts;
            const openNativeSettings = async () => {
                await key('4', 'open native Settings');
                await key('\x1b[F', 'start at last setting');
                for (let i = 0; i < 16 && !/›.*Keyboard shortcuts/u.test(read()); i++) await key('\x1b[A', 'find shortcut setting');
                await until(text => /›.*Keyboard shortcuts/u.test(text), 'native shortcut setting selected');
                await key('\r', 'open native shortcut list');
                await until(text => /›.*Save display/u.test(text), 'native save binding selected');
            };
            type ExternalWait = (label: string, matches?: (text: string, screen: Capture) => boolean) => Promise<string>;
            const runExternal = async (label: string, journey: (
                tty: ReturnType<typeof openPty>, wait: ExternalWait, resize: (width: number, height: number) => void,
            ) => Promise<void>) => {
                const child = openPty(config, 120, 30, environment, 'en', { executable: installed.node, args: [shim, 'configure', '--config-dir', config], cwd: project });
                let capture = new Capture(120, 30);
                let offset = 0;
                const screenText = () => {
                    const bytes = child.captured(); capture.feed(bytes.subarray(offset)); offset = bytes.length;
                    return capture.buffer.map(row => row.map(cell => cell.data).join('')).join('\n');
                };
                try {
                    const resize = (width: number, height: number) => {
                        offset = child.captured().length;
                        capture = new Capture(width, height);
                        child.resize(width, height);
                    };
                    await journey(child, async (value, matches = text => text.includes(value)) => {
                        let frame = '';
                        await child.wait(() => {
                            frame = screenText();
                            return matches(frame, capture);
                        });
                        steps.push({ name: label + ': ' + value, elapsed_ms: Date.now() - start });
                        return frame;
                    }, resize);
                    await child.exited();
                    assert.equal(child.child.exitCode, 0);
                    assert.deepEqual(child.attributes(), child.before);
                } finally {
                    fs.writeFileSync(join(directory, label + '.txt'), screenText());
                    fs.writeFileSync(join(directory, label + '.ansi'), child.captured());
                    await child.close();
                }
            };
            await openNativeSettings();
            await until(text => text.includes('Skipped unavailable or conflicting keys'), 'incompatible legacy shortcuts reported');
            await until(text => text.includes('/ filter') && text.includes('Tab to actions'), 'native shortcut help visible');
            assertShortcutHelp(screen);
            capture('native-shortcut-help');
            await key('/', 'open shortcut filter');
            await key('save display', 'filter shortcut actions');
            await key('\r', 'accept shortcut filter');
            await until(text => text.includes('Filter save display') && /›.*Save display/u.test(text), 'filtered save action remains selected');
            await key('\r', 'capture save binding');
            await until(text => text.includes('New key for Save display') && text.includes('Claude reserves Ctrl+D, Ctrl+X, Ctrl+Z'), 'native recorder shows host restrictions');
            await key('z', 'stage Z for save');
            assert.deepEqual(fs.readFileSync(preference), legacy);
            assert.equal(fs.statSync(preference).mode, preferenceMode);
            await key('\t\r', 'save shortcut changes');
            await until(text => text.includes('Keyboard shortcuts saved'), 'native shortcut save confirmed');
            assert.deepEqual(JSON.parse(fs.readFileSync(preference, 'utf8')).bindings, { close: 'M', save: 'Z', search: 'Y' });
            const backupRoot = join(config, 'backups/statusline');
            const shortcutBackup = fs.readdirSync(backupRoot).find(name => name.includes('editor-shortcuts'));
            assert.ok(shortcutBackup);
            assert.deepEqual(fs.readFileSync(join(backupRoot, shortcutBackup, EDITOR_SHORTCUTS_FILENAME + '.before')), legacy);
            assert.deepEqual(fs.readFileSync(displayPath), before);
            assert.equal(fs.statSync(displayPath).mode, beforeMode);
            capture('native-custom');
            await key('\x071', 'return to main editor');
            await until(text => /\bZ +save\b/u.test(text), 'native footer shows Z');
            await key('y', 'use remapped native search');
            await key('z', 'type the bound save key in search');
            const filterLabel = t('native.ui.client.draw.filter', language);
            const inverse = (normal: Cell) => {
                const [foreground, background] = cellColors(normal);
                return (cell: Cell) => {
                    const [fg, bg] = cellColors(cell);
                    return foreground !== background && bg === foreground && (cell.data === ' ' || fg === background);
                };
            };
            await until(() => screen.buffer.some(row => {
                const filter = cellColumn(row, filterLabel + 'z');
                const x = filter + displayWidth(filterLabel);
                return filter >= 0 && showsInputCaret(row, x, 'z', 'z', inverse(row[x]!));
            }), 'native search treats Z as input with a caret on the trailing blank');
            const y = screen.buffer.findIndex(row => cellColumn(row, filterLabel + 'z') >= 0);
            const x = cellColumn(screen.buffer[y]!, filterLabel) + displayWidth(filterLabel);
            const marked = inverse(screen.buffer[y]![x]!);
            await key('\x1b[D', 'move the native caret to the first letter');
            await until(() => showsInputCaret(screen.buffer[y]!, x, 'z', '', marked), 'native caret overlays Z without moving it');
            await key('a', 'insert before the native caret');
            await until(() => showsInputCaret(screen.buffer[y]!, x, 'az', 'a', marked), 'native insertion keeps both letters adjacent and marks Z');
            capture('native-search-caret');
            await key('\x1b[F', 'move the native caret to the end');
            await until(() => showsInputCaret(screen.buffer[y]!, x, 'az', 'az', marked), 'native caret moves to the blank after the same letters');
            capture('native-search-caret-end');
            assert.equal(records().filter(row => row.operation === 'apply').length, 0);
            await key('\x07', 'cancel native search');
            await key('s', 'try previous native save key');
            assert.equal(records().filter(row => row.operation === 'apply').length, 0);
            await key('z', 'use new native save key');
            await until(() => completed('apply'), 'native saves through Z');
            assert.deepEqual(fs.readFileSync(displayPath), before, 'Clean native save changed the display');

            const customSave = 'Z ' + t('ui.hints.save_and_exit', 'en');
            const customClose = 'M/Esc ' + t('ui.hints.close', 'en');
            const toggleHint = 'Enter/Space ' + t('ui.hints.toggle', 'en');
            const appliesBeforeCustom = applyRequests();
            await runExternal('terminal-custom', async (tty, wait) => {
                await wait(customSave);
                await wait('Y search');
                await wait(customClose);
                tty.send('yz');
                await wait('terminal search treats Z as input with a caret on the trailing blank', (_text, screen) =>
                    showsInputCaret(screen.buffer[3]!, 0, 'z', 'z', cell => cell.reverse));
                assert.deepEqual(fs.readFileSync(displayPath), before);
                tty.send('\x1b');
                await wait(toggleHint);
                tty.send('\r');
                await wait('Configure Status Line *');
                await wait('› [ ]');
                tty.send('\x1b');
                await wait('› ' + t('ui.exit.keep', 'en'));
                tty.send('\r');
                await wait('Configure Status Line *');
                tty.send('\x13');
                await delay(350);
                assert.equal(tty.child.exitCode, null);
                assert.equal(applyRequests(), appliesBeforeCustom);
                assert.deepEqual(fs.readFileSync(displayPath), before);
                assert.equal(fs.statSync(displayPath).mode, beforeMode);
                tty.send('z');
            });
            assert.equal(applyRequests(), appliesBeforeCustom + 1);
            assert.equal(JSON.parse(fs.readFileSync(displayPath, 'utf8')).instances[0].enabled, false);
            const savedDisplay = fs.readFileSync(displayPath);
            const savedMode = fs.statSync(displayPath).mode;
            await runExternal('terminal-escape', async (tty, wait) => {
                await wait(customClose);
                tty.send('\x1b');
            });
            await runExternal('terminal-restore', async (tty, wait, resize) => {
                await wait(customSave);
                tty.send('\t\t\t\x1b[F\r');
                await wait('/ filter');
                const help = new Capture(120, 30);
                help.feed(tty.captured());
                assertShortcutHelp(help);
                resize(32, 12);
                await wait('save row and two column headings survive a resize to 32×12', text =>
                    /OPTION +VALUE/u.test(text) && /› Save display +Z/u.test(text) &&
                    ['[Save]', '[Defaults]', '[Reload]', 'Tab to actions'].every(value => text.includes(value)));
                tty.send('\t\x1b[C');
                await wait('compact Restore defaults button has focus', text => text.includes('›[Defaults]') && text.includes('Tab to list'));
                resize(120, 30);
                await wait('button focus and three column headings survive widening', text =>
                    /OPTION +CURRENT KEY +DEFAULT KEY/u.test(text) && text.includes('›[Restore all defaults]') && text.includes('Tab to list'));
                tty.send('\r\x1b[A\r');
                await wait('Keyboard shortcuts saved');
                assert.equal(fs.existsSync(preference), false);
                tty.send('\x07\x1b');
            });
            await openNativeSettings();
            await key('\t\x1b[B\x1b[B\r', 'read saved defaults in the open native pane');
            await until(text => text.includes('Read the saved shortcuts'), 'native loaded restored defaults');
            await key('\x071', 'restore normal editor focus');
            await until(text => /\bS +save\b/u.test(text) && !/\bZ +save\b/u.test(text), 'native shows the preset save key');
            assert.deepEqual(fs.readFileSync(displayPath), savedDisplay);
            assert.equal(fs.statSync(displayPath).mode, savedMode);
            capture('after');

            const appliesBeforeDefault = applyRequests();
            await runExternal('terminal-default', async (tty, wait) => {
                await wait('Ctrl+S ' + t('ui.hints.save_and_exit', 'en'));
                await wait(toggleHint);
                await wait('› [ ]');
                tty.send('\r');
                await wait('Configure Status Line *');
                await wait('› [x]');
                tty.send('\x14');
                await wait(t('history.counts', 'en', { undo: 1, redo: 0 }));
                tty.send('q');
                await wait(toggleHint);
                assert.equal(applyRequests(), appliesBeforeDefault);
                assert.deepEqual(fs.readFileSync(displayPath), savedDisplay);
                assert.equal(fs.statSync(displayPath).mode, savedMode);
                tty.send('\x13');
            });
            assert.equal(applyRequests(), appliesBeforeDefault + 1);
            const expected = JSON.parse(savedDisplay.toString('utf8')) as Draft['display'];
            expected.instances[0]!.enabled = true;
            const committedDisplay = fs.readFileSync(displayPath);
            assert.deepEqual(JSON.parse(committedDisplay.toString('utf8')), expected);
            await runExternal('terminal-default-reopened', async (tty, wait) => {
                await wait(toggleHint);
                await wait('› [x]');
                tty.send('\x1b');
            });
            assert.deepEqual(fs.readFileSync(displayPath), committedDisplay);
            assert.equal(applyRequests(), appliesBeforeDefault + 1);
            assert.deepEqual(fs.readFileSync(settingsPath), settingsBytes);
            assert.equal(fs.statSync(settingsPath).mode, settingsMode);

            const expectedSettings = JSON.parse(settingsBytes.toString('utf8'));
            const previousRefresh = String(expectedSettings.statusLine.refreshInterval ?? 'event');
            const refreshSeconds = previousRefresh === '37' ? '42' : '37';
            const refreshLabel = t('settings.refresh_interval', 'en');
            const refreshRow = '› ' + refreshLabel + ':';
            const enterEdit = 'Enter ' + t('ui.hints.edit', 'en');
            const enterAccept = 'Enter ' + t('ui.hints.accept', 'en');
            const selectRefresh = async (tty: ReturnType<typeof openPty>, wait: ExternalWait) => {
                const selected = (screen: string) => /^│ › (.*?)(?::|…)/mu.exec(screen)?.[1];
                tty.send('\t\t\t\x1b[H');
                let frame = await wait('› ' + t('settings.colors', 'en') + ':');
                for (let i = 0; i < 32 && selected(frame) !== refreshLabel; i++) {
                    const previous = selected(frame);
                    assert.ok(previous, 'Settings has no selected field');
                    tty.send('\x1b[B');
                    frame = await wait('advance from ' + previous, text => !!selected(text) && selected(text) !== previous);
                }
                await wait(refreshRow);
            };
            const waitForRefresh = (wait: ExternalWait, value: string, editing = false) => wait(
                refreshLabel + ' = ' + value + (editing ? ' (editing)' : ''), (_text, screen) => screen.buffer.some(row => {
                    const label = cellColumn(row, refreshRow);
                    if (label < 0) return false;
                    const afterLabel = label + displayWidth(refreshRow);
                    const start = row.findIndex((cell, column) => column >= afterLabel && cell.data !== ' ');
                    if (start < 0 || row.slice(start).map(cell => cell.data).join('').split('│')[0]?.trim() !== value) return false;
                    return editing ? showsInputCaret(row, start, value, value, cell => !cell.reverse)
                        : row[start + displayWidth(value)]?.reverse === true;
                }));
            const appliesBeforeSettings = applyRequests(), committedDisplayMode = fs.statSync(displayPath).mode;
            const assertRefreshReadOnly = () => {
                assert.equal(applyRequests(), appliesBeforeSettings);
                assert.deepEqual(fs.readFileSync(settingsPath), settingsBytes);
                assert.equal(fs.statSync(settingsPath).mode, settingsMode);
                assert.deepEqual(fs.readFileSync(displayPath), committedDisplay);
                assert.equal(fs.statSync(displayPath).mode, committedDisplayMode);
            };
            await runExternal('terminal-refresh', async (tty, wait) => {
                await selectRefresh(tty, wait);
                await wait('E ' + t('shortcuts.action.event-refresh', 'en'));
                await wait(enterEdit);
                tty.send('\r');
                await waitForRefresh(wait, previousRefresh, true);
                await wait(enterAccept);
                tty.send('\x153601\r');
                await waitForRefresh(wait, '3601', true);
                await wait(t('native.numeric.event', 'en', { minimum: 1, maximum: 3600 }));
                assertRefreshReadOnly();
                tty.send('\x07');
                await waitForRefresh(wait, previousRefresh);
                await wait(enterEdit);

                const acceptRefresh = async (value: string) => {
                    tty.send('\r');
                    await wait(enterAccept);
                    tty.send('\x15' + value);
                    await waitForRefresh(wait, value, true);
                    tty.send('\r');
                    await waitForRefresh(wait, value);
                    await wait(enterEdit);
                    assertRefreshReadOnly();
                };
                await acceptRefresh(refreshSeconds);
                tty.send('e');
                await waitForRefresh(wait, 'event');
                assertRefreshReadOnly();
                await acceptRefresh(refreshSeconds);
                await acceptRefresh('event');
                await acceptRefresh(refreshSeconds);
                await wait('Ctrl+S ' + t('ui.hints.save_and_exit', 'en'));
                tty.send('\x13');
            });
            assert.equal(applyRequests(), appliesBeforeSettings + 1);
            expectedSettings.statusLine.refreshInterval = Number(refreshSeconds);
            const savedSettings = fs.readFileSync(settingsPath), savedSettingsMode = fs.statSync(settingsPath).mode;
            assert.deepEqual(JSON.parse(savedSettings.toString('utf8')), expectedSettings);
            await runExternal('terminal-refresh-reopened', async (tty, wait) => {
                await selectRefresh(tty, wait);
                await waitForRefresh(wait, refreshSeconds);
                tty.send('\x1b');
            });
            assert.equal(applyRequests(), appliesBeforeSettings + 1);
            assert.deepEqual(fs.readFileSync(settingsPath), savedSettings);
            assert.equal(fs.statSync(settingsPath).mode, savedSettingsMode);
            assert.deepEqual(fs.readFileSync(displayPath), committedDisplay);
            assert.equal(fs.statSync(displayPath).mode, committedDisplayMode);
            assert.deepEqual(fs.readFileSync(join(config, 'statusline-ui.json')), languageBytes);

            const labelPresets = ['inherit', 'legacy', 'short', 'off'];
            const formatted = JSON.parse(committedDisplay.toString('utf8')) as Draft['display'];
            const item = formatted.instances[0]!.options;
            const preset = labelPresets[(labelPresets.indexOf(item.formatting.labels ?? 'inherit') + 1) % labelPresets.length]!;
            const customLabel = 'PTY custom label';
            await runExternal('terminal-item-format', async (tty, wait) => {
                await wait(toggleHint);
                tty.send('\x05');
                const form = await wait('› Custom label:');
                const fields = ['Label preset:', 'Custom label:', 'Icon preset:', 'Custom icon:'];
                const indexes = fields.map(field => form.indexOf(field));
                assert.ok(indexes.every((position, index) => position > (indexes[index - 1] ?? -1)));
                tty.send('\x1b[A\x1b[C');
                await wait('←→/Enter switch preset');
                tty.send('\x1b[B\r\x15' + customLabel + '\r');
                await wait('custom label in sample preview', text => text.slice(text.lastIndexOf('Preview (sample data)')).includes(customLabel));
                assert.deepEqual(fs.readFileSync(displayPath), committedDisplay);
                tty.send('\x13');
            });
            item.label = customLabel;
            if (preset === 'inherit') delete item.formatting.labels;
            else item.formatting.labels = preset;
            assert.deepEqual(JSON.parse(fs.readFileSync(displayPath, 'utf8')), formatted);
            await runExternal('terminal-item-format-reopened', async (tty, wait) => {
                await wait(toggleHint);
                tty.send('\x05');
                await wait('saved custom label and preset visible', text => text.split('\n').some(line => line.includes('Custom label:') && line.includes(customLabel)) &&
                    text.split('\n').some(line => line.includes('Label preset:') && line.includes(preset)));
                tty.send('\x07');
                await wait(toggleHint);
                tty.send('\x1b');
            });
            assert.deepEqual(fs.readFileSync(settingsPath), savedSettings);
        } else if (action === 'shortcut-preset') {
            await key('4', 'open native Settings');
            await key('\x1b[F', 'start at the last setting');
            const selected = (text: string) => text.split('\n').some(line => /›.*Expand selected preset/u.test(line));
            for (let i = 0; i < 16 && !selected(read()); i++) await key('\x1b[A', 'find the preset action');
            await until(selected, 'native preset action selected');
            await key('\r', 'expand the selected preset into the draft');
            const notice = t('shortcuts.native-preset-applied', 'en', { save: 'Q', close: 'Z' });
            await until(text => text.includes(notice) && text.includes('Configure Status Line *') && completed('preset'), 'dirty preset shows Q to save and Z to discard');
            assert.equal(applyRequests(), 0);
            capture('remapped-preset');
        } else if (action === 'quick') {
            await key('\x10', 'quick setup'); await until(text => text.includes(t('quick.title', 'en')) && text.includes(t('quick.scenario', 'en')), 'quick setup visible');
            await key('\r', 'choose scenario'); await until(text => /appearance/iu.test(text), 'candidate appearance visible'); capture('after');
            await key(external ? '\x1b' : '\x07', 'cancel quick setup');
        } else if (action === 'import') {
            await key(external ? '\t\t\t' : '4', 'settings'); await key('\x1b[F', 'last setting');
            for (let i = 0; i < 8 && !/›.*Import file/u.test(read()); i++) await key('\x1b[A', 'find import setting');
            await until(text => /›.*Import file/u.test(text), 'import field selected');
            await key('\r', 'edit import path'); await key('\x15', 'clear path'); await key(importPath, 'insert literal path'); await key('\r', 'review import');
            await until(text => /no (changes|differences)/iu.test(text), 'identical import review visible'); capture('after');
            await key('\x07', 'cancel import');
        } else if (action === 'profiles' || action === 'profile-actions') {
            await key('\x0f', 'profile library'); await until(text => text.includes('Capacity profile 0'), 'profile list visible');
            if (action === 'profile-actions') { await key('\x1b[B', 'select profile'); await key('\r', 'profile actions'); await until(text => text.includes('Edit') || text.includes('Activate'), 'profile actions visible'); }
            capture('after');
            await key(external ? '\x1b' : '\x07', 'cancel profile page');
            if (action === 'profile-actions') await key(external ? '\x1b' : '\x07', 'cancel library');
        } else if (['sources','source-review','source-inspect','source-bindings'].includes(action)) {
            await key('\x19', 'source library'); await until(text => text.includes('Local sample 0'), 'source list visible');
            if (action === 'source-review') { await key('\r', 'source actions'); await key('\x1b[B', 'select review'); await key('\r', 'review disabled command'); await until(text => completed('source_review') && text.includes('Review all fields'), 'source review completed'); }
            if(action==='source-inspect'){await key('\r','source actions');await key('\x1b[B'.repeat(6)+'\r','inspect saved source');await until(text=>external?text.includes('Last success:'):completed('source_inspect'),'readable source inspection');}
            if(action==='source-bindings'){await key('\x1b[B'.repeat((data.sources?.library?.sources.length??0)+1)+'\r','binding inventory');await until(text=>external?text.includes(t('sources.bindings_help','en')):completed('source_bindings_review'),'bindings read completed');}
            capture('after'); await key('\x07', 'cancel source page');
            if (['source-review','source-inspect','source-bindings'].includes(action)) await key('\x07', 'cancel source library');
        } else if (action === 'save') {
            for (let i = 0; i < 14; i++) await key('d', 'copy ' + (i + 1));
            await key('s', 'save 24 instances'); await until(text => completed('apply') && /saved/iu.test(text), 'save outcome visible');
            assert.equal(JSON.parse(fs.readFileSync(join(config, 'claude-statusline.json'), 'utf8')).instances.length, 24);
            assert.equal(records().filter(row => row.operation === 'apply' && row.phase === 'request').length, 1); capture('after');
        } else if (action === 'explain') {
            await key('\x05', 'item format'); await key('\x1b[H', 'explanation setting'); await key('\r', 'open explanation');
            await until(text => text.includes('Configuration and sample explanation') && completed('explain'), 'explanation result visible'); capture('after');
            await key('\x07', 'back from explanation'); await key('\x07', 'back from format');
        } else if (itemDetails) {
            const explanation = t('explain.title', language), guidance = t('guidance.title', language);
            const scenario = t('preview.scenario.warning', language);
            const configuration = t('explain.configuration', language);
            const overview = t('guidance.overview', language);
            const currentSample = t('explain.sample_result', language, { scenario, width: 40 });
            const format = t(external ? 'ui.drawing.item_format_2' : 'native.ui.client.draw.item_format', language).trim();
            const selected = (text: string, label: string) => text.split('\n').some(line => line.includes('›') && line.includes(label));
            const selectedFormat = (text: string, actionLabel: string) =>
                text.includes(format) && text.includes(detailLabel) && selected(text, actionLabel);

            const inspectReport = async (label: string, title: string, evidence: readonly (readonly [string, boolean])[]) => {
                const first = reportRange(read());
                assert(first && first.start === 1 && first.end < first.total, title + ' must start in a scrollable report');
                const capacity = first.end, lastStart = first.total - capacity + 1;
                const waitForStart = (start: number, step: string) => until(text => {
                    const range = reportRange(text);
                    return text.includes(title) && range?.start === start && range.total === first.total &&
                        range.end === Math.min(first.total, start + capacity - 1);
                }, step);
                const remaining = new Set(evidence);
                for (let start = 1; ; start = Math.min(lastStart, start + capacity)) {
                    for (const expected of remaining)
                        if (showsText(screen, ...expected)) remaining.delete(expected);
                    capture(label + '-' + start);
                    if (start === lastStart) break;
                    await key('\x1b[6~', 'page down in ' + title);
                    await waitForStart(Math.min(lastStart, start + capacity), 'next report page');
                }
                assert.deepEqual([...remaining], [], title + ' text or emphasis is missing');
                await key('\x1b[H', 'return to the start of ' + title);
                await waitForStart(1, 'Home reached the first row');
                await key('\x1b[F', 'jump to the end of ' + title);
                await waitForStart(lastStart, 'End reached the last row');
                await key('\x1b[A', 'scroll up one row from the end');
                await waitForStart(lastStart - 1, 'Up moved one row from End');
                await key('\x1b[5~', 'page up in ' + title);
                await waitForStart(Math.max(1, lastStart - 1 - capacity), 'Page Up moved by the visible row count');
            };

            await key('\x16', 'select the warning sample');
            await until(text => text.includes(scenario), 'warning sample identity visible');
            await key('\x17', 'choose the 40-column sample');
            await until(text => text.includes('40c') && text.includes(detailPreview), 'formatted production sample visible');
            await key('\x05', 'open the selected item format');
            await key('\x1b[H', 'select the explanation action');
            await until(text => selectedFormat(text, explanation), 'explanation selected in the item format');
            await key('\r', 'open configuration and sample explanation');
            await until(text => text.includes(explanation) && completed('explain') && showsText(screen, configuration, true),
                'read-only explanation result visible');
            assert.ok(read().includes(detailPreview), 'The configured sample preview must remain visible beside the reference example');
            await inspectReport('explanation', explanation, [
                [t('explain.examples', language), true], ['claude-opus high', false],
                [configuration, true], [t('explain.reason.configured_on', language), false],
                [currentSample, true], [t('explain.row.main', language), true], [t('explain.reason.sample_visible', language), false],
                [t('explain.requirements', language), true],
            ]);
            await key('\x07', 'return from the explanation');
            await until(text => selectedFormat(text, explanation), 'the explanation action regained selection');

            await key('\x1b[B', 'select the sources action');
            await until(text => selectedFormat(text, guidance), 'sources selected in the item format');
            await key('\r', 'open sources and requirements');
            await until(text => text.includes(guidance) && showsText(screen, overview, true), 'sources and the source overview visible');
            await inspectReport('guidance', guidance, [
                [overview, true], [t('guidance.sources.official_input', language), false],
                [t('guidance.requirements', language), true], [t('guidance.details', language), true],
                ['model.id', false], ['effort.level', false], ['claude-statusline doctor', false],
            ]);
            if (external) {
                await key('\x1b[F', 'go to the end before reducing the viewport');
                await until(text => {
                    const range = reportRange(text);
                    return range !== null && range.start > 1 && range.end === range.total;
                }, 'source report scrolled before resize');
                columns = 64; rows = 18; offset = p.captured().length;
                screen = new Capture(columns, rows); p.resize(columns, rows);
                await until(text => text.includes(guidance) && (reportRange(text)?.start ?? 0) > 1,
                    'compact source report kept its reading position');
                capture('guidance-compact');
                await key('\x1b[H', 'go to the start in the compact report');
                await until(text => reportRange(text)?.start === 1 && showsText(screen, overview, true),
                    'source overview visible again at 64×18');
            }
            await key('\x07', 'return from sources');
            await until(text => selectedFormat(text, guidance), 'the sources action regained selection');
            await key('\x07', 'return to the selected component');
            await until(text => text.includes(t('composition.configured_title', language)) && selected(text, detailLabel),
                'the original component regained selection');
            capture('after');
        } else if (action === 'tall') {
            await key('d', 'unsaved copy before resize'); capture('after');
            rows = 50; offset = p.captured().length; screen = new Capture(columns, rows); p.resize(columns, rows);
            await until(text => text.includes('Configure Status Line *') && text.includes('Preview'), 'draft retained after safe resize'); capture('resized');
        } else { await key('2', 'subagent page'); await key('1', 'main page'); capture('after'); }
        if (external) {
            if (!pickerSave) p.send('\x1b');
            if (pickerDiscard || ['version-status', 'package-cleanup', 'external-task'].includes(action)) {
                await until(text => text.includes(t('ui.exit.unsaved','en')) && text.includes('› ' + t('ui.exit.keep','en')), 'keep dirty draft selected');
                await key('\x1b[B\r', 'confirm discard');
            }
            await p.exited(); assert.equal(p.child.exitCode, 0); assert.deepEqual(p.attributes(), p.before);
        }
        else if (!nativeTask && !header) {
            await key(action === 'shortcut-preset' ? 'z' : 'q', 'close without another save');
            await until(text => !text.includes(title), 'pane closed');
        }
        if (action === 'shortcut-preset') assert.equal(applyRequests(), 0, 'Discarding the native preset requested a configuration save');
        if (action !== 'save' && action !== 'editor-shortcuts' && !pickerSave) {
            assert.deepEqual(fs.readFileSync(displayPath), before, 'Cancelled journey changed display configuration');
            if (pickerDiscard || header || action === 'shortcut-preset' || itemDetails) assert.equal(fs.statSync(displayPath).mode, beforeMode, 'Cancelled journey changed display file mode');
        }
        assert(!records().some(row => row.operation === 'source_refresh'), 'A disabled source was executed');
        if (itemDetails) {
            assert(!records().some(row => ['apply', 'sources_apply'].includes(row.operation)), 'Reading item details requested a configuration change');
            for (const preference of preferences) {
                assert.deepEqual(fs.readFileSync(preference.path), preference.bytes, preference.path + ' bytes changed while reading item details');
                assert.equal(fs.statSync(preference.path).mode, preference.mode, preference.path + ' mode changed while reading item details');
            }
            steps.push({ name: 'display, settings and UI preference bytes and modes preserved', elapsed_ms: Date.now() - start });
        }
        status = 'pass';
    } catch (failure) { error = String(failure); capture('failure'); }
    finally {
        fs.writeFileSync(join(directory, 'terminal.ansi'), p.captured());
        fs.copyFileSync(join(config, 'backend.jsonl'), join(directory, 'backend.jsonl'));
        try { process.kill(-p.child.pid!, 'SIGTERM'); } catch { /* Already ended. */ }
        await delay(100); try { process.kill(-p.child.pid!, 'SIGKILL'); } catch { /* Already ended. */ }
        await p.close();
        const report = { name, status, error, external, host: version!.join('.'), terminal_columns: initialColumns, initial_rows: initialRows, language, body_columns: bodyColumns,
            model_calls: 0, source_commands: action==='live-command'?1:0, source_commit: artifact.source.commit, tarball_sha256: artifact.sha256, display_before_sha256: sha256(before),
            display_after_sha256: sha256(fs.readFileSync(join(config, 'claude-statusline.json'))), steps };
        record(join(directory, 'result.json'), report); reports.push(report); console.log(JSON.stringify({ name, status, error }));
    }
}
const expectedJourneys = values['editor-shortcuts'] ? 2 : values['header-controls'] ? 3 :
    values['component-picker'] || values['version-installation'] || values['item-details'] ? 4 : 43;
try {
    const request = join(installed.temporary, 'prepare.json'), driver = join(installed.temporary, 'prepare-host.mjs');
    record(request, { host, version, launch: { executable: installed.node, args: [shim] } });
    fs.copyFileSync(fileURLToPath(new URL('../migration/ts-04/test/installed-driver.js', import.meta.url)), driver);
    command(installed.node, [driver, installed.modules, 'prepare-host', template, join(installed.temporary, 'prepared.json'), request], { ...env, CLAUDE_CONFIG_DIR: template });
    if (values['editor-shortcuts']) {
        await runCase('editor-shortcuts', 'plain-main-w72', 'editor-shortcuts');
        await runCase('native-remapped-preset', 'plain-main-w72', 'shortcut-preset');
    } else if (values['header-controls']) {
        for (const language of ['de', 'pt-BR', 'en'] as const)
            await runCase('native-header-' + language, 'plain-main-w72', 'header-controls', false, language);
    } else if (values['component-picker']) {
        for (const external of [false, true]) for (const action of ['picker-save', 'picker-discard']) {
            await runCase((external ? 'external-' : 'native-') + action, 'plain-main-w72', action, external);
        }
    } else if (values['version-installation']) {
        for (const external of [false, true]) for (const action of ['version-status', 'package-cleanup']) {
            await runCase((external ? 'external-' : 'native-') + action, 'plain-main-w72', action, external);
        }
    } else if (values['item-details']) {
        for (const external of [false, true]) for (const language of ['en', 'zh-CN'] as const)
            await runCase((external ? 'external' : 'native') + '-item-details-' + language, 'plain-main-w72', 'item-details', external, language);
    } else {
    for (const [name, fixture, action] of [
        ['quick-opening','plain-main-w72','quick'], ['import-identical','plain-main-w72','import'],
        ['profiles-two','profiles-list-2','profiles'], ['profiles-select-one','profiles-list-1','profile-actions'],
        ['sources-thirty','sources-list-30','sources'], ['source-review-command','sources-list-command-arg-4096','source-review'],
        ['disabled-main-extra-16','disabled-main-extra-16','pages'], ['save-after-copies','plain-main-w72','save'],
        ['background-gradient-2','background-gradient-2','pages'], ['agent-gradient-all','agent-gradient-all','pages'],
        ['gradient-text-128','gradient-text-128','pages'], ['tall-minimal','minimal-main','tall'],
        ['foreground-gradients','import-four-gradients','pages'], ['explanation','plain-main-w72','explain'],
        ['native-version-status','plain-main-w72','version-status'],['native-task-viewer','plain-main-w72','native-task'],['native-task-docked','plain-main-w72','native-task'],
        ['theme-selector','plain-main-w72','colors'],['sample-scenarios','plain-main-w72','scenarios'],['input-file-diagnosis','plain-main-w72','diagnose-file'],
    ]) await runCase(name!, fixture!, action!);
    for (const [name, fixture, action] of [['external-quick','plain-main-w72','quick'], ['external-profiles','profiles-list-2','profiles'], ['external-import','plain-main-w72','import'],['external-colors','plain-main-w72','colors'],['external-scenarios','plain-main-w72','scenarios'],['external-file-diagnosis','plain-main-w72','diagnose-file'],['external-version-status','plain-main-w72','version-status'],['external-task-viewer','plain-main-w72','external-task']]) await runCase(name!, fixture!, action!, true);
    for(const external of [false,true])for(const [name,fixture,action]of [['source-summary','sources-list-30','source-inspect'],['source-bindings','sources-list-30','source-bindings'],['package-cleanup','plain-main-w72','package-cleanup']])await runCase((external?'external-':'native-')+name!,fixture!,action!,external);
    for(const external of [false,true])for(const [name,fixture,action]of [['draft-history','plain-main-w72','draft-history'],['style-reuse','plain-main-w72','style-reuse'],['group-reuse','draft-reuse-groups-review-w196','group-reuse'],['alignment-repair','draft-reuse-groups-review-w196','alignment-repair']])await runCase((external?'external-':'native-')+name!,fixture!,action!,external);
    await runCase('native-live-command','plain-main-w72','live-command');
    }
    assert.equal(reports.length, expectedJourneys);
    assert(reports.every(report => report.status === 'pass'), 'Native or external PTY journey failed');
} catch (error) { console.error(String(error)); process.exitCode = 1; }
finally {
    record(join(output, 'report.json'), { status: reports.length === expectedJourneys && reports.every(row => row.status === 'pass') ? 'pass' : 'fail', commit: artifact.source.commit, tarball_sha256: artifact.sha256,
        platform: process.platform, arch: process.arch, os: release(), host: version?.join('.'), model_calls: 0, physical_visual_acceptance: false, journeys: reports });
    installed.cleanup();
}
