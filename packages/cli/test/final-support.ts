import { defaultDisplay } from '@fbincon/statusline-core/config/display';
import { mkdtempSync, rmSync, writeFileSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { ConfigurationService, draft } from '@fbincon/statusline-cli/config/service';
import { ConfigurationProtocol } from '@fbincon/statusline-cli/ui/protocol';
import { createStorage, jsonBytes, readDisplay } from '@fbincon/statusline-cli/config/storage';
import { previewAdapter } from '@fbincon/statusline-cli/rendering/preview';
import { commandFor } from '@fbincon/statusline-platform/commands';
export { assert, join, resolve, writeFileSync, existsSync, readdirSync, readFileSync, jsonBytes, readDisplay, draft };
export const repo = resolve(process.cwd());
const preview = await previewAdapter('/test/home');
export function setup(t: TestContext, installed = false) {
    const root = mkdtempSync(join(tmpdir(), "ts03-final 中文 $` ' "));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const launch = { executable: process.execPath, args: [join(repo, 'packages/cli/dist/src/entry.js')] }, context = { configDir: root, launch, hostVersion: () => [2, 1, 294] };
    const io = createStorage(() => new Date('2033-05-18T03:33:20Z')), settingsPath = join(root, 'settings.json'), displayPath = join(root, 'claude-statusline.json');
    if (installed)
        writeFileSync(settingsPath, jsonBytes({ statusLine: { type: 'command', command: commandFor(launch, 'render'), refreshInterval: 1 }, subagentStatusLine: { type: 'command', command: commandFor(launch, 'render-subagents') }, permissions: { allow: ['Read'] } }));
    const service = new ConfigurationService(context, io), protocol = new ConfigurationProtocol(service, preview);
    const call = (operation: string, payload: unknown = {}, custom = protocol) => { const reply = custom.handle(JSON.stringify({ protocol_version: 20, operation, payload }), error => assert.fail(String(error))); return { status: reply.status, response: reply.response as any }; };
    const read = () => { const result = call('read'); assert.equal(result.status, 0); return result.response.result; };
    return { root, launch, context, io, service, protocol, settingsPath, displayPath, call, read,
        save: (current: any) => call('apply', { draft: current.draft, expected_revision: current.revision }),
        display: () => readDisplay(root, io)[0] };
}
export const selected = (value: {
    instances: {
        id: string;
        enabled: boolean;
    }[];
}) => value.instances.filter(n => n.enabled).map(n => n.id);
export function legacy(version: number): any {
    if (version >= 9) { const { groups, subagents, ...display } = defaultDisplay(); const { groups: agentGroups, ...legacyAgents } = subagents; return { ...display, subagents: legacyAgents, schema_version: version }; }
    const corpus = JSON.parse(readFileSync(join(repo, 'tests/fixtures/migration/ts-01/cases.json'), 'utf8'));
    return JSON.parse(corpus.cases.find((row: any) => row.id === `display-v${version}-read`).files['config/claude-statusline.json']);
}
