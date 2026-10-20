import { expect,test } from 'claude-code/testing';
import { Editor } from '../../lib/editor/draft.ts';
import { openProfiles,profilesKey,performProfileAction,profilesView } from '../../lib/editor/profile-manager.ts';
import { description,readResult,BASE } from '../fixtures.ts';
import { LANGUAGES } from '../../lib/i18n/index.ts';
import type { ProfilesResult } from '../../lib/generated-contracts.ts';

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
