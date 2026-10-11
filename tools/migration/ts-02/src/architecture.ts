import { machine } from 'node:os';
import { library, winError } from './native.js';

export function architecture() {
  const nodeMachine = machine();
  if (process.platform !== 'win32') return {
    host_arch: nodeMachine === 'x86_64' ? 'x64' : nodeMachine,
    process_arch: process.arch, node_os_machine: nodeMachine, architecture_source: 'os.machine',
  };
  // os.machine() can describe the emulated x64 view. IsWow64Process2
  // explicitly returns the native machine independently of the process ABI.
  const k = library('kernel32.dll');
  const handle = k.func('void *GetCurrentProcess()')();
  const processMachine = [0], nativeMachine = [0];
  if (!k.func('bool IsWow64Process2(void *process, _Out_ uint16_t *processMachine, _Out_ uint16_t *nativeMachine)')(handle, processMachine, nativeMachine)) throw winError('IsWow64Process2');
  const names: Record<number, string> = { 0x14c: 'ia32', 0x8664: 'x64', 0xaa64: 'arm64' };
  return { host_arch: names[nativeMachine[0]!] ?? `machine-${nativeMachine[0]}`, process_arch: process.arch,
    node_os_machine: nodeMachine, architecture_source: 'IsWow64Process2',
    native_machine: nativeMachine[0], emulated_machine: processMachine[0] };
}
