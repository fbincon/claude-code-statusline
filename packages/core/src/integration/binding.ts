/** Host-independent argv binding, shared by Node and the sandboxed Mods. */
export interface LaunchSpec { executable: string; args: readonly string[] }

function executable(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && !/[\0\r\n]/u.test(value);
}

export function binding(options: { backendExecutable?: unknown; backendArgs?: unknown } = {}, override?: string): LaunchSpec {
  if (override) {
    if (!executable(override)) throw new TypeError('Invalid backend executable');
    return { executable: override, args: [] };
  }
  const program = options.backendExecutable ?? 'claude-statusline', args = options.backendArgs ?? [];
  if (!executable(program) || !Array.isArray(args) || !args.every(x => typeof x === 'string' && !x.includes('\0'))) {
    throw new TypeError('Invalid backend binding');
  }
  return { executable: program, args: [...args] };
}
