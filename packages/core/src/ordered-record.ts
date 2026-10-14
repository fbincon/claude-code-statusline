const records = new WeakMap<object, {
    target: Record<string, unknown>;
    keys: Set<string | symbol>;
    indexed: Set<string>;
}>();
function arrayIndex(key: string | symbol): key is string {
    if (typeof key !== 'string')
        return false;
    const value = Number(key);
    return Number.isInteger(value) && value >= 0 && value < 4294967295 && String(value) === key;
}
/** Preserve JSON member order, including integer-like keys that JS reorders. */
export function orderedRecord(entries: Iterable<readonly [
    string,
    unknown
]>): Record<string, unknown> {
    const target: Record<string, unknown> = Object.create(null), keys = new Set<string | symbol>(), indexed = new Set<string>();
    for (const [key, value] of entries) {
        target[key] = value;
        keys.add(key);
        if (arrayIndex(key))
            indexed.add(key);
    }
    Object.setPrototypeOf(target, Object.prototype);
    return wrap(target, keys, indexed);
}
function wrap(target: Record<string, unknown>, keys: Set<string | symbol>, indexed: Set<string>): Record<string, unknown> {
    const define = (key: string | symbol, descriptor: PropertyDescriptor): boolean => {
        const exists = Object.hasOwn(target, key), defined = Reflect.defineProperty(target, key, descriptor);
        if (defined && !exists) {
            keys.add(key);
            if (arrayIndex(key))
                indexed.add(key);
        }
        return defined;
    };
    const result: Record<string, unknown> = new Proxy(target, {
        ownKeys: () => [...keys],
        set(_object, key, value): boolean {
            return define(key, { value, enumerable: true, configurable: true, writable: true });
        },
        defineProperty(object, key, descriptor) {
            return define(key, descriptor);
        },
        deleteProperty(object, key) {
            const deleted = Reflect.deleteProperty(object, key);
            if (deleted) {
                keys.delete(key);
                if (typeof key === 'string')
                    indexed.delete(key);
            }
            return deleted;
        },
    });
    records.set(result, { target, keys, indexed });
    return result;
}
export function isOrderedRecord(value: object): boolean { return records.has(value); }
/** Wrap parsed data without allocating a second large dictionary and entry list.
 * The caller must have already preserved any numeric member ordering at parse.
 */
export function orderedDataRecord<T>(value: Record<string, T>): Record<string, T> {
    if (records.has(value))
        return value;
    const keys = Reflect.ownKeys(value), indexed = new Set(keys.filter(arrayIndex));
    return wrap(value, new Set(keys), indexed) as Record<string, T>;
}
/** Internal iterations avoid repeating Proxy descriptor traps for every entry. */
export function recordKeys(value: object): string[] {
    const record = records.get(value);
    return record ? [...record.keys].filter((key): key is string => typeof key === 'string' && Object.prototype.propertyIsEnumerable.call(record.target, key)) : Object.keys(value);
}
export function recordEntries<T>(value: Record<string, T>): [
    string,
    T
][] {
    const record = records.get(value);
    return record ? recordKeys(value).map(key => [key, record.target[key] as T]) : Object.entries(value);
}
export function recordValues<T>(value: Record<string, T>): T[] {
    const record = records.get(value);
    return record ? recordKeys(value).map(key => record.target[key] as T) : Object.values(value);
}
/** A native serializer can bypass a Proxy only when JS preserves its key order. */
export function nativeRecord(value: object): object | null {
    const record = records.get(value);
    return record ? record.indexed.size ? null : record.target : value;
}
