import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { admitInstalledCommand } from './installed-admission.js';
import { INSTALLED_COMMAND_MS } from './budgets.js';

export interface InstalledCommandFixture {
    temporary: string; directory: string; node: string; entry: string; env: NodeJS.ProcessEnv;
}
export type ColdCommand = (args: string[], config: string, input?: string, environment?: NodeJS.ProcessEnv) => string;
export function invokeInstalled(fixture: InstalledCommandFixture, args: string[], config: string, input = '', environment: NodeJS.ProcessEnv = {}) {
    admitInstalledCommand(INSTALLED_COMMAND_MS);
    return spawnSync(fixture.node, [fixture.entry, ...args], { cwd: fixture.directory, env: { ...fixture.env, CLAUDE_CONFIG_DIR: config, ...environment },
        input, encoding: 'utf8', timeout: INSTALLED_COMMAND_MS });
}
export function runInstalled(fixture: InstalledCommandFixture, ...args: Parameters<ColdCommand>): string {
    const result = invokeInstalled(fixture, ...args);
    assert.equal(result.error, undefined); assert.equal(result.status, 0, result.stderr + result.stdout);
    return result.stdout;
}
export function setupInstalled(fixture: InstalledCommandFixture, name: string, execute: ColdCommand = (...args) => runInstalled(fixture, ...args)): string {
    const config = join(fixture.temporary, name);
    mkdirSync(config, { mode: 0o700 });
    writeFileSync(join(config, 'settings.json'), '{"env":{"KEEP":"unchanged"}}\n', { mode: 0o600 });
    execute(['install', '--config-dir', config, '--no-native-editor', '--no-native-timing', '--no-live-metrics'], config);
    return config;
}
