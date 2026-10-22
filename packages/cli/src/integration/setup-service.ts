import * as fs from 'node:fs';
import { dirname, join } from 'node:path';
import type { Draft } from '@fbincon/statusline-core/contracts/ui';
import type { SetupFacts } from '@fbincon/statusline-core/editor/setup';
import { text, type LocalizedText } from '@fbincon/statusline-core/i18n/messages';
import { supportedNode, NODE_RUNTIME_RANGE } from '@fbincon/statusline-core/node-runtime';
import { CONFIG_FILENAME } from '@fbincon/statusline-core/config/display';
import { PROFILES_FILENAME } from '@fbincon/statusline-core/config/profiles';
import { FEATURE_FILENAME, NATIVE_FILENAME, RUNTIME_FILENAME } from '@fbincon/statusline-core/config/backend-preferences';
import { ConfigError } from '@fbincon/statusline-core/config/validation';
import { readDisplay, readSettings, jsonBytes } from '../config/storage.js';
import { loadFeature, loadNative, loadRuntime } from '../config/backend-preferences.js';
import { ConfigurationService, atLeast, draft, type MutationResult } from '../config/service.js';
import { readProfiles, resolveProfile } from '../rendering/configuration.js';
import { localizedError } from '../errors.js';
import { assertClear, hash } from '../recovery/journal.js';
import { BINDING_FILE } from './ownership.js';
import { SKILL, EXTERNAL, OWNER_FILE, NATIVE, RUNTIME, type InstallContext, type ChangeResult } from './model.js';
import { safeTarget } from './paths.js';
import { install } from './install.js';
import { doctor } from './doctor.js';
import { owner } from './mod-ownership.js';

export interface SetupInspection extends SetupFacts {
    revision: string | null;
    fingerprints: Record<string, string>;
}
const message = (error: unknown): string | LocalizedText => error instanceof ConfigError ? localizedError(error) : error instanceof Error ? error.message : String(error);
export function configurationService(context: InstallContext): ConfigurationService {
    return new ConfigurationService({ configDir: context.configDir, launch: context.launch, hostVersion: () => context.version }, context.io);
}
function fingerprint(context: InstallContext, path: string): string {
    safeTarget(context.configDir, path);
    let mode: string;
    try {
        const stat = fs.lstatSync(path);
        mode = process.platform === 'win32' ? '' : String(stat.mode & 0o777);
        if (stat.isDirectory()) return 'directory:' + mode;
        if (!stat.isFile()) throw new Error('Not a regular configuration file: ' + path);
    } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 'absent'; throw error; }
    return mode + ':' + hash(context.io.read(path));
}
/** No locks, mkdir, write probes, plugin commands or recovery writes before review. */
export function inspectSetup(context: InstallContext, project = process.cwd()): SetupInspection {
    const facts: SetupInspection = { checks: [], resources: [], notes: [], draft: null, hasDisplay: false, canSave: true,
        canIntegrate: true, revision: null, fingerprints: {} };
    const ownedArtifacts: string[] = [];
    const check = (action: () => void, display = false) => {
        try { action(); }
        catch (error) { facts.checks.push({ level: 'ERROR', message: message(error) }); facts.canIntegrate = false; if (display) facts.canSave = false; }
    };
    facts.checks.push({ level: supportedNode(process.versions.node) ? 'OK' : 'ERROR', message: text('setup.node', { version: process.versions.node, supported: NODE_RUNTIME_RANGE }) });
    if (!supportedNode(process.versions.node)) facts.canSave = facts.canIntegrate = false;
    check(() => {
        fs.accessSync(context.launch.executable, process.platform === 'win32' ? fs.constants.F_OK : fs.constants.X_OK);
        facts.checks.push({ level: 'OK', message: text('doctor.doctor.executable', { executable: context.launch.executable }) });
    }, true);
    const compatible = atLeast(context.version, [2, 1, 205]);
    facts.checks.push({ level: compatible ? 'OK' : 'WARN', message: text('setup.host', { version: context.version?.join('.') ?? text('setup.value.unknown') }) });
    if (!compatible) facts.canIntegrate = false;
    check(() => {
        safeTarget(context.configDir, join(context.configDir, CONFIG_FILENAME));
        let parent = context.configDir;
        while (!fs.existsSync(parent) && parent !== dirname(parent)) parent = dirname(parent);
        if (!fs.statSync(parent).isDirectory()) throw new Error('Not a configuration directory: ' + parent);
        fs.accessSync(parent, fs.constants.W_OK | fs.constants.X_OK);
        assertClear(context.configDir);
        facts.checks.push({ level: 'OK', message: text('setup.directory', { path: context.configDir }) });
    }, true);
    check(() => {
        const [display, raw] = readDisplay(context.configDir, context.io), [settings] = readSettings(context.configDir, context.io);
        const [profiles] = readProfiles(context.configDir, context.io), service = configurationService(context);
        const effective = service.snapshot(display, settings);
        facts.draft = draft(effective); facts.revision = effective.revision; facts.hasDisplay = raw !== null;
        const selected = resolveProfile(display, profiles, { kind: 'project', path: project });
        facts.notes.push(text('setup.target', { path: context.configDir, profiles: profiles.profiles.length, bindings: profiles.bindings.length }));
        if (selected.configuration.profile_id) facts.notes.push(text('setup.bound_project', { name: selected.configuration.profile_name, path: selected.configuration.project_root }));
        facts.checks.push({ level: 'OK', message: text('setup.display_valid') });
    }, true);
    check(() => {
        const modes = loadRuntime(context.configDir, context.io);
        facts.notes.push(text('setup.preferences', { native: text('values.' + (loadNative(context.configDir, undefined, undefined, context.io) ? 'on' : 'off')),
            external: text('values.' + (loadFeature(context.configDir, undefined, context.io) ? 'on' : 'off')), timing: text('values.' + (modes.native_timing ? 'on' : 'off')), live: text('values.' + (modes.live_metrics ? 'on' : 'off')) }));
    });
    check(() => {
        for (const spec of [NATIVE, RUNTIME]) {
            const marker = owner(context.configDir, spec, context.io, true);
            if (marker) ownedArtifacts.push(...Object.keys(marker.files).map(name => join(context.configDir, spec.name, name)));
        }
        const planned = install(context, { dryRun: true });
        facts.resources = planned.changedPaths;
        facts.notes.push(text('setup.plugins', { native: text('setup.value.' + (planned.nativeState ?? 'unknown')) }));
        facts.checks.push({ level: 'OK', message: text('setup.ownership') });
    });
    const displayPaths = new Set([CONFIG_FILENAME, 'settings.json', PROFILES_FILENAME].map(path => join(context.configDir, path)));
    const paths = new Set([FEATURE_FILENAME, NATIVE_FILENAME, RUNTIME_FILENAME, BINDING_FILE,
        ...[SKILL, EXTERNAL].flatMap(name => ['skills/' + name + '/SKILL.md', 'skills/' + name + '/' + OWNER_FILE]),
        ...[NATIVE, RUNTIME].flatMap(spec => [spec.name, spec.name + '/' + OWNER_FILE])].map(path => join(context.configDir, path)));
    for (const path of ownedArtifacts) paths.add(path);
    for (const path of facts.resources) paths.add(path);
    // Foreign integration paths can block integration without blocking a safe display save.
    for (const path of displayPaths) check(() => { facts.fingerprints[path] = fingerprint(context, path); }, true);
    for (const path of paths) if (!displayPaths.has(path)) check(() => { facts.fingerprints[path] = fingerprint(context, path); });
    facts.canSave &&= facts.draft !== null;
    facts.canIntegrate &&= facts.canSave;
    return facts;
}
export function assertSetupUnchanged(context: InstallContext, inspection: SetupInspection, displaySaved = false): void {
    assertClear(context.configDir);
    for (const [path, before] of Object.entries(inspection.fingerprints)) {
        if (displaySaved && path === join(context.configDir, CONFIG_FILENAME)) continue;
        if (fingerprint(context, path) !== before) throw new ConfigError('setup.conflict', {}, 'configuration_conflict');
    }
}
export interface SetupApplied {
    stage: 'review' | 'display' | 'integration' | 'verified';
    saved: MutationResult | null;
    installed: ChangeResult | null;
    error: string | LocalizedText | null;
    checks: ReturnType<typeof doctor>;
}
/** Display and integration have separate durable commits; partial success is never called rollback. */
export function applySetup(context: InstallContext, inspection: SetupInspection, candidate: Draft, integrate: boolean,
    report: (stage: 'display' | 'integration') => void = () => {}): SetupApplied {
    const result: SetupApplied = { stage: 'review', saved: null, installed: null, error: null, checks: [] };
    try {
        if (!inspection.canSave || integrate && !inspection.canIntegrate || !inspection.revision) throw new ConfigError('setup.blocked', {}, 'setup_blocked');
        assertSetupUnchanged(context, inspection);
        result.saved = configurationService(context).saveDisplay(candidate.display, inspection.revision, () => assertSetupUnchanged(context, inspection));
        result.stage = 'display'; report('display');
        if (!integrate) return result;
        result.installed = install(context, { beforeCommit: () => {
            assertSetupUnchanged(context, inspection, true);
            if (hash(context.io.read(join(context.configDir, CONFIG_FILENAME))) !== hash(jsonBytes(result.saved!.effective.display)))
                throw new ConfigError('setup.conflict', {}, 'configuration_conflict');
        } });
        result.stage = 'integration'; report('integration');
        if (result.installed.failed) throw new ConfigError('setup.integration_failed', {}, 'setup_integration_failed');
        result.checks = doctor(context);
        if (result.checks.some(row => row.level === 'ERROR')) throw new ConfigError('setup.verification_failed', {}, 'setup_verification_failed');
        result.stage = 'verified';
    } catch (error) { result.error = message(error); }
    return result;
}
