/** Dependency-free publisher, copied into a verified CI bundle. No npm login/token. */
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';

export const REPOSITORY = 'fbincon/claude-code-statusline';
export const NPM_PACKAGE = '@fbincon/claude-code-statusline';
const REGISTRY = 'https://registry.npmjs.org';
export interface PublishPlan {
    schema_version: 1; tag: string; commit: string; version: string;
    channel: 'preview' | 'stable'; dist_tag: 'beta' | 'latest';
    filename: string; sha256: string; integrity: string; ci_run: number;
}
export function validatePlan(plan: PublishPlan) {
    assert.equal(plan.schema_version, 1);
    assert.match(plan.version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/u);
    assert.equal(plan.tag, 'v' + plan.version);
    assert.match(plan.commit, /^[a-f0-9]{40}$/u);
    assert.equal(plan.channel, plan.version.includes('-') ? 'preview' : 'stable');
    assert.equal(plan.dist_tag, plan.channel === 'stable' ? 'latest' : 'beta');
    assert.equal(plan.filename, 'fbincon-claude-code-statusline-' + plan.version + '.tgz');
    assert.equal(basename(plan.filename), plan.filename);
    assert.match(plan.sha256, /^[a-f0-9]{64}$/u);
    assert.match(plan.integrity, /^sha512-[A-Za-z0-9+/]{86}==$/u);
    assert(Number.isSafeInteger(plan.ci_run) && plan.ci_run > 0);
}
export function requirePublishContext(plan: Pick<PublishPlan, 'tag' | 'commit'>, env = process.env) {
    assert.equal(env.GITHUB_REPOSITORY, REPOSITORY);
    assert.equal(env.GITHUB_EVENT_NAME, 'workflow_dispatch');
    assert.equal(env.GITHUB_REF, 'refs/tags/' + plan.tag, 'Live publishing must be dispatched from the release tag');
    assert.equal(env.GITHUB_SHA, plan.commit, 'Provenance must identify the package source commit');
}
export function verifyRegistryVersion(metadata: any, plan: PublishPlan) {
    const version = metadata.versions?.[plan.version];
    if (!version) return false;
    assert.equal(version.name, NPM_PACKAGE);
    assert.equal(version.version, plan.version);
    assert.equal(version.dist?.integrity, plan.integrity, 'Existing npm version has different bytes; never overwrite it');
    const url = new URL(version.dist.tarball);
    assert.equal(url.origin, REGISTRY);
    assert.equal(url.username + url.password, '');
    return true;
}
export function tagCorrections(before: Record<string, string>, after: Record<string, string>, plan: PublishPlan) {
    const corrections: [string, string][] = [];
    if (plan.channel === 'preview') assert(before.latest && before.latest !== plan.version, 'Preview needs an existing stable latest');
    if (after[plan.dist_tag] !== plan.version) corrections.push([plan.dist_tag, plan.version]);
    for (const [tag, version] of Object.entries(before)) {
        if (tag === plan.dist_tag || after[tag] === version) continue;
        // Only undo a selector moved to this new version by the publish operation.
        assert.equal(after[tag], plan.version, 'Concurrent dist-tag change; inspect registry state before retrying');
        corrections.push([tag, version]);
    }
    return corrections;
}
async function json(url: string, authenticated = false): Promise<any> {
    const headers: Record<string, string> = { 'User-Agent': 'statusline-npm-publisher' };
    if (authenticated) headers.Authorization = 'Bearer ' + process.env.GH_TOKEN;
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(30000) });
    if (!authenticated && response.status === 404) return { versions: {}, 'dist-tags': {} };
    assert(response.ok, 'Metadata request failed: HTTP ' + response.status);
    return response.json();
}
export const registryMetadata = () => json(REGISTRY + '/' + encodeURIComponent(NPM_PACKAGE));
export async function verifyPublishedBytes(metadata: any, plan: PublishPlan) {
    if (!verifyRegistryVersion(metadata, plan)) return false;
    const response = await fetch(metadata.versions[plan.version].dist.tarball, { signal: AbortSignal.timeout(120000) });
    assert(response.ok, 'Cannot download published package');
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(createHash('sha256').update(bytes).digest('hex'), plan.sha256, 'Registry tarball differs from CI');
    assert.equal('sha512-' + createHash('sha512').update(bytes).digest('base64'), plan.integrity);
    return true;
}
async function requireUnmovedTag(plan: PublishPlan) {
    const root = 'https://api.github.com/repos/' + REPOSITORY;
    let object = (await json(root + '/git/ref/tags/' + encodeURIComponent(plan.tag), true)).object;
    for (let depth = 0; object.type === 'tag' && depth < 5; depth++) object = (await json(root + '/git/tags/' + object.sha, true)).object;
    assert.equal(object.type, 'commit');
    assert.equal(object.sha, plan.commit, 'Release tag moved after verification');
}
export async function publish(planFile: string) {
    const plan: PublishPlan = JSON.parse(fs.readFileSync(planFile, 'utf8'));
    validatePlan(plan); requirePublishContext(plan);
    const directory = dirname(planFile), artifact = join(directory, plan.filename), bytes = fs.readFileSync(artifact);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), plan.sha256);
    assert.equal('sha512-' + createHash('sha512').update(bytes).digest('base64'), plan.integrity);
    await requireUnmovedTag(plan);
    const before = await registryMetadata(), beforeTags = before['dist-tags'] ?? {};
    if (await verifyPublishedBytes(before, plan)) {
        assert.equal(beforeTags[plan.dist_tag], plan.version, 'Existing version is on another selector; do not roll back dist-tags');
        if (plan.channel === 'preview') assert.notEqual(beforeTags.latest, plan.version, 'Existing preview must not be latest');
        console.log(JSON.stringify({ status: 'pass', action: 'already-published', tag: plan.tag, oidc_verified: false }));
        return;
    }
    if (plan.channel === 'preview') assert(beforeTags.latest && beforeTags.latest !== plan.version);
    assert(process.env.ACTIONS_ID_TOKEN_REQUEST_URL && process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN, 'GitHub OIDC is unavailable');
    // Ignore login credentials/configuration; authentication must come from OIDC.
    const config = join(directory, 'publisher.npmrc');
    fs.writeFileSync(config, 'registry=' + REGISTRY + '/\n', { flag: 'wx', mode: 0o600 });
    const env = { ...process.env, NPM_CONFIG_USERCONFIG: config, NODE_AUTH_TOKEN: '', NPM_TOKEN: '', GH_TOKEN: '' };
    const npm = (args: string[]) => execFileSync('npm', args, { cwd: directory, env, stdio: 'inherit', timeout: 180000 });
    npm(['publish', artifact, '--registry=' + REGISTRY + '/', '--access', 'public', '--tag', plan.dist_tag, '--ignore-scripts']);
    let metadata: any;
    for (let attempt = 0; attempt < 36; attempt++) {
        metadata = await registryMetadata();
        if (await verifyPublishedBytes(metadata, plan)) break;
        assert(attempt < 35, 'npm version is not public yet; inspect registry state before retrying');
        await new Promise(resolve => setTimeout(resolve, 5000));
    }
    for (const [tag, version] of tagCorrections(beforeTags, metadata['dist-tags'] ?? {}, plan))
        npm(['dist-tag', 'add', NPM_PACKAGE + '@' + version, tag, '--registry=' + REGISTRY + '/']);
    metadata = await registryMetadata();
    assert(await verifyPublishedBytes(metadata, plan));
    assert.equal(tagCorrections(beforeTags, metadata['dist-tags'] ?? {}, plan).length, 0, 'Registry selectors have not converged');
    const report = { status: 'pass', action: 'published', tag: plan.tag, commit: plan.commit, ci_run: plan.ci_run, sha256: plan.sha256, dist_tags: metadata['dist-tags'] };
    fs.writeFileSync(join(directory, 'npm-publication.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify(report));
    if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `Published **${NPM_PACKAGE}@${plan.version}** with OIDC. Registry bytes and dist-tags verified.\n`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const { values, positionals } = parseArgs({ allowPositionals: true, options: { plan: { type: 'string' } } });
    assert.equal(positionals.join(' '), 'publish'); assert(values.plan);
    await publish(resolve(values.plan));
}
