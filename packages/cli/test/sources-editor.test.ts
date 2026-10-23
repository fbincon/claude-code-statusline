import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Editor } from '@fbincon/statusline-core/editor/draft';
import { openSources, performSourceAction, sourcesKey, sourcesView } from '@fbincon/statusline-core/editor/source-manager';
import { textInput } from '@fbincon/statusline-core/editor/text-input';
import { parseResponse, requestText } from '@fbincon/statusline-core/editor/backend';
import { newInstance } from '@fbincon/statusline-core/editor/instances';
import { LANGUAGES } from '@fbincon/statusline-core/i18n/registry';
import type { Operation, ResultFor } from '@fbincon/statusline-core/contracts/ui';
import { ConfigurationService } from '../src/config/service.js';
import { createStorage } from '../src/config/storage.js';
import { ConfigurationProtocol } from '../src/ui/protocol.js';
import { previewAdapter } from '../src/rendering/preview.js';
import { commandFor } from '@fbincon/statusline-platform/commands';
test('shared source editor completes creation, review, enable, bind, save and reopen in six languages',async t=>{
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
        sourcesKey(editor,{key:'enter'});sourcesKey(editor,{key:'enter'});
        for(const field of editor.sources!.fields)if(field.key==='id'||field.key==='name')field.input=textInput('queue');else if(field.key==='path')field.input=textInput(sourceFile);
        sourcesKey(editor,{key:'s',ctrl:true});await performSourceAction(editor,backend);
        assert.equal(editor.sources!.library!.sources[0]!.enabled,false);
        sourcesKey(editor,{key:'enter'});editor.sources!.effect='review';await performSourceAction(editor,backend);
        const view=sourcesView(editor,language,80,20).map(row=>row.text).join('\n');assert(view.includes('queue'));
        const mutable = editor.sources!;
        const freeze = (value: unknown): void => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } };
        for (const page of ['form','review','diagnose'] as const) {
            editor.sources = structuredClone({...mutable,page}); freeze(editor.sources);
            for (const width of [40,64,80,120]) assert.doesNotThrow(() => sourcesView(editor,language,width,18));
        }
        editor.sources = mutable;
        sourcesKey(editor,{key:'enter'});await performSourceAction(editor,backend);
        assert.equal(editor.sources!.library!.sources[0]!.enabled,true);
        sourcesKey(editor,{key:'enter'});editor.sources!.target={scope:'main',id:node.id};editor.sources!.effect='bind';await performSourceAction(editor,backend);
        assert(node.source?.binding);assert(editor.modified);
        const before=readFileSync(join(configDir,'claude-statusline-sources.json'));
        backend.request('preview',{draft:editor.draft,width:80});assert.deepEqual(readFileSync(join(configDir,'claude-statusline-sources.json')),before);
        const saved=backend.request('apply',{draft:editor.draft,expected_revision:editor.baseline.revision});assert.equal(saved.draft.display.instances.at(-1)?.source?.binding,node.source?.binding);
        const reopened=backend.request('read');assert.equal(reopened.draft.display.instances.at(-1)?.source?.binding,node.source?.binding);
        editor.sources!.effect='close';await performSourceAction(editor,backend);assert.equal(editor.sources,null);
    }
});
