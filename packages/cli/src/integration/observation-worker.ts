import { claudeLaunch } from '@fbincon/statusline-platform/commands';
import { productIdentity } from '@fbincon/statusline-platform/npm';
import { join } from 'node:path';
import { BackendError, parseResponse, processFailure, requestText } from '@fbincon/statusline-core/editor/backend';
import { pythonJson } from '@fbincon/statusline-core/json-text';
import { ConfigurationService } from '../config/service.js';
import { ConfigurationProtocol } from '../ui/protocol.js';
import { detailService } from '../tasks/service.js';
import { runtimeContext } from '../runtime/context.js';
import { executionFolder } from '../management/execution.js';
import { safeTarget } from './paths.js';
import { isLocalRead, type ObservationMessage, type ObservationReply, type VerifyControlMessage } from './observation-message.js';

function read(message: ObservationMessage | VerifyControlMessage): ObservationReply {
    try {
        if (message?.operation === 'verify_retained_control') {
            const folder = join(executionFolder(message.configDir, message.id), 'runner');
            const entry = join(folder, 'bin', 'claude-statusline.js');
            safeTarget(message.configDir, entry);
            return { result: entry === message.entry && !!productIdentity(folder) };
        }
        if (!message || !isLocalRead(message.operation)) throw new BackendError('unsupported_operation', 'Unsupported observation');
        const { configDir, launch, hostVersion, taskRuntime, operation, payload } = message;
        let needsHostVersion = false;
        const service = new ConfigurationService({ configDir, launch, hostVersion: () => {
            // Profiles return only the collection and revision, both independent of host capabilities.
            // Only a completed package review needs a fresh host version for its revision check.
            needsHostVersion = operation === 'package_review_status' && hostVersion === undefined;
            return hostVersion ?? null;
        } });
        const readTask = taskRuntime ? (input: unknown) => detailService(input, {
            ...runtimeContext(configDir), runtimeRoot: taskRuntime.root, nowMs: () => taskRuntime.now, sample: () => taskRuntime.sample,
        }) : undefined;
        const protocol = new ConfigurationProtocol(service, undefined, undefined, undefined, readTask);
        const { response, status } = protocol.handle(requestText(operation, payload));
        if (needsHostVersion) {
            // The parent owns cancellable subprocess trees, including this bounded metadata probe.
            try { return { hostProbe: claudeLaunch() }; }
            catch { return { hostProbe: null }; }
        }
        // Normalize and validate replies here, off the terminal's input/render thread.
        return { result: parseResponse(operation, { exitCode: status, stdout: pythonJson(response), stderr: '' }) };
    } catch (error) {
        const { code, message, localization } = processFailure(error);
        return { error: { code, message, localization } };
    }
}

if (process.send) {
    process.once('disconnect', () => process.exit(0));
    process.on('message', request => {
        const reply = read(request as ObservationMessage);
        if (process.connected) process.send!(reply, error => { if (error) process.exit(1); });
    });
} else process.exitCode = 2;
