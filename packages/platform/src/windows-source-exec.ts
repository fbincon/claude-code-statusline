/** Isolated native supervisor. The job handle dies with this process, including on forced termination. */
import { library, nativeApi, winError } from './native.js';
import { windowsCommand } from './windows-command.js';

if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('Windows x64 supervisor required');
const spec = JSON.parse(process.env.STATUSLINE_SOURCE_LAUNCH ?? '{}');
delete process.env.STATUSLINE_SOURCE_LAUNCH;
if (typeof spec.executable !== 'string' || typeof spec.cwd !== 'string' ||
    !Array.isArray(spec.args) || spec.args.some((arg: unknown) => typeof arg !== 'string') ||
    !spec.environment || typeof spec.environment !== 'object') throw new Error('Invalid process request');
const k = library('kernel32.dll'), api = nativeApi();
const close = k.func('bool CloseHandle(void *handle)');
const job = k.func('void *CreateJobObjectW(void *security, const char16_t *name)')(null, null);
if (!job) throw winError('CreateJobObjectW');
let handle: unknown = null, thread: unknown = null, resumed = false;
try {
    // JOBOBJECT_EXTENDED_LIMIT_INFORMATION, Windows x64 ABI.
    const limits = Buffer.alloc(144); limits.writeUInt32LE(0x2000, 16); // KILL_ON_JOB_CLOSE
    if (!k.func('bool SetInformationJobObject(void *job, int kind, void *data, uint32_t size)')(job, 9, limits, limits.length)) throw winError('SetInformationJobObject');
    const startup = Buffer.alloc(104); startup.writeUInt32LE(104); startup.writeUInt32LE(0x100, 60);
    for (const [kind, offset] of [[-10, 80], [-11, 88], [-12, 96]]) {
        const value = k.func('void *GetStdHandle(int kind)')(kind);
        if (!k.func('bool SetHandleInformation(void *handle, uint32_t mask, uint32_t flags)')(value, 1, 1)) throw winError('SetHandleInformation');
        api.encode(startup.subarray(offset), 'void *', value);
    }
    const entries = Object.entries(spec.environment).map(([name, value]) => {
        if (typeof value !== 'string' || /[=\0]/u.test(name) || value.includes('\0')) throw new Error('Invalid process environment');
        return [name, value] as const;
    }).sort(([a], [b]) => a.toUpperCase() < b.toUpperCase() ? -1 : a.toUpperCase() > b.toUpperCase() ? 1 : 0);
    const environment = Buffer.from(entries.map(([name, value]) => name + '=' + value).join('\0') + '\0\0', 'utf16le');
    const command = Buffer.from(windowsCommand([spec.executable, ...spec.args]) + '\0', 'utf16le'), info = Buffer.alloc(24);
    if (!k.func('bool CreateProcessW(const char16_t *app, void *command, void *ps, void *ts, bool inherit, uint32_t flags, void *env, const char16_t *cwd, void *startup, _Out_ void *info)')(
        spec.executable, command, null, null, true, 0x08000404, environment, spec.cwd, startup, info)) throw winError('CreateProcessW');
    handle = api.decode(info, 'void *'); thread = api.decode(info.subarray(8), 'void *');
    if (!k.func('bool AssignProcessToJobObject(void *job, void *process)')(job, handle)) throw winError('AssignProcessToJobObject');
    if (k.func('uint32_t ResumeThread(void *thread)')(thread) === 0xffffffff) throw winError('ResumeThread');
    resumed = true;
    if (k.func('uint32_t WaitForSingleObject(void *handle, uint32_t timeout)')(handle, 0xffffffff) !== 0) throw winError('WaitForSingleObject');
    const code = [0];
    if (!k.func('bool GetExitCodeProcess(void *handle, _Out_ uint32_t *code)')(handle, code)) throw winError('GetExitCodeProcess');
    process.exitCode = code[0]! | 0;
} finally {
    if (handle && !resumed) k.func('bool TerminateProcess(void *handle, uint32_t code)')(handle, 125);
    close(job);
    if (thread) close(thread);
    if (handle) close(handle);
}
