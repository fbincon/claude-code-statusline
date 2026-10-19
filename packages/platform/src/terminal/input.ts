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
/** Incremental UTF-8 and escape parsing. Paste text cannot execute control chords. */
export class KeyDecoder {
    private decoder = new StringDecoder('utf8');
    private buffer = '';
    private pasting = false;
    private paste = '';
    private overflow = false;
    get pendingEscape(): boolean { return !this.pasting && this.buffer.startsWith('\x1b'); }
    push(chunk: Uint8Array | string): Key[] {
        this.buffer += typeof chunk === 'string' ? chunk : this.decoder.write(Buffer.from(chunk));
        const result: Key[] = [];
        while (this.buffer) {
            if (!this.pasting && this.buffer.startsWith('\x1b[200~')) {
                this.pasting = true; this.paste = ''; this.overflow = false;
                this.buffer = this.buffer.slice(6);
                continue;
            }
            if (this.buffer.startsWith('\x1b[201~')) {
                this.pasting = false;
                result.push(this.overflow ? {key: 'input-overflow', overflow: true} : {key: this.paste, paste: true});
                this.paste = '';
                this.buffer = this.buffer.slice(6);
                continue;
            }
            if (this.pasting) {
                if ('\x1b[201~'.startsWith(this.buffer))
                    break;
                const c = [...this.buffer][0]!;
                this.buffer = this.buffer.slice(c.length);
                if (this.paste.length + c.length <= 16384) this.paste += c;
                else this.overflow = true;
                continue;
            }
            if (this.buffer[0] === '\x1b') {
                if (this.buffer.length === 1)
                    break;
                if (['[', 'O'].includes(this.buffer[1]!)) {
                    const end = this.buffer.slice(2).search(/[\x40-\x7e]/u);
                    if (end < 0) {
                        if (this.buffer.length > 64)
                            this.buffer = '';
                        break;
                    }
                    const sequence = this.buffer.slice(1, end + 3);
                    this.buffer = this.buffer.slice(end + 3);
                    if (sequences[sequence])
                        result.push(sequences[sequence]!);
                }
                else {
                    result.push({ key: 'escape' });
                    this.buffer = this.buffer.slice(1);
                }
                continue;
            }
            const c = [...this.buffer][0]!;
            this.buffer = this.buffer.slice(c.length);
            if (c === '\r' || c === '\n')
                result.push({ key: 'return' });
            else if (c === '\t')
                result.push({ key: 'tab' });
            else if (c === '\x7f' || c === '\b')
                result.push({ key: 'backspace' });
            else if (c.charCodeAt(0) > 0 && c.charCodeAt(0) < 27)
                result.push({ key: String.fromCharCode(c.charCodeAt(0) + 96), ctrl: true });
            else if (!/[\p{Cc}\p{Cs}]/u.test(c))
                result.push({ key: c });
        }
        return result;
    }
    flushEscape(): Key[] { if (!this.pendingEscape)
        return []; this.buffer = ''; return [{ key: 'escape' }]; }
}
