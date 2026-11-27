import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join } from 'node:path';
import { Capture, type Cell } from '../../migration/ts-04/capture.js';
import { openPty } from '../../migration/ts-04/test/pty.js';
import { AGENTS, openProvider } from './provider.js';

export const NAME_COLOR = '14afd2';
export const FOREIGN = 'FOREIGN-ROW';
type Appearance = 'custom' | 'default' | 'foreign';
export interface ExpectedRows { appearance: Appearance; count: number }
export interface VisibleRow { label: string; text: string; custom: boolean; foreign: boolean; body: string }

export function visibleRows(buffer: Cell[][], nameColor = NAME_COLOR): VisibleRow[] {
    return buffer.flatMap(cells => {
        const text = cells.map(cell => cell.data).join('').trimEnd();
        const agent = AGENTS.find(item => text.includes(item.label));
        if (!agent) return [];
        const custom = cells.filter(cell => cell.fg === nameColor).map(cell => cell.data).join('').includes('General Purpose');
        const foreign = text.includes(FOREIGN);
        // Capture only actual row bodies. A tool notice or command output can mention a task's label too.
        if (!custom && !foreign && !/general-purpose\s+/u.test(text)) return [];
        return [{ label: agent.label, text: text.trimStart(), custom, foreign, body: custom ? text.slice(text.indexOf('General Purpose')) : '' }];
    });
}

export function matchRows(rows: VisibleRow[], expected: ExpectedRows): boolean {
    if (rows.length !== expected.count || new Set(rows.map(row => row.label)).size !== expected.count) return false;
    return rows.every(row => expected.appearance === 'custom' ? row.custom && !row.foreign :
        expected.appearance === 'foreign' ? row.foreign && !row.custom : !row.custom && !row.foreign);
}

// This fixture launches ordinary background agents and never hooks ui.render.
// Every visible custom cell must come from the installed candidate or the deliberately seeded foreign callback.
function writeLauncher(directory: string) {
    fs.mkdirSync(join(directory, '.claude-plugin'), { recursive: true });
    fs.mkdirSync(join(directory, 'hooks'));
    fs.writeFileSync(join(directory, '.claude-plugin/plugin.json'), JSON.stringify({ name: 'row-acceptance-launcher', version: '1.0.0' }));
    fs.writeFileSync(join(directory, 'hooks/hooks.json'), JSON.stringify({ modules: ['./launch.ts'] }));
    fs.writeFileSync(join(directory, 'hooks/launch.ts'), `
export function register(on) {
    on('session.start', async ($, event, next) => {
        await $.command.register({ name: 'verify-agent-rows', description: 'Launch the two local probe agents' });
        $.ui.log('ROW_ACCEPTANCE_READY', {to:'debug'});
        return next(event);
    });
    on('command.run', {command:'verify-agent-rows'}, async ($) => {
        const ids = [];
        for (const agent of ${JSON.stringify(AGENTS)}) {
            const result = await $.agent.spawn({prompt:agent.prompt, description:agent.label, subagentType:'general-purpose'});
            if (!result.agentId) throw new Error('Fixture agent was not started');
            ids.push(result.agentId);
        }
        $.ui.log('ROW_ACCEPTANCE_STARTED ' + JSON.stringify(ids), {to:'debug'});
        return {text:'Started both fixture agents'};
    });
}
`.trimStart());
}

interface Session {
    executable: string; config: string; project: string; env: NodeJS.ProcessEnv; output: string;
    expected: ExpectedRows; settingsOverride?: Record<string, unknown>;
    readyAfterRender?: () => boolean;
    setNameColor?: (colour: string) => void;
}
const COLUMNS = 154, HEIGHT = 45;
export const SAMPLE_KEY = 'local-test-key-for-agent-row-fixtures';

export async function inspectSession(session: Session) {
    const plugin = join(session.output, 'launcher'), debug = join(session.output, 'host.log');
    writeLauncher(plugin);
    const provider = await openProvider();
    const env = { ...session.env, ANTHROPIC_API_KEY: SAMPLE_KEY, ANTHROPIC_BASE_URL: provider.url };
    const args = ['--permission-mode', 'default', '--plugin-dir', plugin, '--debug-file', debug, '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}'];
    if (session.settingsOverride) args.push('--settings', JSON.stringify(session.settingsOverride));
    const pty = openPty(session.config, COLUMNS, HEIGHT, env, 'en', { executable: session.executable, args, cwd: session.project });
    const screen = new Capture(COLUMNS, HEIGHT);
    let offset = 0, acceptedKey = false;
    const sample = () => {
        const captured = pty.captured(), added = captured.subarray(offset);
        offset = captured.length;
        screen.feed(added);
        if (added.includes(Buffer.from('\x1b[6n'))) pty.send('\x1b[1;1R');
        const text = screen.buffer.map(row => row.map(cell => cell.data).join('')).join('\n');
        if (!acceptedKey && text.includes('Do you want to use this API key?')) {
            pty.send('\x1b[A\r'); acceptedKey = true;
        }
        return text;
    };
    const log = () => fs.existsSync(debug) ? fs.readFileSync(debug, 'utf8') : '';
    try {
        await pty.wait(() => {
            const screenText = sample();
            return log().includes('ROW_ACCEPTANCE_READY') && screenText.includes('❯');
        }, 45_000);
        pty.send('/verify-agent-rows');
        await pty.wait(() => sample().includes('/verify-agent-rows'), 5000);
        pty.send('\r');
        let stableSince = 0;
        await pty.wait(() => {
            sample();
            const correct = provider.received.size === AGENTS.length &&
                matchRows(visibleRows(screen.buffer), session.expected) && (session.readyAfterRender?.() ?? true);
            if (!correct) { stableSince = 0; return false; }
            if (!stableSince) stableSince = performance.now();
            // Sample past the first-result window, including when the second row is deliberately hidden.
            return performance.now() - stableSince >= 1500;
        }, 50_000);
        const agentIds = JSON.parse(log().match(/ROW_ACCEPTANCE_STARTED (\[[^\n]*?\])/u)?.[1] ?? '[]');
        assert.equal(new Set(agentIds).size, 2, 'Host did not confirm two distinct agent ids');
        let changeObserved = false;
        if (session.setNameColor) {
            // Prove a new frame is painted in the same session after the owned legacy key was retired.
            for (const colour of ['7dc36a', NAME_COLOR]) {
                session.setNameColor(colour);
                await pty.wait(() => {
                    sample();
                    return matchRows(visibleRows(screen.buffer, colour), session.expected) && session.readyAfterRender!();
                }, 25_000);
            }
            changeObserved = true;
        }
        const rows = visibleRows(screen.buffer);
        assert(matchRows(rows, session.expected));
        return { columns: COLUMNS, rows, agent_ids: agentIds as string[], local_requests: [...provider.requests],
            name_colour: rows.some(row => row.custom) ? '#' + NAME_COLOR : null, same_session_recolour_after_handoff: changeObserved,
            fake_requests_with_distinct_prompts: provider.received.size, external_model_calls: 0, billed_usd: 0 };
    } finally {
        sample();
        fs.writeFileSync(join(session.output, 'terminal.ansi'), pty.captured(), { mode: 0o600 });
        fs.writeFileSync(join(session.output, 'terminal.txt'), screen.buffer.map(row => row.map(c => c.data).join('').trimEnd()).join('\n'), { mode: 0o600 });
        if (pty.child.pid && pty.child.exitCode === null) {
            try { process.kill(-pty.child.pid, 'SIGTERM'); }
            catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; }
        }
        await pty.close();
        await provider.close();
    }
}
