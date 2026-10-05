/** Coverage of user waits; unsupported boundaries invalidate the metric. */
export class WaitCoverage {
  private unknown = new Set<string>();
  mark(loop: string, turn: string): void { this.unknown.add(loop + ':' + turn); }
  finish(loop: string, turn: string): boolean {
    const key = loop + ':' + turn;
    const complete = !this.unknown.has(key);
    this.unknown.delete(key);
    return complete;
  }
}
