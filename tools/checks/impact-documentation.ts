/** Current pages consumed by the source-backed documentation regression suite.
 * Kept under impact-* so changes are part of the immutable classifier digest. */
export const DOCUMENT_CONTENT_PATHS = [
    'README', 'docs/USER_GUIDE', 'docs/DISPLAY_ITEMS', 'docs/SCHEMES',
    'docs/COMPOSITION', 'docs/DRAFT_HISTORY', 'docs/EXTENSIONS', 'docs/SETUP', 'docs/reference/cli',
].flatMap(path => [path + '.md', path + '.zh-CN.md']);
