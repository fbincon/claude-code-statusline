import test from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { exportReference, python } from '../common.js';
import { canonical, decode, encode } from '@fbincon/statusline-core/json';
import { parseUsage, parseCostSnapshot } from '@fbincon/statusline-core/runtime/usage';
import { sha256 } from '@fbincon/statusline-platform/hash';
import type { Data } from '@fbincon/statusline-core/runtime/values';

test('streaming usage and independently replaced cost fields match the immutable Python oracle', { skip: process.platform !== 'linux' }, t => {
    const reference = exportReference();
    t.after(() => rmSync(reference, { recursive: true, force: true }));
    let seed = 0x61498523;
    const next = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed >>> 0; };
    const values = [0, 1, 27, -1, null, true, '3', decode('1.0'), 9007199254740993n];
    const names = ['m', '2', '10', '__proto__', 'constructor', '中文', '😀'];
    const traces: unknown[][] = [];
    for (let trial = 0; trial < 72; trial++) {
        const rows: Data[] = [];
        for (let index = 0; index < 80; index++) {
            const cost = next() % 4 === 0, usage: Data = {};
            const fields = cost ? ['inputTokens', 'cacheCreationInputTokens', 'cacheReadInputTokens', 'outputTokens'] : ['input_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens', 'output_tokens'];
            for (const field of fields) if (next() % 3) usage[field] = values[next() % values.length];
            const timestamp = next() % 3 ? `2026-10-04T10:00:${String(next() % 60).padStart(2, '0')}Z` : next() % 2 ? 'invalid' : null;
            rows.push(cost ? { type: 'cost-state', timestamp, modelUsage: { model: usage } } : { type: 'assistant', timestamp, message: { id: names[next() % names.length], usage } });
        }
        traces.push(rows);
    }
    const expected = decode(execFileSync(python, ['-B', '-c', [
        'import json,sys',
        'from claude_statusline.runtime.usage import _parse_usage, _parse_cost_snapshot',
        'result=[]',
        'for rows in json.load(sys.stdin):',
        ' observed={"input":False,"output":False}',
        ' ids=_parse_usage(rows,observed)',
        ' snapshot=_parse_cost_snapshot(rows,observed)',
        ' result.append(dict(ids=ids,snapshot=snapshot,observed=observed))',
        'print(json.dumps(result,ensure_ascii=False))',
    ].join('\n')], { input: encode(traces), encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, env: { ...process.env, PYTHONPATH: join(reference, 'src'), PYTHONDONTWRITEBYTECODE: '1' } })) as unknown[];
    for (const [index, rows] of traces.entries()) {
        const observed = { input: false, output: false }, ids = parseUsage(rows, observed), snapshot = parseCostSnapshot(rows, sha256, observed);
        assert.equal(canonical({ ids, snapshot, observed }), canonical(expected[index]), `trace ${index}`);
    }
});
