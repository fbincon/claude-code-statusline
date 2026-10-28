import { captureWindowsModes } from '@fbincon/statusline-platform/terminal/windows-modes';
const [origin,argv]=process.argv.slice(2);
// A fresh Node TTY stream may enable VT while it initializes. Capture inherited
// console flags before the editor first accesses stdin/stdout, using only the
// independent runtime's native module so the installed package stays replaceable.
const restoreConsoleModes=captureWindowsModes(true,true);
try{
    const {main}=await import('../main.js');
    process.exitCode=await main(JSON.parse(argv!),{launch:{executable:process.execPath,args:[origin!]}});
}finally{restoreConsoleModes();}
