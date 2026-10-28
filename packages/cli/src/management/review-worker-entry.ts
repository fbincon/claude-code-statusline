import * as fs from 'node:fs';
import { join } from 'node:path';
import { detectClaudeVersion } from '@fbincon/statusline-platform/commands';
import { processToken } from '@fbincon/statusline-platform/processes';
import { readReviewRecord, writeReviewRecord, reviewFolder, REVIEW_DEADLINE_MS } from './review-jobs.js';
import { reviewPackage } from './review.js';
import { packageReason } from './inspection.js';
const id = process.argv[2]!, record = readReviewRecord(id), folder = reviewFolder(id), controller = new AbortController();
record.pid = process.pid;
record.token = processToken(process.pid);
writeReviewRecord(record);
const cancelled = () => fs.existsSync(join(folder, 'cancel.json'));
const watcher = setInterval(() => {
    if (cancelled() || Date.now() - Date.parse(record.job.started_at) > REVIEW_DEADLINE_MS)
        controller.abort();
}, 200);
try {
    if (cancelled())
        controller.abort();
    record.job.review = await reviewPackage(record.job.request, { configDir: record.configDir, origin: record.origin, hostVersion: detectClaudeVersion }, { signal: controller.signal });
    record.job.state = controller.signal.aborted ? 'cancelled' : 'complete';
}
catch (error) {
    record.job.state = controller.signal.aborted ? 'cancelled' : 'failed';
    record.job.error = packageReason(error);
}
finally {
    clearInterval(watcher);
    record.job.finished_at = new Date().toISOString();
    // The caller removes the independent runner only after this process exits.
    writeReviewRecord(record);
}
