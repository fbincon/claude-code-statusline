import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

// SHA-256 of the native binaries in each Anthropic release's /manifest.json at
// https://downloads.claude.ai/claude-code-releases/<version>/manifest.json.
const HOSTS = {
    '2.1.322': ['bfb3703ad5380242328459bc62ada4bde8ae7ba57c6e1eeadb9c00e08874c478', 'f220ca50ea4f3222043ff83cc224a1262e0196e9897acc0871efa94235b0c1fd'],
    '2.1.323': ['604d29a6869409106b6a1110bdadcc8b72e8654a5a865d23258f938a696e348e', '452dddff140b5caf00a5410333a3d6db82c73ea2dec74b1541fae18e97d47dca'],
    '2.1.325': ['0dc4f4a9a165fc60746d7ae8489712e5fc352f1e7ad4eb22e7141bd0812eb0cf', '7b6e484b1989a5a14a4b354709ccc8672518a3ec5b9ccd7981fc6254327fde67'],
    '2.1.326': ['b6b3647d981130dc44fc670846ae97b6cde531ffb667cf9c4d17cfcafb38cb37', '98d56f6ffe53469767a74864a38eaf359d62ef557a8de1b1ad524d61a66ec119'],
    '2.1.332': ['a2df1f41bb00250992926420d0063f89b127cb81abdd284dbefb80c50ff1d026', '50c305fcb8912851ce774429131d94ed6f84edbe3d8d0ed7a59dade5d893acc0'],
} as const;
export type Version = keyof typeof HOSTS;
export const VERSIONS = Object.keys(HOSTS) as Version[];

export async function verifiedHost(directory: string, version: Version, env: NodeJS.ProcessEnv, cwd: string) {
    assert.equal(process.platform, 'linux');
    assert(['x64', 'arm64'].includes(process.arch), 'A pinned Linux x64 or arm64 host is required');
    const executable = realpathSync(join(directory, version)), digest = createHash('sha256');
    for await (const chunk of createReadStream(executable)) digest.update(chunk);
    const sha256 = digest.digest('hex');
    assert.equal(sha256, HOSTS[version][process.arch === 'x64' ? 0 : 1], 'Host differs from the official release manifest');
    const banner = execFileSync(executable, ['--version'], { env, cwd, encoding: 'utf8', timeout: 15000 }).trim();
    assert.equal(banner.split(' ')[0], version);
    return { executable, version, sha256 };
}
