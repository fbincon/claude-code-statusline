import * as fs from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const [modules, operation, config, receipt, choice] = process.argv.slice(2);
const load = (name: string, path: string) => import(pathToFileURL(join(modules!, 'statusline-' + name, 'dist/src', path + '.js')).href);
if (operation === 'modules') {
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
            const result = spawnSync(process.execPath, [entry, 'ui', '--config-dir', config!], { env: process.env, input: JSON.stringify({ protocol_version: 13, operation, payload }), encoding: 'utf8', timeout: 15000 });
            if (result.status !== 0)
                throw new Error(result.stderr + result.stdout);
            const value = JSON.parse(result.stdout);
            if (value.protocol_version !== 12 || !value.result)
                throw new Error('Installed UI protocol mismatch');
            return value.result;
        };
        ui('describe');
        const current = ui('read');
        current.draft.display.use_colors = false;
        ui('preview', { draft: current.draft, width: 80 });
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
else if (operation === 'windows-editor') {
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
    const beforeOutput = outputMode();
    let scheduled = false, timer: NodeJS.Timeout | undefined;
    const write = process.stdout.write.bind(process.stdout);
    (process.stdout.write as any) = (chunk: any, ...args: any[]) => {
        const value = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
        chunks.push(value);
        if (!scheduled && chunks.join('').includes('Preview (sample data)')) {
            scheduled = true;
            setTimeout(() => {
                const keys = choice === 'save' ? ' \x13' : ' \x1b', records = Buffer.alloc(keys.length * 40);
                for (let i = 0; i < keys.length; i++)
                    for (let down = 0; down < 2; down++) {
                        const offset = i * 40 + down * 20, code = keys.charCodeAt(i);
                        records.writeUInt16LE(1, offset);
                        records.writeInt32LE(down === 0 ? 1 : 0, offset + 4);
                        records.writeUInt16LE(1, offset + 8);
                        records.writeUInt16LE(code === 19 ? 0x53 : code, offset + 10);
                        records.writeUInt16LE(code, offset + 14);
                        records.writeUInt32LE(code === 19 ? 8 : 0, offset + 16);
                    }
                const count = [0];
                if (!k.func('bool WriteConsoleInputW(void *handle, void *records, uint32_t count, _Out_ uint32_t *written)')(input, records, keys.length * 2, count))
                    throw new Error('WriteConsoleInputW failed');
            }, 50);
        }
        return (write as any)(chunk, ...args);
    };
    timer = setTimeout(() => { fs.writeFileSync(receipt!, JSON.stringify({ error: 'Editor console timed out', output: chunks.join('').slice(-2000) })); process.exit(1); }, 10000);
    try {
        const { main } = await load('cli', 'main');
        const status = await main(['--language', 'en', 'configure', '--config-dir', config!]);
        fs.writeFileSync(receipt!, JSON.stringify({ status, input_tty: true, before_mode: before, after_mode: mode(), before_output_mode: beforeOutput, after_output_mode: outputMode(), columns, rows, output: chunks.join('') }));
        process.exitCode = status;
    }
    finally {
        clearTimeout(timer);
        k.func('bool CloseHandle(void *handle)')(input);
    }
}
else
    throw new Error('Unknown installed acceptance operation');
