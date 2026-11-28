import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join } from 'node:path';

export const editorJourneys = ['save', 'restore', 'cancel'] as const;
type Journey = typeof editorJourneys[number];
interface Step {
    visible: string;
    keys: string;
    preference?: 'preset' | 'custom';
}

/** Drive identical key sequences and check on-disk state on POSIX PTYs and Windows consoles. */
export function installedEditorJourney(config: string, choice: Journey) {
    const openShortcuts = '\t\t\t\x1b[F\r'; // Settings, last row, open Keyboard shortcuts.
    const journeys: Record<Journey, Step[]> = {
        save: [
            { visible: 'Preview (sample data)', keys: '\r', preference: 'preset' },
            { visible: 'Configure Status Line *', keys: openShortcuts + '\r' },
            { visible: 'New key for Save display', keys: 'z\x1b[B\x1b[B\r' },
            { visible: 'New key for Exit editor', keys: '\x03' },
            { visible: 'Ctrl+C interrupts', keys: '\x07\t\r', preference: 'preset' },
            { visible: 'Keyboard shortcuts saved.', keys: '\x07', preference: 'custom' },
            { visible: 'Z save', keys: '\x13\x1b[Z' },
            { visible: 'Set explicit rows', keys: 'z' },
        ],
        restore: [
            { visible: 'Z save', keys: '\r', preference: 'custom' },
            { visible: 'Configure Status Line *', keys: openShortcuts + '\t\x1b[B\r' },
            { visible: 'Defaults staged. Save to apply.', keys: '\x1b[A\r', preference: 'custom' },
            { visible: 'Keyboard shortcuts saved.', keys: '\x07', preference: 'preset' },
            { visible: 'Ctrl+S save', keys: 'z\x1b[Z' },
            { visible: 'Set explicit rows', keys: '\x13' },
        ],
        cancel: [
            { visible: 'Preview (sample data)', keys: ' \x1b', preference: 'preset' },
            { visible: 'Discard changes and close', keys: '\x1b[B\r' },
        ],
    };
    const steps = journeys[choice], preference = join(config, 'statusline-shortcuts.json');
    const protectedFiles = ['claude-statusline.json', 'settings.json'].map(name => {
        const path = join(config, name);
        return { path, bytes: fs.readFileSync(path), mode: fs.statSync(path).mode };
    });
    let index = 0, offset = 0;
    return {
        get complete() { return index === steps.length; },
        get waitingFor() { return steps[index]?.visible; },
        next(output: string): string | null {
            const step = steps[index];
            if (!step || !output.slice(offset).replace(/\x1b\[[0-9;]*m/gu, '').includes(step.visible)) return null;
            for (const { path, bytes, mode } of protectedFiles) {
                assert.deepEqual(fs.readFileSync(path), bytes, step.visible + ' changed ' + path);
                assert.equal(fs.statSync(path).mode, mode, step.visible + ' changed the mode of ' + path);
            }
            if (step.preference === 'preset') assert(!fs.existsSync(preference), step.visible);
            if (step.preference === 'custom') assert.deepEqual(JSON.parse(fs.readFileSync(preference, 'utf8')), { schema_version: 1, bindings: { save: 'Z' } });
            offset = output.length;
            index++;
            return step.keys;
        },
    };
}
