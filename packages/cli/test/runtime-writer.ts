import { join } from 'node:path';
import { runtimeContext } from '../src/runtime/context.js';
import { TaskService } from '../src/runtime/tasks/service.js';
import { UsageCollector } from '../src/runtime/usage.js';
const [mode, root, rawIndex] = process.argv.slice(2), index = Number(rawIndex);
if (!root || !Number.isInteger(index))
    throw new Error('Invalid isolated writer arguments');
let wall = 0n;
const context = { ...runtimeContext(root, {}), runtimeRoot: join(root, 'runtime'), sample: () => ({ wall_ns: wall, boot_ns: wall, boot_id: 'test' }) };
if (mode === 'usage') {
    const result = new UsageCollector(context).collect({ session_id: 'session-' + index, transcript_path: join(root, 'session-' + index + '.jsonl') });
    if (!result)
        throw new Error('Missing usage result');
}
else if (mode === 'agents') {
    wall = BigInt(index + 2) * 1000000000n;
    new TaskService(context).handle({ session_id: 's', prompt_id: 'p', hook_event_name: 'SubagentStart', agent_id: 'agent-' + index });
}
else if (mode === 'ledger') {
    const tasks = new TaskService(context);
    for (let i = 0; i < 20; i++) {
        wall = BigInt(index * 100 + i + 1) * 1000000000n;
        tasks.transcript('shared', [{ kind: 'prompt', prompt_id: `${index}-${i}`, wall_ns: wall }, { kind: 'turn_duration', wall_ns: wall + 100000000n, duration_ms: 100 }]);
    }
}
else
    throw new Error('Unknown writer');
