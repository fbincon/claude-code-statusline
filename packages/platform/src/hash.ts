import { createHash } from 'node:crypto';
import { canonical } from '@fbincon/statusline-core/json';

export function sha256(value: string | Uint8Array): string { return createHash('sha256').update(value).digest('hex'); }
export function revision(value: unknown): string { return sha256(canonical(value)); }
