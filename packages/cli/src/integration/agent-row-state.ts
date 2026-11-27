import { join } from 'node:path';
import { readPrivateState } from '@fbincon/statusline-platform/private-state';
import { decodeUtf8 } from '@fbincon/statusline-platform/utf8';
import { revision } from '@fbincon/statusline-platform/hash';
import type { LaunchSpec } from '@fbincon/statusline-platform/launch';
import { decode } from '@fbincon/statusline-core/json';
import { object } from '@fbincon/statusline-core/config/validation';
import { jsonBytes } from '../config/storage.js';
import { AGENT_ROW_ROUTE_FILE } from './agent-row-paths.js';
import { OWNER } from './model.js';
import { safeTarget, type Change } from './transaction.js';

export type AgentRowPreference = 'auto' | 'mod' | 'legacy';
export type AgentRowMode = 'mod' | 'standby' | 'pass';
export type SelectedRows = 'mod' | 'standby' | 'legacy' | 'builtin' | 'preserve';
export const ROUTE_REASONS = ['disabled', 'unknown-host', 'unsupported-host', 'callback-gap', 'legacy',
    'mod-selected', 'awaiting-mod', 'not-installed', 'foreign', 'restricted', 'mod-disabled',
    'mod-failed', 'unavailable', 'ownership-changed'] as const;
export type RouteReason = typeof ROUTE_REASONS[number];
export const isPreference = (value: unknown): value is AgentRowPreference =>
    value === 'auto' || value === 'mod' || value === 'legacy';
export const isDigest = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{64}$/u.test(value);
export const isGeneration = (value: unknown): value is string => typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(value);
export const isHost = (s: unknown): s is string => typeof s === 'string' && /^\d{1,6}\.\d{1,6}\.\d{1,6}$/u.test(s);

export interface AgentRowRoute {
    schema_version: 1;
    owner: string;
    preference: AgentRowPreference;
    mode: Exclude<SelectedRows, 'preserve'>;
    reason: RouteReason;
    installationId: string | null;
    hostVersion: string | null;
    backendVersion: string | null;
    launchRevision: string | null;
    resourceRevision: string | null;
    /** The exact value and previously verified launch for this install's owned old command. */
    legacyRevision: string | null;
    legacyLaunch: LaunchSpec | null;
}

export function optionalPrivateBytes(directory: string, name: string, limit: number): Buffer | null {
    const path = join(directory, name);
    safeTarget(directory, path);
    try { return readPrivateState(path, limit); }
    catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw error;
    }
}

/** Check for duplicate keys before using native numbers in these small, internal files. */
export function privateJson(bytes: Buffer): unknown {
    const source = decodeUtf8(bytes);
    decode(source);
    return JSON.parse(source);
}

function validLaunch(launch: unknown): launch is LaunchSpec {
    return object(launch) && Object.keys(launch).length === 2 &&
        typeof launch.executable === 'string' && launch.executable.length > 0 &&
        !/[\0\n\r]/u.test(launch.executable) && Array.isArray(launch.args) &&
        launch.args.every(arg => typeof arg === 'string' && !arg.includes('\0'));
}

export function idleRoute(preference: AgentRowPreference, mode: 'legacy' | 'builtin', reason: RouteReason): AgentRowRoute {
    return { schema_version: 1, owner: OWNER, preference, mode, reason, installationId: null,
        hostVersion: null, backendVersion: null, launchRevision: null, resourceRevision: null,
        legacyRevision: null, legacyLaunch: null };
}

export function routeSnapshot(directory: string): { state: AgentRowRoute | null; raw: Buffer | null } {
    const raw = optionalPrivateBytes(directory, AGENT_ROW_ROUTE_FILE, 64 * 1024);
    if (!raw) return { state: null, raw };
    const value = privateJson(raw);
    const shape = Object.keys(idleRoute('auto', 'builtin', 'not-installed'));
    if (!object(value) || value.schema_version !== 1 || value.owner !== OWNER || !isPreference(value.preference) ||
        Object.keys(value).length !== shape.length || !shape.every(key => Object.hasOwn(value, key)) ||
        !ROUTE_REASONS.some(reason => reason === value.reason)) throw new Error('Invalid agent row installation state');
    if (value.mode === 'standby' || value.mode === 'mod') {
        if (!isGeneration(value.installationId) || !isHost(value.hostVersion) || typeof value.backendVersion !== 'string' ||
            !value.backendVersion || !isDigest(value.launchRevision) || !(value.resourceRevision === null || isDigest(value.resourceRevision)) ||
            (value.mode === 'standby' ? !isDigest(value.legacyRevision) || !validLaunch(value.legacyLaunch) :
                value.legacyRevision !== null || value.legacyLaunch !== null)) throw new Error('Invalid agent row activation');
    } else if ((value.mode !== 'legacy' && value.mode !== 'builtin') || value.installationId !== null ||
        value.hostVersion !== null || value.backendVersion !== null || value.launchRevision !== null ||
        value.resourceRevision !== null || value.legacyRevision !== null || value.legacyLaunch !== null) {
        throw new Error('Invalid inactive agent row state');
    }
    return { state: value as unknown as AgentRowRoute, raw };
}

export function routeChange(directory: string, before: ReturnType<typeof routeSnapshot>, desired: AgentRowRoute | null): Change | null {
    if (revision(before.state) === revision(desired)) return null;
    return { name: AGENT_ROW_ROUTE_FILE, path: join(directory, AGENT_ROW_ROUTE_FILE),
        raw: before.raw, desired: desired ? jsonBytes(desired) : null };
}

export function readAgentRowRoute(directory: string): AgentRowRoute | null { return routeSnapshot(directory).state; }

/** Caller commits this change under the configuration lock before handing control to an older product. */
export function deactivateAgentRowRoute(directory: string, preserveDisabled = false): Change | null {
    const before = routeSnapshot(directory), saved = before.state?.preference ?? 'auto';
    if (preserveDisabled || before.state?.reason === 'mod-disabled')
        return routeChange(directory, before, idleRoute(saved, 'builtin', 'mod-disabled'));
    return routeChange(directory, before, saved === 'auto' ? null : idleRoute(saved, 'builtin', 'not-installed'));
}
