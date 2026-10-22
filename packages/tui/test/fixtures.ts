import { POWERLINE_OPTIONS } from '@fbincon/statusline-core/contracts/ui';
/** Pure product fixtures: no CLI imports, storage, installation or host effects. */
import { defaultDisplay } from '@fbincon/statusline-core/config/display';
import { ITEMS } from '@fbincon/statusline-core/config/catalog';
import { EDITOR_FIELDS, PRESETS, FORMAT_CHOICES } from '@fbincon/statusline-core/contracts/ui';
import type { Capabilities, DescribeResult, ReadResult } from '@fbincon/statusline-core/contracts/ui';
import { LANGUAGES, type Language } from '@fbincon/statusline-core/i18n/messages';
import { State } from '../src/state.js';
import { frame } from '../src/drawing.js';
import { paint } from '../src/theme.js';

export function fixture(language: Language = 'en'): State {
    const capabilities: Capabilities = {
        host_version: '2.1.296', subagent_rows: 'supported', native_mod: 'unverified',
        native_mod_loaded: null, data_observation: 'not_observed',
    };
    const description: DescribeResult = {
        backend_version: 'test', capabilities, catalog: [...ITEMS],
        editor_fields: JSON.parse(JSON.stringify(EDITOR_FIELDS)),
        presets: JSON.parse(JSON.stringify(PRESETS)),
        formatting_options: JSON.parse(JSON.stringify(FORMAT_CHOICES)),
        operations: [],
        options: {
            colors: { choices: [true, false] }, palette: { choices: ['default', 'ansi'] },
            theme: { choices: ['classic', 'dark', 'light', 'terminal'] },
            'powerline-glyph': { choices: ['ascii', 'powerline'] },
            ...POWERLINE_OPTIONS,
            'directory-style': { choices: ['full', 'home', 'project-relative', 'basename'] },
            'separator-style': { choices: ['classic', 'compact', 'powerline'] },
            'scope-labels': { choices: ['off', 'when-subagents', 'always'] },
            'statusline-language': { choices: [...LANGUAGES] },
            'subagent-statusline': { choices: [true, false] },
            padding: { minimum: 0, maximum: 32 },
            'refresh-interval': { minimum: 1, maximum: 3600, special: 'event' },
            'hide-vim-mode-indicator': { choices: [true, false] },
        },
    };
    const current: ReadResult = {
        backend_version: 'test', capabilities, installed: true, installation: {}, revision: '0'.repeat(64),
        draft: { display: defaultDisplay(), host: { padding: 0, refresh_interval: 1, hide_vim_mode_indicator: false } },
    };
    const state = new State(description, current, language);
    state.preview = { sample: true, main: [[paint('中文 👩🏽‍💻 é')]], subagents: [[paint('代理 👨‍👩‍👧')]] };
    return state;
}

export function plain(state: State, columns = 120, rows = 30): string[] {
    return frame(state, columns, rows).rows.map(row => row.map(span => span.text).join(''));
}
