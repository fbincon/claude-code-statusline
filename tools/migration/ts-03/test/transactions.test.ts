import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { exportReference, python, repoRoot } from '../common.js';
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
    const root = mkdtempSync(join(tmpdir(), 'ts03-config-concurrency-')), reference = exportReference();
    t.after(() => { rmSync(root, { recursive: true, force: true }); rmSync(reference, { recursive: true, force: true }); });
    const service = new ConfigurationService({ configDir: root, launch: { executable: '/test/claude-statusline', args: [] }, hostVersion: () => null });
    selection(service, 'main', 'set-items', []);
    const items = ['model-with-effort', 'current-dir', 'git', 'context-remaining', 'tokens', 'task-timer', 'session-cost', 'input-tokens'];
    const pythonExecutable = execFileSync(python, ['-c', 'import sys;print(sys.executable)'], { encoding: 'utf8' }).trim();
    const env = { ...process.env, PATH: '', PYTHONPATH: join(reference, 'src'), PYTHONDONTWRITEBYTECODE: '1', PYTHONUTF8: '1' };
    await Promise.all(items.map((item, index) => index % 2 ?
        processResult(process.execPath, [join(repoRoot, 'packages/cli/dist/src/entry.js'), 'config', '--config-dir', root, 'enable', item], env) :
        processResult(pythonExecutable, ['-B', '-c', 'import sys;from pathlib import Path;from claude_statusline.config.service import enable_items;enable_items(Path(sys.argv[1]),Path("/test/claude-statusline"),[sys.argv[2]])', root, item], env)));
    assert.deepEqual(new Set(service.read().display.instances.filter(node => node.enabled).map(node => node.id)), new Set(items));
    const stored = JSON.parse(readFileSync(join(root, 'claude-statusline.json'), 'utf8'));
    assert.equal(stored.schema_version, 8);
});
test('tests.config.test_ui_preferences.UiPreferenceTests.test_concurrent_writers_publish_valid_complete_preferences', async (t) => {
    const root = mkdtempSync(join(tmpdir(), 'ts03-language-concurrency-')), reference = exportReference();
    t.after(() => { rmSync(root, { recursive: true, force: true }); rmSync(reference, { recursive: true, force: true }); });
    const pythonExecutable = execFileSync(python, ['-c', 'import sys;print(sys.executable)'], { encoding: 'utf8' }).trim();
    const env = { ...process.env, PATH: '', PYTHONPATH: join(reference, 'src'), PYTHONDONTWRITEBYTECODE: '1', PYTHONUTF8: '1' };
    await Promise.all(Array.from({ length: 16 }, (_, index) => index % 2 ?
        processResult(process.execPath, [join(repoRoot, 'packages/cli/dist/src/entry.js'), 'config', '--config-dir', root, 'language', 'set', index % 4 === 1 ? 'en' : 'zh-CN'], env) :
        processResult(pythonExecutable, ['-B', '-c', 'import sys;from pathlib import Path;from claude_statusline.config.ui_preferences import set_language;set_language(Path(sys.argv[1]),sys.argv[2])', root, index % 4 === 0 ? 'en' : 'zh-CN'], env)));
    assert.ok(['en', 'zh-CN'].includes(readPreferences(root).ui_language));
    assert.equal(readPreferences(root).warning, null);
    assert.deepEqual(Object.keys(JSON.parse(readFileSync(join(root, 'statusline-ui.json'), 'utf8'))), ['schema_version', 'ui_language']);
});
