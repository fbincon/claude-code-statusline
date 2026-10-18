import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { documentationOnly, changedDocumentationOnly, assessCiNeeds } from '../ci-scope.js';

test('only allowlisted Markdown changes on ordinary PRs and branches avoid the matrix', () => {
    const docs = ['README.md', 'README.zh-CN.md', 'CHANGELOG.md', 'docs/development/external-tui-parity.md', 'docs/releases/v3.1.2.md'];
    for (const event of ['pull_request', 'push']) assert.equal(documentationOnly(event, 'branch', docs), true);
    for (const path of ['packages/tui/src/state.ts', 'mods/statusline-native/README.md', 'docs/releases/approvals/v3.1.2.json', 'docs/image.png', '.github/workflows/ci.yml', 'package-lock.json', 'packages/core/src/release.ts', 'AGENTS.md', 'unknown', 'docs/not-markdown'])
        assert.equal(documentationOnly('pull_request', 'branch', [...docs, path]), false, path);
    assert.equal(documentationOnly('push', 'tag', docs), false);
    assert.equal(documentationOnly('workflow_dispatch', 'branch', docs), false);
    assert.equal(documentationOnly('pull_request_target', 'branch', docs), false);
    assert.equal(documentationOnly('pull_request', 'branch', []), false);
});

test('unknown revisions and diff failures require the complete matrix', () => {
    for (const base of ['', '0'.repeat(40), 'missing', 'a'.repeat(40)])
        assert.equal(changedDocumentationOnly('push', 'branch', base, 'b'.repeat(40)), false);
});

test('actual Git diffs allow Markdown but reject executable-to-document renames', () => {
    const root = fs.mkdtempSync(join(tmpdir(), 'ci-scope-'));
    const git = (...args: string[]) => execFileSync('git', ['-C', root, '-c', 'user.name=CI fixture', '-c', 'user.email=fixture@example.invalid', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const classify = (base: string, head: string) => {
        const output = join(root, 'scope-output');
        fs.rmSync(output, { force: true });
        execFileSync(process.execPath, [fileURLToPath(new URL('../ci-scope.js', import.meta.url))], {
            cwd: root, env: { ...process.env, CI_EVENT: 'pull_request', CI_REF_TYPE: 'branch', CI_BASE: base, CI_HEAD: head, GITHUB_OUTPUT: output },
        });
        return fs.readFileSync(output, 'utf8');
    };
    try {
        git('init');
        fs.writeFileSync(join(root, 'README.md'), 'initial\n');
        fs.writeFileSync(join(root, 'runtime.js'), 'export const runtime = true;\n');
        git('add', '.'); git('commit', '-m', 'baseline');
        const base = git('rev-parse', 'HEAD');
        fs.writeFileSync(join(root, 'README.md'), 'updated\n');
        git('add', 'README.md'); git('commit', '-m', 'docs');
        assert.equal(classify(base, git('rev-parse', 'HEAD')), 'docs_only=true\n');
        fs.mkdirSync(join(root, 'docs'));
        git('mv', 'runtime.js', 'docs/runtime.md'); git('commit', '-m', 'rename');
        assert.equal(classify(base, git('rev-parse', 'HEAD')), 'docs_only=false\n');
    } finally { fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }); }
});

test('the required gate rejects skipped or failed product evidence and failed scope checks', () => {
    const full = Object.fromEntries(['scope', 'candidate', 'installed', 'runtime', 'mods'].map(name => [name, { result: 'success', outputs: { docs_only: 'false' } }]));
    assert.doesNotThrow(() => assessCiNeeds(full));
    for (const name of ['scope', 'candidate', 'installed', 'runtime', 'mods']) {
        for (const result of ['failure', 'cancelled', 'skipped'])
            assert.throws(() => assessCiNeeds({ ...full, [name]: { ...full[name]!, result } }));
    }
    const docs = {
        scope: { result: 'success', outputs: { docs_only: 'true' } }, documentation: { result: 'success' },
        ...Object.fromEntries(['candidate', 'installed', 'runtime', 'mods'].map(name => [name, { result: 'skipped' }])),
    };
    assert.doesNotThrow(() => assessCiNeeds(docs));
    assert.throws(() => assessCiNeeds({ ...docs, documentation: { result: 'failure' } }));
    assert.throws(() => assessCiNeeds({ ...docs, scope: { result: 'failure', outputs: { docs_only: 'true' } } }));
    assert.throws(() => assessCiNeeds({ scope: { result: 'success' } }));
});
