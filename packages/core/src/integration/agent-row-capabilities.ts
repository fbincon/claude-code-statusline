export const AGENT_ROW_MINIMUM = [2, 1, 326] as const;
/** The restored command is deprecated, so each interval ends at a verified host. */
export const LEGACY_ROW_RANGES = [
    [[2, 1, 205], [2, 1, 322]],
    [AGENT_ROW_MINIMUM, [2, 1, 332]],
] as const;

function compare(left: readonly number[], right: readonly number[]): number {
    return left[0]! - right[0]! || left[1]! - right[1]! || left[2]! - right[2]!;
}

export function agentRowCapabilities(version: readonly number[] | null): { legacy: boolean; mod: boolean } {
    if (!version || version.length !== 3 || version.some(n => !Number.isSafeInteger(n) || n < 0))
        return { legacy: false, mod: false };
    return {
        legacy: LEGACY_ROW_RANGES.some(([first, last]) => compare(version, first) >= 0 && compare(version, last) <= 0),
        mod: compare(version, AGENT_ROW_MINIMUM) >= 0,
    };
}
