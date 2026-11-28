import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defaultItem } from '@fbincon/statusline-core/config/display';
import type { Draft } from '@fbincon/statusline-core/contracts/ui';
import { t } from '@fbincon/statusline-core/i18n/messages';
import { back, captureWhen, clear, end, enter, open, snapshot, up, type EditorJourney } from './terminal.js';

const first = 'DIAG-01', last = 'DIAG-06', input = 'audit-input.json', empty = 'audit-empty-agents.json';

export function prepareDiagnosisJourney(draft: Draft, project: string): void {
    const instances = Array.from({ length: 6 }, (_, i) => ({ id: 'audit-diag-' + (i + 1), type_id: 'text', enabled: true,
        text: 'DIAG-0' + (i + 1), options: defaultItem() }));
    draft.display.instances = instances;
    draft.display.layout = { mode: 'explicit', rows: instances.map(({ id }) => [id]) };
    writeFileSync(join(project, input), '{"model":{"id":"audit-model"}}\n', { mode: 0o600 });
    writeFileSync(join(project, empty), '{"tasks":[]}\n', { mode: 0o600 });
}

export async function diagnosisJourney(j: EditorJourney): Promise<void> {
    const tr = (key: string, params: Record<string, unknown> = {}) => t(key, j.language, params);
    const display = join(j.config, 'claude-statusline.json');
    const saved = snapshot(display), files = [input, empty].map(name => snapshot(join(j.project, name)));
    const sampleTitle = j.external ? tr('ui.drawing.preview_sample_data').trim() : tr('native.preview.full').split('{choice}')[0]!.trim();
    const sample = (text: string) => sectionOutput(text, sampleTitle);
    const output = (text: string) => sectionOutput(text, tr('diagnosis.output'));
    if (j.external) j.resize(64, 18);
    await j.until(text => sample(text).includes(first), 'the sample starts at its first row');
    await j.key('\x0e', 'advance the sample output');
    await j.until(text => sample(text).includes('DIAG-02') && !sample(text).includes(first), 'the sample moved off its first row');
    await j.key('\x0c', 'open explicit file diagnosis');

    const run = () => open(j, tr('diagnosis.run'));
    const path = async (value: string) => {
        await open(j, tr('diagnosis.path'));
        await j.key(clear, 'clear the prior file path');
        await j.key(value, 'enter ' + value);
        await j.key(enter, 'accept file path');
    };
    const missing = 'missing-audit.json', failure = tr('diagnose.error.file', { value: '' }).trim();
    await path(missing);
    await run();
    await captureWhen(j, 'diagnosis-file-error', missing, failure);
    assert(!j.read().includes(tr('diagnosis.previous')), 'A first failure showed a previous successful report');
    await path(join(j.project, input));
    await run();
    await j.until(text => output(text).includes(first) && text.includes(tr('diagnosis.input_only')), 'diagnosis output is at the first real row');
    j.frame('diagnosis-first-output');
    assert(!j.read().includes(failure));
    await j.key('\t', 'Tab focuses diagnostic output');
    await j.key(end, 'move the diagnostic output to its end');
    await j.until(text => output(text).includes(last), 'diagnosis output reaches the last row');
    j.frame('diagnosis-last-output');
    await j.key(up, 'one up key immediately moves off the last row');
    await j.until(text => output(text).includes('DIAG-05') && !output(text).includes(last), 'diagnostic output moves on first reverse key');
    j.frame('diagnosis-previous-output');

    await j.key(back, 'return to file diagnosis inputs');
    await open(j, tr('diagnosis.scope'));
    await path(join(j.project, empty));
    await run();
    await captureWhen(j, 'diagnosis-empty-output', tr('diagnosis.no_output'));
    assert(!output(j.read()).includes(first));
    assert(!j.read().includes(failure));
    await j.key(back, 'return to the diagnosed inputs');
    await j.key(back, 'return to the retained editor');
    assert.deepEqual(snapshot(display), saved);
    assert.deepEqual([input, empty].map(name => snapshot(join(j.project, name))), files);
}

function sectionOutput(screen: string, heading: string): string {
    const rows = screen.split('\n');
    const header = rows.findLastIndex(line => line.includes(heading));
    if (header < 0) return '';
    const bottom = rows.findIndex((line, index) => index > header && /[╰└]─{2,}/u.test(line));
    return rows.slice(header + 1, bottom < 0 ? undefined : bottom).join('\n');
}
