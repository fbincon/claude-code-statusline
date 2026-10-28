import { phaseMarker } from '@fbincon/statusline-platform/performance';
import * as fs from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { PackageError, type PackageIdentity, type PackageReview } from '@fbincon/statusline-core/management/package';
import { compatibility, compareVersions, runtimeCompatibility } from '@fbincon/statusline-core/management/compatibility';
import { t, type Language } from '@fbincon/statusline-core/i18n/messages';
import { Npm, productIdentity, productRoot, writablePrefix, within, verifyArchive, globalPackageRoot, type NpmLayout, type RegistryPackage } from '@fbincon/statusline-platform/npm';
import { lock, atomicWrite } from '@fbincon/statusline-platform/files';
import { copyPackage } from '@fbincon/statusline-platform/package-copy';
import { removeTree } from '@fbincon/statusline-platform/remove-tree';
import { detectClaudeVersion, resolvedPath, which, sameLaunchEntry } from '@fbincon/statusline-platform/commands';
import { readPreferences } from '../config/preferences.js';
import { createStorage } from '../config/storage.js';
import { previousBinding } from '../integration/ownership.js';
import { assertClear } from '../recovery/journal.js';
import { safeTarget } from '../integration/paths.js';
import { managementOptions, type ManagementOptions } from './arguments.js';
import { confirmPackage } from './first-entry.js';
import { pendingPath, startOperation, saveOperation, recordInstallation, finishOperation, operationPath, readInstallation, readOperation, observeOperation, type PackageOperation } from './store.js';
import { configurationBytes, configurationHashes, configurationCompatibility, assertConfiguration, saveSnapshot, type ConfigHashes } from './configuration.js';
import { refreshIntegration } from './integration.js';
import { restoreConfiguration } from './restore.js';
import { ArgumentError } from '../config/arguments.js';
import { processMatches } from '@fbincon/statusline-platform/processes';
export interface ManagementEnvironment {
    origin: string;
    signal?: AbortSignal;
    review?: (review: PackageReview | import('./restore.js').ConfigurationRestoreReview) => void;
    failure?: (reason: string) => void;
    stdout: (text: string) => void;
    stderr: (text: string) => void;
    environment?: NodeJS.ProcessEnv;
    tty?: boolean;
    npm?: Npm;
    confirm?: () => Promise<boolean>;
    host?: () => readonly number[] | null;
    integrate?: typeof refreshIntegration;
    checkpoint?: (stage: string, operation: PackageOperation) => void;
}
export function mutationAuthorized(flags: ManagementOptions, tty: boolean): void {
    if (flags.check || flags.dryRun)
        return;
    if (!tty && (!flags.yes || !flags.prefix || !flags.restoreConfig && !flags.version))
        throw new PackageError('noninteractive');
}
function currentPackage(layout: NpmLayout): PackageIdentity {
    const current = productIdentity(layout.root, layout.prefix);
    if (!current)
        throw new PackageError('not_installed');
    return current;
}
function sameIdentity(current: PackageIdentity, before: PackageIdentity): boolean {
    return current.version === before.version && current.root === before.root && current.entry === before.entry && current.prefix === before.prefix && current.inventory_sha256 === before.inventory_sha256;
}
function selection(flags: ManagementOptions, before: PackageIdentity, history: ReturnType<typeof readInstallation>): {
    selector: string;
    channel: 'latest' | 'beta' | null;
} {
    if (flags.version)
        return { selector: flags.version, channel: flags.command === 'rollback' ? history?.previousChannel ?? (flags.version.includes('-') ? null : 'latest') : history?.channel ?? (flags.version.includes('-') ? null : 'latest') };
    if (flags.command === 'rollback') {
        if (!history?.previous || history.current.version !== before.version)
            throw new PackageError('no_previous');
        return { selector: history.previous.version, channel: history.previousChannel ?? (history.previous.version.includes('-') ? null : 'latest') };
    }
    const channel = flags.channel ?? history?.channel ?? (before.version.includes('-') ? null : 'latest');
    if (!channel)
        throw new PackageError('channel');
    return { selector: channel, channel };
}
function installedCompatibility(current: PackageIdentity) {
    const manifest = JSON.parse(fs.readFileSync(join(current.root, 'package.json'), 'utf8'));
    return compatibility(manifest.statuslineCompatibility, current.version);
}
function observedPackage(layout: NpmLayout, operation: PackageOperation): {
    identity: PackageIdentity | null;
    state: string;
} {
    if (operation.executors?.some(p => processMatches(p.pid, p.token)))
        throw new PackageError('busy');
    try {
        const identity = productIdentity(layout.root, layout.prefix);
        if (identity && ![operation.before?.version, operation.version].includes(identity.version))
            throw new PackageError('conflict');
        return { identity, state: identity?.version ?? 'absent' };
    }
    catch (error) {
        if (error instanceof PackageError && error.code === 'conflict')
            throw error;
        const manifest = join(layout.root, 'package.json');
        if (fs.existsSync(manifest)) {
            const value = JSON.parse(fs.readFileSync(manifest, 'utf8'));
            if (value.name !== '@fbincon/claude-code-statusline' || ![operation.version, operation.before?.version].includes(value.version))
                throw new PackageError('identity');
        }
        return { identity: null, state: 'incomplete' };
    }
}
function targetIntegration(configDir: string, before: PackageIdentity, flags: ManagementOptions, origin: string, layout: NpmLayout, env: NodeJS.ProcessEnv): boolean {
    const binding = previousBinding(configDir, createStorage()), launch = { executable: process.execPath, args: [before.entry] };
    if (binding && (binding.args.length !== 1 || resolvedPath(binding.args[0]!) !== resolvedPath(before.entry)))
        throw new PackageError('prefix_ambiguous');
    if (!flags.prefix) {
        const active = which('claude-statusline', env);
        if (active && !sameLaunchEntry(active, launch))
            throw new PackageError('prefix_ambiguous');
        if (!within(origin, layout.cache)) {
            const originIdentity = productIdentity(origin);
            if (originIdentity && origin !== before.root && origin.includes(process.platform === 'win32' ? 'node_modules' : 'lib/node_modules'))
                throw new PackageError('prefix_ambiguous');
        }
    }
    return binding !== null;
}
export async function manage(argv: readonly string[], options: ManagementEnvironment): Promise<number> {
    const mark = phaseMarker();
    const { stdout, stderr } = options, environment = options.environment ?? process.env;
    let flags: ManagementOptions | undefined, language: Language = 'en', temporary: string | undefined, release: (() => void) | undefined, operation: PackageOperation | undefined;
    const controller = new AbortController(), cancel = () => controller.abort();
    options.signal?.addEventListener('abort',cancel,{once:true});
    if(options.signal?.aborted)controller.abort();
    process.on('SIGINT', cancel);
    process.on('SIGTERM', cancel);
    try {
        flags = managementOptions(argv);
        const requestedDirectory = flags.configDir ?? environment.CLAUDE_CONFIG_DIR;
        const configDir = resolvedPath(requestedDirectory?.trim() ? requestedDirectory : '~/.claude');
        language = flags.language ?? readPreferences(configDir, createStorage()).ui_language;
        mutationAuthorized(flags, options.tty ?? !!(process.stdin.isTTY && process.stdout.isTTY));
        if (flags.restoreConfig && flags.prefix) {
            const prefix = resolvedPath(flags.prefix);
            if (within(configDir, globalPackageRoot(prefix)))
                throw new PackageError('prefix');
            return await restoreConfiguration(flags, configDir, prefix, language, stdout, options.confirm, controller.signal, options.review);
        }
        const npm = options.npm ?? new Npm(environment, undefined, undefined, controller.signal), layout = await npm.layout(flags.prefix);
        if (within(configDir, layout.root))
            throw new PackageError('prefix');
        if (flags.restoreConfig)
            return await restoreConfiguration(flags, configDir, layout.prefix, language, stdout, options.confirm, controller.signal, options.review);
        let before: PackageIdentity | null = null;
        if (!flags.package)
            before = currentPackage(layout);
        const recordedHistory = readInstallation(configDir, layout.prefix);
        const history = flags.package || before && recordedHistory && sameIdentity(before, recordedHistory.current) ? recordedHistory : null;
        if (before && history)
            before = { ...before, integrity: history.current.integrity, registry: history.current.registry };
        let target: RegistryPackage, channel: 'latest' | 'beta' | null, integrated: boolean, host: readonly number[] | null, hashes: ConfigHashes, observed: string | null = null;
        if (flags.package) {
            operation = readOperation(configDir, layout.prefix);
            if (flags.version && flags.version !== operation.version)
                throw new PackageError('version');
            observed = observedPackage(layout, operation).state;
            before = operation.before;
            target = operation.target ?? await npm.metadata(operation.version, { ...layout, registry: operation.registry });
            channel = operation.channel ?? null;
            integrated = operation.integrated ?? false;
        }
        else {
            if (fs.existsSync(pendingPath(layout.prefix)))
                throw new PackageError('pending');
            await npm.verify(before!, layout.bin);
            installedCompatibility(before!);
            integrated = targetIntegration(configDir, before!, flags, options.origin, layout, environment);
            const selected = selection(flags, before!, history);
            channel = selected.channel;
            target = await npm.metadata(selected.selector, layout);
            if (flags.command === 'rollback' && !flags.version && history?.previous?.integrity && target.integrity !== history.previous.integrity)
                throw new PackageError('integrity');
            const direction = compareVersions(target.version, before!.version);
            if (flags.command === 'update' && direction < 0)
                throw new PackageError('use_rollback');
            if (flags.command === 'rollback' && direction >= 0)
                throw new PackageError('rollback_direction');
        }
        host = integrated ? (options.host ?? detectClaudeVersion)() : null;
        const bytes = configurationBytes(configDir);
        hashes = configurationHashes(bytes);
        const configReasons = configurationCompatibility(bytes, target.compatibility);
        const reasons = runtimeCompatibility(target.compatibility, process.versions.node, process.platform + '-' + process.arch, host?.join('.') ?? null, integrated);
        if (!await npm.nodeCompatible(target.nodeEngine) && !reasons.includes('runtime'))
            reasons.push('runtime');
        if (configReasons.length)
            reasons.push('configuration');
        const review: PackageReview = { schema_version: 1, action: flags.package ? 'recover-package' : flags.command as 'update' | 'rollback', current: before?.version ?? null, observed_package: observed ?? before?.version ?? null, target: target.version, registry: target.registry, prefix: layout.prefix, entry: join(layout.root, 'node_modules/@fbincon/statusline-cli/dist/src/entry.js'), node: process.execPath, npm_entry: npm.entry, config_dir: configDir, node_version: process.versions.node, node_engine: target.nodeEngine, host: host?.join('.') ?? null, channel, integrated, compatibility: target.compatibility, integrity: target.integrity, compatible: !reasons.length, reasons, configuration_conflicts: configReasons, backup_id: operation?.id ?? history?.transaction ?? null, artifact_verified: false };
        options.review?.(review);
        if (flags.check) {
            stdout(JSON.stringify(review, null, 2) + '\n');
            return reasons.length ? 2 : 0;
        }
        if (reasons.length) {
            stdout(JSON.stringify(review, null, 2) + '\n');
            if (!flags.json)
                stderr(t('package.reason_' + reasons[0], language) + '\n');
            return 2;
        }
        if (!flags.package && target.version === before!.version && !(flags.dryRun && options.review)) {
            stdout(flags.json ? JSON.stringify({ ...review, unchanged: true }) + '\n' : t('management.current', language, { version: target.version }) + '\n');
            return 0;
        }
        assertClear(configDir, true);
        temporary = fs.realpathSync.native(fs.mkdtempSync(join(tmpdir(), 'claude-statusline-operation-')));
        fs.chmodSync(temporary, 0o700);
        let archive: string;
        if (operation?.archive) {
            archive = join(dirname(operationPath(operation)), operation.archive);
            safeTarget(configDir, archive);
            verifyArchive(archive, target);
        }
        else
            archive = await npm.download(target, join(temporary, 'download'));
        const staging = join(temporary, 'staging');
        await npm.installArchive(archive, staging);
        const staged = await npm.validateStaged(staging, target);
        if (flags.command === 'rollback' && !flags.version && history?.previous?.inventory_sha256 && staged.inventory_sha256 !== history.previous.inventory_sha256)
            throw new PackageError('integrity');
        const expected = { ...staged, prefix: layout.prefix, root: layout.root, entry: review.entry };
        if (integrated)
            await (options.integrate ?? refreshIntegration)(staged.root, expected, configDir, host, hashes, temporary, true, environment, controller.signal);
        review.artifact_verified = true;
        options.review?.(review);
        if (!flags.json)
            stdout(t('management.review', language) + '\n');
        stdout(JSON.stringify(review, null, 2) + '\n');
        if (flags.dryRun)
            return 0;
        writablePrefix(layout.prefix);
        if (!flags.yes && !await (options.confirm?.() ?? confirmPackage(language, stdout, controller.signal))) {
            stdout(t('package.cancelled', language) + '\n');
            return 0;
        }
        if (controller.signal.aborted)
            throw new PackageError('interrupted');
        release = lock(join(layout.prefix, '.claude-statusline-install.lock'), true);
        assertConfiguration(configDir, hashes);
        assertClear(configDir, true);
        const actual = flags.package ? observedPackage(layout, operation!) : { identity: productIdentity(layout.root, layout.prefix), state: null };
        const installed = actual.identity;
        if (flags.package) {
            const recorded = readOperation(configDir, layout.prefix);
            if (recorded.id !== operation!.id || actual.state !== observed)
                throw new PackageError('conflict');
            operation = recorded;
        }
        else {
            if (!installed || !sameIdentity(installed, before!) || fs.existsSync(pendingPath(layout.prefix)))
                throw new PackageError('conflict');
            operation = startOperation(configDir, layout.prefix, target.version, target.registry, before, flags.command as 'update' | 'rollback');
            operation.snapshot = createStorage().lock(configDir, () => { assertConfiguration(configDir, hashes); return saveSnapshot(configDir, dirname(operationPath(operation!)), bytes); });
            operation.beforeCompatibility = installedCompatibility(before!);
            operation.previousChannel = history?.channel ?? null;
        }
        if (operation.before && !operation.snapshot) {
            if (!installed || installed.version !== operation.before.version)
                throw new PackageError('backup');
            operation.snapshot = createStorage().lock(configDir, () => { assertConfiguration(configDir, hashes); return saveSnapshot(configDir, dirname(operationPath(operation!)), bytes); });
            operation.beforeCompatibility = installedCompatibility(installed);
        }
        const runnerRoot = productRoot(fileURLToPath(import.meta.url)), recoveryRunner = join(dirname(operationPath(operation)), 'recovery-runner');
        if (runnerRoot && !fs.existsSync(recoveryRunner)) {
            safeTarget(configDir, recoveryRunner);
            const staging = fs.mkdtempSync(join(dirname(recoveryRunner), '.runner-'));
            try {
                const copied = join(staging, 'package');
                copyPackage(runnerRoot, copied);
                if (!productIdentity(copied))
                    throw new PackageError('identity');
                fs.renameSync(copied, recoveryRunner);
            }
            finally {
                removeTree(staging);
            }
        }
        operation.target = target;
        operation.channel = channel;
        operation.integrated = integrated;
        const savedArchive = join(dirname(operationPath(operation)), 'target.tgz');
        safeTarget(configDir, savedArchive);
        if (archive !== savedArchive)
            atomicWrite(savedArchive, fs.readFileSync(archive));
        operation.archive = 'target.tgz';
        operation.results = { package: false, integration: false };
        saveOperation(operation);
        const observeProcess = observeOperation(operation);
        npm.onProcess = observeProcess;
        mark('reviewed');
        options.checkpoint?.('reviewed', operation);
        verifyArchive(savedArchive, target);
        if (installed?.version !== target.version) {
            operation.stage = 'installing';
            saveOperation(operation);
            mark('installing');
            options.checkpoint?.('installing', operation);
            await npm.installArchive(savedArchive, layout.prefix);
        }
        operation.after = await npm.validateStaged(layout.prefix, target);
        operation.stage = 'package_verified';
        operation.results.package = true;
        saveOperation(operation);
        mark('package-verified');
        options.checkpoint?.('package_verified', operation);
        assertConfiguration(configDir, hashes);
        if (integrated) {
            operation.stage = 'integrating';
            saveOperation(operation);
            mark('integrating');
            options.checkpoint?.('integrating', operation);
            await (options.integrate ?? refreshIntegration)(layout.root, operation.after, configDir, host, hashes, temporary, false, environment, controller.signal, observeProcess);
        }
        operation.after = await npm.validateStaged(layout.prefix, target);
        operation.results.integration = true;
        saveOperation(operation);
        recordInstallation(operation);
        finishOperation(operation);
        mark('complete');
        stdout(t('management.complete', language, { version: target.version, prefix: layout.prefix, backup: operation.snapshot ? operation.id : '—' }) + '\n');
        if (runnerRoot)
            stdout(t('management.runner', language, { entry: join(recoveryRunner, 'bin/claude-statusline.js') }) + '\n');
        return 0;
    }
    catch (error) {
        const reason = error instanceof PackageError ? error.code : error instanceof ArgumentError ? 'arguments' : 'io_error';
        if (operation && operation.stage !== 'complete' && release) {
            operation.stage = 'uncertain';
            if (operation.results)
                operation.results.error = reason;
            try {
                saveOperation(operation);
            }
            catch { /* Preserve the last durable phase if the journal volume is unavailable. */ }
        }
        options.failure?.(reason);
        const message = t('package.reason_' + reason, language);
        if (flags?.json)
            stdout(JSON.stringify({ schema_version: 1, error: { code: reason, message } }) + '\n');
        else
            stderr(t('package.failure', language, { reason: message }) + '\n');
        if (operation && release)
            stderr(t('management.partial', language, { id: operation.id, version: operation.version, prefix: operation.prefix, config: operation.configDir, stage: operation.stage }) + '\n');
        return reason === 'interrupted' ? 130 : 2;
    }
    finally {
        options.signal?.removeEventListener('abort',cancel);
        release?.();
        process.off('SIGINT', cancel);
        process.off('SIGTERM', cancel);
        if (temporary)
            removeTree(temporary);
    }
}
