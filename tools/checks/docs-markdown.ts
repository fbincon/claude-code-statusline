/** Small, static readers for the Markdown forms owned by the content suite. */
import assert from 'node:assert/strict';

const small = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
    'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const tens = ['twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const digits = '零一二三四五六七八九';
export function documentedNumber(text: string): number {
    if (/^(?:0|[1-9][0-9]*|[1-9][0-9]{0,2}(?:,[0-9]{3})+)$/u.test(text)) return Number(text.replaceAll(',', ''));
    const word = text.toLowerCase();
    if (small.includes(word)) return small.indexOf(word);
    const [ten, unit] = word.split('-');
    if (tens.includes(ten!)) {
        assert(unit === undefined || small.indexOf(unit) > 0 && small.indexOf(unit) < 10, 'Invalid number ' + text);
        return (tens.indexOf(ten!) + 2) * 10 + (unit === undefined ? 0 : small.indexOf(unit));
    }
    assert(/^[零一二三四五六七八九十百千]+$/u.test(text), 'Invalid number ' + text);
    let total = 0, pending = 0, previous = 10000;
    for (const character of text) {
        const digit = digits.indexOf(character);
        if (digit >= 0) { pending = digit; continue; }
        const scale = ({ 十: 10, 百: 100, 千: 1000 })[character];
        assert(scale && scale < previous, 'Invalid number ' + text);
        total += (pending || 1) * scale; pending = 0; previous = scale;
    }
    const value = total + pending;
    let canonical = '', remaining = value, gap = false;
    for (const scale of [1000, 100, 10, 1]) {
        const digit = Math.floor(remaining / scale); remaining %= scale;
        if (!digit) { if (canonical && remaining) gap = true; continue; }
        if (gap) { canonical += '零'; gap = false; }
        if (!(scale === 10 && digit === 1 && !canonical)) canonical += digits[digit];
        if (scale > 1) canonical += ({ 1000: '千', 100: '百', 10: '十' })[scale];
    }
    assert.equal(canonical || '零', text, 'Invalid number ' + text); return value;
}
// Capture the complete token, including a wrong prefix, instead of matching its suffix.
const english = [...small, ...tens.map(ten => ten + '(?:-(?:' + small.slice(1, 10).join('|') + '))?')].join('|');
export const NUMBER = '(?<![0-9A-Za-z,._+零一二三四五六七八九十百千万-])([0-9](?:[0-9,]*[0-9])?|' + english + '|[零一二三四五六七八九十百千万]+)(?![0-9A-Za-z_+零一二三四五六七八九十百千万-]|\\.[0-9])';
export function numericClaims(body: string, pattern: string, values: readonly number[], message: string): void {
    const matches = [...body.matchAll(new RegExp(pattern, 'giu'))];
    assert(matches.length, 'Missing declaration: ' + message);
    for (const match of matches) assert.deepEqual(match.slice(1).map(documentedNumber), [...values], message);
}

const shells = new Set(['bash', 'sh', 'shell', 'powershell', 'ps1', 'console', 'text']);
function markdownParts(body: string): { prose: string; code: string[] } {
    const prose: string[] = [], code: string[] = [];
    let fence: { character: string; length: number; language: string; lines: string[] } | undefined;
    for (const line of body.replaceAll('\r\n', '\n').split('\n')) {
        const marker = line.match(/^\s{0,3}(`{3,}|~{3,})([^\s`]*)[^\n]*$/u);
        if (fence) {
            if (marker && marker[1]![0] === fence.character && marker[1]!.length >= fence.length && !marker[2]) {
                if (shells.has(fence.language)) code.push(fence.lines.join('\n')); fence = undefined;
            } else fence.lines.push(line);
        } else if (marker) fence = { character: marker[1]![0]!, length: marker[1]!.length, language: marker[2]!.toLowerCase(), lines: [] };
        else prose.push(line);
    }
    assert(!fence, 'Unclosed documentation fence');
    const text = prose.join('\n');
    for (const match of text.matchAll(/(`+)([^`]*?)\1/gu)) code.push(match[2]!);
    return { prose: text, code };
}
export function documentationProse(body: string): string {
    let historicalTable = false;
    return markdownParts(body).prose.split('\n').filter(line => {
        const heading = line.match(/^#{1,6} (.+)$/u);
        if (heading) historicalTable = /^(?:protocol|schema|interface).*history|^(?:协议|格式|接口).*(?:历史|演进)/iu.test(heading[1]!);
        return !(historicalTable && /^\s*\|/u.test(line));
    }).join('\n').replace(/`([^`]+)`/gu, '$1').replace(/\*\*([^*]+)\*\*|__([^_]+)__/gu, (_, bold: string, underline: string) => bold ?? underline);
}

/** Tokenize only documented literal command forms; quoted prose is never a command. */
function commands(code: string): string[][] {
    const result: string[][] = []; let words: string[] = [], word = '', quote = '', started = false;
    const flush = () => { if (started) words.push(word); word = ''; started = false; };
    const end = () => { flush(); if (words.length) result.push(words); words = []; };
    code = code.replace(/(?:\\|`)\n[ \t]*/gu, ' ');
    for (let index = 0; index < code.length; index++) {
        const character = code[index]!;
        if (quote) { if (character === quote) quote = ''; else word += character; continue; }
        if (character === '"' || character === "'") { quote = character; started = true; }
        else if (character === '#' && !started) { while (index < code.length && code[index] !== '\n') index++; end(); }
        else if ('\n;&|'.includes(character)) end();
        else if (/\s/u.test(character)) flush();
        else { word += character; started = true; }
    }
    end(); return result;
}
export function checkNpmScripts(body: string, scripts: ReadonlySet<string>): void {
    for (const code of markdownParts(body).code) for (const words of commands(code)) {
        while (words[0] === '$' || words[0] === '>' || /^[A-Za-z_][A-Za-z0-9_]*=/u.test(words[0] ?? '')) words.shift();
        if (!/^(?:npm|npm\.cmd)$/u.test(words[0] ?? '') || words[1] !== 'run') continue;
        let at = 2;
        while (words[at]?.startsWith('--')) {
            const option = words[at++]!;
            if (['--prefix', '--workspace'].includes(option)) {
                assert(words[at] && !words[at]!.startsWith('-'), 'Missing npm option value: ' + option); at++;
            } else assert(['--silent', '--if-present'].includes(option) || /^(?:--prefix|--workspace)=.+$/u.test(option), 'Unsupported npm run option: ' + option);
        }
        const script = words[at];
        if (script === undefined) continue; // `npm run` legitimately lists scripts.
        assert(scripts.has(script), 'Unknown npm script ' + script);
    }
}

export function checkInterfaceVersions(body: string, versions: { schema: number; editor: number; runtime: number }, live: boolean): void {
    const prose = documentationProse(body);
    for (const [label, version] of [
        ['display schema|显示 schema', versions.schema], ['editor protocol|编辑器协议', versions.editor],
        ['runtime protocol|运行协议', versions.runtime],
    ] as const) {
        for (const match of prose.matchAll(new RegExp('(?:' + label + ')\\s*v?([0-9]+)(?![0-9–-])', 'giu'))) {
            // A statement that v2 introduced a capability is historical, even inside a current guide.
            if (/^\s*(?:introduced\b|引入)/iu.test(prose.slice(match.index + match[0].length))) continue;
            assert.equal(Number(match[1]), version, 'Current interface differs from core: ' + match[0]);
        }
    }
    if (live) for (const pattern of [
        /(?:Runtime protocol|运行协议)\s*v?([0-9]+)\s*(?:evolves independently|与配置协议独立演进)/giu,
        /(?:Current runtime protocol|当前运行协议)\s*v?([0-9]+)\s*(?:retains\b|保留)/giu,
    ]) {
        const matches = [...prose.matchAll(pattern)];
        assert.equal(matches.length, 1, 'Missing or duplicate current runtime protocol declaration');
        assert.equal(Number(matches[0]![1]), versions.runtime, 'Current runtime protocol differs from core');
    }
}
