import * as fs from 'node:fs';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const [modules, operation, config, receipt, choice] = process.argv.slice(2);
const load = (name: string, path: string) => import(pathToFileURL(join(modules!, 'statusline-' + name, 'dist/src', path + '.js')).href);
if (operation === 'joint-display') {
    const { defaultItem } = await load('core', 'config/display');
    const { LANGUAGES } = await load('core', 'i18n/registry');
    const { editAlignment } = await load('core', 'editor/alignments');
    const { previewRows, samplePreviewData } = await load('core', 'rendering/preview');
    const { configuredRows } = await load('core', 'rendering/items');
    const { displayWidth, strip, styledUnits } = await load('core', 'rendering/layout');
    const { presentation, baseEnvironment } = await load('cli', 'rendering/environment');
    const { ConfigurationService } = await load('cli', 'config/service');
    const service = new ConfigurationService({ configDir: config, launch: { executable: process.execPath, args: [join(modules!, 'statusline-cli/dist/src/entry.js')] }, hostVersion: () => null });
    const sampleHome = '/test/中文/é/👩🏽‍💻', widths = [40,80,120];
    for (const language of LANGUAGES) {
        const current = service.read(); let d = current.display;
        d.instances = ['text','context-used','current-dir','context-used'].map((type_id, index) => ({ id: 'joint-' + index, type_id, enabled: true, text: type_id === 'text' ? '中文 日本語 한글 é 👩🏽‍💻' : null,
            options: { ...defaultItem(), foreground_gradient: ['#22d3ee','#3b82f6'], background_gradient: ['#112233','#445566'], ...(type_id === 'current-dir' ? {link:'on'} : {}) } }));
        d.groups = []; d.layout = { mode: 'explicit', rows: [['joint-0','joint-1'],['joint-2','joint-3']] };
        d.use_colors = true; d.scope_labels = 'off'; d.separator_style = 'powerline'; d.directory_style = 'basename'; d.statusline_language = language;
        d = editAlignment(d, 'joint', [[{kind:'instance',id:'joint-0'},{kind:'instance',id:'joint-2'}],[{kind:'instance',id:'joint-1'},{kind:'instance',id:'joint-3'}]]);
        service.apply({display:d,host:current.host},current.revision);
        const reopened = service.read().display; assert.deepEqual(reopened,d);
        const environment = baseEnvironment(await presentation(language), {home:sampleHome}), payload = samplePreviewData(sampleHome);
        for (const width of widths) {
            const actual = configuredRows(payload,reopened,width,environment);
            assert.deepEqual(previewRows(reopened,width,environment,sampleHome),actual);
            assert(actual.length > 0 && actual.every((row:string)=>displayWidth(row)<=width));
            if (width === 120) {
                assert(actual.map(strip).join('\n').includes('中文 日本語 한글 é 👩🏽‍💻'));
                assert(actual.flatMap(styledUnits).some((unit:any)=>unit.link));
            }
        }
    }
    fs.writeFileSync(receipt!,JSON.stringify({languages:LANGUAGES,widths,cases:LANGUAGES.length*widths.length,installed_modules:true,saved_reopened:true,preview_matches:true}));
}
else if (operation === 'modules') {
    const [core, platform, clocks, tui] = await Promise.all([load('core', 'integration/binding'), load('platform', 'launch'), load('platform', 'clocks'), load('tui', 'session')]);
    const sample = clocks.sample();
    fs.writeFileSync(receipt!, JSON.stringify({ same_binding: core.binding === platform.binding, literal_argv: core.binding({ backendExecutable: process.execPath, backendArgs: '["中文 & $`/entry.js"]' }).args, clock_available: !!sample.boot_id && typeof sample.boot_ns === 'bigint' && sample.boot_ns > 0n, tui: typeof tui.Session === 'function' }));
}
else if (operation === 'crash') {
    const { observeTransactions } = await load('cli', 'recovery/journal');
    const { ConfigurationService } = await load('cli', 'config/service');
    const service = new ConfigurationService({ configDir: config, launch: { executable: process.execPath, args: [join(modules!, 'statusline-cli/dist/src/entry.js')] }, hostVersion: () => null });
    const before = service.read();
    before.display.use_colors = !before.display.use_colors;
    before.host.padding = 3;
    observeTransactions((stage: string) => { if (stage === 'applied:0')
        process.kill(process.pid, 'SIGKILL'); });
    service.apply({ display: before.display, host: before.host }, before.revision);
}
else if (operation === 'official' || operation === 'prepare-host') {
    const { PROTOCOL_VERSION } = await load('core', 'contracts/ui');
    const { installContext, install, uninstall } = await load('cli', 'integration/install');
    const { doctor } = await load('cli', 'integration/doctor');
    const { NATIVE, RUNTIME } = await load('cli', 'integration/model');
    const { PluginHost } = await load('platform', 'plugin-host');
    const { pending } = await load('cli', 'recovery/journal');
    const { spawnSync } = await import('node:child_process');
    const request = JSON.parse(fs.readFileSync(choice!, 'utf8')), host = new PluginHost(config, request.host);
    const entry = join(modules!, 'statusline-cli/dist/src/entry.js'), launch = request.launch ?? { executable: process.execPath, args: [entry] };
    fs.mkdirSync(config!, { recursive: true, mode: 0o700 });
    fs.writeFileSync(join(config!, 'settings.json'), '{"env":{"KEEP":"yes"}}\n', { mode: 0o600 });
    const context = installContext(config, launch, request.version, undefined, () => host);
    const first = install(context, { native: true, external: true, nativeTiming: request.version[2] >= 289, liveMetrics: false });
    if (first.failed) {
        const observed: Record<string, unknown> = {};
        try { observed.inventory = host.listing(); } catch (error) { observed.inventory_error = String(error); }
        try { observed.binding = host.run(['configure', NATIVE.plugin, '--json'], undefined, true); } catch (error) { observed.binding_error = String(error); }
        const journals = pending(config).map((path: string) => {
            const row = JSON.parse(fs.readFileSync(path, 'utf8'));
            return { action: row.action, kind: row.kind, phase: row.phase, args: row.args, values: row.values };
        });
        const failure = { messages: first.messages, journals, observed };
        fs.writeFileSync(receipt!, JSON.stringify({ failed: true, ...failure }));
        throw new Error(JSON.stringify(failure));
    }
    if (operation === 'prepare-host') {
        fs.writeFileSync(receipt!, JSON.stringify({ installed: true }));
    }
    else {
        const repeat = install(context);
        if (repeat.failed || repeat.changed)
            throw new Error('Official installed repeat is not idempotent');
        const diagnostics = doctor(context);
        if (diagnostics.some((row: any) => row.level === 'ERROR'))
            throw new Error(JSON.stringify(diagnostics));
        const specs = request.version[2] >= 289 ? [NATIVE, RUNTIME] : [NATIVE];
        for (const spec of specs) {
            const options = host.run(['configure', spec.plugin, '--json'], undefined, true) as any;
            if (options.inputs.backendExecutable !== process.execPath || options.inputs.backendArgs !== JSON.stringify([entry]))
                throw new Error('Installed official binding differs');
        }
        const ui = (operation: string, payload: unknown = {}) => {
            const result = spawnSync(process.execPath, [entry, 'ui', '--config-dir', config!], { env: process.env, input: JSON.stringify({ protocol_version: PROTOCOL_VERSION, operation, payload }), encoding: 'utf8', timeout: 15000 });
            if (result.status !== 0)
                throw new Error(result.stderr + result.stdout);
            const value = JSON.parse(result.stdout);
            if (value.protocol_version !== PROTOCOL_VERSION || !value.result)
                throw new Error('Installed UI protocol mismatch');
            return value.result;
        };
        ui('describe');
        const current = ui('read');
        current.draft.display.use_colors = false;
        ui('preview', { draft: current.draft, width: 80 });
        const explanation = ui('explain', { draft: current.draft, scope: 'main', width: 80 });
        if (!explanation.sample || explanation.actual_availability !== 'not_observed' || !Array.isArray(explanation.instances))
            throw new Error('Installed explanation contract mismatch');
        ui('apply', { draft: current.draft, expected_revision: current.revision });
        host.run(['disable', NATIVE.plugin, '--scope', 'user', '--json']);
        const disabled = install(context);
        if (disabled.failed || disabled.nativeState !== 'plugin-disabled')
            throw new Error('Explicit disablement was not preserved');
        const removed = uninstall(context);
        if (removed.failed || pending(config).length)
            throw new Error('Official installed removal left unfinished work');
        if (JSON.parse(fs.readFileSync(join(config!, 'settings.json'), 'utf8')).env.KEEP !== 'yes')
            throw new Error('Unrelated settings changed');
        fs.writeFileSync(receipt!, JSON.stringify({ host_version: request.version, installed_mods: specs.map((spec: any) => spec.name), idempotent: true, bindings: true, native_protocol_save: true, user_disabled_preserved: true, removed_owned_only: true, pending: 0, model_calls: 0 }));
    }
}
else if (operation === 'setup-console') {
    const { main } = await load('cli', 'main');
    process.exitCode = await main(['--language', 'en', 'setup', '--config-dir', config!], { hostVersion: () => [2, 1, 258] });
}
else if (operation === 'windows-editor' || operation === 'windows-setup') {
    const { library, nativeApi } = await load('platform', 'native'), k = library('kernel32.dll');
    const input = k.func('void *CreateFileW(const char16_t *name, uint32_t access, uint32_t share, void *security, uint32_t disposition, uint32_t flags, void *template)')('CONIN$', 0xc0000000, 3, null, 3, 0, null);
    if (!input || nativeApi().address(input) === 0xffffffffffffffffn)
        throw new Error('Cannot open the new console input');
    const mode = () => { const value = [0]; if (!k.func('bool GetConsoleMode(void *handle, _Out_ uint32_t *mode)')(input, value))
        throw new Error('GetConsoleMode failed'); return value[0]; };
    const before = mode(), columns = process.stdout.columns || 80, rows = process.stdout.rows || 24, chunks: string[] = [];
    const outputMode = () => {
        const value = [0], handle = k.func('void *GetStdHandle(uint32_t kind)')(0xfffffff5);
        if (!k.func('bool GetConsoleMode(void *handle, _Out_ uint32_t *mode)')(handle, value)) throw new Error('Cannot read console output mode');
        return value[0];
    };
    if (choice === 'preview-cancel' || choice === 'color-cancel') {
        const output = k.func('void *GetStdHandle(uint32_t kind)')(0xfffffff5);
        if (!k.func('bool SetConsoleMode(void *handle, uint32_t mode)')(output, outputMode()! & ~4)) throw new Error('Cannot prepare VT-disabled fixture');
    }
    const beforeOutput = outputMode();
    const sendKeys = (keys: string) => {
        const records = Buffer.alloc(keys.length * 40);
        for (let i = 0; i < keys.length; i++) for (let down = 0; down < 2; down++) {
            const offset = i * 40 + down * 20, code = keys.charCodeAt(i);
            records.writeUInt16LE(1, offset); records.writeInt32LE(down === 0 ? 1 : 0, offset + 4);
            records.writeUInt16LE(1, offset + 8); records.writeUInt16LE(code === 19 ? 0x53 : code, offset + 10);
            records.writeUInt16LE(code, offset + 14); records.writeUInt32LE(code === 19 ? 8 : 0, offset + 16);
        }
        if (!k.func('bool WriteConsoleInputW(void *handle, void *records, uint32_t count, _Out_ uint32_t *written)')(input, records, keys.length * 2, [0])) throw new Error('WriteConsoleInputW failed');
    };
    let previewCancelled = false;
    let scheduled = false, timer: NodeJS.Timeout | undefined;
    // The production editor can move to an independent runtime. Preserve its
    // real console handles and record its writes through a fixture-only preload,
    // rather than replacing TTY streams with pipes or observing only this parent.
    const capturedPath=join(config!,'editor-child-output.ansi'),preload=join(config!,'editor-output-preload.mjs');
    fs.writeFileSync(capturedPath,'',{mode:0o600});
    // Preserve Node's lazy TTY initialization too: accessing stdout in this
    // preload would itself change the inherited console flags before capture.
    const modeTrace=capturedPath+'.modes.jsonl';fs.writeFileSync(modeTrace,'',{mode:0o600});
    fs.writeFileSync(preload,`import fs from 'node:fs';import{createRequire}from'node:module';const api=createRequire(process.argv[1])('koffi'),k=api.load('kernel32.dll'),get=k.func('bool GetConsoleMode(void *handle, _Out_ uint32_t *mode)'),handle=k.func('void *GetStdHandle(uint32_t kind)'),trace=phase=>{const value=[0];get(handle(0xfffffff5),value);fs.appendFileSync(${JSON.stringify(modeTrace)},JSON.stringify({phase,output:value[0]})+'\\n');};trace('preload');process.on('beforeExit',()=>trace('beforeExit'));process.on('exit',()=>trace('exit'));const seen=new WeakSet();for(const name of ['stdout','stderr']){const descriptor=Object.getOwnPropertyDescriptor(process,name);Object.defineProperty(process,name,{...descriptor,get(){trace('before '+name);const stream=descriptor.get.call(process);trace('after '+name);if(!seen.has(stream)){seen.add(stream);const write=stream.write.bind(stream);stream.write=(chunk,...args)=>{fs.appendFileSync(${JSON.stringify(capturedPath)},chunk);return write(chunk,...args);};}return stream;}});}\n`,{mode:0o600});
    const nodeOptions=process.env.NODE_OPTIONS;
    process.env.NODE_OPTIONS=[nodeOptions,'--import='+pathToFileURL(preload).href].filter(Boolean).join(' ');
    const capturedOutput=()=>chunks.join('')+fs.readFileSync(capturedPath,'utf8');
    const observeOutput=()=>{
        const output=capturedOutput();
        if (!scheduled && output.includes(operation === 'windows-setup' ? 'Environment and configuration checks' : 'Preview (sample data)')) {
            scheduled = true;
            setTimeout(() => {
                const keys = operation === 'windows-setup' ? choice === 'cancel' ? '\x1b' : choice === 'preview-cancel' ? '\r\r\r' : '\r\r\r\x1b[F\r' + (choice === 'save' ? '\x1b[B' : '') + '\r'
                    : choice === 'save' ? ' \x13' : ' \x1b';
                sendKeys(keys);
            }, 50);
        }
        if (choice === 'preview-cancel' && !previewCancelled && output.includes('Statusline theme')) {
            previewCancelled = true; setTimeout(() => sendKeys('\x1b'), 50);
        }
    };
    const write = process.stdout.write.bind(process.stdout);
    (process.stdout.write as any) = (chunk: any, ...args: any[]) => {
        const value = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
        chunks.push(value);
        observeOutput();
        return (write as any)(chunk, ...args);
    };
    const poll=setInterval(observeOutput,25);
    timer = setTimeout(() => { fs.writeFileSync(receipt!, JSON.stringify({ error: 'Editor console timed out', output: capturedOutput().slice(-2000) })); process.exit(1); }, 10000);
    try {
        const { main } = await load('cli', 'main');
        const status = await main(['--language', 'en', operation === 'windows-setup' ? 'setup' : 'configure', '--config-dir', config!],
            operation === 'windows-setup' ? { hostVersion: () => [2, 1, 258] } : {});
        fs.writeFileSync(receipt!, JSON.stringify({ status, input_tty: true, before_mode: before, after_mode: mode(), before_output_mode: beforeOutput, after_output_mode: outputMode(), console_trace:fs.readFileSync(modeTrace,'utf8').split('\n').filter(Boolean).slice(-32).map(line=>JSON.parse(line)), environment:{TERM:process.env.TERM??null,COLORTERM:process.env.COLORTERM??null,NO_COLOR:process.env.NO_COLOR??null}, columns, rows, output: capturedOutput() }));
        process.exitCode = status;
    }
    finally {
        clearTimeout(timer);
        clearInterval(poll);
        if(nodeOptions===undefined)delete process.env.NODE_OPTIONS;else process.env.NODE_OPTIONS=nodeOptions;
        k.func('bool CloseHandle(void *handle)')(input);
    }
}
else
    throw new Error('Unknown installed acceptance operation');
