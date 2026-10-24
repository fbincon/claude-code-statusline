import test from 'node:test';
import assert from 'node:assert/strict';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { Npm } from '../src/npm.js';
import { PackageError } from '@fbincon/statusline-core/management/package';
test('npm uses Node and literal argv, reports its effective prefix and scoped registry, and never invokes a shell shim', async () => {
    const prefix = resolve(tmpdir(), 'npm prefix 中文 & $`'), root = join(prefix, process.platform === 'win32' ? 'node_modules' : 'lib/node_modules'), calls: readonly string[][] = [];
    const seen: string[][] = [];
    const npm = new Npm({}, async (o) => { seen.push([...o.args]); assert.equal(o.executable, process.execPath); const args = o.args.slice(1); return { code: 0, reason: 'completed', stdout: args[0] === 'prefix' ? prefix : args[0] === 'root' ? root : args[0] === '--version' ? '11.19.0' : args[2] === 'cache' ? resolve(tmpdir(), 'npm cache') : 'https://registry.npmjs.org/' }; }, 'npm-cli.js');
    const layout = await npm.layout();
    assert.equal(layout.prefix, prefix);
    await npm.install('3.8.0', layout);
    const args = seen.at(-1)!;
    assert(args.includes(prefix));
    assert(args.includes('--ignore-scripts'));
    assert(args.includes('@fbincon/claude-code-statusline@3.8.0'));
    await assert.rejects(npm.install('latest', layout), PackageError);
    void calls;
});
test('invalid registry credentials, malformed locations and process failures are rejected without raw stderr', async () => {
    for (const result of [{ code: 1, reason: 'exit' as const, stdout: '' }, { code: null, reason: 'timeout' as const, stdout: '' }, { code: null, reason: 'cancelled' as const, stdout: '' }]) {
        const npm = new Npm({}, async () => result, 'npm-cli.js');
        await assert.rejects(npm.layout(), PackageError);
    }
    const prefix = resolve(tmpdir(), 'npm prefix'), root = join(prefix, process.platform === 'win32' ? 'node_modules' : 'lib/node_modules');
    const npm = new Npm({}, async (o) => ({ code: 0, reason: 'completed', stdout: o.args[1] === 'prefix' ? prefix : o.args[1] === 'root' ? root : o.args[1] === '--version' ? '11.19.0' : o.args[3] === 'cache' ? resolve(tmpdir(), 'npm-cache') : 'https://user:secret@example.invalid/' }), 'npm-cli.js');
    await assert.rejects(npm.layout(), (e: unknown) => e instanceof PackageError && e.code === 'registry' && !e.message.includes('secret'));
});
