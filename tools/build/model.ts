export const PACKAGE = '@fbincon/statusline-ts05-candidate';
export const BUSINESS = ['core', 'platform', 'cli', 'tui'] as const;
export const TARGETS = ['linux-x64', 'win32-x64', 'darwin-x64', 'darwin-arm64'] as const;
export const NATIVE = TARGETS.map(target => '@koromix/koffi-' + target);
export const version = (commit: string) => '0.0.0-ts05.g' + commit.slice(0, 12);
export interface Candidate {
    schema_version: 1;
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
