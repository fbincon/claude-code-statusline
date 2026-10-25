import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { setup, assert, join, repo, existsSync, readFileSync, readdirSync } from './final-support.js';
import { config, agentConfig, updateDisplay, env } from './render-support.js';
import { defaultDisplay, validateDisplay } from '@fbincon/statusline-core/config/display';
import { DEFAULT_HOST } from '@fbincon/statusline-core/config/draft';
import { ITEMS, BY_SCOPE, defaultItems } from '@fbincon/statusline-core/config/catalog';
import { previewRows } from '@fbincon/statusline-core/rendering/preview';
import { rowSpans } from '@fbincon/statusline-core/rendering/spans';
import { strip } from '@fbincon/statusline-core/rendering/layout';
import { ConfigurationProtocol } from '@fbincon/statusline-cli/ui/protocol';
import { ConfigurationService } from '@fbincon/statusline-cli/config/service';
import { previewAdapter } from '@fbincon/statusline-cli/rendering/preview';
import { legacy } from './final-support.js';
test('tests.config.test_catalog.CatalogTests.test_scopes_defaults_and_legacy_descriptions', () => {
    const expected = JSON.parse(readFileSync(join(repo, 'tests/fixtures/migration/ts-01/expected.json'), 'utf8'))['ui-describe'].value.response.result.catalog;
    const original = ITEMS.filter(item => !['cache-miss-reason','external-value','github-pr','github-ci','session-cost-rate'].includes(item.id)).map(({ capabilities, ...item }) => item).map(item => item.scope === 'main' && item.id === 'worktree'
        ? { ...item, description: 'Worktree name in --worktree sessions', sources: ['worktree.name'], guidance: { ...item.guidance, requirements: ['observed_field', 'worktree_session'] } } : item);
    assert.deepEqual(original, expected);
    assert.equal(BY_SCOPE.main.size, 67);
    assert.equal(BY_SCOPE.subagent.size, 17);
    assert.deepEqual(ITEMS.filter(item => item.scope === 'main' && item.default_position !== null).sort((a, b) => a.default_position! - b.default_position!).map(item => item.id), defaultItems('main'));
});
test('tests.ui.test_protocol.ProtocolTests.test_preview_reuses_production_formatting_without_live_sources', async (t) => {
    const f = setup(t), missing = join(f.root, 'absent');
    const fail = () => assert.fail('Preview performed live I/O');
    const protocol = new ConfigurationProtocol(new ConfigurationService({ ...f.context, configDir: missing, hostVersion: fail }, { ...f.io, read: fail, write: fail }), await previewAdapter('/test/home'));
    const display = config([...BY_SCOPE.main.keys()].filter(id => !['text', 'spacer'].includes(id)), { subagents: agentConfig([...BY_SCOPE.subagent.keys()].filter(id => !['text', 'spacer', 'status', 'elapsed'].includes(id))).subagents });
    for (const use_colors of [true, false])
        for (const width of [2, 24, 80, 120]) {
            const current = updateDisplay(display, { use_colors });
            const result = f.call('preview', { draft: { display: current, host: { ...DEFAULT_HOST } }, width }, protocol);
            assert.equal(result.status, 0);
            assert.deepEqual(result.response.result.main.map((row: {
                text: string;
            }[]) => row.map(s => s.text).join('')), previewRows(current, width, env, '/test/home').map(strip));
            assert.ok(!JSON.stringify(result.response).includes('\\u001b'));
        }
    assert.ok(!existsSync(missing));
    assert.deepEqual(readdirSync(f.root), []);
});
test('tests.ui.test_protocol.ProtocolTests.test_invalid_drafts_width_and_strict_host_types', t => {
    const f = setup(t), draft = () => ({ display: defaultDisplay(), host: { ...DEFAULT_HOST } }), cases: unknown[] = [];
    for (const [field, bad] of [['padding', true], ['padding', 2.5], ['padding', 33], ['refresh_interval', 0], ['hide_vim_mode_indicator', 'off']]) {
        const value = draft();
        (value.host as any)[field as string] = bad;
        cases.push({ draft: value, width: 80 });
    }
    for (const width of [true, 0, 1, 80.5, 10001])
        cases.push({ draft: draft(), width });
    for (const id of ['unknown', 'git']) {
        const value = draft();
        if (id === 'unknown')
            value.display.instances[0]!.type_id = id;
        else
            value.display.instances.push({ ...value.display.instances.find(n => n.id === 'git')! });
        cases.push({ draft: value, width: 80 });
    }
    for (const payload of cases)
        assert.equal(f.call('preview', payload).status, 2);
    assert.deepEqual(readdirSync(f.root), []);
});
test('tests.ui.test_protocol.ProtocolTests.test_color_channels_are_not_interpreted_as_sgr_codes', () => {
    assert.deepEqual(rowSpans('\x1b[38;2;30;95;1m中é\x1b[0m'), [{ text: '中é', bold: false, foreground: { kind: 'rgb', value: '#1e5f01' }, background: null }]);
});
test('tests.ui.test_protocol.ProtocolTests.test_legacy_draft_empty_rows_and_mutual_exclusions', t => {
    const f = setup(t);
    assert.equal(f.call('preview', { draft: { display: legacy(1), host: { ...DEFAULT_HOST } }, width: 80 }).status, 0);
    const display = config([], { subagents: agentConfig(undefined, { enabled: false }).subagents });
    let result = f.call('preview', { draft: { display, host: { ...DEFAULT_HOST } }, width: 24 });
    assert.equal(result.status, 0);
    assert.deepEqual(result.response.result.main, []);
    assert.deepEqual(result.response.result.subagents, []);
    display.subagents.instances = [{ ...defaultDisplay().subagents.instances[0]! }, { ...defaultDisplay().subagents.instances[0]!, id: 'elapsed', type_id: 'elapsed' }];
    result = f.call('preview', { draft: { display, host: { ...DEFAULT_HOST } }, width: 80 });
    assert.equal(result.status, 2);
    assert.equal(result.response.error.code, 'invalid_configuration');
    assert.deepEqual(readdirSync(f.root), []);
});
test('tests.ui.test_protocol.ProtocolTests.test_actual_cli_preview_and_utf8_errors_are_json_only', t => {
    const f = setup(t), directory = join(f.root, 'not created'), raw = Buffer.from(JSON.stringify({ protocol_version: 24, operation: 'preview', payload: { draft: { display: defaultDisplay(), host: { ...DEFAULT_HOST } }, width: 80 } }));
    for (const [input, status] of [[raw, 0], [Buffer.from([255]), 2], [Buffer.from('{'), 2]] as const) {
        const result = spawnSync(process.execPath, [join(repo, 'packages/cli/dist/src/entry.js'), 'ui', '--config-dir', directory], { input, encoding: 'utf8', env: { ...process.env, CLAUDE_CONFIG_DIR: directory }, timeout: 10000 });
        assert.equal(result.status, status, result.stderr);
        assert.equal(JSON.parse(result.stdout).protocol_version, 24);
        assert.equal(result.stderr, '');
    }
    assert.ok(!existsSync(directory));
});
