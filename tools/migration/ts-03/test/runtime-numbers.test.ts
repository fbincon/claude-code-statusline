import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { decode, encode, canonical, LosslessNumber } from '@fbincon/statusline-core/json';
import { divideIntegers } from '@fbincon/statusline-core/numbers';
import { sumNumbers } from '@fbincon/statusline-core/runtime/live/requests';
import { float, timestamp } from '@fbincon/statusline-core/runtime/transcript';
import { python } from '../common.js';
import { aggregateVisible, usageInt } from '@fbincon/statusline-core/runtime/usage';
test('cache totals flush safe integer sums before overflow and retain exact numeric kinds', () => {
    const values: unknown[] = [0, -0, 1, 9007199254740991, 2, 9007199254740990, 3, 10n ** 40n, -1, -2n, true, '12', new LosslessNumber('1.0'), new LosslessNumber('9007199254740993'), Infinity, NaN, 1.5];
    for (let offset = 0; offset < values.length; offset++) {
        const ordered = [...values.slice(offset), ...values.slice(0, offset)];
        const ids = Object.fromEntries(ordered.map((i, index) => ['id-' + index, { i, o: i, cc: i, cr: i }]));
        const expected = ordered.reduce<bigint>((total, value) => total + usageInt(value), 7n);
        assert.deepEqual(aggregateVisible({ base: { i: 7, o: 7, cc: 7, cr: 7 }, ids }), { i: expected, o: expected, cc: expected, cr: expected });
    }
});
test('runtime divisions and compensated cost sums retain Python binary64 results and integer kinds', () => {
    let seed = 0x21c57n;
    const random = () => { seed = (seed * 6364136223846793005n + 1442695040888963407n) & ((1n << 64n) - 1n); return seed; };
    const divisions: bigint[][] = [];
    for (let i = 0; i < 512; i++) {
        const shift = [0, 1, 52, 64, 1022, 1074, 1100][i % 7]!;
        const n = random() << BigInt(shift), d = (random() | 1n) << BigInt(i % 5 === 0 ? 1100 : i % 3 === 0 ? 1074 : 0);
        divisions.push([i % 2 ? n : -n, d]);
    }
    const sums: unknown[][] = [[1n, 2n, 9007199254740993n], [float(0.1), float(0.2), float(0.3)], [float(1e16), float(1), float(1)], [float(-0)], [float(1e16), float(1), float(-1e16)]];
    for (let i = 0; i < 64; i++)
        sums.push(Array.from({ length: 64 }, () => new LosslessNumber((Number(random() % 100000n) / 1000).toExponential())));
    const source = 'import json,sys\nx=json.load(sys.stdin)\nout=[]\nfor a,b in x["divisions"]:\n try:out.append(a/b)\n except OverflowError:out.append("overflow")\nprint(json.dumps({"divisions":out,"sums":[sum(v) for v in x["sums"]]}))';
    const expected = decode(execFileSync(python, ['-c', source], { input: encode({ divisions, sums }), encoding: 'utf8' }));
    const actual = { divisions: divisions.map(([n, d]) => { try {
            return float(divideIntegers(n!, d!));
        }
        catch {
            return 'overflow';
        } }), sums: sums.map(sumNumbers) };
    assert.equal(canonical(actual), canonical(expected));
});
test('transcript ISO timestamps match Python calendar, week, precision and malformed-input semantics', t => {
    const previous = process.env.TZ;
    process.env.TZ = 'UTC';
    t.after(() => { if (previous === undefined)
        delete process.env.TZ;
    else
        process.env.TZ = previous; });
    const values: unknown[] = [null, false, 0, '', 'invalid', '2026-10-14', '20261014', '2026-1014', '202610-14', '2026-10-14Z', '2026-10-14+01:00',
        '2026-W41', '2026W41', '2026-W41-3', '2026W413T12:10:05Z', '2020-W53-7', '2021-W53-1', '2026-10-14💙12:00:00Z', '2026-10-14T23:59:60Z', '0001-01-01', '0001-01-01Z', '0001-01-01T00:00:00Z', '9999-12-31T23:59:59.999999Z'];
    for (const clock of ['10', '1011', '10:11', '101112', '10:11:12', '10.5', '10:11,12345678', '10:11:12.1234567'])
        for (const zone of ['', 'Z', '+04:61', '+00:00:00.123', '+01:00:00.1234567', '-02:00', '+24:00'])
            values.push('2026-10-14T' + clock + zone);
    const source = 'import json,sys,datetime\nr=[]\nfor value in json.load(sys.stdin):\n try:\n  s=value.strip();s=s[:-1]+"+00:00" if s.endswith("Z") else s\n  r.append(datetime.datetime.fromisoformat(s).timestamp())\n except Exception:r.append(None)\nprint(json.dumps(r))';
    const expected = decode(execFileSync(python, ['-c', source], { input: encode(values), encoding: 'utf8', env: { ...process.env, TZ: 'UTC' } })) as unknown[];
    for (const [i, value] of values.entries()) {
        const actual = timestamp(value);
        assert.equal(canonical(actual === null ? null : float(actual)), canonical(expected[i]), String(value));
    }
});
