/** Read-only retry policy shared by frozen verifiers and artifact transport. */
import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';

const transientCodes = new Set(['ECONNRESET','ETIMEDOUT','EPIPE','EAI_AGAIN','ECONNREFUSED','ENETUNREACH','EHOSTUNREACH',
    'UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT','UND_ERR_BODY_TIMEOUT','UND_ERR_SOCKET','ERR_STREAM_PREMATURE_CLOSE']);
const transientStatus = new Set([408,429,500,502,503,504]);
interface Failure { code?: string; status?: number; statusCode?: number; headers?: any; name?: string; message?: string; cause?: unknown }
function header(headers: any, key: string): string | null {
    const value = typeof headers?.get === 'function' ? headers.get(key) : headers?.[key];
    return typeof value === 'string' ? value : null;
}
export function responseError(response: Pick<Response,'status'|'headers'>): Error {
    // Neither signed URLs nor an API response body belongs in the receipt.
    const headers = Object.fromEntries(['retry-after','x-ratelimit-remaining','x-ratelimit-reset'].flatMap(key => {
        const value = header(response.headers,key); return value === null ? [] : [[key,value]];
    }));
    return Object.assign(new Error('HTTP ' + response.status), {status:response.status,headers});
}
function delayHint(error: Failure): number {
    const after = header(error.headers, 'retry-after');
    if (after !== null) {
        if (/^\d+(?:\.\d+)?$/u.test(after)) return Number(after) * 1000;
        const time = Date.parse(after); if (Number.isFinite(time)) return Math.max(0,time-Date.now());
    }
    const reset = header(error.headers,'x-ratelimit-reset');
    if (reset && /^\d+$/u.test(reset) && header(error.headers,'x-ratelimit-remaining') === '0') return Math.max(0,Number(reset)*1000-Date.now());
    return 0;
}
export function isTransient(error: unknown): boolean {
    const seen = new Set<unknown>();
    for (let current = error; current && typeof current === 'object' && !seen.has(current); ) {
        seen.add(current); const e = current as Failure;
        if (e.code === 'ERR_ASSERTION' || /CERT|TLS|SSL|UNABLE_TO_VERIFY|SELF_SIGNED/u.test(e.code ?? '') ||
            /certificate|self.signed|Digest mismatch|checksum mismatch/iu.test(e.message ?? '')) return false;
        const status = e.status ?? e.statusCode;
        if (status !== undefined) return transientStatus.has(status) || status === 403 &&
            (header(e.headers,'x-ratelimit-remaining') === '0' || delayHint(e) > 0);
        if (transientCodes.has(e.code ?? '') || e.name === 'TimeoutError') return true;
        // The pinned official SDK wraps Twirp errors as plain Error without .cause.
        const text = e.message ?? '';
        const sdk = /^Failed to (?:CreateArtifact|FinalizeArtifact|ListArtifacts|GetSignedArtifactURL): (?:Failed to make request after \d+ attempts: |Received non-retryable error: )?Failed request: \((\d{3})\)/u.exec(text);
        if (sdk) return transientStatus.has(Number(sdk[1]));
        if (/^(?:Failed to (?:CreateArtifact|FinalizeArtifact|ListArtifacts|GetSignedArtifactURL): )?Unable to make request: (?:ECONNRESET|ETIMEDOUT|EAI_AGAIN|EPIPE)(?:\n|$)/u.test(text)) return true;
        current = e.cause;
    }
    return false;
}
export function recoveryDelay(error: unknown, attempt: number, maxDelayMs: number): number | null {
    const hint = delayHint((error ?? {}) as Failure);
    if (hint > maxDelayMs) return null; // Never retry earlier than the service allows.
    return Math.max(hint, Math.min(maxDelayMs,250 * 2 ** (attempt-1)));
}
export async function retryRead<T>(read: (signal: AbortSignal) => Promise<T>, options: {
    attempts?: number; timeoutMs?: number; maxDelayMs?: number; onRetry?: (attempt: number, delayMs: number) => void;
} = {}): Promise<T> {
    const {attempts=3,timeoutMs=60_000,maxDelayMs=5_000,onRetry} = options;
    assert(Number.isInteger(attempts) && attempts > 0 && attempts <= 3); assert(Number.isFinite(timeoutMs) && timeoutMs > 0 && timeoutMs <= 510_000);
    assert(Number.isFinite(maxDelayMs) && maxDelayMs >= 0 && maxDelayMs <= 30_000);
    const start=performance.now(), controller=new AbortController(), signal=controller.signal;
    const deadline=new DOMException('GitHub read deadline exceeded','TimeoutError');
    const timer=setTimeout(()=>controller.abort(deadline),Math.ceil(timeoutMs));
    const aborted=new Promise<never>((_,reject)=>signal.addEventListener('abort',()=>reject(deadline),{once:true}));
    try {
        for (let attempt=1;;attempt++) {
            signal.throwIfAborted();
            try {
                const value=await Promise.race([Promise.resolve().then(()=>read(signal)),aborted]);
                if(performance.now()-start>=timeoutMs){controller.abort(deadline);throw deadline;}
                return value;
            } catch (error) {
                signal.throwIfAborted();
                const delay = recoveryDelay(error,attempt,maxDelayMs);
                if (attempt === attempts || !isTransient(error) || delay === null || performance.now()-start+delay >= timeoutMs) throw error;
                onRetry?.(attempt+1,delay);
                try { await sleep(delay,undefined,{signal}); }
                catch (waitError) { signal.throwIfAborted(); throw waitError; }
            }
        }
    } finally {clearTimeout(timer);}
}
