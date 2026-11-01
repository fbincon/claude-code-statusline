import { StringDecoder } from 'node:string_decoder';
import type { Key } from '@fbincon/statusline-core/terminal/key';
export type { Key } from '@fbincon/statusline-core/terminal/key';
const sequences: Record<string, Key> = {
    '[A': { key: 'up' }, '[B': { key: 'down' }, '[C': { key: 'right' }, '[D': { key: 'left' },
    '[H': { key: 'home' }, '[F': { key: 'end' }, '[1~': { key: 'home' }, '[4~': { key: 'end' },
    '[7~': { key: 'home' }, '[8~': { key: 'end' }, '[5~': { key: 'pageup' }, '[6~': { key: 'pagedown' },
    '[3~': { key: 'delete' }, '[Z': { key: 'tab', shift: true },
    OA: { key: 'up' }, OB: { key: 'down' }, OC: { key: 'right' }, OD: { key: 'left' }, OH: { key: 'home' }, OF: { key: 'end' },
};
const ESC = 0x1b;
const PASTE_END = Buffer.from('\x1b[201~');
const MAX_PASTE = 16384;
const MAX_SEQUENCE = 64;

function ordinaryKeys(text: string, keys: Key[]): void {
    for (const c of text) {
        if (c === '\r' || c === '\n') keys.push({ key: 'return' });
        else if (c === '\t') keys.push({ key: 'tab' });
        else if (c === '\x7f' || c === '\b') keys.push({ key: 'backspace' });
        else if (c.charCodeAt(0) > 0 && c.charCodeAt(0) < 27) keys.push({ key: String.fromCharCode(c.charCodeAt(0) + 96), ctrl: true });
        else if (!/[\p{Cc}\p{Cs}]/u.test(c)) keys.push({ key: c });
    }
}

/** Consume terminal frames before decoding UTF-8 or dispatching ordinary keys. */
export class KeyDecoder {
    private decoder = new StringDecoder('utf8');
    private escapes = 0;
    // An empty sequence discards an invalid/oversized frame through its final byte.
    private sequence: string | null = null;
    private metaSequence = false;
    private metaContinuation = 0;
    private mouseBytes = 0;
    private paste: string | null = null;
    private pasteEndBytes = 0;
    private overflow = false;

    get pendingEscape(): boolean { return this.escapes > 0; }
    flushEscape(): Key[] {
        const count = this.escapes;
        this.escapes = 0;
        return Array.from({ length: count }, () => ({ key: 'escape' }));
    }
    private appendPaste(text: string): void {
        if (this.overflow) return;
        if (this.paste!.length + text.length <= MAX_PASTE) this.paste += text;
        else this.overflow = true;
    }
    private consumePaste(bytes: Buffer, start: number, keys: Key[]): number {
        if (this.pasteEndBytes) {
            if (bytes[start] !== PASTE_END[this.pasteEndBytes]) {
                this.appendPaste(this.decoder.write(PASTE_END.subarray(0, this.pasteEndBytes)));
                this.pasteEndBytes = 0;
                return start;
            }
            if (++this.pasteEndBytes === PASTE_END.length) {
                this.appendPaste(this.decoder.end());
                keys.push(this.overflow ? { key: 'input-overflow', overflow: true } : { key: this.paste!, paste: true });
                this.paste = null;
                this.pasteEndBytes = 0;
            }
            return start + 1;
        }
        const next = bytes.indexOf(ESC, start);
        if (next < 0) { this.appendPaste(this.decoder.write(bytes.subarray(start))); return bytes.length; }
        this.appendPaste(this.decoder.write(bytes.subarray(start, next)));
        this.pasteEndBytes = 1;
        return next + 1;
    }
    private consumeSequence(byte: number, keys: Key[]): void {
        if (byte === ESC || byte === 3) {
            this.sequence = null;
            if (byte === ESC) this.escapes = 1;
            else keys.push({ key: 'c', ctrl: true });
            return;
        }
        const character = String.fromCharCode(byte);
        if (this.sequence === '[' && character === '[') { this.sequence = '[['; return; } // Linux console F1–F5.
        if (byte >= 0x40 && byte <= 0x7e) {
            const frame = this.sequence + character;
            this.sequence = null;
            if (frame === '[200~') { this.paste = ''; this.overflow = false; }
            else if (frame === '[M') this.mouseBytes = 3; // X10 button and position bytes.
            else if (!this.metaSequence && sequences[frame]) keys.push(sequences[frame]!);
        } else if (this.sequence && this.sequence.length < MAX_SEQUENCE && byte >= 0x20 && byte <= 0x3f) {
            this.sequence += character;
        } else this.sequence = '';
    }
    push(chunk: Uint8Array | string): Key[] {
        const bytes = typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength);
        const keys: Key[] = [];
        let index = 0;
        while (index < bytes.length) {
            if (this.paste !== null) { index = this.consumePaste(bytes, index, keys); continue; }
            if (this.mouseBytes) {
                const count = Math.min(this.mouseBytes, bytes.length - index);
                this.mouseBytes -= count; index += count; continue;
            }
            const byte = bytes[index]!;
            if (this.metaContinuation) {
                if ((byte & 0xc0) === 0x80) { this.metaContinuation--; index++; continue; }
                this.metaContinuation = 0;
            }
            if (this.sequence !== null) { this.consumeSequence(byte, keys); index++; continue; }
            if (byte === ESC) {
                ordinaryKeys(this.decoder.end(), keys);
                if (this.escapes === 2) keys.push({ key: 'escape' });
                else this.escapes++;
                index++; continue;
            }
            if (this.escapes) {
                if (byte === 0x5b || byte === 0x4f) {
                    this.sequence = String.fromCharCode(byte);
                    this.metaSequence = this.escapes === 2;
                } else {
                    // Alt has no external bindings. Consume its complete UTF-8 key, including Alt+Enter.
                    this.metaContinuation = byte >= 0xc2 && byte <= 0xdf ? 1 : byte >= 0xe0 && byte <= 0xef ? 2 : byte >= 0xf0 && byte <= 0xf4 ? 3 : 0;
                }
                this.escapes = 0; index++; continue;
            }
            const next = bytes.indexOf(ESC, index), end = next < 0 ? bytes.length : next;
            ordinaryKeys(this.decoder.write(bytes.subarray(index, end)), keys);
            index = end;
        }
        return keys;
    }
}
