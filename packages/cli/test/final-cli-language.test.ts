import test from 'node:test';
import { setup, assert, join, existsSync, readFileSync, writeFileSync, jsonBytes } from './final-support.js';
import { invoke, traced } from './final-cli-support.js';
import { LANGUAGES, t as message } from '@fbincon/statusline-core/i18n/messages';
import { LOCALES } from '@fbincon/statusline-core/i18n/generated-locales';
import { config } from './render-support.js';
const remaining = { en: 'Context 50% left', 'zh-CN': '上下文 剩余 50%', 'zh-TW': '上下文 剩餘 50%', 'zh-HK': '上下文 剩餘 50%', ja: 'コンテキスト 残り 50%', ko: '컨텍스트 50% 남음' };
const payload = '{"context_window":{"remaining_percentage":50}}';
test('literal option-looking labels cannot redirect storage or turn into CLI help', async t => {
    const f = setup(t), foreign = join(f.root, 'must-not-exist');
    for (const value of ['--config-dir=' + foreign, '--help', '-h']) {
        const result = await invoke(['config', 'item', 'main', 'model', 'label', '--', value], f.context);
        assert.equal(result.status, 0, result.stderr);
        assert.equal(f.display().instances.find(node => node.id === 'model')!.options.label, value);
        assert.ok(!existsSync(foreign));
    }
});
test('tests.integration.test_language_cli.LanguageCliTests.test_default_set_override_and_reset', async (t) => {
    const f = setup(t), env = { ...f.context, configDir: join(f.root, 'config') }, run = (...args: string[]) => invoke(args, env);
    assert.match((await run('config', '--help')).stdout, /show effective configuration/u);
    assert.ok(!existsSync(env.configDir));
    assert.equal((await run('config', 'language', 'set', 'zh-CN')).status, 0);
    const path = join(env.configDir, 'statusline-ui.json'), before = readFileSync(path);
    assert.match((await run('config', '--help')).stdout, /查看有效配置/u);
    assert.match((await run('--language', 'en', 'config', '--help')).stdout, /show effective configuration/u);
    assert.deepEqual(readFileSync(path), before);
    assert.deepEqual(JSON.parse((await run('config', 'language', 'show', '--json')).stdout), { schema_version: 1, ui_language: 'zh-CN' });
    assert.equal((await run('config', 'language', 'reset')).status, 0);
    assert.match((await run('config', '--help')).stdout, /show effective configuration/u);
});
test('tests.integration.test_language_cli.LanguageCliTests.test_help_and_parser_errors_are_localized_including_groups', async (t) => {
    const f = setup(t), env = { ...f.context };
    assert.match((await invoke(['--language', 'zh-CN', 'config', '--help'], env)).stdout, /选项/u);
    const invalid = await invoke(['--language', 'zh-CN', 'config', 'set', 'invalid-option', 'x'], env);
    assert.equal(invalid.status, 2);
    assert.equal(invalid.stdout, '');
    assert.match(invalid.stderr, /无效选项/u);
    assert.match((await invoke(['--language', 'zh-CN', 'config', 'language', 'set'], env)).stderr, /缺少必填参数/u);
    // Installation help options are tracked separately for TS-04.
});
test('tests.integration.test_language_cli.LanguageCliTests.test_config_directory_is_resolved_before_help', async (t) => {
    const f = setup(t), other = join(f.root, 'other'), missing = join(f.root, 'default');
    const env = { ...f.context, configDir: missing };
    assert.equal((await invoke(['config', '--config-dir', other, 'language', 'set', 'zh-CN'], env)).status, 0);
    assert.match((await invoke(['config', '--config-dir=' + other, '--help'], env)).stdout, /查看有效配置/u);
    assert.ok(!existsSync(missing));
});
test('tests.integration.test_language_cli.LanguageCliTests.test_json_catalogue_and_actual_rendering_are_language_independent', async (t) => {
    const f = setup(t), run = (...args: string[]) => invoke(args, { ...f.context, stdin: () => '{"model":{"id":"same-model"}}' });
    assert.equal((await run('--language', 'en', 'config', 'list-items', '--json')).stdout, (await run('--language', 'zh-CN', 'config', 'list-items', '--json')).stdout);
    assert.match((await run('--language', 'zh-CN', 'config', 'list-items')).stdout, /当前模型标识/u);
    const before = await run('render');
    await run('config', 'language', 'set', 'zh-CN');
    assert.deepEqual(await run('render'), before);
});
test('tests.integration.test_language_cli.LanguageCliTests.test_all_interface_and_statusline_language_combinations_are_independent', async (t) => {
    const f = setup(t), run = (...args: string[]) => invoke(args, { ...f.context, stdin: () => payload });
    await run('config', 'set', 'colors', 'off');
    for (const ui of LANGUAGES) {
        assert.equal((await run('config', 'language', 'set', ui)).status, 0);
        for (const output of LANGUAGES) {
            assert.equal((await run('config', 'set', 'statusline-language', output)).status, 0);
            for (const args of [['render'], ['--language', 'en', 'render'], ['--language', 'zh-CN', 'render']])
                assert.equal((await run(...args)).stdout.trim(), remaining[output]);
            assert.equal(JSON.parse((await run('config', 'show', '--json')).stdout).display.statusline_language, output);
        }
    }
    await run('config', 'language', 'reset');
    assert.equal((await run('render')).stdout.trim(), remaining.ko);
});
test('tests.integration.test_language_cli.LanguageCliTests.test_new_language_help_errors_and_machine_catalogue', async (t) => {
    const f = setup(t), run = (...args: string[]) => invoke(args, f.context), catalogue = (await run('config', 'list-items', '--json')).stdout;
    for (const [language, heading, required] of [['zh-TW', '選項', '缺少必填參數'], ['ja', 'オプション', '次の引数が必要です'], ['ko', '옵션', '다음 인수가 필요합니다']]) {
        assert.ok((await run('--language', language!, '--help')).stdout.includes(heading!));
        assert.ok((await run('--language', language!, 'config', 'language', 'set')).stderr.includes(required!));
        assert.equal((await run('--language', language!, 'config', 'list-items', '--json')).stdout, catalogue);
    }
});
test('tests.integration.test_language_cli.LanguageCliTests.test_every_output_language_survives_portable_roundtrip_without_ui_changes', async (t) => {
    const f = setup(t, true), run = (...args: string[]) => invoke(args, f.context);
    assert.equal((await run('config', 'item', 'main', 'model', 'label', 'ラベル 한국어 自訂')).status, 0);
    for (const language of LANGUAGES) {
        await run('config', 'language', 'set', language);
        const before = readFileSync(join(f.root, 'statusline-ui.json'));
        await run('config', 'set', 'statusline-language', language);
        const exported = join(f.root, language + '.json');
        assert.equal((await run('config', 'export', exported)).status, 0);
        await run('config', 'set', 'statusline-language', 'en');
        const result = await run('config', 'import', exported);
        assert.equal(result.status, 0, result.stderr);
        const display = f.display();
        assert.equal(display.statusline_language, language);
        assert.equal(display.instances.find(n => n.id === 'model')!.options.label, 'ラベル 한국어 自訂');
        assert.deepEqual(readFileSync(join(f.root, 'statusline-ui.json')), before);
    }
});
test('tests.integration.test_language_cli.LanguageCliTests.test_import_requires_installation_with_localized_owned_error', async (t) => {
    const f = setup(t), path = join(f.root, 'before-install.json');
    assert.equal((await invoke(['config', 'export', path], f.context)).status, 0);
    for (const [language, expected] of [['zh-CN', '此 claude-statusline 可执行文件尚未配置'], ['zh-TW', '此 claude-statusline 可執行檔案尚未設定'], ['ja', 'インストールされていません'], ['ko', '설치되지 않았습니다']]) {
        const result = await invoke(['--language', language!, 'config', 'import', path], f.context);
        assert.equal(result.status, 2);
        assert.ok(result.stderr.includes(expected!), result.stderr);
        assert.ok(!existsSync(f.settingsPath));
    }
});
test('tests.integration.test_language_cli.LanguageCliTests.test_invalid_statusline_language_does_not_modify_configuration', async (t) => {
    const f = setup(t);
    await invoke(['config', 'set', 'statusline-language', 'zh-CN'], f.context);
    const before = readFileSync(f.displayPath);
    assert.equal((await invoke(['config', 'set', 'statusline-language', 'auto'], f.context)).status, 2);
    assert.deepEqual(readFileSync(f.displayPath), before);
});
test('tests.i18n.test_registry.LanguageRegistryTests.test_cache_covers_registered_packs_and_unknown_names_do_not_evict_them', () => {
    const entries = Object.entries(LOCALES), identities = entries.map(([, value]) => value);
    for (let n = 0; n < 100; n++)
        assert.equal(message('cli.language', ('unknown-' + n) as any, { language: 'x' }), 'UI language: x');
    assert.deepEqual(Object.keys(LOCALES), LANGUAGES);
    assert.ok(Object.values(LOCALES).every((value, i) => value === identities[i]));
    const old = LOCALES.ja;
    try {
        (LOCALES as any).ja = {};
        assert.equal(message('cli.language', 'ja', { language: 'x' }), 'UI language: x');
    }
    finally {
        (LOCALES as any).ja = old;
    }
});
test('tests.i18n.test_registry.LanguageRegistryTests.test_fresh_render_loads_only_selected_statusline_module_and_no_ui_json', t => {
    const f = setup(t);
    for (const language of LANGUAGES) {
        const display = config(['context-remaining'], { statusline_language: language, scope_labels: 'off' });
        writeFileSync(f.displayPath, jsonBytes(display));
        const result = traced(f.root, ['render'], payload);
        assert.equal(result.stdout.trim(), remaining[language]);
        assert.equal(result.modules.filter(url => /\/i18n\/statusline\//u.test(url)).length, 1);
        assert.ok(result.modules.some(url => url.endsWith('/i18n/statusline/' + language + '.js')));
        assert.deepEqual(result.modules.filter(url => /\/i18n\/(generated-locales|messages)|\.json$|koffi|\/cli\/dist\/src\/runtime\//u.test(url)), []);
        assert.ok(!existsSync(join(f.root, 'statusline-ui.json')));
    }
});
