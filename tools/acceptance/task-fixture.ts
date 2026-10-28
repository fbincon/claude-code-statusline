import * as fs from 'node:fs';
import { join } from 'node:path';
import { newRecord, mirrorState } from '@fbincon/statusline-core/runtime/tasks/model';
import { pythonJson } from '@fbincon/statusline-core/json-text';
import { sha256 } from '@fbincon/statusline-platform/hash';
/** Published synthetic evidence for installed readers; no prompt/model call. */
export function taskFixture(directory: string, session: string): {
    path: string;
    bytes: Buffer;
} {
    const now = BigInt(Date.now()) * 1000000n;
    const record = newRecord('captured-task', { wall_ns: now - 2000000000n, boot_ns: null, boot_id: null });
    Object.assign(record, { status: 'completed', duration_ns: 2000000000n, updated_wall_ns: now, agent_ids: ['agent-alpha', 'agent-beta'] });
    const path = join(directory, 'statusline_runtime', 'turns', sha256(session) + '.json');
    const bytes = Buffer.from(pythonJson(mirrorState(session, { schema: 4, session_id: session, current_prompt_id: record.prompt_id, turns: [record], updated_wall_ns: now })));
    fs.mkdirSync(join(directory, 'statusline_runtime', 'turns'), { recursive: true });
    fs.writeFileSync(path, bytes);
    return { path, bytes };
}
