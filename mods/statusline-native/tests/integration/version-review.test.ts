import { test, expect } from 'claude-code/testing';
import { setup, START, RUN, PANE, keys, selectSetting, reply, visibleText, previewDraft } from '../fixtures.ts';
import { LANGUAGES, t } from '../../lib/i18n/index.ts';
import type { PackageStatus, PackageReviewJob } from '../../lib/generated-contracts.ts';
const status: PackageStatus = { version: 1, backend_version: 'test', captured_at: '2026-10-28T00:00:00Z', revision: 'a'.repeat(64), prefix: '/prefix', entry: '/prefix/entry', config_dir: '/config', current: '3.10.0', previous: '3.9.2', channel: 'latest', node_version: '24.21.0', host: '2.1.310', compatible: true, reasons: [], pending: null, history: [], offset: 0, total: 0 };
for (const language of LANGUAGES)
    test(`version page is local on entry and separates metadata review in ${language}`, { timeoutMs: 20000 }, async ($, on) => {
        const f = setup(on);
        f.store.uiLanguage = language;
        let job: PackageReviewJob | null = null;
        f.behavior.process = (request, next) => {
            if (request.operation === 'package_status')
                return { value: reply(status) };
            if (request.operation === 'package_review_start') {
                job = { version: 1, id: 'review-00000000-0000-0000-0000-000000000000', owner: request.payload.owner, state: 'running', started_at: status.captured_at, finished_at: null, request: request.payload.request, review: null, error: null };
                return { value: reply(job) };
            }
            if (request.operation === 'package_review_status')
                return { value: reply({ ...job!, state: 'complete', finished_at: status.captured_at, review: { action: 'check', current: '3.10.0', target: '3.11.0', prefix: '/prefix', entry: '/prefix/entry', config_dir: '/config', channel: 'latest', registry: 'https://registry.npmjs.org/', integrity: 'sha512-' + 'A'.repeat(86) + '==', node_engine: '>=22', host: '2.1.310', artifact_verified: false, compatible: true, reasons: [], configuration_conflicts: [], backup_id: null, files: [] } }) };
            if (request.operation === 'package_review_cancel')
                return { value: reply({ ...job!, state: 'cancelled' }) };
            return next();
        };
        await $.session.start(START);
        await $.command.run(RUN);
        const ui = await $.ui.mount(PANE);
        await keys(ui, 'd');
        const saved = JSON.stringify(f.store.draft), draft = JSON.stringify(previewDraft(f));
        const writes = f.calls.filter(call => call.operation === 'apply').length;
        await keys(ui, '4');
        await selectSetting(ui, 'package-management');
        expect(await visibleText(ui)).toContain(t('settings.package-management', language));
        await keys(ui, 'return');
        expect(f.calls.filter(call => call.operation === 'package_status').length).toBe(1);
        expect(f.calls.some(call => call.operation === 'package_review_start')).toBe(false);
        expect((await visibleText(ui)).replace(/\s+/gu,' ')).toContain(t('package.ui.local_notice', language));
        const checkSelected = async () => (await visibleText(ui)).replace(/\s+/gu, ' ').includes('› Enter · ' + t('package.ui.check', language));
        for (let step = 0; step < 80 && !(await checkSelected()); step++)
            await keys(ui, 'down');
        expect(await checkSelected()).toBe(true);
        await keys(ui, 'return');
        expect(f.calls.find(call => call.operation === 'package_review_start')?.payload.request.action).toBe('check');
        await keys(ui, 'r');
        expect(await visibleText(ui)).toContain(t('package.ui.unverified', language));
        await keys(ui, 'q');
        expect(await checkSelected()).toBe(true);
        expect(f.calls.some(call => call.operation === 'package_review_cancel')).toBe(false);
        await keys(ui, 'q');
        expect(f.calls.filter(call => call.operation === 'apply').length).toBe(writes);
        expect(f.calls.some(call => call.operation === 'package_review_cancel')).toBe(true);
        expect(JSON.stringify(previewDraft(f))).toBe(draft);
        expect(JSON.stringify(f.store.draft)).toBe(saved);
        expect(f.store.uiLanguage).toBe(language);
        expect(f.configCalls.length).toBe(0);
        await ui.unmount();
    });

test('native channel selection exposes its Enter action and restores the row at 32×12', { timeoutMs: 20000 }, async ($, on) => {
    const f = setup(on);
    f.store.uiLanguage = 'zh-CN';
    f.store.shortcuts = { schema_version: 1, bindings: { 'close-packages': 'Z' }, revision: '3'.repeat(64), warning: null };
    f.behavior.process = (request, next) => request.operation === 'package_status' ? { value: reply(status) } : next();
    const screen = async () => (await visibleText(ui)).replace(/\s+/gu, ' ');
    await $.session.start(START);
    await $.command.run(RUN);
    const ui = await $.ui.mount(PANE);
    await keys(ui, '4');
    await selectSetting(ui, 'package-management');
    await keys(ui, 'return');
    expect(await screen()).toContain('› Enter 编辑 · 目标版本');
    await keys(ui, 'down');
    expect(await screen()).toContain('› Enter 选择 · 渠道');
    await keys(ui, 'return', 'end');
    expect(await screen()).toContain('› Enter · beta');
    expect(await screen()).toContain('Z/Ctrl+G');
    await ui.resize({ columns: 32, rows: 12 });
    await keys(ui, 'z');
    expect(await screen()).toContain('› Enter 选择 · 渠道');
    expect(await screen()).toContain('3.10.0');
    await keys(ui, 'return', 'end', 'return');
    expect(await screen()).toContain('渠道：beta');
    await keys(ui, 'return', 'home', { key: 'g', ctrl: true });
    expect(await screen()).toContain('渠道：beta');
    expect(await screen()).toContain('› Enter 选择 · 渠道');
    expect(f.calls.filter(call => call.operation.startsWith('package_')).map(call => call.operation)).toEqual(['package_status']);
    await ui.unmount();
});
