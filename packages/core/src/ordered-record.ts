const records = new WeakSet<object>();
/** Preserve JSON member order, including integer-like keys that JS reorders. */
export function orderedRecord(entries: Iterable<readonly [string, unknown]>): Record<string, unknown> {
    const target: Record<string, unknown> = {}, keys: (string | symbol)[] = [];
    const result: Record<string, unknown> = new Proxy(target, {
        ownKeys: () => [...keys],
        set(_object, key, value): boolean {
            return Reflect.defineProperty(result, key, { value, enumerable: true, configurable: true, writable: true });
        },
        defineProperty(object, key, descriptor) {
            const exists = Object.hasOwn(object, key);
            const defined = Reflect.defineProperty(object, key, descriptor);
            if (defined && !exists)
                keys.push(key);
            return defined;
        },
        deleteProperty(object, key) {
            const deleted = Reflect.deleteProperty(object, key);
            if (deleted) {
                const index = keys.indexOf(key);
                if (index >= 0)
                    keys.splice(index, 1);
            }
            return deleted;
        },
    });
    for (const [key, value] of entries)
        Object.defineProperty(result, key, { value, enumerable: true, configurable: true, writable: true });
    records.add(result);
    return result;
}
export function isOrderedRecord(value: object): boolean { return records.has(value); }
