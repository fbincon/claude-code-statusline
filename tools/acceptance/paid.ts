/** Explicit, budgeted acceptance only. Importing this module never loads credentials or starts a host. */
import * as fs from 'node:fs';
import { join, resolve, dirname, delimiter } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { parseArgs } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { spawnSync } from 'node:child_process';
import { encode } from '@fbincon/statusline-core/json';
import { withLock } from '@fbincon/statusline-platform/files';
import { quoteArgument, splitCommand } from '@fbincon/statusline-platform/commands';
import { reserve, settle } from './budget.js';
import { backend, CASES, digest, parse, read, verifyTask, verifyMetrics, type Backend, type Case } from './paid-evidence.js';
import { repoRoot } from '../migration/ts-03/common.js';
const write = (path: string, data: unknown) => fs.writeFileSync(path, encode(data) + '\n', { mode: 0o600 });
export interface PaidOptions {
    root: string;
    ledger: string;
    cap: number;
    real: boolean;
    case: Case;
    suite: 'task' | 'metrics';
    entry: string;
    claude: string;
}
export interface Stream extends AsyncIterable<any> {
    interrupt(): Promise<unknown>;
    close(): void;
}
export type Query = (input: {
    prompt: string;
    options: Record<string, any>;
}) => Stream;
export const prompts: Record<Case, string> = {
    single: 'Reply exactly TIMER_SINGLE_OK. Use no tools.',
    compat: 'Reply exactly TIMER_COMPAT_OK. Use no tools.',
    'stop-continue': 'Reply exactly TIMER_INITIAL_STOP. Use no tools until instructed by a hook.',
    'single-agent': 'Start one timer-probe Agent synchronously. Ask it to run Bash sleep 1 then reply TIMER_AGENT_OK. After it finishes run Bash sleep 1 yourself and reply TIMER_WRAP_OK. Use no other tools or data.',
    parallel: 'Start two timer-probe Agents concurrently with run_in_background=true. Ask one to run Bash sleep 2 then reply TIMER_A_OK and the other Bash sleep 4 then TIMER_B_OK. Return WAITING_FOR_TIMER_PROBES without polling. After both reports arrive run Bash sleep 1 yourself and reply TIMER_PARALLEL_OK. Use no other tools or data.',
    wait: "Use AskUserQuestion exactly once to ask 'Proceed with the timer probe?' with Yes and No options. Then reply TIMER_WAIT_OK. Use no other tools.",
    interrupt: 'Run exactly Bash sleep 20 in the foreground, then reply TIMER_INTERRUPT_UNEXPECTED. Use no other tools.',
};
export function validatePaid(options: PaidOptions) {
    if (!options.real)
        throw new Error('Real calls require explicit --run-real-calls');
    if (!CASES.includes(options.case) || !['task', 'metrics'].includes(options.suite))
        throw new Error('Unsupported acceptance case');
    if (options.suite === 'metrics' && !['single', 'single-agent', 'parallel'].includes(options.case))
        throw new Error('Unsupported metrics case');
    if (fs.existsSync(options.root))
        throw new Error('Paid evidence requires a new private output directory');
    if (!fs.statSync(options.ledger).isFile())
        throw new Error('The existing shared ledger is required');
    if (!Number.isFinite(options.cap) || options.cap <= 0 || options.cap > 10)
        throw new Error('Invalid paid call cap');
}
function prepare(options: PaidOptions) {
    const version = spawnSync(options.claude, ['--version'], { encoding: 'utf8', timeout: 10000 });
    if (version.status !== 0 || !/^2\.1\.296\b/u.test(version.stdout))
        throw new Error('Paid harness requires the pinned Claude Code 2.1.296 host');
    fs.mkdirSync(options.root, { recursive: false, mode: 0o700 });
    const config = join(options.root, 'Claude config 中文'), project = join(options.root, 'project with spaces 中文');
    fs.mkdirSync(config, { mode: 0o700 });
    fs.mkdirSync(project, { mode: 0o700 });
    const source = join(process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude'), 'settings.json');
    const old = fs.existsSync(source) ? read(source) : {};
    const settings = Object.fromEntries(['apiKeyHelper', 'env', 'model'].filter(key => key in old).map(key => [key, old[key]]));
    write(join(config, 'settings.json'), { ...settings, theme: 'dark' });
    write(join(config, '.claude.json'), { hasCompletedOnboarding: true, theme: 'dark', projects: { [project]: { hasTrustDialogAccepted: true } } });
    const hostBin = join(options.root, 'host-bin');
    fs.mkdirSync(hostBin);
    fs.symlinkSync(options.claude, join(hostBin, process.platform === 'win32' ? 'claude.exe' : 'claude'));
    const env: NodeJS.ProcessEnv = { ...process.env, CLAUDE_CONFIG_DIR: config, CLAUDE_STATUSLINE_RUNTIME_DIR: join(config, 'statusline_runtime'),
        PATH: hostBin + delimiter + (process.env.PATH || ''), DISABLE_AUTOUPDATER: '1', CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1' };
    delete (env as NodeJS.ProcessEnv).CLAUDECODE;
    const run = backend(options.entry, config, env);
    run(['install', '--no-native-editor', options.case === 'compat' ? '--no-live-metrics' : '--live-metrics', '--config-dir', config]);
    run(['config', 'set-items', 'task-timer', 'task-active-timer']);
    const path = join(config, 'settings.json'), installed = read(path);
    const command = [process.execPath, fileURLToPath(import.meta.url), '--capture-hook', options.root, '--entry', options.entry, '--case', options.case].map(quoteArgument).join(' ');
    for (const groups of Object.values(installed.hooks) as any[][])
        for (const group of groups)
            for (const hook of group.hooks ?? []) {
                const argv = splitCommand(hook.command ?? '');
                if (hook.type === 'command' && argv?.at(-1) === 'hook' && argv.includes(options.entry))
                    hook.command = command;
            }
    write(path, installed);
    write(join(options.root, 'provenance.json'), { entry: options.entry, entry_sha256: digest(fs.readFileSync(options.entry, 'utf8')), node: process.version, host: version.stdout.trim(), suite: options.suite, case: options.case });
    return { config, project, env, run };
}
export async function runStream(options: PaidOptions, query: Query, prepared: {
    project: string;
    env: NodeJS.ProcessEnv;
}, result: (value: any) => void) {
    const abortController = new AbortController();
    const timer = setTimeout(() => abortController.abort(), 180000);
    let stream: Stream | undefined, interrupted = false;
    try {
        stream = query({ prompt: prompts[options.case], options: {
                pathToClaudeCodeExecutable: options.claude, cwd: prepared.project, env: prepared.env, abortController,
                settingSources: ['user'], maxBudgetUsd: options.cap, maxTurns: 12, strictMcpConfig: true, mcpServers: {},
                extraArgs: { 'disable-slash-commands': null, 'include-hook-events': null },
                tools: ['single', 'compat'].includes(options.case) ? [] : options.case === 'wait' ? ['AskUserQuestion'] : options.case === 'interrupt' ? ['Bash'] : ['Agent', 'Bash'],
                allowedTools: [],
                agents: { 'timer-probe': { description: 'Run only a requested timer acceptance sleep', prompt: 'Run only the requested sleep and return its marker. Do not access files or other data.', tools: ['Bash'] } },
                hooks: { PreToolUse: [{ hooks: [async () => ({ continue: true })] }] },
                canUseTool: async (tool: string, input: any) => {
                    if (tool === 'AskUserQuestion' && options.case === 'wait' && Array.isArray(input.questions)) {
                        const start = performance.now();
                        await delay(2000, undefined, { signal: abortController.signal });
                        fs.appendFileSync(join(options.root, 'controlled-input.jsonl'), encode({ tool, wait_seconds: (performance.now() - start) / 1000 }) + '\n', { mode: 0o600 });
                        return { behavior: 'allow', updatedInput: { ...input, answers: Object.fromEntries(input.questions.map((q: any) => [q.question, q.options[0].label])) } };
                    }
                    if ((tool === 'Bash' && /^sleep (?:1|2|4|20)$/u.test(input.command)) || (tool === 'Agent' && ['single-agent', 'parallel'].includes(options.case) && input.subagent_type === 'timer-probe'))
                        return { behavior: 'allow', updatedInput: input };
                    return { behavior: 'deny', message: 'Only this acceptance case is authorized' };
                },
                stderr: (text: string) => fs.appendFileSync(join(options.root, 'stderr.log'), text, { mode: 0o600 }),
            } });
        for await (const message of stream) {
            fs.appendFileSync(join(options.root, 'stream.jsonl'), encode(message) + '\n', { mode: 0o600 });
            if (message.type === 'result')
                result(message);
            if (options.case === 'interrupt' && !interrupted && message.message?.content?.some((block: any) => block.type === 'tool_use' && block.name === 'Bash')) {
                await delay(1000, undefined, { signal: abortController.signal });
                await stream.interrupt();
                interrupted = true;
            }
        }
        if (options.case === 'interrupt' && !interrupted)
            throw new Error('No observed tool was interrupted');
    }
    finally {
        clearTimeout(timer);
        stream?.close();
    }
}
export async function executePaid(options: PaidOptions, dependencies?: {
    prepare: typeof prepare;
    query: Query;
    verify: (root: string, run: Backend, name: Case, config: string) => Promise<unknown>;
}) {
    validatePaid(options);
    // Import the acceptance-only SDK before reserving funds or touching provider settings.
    const require = createRequire(join(repoRoot, 'tools/acceptance/package.json'));
    const query: Query = dependencies?.query ?? (await import(pathToFileURL(require.resolve('@anthropic-ai/claude-agent-sdk')).href)).query;
    const identity = reserve(options.ledger, options.root, options.cap);
    let final: any = null, startedCall = false, prepared: ReturnType<typeof prepare> | undefined;
    const report: Record<string, any> = { passed: false, attempt_id: identity, case: options.case, cap_usd: options.cap, manual_interaction_acceptance: false, real_machine_suspend_acceptance: false };
    try {
        prepared = (dependencies?.prepare ?? prepare)(options);
        startedCall = true;
        await runStream(options, query, prepared, value => { final = value; });
        if (!final || (final.is_error && options.case !== 'interrupt'))
            throw new Error('Real session failed; inspect private evidence');
        const verify = dependencies?.verify ?? (options.suite === 'metrics' ? async (_root, run, name, config) => verifyMetrics(config, run, name) : verifyTask);
        Object.assign(report, await verify(options.root, prepared.run, options.case, prepared.config));
    }
    catch (error) {
        report.error = error instanceof Error ? error.message : String(error);
    }
    finally {
        report.cost_usd = startedCall ? final?.total_cost_usd ?? null : 0;
        report.accounted_total_usd = settle(options.ledger, identity, report.cost_usd);
        if (fs.existsSync(options.root)) {
            write(join(options.root, 'cost.json'), report);
            write(join(options.root, 'report.json'), report);
        }
    }
    return report;
}
export function captureHook(root: string, entry: string, caseName: Case) {
    const payload = fs.readFileSync(0, 'utf8'), event = parse(payload), received_wall_ns = BigInt(Date.now()) * 1000000n;
    const config = process.env.CLAUDE_CONFIG_DIR!;
    backend(entry, config)(['hook'], event);
    const path = join(config, 'statusline_runtime/turns', digest(event.session_id) + '.json');
    const state = fs.existsSync(path) ? read(path).lifecycle.turns.find((row: any) => row.prompt_id === event.prompt_id) ?? null : null;
    withLock(join(root, 'hooks.lock'), () => fs.appendFileSync(join(root, 'hooks.jsonl'), encode({ received_wall_ns, event, state }) + '\n', { mode: 0o600 }));
    if (caseName === 'stop-continue' && event.hook_event_name === 'Stop')
        withLock(join(root, 'continuation.lock'), () => {
            const flag = join(root, 'continuation.json');
            if (!fs.existsSync(flag)) {
                write(flag, { wall_ns: received_wall_ns });
                console.log(JSON.stringify({ decision: 'block', reason: 'Continue the same task: run Bash sleep 1 and then reply TIMER_CONTINUED_OK.' }));
            }
        });
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const { values } = parseArgs({ options: { root: { type: 'string' }, entry: { type: 'string' }, claude: { type: 'string' }, case: { type: 'string', default: 'single' }, suite: { type: 'string', default: 'task' }, 'budget-ledger': { type: 'string' }, 'cap-usd': { type: 'string', default: '1' }, 'run-real-calls': { type: 'boolean', default: false }, 'capture-hook': { type: 'string' } } });
    if (!values.entry || !CASES.includes(values.case as Case))
        throw new Error('Require --entry ABSOLUTE_INSTALLED_JS and a supported --case');
    if (values['capture-hook'])
        captureHook(resolve(values['capture-hook']), resolve(values.entry), values.case as Case);
    else {
        if (!values.root)
            throw new Error('--root is required');
        const root = resolve(values.root), config = join(root, 'Claude config 中文');
        const report = values['run-real-calls'] ? await executePaid({ root, entry: resolve(values.entry), claude: resolve(values.claude ?? ''), ledger: resolve(values['budget-ledger'] ?? ''), cap: Number(values['cap-usd']), real: true, case: values.case as Case, suite: values.suite as 'task' | 'metrics' })
            : values.suite === 'metrics' ? await verifyMetrics(config, backend(resolve(values.entry), config), values.case as Case) : await verifyTask(root, backend(resolve(values.entry), config), values.case as Case, config);
        console.log(encode(report));
        if (!report.passed)
            process.exitCode = 1;
    }
}
