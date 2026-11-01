import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { sha256 } from '@fbincon/statusline-platform/hash';
import { empty } from '@fbincon/statusline-core/runtime/live/state';
import { taskFixture } from './task-fixture.js';

interface TaskTerminal {
    key(bytes: string, label: string): Promise<void>;
    clickText(text: string): Promise<void>;
    read(): string;
    until(predicate: (text: string) => boolean, label: string): Promise<void>;
    selected(): string;
    reads(): number;
    capture(label: string): void;
}

/** Start at the real host prompt. No direct Client input or mouse focus is supplied. */
export async function taskInputJourney(config: string, terminal: TaskTerminal, compact: boolean): Promise<void> {
    const { key, read, until, reads, capture, selected } = terminal;
    const composer = () => {
        const prompt = read().split('\n').findLast(line => line.startsWith('❯'));
        assert(prompt, 'The visible conversation input must be identifiable');
        return prompt.trimEnd();
    };
    const before = composer(), initialReads = reads();
    await key('/statusline-task\r', 'open task from composer');
    await until(screen => screen.includes('refresh on demand') && screen.includes('Read at:') && reads() === initialReads + 1, 'task and first report row visible');
    assert.equal(composer(), before);
    capture('before');

    await key(compact ? 'g' : '\r', compact ? 'open search without clicking' : 'activate the default search button with Enter');
    await until(screen => screen.includes('⏎ accept'), 'host search input focused');
    for (const char of ['x', ' ', 'y']) await key(char, 'type ordinary query character');
    const pasted = ' 中 文🚀';
    await key('\x1b[200~' + pasted + '\x1b[201~', 'paste literal bracketed text');
    await until(screen => screen.includes('x y' + pasted), 'complete search input visible');
    assert.equal(composer(), before, 'Paste reached the conversation');
    await key('\r', 'commit search');
    await until(screen => screen.includes('Search: x y' + pasted), 'query applied to the report');
    assert.equal(composer(), before);
    await key('g', 'reopen query'); await key('\x15', 'clear query'); await key('\r', 'apply empty query');
    await until(screen => screen.includes('Search: —'), 'query cleared');

    const session = compact ? 'task-input-compact' : 'task-input-docked';
    const turns = taskFixture(config, session);
    const live = empty(session), now = Date.now();
    live.current_prompt_id = 'captured-task';
    live.prompts['captured-task'] = { epoch: 'fixture', started_at_ms: now - 2000, updated_at_ms: now, complete: true, terminal: true };
    for (const [id, parent] of [['agent-alpha', null], ['agent-beta', 'agent-alpha']] as const) {
        live.agents[id] = { prompt_id: 'captured-task', epoch: 'fixture', started_at_ms: now - 1000,
            ended_at_ms: now, updated_at_ms: now, status: 'completed', parent_agent_id: parent };
    }
    const folder = join(config, 'statusline_runtime', 'live');
    mkdirSync(folder, {recursive:true});
    const livePath = join(folder, sha256(session) + '.json'), liveBytes = JSON.stringify(live);
    writeFileSync(livePath, liveBytes);

    await key('s', 'open identity'); await until(screen => screen.includes('⏎ accept'), 'identity input focused');
    await key('\t', 'select task ID'); await key('unused', 'enter cancelled ID');
    await key('\t', 'select cancel'); await key('\r', 'cancel identity');
    await until(screen => screen.includes('Search: —'), 'reading screen restored');
    assert.equal(reads(), initialReads + 1, 'Entering or cancelling fields reread evidence');
    await key('s', 'choose published test session'); await key('\x15', 'clear previous session ID');
    await key(session, 'enter known test session'); await key('\r', 'read selected session');
    await until(screen => screen.includes(session) && screen.includes('captured-task') && screen.includes('Read at:') &&
        reads() === initialReads + 2, 'published task appeared under requested identity');
    await key('r', 'refresh the selected task');
    await until(screen => screen.includes('refresh on demand') && reads() === initialReads + 3, 'one additional read completed');
    assert.equal(composer(), before);

    await key('n', 'select next row');
    await until(() => selected().includes('Observed state:'), 'next selected the task state');
    await key('p', 'select previous row');
    await until(() => selected().includes('Read at:'), 'previous selected capture time');
    await key('j', 'page forward'); const advanced = selected();
    assert(!advanced.includes('Read at:'), 'Next page left the first row selected');
    await key('k', 'page backward'); await until(() => selected().includes('Read at:'), 'previous page selected first row');
    for (let i = 0; i < 15 && !selected().includes('agent-alpha'); i++) await key('n', 'find parent agent');
    await until(() => selected().includes('▾') && selected().includes('agent-alpha'), 'selected expanded parent');
    await key('z', 'fold parent'); await until(() => selected().includes('▸'), 'parent is visibly folded');
    await key('z', 'unfold parent'); await until(() => selected().includes('▾'), 'parent is visibly expanded');
    await key('n', 'select the child'); await until(() => selected().includes('agent-beta'), 'child reachable on keyboard');
    await key('e', 'show evidence'); await key('n', 'select the child evidence');
    await until(() => selected().includes('live_store'), 'evidence row selected');
    await key('f', 'filter to observed agent status'); await until(screen => screen.includes('Status: Completed'), 'status filter applied');
    assert.equal(composer(), before);
    assert.equal(reads(), initialReads + 3, 'Navigation reread published state');
    assert.deepEqual(readFileSync(turns.path), turns.bytes);
    assert.equal(readFileSync(livePath, 'utf8'), liveBytes);
    capture('after');

    await terminal.clickText('live_store');
    await key('\x1b[A', 'up arrow in the clicked report body');
    await until(() => selected().includes('agent-beta') && !selected().includes('live_store'), 'arrow selected the preceding agent');
    await key('/', 'open search from the clicked report');
    await until(screen => screen.includes('⏎ accept'), 'report shortcut focused host search');
    await key('agent-beta', 'search for the child'); await key('\r', 'submit report search');
    await until(screen => screen.includes('Search: agent-beta'), 'body search returned to reading controls');
    await key('g', 'open search again from controls'); await key('\t', 'focus search cancel');
    await key('\r', 'cancel the search field');
    await until(screen => screen.includes('Search: agent-beta'), 'cancel retained the previous query');
    assert.equal(composer(), before);

    // The composer already contains real unsubmitted text when the person
    // gives the pane the keyboard again. A paste must not append to that draft.
    await key('x', 'type in the conversation');
    await key(' retained chat', 'prepare an unsent chat draft');
    const retained = composer();
    assert(retained.endsWith('x retained chat'));
    await terminal.clickText('[agent-beta]');
    await key('/', 'request the search field with a pending conversation draft');
    await until(screen => screen.includes('Click the field') && !screen.includes('⏎ accept'), 'refused field focus is visible');
    assert.equal(composer(), retained);
    await key('\x18', 'begin host focus chord'); await key('\t', 'grant focus to the search field');
    await until(screen => screen.includes('⏎ accept'), 'field focus granted without losing the conversation draft');
    await key('\x15', 'clear the selected search query');
    await key('\x1b[200~中 文🚀\x1b[201~', 'paste over an existing conversation draft');
    await key('\r', 'confirm the pasted query');
    await until(screen => screen.includes('Search: 中 文🚀'), 'retained query received the paste');
    assert.equal(composer(), retained);
    await key('q', 'close with a retained chat draft');
    await until(screen => !screen.includes('Task details'), 'task pane closed');
    assert.equal(composer(), retained);
}
