/** Offline production rendering of the completed, explicitly paid SHOWCASE observations. */
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { installCandidate } from './install.js';
import { verifyDelivery } from '../build/verify.js';
import { sha256 } from '../build/files.js';
import { Capture } from '../migration/ts-04/capture.js';
import { renderCapture } from './render-capture.js';
import { SHOWCASE_BASELINE, requireRemoved } from './showcase.js';
import { applyShowcaseVisuals, requireShowcaseVisuals } from './showcase-driver.js';
import { isolatedRecordingEnvironment, requireColoredCapture } from './showcase-journeys.js';
import { verifyPaidEvents, type TimedMessage } from './showcase-paid.js';
import { parse } from './paid-evidence.js';
import { repoRoot } from '../migration/ts-03/common.js';

const write = (path: string, value: unknown) => fs.writeFileSync(path, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
const safeId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/u.test(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;

export function requireCompletedTurn(turn: any): void {
    assert(turn && turn.status === 'completed' && Object.keys(turn.active_agents ?? {}).length === 0, 'Replay requires a completed main task with no active agents');
    assert(safeId(turn.prompt_id), 'Completed task prompt identity is required');
    assert(turn.duration_ns !== null && turn.duration_ns !== undefined && BigInt(turn.duration_ns) >= 0n, 'A frozen task duration is required');
    assert(turn.ended_wall_ns !== null && turn.ended_wall_ns !== undefined, 'A real task ending is required');
}

export function deriveReplayInput(events: TimedMessage[], session: string, turn: any, live: any, durations: any, transcript: string) {
    requireCompletedTurn(turn); assert(safeId(session), 'A safe observed session identity is required');
    const verification = verifyPaidEvents('parallel', events), messages = events.map(row => row.message);
    const result = messages.findLast(message => message.type === 'result' && message.session_id === session &&
        String(message.result).includes('SHOWCASE_PARALLEL_OK'));
    assert(result && !result.is_error, 'The actual main result must match the observed session');
    const init = messages.find(message => message.type === 'system' && message.subtype === 'init' && message.session_id === session);
    const main: Record<string, unknown> = { session_id: session, prompt_id: turn.prompt_id, transcript_path: transcript, columns: 120 };
    const fieldSources: Record<string, string> = {
        session_id: 'paid parallel receipt and matching completed task-store session', prompt_id: 'completed task-store turn.prompt_id',
        transcript_path: 'byte-identical copied main transcript; only its filesystem location is changed', columns: 'replay presentation width, not a captured host field',
        task_timing: 'production renderer reads the copied task store and transcript; no clock override',
    };
    if (typeof init?.model === 'string' && init.model) {
        main.model = { id: init.model }; fieldSources['model.id'] = 'derived replay field from the actual CLI system/init model; not a captured statusline callback';
    }
    if (finite(result.total_cost_usd)) {
        main.cost = { total_cost_usd: result.total_cost_usd };
        fieldSources['cost.total_cost_usd'] = 'derived replay field from CLI result.total_cost_usd for this single-task session; provider invoice not independently inspected';
    }
    const agentCalls = messages.flatMap(message => message.message?.content ?? []).filter(block => block.type === 'tool_use' && block.name === 'Agent');
    const tasks: Record<string, unknown>[] = [], limitations = [
        'This is offline rendering of actual completed-task observations, not an interactive Claude statusline screen recording.',
        'No original statusline/render-subagents callback payload was captured; the explicit input mapping records reconstruction.',
        'Missing context, quota, workspace, Git, effort and agent model/token fields are omitted; no sample values are substituted.',
        'The live store retains its original heartbeat and can be stale at replay time; completed durations are not advanced.',
    ];
    if (finite(result.total_cost_usd) && result.total_cost_usd > 0 && result.total_cost_usd < .005)
        limitations.push('The ordinary currency formatter rounds this small recorded CLI cost to $0.00; it does not mean the call was free.');
    for (const call of agentCalls) {
        const started = messages.find(message => message.type === 'system' && message.subtype === 'task_started' && message.tool_use_id === call.id);
        const ended = messages.find(message => message.type === 'system' && message.subtype === 'task_notification' && message.tool_use_id === call.id);
        const id = started?.task_id, observed = safeId(id) ? live?.agents?.[id] : undefined, frozen = safeId(id) ? durations?.agents?.[id] : undefined;
        if (!safeId(id) || live?.session_id !== session || durations?.session_id !== session || observed?.status !== 'completed' || ended?.status !== 'completed'
            || !finite(frozen?.started_at_ms) || !finite(frozen?.ended_at_ms) || frozen.ended_at_ms < frozen.started_at_ms
            || frozen.prompt_id !== turn.prompt_id || typeof started?.description !== 'string' || !started.description) {
            limitations.push('Subagent rows are omitted because at least one agent lacks matching completed identity, name or timing observations.');
            tasks.length = 0; break;
        }
        tasks.push({ id, status: ended.status, name: started.description, startTime: frozen.started_at_ms });
    }
    if (tasks.length) fieldSources['subagents.tasks'] = 'id/name/status from matching official task_started/task_notification events; startTime from the original agent-durations record; the production renderer reads that same record for the frozen ending';
    return { main, subagents: { session_id: session, columns: 120, tasks }, fieldSources, limitations, verification };
}

export function requirePublicReplayText(text: string, privateValues: string[] = []): void {
    assert(!/ANTHROPIC_(?:API_KEY|AUTH_TOKEN)|apiKeyHelper|Bearer\s+|\bsk-[A-Za-z0-9_-]{8,}|\/(?:home|tmp)\//u.test(text), 'Replay output contains a private path or credential-shaped text');
    for (const value of privateValues.filter(value => value.length >= 8)) assert(!text.includes(value), 'Replay output contains private identity or configuration data');
    assert(!/[\ue0b0-\ue0b3]/u.test(text), 'Replay output must not use Powerline glyphs');
}

export function requireCompletedRendering(output: string): void {
    const plain = output.replace(/\x1b\[[0-9;:]*m/gu, '');
    assert(/✓\s+\d+m\s+\d+s/u.test(plain), 'Production main output does not show the legacy completed-task symbol and duration');
}

function observedFile(path: string): Buffer {
    const stat = fs.lstatSync(path); assert(stat.isFile() && stat.size <= 64 * 1024 * 1024, 'Observed input must be a bounded regular file');
    return fs.readFileSync(path);
}

export async function replayShowcase(options: { artifact: string; commit: string; source: string; output: string; fonts: string[] }) {
    const artifactPath = resolve(options.artifact), source = resolve(options.source), output = resolve(options.output), fonts = options.fonts.map(path => resolve(path));
    assert.equal(options.commit, SHOWCASE_BASELINE.commit); assert.equal(sha256(observedFile(artifactPath)), SHOWCASE_BASELINE.tarball_sha256);
    const artifact = verifyDelivery(artifactPath, options.commit); assert.equal(artifact.source.application_version, SHOWCASE_BASELINE.version);
    assert(fonts.length > 0); for (const font of fonts) observedFile(font);
    const fixtureBytes = observedFile(join(source, 'fixture.json')), fixture = JSON.parse(fixtureBytes.toString('utf8'));
    assert.equal(fixture.product_commit, options.commit); assert.equal(fixture.artifact_sha256, SHOWCASE_BASELINE.tarball_sha256);
    const receiptBytes = observedFile(join(source, 'parallel/receipt.json')), receipt = JSON.parse(receiptBytes.toString('utf8'));
    assert.equal(receipt.status, 'pass'); assert(safeId(receipt.session_id));
    const streamBytes = observedFile(join(source, 'parallel/timed-stream.json')), events = JSON.parse(streamBytes.toString('utf8')) as TimedMessage[];
    verifyPaidEvents('parallel', events);
    const session = receipt.session_id, sessionHash = sha256(session), configSource = fs.realpathSync(fixture.config);
    const turnPath = join(configSource, 'statusline_runtime/turns', sessionHash + '.json'), turnBytes = observedFile(turnPath), stored = parse(turnBytes.toString('utf8'));
    assert.equal(stored.session_id, session);
    const turns = stored.lifecycle?.turns ?? [], turn = turns.find((row: any) => row.prompt_id === stored.lifecycle.current_prompt_id);
    requireCompletedTurn(turn);
    const projects = join(configSource, 'projects');
    const transcripts = fs.readdirSync(projects, { withFileTypes: true }).filter(entry => entry.isDirectory())
        .map(entry => join(projects, entry.name, session + '.jsonl')).filter(path => fs.existsSync(path));
    assert.equal(transcripts.length, 1, 'Exactly one observed main transcript must match the session');
    const transcriptSource = transcripts[0]!;
    fs.mkdirSync(output); fs.mkdirSync(join(output, 'input-evidence'), { mode: 0o700 });
    const installed = installCandidate(artifactPath, options.commit), runtime = join(installed.env.CLAUDE_CONFIG_DIR, 'statusline_runtime');
    const env = isolatedRecordingEnvironment({ ...installed.env, CLAUDE_STATUSLINE_RUNTIME_DIR: runtime });
    const inputFiles: { role: string; sha256: string; bytes: number; original: string; evidence: string; working: string }[] = [];
    const copyObservation = (original: string, role: string, destination: string) => {
        const bytes = observedFile(original), evidence = join(output, 'input-evidence', role);
        fs.mkdirSync(dirname(evidence), { recursive: true, mode: 0o700 }); fs.mkdirSync(dirname(destination), { recursive: true, mode: 0o700 });
        fs.writeFileSync(evidence, bytes, { flag: 'wx', mode: 0o600 }); fs.writeFileSync(destination, bytes, { mode: 0o600 });
        assert(observedFile(evidence).equals(bytes) && observedFile(destination).equals(bytes), 'Observed bytes changed while copying');
        inputFiles.push({ role, sha256: sha256(bytes), bytes: bytes.length, original, evidence, working: destination });
        return bytes;
    };
    const run = (args: string[], input = '') => execFileSync(installed.node, [installed.entry, ...args], {
        cwd: installed.temporary, env, input, timeout: 30000, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
    });
    const captures: Record<string, unknown>[] = [];
    let replay: ReturnType<typeof deriveReplayInput> | undefined, frozen = false;
    try {
        run(['install', '--no-native-editor', '--no-experimental-slash-tui', '--no-live-metrics']);
        run(['config', 'set-items', 'model-with-effort', 'task-timer', 'task-active-timer', 'session-cost']);
        run(['config', 'subagents', 'set-items', 'status-elapsed', 'name']);
        for (const [key, value] of [['subagent-hide-completed', 'off'], ['subagent-visibility', 'all']])
            run(['config', 'set', key!, value!]);
        const currentDisplay = JSON.parse(observedFile(join(installed.env.CLAUDE_CONFIG_DIR, 'claude-statusline.json')).toString('utf8'));
        applyShowcaseVisuals(currentDisplay);
        requireShowcaseVisuals(currentDisplay);
        const profiles = await import(pathToFileURL(join(installed.modules, 'statusline-core/dist/src/config/profiles.js')).href);
        const replayProfile = join(output, 'replay-profile.json');
        write(replayProfile, { format: profiles.PROFILE_FORMAT, version: profiles.PROFILE_VERSION, name: 'Showcase actual tasks', display: currentDisplay });
        run(['config', 'profile', 'import', replayProfile]);
        run(['config', 'profile', 'activate', 'Showcase actual tasks']);
        copyObservation(turnPath, 'turns.json', join(runtime, 'turns', sessionHash + '.json'));
        const liveBytes = copyObservation(join(configSource, 'statusline_runtime/live', sessionHash + '.json'), 'live.json', join(runtime, 'live', sessionHash + '.json'));
        const durationBytes = copyObservation(join(configSource, 'statusline_runtime/agent-durations', sessionHash + '.json'), 'agent-durations.json', join(runtime, 'agent-durations', sessionHash + '.json'));
        copyObservation(join(configSource, 'claude-statusline-runtime.json'), 'runtime-preferences.json', join(installed.env.CLAUDE_CONFIG_DIR, 'claude-statusline-runtime.json'));
        const transcript = join(installed.env.CLAUDE_CONFIG_DIR, 'projects', 'actual-task', session + '.jsonl');
        copyObservation(transcriptSource, 'main-transcript.jsonl', transcript);
        const ids = events.map(row => row.message).filter(message => message.type === 'system' && message.subtype === 'task_started' && message.subagent_type === 'showcase-probe').map(message => message.task_id);
        for (const [index, id] of ids.entries()) {
            assert(safeId(id)); const original = join(dirname(transcriptSource), session, 'subagents', 'agent-' + id + '.jsonl');
            if (fs.existsSync(original)) copyObservation(original, 'agent-' + index + '-transcript.jsonl', join(dirname(transcript), session, 'subagents', 'agent-' + id + '.jsonl'));
        }
        replay = deriveReplayInput(events, session, turn, JSON.parse(liveBytes.toString('utf8')), JSON.parse(durationBytes.toString('utf8')), transcript);
        const originalFrozen = String(turn.duration_ns), originalEnding = String(turn.ended_wall_ns);
        write(join(output, 'actual-main-input.json'), replay.main); write(join(output, 'actual-subagent-input.json'), replay.subagents);
        write(join(output, 'field-sources.json'), replay.fieldSources);
        for (const language of ['en', 'zh-CN']) {
            run(['config', 'set', 'statusline-language', language]);
            const display = JSON.parse(observedFile(join(installed.env.CLAUDE_CONFIG_DIR, 'claude-statusline.json')).toString('utf8')); requireShowcaseVisuals(display);
            const render = () => {
                const main = run(['render'], JSON.stringify(replay!.main));
                const agentRaw = replay!.subagents.tasks.length ? run(['render-subagents'], JSON.stringify(replay!.subagents)) : '';
                const agentRows = agentRaw.split('\n').filter(Boolean).map(line => JSON.parse(line));
                assert.equal(agentRows.length, replay!.subagents.tasks.length);
                assert(agentRows.every(row => typeof row.content === 'string' && row.content.trim()), 'A completed agent row disappeared');
                return { main, agentRaw, lines: [...main.trimEnd().split('\n'), ...agentRows.map(row => row.content)] };
            };
            const first = render(); await delay(1100); const second = render();
            assert.equal(second.main, first.main, 'Completed main duration changed between renders');
            assert.equal(second.agentRaw, first.agentRaw, 'Completed agent duration changed between renders');
            const raw = Buffer.from(first.lines.join('\r\n'));
            requirePublicReplayText(raw.toString('utf8'), [session, turn.prompt_id, configSource, fixture.project]);
            fs.writeFileSync(join(output, 'diagnostic-' + language + '.ansi'), raw, { flag: 'wx', mode: 0o600 });
            requireCompletedRendering(first.main);
            const after = parse(observedFile(join(runtime, 'turns', sessionHash + '.json')).toString('utf8')).lifecycle.turns.find((row: any) => row.prompt_id === turn.prompt_id);
            requireCompletedTurn(after); assert.equal(String(after.duration_ns), originalFrozen); assert.equal(String(after.ended_wall_ns), originalEnding);
            const terminal = new Capture(120, 32); terminal.feed(raw);
            const colorEvidence = requireColoredCapture(raw, terminal.buffer);
            const cells = { columns: 120, rows: 32, cells: terminal.buffer, terminal_foreground: '#dedee7', terminal_background: '#17191e' };
            const image = renderCapture(cells, [0, 0, 120, 32], fonts), directory = join(output, language); fs.mkdirSync(directory);
            const json = JSON.stringify(cells, null, 2) + '\n';
            fs.writeFileSync(join(directory, 'main-subagents.png'), image.png, { flag: 'wx' });
            fs.writeFileSync(join(directory, 'actual-render-output.txt'), first.lines.map(line => line.replace(/\x1b\[[0-9;:]*m/gu, '')).join('\n') + '\n', { flag: 'wx', mode: 0o600 });
            fs.writeFileSync(join(directory, 'actual-render-output.ansi'), raw, { flag: 'wx', mode: 0o600 });
            fs.writeFileSync(join(directory, 'main-subagents.cells.json'), json, { flag: 'wx', mode: 0o600 });
            write(join(directory, 'display.json'), display);
            captures.push({ file: language + '/main-subagents.png', language, width: image.width, height: image.height, columns: 120, rows: 32,
                rendered_rows: first.lines.length, completed_agents: replay.subagents.tasks.length, separator_style: display.separator_style,
                png_sha256: sha256(image.png), source_sha256: sha256(raw), cells_sha256: sha256(json),
                main_input_sha256: sha256(observedFile(join(output, 'actual-main-input.json'))), subagent_input_sha256: sha256(observedFile(join(output, 'actual-subagent-input.json'))),
                display_sha256: sha256(observedFile(join(directory, 'display.json'))), kind: 'actual completed-task observations replayed through installed production renderers',
                sample: false, interactive_statusline_capture: false, terminal_cell_reconstruction: true, model_calls: 0,
                physical_visual_acceptance: false, human_acceptance: false, repeated_frozen_output: true, color_evidence: colorEvidence });
        }
        for (const input of inputFiles) {
            assert.equal(sha256(observedFile(input.original)), input.sha256, 'Original observed data changed');
            assert.equal(sha256(observedFile(input.evidence)), input.sha256, 'Preserved input evidence changed');
        }
        const collectorFiles = ['tools/acceptance/showcase-replay.ts', 'tools/acceptance/showcase-paid.ts', 'tools/acceptance/showcase-driver.ts', 'tools/acceptance/showcase-journeys.ts', 'tools/acceptance/render-capture.ts'];
        write(join(output, 'private-inputs.json'), inputFiles);
        write(join(output, 'provenance.json'), { product: SHOWCASE_BASELINE, collector: {
            commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim(),
            working_tree_changes: Boolean(execFileSync('git', ['status', '--porcelain=v1', '--', ...collectorFiles], { cwd: repoRoot, encoding: 'utf8' }).trim()),
            files: Object.fromEntries(collectorFiles.map(path => [path, sha256(observedFile(join(repoRoot, path)))])),
        }, host: fixture.host, platform: process.platform, node: process.version, model_calls: 0,
        source_stream_sha256: sha256(streamBytes), source_receipt_sha256: sha256(receiptBytes),
        inputs: inputFiles.map(({ role, sha256, bytes }) => ({ role, sha256, bytes })), field_sources: replay.fieldSources,
        reconstructed_values: { model_id: (replay.main.model as any)?.id ?? null, cli_session_cost_usd: (replay.main.cost as any)?.total_cost_usd ?? null },
        missing_fields_remain_missing: true, original_observations_preserved: true,
        fonts: Object.fromEntries(fonts.map(path => [basename(path), sha256(observedFile(path))])),
        limitations: replay.limitations, captures });
        frozen = true;
    } finally { installed.cleanup(); requireRemoved(installed.temporary); }
    assert(frozen && replay);
    const result = { status: 'pass', kind: 'offline actual-task replay', captures: captures.length, completed_agents: replay.subagents.tasks.length,
        repeated_frozen_output: true, original_observations_preserved: true, isolated_installation_removed: true, model_calls: 0 };
    write(join(output, 'receipt.json'), result); return { ...result, output };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const { values } = parseArgs({ options: { artifact: { type: 'string' }, commit: { type: 'string' }, source: { type: 'string' }, output: { type: 'string' }, font: { type: 'string', multiple: true } } });
    assert(values.artifact && values.commit && values.source && values.output && values.font?.length,
        'Require --artifact TGZ --commit PRODUCT_SHA --source PRIVATE_PAID_DIRECTORY --output NEW_DIRECTORY --font FILE');
    console.log(JSON.stringify(await replayShowcase({ artifact: values.artifact, commit: values.commit, source: values.source, output: values.output, fonts: values.font })));
}
