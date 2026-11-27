import assert from 'node:assert/strict';
import { sha256 } from './files.js';

const sourceRoot = 'mods/statusline-agent-rows/';
export const agentRowsResourceRoot = 'node_modules/@fbincon/statusline-cli/resources/statusline-agent-rows/';

/** Mirror the runtime files that sourceFiles() ships, excluding tests and SDK declarations. */
export function agentRowSourceFiles<T>(source: Readonly<Record<string, T>>): Record<string, T> {
    return Object.fromEntries(Object.entries(source).filter(([name]) =>
        name.startsWith(sourceRoot) && /^(?:\.claude-plugin\/plugin\.json|hooks\/hooks\.json|(?:hooks|lib|ui)\/.+\.ts)$/u.test(name.slice(sourceRoot.length))
    ).map(([name, value]) => [name.slice(sourceRoot.length), value]));
}

export function verifyAgentRowResources(entries: ReadonlyMap<string, Buffer>, hashes: Readonly<Record<string, string>>, protocol: unknown, version: string): void {
    const expected = agentRowSourceFiles(hashes);
    const paths = [...entries.keys()].filter(name => name.startsWith(agentRowsResourceRoot)).map(name => name.slice(agentRowsResourceRoot.length));
    if (!Object.keys(expected).length) {
        assert.equal(protocol, undefined, 'AgentRow protocol has no matching source');
        assert.deepEqual(paths, [], 'Historical package contains an undeclared AgentRow Mod');
        return;
    }
    assert.equal(protocol, 1, 'AgentRow source requires protocol 1');
    for (const name of ['.claude-plugin/plugin.json', 'hooks/hooks.json']) assert(Object.hasOwn(expected, name), 'Missing AgentRow source: ' + name);
    assert.deepEqual(paths.sort(), [...Object.keys(expected), 'resource-manifest.json'].sort(), 'AgentRow package contents differ from source');
    const read = (name: string) => JSON.parse(entries.get(agentRowsResourceRoot + name)!.toString('utf8'));
    const descriptor = read('resource-manifest.json');
    assert.equal(descriptor.schema_version, 1);
    assert.equal(descriptor.protocol_version, protocol);
    assert.equal(descriptor.backend_version, version);
    assert.equal(descriptor.mod_version, version);
    assert.deepEqual(descriptor.files, expected, 'AgentRow inventory differs from source');
    const plugin = read('.claude-plugin/plugin.json');
    assert.equal(plugin.name, 'statusline-agent-rows');
    assert.equal(plugin.version, version);
    const { modules } = read('hooks/hooks.json');
    assert(Array.isArray(modules) && modules.length && modules.every(name =>
        typeof name === 'string' && name.startsWith('./') && Object.hasOwn(expected, 'hooks/' + name.slice(2))), 'AgentRow hook entry is missing');
    for (const [name, digest] of Object.entries(expected)) assert.equal(sha256(entries.get(agentRowsResourceRoot + name)!), digest, 'AgentRow source differs: ' + name);
}
