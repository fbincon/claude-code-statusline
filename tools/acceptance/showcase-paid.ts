/** Explicit SHOWCASE recording only. Never called by ordinary checks or CI. */
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { randomUUID } from 'node:crypto';
import { StringDecoder } from 'node:string_decoder';
import { setTimeout as delay } from 'node:timers/promises';
import { reserve, settle } from './budget.js';
import { installCandidate } from './install.js';
import { sha256 } from '../build/files.js';
import { repoRoot } from '../migration/ts-03/common.js';

const PRODUCT = 'c89a2ca088099ccd3ceb76baf59ecf11d84b08f0';
const TARBALL = '2030ef2f8d386b2fcb1f616fb49ce6f16eed92ec21ea22486799da68151b8c8a';
const write = (path: string, data: unknown) => fs.writeFileSync(path, JSON.stringify(data, null, 2) + '\n', { mode: 0o600 });

export function paidArguments(kind: 'single' | 'parallel', session: string, cap: number): string[] {
    assert(Number.isFinite(cap) && cap > 0 && cap <= 2, 'A recording reserves at most USD 2');
    assert(['single', 'parallel'].includes(kind));
    return ['--print', '--verbose', '--output-format', 'stream-json', '--include-hook-events', '--session-id', session,
        '--max-budget-usd', String(cap), '--max-turns', '12', '--effort', 'low', '--disable-slash-commands',
        '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}', '--permission-mode', 'dontAsk',
        '--tools', kind === 'single' ? '' : 'Agent,Bash',
        ...(kind === 'parallel' ? ['--allowedTools', 'Agent', 'Bash(sleep 2)', 'Bash(sleep 4)', '--agents', JSON.stringify({
            'showcase-probe': { description: 'A controlled statusline demonstration worker',
                prompt: 'Run only the requested sleep command, then return the requested marker. Do not read files, use other tools or delegate.', tools: ['Bash'], model: 'inherit' },
        })] : [])];
}

export interface TimedMessage { elapsed_ms: number; message: any }
export function verifyPaidEvents(kind: 'single' | 'parallel', events: TimedMessage[]) {
    const toolCalls = events.flatMap(row => row.message.message?.content ?? []).filter(block => block.type === 'tool_use');
    const final = events.findLast(row => row.message.type === 'result' &&
        String(row.message.result).includes(kind === 'single' ? 'SHOWCASE_SINGLE_OK' : 'SHOWCASE_PARALLEL_OK'));
    assert(final && !final.message.is_error, 'Requested task did not complete');
    if (kind === 'single') {
        assert.equal(toolCalls.length, 0, 'Single recording must not execute tools');
        return { kind, requested_result_observed: true, agent_calls: 0, completed_agents: 0, allowed_sleep_calls: 0, concurrent: false };
    }
    const agents = toolCalls.filter(block => block.name === 'Agent'), sleeps = toolCalls.filter(block => block.name === 'Bash');
    assert.equal(agents.length, 2, 'Exactly two actual Agent invocations are required');
    assert.equal(new Set(agents.map(agent => agent.id)).size, 2, 'Agent tool identities must be distinct');
    assert.equal(toolCalls.length, 4, 'Only two agents and their two sleep commands are allowed');
    assert.deepEqual(sleeps.map(block => block.input?.command).sort(), ['sleep 2', 'sleep 4'], 'Unexpected command executed');
    const starts: number[] = [], endings: number[] = [], observed = new Set<string>();
    for (const agent of agents) {
        assert.equal(agent.input?.subagent_type, 'showcase-probe');
        assert.equal(agent.input?.run_in_background, true, 'Agent must be explicitly backgrounded');
        const prompt = String(agent.input?.prompt), expected = prompt.includes('SHOWCASE_ALPHA_OK') ? 'SHOWCASE_ALPHA_OK' : 'SHOWCASE_BETA_OK';
        assert(prompt.includes(expected) && !observed.has(expected), 'Distinct requested agent markers are required');
        assert(new RegExp('\\bsleep ' + (expected === 'SHOWCASE_ALPHA_OK' ? '2' : '4') + '\\b', 'u').test(prompt), 'Agent sleep differs from the approved prompt');
        observed.add(expected);
        const launched = events.filter(row => row.message.type === 'system' && row.message.subtype === 'task_started' && row.message.tool_use_id === agent.id);
        const completed = events.filter(row => row.message.type === 'system' && row.message.subtype === 'task_notification' && row.message.tool_use_id === agent.id);
        assert.equal(launched.length, 1, 'Missing or duplicate agent start event');
        assert.equal(completed.length, 1, 'Missing or duplicate agent completion event');
        const start = launched[0]!, end = completed[0]!;
        assert.equal(start.message.subagent_type, 'showcase-probe'); assert.equal(start.message.is_backgrounded, true);
        assert.equal(end.message.status, 'completed', 'Agent did not complete');
        assert.equal(end.message.task_id, start.message.task_id); assert.equal(end.message.run_id, start.message.run_id);
        assert(String(end.message.summary).includes(expected), 'Agent completion marker is missing');
        assert(start.elapsed_ms <= end.elapsed_ms && end.elapsed_ms <= final.elapsed_ms, 'Agent completed outside the observed task');
        starts.push(start.elapsed_ms); endings.push(end.elapsed_ms);
    }
    assert(Math.max(...starts) < Math.min(...endings), 'Two agents did not overlap');
    return { kind, requested_result_observed: true, agent_calls: 2, completed_agents: 2, allowed_sleep_calls: 2, concurrent: true };
}

/** The isolated installer must run before this function, so its before-images never contain authentication. */
export async function withRecordingAuthentication<T>(config: string, authentication: Record<string, any>, action: () => Promise<T>): Promise<T> {
    const path = join(config, 'settings.json'), original = fs.readFileSync(path), settings = JSON.parse(original.toString('utf8'));
    const selected = Object.fromEntries(['apiKeyHelper', 'env', 'model'].filter(key => key in authentication).map(key => [key, authentication[key]]));
    assert(selected.apiKeyHelper || selected.env?.ANTHROPIC_API_KEY || selected.env?.ANTHROPIC_AUTH_TOKEN,
        'This isolated recording requires the existing helper or explicit provider environment; no credential discovery');
    assert(['apiKeyHelper', 'env', 'model'].every(key => !Object.hasOwn(settings, key)), 'Recording authentication requires an initially clean fixture');
    const mode = fs.statSync(path).mode & 0o777;
    try { write(path, { ...settings, ...selected }); return await action(); }
    finally {
        fs.writeFileSync(path, original, { mode });
        if (process.platform !== 'win32') fs.chmodSync(path, mode);
        assert(fs.readFileSync(path).equals(original), 'Authentication removal did not restore the isolated settings');
    }
}

export interface RecordedProcess {
    started: boolean;
    reason: 'completed' | 'exit' | 'spawn_error' | 'observer_error' | 'invalid_output' | 'output_limit' | 'timeout' | 'cancelled' | 'termination_unknown';
    exit_code: number | null;
    process_group_terminated: boolean;
    events: TimedMessage[];
    result: any;
}

/** Linux recording supervisor. Every observer failure follows the same bounded group termination path. */
export async function runRecordedProcess(options: { executable: string; args: string[]; cwd: string; environment: NodeJS.ProcessEnv;
    input: string; timeoutMs?: number; signal?: AbortSignal; stdout: (chunk: Buffer) => void; stderr: (raw: Buffer) => void }): Promise<RecordedProcess> {
    assert.equal(process.platform, 'linux', 'Paid showcase recording is scoped to the observed Linux host');
    if (options.signal?.aborted) return { started: false, reason: 'cancelled', exit_code: null, process_group_terminated: true, events: [], result: null };
    return new Promise(resolveProcess => {
        const startedAt = performance.now(), decoder = new StringDecoder('utf8'), events: TimedMessage[] = [], stderr: Buffer[] = [];
        let started = false, reason: RecordedProcess['reason'] = 'completed', code: number | null = null, result: any = null;
        let remainder = '', bytes = 0, finishing = false, closed = false;
        const child = spawn(options.executable, options.args, { cwd: options.cwd, env: options.environment,
            stdio: ['pipe', 'pipe', 'pipe'], detached: true, shell: false });
        const groupGone = () => {
            if (!child.pid) return true;
            try { process.kill(-child.pid, 0); return false; }
            catch (error) { return (error as NodeJS.ErrnoException).code === 'ESRCH'; }
        };
        const signalGroup = (signal: NodeJS.Signals) => { try { if (child.pid) process.kill(-child.pid, signal); } catch { /* Confirmation below stays mandatory. */ } };
        const finish = async () => {
            if (finishing) return;
            finishing = true; clearTimeout(timer);
            options.signal?.removeEventListener('abort', abort);
            signalGroup('SIGTERM');
            const stop = performance.now() + 5000, escalate = performance.now() + 250;
            while ((!closed || !groupGone()) && performance.now() < stop) {
                if (performance.now() >= escalate) signalGroup('SIGKILL');
                await delay(25);
            }
            const terminated = closed && groupGone();
            if (!terminated) reason = 'termination_unknown';
            child.stdin.destroy(); child.stdout.destroy(); child.stderr.destroy();
            if (!terminated) child.unref();
            try { options.stderr(Buffer.concat(stderr)); }
            catch { if (reason !== 'termination_unknown') reason = 'observer_error'; }
            if (reason === 'completed' && code !== 0) reason = 'exit';
            resolveProcess({ started, reason, exit_code: code, process_group_terminated: terminated, events, result });
        };
        const fail = (value: RecordedProcess['reason']) => { if (reason === 'completed') reason = value; void finish(); };
        const abort = () => fail('cancelled');
        const timer = setTimeout(() => fail('timeout'), options.timeoutMs ?? 180000);
        options.signal?.addEventListener('abort', abort, { once: true });
        if (options.signal?.aborted) abort();
        const parseLine = (line: string) => {
            if (!line.trim()) return;
            try {
                const message = JSON.parse(line); events.push({ elapsed_ms: performance.now() - startedAt, message });
                if (message.type === 'result') result = message;
            } catch { fail('invalid_output'); }
        };
        child.on('spawn', () => { started = true; });
        child.on('error', () => fail('spawn_error'));
        child.stdout.on('error', () => fail('observer_error'));
        child.stderr.on('error', () => fail('observer_error'));
        child.stdin.on('error', error => { if ((error as NodeJS.ErrnoException).code !== 'EPIPE') fail('observer_error'); });
        child.stdout.on('data', (chunk: Buffer) => {
            if (reason !== 'completed') return;
            bytes += chunk.length; if (bytes > 8 * 1024 * 1024) { fail('output_limit'); return; }
            try { options.stdout(chunk); } catch { fail('observer_error'); return; }
            remainder += decoder.write(chunk);
            let newline: number;
            while (reason === 'completed' && (newline = remainder.indexOf('\n')) >= 0) {
                const line = remainder.slice(0, newline); remainder = remainder.slice(newline + 1); parseLine(line);
            }
        });
        child.stdout.on('end', () => {
            if (reason !== 'completed') return;
            remainder += decoder.end(); if (remainder) parseLine(remainder); remainder = '';
        });
        child.stderr.on('data', (chunk: Buffer) => {
            if (reason !== 'completed') return;
            bytes += chunk.length; if (bytes > 8 * 1024 * 1024) { fail('output_limit'); return; }
            stderr.push(Buffer.from(chunk));
        });
        child.on('exit', value => { code = value; void finish(); });
        child.on('close', () => { closed = true; void finish(); });
        child.stdin.end(options.input);
    });
}

export async function budgetRecording(ledger: string, name: string, cap: number, run: () => Promise<RecordedProcess>) {
    const attempt = reserve(ledger, name, cap);
    let outcome: RecordedProcess | undefined;
    try { outcome = await run(); return outcome; }
    finally {
        const trusted = outcome?.process_group_terminated && ['completed', 'exit'].includes(outcome.reason);
        const cost = outcome?.started === false ? 0 : trusted ? outcome?.result?.total_cost_usd ?? null : null;
        const accounted = settle(ledger, attempt, cost);
        if (outcome) Object.assign(outcome, { attempt_id: attempt, cost_usd: cost, accounted_total_usd: accounted });
    }
}

export async function recordPaid(options: { artifact: string; output: string; claude: string; authConfig: string; ledger: string; real: boolean }) {
    assert(options.real, 'Explicit --run-real-calls is required');
    assert.equal(process.platform, 'linux', 'Paid showcase recording is scoped to the observed Linux host');
    assert(!fs.existsSync(options.output), 'Use a new private output directory');
    assert.equal(sha256(fs.readFileSync(options.artifact)), TARBALL, 'Unapproved demonstration package');
    assert(fs.statSync(options.ledger).isFile(), 'Use the task-wide existing budget ledger');
    const host = spawnSync(options.claude, ['--version'], { encoding: 'utf8', timeout: 10000 });
    assert.equal(host.status, 0); assert(/^2\.1\.314\b/u.test(host.stdout), 'Recording fixes the observed 2.1.314 host');
    fs.mkdirSync(options.output, { recursive: true, mode: 0o700 });
    const installed = installCandidate(options.artifact, PRODUCT), config = installed.env.CLAUDE_CONFIG_DIR;
    const project = join(installed.temporary, 'showcase-project'); fs.mkdirSync(project); fs.mkdirSync(config, { mode: 0o700 });
    write(join(config, 'settings.json'), { theme: 'dark' });
    write(join(config, '.claude.json'), { hasCompletedOnboarding: true, theme: 'dark', projects: { [project]: { hasTrustDialogAccepted: true } } });
    const env: NodeJS.ProcessEnv = { ...process.env, CLAUDE_CONFIG_DIR: config, CLAUDE_STATUSLINE_RUNTIME_DIR: join(config, 'statusline_runtime'),
        DISABLE_AUTOUPDATER: '1', CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1' };
    delete env.CLAUDECODE;
    const command = (args: string[], input = '') => {
        const r = spawnSync(installed.node, [installed.entry, ...args], { cwd: project, env, encoding: 'utf8', input, timeout: 90000 });
        assert.equal(r.status, 0, 'Installed configuration command failed (private output retained)'); return r.stdout;
    };
    const fixture = { temporary: installed.temporary, root: installed.root, modules: installed.modules, entry: installed.entry, node: installed.node,
        project, config, artifact: options.artifact, product_commit: PRODUCT, artifact_sha256: TARBALL, host: host.stdout.trim(),
        collector: { commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim(),
            working_tree_changes: Boolean(execFileSync('git', ['status', '--porcelain=v1', '--', 'tools/acceptance/showcase-paid.ts'], { cwd: repoRoot, encoding: 'utf8' }).trim()),
            source_sha256: sha256(fs.readFileSync(join(repoRoot, 'tools/acceptance/showcase-paid.ts'))),
            compiled_sha256: sha256(fs.readFileSync(fileURLToPath(import.meta.url))) } };
    write(join(options.output, 'fixture.json'), fixture);
    const records: Record<string, unknown>[] = [];
    command(['install', '--no-native-editor', '--live-metrics', '--config-dir', config]);
    command(['config', 'set-items', 'model', 'current-dir', 'task-timer', 'task-active-timer', 'cost']);
    command(['config', 'set', 'separator-style', 'compact']);
    command(['config', 'set', 'directory-style', 'basename']);
    const authentication = JSON.parse(fs.readFileSync(join(options.authConfig, 'settings.json'), 'utf8'));
    await withRecordingAuthentication(config, authentication, async () => {
        const prompts = {
            single: 'Reply exactly SHOWCASE_SINGLE_OK. Do not use tools.',
            parallel: 'Start exactly two showcase-probe Agents concurrently using run_in_background=true. Ask one to run Bash sleep 2 and reply SHOWCASE_ALPHA_OK; ask the other to run Bash sleep 4 and reply SHOWCASE_BETA_OK. Wait for both completion notifications without polling or other tools, then reply SHOWCASE_PARALLEL_OK. Do not access files or external data.',
        };
        for (const kind of ['single', 'parallel'] as const) {
            const cap = kind === 'single' ? 1 : 2, session = randomUUID(), directory = join(options.output, kind); fs.mkdirSync(directory, { mode: 0o700 });
            const start = performance.now(), controller = new AbortController();
            const interrupted = () => controller.abort();
            process.once('SIGINT', interrupted); process.once('SIGTERM', interrupted);
            let outcome: (RecordedProcess & { attempt_id?: string; cost_usd?: unknown; accounted_total_usd?: number }) | undefined;
            let verified: ReturnType<typeof verifyPaidEvents> | undefined;
            let status = 'fail', failure: string | null = null;
            try {
                outcome = await budgetRecording(options.ledger, 'showcase-' + kind, cap, () => runRecordedProcess({
                    executable: options.claude, args: paidArguments(kind, session, cap), cwd: project, environment: env,
                    input: prompts[kind], signal: controller.signal,
                    stdout: chunk => fs.appendFileSync(join(directory, 'stdout.jsonl'), chunk, { mode: 0o600 }),
                    stderr: raw => fs.writeFileSync(join(directory, 'stderr.log'), raw, { mode: 0o600 }),
                }));
                assert.equal(outcome.reason, 'completed', 'Paid recording failed: ' + outcome.reason);
                assert(outcome.process_group_terminated, 'Paid process group termination is unconfirmed');
                assert(outcome.result && !outcome.result.is_error, 'No successful cost-bearing final result');
                verified = verifyPaidEvents(kind, outcome.events);
                status = 'pass';
            } catch (error) { failure = String(error); }
            finally {
                process.removeListener('SIGINT', interrupted); process.removeListener('SIGTERM', interrupted);
                write(join(directory, 'timed-stream.json'), outcome?.events ?? []);
                const record = { kind, session_id: session, attempt_id: outcome?.attempt_id ?? null, cap_usd: cap,
                    cost_usd: outcome?.cost_usd ?? null, accounted_total_usd: outcome?.accounted_total_usd ?? null,
                    status, error: failure, elapsed_ms: performance.now() - start, result_usage: outcome?.result?.usage ?? null,
                    process_group_terminated: outcome?.process_group_terminated ?? false, verification: verified ?? null,
                    cost_source: 'Claude CLI total_cost_usd; provider invoice not independently inspected', prompt: prompts[kind] };
                records.push(record); write(join(directory, 'receipt.json'), record); write(join(options.output, 'receipt.json'), { ...fixture, records });
            }
            assert.equal(status, 'pass', 'Paid recording failed; inspect private receipt before another attempt');
        }
    });
    return { ...fixture, records };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const { values } = parseArgs({ options: { artifact: { type: 'string' }, output: { type: 'string' }, claude: { type: 'string' },
        'auth-config': { type: 'string' }, 'budget-ledger': { type: 'string' }, 'run-real-calls': { type: 'boolean', default: false } } });
    for (const name of ['artifact', 'output', 'claude', 'auth-config', 'budget-ledger'] as const) assert(values[name], 'Required --' + name);
    const result = await recordPaid({ artifact: resolve(values.artifact!), output: resolve(values.output!), claude: resolve(values.claude!),
        authConfig: resolve(values['auth-config']!), ledger: resolve(values['budget-ledger']!), real: values['run-real-calls']! });
    console.log(JSON.stringify({ status: 'pass', records: result.records.length, product_commit: PRODUCT }));
}
