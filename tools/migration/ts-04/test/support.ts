import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { commandFor } from '@fbincon/statusline-platform/commands';
import { ConfigurationService } from '@fbincon/statusline-cli/config/service';
import { createStorage } from '@fbincon/statusline-cli/config/storage';
import { ConfigurationProtocol } from '@fbincon/statusline-cli/ui/protocol';
import { previewAdapter } from '@fbincon/statusline-cli/rendering/preview';
import { parseResponse, requestText } from '@fbincon/statusline-core/editor/backend';
import { pythonJson } from '@fbincon/statusline-core/json-text';
import { Session, type Backend } from '@fbincon/statusline-tui/session';
import { State } from '@fbincon/statusline-tui/state';
import { frame } from '@fbincon/statusline-tui/drawing';
import { displayWidth } from '@fbincon/statusline-core/unicode/index';
import type { Language } from '@fbincon/statusline-core/i18n/messages';
import type { Key } from '@fbincon/statusline-core/terminal/key';
import { repoRoot } from '../../ts-03/common.js';
export { assert, fs, join, Session, State, frame, repoRoot };
export async function fixture(t: TestContext, language: Language = 'en') {
    const root = fs.mkdtempSync(join(tmpdir(), 'ts04-editor 中文 '));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const launch = { executable: process.execPath, args: [join(repoRoot, 'packages/cli/dist/src/entry.js')] };
    const settingsPath = join(root, 'settings.json'), displayPath = join(root, 'claude-statusline.json');
    fs.writeFileSync(settingsPath, JSON.stringify({ statusLine: { type: 'command', command: commandFor(launch, 'render') }, permissions: { allow: ['Read'] }, theme: 'dark' }));
    const io = createStorage(), service = new ConfigurationService({ configDir: root, launch, hostVersion: () => [2, 1, 296] }, io);
    const protocol = new ConfigurationProtocol(service, await previewAdapter());
    const calls: {
        operation: string;
        payload: unknown;
    }[] = [];
    const backend: Backend = { request(operation, payload = {}) {
            calls.push({ operation, payload });
            const value = protocol.handle(requestText(operation, payload), error => { throw error; });
            return parseResponse(operation, { exitCode: value.status, stdout: pythonJson(value.response), stderr: '' });
        } };
    const session = await Session.open(backend, language), state = session.state, e = state.editor;
    const bytes = () => ({ settings: fs.readFileSync(settingsPath).toString(), display: fs.existsSync(displayPath) ? fs.readFileSync(displayPath).toString() : null });
    const keys = (...events: (Key | string)[]) => events.map(event => state.key(typeof event === 'string' ? { key: event } : event));
    return { root, launch, settingsPath, displayPath, io, service, protocol, backend, session, state, e, calls, bytes, keys };
}
export function bounded(state: State, width: number, height: number) {
    const result = frame(state, width, height);
    assert.equal(result.rows.length, height);
    for (const row of result.rows)
        assert.equal(displayWidth(row.map(span => span.text).join('')), width);
    return result;
}
export function text(state: State, width = 80, height = 24): string { return bounded(state, width, height).rows.map(row => row.map(span => span.text).join('')).join('\n'); }
