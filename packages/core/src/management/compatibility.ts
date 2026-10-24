import { PackageError, exactVersion } from './package.js';
export const CONFIG_FORMATS = {
    'claude-statusline.json': 'display',
    'claude-statusline-profiles.json': 'profiles',
    'claude-statusline-sources.json': 'sources',
    'claude-statusline-runtime.json': 'runtime_preferences',
    'claude-statusline-native.json': 'native_preferences',
    'claude-statusline-features.json': 'external_preferences',
    'statusline-ui.json': 'ui_preferences',
} as const;
export type ConfigurationFormat = typeof CONFIG_FORMATS[keyof typeof CONFIG_FORMATS];
export interface PackageCompatibility {
    schema_version: 1;
    node: Record<string, string>;
    targets: string[];
    minimum_host: string;
    read: Record<ConfigurationFormat, [
        number,
        number
    ]>;
    editor_protocol: number;
    runtime_protocol: number;
}
// Historical compatibility is independent of later package declarations.
const LEGACY_370_COMPATIBILITY: PackageCompatibility = {
    schema_version: 1,
    node: { '22': '22.0.0', '24': '24.0.0' },
    targets: ['linux-x64', 'win32-x64', 'darwin-x64', 'darwin-arm64'],
    minimum_host: '2.1.205',
    read: { display: [1, 13], profiles: [1, 1], sources: [1, 2], runtime_preferences: [1, 2], native_preferences: [1, 1], external_preferences: [1, 1], ui_preferences: [1, 1] },
    editor_protocol: 21, runtime_protocol: 3,
};
export const PACKAGE_COMPATIBILITY: PackageCompatibility = JSON.parse(JSON.stringify(LEGACY_370_COMPATIBILITY));
export const LEGACY_370_SHA256 = 'b1afec4a234368ab0ef2e23f728b8204122c86e17213af32738b6f3d84363e95';
export function compareVersions(left: string, right: string): number {
    if (!exactVersion(left) || !exactVersion(right))
        throw new PackageError('version');
    const parts = (value: string) => { const at = value.indexOf('-'); return [at < 0 ? value : value.slice(0, at), at < 0 ? null : value.slice(at + 1)] as const; };
    const [a, ap] = parts(left), [b, bp] = parts(right);
    const aa = a.split('.').map(BigInt), bb = b.split('.').map(BigInt);
    for (let i = 0; i < 3; i++)
        if (aa[i] !== bb[i])
            return aa[i]! < bb[i]! ? -1 : 1;
    if (ap === bp)
        return 0;
    if (ap === null || bp === null)
        return ap === null ? 1 : -1;
    const as = ap.split('.'), bs = bp.split('.');
    for (let i = 0; i < Math.max(as.length, bs.length); i++) {
        const x = as[i], y = bs[i];
        if (x === y)
            continue;
        if (x === undefined || y === undefined)
            return x === undefined ? -1 : 1;
        const nx = /^\d+$/u.test(x), ny = /^\d+$/u.test(y);
        if (nx && ny)
            return BigInt(x) < BigInt(y) ? -1 : 1;
        if (nx !== ny)
            return nx ? -1 : 1;
        return x < y ? -1 : 1;
    }
    return 0;
}
const object = (value: unknown): value is Record<string, any> => value !== null && typeof value === 'object' && !Array.isArray(value);
export function compatibility(value: unknown, version: string): PackageCompatibility {
    if (!exactVersion(version) || compareVersions(version, '3.7.0') < 0)
        throw new PackageError('unsupported_version');
    if (value === undefined && version === '3.7.0')
        return JSON.parse(JSON.stringify(LEGACY_370_COMPATIBILITY));
    if (!object(value) || value.schema_version !== 1 || !object(value.node) || !Object.keys(value.node).length ||
        Object.entries(value.node).some(([major, minimum]) => !/^\d+$/u.test(major) || !exactVersion(minimum) || minimum.split('.')[0] !== major || minimum.includes('-')) ||
        !Array.isArray(value.targets) || !value.targets.length || value.targets.some((target: unknown) => typeof target !== 'string' || !/^(?:linux|win32|darwin)-(?:x64|arm64)$/u.test(target)) ||
        !exactVersion(value.minimum_host) || value.minimum_host.includes('-') || !object(value.read) ||
        Object.keys(value.read).sort().join(',') !== Object.values(CONFIG_FORMATS).sort().join(',') ||
        Object.values(value.read).some(range => !Array.isArray(range) || range.length !== 2 || range.some(n => !Number.isSafeInteger(n) || n < 1 || n > 1000) || range[0] > range[1]) ||
        !Number.isSafeInteger(value.editor_protocol) || value.editor_protocol < 1 || !Number.isSafeInteger(value.runtime_protocol) || value.runtime_protocol < 1)
        throw new PackageError('compatibility_unknown');
    return JSON.parse(JSON.stringify(value)) as PackageCompatibility;
}
export function runtimeCompatibility(value: PackageCompatibility, node: string, target: string, host: string | null, integrated: boolean): string[] {
    const reasons: string[] = [], minimum = value.node[node.split('.')[0]!];
    if (!minimum || !exactVersion(node) || compareVersions(node, minimum) < 0)
        reasons.push('runtime');
    if (!value.targets.includes(target))
        reasons.push('platform');
    if (integrated && (!host || !exactVersion(host) || compareVersions(host, value.minimum_host) < 0))
        reasons.push('host');
    return reasons;
}
