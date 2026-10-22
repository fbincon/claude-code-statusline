import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { repoRoot } from '../common.js';
import { ConfigurationService } from '@fbincon/statusline-cli/config/service';
import { selection } from '@fbincon/statusline-cli/config/operations';
import { readPreferences } from '@fbincon/statusline-cli/config/preferences';
function processResult(executable: string, args: string[], environment = process.env): Promise<void> {
    return new Promise((resolve, reject) => {
        const child = spawn(executable, args, { env: environment, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
        let stderr = '';
        child.stderr.on('data', chunk => { stderr += chunk; });
        const timer = setTimeout(() => { child.kill(); reject(new Error('concurrent writer timed out')); }, 30000);
        child.on('error', error => { clearTimeout(timer); reject(error); });
        child.on('exit', code => { clearTimeout(timer); if (code === 0)
            resolve();
        else
            reject(new Error(`writer exited ${code}: ${stderr}`)); });
    });
}
test('tests.config.test_config_commands.DisplayMutationTests.test_concurrent_enables_are_serialized_without_lost_updates', async (t) => {
    const root = mkdtempSync(join(tmpdir(), 'ts03-config-concurrency-'));
    t.after(() => { rmSync(root, { recursive: true, force: true }); });
    const service = new ConfigurationService({ configDir: root, launch: { executable: '/test/claude-statusline', args: [] }, hostVersion: () => null });
    selection(service, 'main', 'set-items', []);
    const items = ['model-with-effort', 'current-dir', 'git', 'context-remaining', 'tokens', 'task-timer', 'session-cost', 'input-tokens'];
    const env = { ...process.env, PATH: '' };
    await Promise.all(items.map(item => processResult(process.execPath, [join(repoRoot, 'packages/cli/dist/src/entry.js'), 'config', '--config-dir', root, 'enable', item], env)));
    assert.deepEqual(new Set(service.read().display.instances.filter(node => node.enabled).map(node => node.id)), new Set(items));
    const stored = JSON.parse(readFileSync(join(root, 'claude-statusline.json'), 'utf8'));
    assert.equal(stored.schema_version, 9);
});
test('tests.config.test_ui_preferences.UiPreferenceTests.test_concurrent_writers_publish_valid_complete_preferences', async (t) => {
    const root = mkdtempSync(join(tmpdir(), 'ts03-language-concurrency-'));
    t.after(() => { rmSync(root, { recursive: true, force: true }); });
    const env = { ...process.env, PATH: '' };
    await Promise.all(Array.from({ length: 16 }, (_, index) => processResult(process.execPath, [join(repoRoot, 'packages/cli/dist/src/entry.js'), 'config', '--config-dir', root, 'language', 'set', index % 2 ? 'en' : 'zh-CN'], env)));
    assert.ok(['en', 'zh-CN'].includes(readPreferences(root).ui_language));
    assert.equal(readPreferences(root).warning, null);
    assert.deepEqual(Object.keys(JSON.parse(readFileSync(join(root, 'statusline-ui.json'), 'utf8'))), ['schema_version', 'ui_language']);
});
