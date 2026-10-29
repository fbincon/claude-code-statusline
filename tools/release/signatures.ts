/** Supported verification of bundled releases using the pinned npm verifier. Never publishes. */
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { removeTree } from '@fbincon/statusline-platform/remove-tree';
import { npmEntry, readTar, sha256 } from '../build/files.js';
import { BUSINESS } from '../build/model.js';
import { NPM_PACKAGE, REPOSITORY } from './npm-registry.js';

export interface SignatureOptions { version: string; commit: string; artifact: string; output: string }
const REGISTRY = 'https://registry.npmjs.org/';
export function verifiedProvenance(bundles: any[], expected: Pick<SignatureOptions, 'version' | 'commit'>, integrity: string) {
  const statements = bundles.map(bundle => {
    const envelope = bundle.dsseEnvelope ?? bundle.bundle?.dsseEnvelope;
    assert.equal(envelope?.payloadType, 'application/vnd.in-toto+json');
    return JSON.parse(Buffer.from(envelope.payload, 'base64').toString('utf8'));
  });
  const provenance = statements.find(statement => statement.predicateType === 'https://slsa.dev/provenance/v1');
  assert(provenance, 'Verified source provenance is required');
  const digest = Buffer.from(integrity.slice(7), 'base64').toString('hex');
  for (const statement of statements) assert(statement.subject?.some((subject: any) => subject.name === 'pkg:npm/%40fbincon/claude-code-statusline@' + expected.version && subject.digest?.sha512 === digest), 'Attestation subject differs from package bytes');
  const definition = provenance.predicate?.buildDefinition, workflow = definition?.externalParameters?.workflow;
  assert.equal(workflow?.repository, 'https://github.com/' + REPOSITORY);
  assert.equal(workflow?.ref, 'refs/tags/v' + expected.version);
  assert.equal(workflow?.path, '.github/workflows/npm-publish.yml');
  assert(definition.resolvedDependencies?.some((dependency: any) => dependency.digest?.gitCommit === expected.commit && dependency.uri === 'git+https://github.com/' + REPOSITORY + '@refs/tags/v' + expected.version), 'Provenance source differs');
  assert.equal(provenance.predicate.runDetails?.builder?.id, 'https://github.com/actions/runner/github-hosted');
  const invocation = provenance.predicate.runDetails?.metadata?.invocationId;
  assert.match(invocation, /^https:\/\/github\.com\/fbincon\/claude-code-statusline\/actions\/runs\/\d+(?:\/attempts\/\d+)?$/u);
  return { repository: workflow.repository, ref: workflow.ref, workflow: workflow.path, commit: expected.commit, invocation };
}
export function verifiedInventory(entries: Map<string, Buffer>, options: Pick<SignatureOptions, 'version' | 'commit'>) {
  const json = (name: string) => { assert(entries.has(name), 'Missing package file: ' + name); return JSON.parse(entries.get(name)!.toString()); };
  const manifest = json('package.json'), source = json('candidate.json');
  assert.equal(manifest.name, NPM_PACKAGE); assert.equal(manifest.version, options.version);
  assert.equal(source.application_version, options.version); assert.equal(source.commit, options.commit);
  assert.equal(source.schema_version, 1); assert.equal(source.dirty, false);
  assert.deepEqual(Object.keys(source.files).sort(), [...entries.keys()].filter(name => name !== 'candidate.json').sort(), 'Incomplete package inventory');
  for (const [name, hash] of Object.entries(source.files)) assert.equal(sha256(entries.get(name)!), hash, 'Changed package file: ' + name);
  const internal = BUSINESS.map(name => '@fbincon/statusline-' + name);
  const dependencies = { ...manifest.dependencies, ...manifest.optionalDependencies };
  assert.deepEqual([...manifest.bundleDependencies].sort(), Object.keys(dependencies).sort());
  for (const name of internal) {
    assert.equal(dependencies[name], '0.0.0');
    const workspace = json('node_modules/' + name + '/package.json');
    assert.equal(workspace.name, name); assert.equal(workspace.version, '0.0.0'); assert.equal(workspace.private, true);
  }
  assert.deepEqual(Object.keys(source.dependencies).sort(), Object.keys(dependencies).filter(name => !internal.includes(name)).sort(), 'Incomplete public dependency inventory');
  for (const [name, record] of Object.entries(source.dependencies) as [string, any][]) {
    assert.equal(record.version, dependencies[name]);
    assert.match(record.integrity, /^sha512-[A-Za-z0-9+/]+=*$/u);
    const prefix = 'node_modules/' + name + '/';
    assert.deepEqual(Object.keys(record.files).sort(), [...entries.keys()].filter(path => path.startsWith(prefix)).map(path => path.slice(prefix.length)).sort());
    for (const [path, hash] of Object.entries(record.files)) assert.equal(sha256(entries.get(prefix + path)!), hash);
  }
  return { source, internal };
}
export async function verifyReleaseSignatures(options: SignatureOptions) {
  assert.match(options.version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u);
  assert.match(options.commit, /^[a-f0-9]{40}$/u);
  assert(!fs.existsSync(options.output), 'Use a new report path');
  const npmRoot = dirname(dirname(npmEntry())), npmRequire = createRequire(join(npmRoot, 'package.json'));
  assert.equal(npmRequire('./package.json').version, '11.19.0', 'Signature verification requires pinned npm 11.19.0');
  const VerifySignatures = npmRequire('./lib/utils/verify-signatures.js'), tufClient = npmRequire('@sigstore/tuf');
  const temporary = fs.mkdtempSync(join(tmpdir(), 'statusline-signatures-'));
  try {
    const verifier = new VerifySignatures(null, new Set(), { flatOptions: { registry: REGISTRY, cache: temporary, fetchRetries: 1, fetchTimeout: 30000 } }, {});
    const tuf = await tufClient.initTUF({ cachePath: join(temporary, 'tuf'), retry: 1, timeout: 30000 });
    await verifier.setKeys({ registry: REGISTRY, tuf });
    const bytes = fs.readFileSync(options.artifact), integrity = 'sha512-' + createHash('sha512').update(bytes).digest('base64');
    const entries = readTar(options.artifact), { source, internal } = verifiedInventory(entries, options);
    const outer = await verifier.verifySignatures(NPM_PACKAGE, options.version, REGISTRY);
    assert.equal(outer.integrity, integrity, 'Registry signature integrity differs from package bytes');
    assert(outer.signatures.length, 'Registry signatures are required');
    const provenance = verifiedProvenance(outer.attestationBundles ?? [], options, integrity);
    const dependencies = [];
    for (const [name, record] of Object.entries(source.dependencies) as [string, any][]) {
      const checked = await verifier.verifySignatures(name, record.version, REGISTRY);
      assert.equal(checked.integrity, record.integrity, 'Dependency registry integrity differs: ' + name);
      assert(checked.signatures.length, 'Missing dependency signatures: ' + name);
      const url = new URL(checked.resolved); assert.equal(url.origin + '/', REGISTRY); assert.equal(url.username + url.password, '');
      const response = await fetch(url, { signal: AbortSignal.timeout(60000) }); assert(response.ok, 'Dependency download failed');
      const upstream = Buffer.from(await response.arrayBuffer());
      assert.equal('sha512-' + createHash('sha512').update(upstream).digest('base64'), record.integrity);
      const path = join(temporary, 'upstream.tgz'); fs.writeFileSync(path, upstream);
      const original = readTar(path);
      for (const [file, hash] of Object.entries(record.files)) { assert(original.has(file), 'Bundled file absent upstream'); assert.equal(sha256(original.get(file)!), hash, 'Bundled dependency differs from signed upstream: ' + name + '/' + file); }
      dependencies.push({ name, version: record.version, integrity: checked.integrity, signatures: checked.signatures.length, attestations: checked.attestationBundles?.length ?? 0 });
    }
    const report = { schema_version: 1, status: 'pass', npm: '11.19.0', package: NPM_PACKAGE, version: options.version, commit: options.commit, sha256: sha256(bytes), integrity, signatures: outer.signatures.length, attestations: outer.attestationBundles.length, provenance, dependencies, bundled_workspaces: internal, native_full_tree_audit: 'unsupported-bundled-workspaces', scope: 'signed-outer-tarball-and-all-bundled-public-upstreams' };
    fs.writeFileSync(options.output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    return report;
  } finally { removeTree(temporary); assert(!fs.existsSync(temporary), 'Signature cache cleanup failed'); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { values } = parseArgs({ options: { version: { type: 'string' }, commit: { type: 'string' }, artifact: { type: 'string' }, output: { type: 'string' } } });
  assert(values.version && values.commit && values.artifact && values.output, 'Require --version VERSION --commit SHA --artifact TGZ --output NEW_JSON');
  console.log(JSON.stringify(await verifyReleaseSignatures({ version: values.version, commit: values.commit, artifact: resolve(values.artifact), output: resolve(values.output) })));
}
