/** Forward generator next/return/throw exactly, including downstream results. */
export function tapStream<C, R>(source: AsyncGenerator<C, R, void>,
    inspect: (item: IteratorResult<C, R>, operation: 'next' | 'return' | 'throw') => Promise<void>): AsyncGenerator<C, R, void> {
  async function tap(result: Promise<IteratorResult<C, R>>, operation: 'next' | 'return' | 'throw'): Promise<IteratorResult<C, R>> {
    const item = await result;
    try { await inspect(item, operation); } catch { /* Observation never changes the stream. */ }
    return item;
  }
  return {
    next: (...args: [] | [void]) => tap(source.next(...args), 'next'),
    return: (value: R | PromiseLike<R>) => tap(source.return(value), 'return'),
    throw: (error: unknown) => tap(source.throw(error), 'throw'),
    [Symbol.asyncIterator]() { return this; },
  };
}

const fields = ['input_tokens', 'output_tokens', 'cache_read_input_tokens', 'cache_creation_input_tokens'] as const;
export function usage(value: unknown): Record<string, number> | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const result: Record<string, number> = {};
  for (const field of fields) {
    const count = row[field];
    if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0) return null;
    result[field] = count;
  }
  return result;
}
