/** Bounded logs for synthetic acceptance; never record credentials or raw environment maps. */
import * as fs from 'node:fs';
import { join } from 'node:path';
export function sanitizeLog(value: string, environment: NodeJS.ProcessEnv = process.env): string {
    let result = value;
    for (const [key, secret] of Object.entries(environment))
        if (/(?:TOKEN|SECRET|PASSWORD|API_KEY|AUTHORIZATION)/iu.test(key) && secret && secret.length >= 4)
            result = result.split(secret).join('<redacted>');
    return result.replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/gu, '$1<redacted>@')
        .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+/giu, 'Bearer <redacted>')
        .replace(/([?&](?:token|key|signature|password|secret)=)[^\s&]+/giu, '$1<redacted>');
}
export function retainLog(directory: string, name: string, value: string): string {
    if (!/^[a-z0-9.-]+$/u.test(name)) throw new Error('Invalid diagnostic filename');
    fs.mkdirSync(directory, { recursive: true });
    const clean = sanitizeLog(value), limit = 1024 * 1024;
    const bounded = clean.length <= limit ? clean : clean.slice(0, limit / 2) + '\n<output truncated>\n' + clean.slice(-limit / 2);
    fs.writeFileSync(join(directory, name), bounded, { mode: 0o600 });
    return name;
}
