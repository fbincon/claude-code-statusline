import { isAbsolute, join } from 'node:path';
import { detectClaudeVersion, parseClaudeVersion } from '@fbincon/statusline-platform/commands';
import { ObservationProcess } from '@fbincon/statusline-platform/observation-process';
import { runSourceProcess } from '@fbincon/statusline-platform/source-process';
import type { Operation, PackageControl, PackageExecution, ResultFor } from '@fbincon/statusline-core/contracts/ui';
import { BackendError, parseResponse, requestText } from '@fbincon/statusline-core/editor/backend';
import { text } from '@fbincon/statusline-core/i18n/messages';
import type { ObserveOperation } from '@fbincon/statusline-tui/session';
import type { ConfigurationContext } from '../config/service.js';
import type { RuntimeContext } from '../runtime/context.js';
import { MANAGEMENT_ROOT } from '../management/store.js';
import { isLocalRead, type ObservationMessage, type ObservationReply, type VerifyControlMessage } from './observation-message.js';

/** Installed editors can outlive their original package. Only a verified handoff supplies the control. */
export class EditorObservations {
    private readonly reader = new ObservationProcess(new URL('./observation-worker.js', import.meta.url));
    private readonly lifetime = new AbortController();
    private readonly activeReads = new Set<Promise<unknown>>();
    private execution?: Pick<PackageExecution, 'id' | 'control'>;

    constructor(private readonly context: ConfigurationContext, private readonly runtime?: RuntimeContext) {}

    remember<O extends Operation>(operation: O, result: ResultFor<O>): ResultFor<O> {
        const execution = operation === 'package_execute_start' ? result as PackageExecution
            : operation === 'package_status' ? (result as ResultFor<'package_status'>).execution : null;
        if (execution) this.execution = { id: execution.id, control: { ...execution.control, args: [...execution.control.args] } };
        return result;
    }

    private track<T>(request: Promise<T>): Promise<T> {
        this.activeReads.add(request);
        return request.finally(() => this.activeReads.delete(request));
    }

    control<O extends Operation>(control: PackageControl, operation: O, payload: unknown): Promise<ResultFor<O>> {
        return this.track(this.requestControl(control, operation, payload, this.lifetime.signal));
    }

    private async requestControl<O extends Operation>(control: PackageControl, operation: O, payload: unknown, signal: AbortSignal): Promise<ResultFor<O>> {
        signal.throwIfAborted();
        const saved = this.execution;
        if (!saved || !/^execution-[0-9a-f-]{36}$/u.test(saved.id) ||
            control.config_dir !== this.context.configDir || control.config_dir !== saved.control.config_dir ||
            control.executable !== saved.control.executable || !isAbsolute(control.executable) ||
            control.args.length !== 1 || control.args[0] !== saved.control.args[0]) {
            throw new BackendError('identity', text('package.reason_identity'));
        }
        if (operation === 'package_execute_status' || operation === 'package_execute_detach') {
            if (typeof payload !== 'object' || payload === null || !('id' in payload) || payload.id !== saved.id)
                throw new BackendError('identity', text('package.reason_identity'));
        }
        const entry = join(MANAGEMENT_ROOT, 'executions', saved.id, 'runner', 'bin', 'claude-statusline.js');
        if (control.args[0] !== join(control.config_dir, entry))
            throw new BackendError('identity', text('package.reason_identity'));
        const verify: VerifyControlMessage = { operation: 'verify_retained_control', configDir: this.context.configDir, id: saved.id, entry: control.args[0] };
        const verification = await this.reader.request(verify, signal) as ObservationReply;
        if (!('result' in verification) || verification.result !== true) throw new BackendError('identity', text('package.reason_identity'));
        signal.throwIfAborted();
        // Reconnected runs may record a different Node installation. Only the
        // verified, execution-owned JS is selected by state; this process supplies Node.
        const result = await runSourceProcess({ executable: process.execPath, args: [saved.control.args[0]!, 'ui', '--config-dir', saved.control.config_dir],
            cwd: process.cwd(), environment: process.env, input: requestText(operation, payload), timeoutMs: 30_000, signal });
        signal.throwIfAborted();
        return this.remember(operation, parseResponse(operation, { exitCode: result.code ?? 2, stdout: result.stdout, stderr: result.reason }));
    }

    read<O extends ObserveOperation>(operation: O, payload: unknown, signal: AbortSignal, control?: PackageControl): Promise<ResultFor<O>> {
        return this.track(this.query(operation, payload, AbortSignal.any([signal, this.lifetime.signal]), control));
    }

    private async query<O extends ObserveOperation>(operation: O, payload: unknown, signal: AbortSignal, control?: PackageControl): Promise<ResultFor<O>> {
        signal.throwIfAborted();
        if (operation === 'package_execute_status' && control) return this.requestControl(control, operation, payload, signal);
        if (!isLocalRead(operation) || control) throw new BackendError('unsupported_operation', 'Unsupported observation');
        const { configDir, launch, hostVersion } = this.context;
        const message: ObservationMessage = { operation, payload, configDir, launch };
        if (operation === 'task_details' && this.runtime)
            message.taskRuntime = { root: this.runtime.runtimeRoot, now: this.runtime.nowMs(), sample: this.runtime.sample() };
        const exchange = async () => {
            const reply = await this.reader.request(message, signal) as ObservationReply;
            signal.throwIfAborted();
            return reply;
        };
        let reply = await exchange();
        if ('hostProbe' in reply) {
            if (operation !== 'package_review_status') throw new Error('Unexpected observation probe');
            message.hostVersion = null;
            if (hostVersion !== detectClaudeVersion) message.hostVersion = hostVersion();
            else if (reply.hostProbe) {
                const probe = await runSourceProcess({ ...reply.hostProbe, args: [...reply.hostProbe.args, '--version'],
                    cwd: process.cwd(), environment: process.env, input: '', timeoutMs: 5000, signal });
                signal.throwIfAborted();
                if (probe.reason === 'completed') message.hostVersion = parseClaudeVersion(probe.stdout);
            }
            reply = await exchange();
            if ('hostProbe' in reply) throw new Error('Observation repeated its host version probe');
        }
        if ('error' in reply) throw new BackendError(reply.error.code, reply.error.message, reply.error.localization);
        return reply.result as ResultFor<O>;
    }

    async close(): Promise<void> {
        this.lifetime.abort();
        await Promise.allSettled([this.reader.close(), ...this.activeReads]);
    }
}
