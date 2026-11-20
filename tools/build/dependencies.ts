import { sha256 } from './files.js';

/** Remove lifecycle scripts from a bundled dependency manifest.
 *  Bundled runtime files are never built or installed as standalone packages,
 *  so a retained install/prepare script can only fail or run unexpectedly. */
export function sanitizeDependencyManifest(raw: Buffer): Buffer {
    const value = JSON.parse(raw.toString('utf8')) as unknown;
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid dependency manifest');
    const manifest = value as Record<string, unknown>;
    if (!Object.hasOwn(manifest, 'scripts')) return raw;
    delete manifest.scripts;
    return Buffer.from(JSON.stringify(manifest, null, 2) + '\n');
}

/** Compare a bundled dependency file with its signed upstream copy.
 *  Historical artifacts retain upstream manifests; current artifacts remove
 *  lifecycle scripts through the deterministic transform above. */
export function dependencyFileMatches(file: string, bundledHash: string, upstream: Buffer): boolean {
    if (bundledHash === sha256(upstream)) return true;
    return file === 'package.json' && bundledHash === sha256(sanitizeDependencyManifest(upstream));
}
