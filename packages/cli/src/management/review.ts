import type { PackageReviewRequest, PackageReviewView } from '@fbincon/statusline-core/contracts/ui';
import { PackageError } from '@fbincon/statusline-core/management/package';
import { manage, type ManagementEnvironment } from './service.js';
import { inspectPackage, type InspectionContext } from './inspection.js';
/** The only adapter used by editor jobs: every branch is check or dry-run. */
export async function reviewPackage(request: PackageReviewRequest, context: InspectionContext, environment: Partial<ManagementEnvironment> = {}): Promise<PackageReviewView> {
    const current = inspectPackage(context, request.prefix);
    if (current.revision !== request.expected_revision)
        throw new PackageError('conflict');
    let result: PackageReviewView | null = null, failure: string | null = null;
    const command = request.action === 'check' ? 'update' : request.action === 'recover-package' || request.action === 'restore-config' ? 'recover' : request.action;
    const args = [command, '--prefix', request.prefix, '--config-dir', context.configDir, '--json', request.action === 'check' ? '--check' : '--dry-run'];
    if (request.action === 'recover-package')
        args.push('--package');
    if (request.action === 'restore-config')
        args.push('--restore-config', request.backup_id!);
    else if (request.target)
        args.push('--version', request.target);
    else if (request.channel && command === 'update')
        args.push('--channel', request.channel);
    const code = await manage(args, { ...environment, origin: context.origin, host: context.hostVersion, stdout: () => { }, stderr: () => { },
        review(value) {
            if (value.action !== 'restore-config' && request.expected_integrity && value.integrity !== request.expected_integrity)
                throw new PackageError('integrity');
            result = value.action === 'restore-config' ? {
                action: request.action, current: current.current, target: value.source_version, prefix: request.prefix, entry: current.entry, config_dir: context.configDir,
                channel: current.channel, registry: null, integrity: null, node_engine: null, host: current.host, artifact_verified: false, compatible: true,
                reasons: [], configuration_conflicts: [], backup_id: value.backup_id, files: value.files.map(file => file.path),
            } : { action: request.action, current: value.current, target: value.target, prefix: value.prefix, entry: value.entry, config_dir: value.config_dir,
                channel: value.channel, registry: value.registry, integrity: value.integrity, node_engine: value.node_engine, host: value.host,
                artifact_verified: value.artifact_verified, compatible: value.compatible, reasons: [...value.reasons], configuration_conflicts: [...value.configuration_conflicts], backup_id: value.backup_id, files: [] };
        }, failure: reason => { failure = reason; },
    });
    if (failure || !result)
        throw new PackageError(failure ?? 'metadata');
    const review = result as PackageReviewView;
    if (request.expected_integrity && review.integrity !== request.expected_integrity)
        throw new PackageError('integrity');
    if (inspectPackage(context, request.prefix).revision !== request.expected_revision)
        throw new PackageError('conflict');
    if (code !== 0 && review.compatible)
        throw new PackageError('io_error');
    return review;
}
