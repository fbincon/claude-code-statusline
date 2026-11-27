import { MAX_SOURCE_BYTES } from '@fbincon/statusline-core/extensions/model';
import { readBoundedRegularFile } from './regular-file.js';

export function readSourceFile(path: string): Buffer | null {
    return readBoundedRegularFile(path, MAX_SOURCE_BYTES);
}
