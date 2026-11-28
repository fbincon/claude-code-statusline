import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defaultItem } from '@fbincon/statusline-core/config/display';
import type { Draft, SourceJob, SourceRegistry } from '@fbincon/statusline-core/contracts/ui';
import { SOURCE_FILENAME } from '@fbincon/statusline-core/extensions/model';
import { t } from '@fbincon/statusline-core/i18n/messages';
import { clip } from '@fbincon/statusline-core/unicode/index';
import { removeTree } from '@fbincon/statusline-platform/remove-tree';
import { back, captureWhen, enter, home, open, pageDown, snapshot, type EditorJourney } from './terminal.js';

const sourceId = 'audit-json';
const componentId = 'audit-value';
const componentLabel = 'Audit value';
const jsonFile = 'audit-value.json';

export function prepareSourceJourney(draft: Draft, project: string, existing: boolean, cli: (args: string[]) => string): void {
    const options = defaultItem();
    options.label = componentLabel;
    draft.display.instances.push({ id: componentId, type_id: 'external-value', options, enabled: true, text: null,
        source: { binding: null, hint: '' } });
    writeFileSync(join(project, jsonFile), JSON.stringify(existing ? { value: 42, observed_at: new Date().toISOString() } : { value: 42 }), { mode: 0o600 });
    if (existing) {
        const spec = join(project, 'audit-definition.json');
        writeFileSync(spec, JSON.stringify({ kind: 'json', name: sourceId, scope: { project: null, session: null, agent: null }, ttl_seconds: 300,
            settings: { path: join(project, jsonFile), pointer: '/value', observed_at_pointer: '/observed_at', unit: '' } }), { mode: 0o600 });
        cli(['source', 'add', sourceId, '--file', spec]);
    }
}

function jobs(config: string): SourceJob[] {
    const root = join(config, 'statusline_runtime', 'sources', 'jobs');
    return existsSync(root) ? readdirSync(root).filter(file => file.endsWith('.json'))
        .map(file => JSON.parse(readFileSync(join(root, file), 'utf8')) as SourceJob).filter(job => job.source_id === sourceId) : [];
}

export async function sourcesJourney(j: EditorJourney, existing: boolean): Promise<void> {
    const tr = (name: string, params: Record<string, unknown> = {}) => t('sources.' + name, j.language, params);
    const registryPath = join(j.config, SOURCE_FILENAME);
    const definition = () => existsSync(registryPath)
        ? (JSON.parse(readFileSync(registryPath, 'utf8')) as SourceRegistry).sources.find(source => source.id === sourceId) : undefined;
    const displayPath = join(j.config, 'claude-statusline.json');
    const saved = snapshot(displayPath);
    const savedComponent = () => (JSON.parse(readFileSync(displayPath, 'utf8')) as Draft['display']).instances.find(node => node.id === componentId);

    await j.key('\x19', 'Ctrl+Y opens sources');
    await captureWhen(j, 'source-list', tr('title'), tr('add'), existing ? sourceId : tr('empty'));
    if (existing) {
        assert.equal(definition()?.enabled, false);
        await open(j, sourceId);
    } else {
        assert.equal(snapshot(registryPath), null);
        await open(j, tr('add'));
        await open(j, tr('json'));
        await j.until(screen => screen.replace(/\s+/gu, '').includes('{"value":42}') && screen.includes('/value'), 'first form shows the minimal JSON and pointer');
        j.frame('json-example');
        await j.key('\x13', 'try saving the blank source form');
        await j.until(screen => j.selected(tr('field.id')) && screen.includes(tr('field.id')), 'invalid form focuses the missing source ID');
        await captureWhen(j, 'json-invalid-form', tr('required_fields'), tr('error.required'));
        assert.equal(snapshot(registryPath), null, 'Blank new source was published');
        await j.key(sourceId, 'enter the source ID');
        await j.key('\x13', 'try saving without a file path');
        await j.until(screen => j.selected(tr('field.path')) && screen.includes(tr('error.required')), 'validation moves to the missing file path');
        j.frame('json-missing-path');
        await j.key(join(j.project, jsonFile), 'enter the isolated JSON file path');
        await j.key('\x13', 'save source definition with Ctrl+S');
        await j.until(() => definition()?.enabled === false, 'created source persists disabled');
        assert.equal(definition()?.settings.path, join(j.project, jsonFile));
        assert.equal(definition()?.settings.pointer, '/value');
    }
    await captureWhen(j, 'disabled-source', sourceId, tr('json'), tr('disabled'), tr('review'));
    assert(j.selected(tr('review')), 'Disabled source did not start at review and enable');
    assert(!j.read().includes(tr('refresh')));
    assert(!j.read().includes(tr('checks')));
    assert(!j.read().includes(tr('cancel')));

    if (j.external) j.resize(64, 18);
    await captureWhen(j, 'disabled-source-compact', sourceId, tr('disabled'), tr('review'));
    const disabled = snapshot(registryPath);
    await j.key(enter, 'review the exact disabled definition');
    await captureWhen(j, 'enable-review-start', sourceId, jsonFile, '/value');
    const access = clip(tr('access_json'), 36, '');
    for (let index = 0; index < 5 && !j.read().includes(access); index++) await j.key(pageDown, 'page through the reviewed access scope');
    await captureWhen(j, 'enable-review-access-scope', access);
    await j.key(home, 'return to first review row');
    await captureWhen(j, 'enable-review-back-at-start', sourceId, jsonFile, '/value');
    await j.key(back, 'cancel enable review');
    await captureWhen(j, 'enable-review-cancelled', sourceId, tr('disabled'), tr('review'));
    assert.deepEqual(snapshot(registryPath), disabled);
    assert.deepEqual(snapshot(displayPath), saved);
    assert.deepEqual(jobs(j.config), []);

    await j.key(enter, 'review again');
    await j.until(screen => screen.includes(jsonFile) && screen.includes('/value'), 'same file and pointer appear on the reviewed definition');
    await j.key(enter, 'enable the reviewed definition');
    await captureWhen(j, 'enabled-source', sourceId, tr('enabled_saved'), tr('refresh'));
    assert.equal(definition()?.enabled, true);
    assert.deepEqual(snapshot(displayPath), saved);

    await open(j, tr('diagnose'));
    await captureWhen(j, 'not-observed', sourceId, tr('no_observation', { reason: tr('reason.not_refreshed') }));
    assert.deepEqual(jobs(j.config), [], 'Opening observation details started a refresh');
    await j.key(back, 'return from observation details to the original source');
    await captureWhen(j, 'back-to-enabled-actions', sourceId, tr('enabled'));
    await open(j, tr('refresh'));
    const freshness = tr(existing ? 'reason.current' : 'reason.unknown');
    const value = tr('observed_value', { value: 42, freshness });
    const completed = tr('refresh_outcome', { state: tr('reason.completed'), reason: tr('reason.valid') });
    await captureWhen(j, 'refresh-value', sourceId, value, completed);
    await j.until(() => jobs(j.config).some(job => job.state === 'completed' && job.result?.summary === '42'), 'the local refresh completed with 42');
    assert(!j.read().includes(tr('summary_state', { state: '', reason: '' }).split(':')[0]! + ':'), 'Local JSON shows automatic refresh state');
    await j.key(back, 'return to JSON actions');

    if (existing) {
        const file = join(j.project, jsonFile), fixture = snapshot(file)!;
        removeTree(file);
        assert(!existsSync(file), 'The owned observation was not removed');
        await open(j, tr('refresh'));
        await captureWhen(j, 'refresh-file-failure', tr('error.missing_file'));
        await j.until(() => jobs(j.config).some(job => job.reason === 'missing_file'), 'the current refresh recorded missing file');
        await j.key(back, 'return from the failed refresh');
        writeFileSync(file, fixture.bytes, { mode: fixture.mode & 0o777 });
    }

    const binds = () => j.requestCount('apply');
    const displaySave = j.external ? '\x13' : 's';
    const displaySaved = t('native.hooks.register.tool_configuration_saved_later_statusline_refreshes_use_these', j.language);
    const component = tr('component', { scope: tr('scope_main'), name: componentLabel });
    const bindingNotice = (name: string) => tr(name, { component, save: j.external ? 'Ctrl+S' : 'S' }).split(/[.;。；]/u)[0]!;
    const action = (name: string) => open(j, tr(name));
    const returnToEditor = async (stage: string) => {
        await j.key(back, 'return to the source list');
        await captureWhen(j, 'source-list-return-' + stage, sourceId, tr('add'));
        await j.key(back, 'return to configured components');
        await j.until(screen => screen.includes(t('composition.configured_title', j.language)), 'configured components returned');
    };
    await action('bind');
    await open(j, componentLabel);
    await captureWhen(j, 'bound-draft', sourceId, bindingNotice('bound'));
    assert.deepEqual(snapshot(displayPath), saved);
    assert.equal(binds(), 0, 'Binding explicitly saved display without its Save shortcut');
    await returnToEditor('bind');
    await j.key(displaySave, 'persist the display binding');
    await j.until(() => binds() === 1 && typeof savedComponent()?.source?.binding === 'string', 'one explicit display save stored the binding');
    const bound = snapshot(displayPath);
    if (j.external) await j.reopenExternal();
    else await captureWhen(j, 'bound-display-saved', clip(displaySaved, 45, ''));
    await j.key('\x19', 'reopen source management');
    await captureWhen(j, 'source-list-saved-binding', sourceId, tr('add'));
    await open(j, sourceId);
    await action('unbind');
    await open(j, componentLabel);
    await captureWhen(j, 'unbound-draft', sourceId, bindingNotice('unbound'));
    assert.deepEqual(snapshot(displayPath), bound);
    assert.equal(binds(), 1, 'Unbinding explicitly saved display without its Save shortcut');
    await action('unbind');
    await captureWhen(j, 'no-unbind-target', tr('no_unbind'));
    await j.key(enter, 'empty unbind screen has no action');
    await captureWhen(j, 'no-unbind-action', tr('no_unbind'));
    await j.key(back, 'return from empty unbind to source actions');
    await returnToEditor('unbind');
    await j.key(displaySave, 'persist display without the binding');
    await j.until(() => binds() === 2 && savedComponent()?.source?.binding === null, 'one further explicit display save removed the binding');
    if (!j.external) await captureWhen(j, 'unbound-display-saved', clip(displaySaved, 45, ''));
    assert.equal(snapshot(displayPath)?.mode, saved?.mode);
    assert.equal(definition()?.enabled, true);
}
