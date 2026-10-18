/** Application identity. Internal workspaces are private implementation packages. */
export const VERSION = '3.1.2';
export const PACKAGE_NAME = '@fbincon/claude-code-statusline';
export const REPOSITORY_URL = 'https://github.com/fbincon/claude-code-statusline';

export function isPrerelease(version: string): boolean {
    return /^\d+\.\d+\.\d+-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*$/u.test(version)
        || /(?:a|b|rc|dev)\d/u.test(version);
}

/** TS previews retain the stable editor experience approved for TS-06. */
export function editorsEnabledByDefault(version: string): boolean {
    return /^([3-9]|[1-9]\d+)\.\d+\.\d+(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/u.test(version)
        || !isPrerelease(version);
}
