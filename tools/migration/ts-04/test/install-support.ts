import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { install, uninstall, installContext } from '@fbincon/statusline-cli/integration/install';
import { NATIVE, RUNTIME, type Host, type ModSpec, type InstallOptions } from '@fbincon/statusline-cli/integration/model';
import { doctor } from '@fbincon/statusline-cli/integration/doctor';
import { createStorage, jsonBytes } from '@fbincon/statusline-cli/config/storage';
import { repoRoot } from '../../ts-03/common.js';
export { assert, fs, join, dirname, NATIVE, RUNTIME, install, uninstall, doctor, jsonBytes };
export class FakeHost implements Host {
    markets: Record<string, unknown>[] = [];
    plugins: Record<string, unknown>[] = [];
    calls: {
        args: readonly string[];
        values?: Record<string, string>;
    }[] = [];
    inputs: Record<string, string> = {};
    refused: string | null = null;
    constructor(readonly root: string, readonly spec: ModSpec) { }
    settings() { try {
        return JSON.parse(fs.readFileSync(join(this.root, 'settings.json'), 'utf8')) as Record<string, any>;
    }
    catch {
        return {};
    } }
    set(key: string, value: unknown) { const settings = this.settings(); settings[key] = value; fs.mkdirSync(this.root, { recursive: true }); fs.writeFileSync(join(this.root, 'settings.json'), jsonBytes(settings), { mode: 0o600 }); }
    enabled(value: boolean | null) { const plugins = this.settings().enabledPlugins ?? {}; if (value === null)
        delete plugins[this.spec.plugin];
    else
        plugins[this.spec.plugin] = value; this.set('enabledPlugins', plugins); }
    listing(): [
        Record<string, unknown>[],
        Record<string, unknown>[]
    ] {
        for (const row of this.plugins)
            row.enabled = this.settings().enabledPlugins?.[this.spec.plugin] === true;
        return structuredClone([this.markets, this.plugins]);
    }
    run(args: readonly string[], values?: Record<string, string>, json = false): unknown {
        this.calls.push({ args, values });
        if (args[0] === this.refused)
            throw new Error('Managed policy denied ' + args[0]);
        if (args[0] === 'marketplace') {
            if (args[1] === 'add')
                this.markets = [{ name: this.spec.marketplace, source: 'directory', path: join(this.root, this.spec.name) }];
            else if (args[1] === 'remove')
                this.markets = [];
        }
        else if (args[0] === 'install' || args[0] === 'update') {
            const source = join(this.root, this.spec.name, 'plugins', this.spec.name), version = JSON.parse(fs.readFileSync(join(source, '.claude-plugin/plugin.json'), 'utf8')).version, target = join(this.root, 'plugins/cache', this.spec.marketplace, this.spec.name, version);
            fs.cpSync(source, target, { recursive: true });
            this.plugins = [{ id: this.spec.plugin, scope: 'user', version, installPath: target, enabled: true }];
            if (args[0] === 'install') {
                this.enabled(true);
                this.inputs = Object.fromEntries(args.flatMap((arg, index) => args[index - 1] === '--config' ? [[arg.slice(0, arg.indexOf('=')), arg.slice(arg.indexOf('=') + 1)]] : []));
            }
        }
        else if (args[0] === 'configure') {
            if (values)
                Object.assign(this.inputs, values);
            if (json)
                return { inputs: { ...this.inputs } };
        }
        else if (args[0] === 'enable' || args[0] === 'disable')
            this.enabled(args[0] === 'enable');
        else if (args[0] === 'uninstall') {
            this.plugins = [];
            this.enabled(null);
        }
        return undefined;
    }
}
export function fresh(t: TestContext, version: readonly number[] | null = [2, 1, 288]) {
    const temporary = fs.mkdtempSync(join(tmpdir(), 'ts04-install 中文 ')), root = join(temporary, 'config 中文 $` & spaces');
    t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
    const launch = { executable: process.execPath, args: [join(repoRoot, 'packages/cli/dist/src/entry.js')] }, io = createStorage();
    const hosts = new Map([NATIVE, RUNTIME].map(spec => [spec.name, new FakeHost(root, spec)]));
    const context = installContext(root, launch, version, io, spec => hosts.get(spec.name)!);
    const put = (name: string, value: unknown) => { const path = join(root, name); fs.mkdirSync(dirname(path), { recursive: true, mode: 0o700 }); fs.writeFileSync(path, Buffer.isBuffer(value) ? value : jsonBytes(value), { mode: 0o600 }); return path; };
    const read = (name: string) => fs.readFileSync(join(root, name));
    const json = (name: string) => JSON.parse(read(name).toString('utf8'));
    return { temporary, root, launch, io, context, hosts, host: hosts.get(NATIVE.name)!, runtime: hosts.get(RUNTIME.name)!, put, read, json, install: (options: InstallOptions = {}) => install(context, options), uninstall: (options: InstallOptions = {}) => uninstall(context, options) };
}
export function snapshot(root: string): Record<string, string> {
    const values: Record<string, string> = {};
    function walk(path: string, prefix: string) {
        for (const entry of fs.readdirSync(path, { withFileTypes: true })) {
            const name = prefix + entry.name;
            if (name.startsWith('backups') || ['statusline_runtime/install.lock', 'statusline_runtime/admin.lock'].includes(name))
                continue;
            if (entry.isDirectory())
                walk(join(path, entry.name), name + '/');
            else
                values[name] = fs.readFileSync(join(path, entry.name)).toString('hex');
        }
    }
    if (fs.existsSync(root))
        walk(root, '');
    return values;
}
export function failWriteOnce(f: ReturnType<typeof fresh>, target: string): void {
    const original = f.io.write;
    let failed = false;
    f.io.write = (path, raw) => { if (!failed && path === join(f.root, target)) {
        failed = true;
        throw new Error('injected write failure');
    } original(path, raw); };
}
