export interface Sample { wall_ns: bigint; boot_ns: bigint | null; boot_id: string | null }

export function sameBootDomain(start: Sample, end: Sample): boolean {
  return Boolean(start.boot_id && start.boot_id === end.boot_id &&
    (!start.boot_id.startsWith('windows:') || start.boot_id.startsWith('windows:v2:')));
}

export function delta(start: Sample, end: Sample): bigint | null {
  const elapsed = sameBootDomain(start, end) && start.boot_ns !== null && end.boot_ns !== null
    ? end.boot_ns - start.boot_ns : end.wall_ns - start.wall_ns;
  return elapsed >= 0n ? elapsed : null;
}

export function trusted(start: Sample, end: Sample): boolean {
  return Boolean(sameBootDomain(start, end) && start.boot_ns !== null && end.boot_ns !== null && end.boot_ns >= start.boot_ns);
}
