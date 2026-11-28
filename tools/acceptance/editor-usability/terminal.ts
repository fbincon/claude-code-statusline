import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import type { Language } from '@fbincon/statusline-core/i18n/messages';

export const enter = '\r', back = '\x07', down = '\x1b[B', up = '\x1b[A',
    home = '\x1b[H', end = '\x1b[F', pageDown = '\x1b[6~', clear = '\x15';

export interface EditorJourney {
    external: boolean;
    language: Language;
    config: string;
    project: string;
    read(): string;
    selected(label: string): boolean;
    key(bytes: string, label: string): Promise<void>;
    until(predicate: (screen: string) => boolean, label: string, timeout?: number): Promise<void>;
    frame(name: string): void;
    resize(columns: number, rows: number): void;
    reopenExternal(): Promise<void>;
    requestCount(operation: string): number;
}

export function snapshot(path: string): { bytes: Buffer; mode: number } | null {
    try { return { bytes: readFileSync(path), mode: statSync(path).mode }; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
}

export async function captureWhen(journey: EditorJourney, name: string, ...labels: string[]): Promise<void> {
    await journey.until(screen => labels.every(label => screen.includes(label)), name + ' has ' + labels.join(', '));
    journey.frame(name);
}

export async function select(journey: EditorJourney, label: string): Promise<void> {
    if (!journey.selected(label)) await journey.key(home, 'start of choices');
    for (let index = 0; index < 32 && !journey.selected(label); index++)
        await journey.key(down, 'move toward ' + label);
    assert(journey.selected(label), 'Could not select ' + label + '\n' + journey.read());
}

export async function open(journey: EditorJourney, label: string): Promise<void> {
    await select(journey, label);
    await journey.key(enter, 'open ' + label);
}
