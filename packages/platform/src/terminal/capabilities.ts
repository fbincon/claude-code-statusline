export interface ColorFacts {
    environment: NodeJS.ProcessEnv;
    platform: NodeJS.Platform;
    tty: boolean;
    windowsVT: boolean;
}
export interface ColorCapability {
    colors: 0 | 8 | 16 | 256;
    reason: 'not_tty' | 'no_color' | 'monochrome' | 'explicit_extended' | 'explicit_linux' | 'explicit_term' | 'windows_vt' | 'conservative';
}
/** WT_SESSION and similar inherited markers do not describe a new console's output handle. */
export function colorCapability(facts: ColorFacts): ColorCapability {
    const env = facts.environment, term = env.TERM ?? '';
    if (!facts.tty) return {colors:0,reason:'not_tty'};
    if (env.NO_COLOR !== undefined) return {colors:0,reason:'no_color'};
    if (/^(?:dumb|vt100|vt220|xterm-mono)$/u.test(term)) return {colors:0,reason:'monochrome'};
    if (/256color|direct/u.test(term) || /truecolor|24bit/u.test(env.COLORTERM ?? '')) return {colors:256,reason:'explicit_extended'};
    if (term === 'linux') return {colors:8,reason:'explicit_linux'};
    if (term || env.COLORTERM) return {colors:16,reason:'explicit_term'};
    if (facts.platform === 'win32' && facts.windowsVT) return {colors:256,reason:'windows_vt'};
    return {colors:16,reason:'conservative'};
}
