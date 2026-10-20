import test from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './final-support.js';
import { Session } from '@fbincon/statusline-tui/session';
import type { Backend } from '@fbincon/statusline-tui/session';
import { frame } from '@fbincon/statusline-tui/drawing';
import { parseResponse, requestText } from '@fbincon/statusline-core/editor/backend';
import { LANGUAGES } from '@fbincon/statusline-core/i18n/messages';
import { defaultDisplay } from '@fbincon/statusline-core/config/display';
import { ProfileService } from '../src/config/profiles.js';
import { allFiles } from './runtime-support.js';

test('installed-style backend workflow saves a named draft, previews without activation, and protects dirty switching in six languages', async t => {
    for (const language of LANGUAGES) {
        const f=setup(t,true),p=new ProfileService(f.service);
        const display=defaultDisplay();display.statusline_language='ja';
        p.mutate({action:'save',name:'方案 é 👩‍💻',display,expected_revision:p.read().revision});
        const backend:Backend={request(operation,payload={}) {
            if(operation==='read' && Object.keys(payload as object).length===0)payload={target:{kind:'user'}};
            const r=f.protocol.handle(requestText(operation,payload),error=>assert.fail(String(error)));
            return parseResponse(operation,{exitCode:r.status,stdout:JSON.stringify(r.response),stderr:''});
        }};
        const session=await Session.open(backend,language),e=session.state.editor;
        const key=async(key:string,extra={})=>session.key({key,...extra},120,32);
        const before=allFiles(f.root);
        await key('o',{ctrl:true});await key('down');await key('enter');
        assert.equal(e.profiles?.page,'actions');assert.equal(e.profiles?.candidate?.statusline_language,'ja');
        assert.equal(e.draft.display.statusline_language,'en');
        for(const [cols,rows] of [[64,18],[80,24],[120,32]]) {
            const text=frame(session.state,cols!,rows!).rows.flatMap(row=>row.map(s=>s.text)).join('');
            assert(!text.includes('profiles.action.'));assert(!text.includes('profiles.title'));
        }
        assert.deepEqual(allFiles(f.root),before);
        e.draft.display.palette='ansi';
        await key('enter');
        assert.equal(e.profiles?.page,'dirty');
        await key('down');await key('down');await key('enter');
        assert.equal(e.draft.display.palette,'ansi');
        // Re-select the scheme, then explicitly discard and enter its editor.
        await key('down');await key('enter');await key('enter');await key('down');await key('enter');
        assert.equal(e.profiles,null);
        assert.equal(e.draft.display.statusline_language,'ja');
        assert.equal(e.baseline.configuration?.profile_name,'方案 é 👩‍💻');
        e.draft.display.statusline_language='ko';await session.save();
        assert.equal(p.read().profiles[0]!.display.statusline_language,'ko');
        assert.equal(f.display().statusline_language,'en');
    }
});

test('scheme form paste stays text, duplicate overwrite is explicit, and activation remains a draft until Save', async t => {
    const f=setup(t,true),p=new ProfileService(f.service);
    const backend:Backend={request(operation,payload={}) {
        if(operation==='read' && Object.keys(payload as object).length===0)payload={target:{kind:'user'}};
        const r=f.protocol.handle(requestText(operation,payload));
        return parseResponse(operation,{exitCode:r.status,stdout:JSON.stringify(r.response),stderr:''});
    }};
    const session=await Session.open(backend),e=session.state.editor;
    const key=async(key:string,extra={})=>session.key({key,...extra},120,32);
    e.draft.display.statusline_language='ko';
    await key('o',{ctrl:true});await key('down');await key('enter');
    assert.equal(e.profiles?.page,'form');
    await key('sfq 中文',{paste:true});await key('enter');
    assert.equal(e.profiles?.page,'confirm');assert.equal(p.read().profiles.length,0);
    await key('enter');assert.equal(p.read().profiles[0]!.name,'sfq 中文');
    assert.equal(f.display().statusline_language,'en');
    // Select saved scheme, activate as default draft, explicitly discard old draft.
    await key('down');await key('enter');await key('down');await key('enter');
    assert.equal(e.profiles?.page,'dirty');
    await key('down');await key('enter');
    assert.equal(e.profiles,null);assert.equal(e.draft.display.statusline_language,'ko');
    assert.equal(f.display().statusline_language,'en');
    await session.save();assert.equal(f.display().statusline_language,'ko');
});
