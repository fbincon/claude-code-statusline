import { expect, test } from 'claude-code/testing';
import { parseResponse, requestText } from '../lib/backend.ts';

test('backend errors and protocol mismatches are explicit', () => {
  for (const stdout of ['', 'partial {', JSON.stringify({ protocol_version: 2, result: {} }),
    JSON.stringify({ protocol_version: 1, result: {}, error: { code: 'bad', message: 'ambiguous' } }),
    JSON.stringify({ protocol_version: 1, result: { sample: false, main: [], subagents: [] } })]) {
    expect(() => parseResponse('preview', { exitCode: 0, stdout, stderr: '' })).toThrow();
  }
  expect(() => parseResponse('read', { exitCode: 2, stdout: JSON.stringify({ protocol_version: 1,
    error: { code: 'configuration_conflict', message: 'Reopen the editor' } }), stderr: '' })).toThrow('Reopen the editor');
});

test('preview transport refuses control sequences and malformed colors', () => {
  for (const span of [{ text: '\u001b[31munsafe', bold: false, foreground: null },
    { text: 'safe', bold: true, foreground: { kind: 'rgb', value: '#xxx' } }]) {
    expect(() => parseResponse('preview', { exitCode: 0, stdout: JSON.stringify({ protocol_version: 1,
      result: { sample: true, main: [[span]], subagents: [] } }), stderr: '' })).toThrow();
  }
  expect(JSON.parse(requestText('preview', { draft: '中文 spaces $`', width: 80 })).payload.draft).toBe('中文 spaces $`');
});
