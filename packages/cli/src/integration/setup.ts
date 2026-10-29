import { quoteArgument } from '@fbincon/statusline-platform/commands';
import { t, renderMessage, type Language } from '@fbincon/statusline-core/i18n/messages';
import { SetupState } from '@fbincon/statusline-core/editor/setup';
import { differences } from '@fbincon/statusline-core/config/import-review';
import { applyPreset } from '@fbincon/statusline-core/config/presets';
import { randomUUID } from 'node:crypto';
import { runSetup } from '@fbincon/statusline-tui/setup';
import { previewAdapter } from '../rendering/preview.js';
import { setLanguage } from '../config/preferences.js';
import type { InstallContext } from './model.js';
import { applySetup, inspectSetup } from './setup-service.js';

export async function setup(context: InstallContext, dryRun: boolean, language: Language,
    stdout: (value: string) => void, stderr: (value: string) => void): Promise<number> {
    const directory = process.platform === 'win32' ? "'" + context.configDir.replaceAll("'", "''") + "'" : quoteArgument(context.configDir);
    const executable = process.platform === 'win32' ? 'claude-statusline.cmd' : 'claude-statusline';
    const commands = [executable + ' install --config-dir ' + directory, executable + ' configure --config-dir ' + directory + ' --user', executable + ' doctor --config-dir ' + directory];
    if (!dryRun && (!process.stdin.isTTY || !process.stdout.isTTY)) {
        stderr(t('setup.tty', language) + '\n' + commands.join('\n') + '\n'); return 2;
    }
    const inspection = inspectSetup(context);
    if (dryRun) {
        stdout(t('setup.dry_run', language) + '\n');
        for (const check of inspection.checks) stdout('[' + check.level + '] ' + renderMessage(check.message, language) + '\n');
        for (const note of inspection.notes) stdout(renderMessage(note, language) + '\n');
        stdout(t('setup.steps', language) + '\n' + commands.join('\n') + '\n');
        return inspection.canIntegrate ? 0 : 1;
    }
    const state = new SetupState(inspection, language), preview = await previewAdapter();
    const summarize = (value: unknown): string => typeof value === 'object' && value !== null && 'type_id' in value ? String(value.type_id) : JSON.stringify(value);
    const action = await runSetup(state, {
        preset: (draft, id) => ({ ...draft, display: applyPreset(draft.display, id, () => randomUUID().replaceAll('-', '')) }),
        preview:(draft,width,scenario)=>preview(draft,width,undefined,scenario),
        language: next => { setLanguage(context.configDir, next, context.io); },
        review: (draft, next) => differences(inspection.draft!, draft).map(change => renderMessage(change.label, next) + ': ' + summarize(change.before) + ' → ' + summarize(change.after)),
    });
    language = state.language;
    if (action === 'cancel' || action === 'interrupt') { stdout(t('setup.cancelled', language) + '\n'); return action === 'interrupt' ? 130 : 0; }
    if (action !== 'save' && action !== 'integrate') return 2;
    const applied = applySetup(context, inspection, state.candidate!, action === 'integrate', stage => stdout(t('setup.committed_' + stage, language) + '\n'));
    if (applied.saved?.backup_dir) stdout(t('cli.backup', language, { path: applied.saved.backup_dir }) + '\n');
    if (applied.installed?.backupDir) stdout(t('cli.backup', language, { path: applied.installed.backupDir }) + '\n');
    for (const row of applied.checks) stdout('[' + row.level + '] ' + renderMessage(row.message, language) + '\n');
    for (const message of applied.installed?.messages ?? []) stdout(renderMessage(message, language) + '\n');
    if (applied.error) {
        stderr(renderMessage(applied.error, language) + '\n' + t('setup.partial', language, { stage: t('setup.stage_' + applied.stage, language) }) + '\n'
            + executable + ' doctor --config-dir ' + directory + '\n'
            + executable + ' recover --config-dir ' + directory + ' --dry-run\n'
            + executable + ' recover --config-dir ' + directory + '\n'
            + executable + ' setup --config-dir ' + directory + '\n'); return 2;
    }
    stdout(t(action === 'integrate' ? 'setup.success' : 'setup.saved_only', language) + '\n' + commands.join('\n') + '\n');
    return 0;
}
