/** Literal Windows argv quoting shared by console and supervised children. */
export function windowsCommand(argv: readonly string[]): string {
    if (argv.some(value => value.includes('\0')))
        throw new Error('NUL in Windows argument');
    return argv.map(value => '"' + value.replace(/(\\*)"/gu, '$1$1\\"').replace(/(\\+)$/u, '$1$1') + '"').join(' ');
}
