import type { PackageReviewRequest } from '../contracts/ui.js';
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const string = (value: unknown): value is string => typeof value === 'string' && value.length <= 8192 && !/[\p{Cc}\p{Cs}]/u.test(value);
const nullable = (value: unknown) => value === null || string(value);
const exact = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).sort().join(',') === keys.sort().join(',');
const strings = (value: unknown) => Array.isArray(value) && value.length <= 128 && value.every(string);
const channel = (value: unknown) => value === null || value === 'latest' || value === 'beta';
export function isPackageRequest(value: unknown): value is PackageReviewRequest {
    return object(value) && exact(value, ['action', 'prefix', 'expected_revision', 'target', 'channel', 'backup_id', 'expected_integrity']) &&
        ['check', 'update', 'rollback', 'recover-package', 'restore-config'].includes(String(value.action)) && string(value.prefix) && !!value.prefix &&
        typeof value.expected_revision === 'string' && /^[0-9a-f]{64}$/u.test(value.expected_revision) && nullable(value.target) &&
        (value.target === null || /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(String(value.target))) && channel(value.channel) &&
        nullable(value.backup_id) && (value.backup_id === null || /^pkg-[0-9a-f-]{36}$/u.test(String(value.backup_id))) &&
        nullable(value.expected_integrity) && (value.expected_integrity === null || /^sha512-[A-Za-z0-9+/]{86}==$/u.test(String(value.expected_integrity))) &&
        !(value.target && value.channel) &&
        (value.action !== 'restore-config' || !!value.backup_id && value.target === null && value.channel === null) &&
        (['check', 'update'].includes(String(value.action)) || value.channel === null);
}
function history(value: unknown): boolean {
    return object(value) && exact(value, ['id', 'version', 'created', 'stage', 'backup', 'running']) && string(value.id) && nullable(value.version) &&
        nullable(value.created) && string(value.stage) && ['verified', 'missing', 'invalid'].includes(String(value.backup)) && typeof value.running === 'boolean';
}
function review(value: unknown): boolean {
    return object(value) && exact(value, ['action', 'current', 'target', 'prefix', 'entry', 'config_dir', 'channel', 'registry', 'integrity', 'node_engine', 'host', 'artifact_verified', 'compatible', 'reasons', 'configuration_conflicts', 'backup_id', 'files']) &&
        ['check', 'update', 'rollback', 'recover-package', 'restore-config'].includes(String(value.action)) &&
        ['current', 'target', 'entry', 'registry', 'integrity', 'node_engine', 'host', 'backup_id'].every(key => nullable(value[key])) &&
        string(value.prefix) && string(value.config_dir) && channel(value.channel) && typeof value.artifact_verified === 'boolean' && typeof value.compatible === 'boolean' &&
        strings(value.reasons) && strings(value.configuration_conflicts) && strings(value.files);
}
export function isPackageResult(operation: string, value: unknown): boolean {
    if (!object(value) || value.version !== 1)
        return false;
    if (operation === 'package_status')
        return exact(value, ['version', 'backend_version', 'captured_at', 'revision', 'prefix', 'entry', 'config_dir', 'current', 'previous', 'channel', 'node_version', 'host', 'compatible', 'reasons', 'pending', 'history', 'offset', 'total']) &&
            ['backend_version', 'captured_at', 'revision', 'config_dir', 'node_version'].every(key => string(value[key])) && /^[0-9a-f]{64}$/u.test(String(value.revision)) &&
            ['prefix', 'entry', 'current', 'previous', 'host'].every(key => nullable(value[key])) && channel(value.channel) && typeof value.compatible === 'boolean' && strings(value.reasons) &&
            (value.pending === null || history(value.pending)) && Array.isArray(value.history) && value.history.length <= 16 && value.history.every(history) &&
            Number.isSafeInteger(value.offset) && Number(value.offset) >= 0 && Number.isSafeInteger(value.total) && Number(value.total) >= 0;
    return exact(value, ['version', 'id', 'owner', 'state', 'started_at', 'finished_at', 'request', 'review', 'error']) &&
        ['id', 'owner', 'started_at'].every(key => string(value[key])) && ['running', 'complete', 'failed', 'cancelled'].includes(String(value.state)) &&
        nullable(value.finished_at) && nullable(value.error) && isPackageRequest(value.request) && (value.review === null || review(value.review));
}
