import test from 'node:test';
import assert from 'node:assert/strict';
import { LANGUAGES } from '@fbincon/statusline-core/i18n/messages';
import { packageManager, packageView } from '@fbincon/statusline-core/editor/package-manager';
import { fixture, plain } from './fixtures.js';
import { Session } from '../src/session.js';
import { taskFrame } from '../src/task-viewer.js';
import { taskViewer } from '@fbincon/statusline-core/editor/task-viewer';
for (const language of LANGUAGES)
    test(`task viewer and version page retain unsaved editor state in ${language}`, async () => {
        const state = fixture(language);
        state.editor.draft.display.use_colors = false;
        state.editor.page = 'settings';
        state.editor.setting = 'task-details';
        const before = JSON.stringify({ draft: state.editor.draft, baseline: state.editor.baseline });
        state.key({ key: 'return' }, 120, 40);
        assert(state.editor.taskViewer);
        for (const size of [[64, 18], [120, 40], [220, 80]])
            assert(plain(state, ...size as [
                number,
                number
            ]).every(line => !line.includes('task.viewer.')));
        state.key({ key: 'escape' }, 120, 40); // Leave the identity input first.
        state.key({ key: 'q' }, 120, 40);
        assert.equal(state.editor.taskViewer, null);
        assert.equal(JSON.stringify({ draft: state.editor.draft, baseline: state.editor.baseline }), before);
        state.editor.packages = packageManager();
        packageView(state.editor.packages, language, 80, 10);
        const session = new Session(state, { request() { throw new Error('No backend call is needed to close an unopened page'); } });
        assert.equal(await session.key({ key: 'q' }, 120, 40), null);
        assert.equal(state.editor.packages, null);
        assert.equal(JSON.stringify({ draft: state.editor.draft, baseline: state.editor.baseline }), before);
        const frame = taskFrame(taskViewer('session', null, language), 32, 8);
        assert.equal(frame.rows.length, 8);
    });
