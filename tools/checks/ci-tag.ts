/** Immutable annotated release identity, shared by complete and maintenance promotion. */
import assert from 'node:assert/strict';
import { git } from './ci-evidence.ts';

export function verifyTagIdentity(tag: string, commit: string, read = git): string {
    assert.match(tag, /^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u);
    assert.equal(read('cat-file', '-t', 'refs/tags/' + tag), 'tag', 'Annotated release tag required');
    assert.equal(read('rev-parse', 'refs/tags/' + tag + '^{commit}'), commit, 'Tag moved');
    read('merge-base', '--is-ancestor', commit, 'refs/remotes/origin/main');
    return read('rev-parse', 'refs/tags/' + tag);
}
