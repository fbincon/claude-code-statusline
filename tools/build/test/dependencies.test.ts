import test from 'node:test';
import assert from 'node:assert/strict';
import { dependencyFileMatches, sanitizeDependencyManifest } from '../dependencies.js';
import { sha256 } from '../files.js';

test('dependency manifests lose scripts only when the field is present', () => {
  const withScripts = Buffer.from(JSON.stringify({ name: 'koffi', version: '3.3.3', main: 'index.js', scripts: { install: 'node ./cnoke.cjs' } }));
  const sanitized = sanitizeDependencyManifest(withScripts);
  assert.deepEqual(JSON.parse(sanitized.toString()), { name: 'koffi', version: '3.3.3', main: 'index.js' });
  assert.equal(sanitizeDependencyManifest(sanitized), sanitized);
  const withoutScripts = Buffer.from(JSON.stringify({ name: '@koromix/koffi-linux-x64', version: '3.3.3' }));
  assert.equal(sanitizeDependencyManifest(withoutScripts), withoutScripts);
});

test('dependency files match signed upstream bytes or the scripts-removal transform', () => {
  const upstream = Buffer.from(JSON.stringify({ name: 'koffi', version: '3.3.3', scripts: { install: 'node ./cnoke.cjs' } }));
  const sanitized = sanitizeDependencyManifest(upstream);
  assert.equal(dependencyFileMatches('package.json', sha256(upstream), upstream), true);
  assert.equal(dependencyFileMatches('package.json', sha256(sanitized), upstream), true);
  assert.equal(dependencyFileMatches('package.json', sha256(Buffer.from('{"name":"other"}')), upstream), false);
  assert.equal(dependencyFileMatches('index.js', sha256(sanitized), upstream), false);
});
