import { homedir } from 'node:os';
import type { Preview } from '../ui/protocol.js';
import { previewRows } from '@fbincon/statusline-core/rendering/preview';
import { previewRows as agentRows } from '@fbincon/statusline-core/rendering/subagents';
import { rowSpans } from '@fbincon/statusline-core/rendering/spans';
import { baseEnvironment, presentation } from './environment.js';
import { LANGUAGES } from '@fbincon/statusline-core/i18n/registry';
export async function previewAdapter(home = homedir()): Promise<Preview> {
    const languages = new Map(await Promise.all(LANGUAGES.map(async (language) => [language, await presentation(language)] as const)));
    return (draft, width) => {
        const env = baseEnvironment(languages.get(draft.display.statusline_language)!, { home });
        return { sample: true, main: previewRows(draft.display, width, env, home, draft.host.padding).map(rowSpans), subagents: agentRows(draft.display, width, env).map(rowSpans) };
    };
}
