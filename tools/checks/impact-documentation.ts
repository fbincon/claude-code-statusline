/** Current pages consumed by the source-backed documentation regression suite.
 * Kept under impact-* so changes are part of the immutable classifier digest. */
const ROOT_CONTENT_PATHS = [
    'README', 'docs/USER_GUIDE', 'docs/EDITORS', 'docs/DISPLAY_ITEMS', 'docs/SCHEMES',
    'docs/COMPOSITION', 'docs/DRAFT_HISTORY', 'docs/EXTENSIONS', 'docs/SETUP', 'docs/reference/cli',
];
/** Current development guides. Historical records and compatibility stubs stay out. */
export const DEVELOPMENT_CONTENT_PATHS = [
    'docs/development/README', 'docs/development/architecture', 'docs/development/ci-efficiency',
    'docs/development/ci-maintenance', 'docs/development/contracts', 'docs/development/development-plan',
    'docs/development/i18n', 'docs/development/i18n-workflow', 'docs/development/impact-checks',
    'docs/development/live', 'docs/development/native', 'docs/development/native-capacity',
    'docs/development/rendering', 'docs/development/repository-governance', 'docs/development/roadmap',
    'docs/development/testing', 'docs/development/timer', 'docs/development/adaptive-row-scenarios',
    'docs/development/appearance-preview-diagnosis', 'docs/development/configuration-experience',
    'docs/development/extensions', 'docs/development/node-regional-languages',
    'docs/development/profiles-projects-tasks', 'docs/development/real-input-diagnostics',
    'docs/development/setup-appearance', 'docs/development/showcase', 'docs/development/skill-workflows',
    'docs/development/source-command-package-management', 'docs/development/task-version-review',
];
export const DOCUMENT_CONTENT_PATHS = [...ROOT_CONTENT_PATHS, ...DEVELOPMENT_CONTENT_PATHS]
    .flatMap(path => [path + '.md', path + '.zh-CN.md']);
