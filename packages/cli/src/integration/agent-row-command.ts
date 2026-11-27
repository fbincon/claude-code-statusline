import { isAbsolute, resolve } from 'node:path';
import { isSchema } from '@fbincon/statusline-core/config/validation';
import { decode } from '@fbincon/statusline-core/json';
import { object } from '@fbincon/statusline-core/runtime/values';
import { expandUser, resolvedPath } from '@fbincon/statusline-platform/commands';
import { isLinkOrReparse } from '@fbincon/statusline-platform/files';
import { readLimitedInput } from '@fbincon/statusline-platform/input';
import { decodeUtf8 } from '@fbincon/statusline-platform/utf8';
import { AGENT_ROW_PROTOCOL_BYTES, renderAgentRowBatch } from '../rendering/agent-rows.js';
import { agentRowAccess, agentRowLoaded, agentRowReady, beginAgentRowBatch, confirmAgentRowBatch, type AgentRowIdentity } from './agent-row-route.js';

const PASS = '{"protocol":1,"mode":"pass","rows":[]}\n';

function identityOf(value: Record<string, unknown>): AgentRowIdentity | undefined {
    const { session_id, host_version, backend_version, installation_id, cwd } = value;
    const token = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 256 && !/[\p{Cc}]/u.test(v);
    if (token(session_id) && token(host_version) && token(backend_version) && token(installation_id) &&
        typeof cwd === 'string' && isAbsolute(cwd) && !cwd.includes('\0'))
        return { session_id, host_version, backend_version, installation_id, cwd };
    return undefined;
}

/** Private Mod pipe. A missed observation or transient read leaves Claude's row intact. */
export async function agentRowCommand(args: readonly string[], defaultDirectory?: string, stdin?: () => string): Promise<string> {
    try {
        const [operation, flag, path] = args;
        let directory = defaultDirectory ?? process.env.CLAUDE_CONFIG_DIR;
        if (args.length === 3 && flag === '--config-dir' && path && !path.startsWith('--')) directory = path;
        else if (args.length !== 1) return PASS;
        const input = stdin ? stdin() : readLimitedInput(AGENT_ROW_PROTOCOL_BYTES, 0, 8192);
        if (Buffer.byteLength(input) > AGENT_ROW_PROTOCOL_BYTES) return PASS;
        const data = decode(typeof input === 'string' ? input : decodeUtf8(input));
        if (!object(data) || !isSchema(data.protocol, 1)) return PASS;
        const identity = identityOf(data);
        if (!identity) return PASS;
        let target = resolve(expandUser(directory?.trim() ? directory : '~/.claude'));
        if (isLinkOrReparse(target)) target = resolvedPath(target);
        if (operation === '--agent-row-loaded' || operation === '--agent-row-ready') {
            const mode = operation === '--agent-row-loaded'
                ? agentRowLoaded(target, identity)
                : agentRowReady(target, identity, data.confirmation);
            return JSON.stringify({ protocol: 1, mode, rows: [] }) + '\n';
        }
        if (operation !== '--agent-row-batch') return PASS;
        const batch = beginAgentRowBatch(target, identity);
        if (batch.mode === 'pass') return PASS;
        const rows = await renderAgentRowBatch(data, target);
        // The user may have switched installations or renderers during collection.
        const mode = agentRowAccess(target, identity);
        if (mode === 'pass') return PASS;
        const result = { protocol: 1, mode, rows };
        const response = JSON.stringify(result);
        if (Buffer.byteLength(response) + 1 > AGENT_ROW_PROTOCOL_BYTES) return PASS;
        const confirmation = batch.revision && rows.some(row => row.body !== undefined)
            ? confirmAgentRowBatch(target, identity, batch.revision) : undefined;
        if (!confirmation) return response + '\n';
        const confirmed = JSON.stringify({ ...result, confirmation }) + '\n';
        return Buffer.byteLength(confirmed) <= AGENT_ROW_PROTOCOL_BYTES ? confirmed : PASS;
    } catch {
        return PASS;
    }
}
