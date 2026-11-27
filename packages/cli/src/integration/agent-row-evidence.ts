import { join } from 'node:path';
import { atomicWrite } from '@fbincon/statusline-platform/files';
import { sha256 } from '@fbincon/statusline-platform/hash';
import { object } from '@fbincon/statusline-core/config/validation';
import { AGENT_ROW_EVIDENCE_FILE } from './agent-row-paths.js';
import { isDigest, isGeneration, isHost, optionalPrivateBytes, privateJson } from './agent-row-state.js';
import { safeTarget } from './transaction.js';

export interface AgentRowIdentity {
    session_id: string;
    host_version: string;
    backend_version: string;
    installation_id: string;
    cwd: string;
}
export interface SessionEvidence {
    session: string;
    host: string;
    loadedAt: number;
    verifiedAt: number | null;
    confirmation: { token: string; expiresAt: number; revision: string } | null;
}
interface Evidence {
    schema_version: 1;
    installationId: string;
    sessions: SessionEvidence[];
}
const SESSION_LIMIT = 32;
const timestamp = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 && n <= 8.64e15;
const privateSession = (identity: AgentRowIdentity): string => sha256(identity.session_id);
function validSession(value: unknown): value is SessionEvidence {
    if (!object(value) || Object.keys(value).length !== 5 || !isDigest(value.session) || !isHost(value.host) || !timestamp(value.loadedAt) ||
        !(value.verifiedAt === null || timestamp(value.verifiedAt))) return false;
    const ticket = value.confirmation;
    return ticket === null || (object(ticket) && Object.keys(ticket).length === 3 &&
        isGeneration(ticket.token) && isDigest(ticket.revision) && timestamp(ticket.expiresAt));
}

export function readEvidence(directory: string, installationId: string): Evidence {
    const bytes = optionalPrivateBytes(directory, AGENT_ROW_EVIDENCE_FILE, 64 * 1024);
    const empty = (): Evidence => ({ schema_version: 1, installationId, sessions: [] });
    if (bytes === null) return empty();
    const value = privateJson(bytes);
    if (!object(value) || Object.keys(value).length !== 3 || value.schema_version !== 1 || !isGeneration(value.installationId) ||
        !Array.isArray(value.sessions) || value.sessions.length > SESSION_LIMIT || !value.sessions.every(validSession))
        throw new Error('Invalid agent row session evidence');
    if (value.installationId !== installationId) return empty();
    const sessions = value.sessions as SessionEvidence[];
    if (new Set(sessions.map(row => row.host + ':' + row.session)).size !== sessions.length)
        throw new Error('Duplicate agent row session evidence');
    return { schema_version: 1, installationId, sessions };
}

export function findSession(evidence: Evidence, identity: AgentRowIdentity): SessionEvidence | undefined {
    const key = privateSession(identity);
    return evidence.sessions.find(row => row.session === key && row.host === identity.host_version);
}
export function addSession(evidence: Evidence, identity: AgentRowIdentity, now: number): void {
    if (evidence.sessions.length >= SESSION_LIMIT) evidence.sessions.shift();
    evidence.sessions.push({ session: privateSession(identity), host: identity.host_version, loadedAt: now,
        verifiedAt: null, confirmation: null });
}
/** Called under the installation lock. Receipt updates do not create configuration backups. */
export function saveEvidence(directory: string, evidence: Evidence): void {
    const path = join(directory, AGENT_ROW_EVIDENCE_FILE);
    safeTarget(directory, path);
    atomicWrite(path, JSON.stringify(evidence) + '\n');
}
export function latestAgentRowEvidence(directory: string, id: string | null, version: string) {
    let loadedAt: number | null = null, verifiedAt: number | null = null;
    if (id) for (const row of readEvidence(directory, id).sessions) {
        if (row.host !== version) continue;
        loadedAt = Math.max(loadedAt ?? 0, row.loadedAt);
        if (row.verifiedAt !== null) verifiedAt = Math.max(verifiedAt ?? 0, row.verifiedAt);
    }
    return { loadedAt, verifiedAt };
}
