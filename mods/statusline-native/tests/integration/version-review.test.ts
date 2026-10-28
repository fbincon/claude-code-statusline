import { test, expect } from 'claude-code/testing';
import { setup, START, RUN, PANE, keys, selectSetting, reply, visibleText } from '../fixtures.ts';
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
        const writes = f.calls.filter(call => call.operation === 'apply').length;
        await keys(ui, '3');
        await selectSetting(ui, 'package-management');
        await keys(ui, 'return');
        expect(f.calls.filter(call => call.operation === 'package_status').length).toBe(1);
        expect(f.calls.some(call => call.operation === 'package_review_start')).toBe(false);
        expect(await visibleText(ui)).toContain(t('package.ui.readonly', language));
        for (let step = 0; step < 80 && !(await visibleText(ui)).includes('› Enter · ' + t('package.ui.check', language)); step++)
            await keys(ui, 'down');
        await keys(ui, 'return');
        expect(f.calls.find(call => call.operation === 'package_review_start')?.payload.request.action).toBe('check');
        await keys(ui, 'r');
        expect(await visibleText(ui)).toContain(t('package.ui.unverified', language));
        await keys(ui, 'q');
        expect(f.calls.filter(call => call.operation === 'apply').length).toBe(writes);
        expect(f.calls.some(call => call.operation === 'package_review_cancel')).toBe(true);
        await ui.unmount();
    });
