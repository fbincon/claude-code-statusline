import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Editor } from '@fbincon/statusline-core/editor/draft';
import { openSources, performSourceAction, sourceActions, sourcesControls, sourcesKey, sourcesView } from '@fbincon/statusline-core/editor/source-manager';
import { textInput } from '@fbincon/statusline-core/editor/text-input';
import { parseResponse, requestText } from '@fbincon/statusline-core/editor/backend';
import { newInstance } from '@fbincon/statusline-core/editor/instances';
import { LANGUAGES } from '@fbincon/statusline-core/i18n/registry';
import { t as translate } from '@fbincon/statusline-core/i18n/messages';
import type { Operation, ResultFor } from '@fbincon/statusline-core/contracts/ui';
import { ConfigurationService } from '../src/config/service.js';
import { createStorage } from '../src/config/storage.js';
import { ConfigurationProtocol } from '../src/ui/protocol.js';
import { previewAdapter } from '../src/rendering/preview.js';
import { commandFor } from '@fbincon/statusline-platform/commands';
test('shared source editor creates, reviews, binds and unbinds in the registered languages',async t=>{
    const root=mkdtempSync(join(tmpdir(),'source editor '));t.after(()=>rmSync(root,{recursive:true,force:true}));
    for(const language of LANGUAGES) {
        const configDir=join(root,language), sourceFile=join(root,language+'.json');writeFileSync(sourceFile,'{"value":0}');
        const service=new ConfigurationService({configDir,launch:{executable:process.execPath,args:[fileURLToPath(new URL('../src/entry.js',import.meta.url))]},hostVersion:()=>[2,1,294]},createStorage());
        mkdirSync(configDir,{recursive:true});writeFileSync(join(configDir,'settings.json'),JSON.stringify({statusLine:{type:'command',command:commandFor(service.context.launch,'render')},subagentStatusLine:{type:'command',command:commandFor(service.context.launch,'render-subagents')}}));
        const protocol=new ConfigurationProtocol(service,await previewAdapter());
        const backend={request<O extends Operation>(operation:O,payload:unknown={}):ResultFor<O>{const result=protocol.handle(requestText(operation,payload),error=>assert.fail(String(error)));return parseResponse(operation,{exitCode:result.status,stdout:JSON.stringify(result.response),stderr:""});}};
        const editor=new Editor(backend.request('describe'),backend.request('read'));
        const node=newInstance('external-value',editor.draft.display.instances);editor.draft.display.instances.push(node);
        openSources(editor);await performSourceAction(editor,backend);
        const manager = editor.sources!;
        async function press(key: string, ctrl = false) {
            if (sourcesKey(editor, { key, ctrl }, language, 32, 8)) await performSourceAction(editor, backend);
        }
        async function action(id: ReturnType<typeof sourceActions>[number]['id']) {
            assert(sourceActions(editor).some(row => row.id === id));
            manager.action = id;
            await press('enter');
        }
        await press('enter'); await press('enter');
        await press('s', true);
        assert.equal(manager.fields[manager.cursor]!.key, 'id');
        assert.equal(manager.message?.key, 'sources.field_error');
        manager.fields.find(field => field.key === 'id')!.input = textInput('queue');
        await press('s', true);
        assert.equal(manager.fields[manager.cursor]!.key, 'path');
        assert.equal(manager.fields.find(field => field.key === 'id')?.input.value, 'queue');
        for(const field of editor.sources!.fields)if(field.key==='id'||field.key==='name')field.input=textInput('queue');else if(field.key==='path')field.input=textInput(sourceFile);else if(field.key==='project')field.input=textInput('');
        await press('s', true);
        assert.equal(manager.library!.sources[0]!.enabled, false);
        assert.equal(manager.page, 'actions');
        assert.equal(sourceActions(editor)[0]?.id, 'review');
        assert(!sourceActions(editor).some(row => ['refresh', 'cancel', 'checks'].includes(row.id)));
        await action('bind'); await press('enter');
        assert.equal(manager.bindingChanged?.action, 'bound');
        await action('bind');
        assert.equal(sourcesControls(editor).enter, null);
        assert(sourcesView(editor, language, 80, 12).some(row => row.text === translate('sources.already_bound', language)));
        await press('g', true);
        await action('review');
        const view=sourcesView(editor,language,80,20).map(row=>row.text).join('\n');assert(view.includes('queue'));
        const mutable = editor.sources!;
        const freeze = (value: unknown): void => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } };
        for (const page of ['form','review','diagnose'] as const) {
            editor.sources = structuredClone({...mutable,page}); freeze(editor.sources);
            for (const width of [40,64,80,120]) assert.doesNotThrow(() => sourcesView(editor,language,width,18));
        }
        editor.sources = mutable;
        await press('g', true);
        assert.equal(manager.library!.sources[0]!.enabled, false);
        await action('review');
        await press('enter');
        assert.equal(editor.sources!.library!.sources[0]!.enabled,true);
        assert.equal(sourceActions(editor)[0]?.id, 'refresh');
        const binding=editor.instance('main',node.id)?.source?.binding;assert(binding);assert(editor.modified);
        const before=readFileSync(join(configDir,'claude-statusline-sources.json'));
        backend.request('preview',{draft:editor.draft,width:80});assert.deepEqual(readFileSync(join(configDir,'claude-statusline-sources.json')),before);
        const saved=backend.request('apply',{draft:editor.draft,expected_revision:editor.baseline.revision});assert.equal(saved.draft.display.instances.at(-1)?.source?.binding,binding);
        const reopened=backend.request('read');assert.equal(reopened.draft.display.instances.at(-1)?.source?.binding,binding);
        const displayPath = join(configDir, 'claude-statusline.json');
        const displayBytes = readFileSync(displayPath);
        const displayMode = statSync(displayPath).mode;
        await action('unbind'); await press('enter');
        assert.equal(manager.bindingChanged?.action, 'unbound');
        assert.equal(editor.instance('main', node.id)?.source?.binding, null);
        assert.equal(backend.request('read').draft.display.instances.at(-1)?.source?.binding, binding);
        assert.deepEqual(readFileSync(displayPath), displayBytes);
        assert.equal(statSync(displayPath).mode, displayMode);
        await action('unbind');
        assert.equal(sourcesControls(editor).enter, null);
        await press('g', true);
        await action('edit');
        assert.equal(editor.sources!.fields.find(field=>field.key==='project')?.input.value,'');
        editor.sources!.effect='close';await performSourceAction(editor,backend);assert.equal(editor.sources,null);
    }
});
