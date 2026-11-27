import { createServer, type ServerResponse } from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';

export const AGENTS = [
    { prompt: 'ROW_PROBE_ALPHA', label: '核验甲' },
    { prompt: 'ROW_PROBE_BETA', label: '核验乙' },
] as const;

/** Keep both subagents alive until the PTY assertions have observed the rows together. */
export async function openProvider() {
    const held = new Set<ServerResponse>();
    const received = new Set<string>();
    const requests: string[] = [];
    let sequence = 0;
    const server = createServer(async (request, response) => {
        try {
            const path = new URL(request.url ?? '/', 'http://localhost').pathname;
            if (request.method !== 'POST') { response.writeHead(404).end(); return; }
            if (path === '/v1/messages/count_tokens') {
                response.writeHead(200, { 'content-type': 'application/json' }).end('{"input_tokens":1024}'); return;
            }
            if (path !== '/v1/messages') { response.writeHead(404).end(); return; }
            const chunks: Buffer[] = []; let size = 0;
            for await (const chunk of request) {
                const bytes = Buffer.from(chunk); size += bytes.length;
                if (size > 8 * 1024 * 1024) { response.writeHead(413).end(); return; }
                chunks.push(bytes);
            }
            const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            const messages = JSON.stringify(body.messages ?? []);
            const agent = AGENTS.find(item => messages.includes(item.prompt));
            requests.push(agent?.prompt ?? 'auxiliary');
            if (agent) received.add(agent.prompt);
            const message = { id: 'msg_fixture_' + ++sequence, type: 'message', role: 'assistant', model: body.model,
                content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1024, output_tokens: 0 } };
            if (!body.stream) {
                response.writeHead(200, { 'content-type': 'application/json' })
                    .end(JSON.stringify({ ...message, content: [{ type: 'text', text: 'OK' }], stop_reason: 'end_turn' }));
                return;
            }
            response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
            const emit = (type: string, value: Record<string, unknown>) =>
                response.write('event: ' + type + '\ndata: ' + JSON.stringify({ type, ...value }) + '\n\n');
            emit('message_start', { message });
            emit('content_block_start', { index: 0, content_block: { type: 'text', text: '' } });
            if (agent) {
                held.add(response);
                response.on('close', () => held.delete(response));
            } else {
                emit('content_block_delta', { index: 0, delta: { type: 'text_delta', text: 'OK' } });
                emit('content_block_stop', { index: 0 });
                emit('message_delta', { delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 1 } });
                emit('message_stop', {});
                response.end();
            }
        } catch { response.destroy(); }
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    return {
        url: 'http://127.0.0.1:' + (server.address() as AddressInfo).port, received, requests,
        async close() {
            for (const response of held) response.destroy();
            server.closeAllConnections();
            await new Promise<void>(resolve => server.close(() => resolve()));
        },
    };
}
