import test from 'node:test';
import { fixture, assert, fs, join, Session, bounded, text, repoRoot } from './support.js';
import type { Backend } from '@fbincon/statusline-tui/session';
import { LANGUAGES, t as tMessage } from '@fbincon/statusline-core/i18n/messages';
import { createReview } from '@fbincon/statusline-core/editor/import-review';
import { differences } from '@fbincon/statusline-core/config/import-review';
import { setFormValue } from '@fbincon/statusline-core/editor/forms';
import { fields, bestMatch, matchText } from '@fbincon/statusline-core/editor/search';
import { main } from '@fbincon/statusline-cli/main';
async function reviewFixture(t: import('node:test').TestContext) {
    const f = await fixture(t);
    f.e.page = 'settings';
    f.e.draft.display.palette = 'ansi';
    const candidate = structuredClone(f.e.draft);
    candidate.host.padding = 7;
    candidate.display.statusline_language = 'zh-CN';
    candidate.display.instances[0]!.options.label = '长标签中文 '.repeat(30);
    f.e.review = createReview({ draft: candidate, changes: differences(f.e.draft, candidate) });
    return f;
}
test('tests.ui.test_language.LanguageUiTests.test_all_languages_cycle_both_directions_and_persist_outside_draft', async (t) => {
    const f = await fixture(t);
    const before = structuredClone(f.e.draft);
    f.e.page = 'settings';
    f.e.setting = 'ui-language';
    for (const delta of ['right', 'left'])
        for (let i = 0; i < 5; i++) {
            await f.session.key({ key: delta });
            assert.equal((await f.backend.request('read_ui_preferences')).ui_language, f.state.language);
            assert.deepEqual(f.e.draft, before);
        }
    assert.equal(f.state.language, 'en');
    assert.equal(fs.existsSync(f.displayPath), false);
});
test('tests.ui.test_language.LanguageUiTests.test_language_persists_immediately_while_draft_and_cancel_are_independent', async (t) => {
    const f = await fixture(t);
    f.keys(' ');
    const draft = structuredClone(f.e.draft);
    f.e.page = 'settings';
    f.e.setting = 'ui-language';
    await f.session.key({ key: 'right' });
    assert.equal(f.state.language, 'zh-CN');
    assert.deepEqual(f.e.draft, draft);
    await f.session.key({ key: 'escape' });
    assert.equal((await f.backend.request('read_ui_preferences')).ui_language, 'zh-CN');
    assert.equal(fs.existsSync(f.displayPath), false);
});
test('tests.ui.test_language.LanguageUiTests.test_failed_language_save_retains_language_draft_and_field', async (t) => {
    const f = await fixture(t);
    const failing: Backend = { request(op, payload) { if (op === 'set_ui_language')
            throw new Error('read-only preference'); return f.backend.request(op, payload); } };
    const session = await Session.open(failing);
    session.state.editor.page = 'settings';
    session.state.editor.setting = 'ui-language';
    const draft = structuredClone(session.state.editor.draft);
    await session.key({ key: 'right' });
    assert.equal(session.state.language, 'en');
    assert.equal(session.state.editor.setting, 'ui-language');
    assert.deepEqual(session.state.editor.draft, draft);
    assert.ok(session.state.message.includes('read-only'));
});
test('tests.ui.test_language.LanguageUiTests.test_open_reads_shared_preference_and_override_only_changes_initial_locale', async (t) => {
    const f = await fixture(t);
    await f.backend.request('set_ui_language', { ui_language: 'zh-CN' });
    assert.equal((await Session.open(f.backend)).state.language, 'zh-CN');
    const override = await Session.open(f.backend, 'ja');
    assert.equal(override.state.language, 'ja');
    assert.equal((await f.backend.request('read_ui_preferences')).ui_language, 'zh-CN');
    assert.equal(fs.existsSync(f.displayPath), false);
});
test('tests.ui.test_language.LanguageUiTests.test_search_matches_both_languages_ids_and_custom_labels', async (t) => {
    const f = await fixture(t);
    for (const language of LANGUAGES) {
        f.state.language = language;
        for (const query of ['model', '模型']) {
            f.state.search(query);
            assert.ok(f.e.matches('main').length);
        }
    }
    f.e.draft.display.instances[0]!.options.label = '专属自定义';
    f.state.search('专属');
    assert.equal(f.e.selected.main, f.e.draft.display.instances[0]!.id);
});
test('tests.ui.test_statusline_language.StatuslineLanguageSessionTests.test_save_and_cancel_share_draft_semantics_in_all_25_language_combinations', async (t) => {
    const f = await fixture(t);
    for (const ui of LANGUAGES)
        for (const output of LANGUAGES) {
            await f.backend.request('set_ui_language', { ui_language: ui });
            const session = await Session.open(f.backend);
            session.state.editor.draft.display.statusline_language = output;
            const before = f.bytes();
            assert.equal((await session.key({ key: 'escape' }) as any).outcome, 'cancelled');
            assert.deepEqual(f.bytes(), before);
            await session.save();
            const persisted = await f.backend.request('read');
            assert.equal(persisted.draft.display.statusline_language, output);
            assert.equal((await f.backend.request('read_ui_preferences')).ui_language, ui);
        }
});
test('tests.ui.test_statusline_language.StatuslineLanguageSessionTests.test_save_failure_preserves_file_and_draft', async (t) => {
    const f = await fixture(t);
    await f.session.save();
    const session = await Session.open(f.backend);
    session.state.editor.draft.display.statusline_language = 'ko';
    const draft = structuredClone(session.state.editor.draft), bytes = f.bytes();
    const write = f.io.write;
    f.io.write = (path, raw) => { if (path === f.displayPath)
        throw new Error('injected write failure'); write(path, raw); };
    await assert.rejects(session.save());
    assert.deepEqual(f.bytes(), bytes);
    assert.deepEqual(session.state.editor.draft, draft);
});
test('tests.ui.test_import_review.ReviewUiTests.test_accept_replaces_only_draft_and_keeps_opening_revision', async (t) => {
    const f = await reviewFixture(t);
    const revision = f.e.baseline.revision;
    const before = f.bytes();
    f.keys('a');
    assert.equal(f.e.review, null);
    assert.equal(f.e.draft.host.padding, 7);
    assert.equal(f.e.draft.display.statusline_language, 'zh-CN');
    assert.equal(f.e.baseline.revision, revision);
    assert.deepEqual(f.bytes(), before);
    assert.deepEqual(f.keys({ key: 's', ctrl: true }), ['save']);
});
test('tests.ui.test_import_review.ReviewUiTests.test_cancel_preserves_unsaved_draft_revision_and_editor_state', async (t) => {
    const f = await reviewFixture(t);
    const draft = structuredClone(f.e.draft), baseline = structuredClone(f.e.baseline), page = f.e.page, selected = f.e.setting;
    f.keys('q');
    assert.equal(f.e.review, null);
    assert.deepEqual(f.e.draft, draft);
    assert.deepEqual(f.e.baseline, baseline);
    assert.equal(f.e.page, page);
    assert.equal(f.e.setting, selected);
});
test('tests.ui.test_import_review.ReviewUiTests.test_review_sections_long_values_and_previews_resize_in_both_languages', async (t) => {
    const f = await reviewFixture(t);
    for (const lang of ['en', 'zh-CN'] as const) {
        f.state.language = lang;
        f.e.review!.expanded = ['main', 'subagent', 'formatting', 'layout', 'language', 'host'];
        for (const [w, h] of [[64, 18], [64, 20], [80, 24], [120, 30], [80, 48]]) {
            bounded(f.state, w!, h!);
            f.state.key({ key: 'end' }, w!, h!);
            const output = text(f.state, w!, h!);
            assert.ok(!output.includes('review.'));
            assert.ok(output.includes('7'));
            assert.equal(f.e.draft.host.padding, 0);
        }
    }
    f.keys('tab');
    assert.equal(f.e.review!.previewScope, 'subagent');
    await f.session.preview(80, 24);
    assert.equal((f.calls.at(-1)!.payload as any).draft.host.padding, 7);
});
test('tests.ui.test_import_review.ReviewUiTests.test_empty_review_and_nested_localized_labels', async (t) => {
    const f = await fixture(t);
    f.e.review = createReview({ draft: structuredClone(f.e.draft), changes: [] });
    for (const lang of LANGUAGES) {
        f.state.language = lang;
        const output = text(f.state);
        assert.ok(output.includes(tMessage('review.empty', lang)));
        assert.ok(!output.includes('undefined'));
    }
    assert.deepEqual(f.e.review.expanded, []);
});
test('tests.ui.test_advanced_forms.AdvancedFormsTests.test_transfer_input_is_deferred_and_replaces_only_draft', async (t) => {
    const f = await fixture(t);
    f.e.page = 'settings';
    f.e.setting = 'export-file';
    f.keys('return');
    assert.equal(f.calls.some(c => c.operation === 'export'), false);
    f.keys({ key: 'u', ctrl: true });
    const path = join(f.root, 'portable.json');
    for (const key of path)
        f.keys(key);
    await f.session.key({ key: 'return' });
    assert.ok(fs.existsSync(path));
    assert.equal(fs.existsSync(f.displayPath), false);
    f.e.setting = 'preset-select';
    f.keys('right');
    f.e.setting = 'preset-apply';
    const revision = f.e.baseline.revision;
    await f.session.key({ key: 'return' });
    assert.equal(f.e.baseline.revision, revision);
    assert.equal(fs.existsSync(f.displayPath), false);
    f.e.setting = 'import-file';
    f.keys('return');
    await f.session.key({ key: 'return' });
    assert.ok(f.e.review);
});
test('tests.ui.test_advanced_forms.AdvancedFormsTests.test_field_parser_refuses_coercions_and_fractional_numbers', async (t) => {
    const f = await fixture(t);
    f.e.page = 'settings';
    const row = f.state.rows().find(r => r.key === 'field:formatting.thresholds.warning')!;
    for (const bad of ['1.2', 'true', 'NaN', '-1', '100000', true]) {
        const before = structuredClone(f.e.draft);
        assert.equal(setFormValue(f.state, row.form!, bad), false);
        assert.deepEqual(f.e.draft, before);
    }
    assert.equal(fs.existsSync(f.displayPath), false);
});
test('tests.ui.test_advanced_forms.AdvancedFormsTests.test_global_descriptors_parse_choices_and_thresholds_without_saving', async (t) => {
    const f = await fixture(t);
    f.e.page = 'settings';
    const rows = f.state.rows();
    for (const row of rows.filter(r => r.form?.spec.kind === 'choice')) {
        const before = structuredClone(f.e.draft);
        for (const value of row.form!.spec.choices) {
            assert.equal(setFormValue(f.state, row.form!, value), true);
        }
        f.e.draft = before;
    }
    const warning = rows.find(r => r.key === 'field:formatting.thresholds.warning')!;
    assert.equal(setFormValue(f.state, warning.form!, '20'), true);
    assert.equal(f.e.draft.display.formatting.thresholds.warning, 20);
    assert.equal(fs.existsSync(f.displayPath), false);
});
test('tests.ui.test_search.SearchTests.test_new_languages_share_prepared_index_and_custom_labels_invalidate_locally', async (t) => {
    const f = await fixture(t);
    const item = f.e.description.catalog[0]!;
    const first = fields(item);
    assert.equal(fields(item), first);
    const prepared = first[1];
    const custom = fields(item, 'new custom label');
    assert.equal(custom, first);
    assert.equal(custom[1], prepared);
    assert.ok(bestMatch(custom, 'new custom label'));
    fields(item, 'replacement label');
    assert.equal(bestMatch(custom, 'new custom label'), null);
    fields(item, 'new custom label');
    assert.equal(fields(item, 'new custom label'), custom);
    for (const language of LANGUAGES)
        assert.ok(bestMatch(custom, tMessage(`items.${item.scope}.${item.id}.label`, language)));
});
test('tests.ui.test_search.SearchTests.test_shared_codepoint_matches_and_stable_tiers', async (t) => {
    const data = JSON.parse(fs.readFileSync(join(repoRoot, 'tests/fixtures/editor-search.json'), 'utf8'));
    for (const row of data.text_matches) {
        const value = matchText(row.text, row.query);
        if (row.rank === null)
            assert.equal(value, null);
        else {
            assert.equal(value?.rank, row.rank);
            assert.deepEqual(value?.positions, row.positions);
        }
    }
});
test('tests.ui.test_search.SearchTests.test_categories_cover_both_scopes_without_changing_defaults', async (t) => {
    const f = await fixture(t);
    const before = structuredClone(f.e.draft);
    for (const scope of ['main', 'subagent'] as const) {
        const categories = f.e.categories(scope);
        assert.equal(categories[0], 'all');
        assert.deepEqual(new Set(categories.slice(1)), new Set(f.e.description.catalog.filter(i => i.scope === scope).map(i => i.group)));
    }
    assert.deepEqual(f.e.draft, before);
});
test('tests.ui.test_apply_protocol.ApplyProtocolTests.test_cli_curses_and_json_apply_equivalence', async (t) => {
    const a = await fixture(t), b = await fixture(t), c = await fixture(t);
    a.e.draft.display.use_colors = false;
    await a.session.save();
    const baseline = await b.backend.request('read');
    baseline.draft.display.use_colors = false;
    await b.backend.request('apply', { draft: baseline.draft, expected_revision: baseline.revision });
    let stderr = '';
    assert.equal(await main(['config', '--config-dir', c.root, 'set', 'colors', 'off'], { launch: c.launch, stdout: () => { }, stderr: value => { stderr += value; }, hostVersion: () => [2, 1, 296] }), 0, stderr);
    assert.deepEqual(JSON.parse(fs.readFileSync(a.displayPath, 'utf8')), JSON.parse(fs.readFileSync(b.displayPath, 'utf8')));
    assert.deepEqual(JSON.parse(fs.readFileSync(a.displayPath, 'utf8')), JSON.parse(fs.readFileSync(c.displayPath, 'utf8')));
});
