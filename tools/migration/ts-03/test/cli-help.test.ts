import { oracle, referenceDirectory as exportReference } from '@fbincon/statusline-test-support/oracle';
import test from 'node:test';
import assert from 'node:assert/strict';

import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { main } from '@fbincon/statusline-cli/main';


test('help preserves Python command validation, exit codes and output channels without writes', async t => {
    const reference = exportReference(), root = mkdtempSync(join(tmpdir(), 'ts03-help-'));
    t.after(() => { rmSync(reference, { recursive: true, force: true }); rmSync(root, { recursive: true, force: true }); });
    const prefixes = [[], ['unknown'], ['--unknown'], ['config'], ['config', 'unknown'],
        ['config', '--unknown'], ['config', 'language'], ['config', 'language', '--unknown'], ['config', 'language', 'unknown'],
        ['config', 'language', 'set'], ['config', 'language', 'set', 'en'], ['config', 'language', 'set', 'bad'],
        ['config', 'subagents'], ['config', 'subagents', 'unknown'], ['config', 'subagents', 'enable'],
        ['config', 'instance'], ['config', 'instance', '--unknown'], ['config', 'instance', 'main'], ['config', 'instance', 'bad'],
        ['config', 'instance', 'main', '--unknown'],
        ['config', 'instance', 'main', 'unknown'], ['config', 'instance', 'main', 'add'],
        ['config', 'instance', 'main', 'add', 'model', '--after'],
        ['config', 'instance', 'main', 'add', 'model', '--after', '-x'],
        ['config', 'instance', 'main', 'move', 'model'],
        ['config', 'instance', 'main', 'move', 'model', '--before', 'a', '--after', 'b'],
        ['config', 'instance', 'main', 'move', '--before', 'a', '--after', 'b'],
        ['config', 'show', 'extra'], ['config', 'show', '--json=yes'], ['config', 'show', '--unknown'],
        ['config', 'set'], ['config', 'set', 'colors'], ['config', 'set', 'bad'],
        ['config', 'preset', 'bad'], ['config', 'item', 'bad'], ['config', 'layout', 'bad'],
        ['config', 'apply'], ['config', 'apply', '--colors'], ['config', 'apply', '--colors', 'bad'],
        ['config', 'apply', '--items'], ['config', '--config-dir'],
        ...['-', '-1', '-.1', '-1e3', '-1abc', '-١', '-literal space'].map(value => ['config', 'apply', '--padding', value]),
        ['config', '--config-dir', '-x'],
        ['ui'], ['runtime'], ['render', 'extra'], ['render-subagents', 'extra'], ['hook', 'extra'], ['slash-hook', 'extra'],
        ...['ui', 'runtime', 'render', 'hook', 'slash-hook'].map(command => [command, '--config-dir'])];
    const vectors = [...prefixes.flatMap(args => ['--help', '-h'].map(help => [...args, help])), ['--help', 'unknown'], ['config', '--help', 'unknown']];
    const script = `import contextlib, io, json, sys
from claude_statusline.cli import main
results = []
for args in json.load(sys.stdin):
    out, err = io.StringIO(), io.StringIO()
    with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
        try: status = main(args)
        except SystemExit as error: status = error.code
    results.append([status, bool(out.getvalue()), bool(err.getvalue())])
print(json.dumps(results))
`;
    const expected = JSON.parse(oracle(['-B', '-c', script], {
        input: JSON.stringify(vectors), encoding: 'utf8',
        env: { ...process.env, PYTHONPATH: join(reference, 'src'), PYTHONDONTWRITEBYTECODE: '1', CLAUDE_CONFIG_DIR: join(root, 'python') },
    })) as [number, boolean, boolean][];
    const failures: unknown[] = [];
    for (const [index, args] of vectors.entries()) {
        let stdout = '', stderr = '';
        const status = await main(args, { configDir: join(root, 'typescript'), stdout: text => { stdout += text; }, stderr: text => { stderr += text; } });
        const actual = [status, !!stdout, !!stderr];
        if (JSON.stringify(actual) !== JSON.stringify(expected[index])) failures.push({ args, expected: expected[index], actual });
    }
    assert.deepEqual(failures, []);
    assert.deepEqual(readdirSync(root), []);
});
