/** Product runtime support is independent of the reproducible build toolchain. */
export const NODE_RUNTIME_RANGE = '^22.0.0 || ^24.0.0';
export const NODE_RUNTIME_CASES = ['22.0.0', '22.x', '24.0.0', '24.x'] as const;
export type NodeRuntimeCase = typeof NODE_RUNTIME_CASES[number];

export function supportedNode(version: string): boolean {
  return /^(22|24)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/u.test(version)
    && version.split('.').every(part => Number.isSafeInteger(Number(part)));
}

export function matchesNodeCase(version: string, selection: string): boolean {
  if (!supportedNode(version)) return false;
  return selection === '22.x' || selection === '24.x'
    ? version.startsWith(selection.slice(0, -1))
    : (NODE_RUNTIME_CASES as readonly string[]).includes(selection) && version === selection;
}
