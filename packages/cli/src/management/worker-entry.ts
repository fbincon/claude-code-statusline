import { manage } from './service.js';
const [origin, argv] = process.argv.slice(2);
const cancel = () => process.emit('SIGTERM');
process.on('message', value => { if ((value as any)?.type === 'cancel')
    cancel(); });
process.once('disconnect', cancel);
process.exitCode = await manage(JSON.parse(argv!), { origin: origin!, stdout: text => { process.stdout.write(text); }, stderr: text => { process.stderr.write(text); } });
process.off('disconnect', cancel);
if (process.connected)
    process.disconnect();
