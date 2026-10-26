/** Immutable historical inputs. Network preparation is separate from offline installation. */
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { HISTORICAL_RELEASES, type HistoricalRelease } from './historical-releases.js';

const MAX_BYTES = 64 * 1024 * 1024;
const TRANSIENT = new Set(['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EAI_AGAIN', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_SOCKET']);
export const historicalFilename = (version: HistoricalRelease) => `claude-code-statusline-${version}.tgz`;
export function verifyHistorical(bytes: Buffer, digest: string): void {
    assert(bytes.length > 2 && bytes.length < MAX_BYTES, 'Invalid historical archive size');
    assert.equal(bytes.readUInt16BE(0), 0x1f8b, 'Historical input is not gzip');
    assert.equal(createHash('sha256').update(bytes).digest('hex'), digest, 'Historical archive SHA-256 mismatch');
}
export function transientDownload(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    return error.name === 'TimeoutError' || TRANSIENT.has(String((error as NodeJS.ErrnoException).code)) ||
        (error.cause !== undefined && transientDownload(error.cause));
}
export interface DownloadAttempt { attempt: number; phase: string; elapsed_ms: number; status?: number; retry: boolean }
export async function downloadHistorical(url: string, digest: string, options: {
    fetch?: typeof fetch; sleep?: (ms: number) => Promise<void>; record?: (attempt: DownloadAttempt) => void;
} = {}): Promise<Buffer> {
    const request = options.fetch ?? fetch, sleep = options.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
    for (let attempt = 1; attempt <= 3; attempt++) {
        const started = performance.now(); let phase = 'connect', status: number | undefined, retry = false;
        try {
            const response = await request(url, { signal: AbortSignal.timeout(60_000), redirect: 'error' });
            status = response.status;
            if (!response.ok) {
                retry = [408, 429, 500, 502, 503, 504].includes(status);
                await response.body?.cancel();
                throw new Error('Historical download HTTP ' + status);
            }
            phase = 'read';
            assert(response.body, 'Empty historical response');
            const chunks: Buffer[] = []; let size = 0;
            for await (const chunk of response.body) {
                size += chunk.length;
                assert(size < MAX_BYTES, 'Historical archive exceeds size limit');
                chunks.push(Buffer.from(chunk));
            }
            phase = 'verify';
            const bytes = Buffer.concat(chunks); verifyHistorical(bytes, digest);
            options.record?.({ attempt, phase, status, elapsed_ms: performance.now() - started, retry: false });
            return bytes;
        } catch (error) {
            retry = phase !== 'verify' && (retry || transientDownload(error));
            options.record?.({ attempt, phase, ...(status === undefined ? {} : { status }), elapsed_ms: performance.now() - started, retry: retry && attempt < 3 });
            if (!retry || attempt === 3) throw error;
            await sleep(attempt * 1000);
        }
    }
    throw new Error('Historical download attempts exhausted');
}
export async function prepareHistorical(version: HistoricalRelease, destination: string): Promise<void> {
    const digest = HISTORICAL_RELEASES[version];
    const supplied = process.env['TS06_LEGACY_' + version.replaceAll('.', '') + '_ARTIFACT'];
    if (supplied || fs.existsSync(destination)) {
        const stat = fs.lstatSync(supplied ?? destination);
        assert(stat.isFile() && !stat.isSymbolicLink() && stat.size > 2 && stat.size < MAX_BYTES, 'Invalid cached historical archive');
        const bytes = fs.readFileSync(supplied ?? destination); verifyHistorical(bytes, digest);
        if (resolve(supplied ?? destination) !== resolve(destination)) fs.writeFileSync(destination, bytes, { flag: 'wx' });
        return;
    }
    const url = 'https://registry.npmjs.org/@fbincon/claude-code-statusline/-/' + historicalFilename(version);
    const bytes = await downloadHistorical(url, digest, { record: attempt => console.log(JSON.stringify({ historical_input: { version, url, sha256: digest, ...attempt } })) });
    fs.writeFileSync(destination, bytes, { flag: 'wx' });
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    assert.equal(process.argv.length, 3, 'Usage: historical-inputs DIRECTORY');
    const directory = resolve(process.argv[2]!); fs.mkdirSync(directory, { recursive: true });
    for (const version of Object.keys(HISTORICAL_RELEASES) as HistoricalRelease[])
        await prepareHistorical(version, join(directory, historicalFilename(version)));
}
