import * as fs from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PackageError } from '@fbincon/statusline-core/management/package';
import { isPackageRequest, isPackageResult } from '@fbincon/statusline-core/editor/package-validation';
import type { PackageReviewJob, PackageReviewRequest } from '@fbincon/statusline-core/contracts/ui';
import { atomicWrite, privateDirectory } from '@fbincon/statusline-platform/files';
import { productRoot, productIdentity } from '@fbincon/statusline-platform/npm';
import { copyPackage } from '@fbincon/statusline-platform/package-copy';
import { startReviewWorker, waitReviewExit } from '@fbincon/statusline-platform/review-worker';
import { processAlive } from '@fbincon/statusline-platform/processes';
import { removeTree } from '@fbincon/statusline-platform/remove-tree';
import { readPrivateState } from '@fbincon/statusline-platform/private-state';
import { safeTarget } from '../integration/paths.js';
import { inspectPackage, type InspectionContext } from './inspection.js';
export interface ReviewRecord {
    job: PackageReviewJob;
    configDir: string;
    origin: string;
    pid: number | null;
    token: string | null;
    launched_at?: string;
}
export const REVIEW_DEADLINE_MS = 10 * 60 * 1000;
export function reviewFolder(id: string): string {
    if (!/^review-[0-9a-f-]{36}$/u.test(id))
        throw new PackageError('arguments');
    const root = fs.realpathSync.native(tmpdir()), folder = join(root, 'claude-statusline-' + id);
    safeTarget(root, folder);
    return folder;
}
export function readReviewRecord(id: string): ReviewRecord {
    const folder = reviewFolder(id), path = join(folder, 'job.json');
    safeTarget(folder, path);
    const value = JSON.parse(readPrivateState(path, 1024 * 1024).toString('utf8')) as ReviewRecord;
    if (!isPackageResult('package_review_status', value.job) || value.job.id !== id || typeof value.configDir !== 'string' || typeof value.origin !== 'string' ||
        !(value.pid === null || Number.isSafeInteger(value.pid) && value.pid > 0) || !(value.token === null || typeof value.token === 'string') ||
        value.launched_at !== undefined && (typeof value.launched_at !== 'string' || !Number.isFinite(Date.parse(value.launched_at))))
        throw new PackageError('journal');
    return value;
}
export function writeReviewRecord(record: ReviewRecord): void { atomicWrite(join(reviewFolder(record.job.id), 'job.json'), JSON.stringify(record) + '\n'); }
export function startPackageReview(context: InspectionContext, request: unknown, owner: unknown): PackageReviewJob {
    if (!isPackageRequest(request) || typeof owner !== 'string' || !/^viewer-[a-z0-9-]{10,100}$/u.test(owner))
        throw new PackageError('arguments');
    if (inspectPackage(context, request.prefix).revision !== request.expected_revision)
        throw new PackageError('conflict');
    const job: PackageReviewJob = { version: 1, id: 'review-' + randomUUID(), owner, state: 'running', started_at: new Date().toISOString(), finished_at: null, request, review: null, error: null };
    const folder = reviewFolder(job.id);
    privateDirectory(folder);
    const record: ReviewRecord = { job, configDir: context.configDir, origin: context.origin, pid: null, token: null };
    try {
        writeReviewRecord(record);
        let entry = fileURLToPath(new URL('./review-worker-entry.js', import.meta.url));
        const origin = productRoot(context.origin);
        if (origin) {
            const runner = join(folder, 'runner');
            copyPackage(origin, runner);
            if (!productIdentity(runner))
                throw new PackageError('identity');
            entry = join(runner, 'node_modules/@fbincon/statusline-cli/dist/src/management/review-worker-entry.js');
        }
        // Runner preparation is part of the overall deadline, but not worker
        // startup grace: an installed copy can take longer than fifteen seconds.
        record.launched_at = new Date().toISOString();
        writeReviewRecord(record);
        startReviewWorker(entry, [job.id], folder);
        return job;
    }
    catch (error) {
        removeTree(folder);
        throw error;
    }
}
export function packageReviewJob(context: InspectionContext, id: unknown, owner: unknown, cancel = false): PackageReviewJob {
    if (typeof id !== 'string' || typeof owner !== 'string')
        throw new PackageError('arguments');
    const readOwned = () => {
        const current = readReviewRecord(id);
        if (current.configDir !== context.configDir || current.job.owner !== owner)
            throw new PackageError('identity');
        return current;
    };
    let record = readOwned(), job = record.job;
    if (cancel) {
        atomicWrite(join(reviewFolder(id), 'cancel.json'), '{}\n');
        const stopped = waitReviewExit(() => {
            const latest = readReviewRecord(id);
            return !!latest.pid && !!latest.token && processAlive(latest.pid, latest.token) === false;
        });
        if (stopped) {
            const finished = readReviewRecord(id).job;
            removeTree(reviewFolder(id));
            return {...finished, state:'cancelled', finished_at:new Date().toISOString()};
        }
        // Cancellation was requested, but a live/unverifiable executor still owns its files.
        return readReviewRecord(id).job;
    }
    if (reviewInterrupted(record)) {
        // A bounded snapshot can precede the worker's final atomic publication.
        // Reconcile after observing exit before deriving an interruption from it.
        record = readOwned();
        job = record.job;
        if (reviewInterrupted(record))
            return { ...job, state: 'failed', error: 'interrupted', finished_at: new Date().toISOString() };
    }
    if (job.state === 'complete' && inspectPackage(context, job.request.prefix).revision !== job.request.expected_revision)
        return { ...job, state: 'failed', review: null, error: 'conflict' };
    return job;
}
function reviewInterrupted(record: ReviewRecord): boolean {
    return record.job.state === 'running' && (Date.now() - Date.parse(record.job.started_at) > REVIEW_DEADLINE_MS ||
        Date.now() - Date.parse(record.launched_at ?? record.job.started_at) > 15000 &&
        (!record.pid || !!record.token && processAlive(record.pid, record.token) === false));
}
