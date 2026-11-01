/** Observe the installed bytes and official plugin bindings during a real npm roundtrip. */
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { dirname, isAbsolute, join, relative, sep } from 'node:path';
import { readTar, sha256 } from '../build/files.js';
import { NATIVE, RUNTIME } from '@fbincon/statusline-cli/integration/model';
import type { VersionHost } from './version-management.js';

type Command = { code: number | null; stdout: string; stderr: string; elapsed_ms: number };
interface Context {
    root: string; entry: string; node: string; npm: string; config: string; shim: string; host?: VersionHost;
    archive: string; legacy: string; audit: string; registry: string;
    invoke: (args: string[], success?: boolean) => Promise<Command>;
}
const json = (path: string) => JSON.parse(fs.readFileSync(path, 'utf8'));
const hashFile = (path: string) => sha256(fs.readFileSync(path));
const real = (path: string) => fs.realpathSync.native(path);
const portable = (root: string, entry: string) => relative(real(root), real(entry)).split(sep).join('/');

/** npm may omit other platforms' optional native binaries. Every installed
 * product file, including candidate.json, must match the actual archive. */
export function verifyShortInstalledArchive(root: string, archive: string): string {
    const entries = readTar(archive), manifest = JSON.parse(entries.get('package.json')!.toString('utf8'));
    const foreign = Object.keys(manifest.optionalDependencies ?? {}).filter(name =>
        name.startsWith('@koromix/koffi-') && name !== '@koromix/koffi-' + process.platform + '-' + process.arch)
        .map(name => 'node_modules/' + name + '/');
    for (const [name, bytes] of entries) {
        const path = join(root, name);
        if (!fs.existsSync(path) && foreign.some(prefix => name.startsWith(prefix))) continue;
        assert(fs.lstatSync(path).isFile() && fs.readFileSync(path).equals(bytes), 'Installed file differs from the selected archive: ' + name);
    }
    return hashFile(archive);
}
export function shortHistoryObserver(ctx: Context) {
    const display = join(ctx.config, 'claude-statusline.json'), profiles = join(ctx.config, 'claude-statusline-profiles.json');
    const settings = () => json(join(ctx.config, 'settings.json'));
    const plugins = [NATIVE, RUNTIME], specs = ctx.host ? plugins.filter(spec => Number(ctx.host!.version.split('.')[2]) >= spec.minimum[2]!) : [];
    const officialJson = async (args: string[]) => JSON.parse((await ctx.invoke([ctx.shim, 'plugin', ...args, '--json'])).stdout);
    const enabled = async (): Promise<string[]> => {
        if (!ctx.host) return plugins.filter(spec => settings().enabledPlugins?.[spec.plugin] === true).map(spec => spec.name);
        const rows = await officialJson(['list']); assert(Array.isArray(rows));
        return plugins.filter(spec => rows.some(row => row.id === spec.plugin && row.enabled === true)).map(spec => spec.name);
    };
    const binding = (executable: string, args: string[], nodeHash: string) => {
        assert(isAbsolute(executable) && Array.isArray(args) && args.length === 1 && isAbsolute(args[0]!));
        assert.equal(real(executable), real(ctx.node)); assert.equal(real(args[0]!), real(ctx.entry));
        return { executable_sha256: nodeHash, entry: portable(ctx.root, args[0]!) };
    };
    return {
        async observe(phase: 'historical' | 'upgrade' | 'rollback', command: Command) {
            const state = json(join(ctx.config, 'statusline_runtime/installation.json')), version = json(join(ctx.root, 'package.json')).version;
            assert.equal((await ctx.invoke([ctx.entry, '--version'])).stdout.trim(), 'claude-statusline ' + version);
            const nodeHash = hashFile(ctx.node), launch = binding(state.launch.executable, state.launch.args, nodeHash);
            assert.equal(state.backend_version, version);
            const keep = settings().env?.KEEP; assert.equal(keep, 'unchanged');
            assert.deepEqual(await enabled(), specs.map(spec => spec.name));
            const bindings = [];
            for (const spec of specs) {
                const { inputs } = await officialJson(['configure', spec.plugin]);
                assert.equal(real(inputs.configDir), real(ctx.config)); assert.equal(inputs.backendVersion, version);
                bindings.push({ mod: spec.name, ...binding(inputs.backendExecutable, JSON.parse(inputs.backendArgs), nodeHash) });
            }
            return { phase, exit_code: command.code, elapsed_ms: command.elapsed_ms, package_version: version, backend_version: state.backend_version,
                archive_sha256: verifyShortInstalledArchive(ctx.root, phase === 'upgrade' ? ctx.archive : ctx.legacy),
                entry: portable(ctx.root, ctx.entry), bound_entry: launch.entry, bound_executable_sha256: launch.executable_sha256,
                display_schema: json(display).schema_version, display_sha256: hashFile(display), profiles_sha256: hashFile(profiles),
                third_party_keep: keep, bindings };
        },
        schemaRestore(rejected: Command, retainedVersion: string, restored: Command, from: number, to: number) {
            const plan = JSON.parse(rejected.stdout);
            assert.equal(plan.compatible, false); assert(plan.reasons.includes('configuration'));
            assert(plan.configuration_conflicts.includes('claude-statusline.json'));
            return { from, to, refusal_exit_code: rejected.code, refusal_reason: 'configuration-schema', retained_version: retainedVersion,
                restore_exit_code: restored.code, display_sha256: hashFile(display), profiles_sha256: hashFile(profiles) };
        },
        async disableAndReinstall(target: string) {
            assert.equal(json(join(ctx.root, 'package.json')).version, target, 'Explicit disablement must exercise the upgraded candidate');
            await ctx.invoke([ctx.entry, 'install', '--config-dir', ctx.config, '--no-native-editor', '--no-native-timing', '--no-live-metrics']);
            const reinstall = await ctx.invoke([ctx.entry, 'install', '--config-dir', ctx.config]);
            const runtime = json(join(ctx.config, 'claude-statusline-runtime.json'));
            const explicit = { reinstall_exit_code: reinstall.code, native_preference: json(join(ctx.config, 'claude-statusline-native.json')).native_editor,
                runtime_preference: runtime.native_timing, enabled_managed_mods: await enabled(), third_party_keep: settings().env.KEEP };
            assert.equal(explicit.native_preference, false); assert.equal(runtime.live_metrics, false); assert.equal(explicit.runtime_preference, false);
            assert.deepEqual(explicit.enabled_managed_mods, []); assert.equal(explicit.third_party_keep, 'unchanged');
            assert.equal(json(join(ctx.config, 'statusline_runtime/installation.json')).backend_version, target);
            return explicit;
        },
        async finish() {
            assert.equal((await ctx.invoke([ctx.shim, '--version'])).stdout.match(/^\d+\.\d+\.\d+/u)?.[0], ctx.host?.version ?? '2.1.258');
            const npm = json(join(dirname(real(ctx.npm)), '..', 'package.json'));
            assert.equal(npm.name, 'npm'); const actualNpm = (await ctx.invoke([ctx.npm, '--version'])).stdout.trim();
            const scripts = (await ctx.invoke([ctx.npm, 'config', 'get', 'ignore-scripts'])).stdout.trim();
            assert.equal(actualNpm, npm.version); assert.equal(scripts, 'true');
            const url = new URL(ctx.registry); assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.protocol, 'http:');
            const calls: string[][] = fs.readFileSync(ctx.audit, 'utf8').trim().split('\n').map(line => JSON.parse(line));
            assert(calls.some(args => args[0] === '--version'));
            const modelCalls = calls.filter(args => args[0] !== '--version' && args[0] !== 'plugin').length;
            assert.equal(modelCalls, 0);
            return { real_npm: actualNpm === npm.version, lifecycle_scripts: scripts !== 'true', registry: 'controlled-loopback',
                model_calls: modelCalls };
        },
    };
}
