/** Static supervisor: assign a suspended process to a kill-on-close Windows Job.
 * Values cross JSON/argv boundaries, never PowerShell source interpolation. */
export const windowsJobScript = String.raw `
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$PSModuleAutoLoadingPreference = 'None'
Import-Module ($PSHOME + '\Modules\Microsoft.PowerShell.Management\Microsoft.PowerShell.Management.psd1') -ErrorAction Stop
Import-Module ($PSHOME + '\Modules\Microsoft.PowerShell.Utility\Microsoft.PowerShell.Utility.psd1') -ErrorAction Stop
$spec = $env:STATUSLINE_SOURCE_LAUNCH | ConvertFrom-Json
$env:STATUSLINE_SOURCE_LAUNCH = $null
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class StatuslineSourceJob {
 [StructLayout(LayoutKind.Sequential)] struct Basic { public long a,b; public uint flags; public UIntPtr min,max; public uint count; public UIntPtr affinity; public uint priority,scheduling; }
 [StructLayout(LayoutKind.Sequential)] struct IO { public ulong a,b,c,d,e,f; }
 [StructLayout(LayoutKind.Sequential)] struct Limits { public Basic basic; public IO io; public UIntPtr process,job,peakProcess,peakJob; }
 [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] struct Startup { public uint cb; public string reserved,desktop,title; public uint x,y,xs,ys,xc,yc,fill,flags; public ushort show,reserved2; public IntPtr extra,input,output,error; }
 [StructLayout(LayoutKind.Sequential)] struct ProcessInfo { public IntPtr process,thread; public uint pid,tid; }
 [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr security,string name);
 [DllImport("kernel32.dll", SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job,int kind,ref Limits value,uint size);
 [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool CreateProcess(string app,StringBuilder command,IntPtr ps,IntPtr ts,bool inherit,uint flags,IntPtr env,string cwd,ref Startup startup,out ProcessInfo info);
 [DllImport("kernel32.dll", SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job,IntPtr process);
 [DllImport("kernel32.dll")] static extern uint ResumeThread(IntPtr thread);
 [DllImport("kernel32.dll")] static extern uint WaitForSingleObject(IntPtr value,uint timeout);
 [DllImport("kernel32.dll")] static extern bool GetExitCodeProcess(IntPtr process,out uint code);
 [DllImport("kernel32.dll")] static extern bool TerminateProcess(IntPtr process,uint code);
 [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr value);
 [DllImport("kernel32.dll")] static extern IntPtr GetStdHandle(int kind);
 [DllImport("kernel32.dll")] static extern bool SetHandleInformation(IntPtr value,uint mask,uint flags);
 static string Quote(string value) {
  var b=new StringBuilder("\""); int slashes=0;
  foreach(char c in value) { if(c=='\\') { slashes++; continue; } if(c=='"') b.Append('\\',slashes*2+1); else b.Append('\\',slashes); b.Append(c); slashes=0; }
  return b.Append('\\',slashes*2).Append('"').ToString();
 }
 public static int Run(string exe,string[] args,string cwd,string[] environment) {
  IntPtr job=CreateJobObject(IntPtr.Zero,null); ProcessInfo info=new ProcessInfo();
  IntPtr block=IntPtr.Zero;
  try {
   if(job==IntPtr.Zero) return 125;
   Limits limits=new Limits(); limits.basic.flags=0x2000;
   if(!SetInformationJobObject(job,9,ref limits,(uint)Marshal.SizeOf(limits))) return 125;
   Startup s=new Startup(); s.cb=(uint)Marshal.SizeOf(s); s.flags=0x100;
   s.input=GetStdHandle(-10); s.output=GetStdHandle(-11); s.error=GetStdHandle(-12);
   SetHandleInformation(s.input,1,1); SetHandleInformation(s.output,1,1); SetHandleInformation(s.error,1,1);
   var line=new StringBuilder(Quote(exe)); foreach(string arg in args) line.Append(' ').Append(Quote(arg));
   Array.Sort(environment,StringComparer.OrdinalIgnoreCase);
   block=Marshal.StringToHGlobalUni(String.Join("\0",environment)+"\0\0");
   if(!CreateProcess(exe,line,IntPtr.Zero,IntPtr.Zero,true,0x08000404,block,cwd,ref s,out info)) return 126;
   if(!AssignProcessToJobObject(job,info.process)) { TerminateProcess(info.process,125); return 125; }
   if(ResumeThread(info.thread)==0xffffffff) { TerminateProcess(info.process,125); return 125; }
   WaitForSingleObject(info.process,0xffffffff); uint code; GetExitCodeProcess(info.process,out code); return unchecked((int)code);
  } finally { if(block!=IntPtr.Zero) Marshal.FreeHGlobal(block); if(job!=IntPtr.Zero) CloseHandle(job); if(info.thread!=IntPtr.Zero) CloseHandle(info.thread); if(info.process!=IntPtr.Zero) CloseHandle(info.process); }
 }
}
'@
$environment = @($spec.environment.PSObject.Properties | ForEach-Object { $_.Name + '=' + [string]$_.Value })
exit [StatuslineSourceJob]::Run([string]$spec.executable,[string[]]$spec.args,[string]$spec.cwd,[string[]]$environment)
`;
