import test from 'node:test';
import { setup, fs, join, assert } from './runtime-support.js';
import { invoke, traced } from './final-cli-support.js';
import { main } from '../src/main.js';

const read = JSON.stringify({ protocol_version: 2, operation: 'read', payload: { session_id: 's', prompt_id: null } });

test('bare runtime preserves protocol results, invalid input and the one MiB boundary', async t => {
    const f = setup(t);
    for (const input of [read, '', '{', '{"protocol_version":2,"protocol_version":2}', '{"protocol_version":NaN}', JSON.stringify({ protocol_version: 999, operation: 'read', payload: {} }), ' '.repeat(1048577)]) {
        const environment = { configDir: f.root, runtime: f.context, stdin: () => input };
        assert.deepEqual(await invoke(['runtime'], environment), await invoke(['--language=en', 'runtime'], environment));
    }
    assert.equal(fs.existsSync(join(f.root, 'statusline-ui.json')), false);
});

test('bare runtime keeps invalid runtime preferences on the existing protocol error boundary', async t => {
    const f = setup(t);
    for (const raw of ['{', '{"schema_version":9}', '{"schema_version":2,"native_timing":true,"live_metrics":false,"unknown":1}', '{"schema_version":2,"native_timing":true,"native_timing":false,"live_metrics":false}']) {
        fs.writeFileSync(join(f.root, 'claude-statusline-runtime.json'), raw);
        const environment = { configDir: f.root, runtime: f.context, stdin: () => read };
        const fast = await invoke(['runtime'], environment);
        assert.equal(fast.status, 2);
        assert.deepEqual(fast, await invoke(['--language=en', 'runtime'], environment));
        assert.equal(fs.readFileSync(join(f.root, 'claude-statusline-runtime.json'), 'utf8'), raw);
    }
});

test('successful bare runtime does not load UI messages, display configuration or management storage', t => {
    const f = setup(t);
    const result = traced(f.root, ['runtime'], read);
    assert.equal(JSON.parse(result.stdout).result.enabled, false);
    for (const suffix of ['/config/service.js', '/config/storage.js', '/config/display.js', '/i18n/generated-locales.js', '/tui/dist/src/session.js']) {
        assert.equal(result.modules.some(module => module.endsWith(suffix)), false, suffix);
    }
});

test('bare runtime resolves a linked config directory with the same canonical storage as the ordinary path', { skip: process.platform === 'win32' }, async t => {
    const f = setup(t), target = join(f.root, '实际 配置'), link = join(f.root, 'linked');
    fs.mkdirSync(target); fs.symlinkSync(target, link, 'dir');
    fs.writeFileSync(join(target, 'claude-statusline-runtime.json'), '{"schema_version":2,"native_timing":false,"live_metrics":true}');
    const environment = { configDir: link, stdin: () => read };
    const fast = await invoke(['runtime'], environment);
    assert.equal(JSON.parse(fast.stdout).result.enabled, true);
    assert.deepEqual(fast, await invoke(['--language=en', 'runtime'], environment));
});

test('unexpected bare runtime output failure retains the UI language and status of the existing CLI boundary', async t => {
    const f = setup(t);
    fs.writeFileSync(join(f.root, 'statusline-ui.json'), '{"schema_version":1,"ui_language":"zh-CN"}');
    const run = async (args: string[]) => {
        let stderr = '';
        const status = await main(args, { configDir: f.root, runtime: f.context, stdin: () => read,
            stdout: () => { throw new Error('output blocked'); }, stderr: text => { stderr += text; } });
        return { status, stderr };
    };
    assert.deepEqual(await run(['runtime']), await run(['runtime', '--config-dir', f.root]));
});
