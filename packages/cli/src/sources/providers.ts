import type { SourceDefinition, SourceContext, SourceObservation } from '@fbincon/statusline-core/contracts/ui';
import { parseObservation, emptyObservation, scalar, sourceError } from '@fbincon/statusline-core/extensions/model';
import { ConfigError, object } from '@fbincon/statusline-core/config/validation';
import { readJson } from '@fbincon/statusline-core/json-read';
import { decodeUtf8 } from '@fbincon/statusline-platform/utf8';
import { readSourceFile } from '@fbincon/statusline-platform/source-files';
import { runSourceProcess, type SourceProcessOptions, type SourceProcessResult } from '@fbincon/statusline-platform/source-process';
import { authRevision } from './context.js';
export function failure(source: SourceDefinition, context: SourceContext, error: unknown): SourceObservation {
    return emptyObservation(source, context, error instanceof ConfigError ? error.code : 'read_error');
}
export function readLocal(source: SourceDefinition, context: SourceContext): SourceObservation {
    try {
        const bytes = readSourceFile(source.settings.path!);
        if (bytes === null)
            return emptyObservation(source, context, 'missing_file', 'missing');
        return parseObservation(readJson(decodeUtf8(bytes), { duplicate: () => sourceError('invalid'), constant: () => sourceError('type') }), source, context);
    }
    catch (error) {
        return failure(source, context, error);
    }
}
export type SourceRunner = (options: SourceProcessOptions) => Promise<SourceProcessResult>;
export async function refreshCommand(source: SourceDefinition, context: SourceContext, signal: AbortSignal, run: SourceRunner = runSourceProcess): Promise<SourceObservation> {
    const s = source.settings;
    const input = Object.fromEntries(Object.entries(s.input ?? {}).map(([key, field]) => [key, context[field as keyof SourceContext]]));
    const result = await run({ executable: s.executable!, args: s.args!, cwd: s.cwd!, input: JSON.stringify(input) + '\n', timeoutMs: s.timeout_ms!, signal });
    if (result.reason !== 'completed')
        return emptyObservation(source, context, result.reason);
    try {
        if (s.output === 'json')
            return parseObservation(readJson(result.stdout, { duplicate: () => sourceError('invalid_output'), constant: () => sourceError('type') }), source, context, true);
        return { ...emptyObservation(source, context, 'valid', 'valid'), value: scalar(result.stdout.trimEnd()), observed_at: new Date().toISOString() };
    }
    catch (error) {
        return failure(source, context, error);
    }
}
export function checkSummary(value: unknown): string {
    if (!Array.isArray(value))
        return 'unknown';
    if (!value.length)
        return 'no_checks';
    const buckets = value.map(item => object(item) && typeof item.bucket === 'string' ? item.bucket : 'unknown');
    if (buckets.includes('fail'))
        return 'failure';
    if (buckets.includes('pending'))
        return 'pending';
    if (buckets.includes('cancel'))
        return 'cancelled';
    if (buckets.some(bucket => !['pass', 'skipping'].includes(bucket)))
        return 'unknown';
    return buckets.includes('pass') ? 'success' : 'skipped';
}
export async function refreshGithub(source: SourceDefinition, context: SourceContext, signal: AbortSignal, run: SourceRunner = runSourceProcess): Promise<SourceObservation> {
    const s = source.settings, start = performance.now(), fingerprint = authRevision();
    const result = emptyObservation(source, context, 'not_refreshed');
    if (!context.head)
        return { ...result, state: 'unsupported', reason: 'not_repository' };
    if (!context.branch)
        return { ...result, state: 'unsupported', reason: 'detached' };
    if (context.branch !== s.branch)
        return { ...result, state: 'missing', reason: 'identity' };
    const repo = s.host + '/' + s.repository;
    const invoke = async (args: string[], checks = false): Promise<unknown> => {
        const remaining = 30000 - (performance.now() - start);
        if (remaining <= 0)
            sourceError('timeout');
        const response = await run({ executable: 'gh', args, cwd: context.project!, input: '', timeoutMs: remaining, signal,
            environment: { ...process.env, GH_PROMPT_DISABLED: '1', GH_PAGER: 'cat', GIT_TERMINAL_PROMPT: '0', GH_BROWSER: '' } });
        if (response.reason !== 'completed' && !(checks && response.reason === 'exit' && [1, 8].includes(response.code ?? -1) && !response.errorKind))
            sourceError(response.errorKind ?? (response.reason === 'exit' ? 'lookup_failed' : response.reason));
        try {
            return JSON.parse(response.stdout);
        }
        catch {
            return sourceError('invalid_output');
        }
    };
    try {
        const user = await invoke(['api', '--hostname', s.host!, 'user']);
        if (!object(user) || user.login !== s.account)
            sourceError('account');
        const fields = 'number,url,headRefOid,headRefName,reviewDecision';
        const data = s.pr ? [await invoke(['pr', 'view', String(s.pr), '--repo', repo, '--json', fields])] : await invoke(['pr', 'list', '--repo', repo, '--head', s.branch!, '--state', 'open', '--limit', '100', '--json', fields]);
        if (!Array.isArray(data) || data.some(pr => !object(pr)))
            sourceError('invalid_output');
        if (authRevision() !== fingerprint)
            sourceError('identity');
        if (!data.length)
            return { ...result, state: 'valid', reason: 'no_pr', value: 'no_pr', observed_at: new Date().toISOString(), fields: { ci: 'no_pr' }, identity: { host: s.host!, repository: s.repository!, account: s.account!, auth_revision: fingerprint } };
        if (data.length !== 1)
            sourceError('ambiguous');
        const pr = data[0] as Record<string, unknown>;
        if (pr.headRefName !== context.branch || pr.headRefOid !== context.head)
            sourceError('identity');
        if (typeof pr.number !== 'number' || !Number.isSafeInteger(pr.number) || pr.number < 1)
            sourceError('invalid_output');
        const url = `https://${s.host}/${s.repository}/pull/${pr.number}`;
        if (pr.url !== url)
            sourceError('identity');
        const checks = await invoke(['pr', 'checks', String(pr.number), '--repo', repo, '--json', 'bucket,name,link,state'], true);
        const after = await invoke(['pr', 'view', String(pr.number), '--repo', repo, '--json', 'headRefOid']);
        if (!object(after) || after.headRefOid !== context.head || authRevision() !== fingerprint)
            sourceError('identity');
        const ci = checkSummary(checks);
        return { ...result, state: ci === 'unknown' ? 'partial' : 'valid', reason: ci === 'unknown' ? 'unknown_checks' : 'valid', value: pr.number, observed_at: new Date().toISOString(),
            fields: { pr: pr.number, review: typeof pr.reviewDecision === 'string' ? scalar(pr.reviewDecision) : '', ci, url, ci_url: url + '/checks' },
            identity: { host: s.host!, repository: s.repository!, account: s.account!, auth_revision: fingerprint } };
    }
    catch (error) {
        return failure(source, context, error);
    }
}
