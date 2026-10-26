/** Coverage classification changes scheduling, never the selected assertion set. */
export function testResponsibility(path: string): { responsibility: string; serial: boolean } {
    const file = path.replaceAll('\\', '/');
    const responsibility = file.startsWith('packages/core/') ? 'pure-core' :
        file.startsWith('packages/platform/') ? 'platform' : file.startsWith('packages/cli/') ? 'application' :
        file.startsWith('packages/tui/') ? 'terminal' : file.startsWith('dist/typescript/tools/') ? 'repository-tools' : 'unclassified-full';
    // Timing, terminal, native process/lock and destructive-fixture suites retain
    // one-file isolation. Unknown locations always run, conservatively serial.
    const serial = responsibility === 'terminal' || responsibility === 'unclassified-full' ||
        /(?:terminal|pty|source-process|storage|processes|windows|transaction|recovery|capture|power|budget|installed|native-capacity|configuration-experience|external|\/git(?:[.-]|\/))/u.test(file) ||
        /tools\/(?:migration|build)\//u.test(file);
    return { responsibility, serial };
}
