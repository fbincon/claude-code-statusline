export const INSTALLATION_FORMAT = 1;
export interface PackageIdentity {
    version: string;
    root: string;
    entry: string;
    prefix: string;
    integrity: string | null;
    registry: string | null;
}
export class PackageError extends Error {
    constructor(readonly code: string) { super(code); }
}
export function exactVersion(value: unknown): value is string {
    return typeof value === 'string' && /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/u.test(value) && value.length <= 100 && !value.split('-').slice(1).join('-').split('.').some(part=>/^0\d+$/u.test(part));
}
export function entryAction(current: PackageIdentity | null, version: string): 'install' | 'reuse' | 'version_conflict' {
    return !current ? 'install' : current.version === version ? 'reuse' : 'version_conflict';
}
