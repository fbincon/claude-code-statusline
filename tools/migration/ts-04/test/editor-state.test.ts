import test from 'node:test';
import { fixture, assert, fs, join, Session, bounded, text } from './support.js';
test('tests.ui.test_interactive_config.ItemStateTests.test_initial_order_keeps_enabled_order_then_catalog_order', async (t) => {
    const f = await fixture(t);
    assert.deepEqual(f.e.order.main, f.e.draft.display.instances.map(i => i.id));
    assert.deepEqual(f.e.baseline.draft, f.e.draft);
    f.keys(' ');
    assert.notDeepEqual(f.e.baseline.draft, f.e.draft);
});
test('tests.ui.test_interactive_config.ItemStateTests.test_new_main_items_are_discoverable_and_toggleable', async (t) => {
    const f = await fixture(t);
    for (const id of ['project-name', 'hostname', 'context-used']) {
        f.keys({ key: 'a', ctrl: true });
        assert.ok(f.e.visible('main').some(i => i.id === id));
        f.e.selected.main = id;
        f.keys('return');
        assert.equal(f.e.adding, false);
        assert.ok(f.e.draft.display.instances.some(i => i.type_id === id && i.enabled));
    }
    assert.equal(f.calls.filter(c => c.operation === 'apply').length, 0);
});
test('tests.ui.test_interactive_config.ItemStateTests.test_toggle_empty_set_and_repeated_moves', async (t) => {
    const f = await fixture(t);
    for (const i of f.e.draft.display.instances)
        i.enabled = false;
    for (const id of f.e.order.main)
        assert.equal(f.e.instance('main', id)?.enabled, false);
    const id = f.e.order.main.at(-1)!;
    f.e.selected.main = id;
    f.keys('left', 'left', ' ');
    assert.equal(f.e.instance('main', id)?.enabled, true);
    assert.equal(new Set(f.e.order.main).size, f.e.order.main.length);
});
test('tests.ui.test_interactive_config.ItemStateTests.test_moving_disabled_item_marks_draft_but_does_not_enable_it', async (t) => {
    const f = await fixture(t);
    const id = f.e.order.main.at(-1)!;
    f.e.instance('main', id)!.enabled = false;
    const baseline = structuredClone(f.e.baseline);
    f.e.selected.main = id;
    f.keys('left');
    assert.equal(f.e.modified, true);
    assert.equal(f.e.instance('main', id)!.enabled, false);
    assert.deepEqual(f.e.baseline, baseline);
});
test('tests.ui.test_interactive_config.ItemStateTests.test_search_matches_id_and_description_case_insensitively', async (t) => {
    const f = await fixture(t);
    f.state.search('GIT');
    assert.ok(f.e.visible('main').some(i => i.id === 'git'));
    const matches = f.e.matches('main');
    assert.ok(matches.every(x => x.match.positions.length > 0));
});
test('tests.ui.test_interactive_config.ItemStateTests.test_no_matches_make_toggle_and_move_noops', async (t) => {
    const f = await fixture(t);
    const before = structuredClone(f.e.draft);
    f.state.search('not-a-real-component-xyz');
    f.keys(' ', 'left', 'right');
    assert.deepEqual(f.e.draft, before);
    assert.equal(f.e.selected.main, '');
});
test('tests.ui.test_interactive_config.ItemStateTests.test_filtered_move_is_blocked_and_preserves_the_full_order', async (t) => {
    const f = await fixture(t);
    const before = structuredClone(f.e.draft);
    f.state.search('git');
    f.keys('left', 'right');
    assert.deepEqual(f.e.draft, before);
    assert.ok(f.state.message);
});
test('tests.ui.test_interactive_config.ItemStateTests.test_navigation_and_scroll_stay_valid_across_viewport_changes', async (t) => {
    const f = await fixture(t);
    f.keys('end');
    for (const height of [1, 4, 20, 3]) {
        f.state.ensureVisible(height);
        const index = f.e.visible('main').findIndex(i => i.id === f.e.selected.main);
        assert.ok(index >= f.state.scroll.main! && index < f.state.scroll.main! + height);
    }
    f.keys('home');
    assert.equal(f.state.scroll.main, 0);
});
test('tests.ui.test_interactive_config.ItemStateTests.test_subagent_items_have_independent_search_order_and_selection', async (t) => {
    const f = await fixture(t);
    f.state.search('git');
    const selected = f.e.selected.main, order = [...f.e.order.main];
    f.keys('tab');
    f.state.search('name');
    f.keys(' ', 'down');
    assert.equal(f.e.search.main, 'git');
    assert.equal(f.e.selected.main, selected);
    assert.deepEqual(f.e.order.main, order);
});
test('tests.ui.test_interactive_config.ItemStateTests.test_subagent_enabling_status_or_elapsed_disables_status_elapsed', async (t) => {
    const f = await fixture(t);
    f.e.page = 'subagents';
    const before = structuredClone(f.e.draft);
    assert.equal(f.e.instanceAction('subagent', 'add', 'status'), false);
    assert.deepEqual(f.e.draft, before);
    f.e.selected.subagent = 'status-elapsed';
    f.keys(' ');
    assert.equal(f.e.instanceAction('subagent', 'add', 'status'), true);
    assert.equal(f.e.instanceAction('subagent', 'add', 'elapsed'), true);
    assert.equal(f.e.instance('subagent', 'status-elapsed')!.enabled, false);
});
test('tests.ui.test_interactive_config.ItemStateTests.test_subagent_enabling_status_elapsed_disables_status_and_elapsed', async (t) => {
    const f = await fixture(t);
    f.e.page = 'subagents';
    f.e.selected.subagent = 'status-elapsed';
    f.keys(' ');
    assert.equal(f.e.instanceAction('subagent', 'add', 'status'), true);
    f.e.selected.subagent = 'status-elapsed';
    const before = structuredClone(f.e.draft);
    f.keys(' ');
    assert.deepEqual(f.e.draft, before);
    assert.ok(f.state.message);
});
test('tests.ui.test_interactive_config.ItemStateTests.test_tabs_cycle_four_pages_in_both_directions', async (t) => {
    const f = await fixture(t);
    const pages = [];
    for (let i = 0; i < 4; i++) {
        pages.push(f.e.page);
        f.keys('tab');
    }
    assert.deepEqual(pages, ['main', 'subagents', 'settings', 'layout']);
    for (const page of ['layout', 'settings', 'subagents', 'main']) {
        f.keys({ key: 'tab', shift: true });
        assert.equal(f.e.page, page);
    }
    assert.equal(f.e.modified, false);
});
test('tests.ui.test_interactive_config.SettingStateTests.test_booleans_and_all_enumerations_cycle', async (t) => {
    const f = await fixture(t);
    f.e.page = 'settings';
    for (const key of ['colors', 'palette', 'directory-style', 'separator-style', 'scope-labels', 'vim-indicator', 'custom-subagent-rows']) {
        f.e.setting = key;
        const before = structuredClone(f.e.draft);
        f.keys('right', 'left');
        assert.deepEqual(f.e.draft, before, key);
    }
    assert.equal(f.calls.filter(c => c.operation === 'apply').length, 0);
});
test('tests.ui.test_interactive_config.SettingStateTests.test_padding_clamps_and_refresh_custom_value_joins_cycle', async (t) => {
    const f = await fixture(t);
    f.e.page = 'settings';
    f.e.setting = 'padding';
    f.e.draft.host.padding = 0;
    f.keys('left');
    assert.equal(f.e.draft.host.padding, 0);
    f.e.draft.host.padding = 32;
    f.keys('right');
    assert.equal(f.e.draft.host.padding, 32);
    f.e.setting = 'refresh_interval';
    f.e.draft.host.refresh_interval = 7;
    f.keys('left');
    assert.equal(f.e.draft.host.refresh_interval, 5);
    f.keys('e', 'left');
    assert.equal(f.e.draft.host.refresh_interval, 3600);
});
test('tests.ui.test_interactive_config.SettingStateTests.test_numeric_edit_accept_error_backspace_and_escape_restore', async (t) => {
    const f = await fixture(t);
    f.e.page = 'settings';
    f.e.setting = 'padding';
    f.keys('3', '3');
    assert.equal(f.e.draft.host.padding, 3);
    assert.ok(f.state.message.includes('32'));
    f.keys('return');
    assert.equal((f.state.input as {
        kind: string;
    } | null)?.kind, 'numeric');
    f.keys('backspace', 'return');
    assert.equal(f.state.input, null);
    f.keys('5', 'escape');
    assert.equal(f.e.draft.host.padding, 3);
    f.e.setting = 'refresh_interval';
    const before = f.e.draft.host.refresh_interval;
    f.keys('0', 'return');
    assert.equal((f.state.input as {
        kind: string;
    } | null)?.kind, 'numeric');
    f.keys('escape');
    assert.equal(f.e.draft.host.refresh_interval, before);
});
test('tests.ui.test_interactive_config.SettingStateTests.test_numeric_edit_blocks_tabs_and_needs_second_enter_to_save', async (t) => {
    const f = await fixture(t);
    f.e.page = 'settings';
    f.e.setting = 'padding';
    f.keys('2', 'tab');
    assert.equal(f.e.page, 'settings');
    assert.equal((f.state.input as {
        kind: string;
    } | null)?.kind, 'numeric');
    assert.deepEqual(f.keys('return', 'return'), [null, 'save']);
});
test('tests.ui.test_search.SearchTests.test_queries_and_categories_are_ephemeral_and_block_all_reorders', async (t) => {
    const f = await fixture(t);
    const before = structuredClone(f.e.draft);
    f.e.chooseCategory('main', f.e.categories('main')[1]!);
    f.keys('left', 'right');
    assert.deepEqual(f.e.draft, before);
    f.state.search('git');
    assert.equal(f.e.modified, false);
});
test('tests.ui.test_search.SearchTests.test_category_keyboard_accept_cancel_and_empty_selection', async (t) => {
    const f = await fixture(t);
    f.keys({ key: 'f', ctrl: true }, 'end', 'escape');
    assert.equal(f.e.category.main, 'all');
    f.keys({ key: 'f', ctrl: true }, 'end', 'return');
    assert.equal(f.e.category.main, f.e.categories('main').at(-1));
    f.state.search('no-match-xyz');
    assert.equal(f.e.selected.main, '');
    f.keys({ key: 'f', ctrl: true }, 'home', 'return');
    assert.equal(f.e.selected.main, '');
});
test('tests.ui.test_search.SearchTests.test_actual_bilingual_fields_and_custom_label_are_searchable', async (t) => {
    const f = await fixture(t);
    const node = f.e.draft.display.instances[0]!;
    node.options.label = '自定义独特标签';
    f.state.search('自定义');
    assert.equal(f.e.selected.main, node.id);
    f.state.search('model');
    assert.ok(f.e.matches('main').length);
    f.state.search('模型');
    assert.ok(f.e.matches('main').length);
});
test('tests.ui.test_search.SearchTests.test_explicit_search_accepts_spaces_without_toggling_or_saving', async (t) => {
    const f = await fixture(t);
    const before = structuredClone(f.e.draft);
    f.keys('/');
    for (const key of 'model with effort')
        f.keys(key);
    assert.equal(f.e.selected.main, 'model-with-effort');
    assert.deepEqual(f.keys('return'), [null]);
    assert.equal(f.state.input, null);
    assert.deepEqual(f.e.draft, before);
});
test('tests.ui.test_search.SearchTests.test_search_length_counts_original_unicode_codepoints', async (t) => {
    const f = await fixture(t);
    f.state.search('😀'.repeat(255) + '界');
    f.state.search('😀'.repeat(255) + '界x');
    assert.equal(f.state.localized.message?.key, 'input.limit');
    assert.equal([...f.e.search.main].length, 256);
    assert.ok(f.e.search.main.endsWith('界'));
});
test('tests.ui.test_search.SearchTests.test_search_refocuses_better_matches_but_navigation_keeps_weaker_matches', async (t) => {
    const f = await fixture(t);
    f.state.search('model');
    assert.equal(f.e.matches('main')[0]!.match.rank, 0);
    f.keys('end');
    const selected = f.e.selected.main;
    f.state.ensureVisible(4);
    assert.equal(f.e.selected.main, selected);
    f.state.search('model-with-effort');
    assert.equal(f.e.selected.main, 'model-with-effort');
});
test('tests.ui.test_instance_editor.InstanceEditorTests.test_copy_remove_and_scope_identity_keep_the_baseline', async (t) => {
    const f = await fixture(t);
    const before = structuredClone(f.e.baseline), selected = f.e.selected.main;
    f.keys({ key: 'd', ctrl: true });
    assert.notEqual(f.e.selected.main, selected);
    assert.equal(f.e.draft.display.instances.length, before.draft.display.instances.length + 1);
    f.keys({ key: 'x', ctrl: true });
    assert.deepEqual(f.e.draft, before.draft);
    assert.deepEqual(f.e.baseline, before);
});
test('tests.ui.test_instance_editor.InstanceEditorTests.test_literal_instance_can_be_found_by_its_displayed_text', async (t) => {
    const f = await fixture(t);
    assert.equal(f.e.instanceAction('main', 'add', 'text'), true);
    const node = f.e.instance('main', f.e.selected.main)!;
    node.text = 'Literal 中文';
    f.state.search('literal');
    assert.equal(f.e.selected.main, node.id);
});
test('tests.ui.test_instance_editor.InstanceEditorTests.test_add_picker_guidance_cancel_and_accept_preserve_drafts', async (t) => {
    const f = await fixture(t);
    f.state.search('model');
    const before = structuredClone(f.e.draft), selected = f.e.selected.main;
    f.keys({ key: 'a', ctrl: true }, { key: 'e', ctrl: true });
    assert.equal(f.e.guidanceScroll, 0);
    f.keys('escape', 'escape');
    assert.deepEqual(f.e.draft, before);
    assert.equal(f.e.search.main, 'model');
    assert.equal(f.e.selected.main, selected);
    f.keys({ key: 'a', ctrl: true });
    f.state.search('text');
    f.keys('return');
    assert.equal(f.e.adding, false);
    assert.equal(f.e.instance('main', f.e.selected.main)!.type_id, 'text');
});
test('tests.ui.test_instance_editor.InstanceEditorTests.test_rejected_spacer_move_keeps_order_and_positions', async (t) => {
    const f = await fixture(t);
    const nodes = [['model', 'model'], ['s1', 'spacer'], ['git', 'git'], ['s2', 'spacer']].map(([id, type_id]) => ({ id: id!, type_id: type_id!, enabled: true, text: null, options: structuredClone(f.e.draft.display.instances[0]!.options) }));
    for (const n of nodes) {
        n.options.label = null;
        n.options.icon = null;
        n.options.priority = 50;
        n.options.max_width = null;
        n.options.formatting = {};
        n.options.foreground = null;
        n.options.background = null;
        n.options.visibility = 'always';
        n.options.visibility_threshold = 0;
    }
    const next = structuredClone(f.e.draft);
    next.display.instances = nodes;
    next.display.layout = { mode: 'explicit', rows: [['model', 's1'], ['git', 's2']] };
    f.e.replaceDraft(next);
    f.e.selected.main = 's1';
    const before = structuredClone(f.e.draft), order = [...f.e.order.main];
    f.keys('right');
    assert.deepEqual(f.e.draft, before);
    assert.deepEqual(f.e.order.main, order);
    assert.equal(f.e.selected.main, 's1');
    assert.ok(f.state.message);
});
test('tests.ui.test_advanced_forms.AdvancedFormsTests.test_layout_selection_survives_removing_all_enabled_items', async (t) => {
    const f = await fixture(t);
    for (const n of [...f.e.draft.display.instances]) {
        f.e.selected.main = n.id;
        f.e.instanceAction('main', 'remove');
    }
    f.e.page = 'layout';
    for (const key of ['up', 'down', 'home', 'end', 'pageup', 'pagedown'])
        f.keys(key);
    assert.equal(f.e.setting, 'layout-mode');
    assert.ok(text(f.state).includes('Layout'));
});
test('tests.ui.test_advanced_forms.AdvancedFormsTests.test_layout_boundaries_and_navigation_remain_valid', async (t) => {
    const f = await fixture(t);
    f.e.page = 'layout';
    f.e.setting = 'layout-mode';
    f.keys('right');
    assert.equal(f.e.draft.display.layout.mode, 'explicit');
    const field = f.state.rows().find(r => r.key.startsWith('break:'))!;
    f.e.setting = field.key;
    f.keys(' ');
    assert.equal(f.e.draft.display.layout.rows.length, 2);
    assert.deepEqual(f.e.draft.display.layout.rows.flat(), f.e.order.main);
    f.keys('end');
    const selected = f.e.setting;
    bounded(f.state, 64, 18);
    assert.equal(f.e.setting, selected);
});
test('tests.ui.test_advanced_forms.AdvancedFormsTests.test_item_text_cancel_and_numeric_validation', async (t) => {
    const f = await fixture(t);
    f.keys({ key: 'e', ctrl: true });
    const before = structuredClone(f.e.draft);
    f.keys('return', '中', 'escape');
    assert.deepEqual(f.e.draft, before);
    f.e.setting = 'item:priority';
    f.keys('return', { key: 'u', ctrl: true }, '1', '0', '1', 'return');
    assert.equal((f.state.input as {
        kind: string;
    } | null)?.kind, 'field');
    assert.deepEqual(f.e.draft, before);
    f.keys('backspace', 'return');
    assert.equal(f.state.input, null);
    assert.equal(f.e.instance('main', f.e.selected.main)!.options.priority, 10);
});
test('tests.ui.test_language.LanguageUiTests.test_statusline_language_is_a_draft_and_preserves_interface_and_input', async (t) => {
    const f = await fixture(t);
    f.e.page = 'settings';
    f.e.setting = 'field:statusline_language';
    f.keys('right');
    assert.equal(f.e.draft.display.statusline_language, 'zh-CN');
    assert.equal(f.state.language, 'en');
    assert.equal(f.e.modified, true);
    assert.equal(f.calls.some(c => c.operation === 'set_ui_language'), false);
});
test('tests.ui.test_language.LanguageUiTests.test_cancelled_screen_keeps_persisted_output_language_unchanged', async (t) => {
    const f = await fixture(t);
    const bytes = f.bytes();
    f.e.page = 'settings';
    f.e.setting = 'field:statusline_language';
    await f.session.key({ key: 'right' });
    const result = await f.session.key({ key: 'escape' });
    assert.equal((result as any).outcome, 'cancelled');
    assert.deepEqual(f.bytes(), bytes);
});
test('tests.ui.test_interactive_config.SaveAndRunTests.test_cancel_and_interrupt_do_not_save', async (t) => {
    const f = await fixture(t);
    const before = f.bytes();
    await f.session.key({ key: ' ' });
    for (const key of [{ key: 'escape' }, { key: 'c', ctrl: true }]) {
        const result = await f.session.key(key);
        assert.ok(['cancelled', 'interrupted'].includes((result as any).outcome));
    }
    assert.equal(f.calls.some(c => c.operation === 'apply'), false);
    assert.deepEqual(f.bytes(), before);
});
test('tests.ui.test_interactive_config.SaveAndRunTests.test_save_calls_apply_once_with_complete_draft_and_baseline', async (t) => {
    const f = await fixture(t);
    const revision = f.e.baseline.revision;
    f.keys(' ');
    const draft = structuredClone(f.e.draft);
    const result = await f.session.save();
    assert.equal(result.outcome, 'updated');
    const calls = f.calls.filter(c => c.operation === 'apply');
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0]!.payload, { draft, expected_revision: revision });
    assert.deepEqual(f.e.baseline.draft, draft);
    assert.equal((await f.session.save()).outcome, 'already-current');
    assert.deepEqual(JSON.parse(fs.readFileSync(f.settingsPath, 'utf8')).permissions, { allow: ['Read'] });
});
test('tests.ui.test_apply_protocol.ApplyProtocolTests.test_curses_expected_snapshot_protects_subagent_owner', async (t) => {
    const f = await fixture(t);
    const settings = JSON.parse(fs.readFileSync(f.settingsPath, 'utf8'));
    settings.subagentStatusLine = { type: 'command', command: '/foreign/tool render-subagents' };
    fs.writeFileSync(f.settingsPath, JSON.stringify(settings));
    const before = f.bytes();
    await assert.rejects(f.session.save(), (e: any) => e.code === 'configuration_conflict' || e.code === 'ownership_mismatch');
    assert.deepEqual(f.bytes(), before);
});
test('tests.ui.test_apply_protocol.ApplyProtocolTests.test_external_and_client_saves_conflict_in_both_orders', async (t) => {
    const f = await fixture(t);
    const client = await Session.open(f.backend);
    f.keys(' ');
    await f.session.save();
    await assert.rejects(client.save(), (e: any) => e.code === 'configuration_conflict');
    const external = await Session.open(f.backend);
    const first = await Session.open(f.backend);
    first.state.editor.draft.display.use_colors = !first.state.editor.draft.display.use_colors;
    await first.save();
    await assert.rejects(external.save(), (e: any) => e.code === 'configuration_conflict');
});
