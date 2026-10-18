import { VERSION, PACKAGE_NAME } from '@fbincon/statusline-core/release';
export const PACKAGE = '@fbincon/statusline-ts05-candidate';
export type Channel = 'candidate' | 'preview' | 'stable';
export function publicChannel(version = VERSION): 'preview' | 'stable' {
    if (/^\d+\.\d+\.\d+$/u.test(version)) return 'stable';
    if (/^\d+\.\d+\.\d+-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*$/u.test(version)) return 'preview';
    throw new Error('Invalid public application version');
}
export function channel(value: unknown): Channel {
    if (value === 'public') return publicChannel();
    if (value !== 'candidate' && value !== 'preview' && value !== 'stable') throw new Error('Use candidate, preview or stable channel');
    return value;
}
export function identity(commit: string, kind: Channel = 'candidate') {
    channel(kind);
    if (!/^[a-f0-9]{40}$/u.test(commit)) throw new Error('Use a full source SHA');
    if (kind !== 'candidate' && kind !== publicChannel()) throw new Error('Application version and public channel differ');
    return { name: kind !== 'candidate' ? PACKAGE_NAME : PACKAGE, version: kind !== 'candidate' ? VERSION : version(commit), private: kind === 'candidate' };
}
export const sourceFilename = (commit: string, kind: Channel) => kind !== 'candidate'
    ? `claude-code-statusline-${VERSION}-source.tar.gz` : `statusline-ts05-source-${commit.slice(0, 12)}.tgz`;
export const BUSINESS = ['core', 'platform', 'cli', 'tui'] as const;
export const TARGETS = ['linux-x64', 'win32-x64', 'darwin-x64', 'darwin-arm64'] as const;
export const NATIVE = TARGETS.map(target => '@koromix/koffi-' + target);
export const version = (commit: string) => '0.0.0-ts05.g' + commit.slice(0, 12);
export interface Candidate {
    schema_version: 1;
    channel?: Channel;
    name: string;
    version: string;
    application_version: string;
    commit: string;
    dirty: false;
    node: string;
    npm: string;
    typescript: string;
    lock_sha256: string;
    source_manifest_sha256: string;
    source_hashes: Record<string, string>;
    targets: readonly string[];
    dependencies: Record<string, { version: string; integrity: string; files: Record<string, string> }>;
    files: Record<string, string>;
}
