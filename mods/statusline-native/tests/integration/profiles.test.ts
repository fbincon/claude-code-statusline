import {expect,test} from 'claude-code/testing';
import {setup,START,RUN,PANE,BASE,readResult,reply,keys,selectSetting,visibleText,previewDraft} from '../fixtures.ts';
import type {ProfilesResult,ResolvedConfiguration} from '../../lib/generated-contracts.ts';
import {LANGUAGES,t} from '../../lib/i18n/index.ts';

test('native scheme manager previews, changes target and saves the shared scheme without changing user defaults',async($,on)=>{
  const f=setup(on),original=JSON.stringify(f.store.draft);
  const library:ProfilesResult={version:1,revision:'1'.repeat(64),profiles:[{id:'scheme',name:'Scheme 中文',display:JSON.parse(JSON.stringify(BASE.display))}],bindings:[]};
  const configuration:ResolvedConfiguration={target:{kind:'profile',id:'scheme'},profile_id:'scheme',profile_name:'Scheme 中文',project_root:null,reason:'profile',shared_projects:[]};
  let profileRevision='1'.repeat(64);
  const current=()=>({...readResult({...BASE,display:library.profiles[0]!.display},profileRevision),configuration});
  f.behavior.process=(request,next)=>{
    if(request.operation==='profiles_read')return {value:reply(library)};
    if(request.operation==='read' && request.payload.target?.kind==='profile')return {value:reply(current())};
    if(request.operation==='apply' && request.payload.target?.kind==='profile'){
      expect(request.payload.expected_revision).toBe(profileRevision);
      library.profiles[0]!.display=JSON.parse(JSON.stringify(request.payload.draft.display));profileRevision='2'.repeat(64);
      return {value:reply({...current(),changed:true,backup_dir:'/backup'})};
    }
    return next();
  };
  await $.session.start(START);await $.command.run(RUN);
  const ui=await $.ui.mount(PANE);
  await keys(ui,{key:'o',ctrl:true},'down','return');
  expect(f.calls.some(c=>c.operation==='apply')).toBe(false);
  await keys(ui,'return','3',' ','s');
  expect(library.profiles[0]!.display.use_colors).toBe(false);
  expect(JSON.stringify(f.store.draft)).toBe(original);
  expect(f.calls.find(c=>c.operation==='apply')!.payload.target).toEqual({kind:'profile',id:'scheme'});
  await ui.unmount();
});

for(const language of LANGUAGES)test(`localized profile entry retains the draft until explicit Save in ${language}`,{timeoutMs:20000},async($,on)=>{
  const f=setup(on);f.store.uiLanguage=language;
  const library:ProfilesResult={version:1,revision:'1'.repeat(64),profiles:[],bindings:[]};
  f.behavior.process=(request,next)=>request.operation==='profiles_read'?{value:reply(library)}:next();
  await $.session.start(START);await $.command.run(RUN);
  const ui=await $.ui.mount(PANE),saved=JSON.stringify(f.store.draft);
  await keys(ui,'d');const draft=JSON.stringify(previewDraft(f));
  expect(draft===saved).toBe(false);
  await keys(ui,'3');await selectSetting(ui,'profiles');
  expect(await visibleText(ui)).toContain(t('settings.profiles',language));
  await keys(ui,'return');
  expect(await visibleText(ui)).toContain(t('profiles.title',language));
  expect(f.calls.filter(call=>call.operation==='profiles_read').length).toBe(1);
  await keys(ui,{key:'g',ctrl:true});
  expect(JSON.stringify(previewDraft(f))).toBe(draft);
  expect(JSON.stringify(f.store.draft)).toBe(saved);
  expect(f.calls.some(call=>call.operation==='apply'||call.operation==='profiles_apply'||call.operation==='set_ui_language')).toBe(false);
  expect(f.configCalls.length).toBe(0);
  await keys(ui,'s');
  expect(f.calls.filter(call=>call.operation==='apply').length).toBe(1);
  expect(JSON.stringify(f.store.draft)).toBe(draft);
  expect(f.store.uiLanguage).toBe(language);
  expect(f.configCalls.length).toBe(0);
  await keys(ui,'q');await ui.unmount();
});
