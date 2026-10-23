import test, { type TestContext } from 'node:test';
import { unlinkSync } from 'node:fs';
import { setup, assert, join, writeFileSync, readFileSync, existsSync, legacy } from './final-support.js';
import { config, agentConfig, updateDisplay } from './render-support.js';
import { defaultDisplay, defaultItem } from '@fbincon/statusline-core/config/display';
import { DEFAULT_HOST } from '@fbincon/statusline-core/config/draft';
import { SECTIONS } from '@fbincon/statusline-core/config/import-review';
import { FORMAT, MAX_BYTES } from '@fbincon/statusline-core/config/transfer';
import { ConfigurationService } from '@fbincon/statusline-cli/config/service';
import { ConfigurationProtocol } from '@fbincon/statusline-cli/ui/protocol';
function fixture(t: TestContext) {
    const f = setup(t), target = join(f.root, 'portable 中文.json'), directory = join(f.root, 'missing config'), current = { display: defaultDisplay(), host: { ...DEFAULT_HOST } }, protocol = new ConfigurationProtocol(new ConfigurationService({ ...f.context, configDir: directory }, f.io));
    return { ...f, target, directory, current, write: (draft: unknown) => writeFileSync(target, JSON.stringify({ format: FORMAT, version: 1, draft })), review: (draft = current) => { const result = f.call('review_import', { draft, path: target }, protocol); assert.equal(result.status, 0, JSON.stringify(result.response)); assert.ok(!existsSync(directory)); return result.response.result; }, invalid: () => f.call('review_import', { draft: current, path: target }, protocol) };
}
test('tests.config.test_import_review.ImportReviewTests.test_empty_review_and_file_snapshot_do_not_touch_inputs', t => {
    const f = fixture(t);
    f.write(f.current);
    const raw = readFileSync(f.target), original = structuredClone(f.current), result = f.review();
    assert.deepEqual(result, { draft: original, changes: [] });
    assert.deepEqual(f.current, original);
    assert.deepEqual(readFileSync(f.target), raw);
    unlinkSync(f.target);
    assert.deepEqual(result.draft, original);
});
test('tests.config.test_import_review.ImportReviewTests.test_additions_removals_do_not_fake_reordering', t => {
    const f = fixture(t), candidate = structuredClone(f.current);
    candidate.display.instances[0] = { id: 'model', type_id: 'model', enabled: true, text: null, options: defaultItem() };
    f.write(candidate);
    assert.deepEqual(f.review().changes.map((c: any) => [c.kind, c.item_id]), [['remove', 'model-with-effort'], ['add', 'model']]);
    candidate.display.instances.splice(-2, 2, ...candidate.display.instances.slice(-2).reverse());
    f.write(candidate);
    const reorder = f.review().changes.filter((c: any) => c.kind === 'reorder');
    assert.equal(reorder.length, 1);
    assert.ok(!reorder[0].after.includes('model'));
    assert.deepEqual(new Set(reorder[0].before), new Set(reorder[0].after));
});
test('tests.config.test_import_review.ImportReviewTests.test_every_configuration_section_and_scoped_override_is_reviewed', t => {
    const f = fixture(t);
    let display = updateDisplay(defaultDisplay(), { items: ['model', 'task-timer'], use_colors: false, palette: 'ansi', statusline_language: 'zh-CN', layout: { mode: 'explicit', rows: [['model'], ['task-timer']] }, item_options: { model: { ...defaultItem(), label: '我的模型' } } });
    display = updateDisplay(display, { subagents: agentConfig(['name'], { enabled: false, item_options: { name: { ...defaultItem(), label: 'Agent 名称' } } } as any).subagents });
    const candidate = { display, host: { padding: 4, refresh_interval: 'event', hide_vim_mode_indicator: true } };
    f.write(candidate);
    const result = f.review();
    assert.deepEqual(result.draft, candidate);
    assert.deepEqual(new Set(result.changes.map((c: any) => c.section)), new Set(SECTIONS));
    assert.deepEqual(result.changes.filter((c: any) => c.path.includes('options')).map((c: any) => [c.scope, c.item_id]), [['subagent', 'name']]);
    const added = result.changes.find((c: any) => c.kind === 'add' && c.item_id === 'model');
    assert.equal(added.after.options.label, '我的模型');
    assert.equal(result.changes.filter((c: any) => c.section === 'host').length, 3);
    for (const change of result.changes)
        assert.deepEqual(Object.keys(change.label).sort(), ['fallback', 'key', 'params']);
});
test('tests.config.test_import_review.ImportReviewTests.test_unsaved_draft_and_legacy_display_only_host_are_the_baseline', t => {
    const f = fixture(t), draft = structuredClone(f.current);
    draft.display.palette = 'ansi';
    draft.host.padding = 9;
    f.write(draft);
    assert.deepEqual(f.review(draft).changes, []);
    writeFileSync(f.target, JSON.stringify(legacy(1)));
    const result = f.review(draft);
    assert.deepEqual(result.draft.host, draft.host);
    assert.equal(result.draft.display.schema_version, 10);
    assert.ok(result.changes.every((c: any) => c.section !== 'host'));
});
test('tests.config.test_import_review.ImportReviewTests.test_invalid_reviews_preserve_draft_and_never_create_configuration', t => {
    const f = fixture(t), original = structuredClone(f.current);
    for (const raw of ['{bad', '{"x":NaN}', '{"x":1,"x":2}', ' '.repeat(MAX_BYTES + 1)]) {
        writeFileSync(f.target, raw);
        assert.equal(f.invalid().status, 2);
        assert.deepEqual(f.current, original);
        assert.ok(!existsSync(f.directory));
    }
});
