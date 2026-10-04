import { expect, test } from 'claude-code/testing';
import {
  BackendError,
  parseResponse,
  processFailure,
  requestText,
} from '../../lib/backend.ts';
import { description, output, readResult, reply, sample } from '../fixtures.ts';

test('backend errors and protocol mismatches are explicit', () => {
  for (const stdout of [
    '',
    'partial {',
    JSON.stringify({ protocol_version: 2, result: {} }),
    JSON.stringify({
      protocol_version: 1,
      result: {},
      error: { code: 'bad', message: 'ambiguous' },
    }),
    JSON.stringify({
      protocol_version: 1,
      result: { sample: false, main: [], subagents: [] },
    }),
  ]) {
    expect(() =>
      parseResponse('preview', { exitCode: 0, stdout, stderr: '' }),
    ).toThrow();
  }
  expect(() =>
    parseResponse('read', {
      exitCode: 2,
      stdout: JSON.stringify({
        protocol_version: 1,
        error: { code: 'configuration_conflict', message: 'Reopen the editor' },
      }),
      stderr: '',
    }),
  ).toThrow('Reopen the editor');
});

test('apply validates the saved draft, new revision and transaction outcome', () => {
  const saved = {
    ...readResult(),
    changed: true,
    backup_dir: '/tmp/backup 中文 spaces',
  };
  expect(parseResponse('apply', reply(saved))).toEqual(saved);
  const noop = { ...saved, changed: false, backup_dir: null };
  expect(parseResponse('apply', reply(noop))).toEqual(noop);
  for (const result of [
    { ...saved, changed: 'yes' },
    { ...saved, backup_dir: 1 },
    { ...saved, revision: 'stale' },
    { ...saved, draft: {} },
    readResult(),
  ]) {
    expect(() => parseResponse('apply', reply(result))).toThrow();
  }
  const invalid = JSON.parse(JSON.stringify(saved));
  invalid.draft.display.items = ['unknown'];
  expect(() => parseResponse('apply', reply(invalid))).toThrow();
});

test('failed processes, timeouts, truncation and structured errors remain distinct', () => {
  expect(processFailure(new Error('spawn ENOENT')).code).toBe(
    'backend_process',
  );
  expect(
    processFailure(new Error('Process timed out after 30000ms')).code,
  ).toBe('backend_timeout');
  const conflict = new BackendError(
    'configuration_conflict',
    'Reopen the editor',
  );
  expect(processFailure(conflict)).toBe(conflict);
  expect(() =>
    parseResponse('read', output('usage: unsupported ui command', 2)),
  ).toThrow('status 2');
  expect(() =>
    parseResponse('preview', { ...reply(sample('safe')), exitCode: 1 }),
  ).toThrow('status 1');
  expect(() =>
    parseResponse('preview', {
      ...reply(sample('safe')),
      isStdoutTruncated: true,
    }),
  ).toThrow('truncated');
  for (const code of [
    'not_installed',
    'ownership_mismatch',
    'configuration_conflict',
    'io_error',
    'unsupported_operation',
  ]) {
    try {
      parseResponse(
        'apply',
        output(
          JSON.stringify({
            protocol_version: 1,
            error: { code, message: code },
          }),
          2,
        ),
      );
      throw new Error('Expected a rejected response');
    } catch (error) {
      expect((error as BackendError).code).toBe(code);
    }
  }
});

test('unexpected envelopes and invalid drafts cannot enter the frontend', () => {
  for (const response of [
    { protocol_version: 1, result: sample('safe'), extra: 1 },
    { protocol_version: 1 },
    { protocol_version: 1, error: { message: 'missing code' } },
  ]) {
    expect(() =>
      parseResponse('preview', output(JSON.stringify(response))),
    ).toThrow();
  }
  for (const value of [true, 2.5, 33]) {
    const read = JSON.parse(JSON.stringify(readResult()));
    read.draft.host.padding = value;
    expect(() => parseResponse('read', reply(read))).toThrow();
  }
});

test('preview transport refuses control sequences and malformed colors', () => {
  for (const span of [
    { text: '\u001b[31munsafe', bold: false, foreground: null },
    { text: 'safe', bold: true, foreground: { kind: 'rgb', value: '#xxx' } },
  ]) {
    expect(() =>
      parseResponse('preview', {
        exitCode: 0,
        stdout: JSON.stringify({
          protocol_version: 1,
          result: { sample: true, main: [[span]], subagents: [] },
        }),
        stderr: '',
      }),
    ).toThrow();
  }
  expect(
    JSON.parse(requestText('preview', { draft: '中文 spaces $`', width: 80 }))
      .payload.draft,
  ).toBe('中文 spaces $`');
});

test('the editor refuses incomplete choices, duplicate catalog entries and missing capabilities', () => {
  for (const mutate of [
    (value: any) => {
      value.catalog[1] = value.catalog[0];
    },
    (value: any) => {
      value.catalog[0].scope = 'foreign';
    },
    (value: any) => {
      value.catalog[0].excludes = ['unknown'];
    },
    (value: any) => {
      value.catalog[0].label = '\u001b[31munsafe';
    },
    (value: any) => {
      delete value.options.padding;
    },
    (value: any) => {
      value.options.palette.choices = ['unknown'];
    },
    (value: any) => {
      value.options['refresh-interval'].minimum = 0;
    },
    (value: any) => {
      value.capabilities = {};
    },
    (value: any) => {
      value.operations = ['read'];
    },
  ]) {
    const value = description();
    mutate(value);
    expect(() => parseResponse('describe', reply(value))).toThrow();
  }
  expect(parseResponse('describe', reply(description())).catalog.length).toBe(
    34,
  );
});
