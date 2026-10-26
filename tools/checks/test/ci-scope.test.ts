import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { documentationOnly, changedDocumentationOnly, assessCiNeeds } from '../ci-scope.js';

test('only allowlisted Markdown changes on ordinary PRs and branches avoid the matrix', () => {
    const docs = ['AGENTS.md', 'README.md', 'README.zh-CN.md', 'CHANGELOG.md', 'docs/development/external-tui-parity.md', 'docs/releases/v3.1.2.md',
        'SECURITY.md', 'SECURITY.zh-CN.md', 'CONTRIBUTING.md', 'CONTRIBUTING.zh-CN.md', '.github/pull_request_template.md',
        '.github/ISSUE_TEMPLATE/bug_report.yml', '.github/ISSUE_TEMPLATE/config.yml', '.github/ISSUE_TEMPLATE/preview-feedback.yml'];
    for (const event of ['pull_request', 'push']) assert.equal(documentationOnly(event, 'branch', docs), true);
    for (const path of ['packages/tui/src/state.ts', 'mods/statusline-native/README.md', 'docs/releases/approvals/v3.1.2.json', 'docs/image.png', '.github/workflows/ci.yml', '.github/workflows/new.yaml', '.github/dependabot.yml', '.github/actions/local/action.yml', '.github/ISSUE_TEMPLATE/unknown.yml', '.github/unknown.md', 'SECURITY.js', 'tools/checks/community.ts', 'tools/checks/actions.ts', 'tools/checks/docs.ts', 'tools/checks/ci-scope.ts', 'package-lock.json', 'packages/core/src/release.ts', 'AGENTS.override.md', 'AGENTS.local.md', 'AGENTS.zh-CN.md', 'packages/core/AGENTS.md', 'NOTES.md', 'unknown', 'docs/not-markdown'])
        assert.equal(documentationOnly('pull_request', 'branch', [...docs, path]), false, path);
    assert.equal(documentationOnly('push', 'tag', docs), false);
    assert.equal(documentationOnly('workflow_dispatch', 'branch', docs), false);
    assert.equal(documentationOnly('pull_request_target', 'branch', docs), false);
    assert.equal(documentationOnly('pull_request', 'branch', []), false);
});

test('root agent guidance additions, edits and deletions stay light, but executable renames and mixed changes do not', () => {
    const root = fs.mkdtempSync(join(tmpdir(), 'ci-agents-'));
    const git = (...args: string[]) => execFileSync('git', ['-C', root, '-c', 'user.name=CI fixture', '-c', 'user.email=fixture@example.invalid', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const classify = (base: string, expected: boolean) => {
        for (const event of ['pull_request', 'push']) {
            const output = join(root, 'scope-output');
            fs.rmSync(output, { force: true });
            execFileSync(process.execPath, [fileURLToPath(new URL('../ci-scope.js', import.meta.url))], {
                cwd: root, env: { ...process.env, CI_EVENT: event, CI_REF_TYPE: 'branch', CI_BASE: base, CI_HEAD: git('rev-parse', 'HEAD'), GITHUB_OUTPUT: output },
            });
            assert.equal(fs.readFileSync(output, 'utf8'), `docs_only=${expected}\ndraft=false\n`, event);
        }
    };
    try {
        git('init');
        fs.writeFileSync(join(root, 'runtime.js'), 'export const runtime = true;\n');
        git('add', 'runtime.js'); git('commit', '-m', 'baseline');
        for (const operation of ['add', 'edit', 'delete']) {
            const base = git('rev-parse', 'HEAD');
            if (operation === 'delete') git('rm', 'AGENTS.md');
            else {
                fs.writeFileSync(join(root, 'AGENTS.md'), '# Repository agents\n' + operation + '\n');
                git('add', 'AGENTS.md');
            }
            git('commit', '-m', operation + ' agent guidance');
            classify(base, true);
        }
        const beforeRename = git('rev-parse', 'HEAD');
        git('mv', 'runtime.js', 'AGENTS.md'); git('commit', '-m', 'executable rename');
        classify(beforeRename, false);
        const beforeMixed = git('rev-parse', 'HEAD');
        fs.appendFileSync(join(root, 'AGENTS.md'), 'updated\n');
        fs.writeFileSync(join(root, 'product.ts'), 'export const product = true;\n');
        git('add', 'AGENTS.md', 'product.ts'); git('commit', '-m', 'mixed changes');
        classify(beforeMixed, false);
    } finally { fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }); }
});

test('community additions, edits and deletions stay light, but executable renames do not', () => {
    const root = fs.mkdtempSync(join(tmpdir(), 'ci-community-'));
    const git = (...args: string[]) => execFileSync('git', ['-C', root, '-c', 'user.name=CI fixture', '-c', 'user.email=fixture@example.invalid', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const classify = (base: string) => {
        const output = join(root, 'scope-output');
        fs.rmSync(output, { force: true });
        execFileSync(process.execPath, [fileURLToPath(new URL('../ci-scope.js', import.meta.url))], {
            cwd: root, env: { ...process.env, CI_EVENT: 'pull_request', CI_REF_TYPE: 'branch', CI_BASE: base, CI_HEAD: git('rev-parse', 'HEAD'), GITHUB_OUTPUT: output },
        });
        return fs.readFileSync(output, 'utf8');
    };
    try {
        git('init');
        fs.mkdirSync(join(root, '.github/ISSUE_TEMPLATE'), { recursive: true });
        fs.writeFileSync(join(root, '.github/ISSUE_TEMPLATE/preview-feedback.yml'), 'name: Preview\n');
        fs.writeFileSync(join(root, 'runtime.js'), 'export const runtime = true;\n');
        git('add', '.'); git('commit', '-m', 'baseline');
        const base = git('rev-parse', 'HEAD');
        for (const file of ['SECURITY.md', 'CONTRIBUTING.md', '.github/ISSUE_TEMPLATE/bug_report.yml', '.github/ISSUE_TEMPLATE/config.yml']) {
            fs.writeFileSync(join(root, file), 'content\n'); git('add', file); git('commit', '-m', 'add documentation');
            assert.equal(classify(base), 'docs_only=true\ndraft=false\n');
        }
        fs.appendFileSync(join(root, 'SECURITY.md'), 'updated\n'); git('add', 'SECURITY.md'); git('commit', '-m', 'edit policy');
        assert.equal(classify(base), 'docs_only=true\ndraft=false\n');
        git('rm', '.github/ISSUE_TEMPLATE/preview-feedback.yml'); git('commit', '-m', 'replace preview');
        assert.equal(classify(base), 'docs_only=true\ndraft=false\n');
        git('mv', 'runtime.js', '.github/pull_request_template.md'); git('commit', '-m', 'executable rename');
        assert.equal(classify(base), 'docs_only=false\ndraft=false\n');
    } finally { fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }); }
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
        assert.equal(classify(base, git('rev-parse', 'HEAD')), 'docs_only=true\ndraft=false\n');
        fs.mkdirSync(join(root, 'docs'));
        git('mv', 'runtime.js', 'docs/runtime.md'); git('commit', '-m', 'rename');
        assert.equal(classify(base, git('rev-parse', 'HEAD')), 'docs_only=false\ndraft=false\n');
    } finally { fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }); }
});

test('the required gate rejects skipped or failed product evidence and failed scope checks', () => {
    const full = Object.fromEntries(['scope', 'development', 'candidate', 'installed', 'runtime', 'mods'].map(name => [name, { result: 'success', outputs: { docs_only: 'false' } }]));
    assert.doesNotThrow(() => assessCiNeeds(full));
    for (const name of ['scope', 'development', 'candidate', 'installed', 'runtime', 'mods']) {
        for (const result of ['failure', 'cancelled', 'skipped'])
            assert.throws(() => assessCiNeeds({ ...full, [name]: { ...full[name]!, result } }));
        const missing = { ...full }; delete missing[name];
        assert.throws(() => assessCiNeeds(missing));
    }
    const docs = {
        scope: { result: 'success', outputs: { docs_only: 'true', docs_checked: 'true' } },
        ...Object.fromEntries(['development', 'candidate', 'installed', 'runtime', 'mods'].map(name => [name, { result: 'skipped' }])),
    };
    assert.doesNotThrow(() => assessCiNeeds(docs));
    for (const result of ['failure', 'cancelled', 'skipped']) {
        assert.throws(() => assessCiNeeds({ ...docs, scope: { result: 'success', outputs: { docs_only: 'true', docs_checked: result } } }));
        assert.throws(() => assessCiNeeds({ ...docs, scope: { result, outputs: { docs_only: 'true' } } }));
    }
    const withoutDocumentation = { ...docs, scope: { result: 'success', outputs: { docs_only: 'true' } } };
    assert.throws(() => assessCiNeeds(withoutDocumentation));
    assert.throws(() => assessCiNeeds({ scope: { result: 'success' } }));
});

test('draft fast checks never satisfy the required aggregate', () => {
    const needs = Object.fromEntries(['scope', 'quick', 'development', 'candidate', 'installed', 'runtime', 'mods'].map(name => [name, { result: 'success', outputs: { docs_only: 'false', draft: 'true' } }]));
    assert.throws(() => assessCiNeeds(needs), /Draft/);
});
