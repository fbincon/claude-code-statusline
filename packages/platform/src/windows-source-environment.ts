import { nativeApi, nativeFunction, winError } from './native.js';

export const WINDOWS_RUNTIME_FOLDERS = ['USERPROFILE', 'HOME', 'HOMEDRIVE', 'HOMEPATH', 'APPDATA', 'LOCALAPPDATA', 'SYSTEMDRIVE', 'PROGRAMDATA', 'PROGRAMFILES', 'PROGRAMFILES(X86)', 'PROGRAMW6432', 'COMMONPROGRAMFILES', 'COMMONPROGRAMFILES(X86)', 'COMMONPROGRAMW6432'];

/** Recover the loaded Windows profile independently of a caller's isolated HOME.
 * Only OS folder variables leave this adapter; registry credentials never do.
 * https://learn.microsoft.com/windows/win32/api/userenv/nf-userenv-createenvironmentblock
 */
function operatingSystemFolders(): Record<string, string> {
    const api = nativeApi(), tokenBytes = Buffer.alloc(api.sizeof('void *'));
    const current = nativeFunction('kernel32.dll', 'void *GetCurrentProcess()')();
    if (!nativeFunction('advapi32.dll', 'bool OpenProcessToken(void *process, uint32_t access, _Out_ void *token)')(current, 0x000a, tokenBytes))
        throw winError('OpenProcessToken');
    const token = api.decode(tokenBytes, 'void *');
    let block: unknown;
    try {
        const pointer = Buffer.alloc(api.sizeof('void *'));
        if (!nativeFunction('userenv.dll', 'bool CreateEnvironmentBlock(_Out_ void *environment, void *token, bool inherit)')(pointer, token, false))
            throw winError('CreateEnvironmentBlock');
        block = api.decode(pointer, 'void *');
        const result: Record<string, string> = {};
        let entry = '';
        for (let offset = 0; offset < 1024 * 1024; offset += 2) {
            const character = api.decode(block, offset, 'uint16_t') as number;
            if (character) { entry += String.fromCharCode(character); continue; }
            if (!entry) return result;
            const equals = entry.indexOf('='), name = entry.slice(0, equals).toUpperCase();
            if (equals > 0 && WINDOWS_RUNTIME_FOLDERS.includes(name)) result[name] = entry.slice(equals + 1);
            entry = '';
        }
        throw new Error('Windows environment block exceeds its bound');
    } finally {
        if (block) nativeFunction('userenv.dll', 'bool DestroyEnvironmentBlock(void *environment)')(block);
        nativeFunction('kernel32.dll', 'bool CloseHandle(void *handle)')(token);
    }
}

/** Bootstrap only the static supervisor with valid .NET known folders. The tool
 * receives the original, separately serialized minimum environment instead. */
export function windowsSourceEnvironment(command: NodeJS.ProcessEnv, folders = operatingSystemFolders()): NodeJS.ProcessEnv {
    const result = { ...command };
    for (const name of Object.keys(result)) if (WINDOWS_RUNTIME_FOLDERS.includes(name.toUpperCase()) || name.toUpperCase() === 'PSMODULEPATH') delete result[name];
    for (const [name, value] of Object.entries(folders)) if (WINDOWS_RUNTIME_FOLDERS.includes(name.toUpperCase())) result[name] = value;
    return result;
}
