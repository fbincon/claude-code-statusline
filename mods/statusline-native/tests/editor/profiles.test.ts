import { expect,test } from 'claude-code/testing';
import { Editor } from '../../lib/editor/draft.ts';
import { openProfiles,profilesKey,performProfileAction,profilesView } from '../../lib/editor/profile-manager.ts';
import { description,readResult,BASE } from '../fixtures.ts';
import { LANGUAGES } from '../../lib/i18n/index.ts';
import type { ProfilesResult } from '../../lib/generated-contracts.ts';
import { openQuick,receivePreset,controlQuick } from '../../lib/editor/quick-setup.ts';

test('shared native scheme picker preserves dirty drafts and complete text input',async()=>{
    const e=new Editor(description(),readResult());
    const library:ProfilesResult={version:1,revision:'1'.repeat(64),profiles:[{id:'one',name:'中文 é 👩‍💻',display:BASE.display}],bindings:[]};
    openProfiles(e);
    await performProfileAction(e,{request:async(operation)=>{if(operation!=='profiles_read')throw new Error('Unexpected write');return library as never;}});
    profilesKey(e,{key:'down'});profilesKey(e,{key:'enter'});
    e.draft.display.palette='ansi';
    profilesKey(e,{key:'enter'});
    expect(e.profiles?.page).toBe('dirty');
    profilesKey(e,{key:'down'});profilesKey(e,{key:'down'});profilesKey(e,{key:'enter'});
    expect(e.draft.display.palette).toBe('ansi');
    profilesKey(e,{key:'end'});profilesKey(e,{key:'up'});profilesKey(e,{key:'up'});profilesKey(e,{key:'up'});profilesKey(e,{key:'enter'});
    expect(e.profiles?.page).toBe('form');
    profilesKey(e,{key:'sfq 中文',text:true});
    expect(e.profiles?.fields[0]?.input.value).toBe('sfq 中文');
    for(const language of LANGUAGES) expect(profilesView(e,language,40,8).some(row=>row.text.includes('profiles.'))).toBe(false);
});
test('native Quick setup Save as preserves the original dirty draft',async()=>{
    const e=new Editor(description(),readResult());e.draft.display.use_colors=false;
    const original=JSON.stringify(e.draft);e.quick=openQuick(e.draft,'daily-development');
    const candidate=JSON.parse(JSON.stringify(e.draft));candidate.display.theme='terminal';
    receivePreset(e.quick,candidate);controlQuick(e,'end');controlQuick(e,'return');controlQuick(e,'down');controlQuick(e,'down');
    expect(controlQuick(e,'return')).toBe('profiles');
    await performProfileAction(e,{request:async()=>({version:1,revision:'1'.repeat(64),profiles:[],bindings:[]}) as never});
    expect(e.profiles?.page).toBe('form');expect(e.profiles?.candidate?.theme).toBe('terminal');
    expect(JSON.stringify(e.draft)).toBe(original);
});
