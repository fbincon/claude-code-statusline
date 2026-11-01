/** Copied outside the checkout and run by the installed Node. Only the I/O
 * streams are injected. Each request re-enters the installed production CLI. */
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
const [entry] = process.argv.slice(2);
if (!entry || !process.send) throw new Error('Expected an installed CLI entry and parent IPC');
const { main } = await import(pathToFileURL(join(dirname(entry), 'main.js')).href);
process.on('message', async (request: { id: number; args: string[]; input: string }) => {
    let stdout = '', stderr = '', outBytes = 0, errBytes = 0;
    const original = process.env.COLUMNS;
    try {
        if (request.args[0] === 'render') process.env.COLUMNS = '120';
        const code = await main(request.args, {
            stdin: () => request.input,
            stdout: (text: string) => {
                outBytes += Buffer.byteLength(text);
                if (outBytes > 1024 * 1024) throw new Error('Language CLI exceeded its stdout limit');
                stdout += text;
            },
            stderr: (text: string) => {
                errBytes += Buffer.byteLength(text);
                if (errBytes > 1024 * 1024) throw new Error('Language CLI exceeded its stderr limit');
                stderr += text;
            },
        });
        process.send!({ id: request.id, code, stdout, stderr });
    } catch (error) {
        process.send!({ id: request.id, code: 1, stdout: '', stderr: String(error) });
    } finally {
        if (original === undefined) delete process.env.COLUMNS;
        else process.env.COLUMNS = original;
    }
});
process.send({ ready: true });
