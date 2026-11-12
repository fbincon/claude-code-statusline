import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { main } from '@fbincon/statusline-cli/main';
import { ConfigurationService } from '@fbincon/statusline-cli/config/service';
import { createStorage, jsonBytes } from '@fbincon/statusline-cli/config/storage';
import { SourceService } from '@fbincon/statusline-cli/sources/service';
import { refreshGithub } from '@fbincon/statusline-cli/sources/providers';
import { contextFor } from '@fbincon/statusline-cli/sources/context';
import { commandFor, splitCommand } from '@fbincon/statusline-platform/commands';
import { removeTree } from '@fbincon/statusline-platform/remove-tree';
import { defaultDisplay, defaultItem } from '@fbincon/statusline-core/config/display';
import { ITEMS } from '@fbincon/statusline-core/config/catalog';
import { Editor, copyDraft } from '@fbincon/statusline-core/editor/draft';
import { changesKey } from '@fbincon/statusline-core/editor/change-review';
import type { DescribeResult, ReadResult } from '@fbincon/statusline-core/contracts/ui';
import { contentDocuments, example, sourceExample } from '../docs-content.js';

const pages = contentDocuments(process.cwd());
type Reply = { code: number; out: string; err: string };
function fixture(t: TestContext) {
    const root = mkdtempSync(join(tmpdir(), 'docs examples 中文 ')), configDir = join(root, 'Claude Config'), project = join(root, 'Example Project');
    mkdirSync(configDir, { mode: 0o700 }); mkdirSync(project);
    const keys = ['GH_CONFIG_DIR', 'GH_TOKEN', 'GITHUB_TOKEN', 'GH_ENTERPRISE_TOKEN', 'GITHUB_ENTERPRISE_TOKEN'];
    const previous = keys.map(key => [key, process.env[key]] as const);
    for (const key of keys) delete process.env[key];
    process.env.GH_CONFIG_DIR = join(root, 'isolated-gh');
    t.after(() => {
        for (const [key, value] of previous) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
        removeTree(root); assert(!existsSync(root), 'Owned fixture must actually be removed');
    });
    // The real CLI creates the durable job. Its detached launch is harmless;
    // the controlled worker below settles it through the production service.
    const launch = { executable: process.execPath, args: ['-e', 'process.exit(0)'] };
    writeFileSync(join(configDir, 'settings.json'), jsonBytes({ statusLine: { type: 'command', command: commandFor(launch, 'render') } }), { mode: 0o600 });
    writeFileSync(join(configDir, 'claude-statusline.json'), jsonBytes({ ...defaultDisplay(), use_colors: false, instances: [] }), { mode: 0o600 });
    const context = { configDir, launch, hostVersion: () => [2, 1, 294] };
    const configuration = new ConfigurationService(context, createStorage());
    let githubResult: 'success' | 'no_checks' | 'no_pr' | 'account' | 'identity' = 'success', queries = 0;
    const worker = new SourceService(configuration, Date.now, () => {}, (source, actual, signal) => refreshGithub(source, actual, signal, async options => {
        queries++;
        assert.equal(options.executable, 'gh');
        assert.equal(options.cwd, actual.project);
        const args = options.args;
        if (args[0] === 'api') return { code: 0, reason: 'completed', stdout: JSON.stringify({ login: githubResult === 'account' ? 'other-login' : source.settings.account }) };
        assert(args.includes('github.com/owner/repository'), 'Every PR/check query stays bound to the documented repository');
        if (args[1] === 'checks') return { code: 0, reason: 'completed', stdout: JSON.stringify(githubResult === 'no_checks' ? [] : [{ bucket: 'pass', name: 'docs', state: 'SUCCESS', link: 'https://github.com/owner/repository/actions/runs/1' }]) };
        if (args[1] === 'list') return { code: 0, reason: 'completed', stdout: JSON.stringify(githubResult === 'no_pr' ? [] : [{ number: 7, url: 'https://github.com/owner/repository/pull/7', headRefName: actual.branch, headRefOid: githubResult === 'identity' ? 'f'.repeat(40) : actual.head }]) };
        assert.equal(args[1], 'view');
        return { code: 0, reason: 'completed', stdout: JSON.stringify({ headRefOid: actual.head }) };
    }));
    const values = new Map<string, string>([
        ['/absolute/project', project], ['/absolute/path/queue.json', join(project, 'queue.json')],
        ['forge-source.json', join(project, 'forge-source.json')], ['answer-source.json', join(project, 'answer-source.json')],
        ['C:\\Users\\Example\\Claude Config', configDir], ['C:\\Work\\Example Project', project],
        ['C:\\Work\\Example Project\\answer-source.json', join(project, 'answer-source.json')],
    ]);
    const git = (...args: string[]) => execFileSync('git', ['-c', 'core.hooksPath=' + join(root, 'no-hooks'), '-c', 'commit.gpgsign=false', '-C', project, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    const call = async (argv: string[], stdin = ''): Promise<Reply> => {
        let out = '', err = '', done = false;
        const prior = new Set(worker.jobs().map(job => job.id));
        const pending = main(argv, { ...context, stdin: () => stdin, stdout: text => { out += text; }, stderr: text => { err += text; } }).finally(() => { done = true; });
        if (argv[0] === 'source' && argv.includes('refresh')) {
            const end = Date.now() + 5000;
            while (!done && Date.now() < end) {
                const job = worker.jobs().find(job => !prior.has(job.id) && job.state === 'running');
                if (job) { await worker.work(job.id); break; }
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }
        return { code: await pending, out, err };
    };
    const line = (text: string) => {
        const tokens = splitCommand(text); assert(tokens?.length && /^claude-statusline(?:\.cmd)?$/u.test(tokens[0]!), text);
        const argv = tokens.slice(1).map(token => values.get(token) ?? token);
        assert(['source', 'config', 'setup'].includes(argv[0]!), 'Only fixture-bound documentation commands are admitted');
        for (const token of argv) assert(!/^(?:REVIEW_REVISION|(?:PR_|CI_)?INSTANCE_ID|TARGET_REV|ALIGNMENT_IDS)$/u.test(token), 'Unresolved placeholder ' + token);
        return argv;
    };
    return { root, configDir, project, configuration, worker, git, values, line, call,
        result: (value: typeof githubResult) => { githubResult = value; }, queries: () => queries };
}
function snapshot(root: string): unknown {
    return readdirSync(root, { recursive: true }).map(String).filter(path => !path.split(/[\\/]/u).includes('.git')).sort().map(path => {
        const full = join(root, path), stat = statSync(full);
        return [path, stat.mode, stat.isFile() ? readFileSync(full).toString('base64') : null];
    });
}
function saveSource(f: ReturnType<typeof fixture>, body: string, kind: 'github' | 'command') {
    sourceExample(body, kind);
    const spec = JSON.parse(example(body, kind + '-source', 'json'));
    // A documentation change must never turn a validation test into arbitrary execution.
    if (kind === 'command') {
        assert.equal(spec.settings.executable, 'node');
        assert.deepEqual(spec.settings.args, ['-p', 'String(42)']);
        assert.equal(spec.settings.output, 'text');
        assert.deepEqual(spec.settings.input, {});
    }
    spec.scope.project = f.values.get(spec.scope.project) ?? spec.scope.project;
    if (kind === 'command') spec.settings.cwd = f.values.get(spec.settings.cwd) ?? spec.settings.cwd;
    writeFileSync(f.values.get(kind === 'github' ? 'forge-source.json' : 'answer-source.json')!, JSON.stringify(spec));
}
async function workflow(f: ReturnType<typeof fixture>, body: string, kind: 'github' | 'command', powershell = false) {
    const sourceId = kind === 'github' ? 'forge' : 'answer';
    saveSource(f, body, kind);
    const lines = example(body, powershell ? 'source-powershell' : kind + '-workflow', powershell ? 'powershell' : 'text').split('\n');
    for (const line of lines) {
        const argv = f.line(line);
        if (argv.includes('refresh')) {
            assert.equal(f.worker.jobs().length, 0, 'Registration, enablement and binding do not execute');
            for (const node of f.configuration.read().display.instances) assert.equal(f.worker.view(node.source, contextFor(f.project)).reason, 'not_refreshed');
        }
        const reply = await f.call(argv);
        assert.equal(reply.code, 0, line + '\n' + reply.out + reply.err);
        if (argv.includes('review')) f.values.set('REVIEW_REVISION', JSON.parse(reply.out).review_revision);
        if (argv[0] === 'config' && argv.includes('add')) {
            const type = argv.at(-1)!, id = reply.out.trim().split(/\r?\n/u).at(-1)!;
            assert(f.configuration.read().display.instances.some(node => node.id === id && node.type_id === type));
            f.values.set(type === 'github-pr' ? 'PR_INSTANCE_ID' : type === 'github-ci' ? 'CI_INSTANCE_ID' : 'INSTANCE_ID', id);
        }
        if (argv.includes('diagnose')) {
            const diagnosis = JSON.parse(reply.out); assert.equal(diagnosis.view.state, 'valid');
            if (kind === 'command') assert.equal(diagnosis.view.value, '42');
            else assert.equal(diagnosis.view.fields.ci, 'success');
            assert.equal(diagnosis.automatic.state, 'off');
        }
    }
    assert.equal(f.worker.source(sourceId).enabled, true);
    const render = await f.call(['render'], JSON.stringify({ cwd: f.project }));
    assert.equal(render.code, 0); assert.match(render.out, kind === 'command' ? /42/u : /7/u);
    return lines;
}

for (const suffix of ['', '.zh-CN']) {
    test(`documented command workflow executes and renders 42 with isolated files (${suffix || 'en'})`, async t => {
        const f = fixture(t), body = pages.get(`docs/EXTENSIONS${suffix}.md`)!;
        await workflow(f, body, 'command');
        const before = snapshot(f.root), unknown = await f.call(['source', 'reviev', 'answer', '--json']);
        assert.equal(unknown.code, 2); assert.equal(JSON.parse(unknown.out).error.code, 'invalid'); assert.deepEqual(snapshot(f.root), before);
        const old = f.values.get('REVIEW_REVISION')!, spec = f.values.get('answer-source.json')!;
        const changed = JSON.parse(readFileSync(spec, 'utf8')); changed.name += ' changed'; writeFileSync(spec, JSON.stringify(changed));
        assert.equal((await f.call(['source', 'edit', 'answer', '--file', spec, '--json'])).code, 0);
        const edited = snapshot(f.root), stale = await f.call(['source', 'enable', 'answer', '--review', old, '--json']);
        assert.equal(stale.code, 2); assert.equal(JSON.parse(stale.out).error.code, 'review'); assert.equal(f.worker.source('answer').enabled, false); assert.deepEqual(snapshot(f.root), edited);
    });
    test(`documented GitHub workflow binds both components and preserves non-success meanings (${suffix || 'en'})`, async t => {
        const f = fixture(t); f.git('init', '--initial-branch=feature/example');
        f.git('-c', 'user.name=Docs Test', '-c', 'user.email=docs@example.invalid', 'commit', '--allow-empty', '-m', 'fixture');
        await workflow(f, pages.get(`docs/EXTENSIONS${suffix}.md`)!, 'github');
        assert(f.queries() >= 4);
        for (const [mode, reason, ci] of [['no_checks', 'valid', 'no_checks'], ['no_pr', 'no_pr', undefined], ['account', 'account', undefined], ['identity', 'identity', undefined]] as const) {
            f.result(mode);
            const reply = await f.call(['source', 'refresh', 'forge', '--project', f.project, '--json']), job = JSON.parse(reply.out);
            const failed = mode === 'account' || mode === 'identity';
            assert.equal(reply.code, failed ? 2 : 0, mode); assert.equal(job.state, failed ? 'failed' : 'completed', mode); assert.equal(job.reason, reason, mode);
            const current = f.worker.diagnose('forge', contextFor(f.project));
            assert.equal(current.view.reason, reason, mode);
            if (ci) assert.equal(current.view.fields?.ci, ci);
            else assert.notEqual(current.view.fields?.ci, 'success', mode);
        }
    });
    test(`PowerShell source and setup argv preserve quoted paths (${suffix || 'en'})`, async t => {
        const f = fixture(t);
        await workflow(f, pages.get(`docs/EXTENSIONS${suffix}.md`)!, 'command', true);
        const lines = example(pages.get(`docs/SETUP${suffix}.md`)!, 'setup-powershell', 'powershell').split('\n');
        const before = snapshot(f.root);
        const dry = await f.call(f.line(lines[0]!)); assert([0, 1].includes(dry.code), dry.err);
        assert.deepEqual(snapshot(f.root), before, 'Setup dry-run preserves bytes and modes');
        const nonTty = await f.call(f.line(lines[1]!)); assert.equal(nonTty.code, 2);
        assert.deepEqual(snapshot(f.root), before, 'Non-TTY setup preserves bytes and modes');
    });
    for (const base of ['COMPOSITION', 'DRAFT_HISTORY']) test(`documented ${base} review requires exact approval and retains state on conflict (${suffix || 'en'})`, async t => {
        const f = fixture(t), draft = f.configuration.read();
        const display = { ...defaultDisplay(), instances: ['a', 'b', 'c', 'd'].map(id => ({ id, type_id: 'text', text: id, enabled: true, options: defaultItem() })) };
        display.layout = { mode: 'explicit', rows: [['a', 'b'], ['c', 'd']], alignments: [{ id: 'table', columns: [[{ kind: 'instance', id: 'a' }, { kind: 'instance', id: 'c' }], [{ kind: 'instance', id: 'b' }, { kind: 'instance', id: 'd' }]] }] };
        f.configuration.apply({ display, host: draft.host }, draft.revision);
        const baseline: ReadResult = { draft: { display, host: draft.host }, revision: draft.revision, installed: true, installation: {}, backend_version: 'docs-test', capabilities: {} as ReadResult['capabilities'] };
        const editor = new Editor({ catalog: [...ITEMS], options: {} } as DescribeResult, baseline), candidate = copyDraft(baseline.draft);
        candidate.display.instances.splice(1, 1); candidate.display.layout.rows[0] = ['a'];
        for (const key of ['q', 'escape']) {
            assert(editor.applyStructure(candidate));
            changesKey(editor, { key }, 'en', 80, 18);
            assert.deepEqual(editor.draft, baseline.draft); assert.equal(editor.history.undo.length, 0); assert.equal(editor.structureProposal, null);
        }
        assert(editor.applyStructure(candidate)); changesKey(editor, { key: 'a' }, 'en', 80, 18);
        assert.equal(editor.history.undo.length, 1); assert(editor.undo()); assert.deepEqual(editor.draft, baseline.draft);
        f.values.set('INSTANCE_ID', 'b');
        const lines = example(pages.get(`docs/${base}${suffix}.md`)!, 'alignment-review', 'text').split('\n');
        const preview = f.line(lines[0]!), before = snapshot(f.root);
        assert.equal((await f.call(preview.filter(arg => arg !== '--dry-run'))).code, 2); assert.deepEqual(snapshot(f.root), before);
        const review = await f.call(preview); assert.equal(review.code, 0);
        assert.deepEqual(snapshot(f.root), before, 'Not accepting a review leaves bytes/modes unchanged');
        const proposal = JSON.parse(review.out); assert.equal(proposal.repairs.length, 1);
        f.values.set('TARGET_REV', proposal.expected_revision); f.values.set('ALIGNMENT_IDS', proposal.repairs.map((repair: { id: string }) => repair.id).join(','));
        const accept = f.line(lines[1]!);
        assert.equal((await f.call(accept.map(arg => arg === 'table' ? 'other' : arg))).code, 2); assert.deepEqual(snapshot(f.root), before);
        assert.equal((await f.call(accept)).code, 0);
        const saved = f.configuration.read().display; assert.deepEqual(saved.instances.map(node => node.id), ['a', 'c', 'd']); assert.equal(saved.layout.alignments![0]!.columns.length, 1);
        const after = snapshot(f.root); assert.equal((await f.call(accept)).code, 2); assert.deepEqual(snapshot(f.root), after);
    });
}
