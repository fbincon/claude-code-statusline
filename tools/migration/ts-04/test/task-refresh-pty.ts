import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { stripVTControlCharacters } from 'node:util';
import { pythonJson } from '@fbincon/statusline-core/json-text';
import { mirrorState, newRecord, type TaskStore } from '@fbincon/statusline-core/runtime/tasks/model';
import { applyPrompt, finishRecord, reopenForContinuation } from '@fbincon/statusline-core/runtime/tasks/transitions';
import { atomicWrite } from '@fbincon/statusline-platform/files';
import { sha256 } from '@fbincon/statusline-platform/hash';
import type { LaunchSpec } from '@fbincon/statusline-platform/launch';
import { openPty } from './pty.js';

type Pty = ReturnType<typeof openPty>;
export function installedTaskEvidence(languages: number, foreground: Awaited<ReturnType<typeof taskRefreshPty>> | null) {
    // Published evidence readers match the original task_viewer fields exactly.
    const task_viewer = { languages, views: languages * 3, standalone_non_tty: true, readonly: true, installed_modules: true };
    return foreground ? { task_viewer, task_foreground_pty: foreground } : { task_viewer };
}

const mark = (pty: Pty) => pty.captured().toString('utf8').length;
const snapshot = (path: string) => existsSync(path) ? { bytes: readFileSync(path), mode: statSync(path).mode } : null;

// A status that appeared in an earlier frame must never satisfy a later transition.
async function waitForFrame(pty: Pty, start: number, expected: string[], limit = 20_000): Promise<void> {
    await pty.wait(output => {
        const fresh = output.slice(start);
        const frame = fresh.slice(Math.max(0, fresh.lastIndexOf('\x1b[H')));
        const visible = stripVTControlCharacters(frame);
        return expected.every(text => (text.startsWith('\x1b') ? frame : visible).includes(text));
    }, limit);
}

async function openEmbeddedTask(pty: Pty, session: string): Promise<void> {
    await waitForFrame(pty, 0, ['Preview (sample data)']);
    const start = mark(pty);
    pty.send(' \t\t\t\x1b[F');
    await waitForFrame(pty, start, ['Configure Status Line *', 'Settings / global options', '› ']);
    // The inspection group is near the end of Settings; follow the visible
    // selection rather than tying the test to a particular number of fields.
    for (let i = 0; i < 30; i++) {
        const raw = pty.captured().toString('utf8');
        if (raw.slice(raw.lastIndexOf('\x1b[H')).includes('› Task details:')) {
            const selected = raw.length;
            pty.send('\r');
            await waitForFrame(pty, selected, ['Tab: session/task']);
            pty.send(session + '\r');
            return;
        }
        pty.send('\x1b[A');
        await waitForFrame(pty, raw.length, ['› ']);
    }
    assert.fail('Task details was not selectable in Settings');
}

/** Reuse one independently published task store for the fixed and following readers. */
export async function taskRefreshPty(config: string, launch: LaunchSpec, cwd: string, env: NodeJS.ProcessEnv = {}) {
    const session = 'refresh-session', first = 'first-prompt', next = 'next-prompt';
    const now = () => BigInt(Date.now()) * 1_000_000n;
    const initial = now();
    const turn = newRecord(first, { wall_ns: initial - 2_000_000_000n, boot_ns: null, boot_id: null });
    const store: TaskStore = { schema: 4, session_id: session, current_prompt_id: first, turns: [turn], updated_wall_ns: initial };
    const path = join(config, 'statusline_runtime', 'turns', sha256(session) + '.json');
    const publish = () => {
        const bytes = Buffer.from(pythonJson(mirrorState(session, store)));
        atomicWrite(path, bytes);
        return { bytes, mode: statSync(path).mode };
    };
    const configFiles = () => ['settings.json', 'claude-statusline.json'].map(name => snapshot(join(config, name)));
    const original = configFiles();
    const start = (argv: string[]) => openPty(config, 64, 18, env, 'en', {
        executable: launch.executable, args: [...launch.args, '--language', 'en', ...argv, '--config-dir', config], cwd,
    });
    let evidence = publish();
    const ptys: Pty[] = [];
    try {
        const embedded = start(['configure']);
        ptys.push(embedded);
        const standalone = start(['task', 'view', '--session-id', session, '--prompt-id', first]);
        ptys.push(standalone);
        await openEmbeddedTask(embedded, session);
        const running = 'Observed state: Running', completed = 'Observed state: Completed';
        await Promise.all(ptys.map(pty => waitForFrame(pty, 0, [first, running, '\x1b[18;1H'])));
        const report = embedded.captured().toString('utf8');
        assert(!report.slice(report.lastIndexOf('\x1b[H')).includes('Preview (sample data)'));
        await Promise.all(ptys.map(pty => {
            const before = mark(pty);
            pty.resize(100, 30);
            return waitForFrame(pty, before, [first, running, '\x1b[30;1H']);
        }));

        // From here through the new prompt, the test writes only the store.
        // Enter, R, resize and focus events would disguise a missed idle update.
        const observe = async (change: () => void, embeddedRows: string[], standaloneRows = embeddedRows) => {
            assert.deepEqual(snapshot(path), evidence);
            const marks = ptys.map(mark);
            change();
            const publishedAt = performance.now();
            evidence = publish();
            await Promise.all([
                waitForFrame(embedded, marks[0]!, embeddedRows),
                waitForFrame(standalone, marks[1]!, standaloneRows),
            ]);
            return Math.round(performance.now() - publishedAt);
        };
        const completionMs = await observe(() => {
            assert(finishRecord(turn, 'completed', initial, null, null, 'hook_stop', 'stop'));
        }, [first, completed, 'Task total time: 2.0s']);
        const continuationMs = await observe(() => {
            assert(reopenForContinuation(store, turn, now()));
        }, [first, running]);
        const nextPromptMs = await observe(() => {
            const wall = now();
            assert(finishRecord(turn, 'completed', wall, null, null, 'hook_stop', 'stop'));
            assert(applyPrompt(store, next, wall));
        }, [next, running], [first, completed]);

        const beforeReturn = mark(embedded);
        standalone.send('q');
        embedded.send('q');
        await waitForFrame(embedded, beforeReturn, ['Configure Status Line *', '› Task details:', 'Preview (sample data)']);
        const beforeUndo = mark(embedded);
        embedded.send('\x1a');
        await waitForFrame(embedded, beforeUndo, ['Configure Status Line ·', '› Task details:']);
        embedded.send('\x1b');
        await Promise.all(ptys.map(pty => pty.exited()));
        for (const pty of ptys) {
            assert.equal(pty.child.exitCode, 0);
            assert.deepEqual(pty.attributes(), pty.before);
            assert(pty.captured().includes(Buffer.from('\x1b[?1049l')));
        }
        assert.deepEqual(configFiles(), original);
        assert.deepEqual(snapshot(path), evidence);
        return { surfaces: ['configure-following', 'task-view-fixed'], completion_ms: completionMs,
            continuation_ms: continuationMs, next_prompt_ms: nextPromptMs, restored_terminals: 2, retained_draft: true };
    } finally {
        await Promise.all(ptys.map(pty => pty.close()));
    }
}
