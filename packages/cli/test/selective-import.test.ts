import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { defaultDisplay } from '@fbincon/statusline-core/config/display';
import { exportText } from '@fbincon/statusline-core/config/transfer';
import { DEFAULT_HOST } from '@fbincon/statusline-core/config/draft';
import { setup, jsonBytes } from './final-support.js';
import { allFiles } from './runtime-support.js';
import { selectiveImport } from '../src/config/selective-import.js';
import { ProfileService } from '../src/config/profiles.js';
import { parseConfig } from '../src/config/arguments.js';
import { profileArguments } from '../src/config/profile-command.js';

test('portable and profile selection edit bound targets with dry-run isolation and preserved identity', t => {
  const f = setup(t, true), profiles = new ProfileService(f.service);
  const library = profiles.mutate({ action: 'save', name: 'Target', display: defaultDisplay(), expected_revision: profiles.read().revision, bind_path: f.root });
  const display = defaultDisplay(); display.theme = 'light'; display.statusline_language = 'ja';
  const portable = join(f.root, 'portable.json'), profile = join(f.root, 'profile.json');
  writeFileSync(portable, exportText({ display, host: { ...DEFAULT_HOST, padding: 7 } }));
  profiles.export(profile, 'Foreign', display);
  assert.equal(f.call('profile_import', { path: profile }).status, 0);
  const protocolSelection = f.call('profile_import', { path: profile, draft: f.read().draft, selection: ['theme'] });
  assert.equal(protocolSelection.status, 0); assert.equal(protocolSelection.response.result.display.theme, 'light');
  assert.equal(protocolSelection.response.result.display.statusline_language, 'en');
  const before = allFiles(f.root);
  const preview = JSON.parse(selectiveImport(f.service, portable, { select: 'theme', project: f.root, 'dry-run': true }));
  assert.equal(preview.draft.display.theme, 'light'); assert.equal(preview.draft.host.padding, 0);
  assert.deepEqual(allFiles(f.root), before);
  const settings = readFileSync(f.settingsPath);
  selectiveImport(f.service, portable, { select: 'theme', project: f.root });
  selectiveImport(f.service, profile, { select: 'statusline_language', profile: 'Target' }, true);
  const current = profiles.read();
  assert.equal(current.profiles[0]!.id, library.profiles[0]!.id);
  assert.equal(current.profiles[0]!.name, 'Target');
  assert.deepEqual(current.bindings, library.bindings);
  assert.equal(current.profiles[0]!.display.theme, 'light');
  assert.equal(current.profiles[0]!.display.statusline_language, 'ja');
  assert.equal(f.display().theme, 'classic'); assert.deepEqual(readFileSync(f.settingsPath), settings);
});
test('invalid references and selection fail without touching files or current drafts', t => {
  const f = setup(t, true), current = f.read(), path = join(f.root, 'invalid.json');
  const incoming = structuredClone(current.draft); incoming.display.layout = { mode: 'explicit', rows: [['missing']] };
  writeFileSync(path, jsonBytes(incoming.display)); const before = allFiles(f.root);
  assert.equal(f.call('review_import', { path, draft: current.draft, selection: ['theme'] }).status, 2);
  writeFileSync(path, jsonBytes(current.draft.display)); const validFiles = allFiles(f.root);
  for (const selection of [['theme','theme'], ['sources'], 'theme']) assert.equal(f.call('review_import', { path, draft: current.draft, selection }).status, 2);
  assert.deepEqual(allFiles(f.root), validFiles);
  assert.deepEqual(f.read().draft, current.draft);
  assert(before);
});
test('both CLI parsers expose the same bounded selection and target controls', () => {
  assert.deepEqual(parseConfig(['import','file.json','--select','main,theme','--profile','Target','--dry-run']).flags,
    { select: 'main,theme', profile: 'Target', 'dry-run': true });
  assert.equal(profileArguments(['profile','import','file.json','--select','theme','--user']).flags['--user'], true);
});
