const MESSAGES: Readonly<Record<string, readonly [
    number,
    string
]>> = {
    EACCES: [13, 'Permission denied'], EPERM: [1, 'Operation not permitted'], ENOENT: [2, 'No such file or directory'],
    EEXIST: [17, 'File exists'], EISDIR: [21, 'Is a directory'], ENOTDIR: [20, 'Not a directory'], ENOSPC: [28, 'No space left on device'],
    EROFS: [30, 'Read-only file system'], EINVAL: [22, 'Invalid argument'], EMFILE: [24, 'Too many open files'], ELOOP: [40, 'Too many levels of symbolic links'],
};
function repr(value: string): string {
    const quote = value.includes("'") && !value.includes('"') ? '"' : "'";
    return quote + value.replaceAll('\\', '\\\\').replaceAll(quote, '\\' + quote).replaceAll('\n', '\\n').replaceAll('\r', '\\r').replaceAll('\t', '\\t') + quote;
}
export function errorDescription(error: unknown): string {
    if (!(error instanceof Error))
        return String(error);
    const e = error as NodeJS.ErrnoException & {
        dest?: string;
        path?: string;
    };
    const message = e.code && MESSAGES[e.code];
    if (!message)
        return error.message;
    return `[Errno ${message[0]}] ${message[1]}` + (e.path === undefined ? '' : ': ' + repr(e.path)) + (e.dest === undefined ? '' : ' -> ' + repr(e.dest));
}
