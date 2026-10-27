import { expect,test } from 'claude-code/testing';
import { setup,START,RUN,PANE,reply,output } from '../fixtures.ts';
import type { TaskDetails } from '../../lib/generated-contracts.ts';
import { LANGUAGES,t,text } from '../../lib/i18n/index.ts';

const report:TaskDetails={version:1,session_id:'session-test',prompt_id:null,captured_at:'2026-10-28T00:00:00Z',status:'unknown',phase:'unknown',elapsed_seconds:null,active_seconds:null,progress:null,agents:[],evidence:[],limitations:['independent_snapshots']};
const languagePane={...PANE,requestId:'statusline-task-details',viewport:{columns:220,rows:30},props:{...PANE.props,bodyColumns:200}};
for(const language of LANGUAGES)test(`task language initializes before opening, survives failure and reloads on retry/reopen in ${language}`,async($,on)=>{
    const f=setup(on);f.store.uiLanguage=language;let failed=true;
    f.behavior.process=(request,next)=>request.operation==='task_details'?{value:failed?output(JSON.stringify({protocol_version:25,error:{code:'invalid_request',message:t('task.error.input','en'),localization:text('task.error.input')}}),2):reply({...report,session_id:request.payload.session_id})}:next();
    await $.session.start(START);
    expect(f.descriptions['statusline-task']).toBe(t('task.title',language));
    await $.command.run({...RUN,command:'statusline-task'});
    expect((f.opens.at(-1) as {title:string}).title).toBe(t('task.title',language));
    let ui=await $.ui.mount(languagePane);
    expect(await ui.find({type:'Text',text:t('task.title',language)+' · '+t('task.readonly',language)})).toBeDefined();
    expect(await ui.find({type:'Text',text:t('task.unknown',language)})).toBeDefined();
    expect(await ui.find({type:'Text',text:t('native.backend_error',language,{code:'invalid_request',detail:text('task.error.input')})})).toBeDefined();
    expect((await ui.find({type:'Button',key:'task-refresh'}))!.props.label).toBe(t('profiles.refresh',language));
    expect((await ui.find({type:'Button',key:'task-close'}))!.props.label).toBe(t('task.close',language));
    failed=false;await ui.press({key:'task-refresh'});
    expect(await ui.find({type:'Text',text:t('native.backend_error',language,{code:'invalid_request',detail:text('task.error.input')})})).toBeUndefined();
    expect(await ui.find({type:'Text',text:t('task.progress',language,{value:t('task.unknown',language)})})).toBeDefined();
    expect(await ui.find({type:'Text',text:t('task.title',language)+' · '+t('task.readonly',language)})).toBeDefined();
    await ui.press({key:'task-close'});await ui.unmount();
    const next=LANGUAGES[(LANGUAGES.indexOf(language)+1)%LANGUAGES.length]!;f.store.uiLanguage=next;
    await $.command.run({...RUN,command:'statusline-task'});
    expect(f.descriptions['statusline-task']).toBe(t('task.title',next));expect((f.opens.at(-1) as {title:string}).title).toBe(t('task.title',next));
    ui=await $.ui.mount(languagePane);
    expect((await ui.find({type:'Button',key:'task-close'}))!.props.label).toBe(t('task.close',next));
    expect(f.calls.some(c=>['apply','profiles_apply','sources_apply','set_ui_language'].includes(c.operation))).toBe(false);
    await ui.unmount();
});

test('failed task preference reads use English guidance and do not prevent task reads',async($,on)=>{
    const f=setup(on);f.store.uiLanguage='ja';
    f.behavior.process=(request,next)=>request.operation==='read_ui_preferences'?{value:output('{')}:request.operation==='task_details'?{value:reply({...report,session_id:request.payload.session_id})}:next();
    await $.session.start(START);await $.command.run({...RUN,command:'statusline-task'});
    expect(f.descriptions['statusline-task']).toBe(t('task.title','en'));
    const ui=await $.ui.mount({...PANE,requestId:'statusline-task-details'});
    expect(await ui.find({type:'Text',text:t('task.language_unavailable','en')})).toBeDefined();
    expect((await ui.find({type:'Button',key:'task-close'}))!.props.label).toBe(t('task.close','en'));
    expect(f.calls.some(c=>c.operation==='task_details')).toBe(true);await ui.unmount();
});

test('task details retain a large report while bounding the plain Pane and keeping paging usable',async($,on)=>{
    const f=setup(on),large={...report,agents:Array.from({length:256},(_,i)=>({id:'agent-'+i,parent_id:null,name:'代理👩‍💻é'.repeat(24),status:'running',evidence:[]}))};
    f.behavior.process=(request,next)=>request.operation==='task_details'?{value:reply({...large,session_id:request.payload.session_id})}:next();
    await $.session.start(START);await $.command.run({...RUN,command:'statusline-task'});
    const pane={...PANE,requestId:'statusline-task-details',viewport:{columns:220,rows:2006},props:{...PANE.props,bodyColumns:200,scroll:{offset:0,bodyRows:2000}}};
    const ui=await $.ui.mount(pane);
    expect(Number((await ui.find({type:'Box'}))!.props.height)<2000).toBe(true);
    expect(await ui.find({type:'Button',key:'task-down'})).toBeDefined();
    await ui.press({key:'task-down'});await ui.redraw({...pane.props,bodyColumns:32,scroll:{offset:0,bodyRows:12}});
    expect(await ui.find({type:'Button',key:'task-refresh'})).toBeDefined();
    expect(f.calls.filter(call=>call.operation==='task_details').length).toBe(1);
    expect(large.agents.length).toBe(256);await ui.unmount();
});

test('task command reads explicit session evidence into a separate pane without applying configuration',async($,on)=>{
    const f=setup(on);
    const report:TaskDetails={version:1,session_id:'session-test',prompt_id:'p',captured_at:'2026-10-20T00:00:00Z',status:'interrupted',phase:'main',
        elapsed_seconds:2,active_seconds:null,progress:{completed:3,total:5},agents:[],evidence:[],limitations:['independent_snapshots']};
    f.behavior.process=(request,next)=>request.operation==='task_details'?{value:reply({...report,session_id:request.payload.session_id})}:next();
    await $.session.start(START);
    expect(f.registrations.includes('statusline-task')).toBe(true);
    await $.command.run({...RUN,command:'statusline-task'});
    const pane={...PANE,requestId:'statusline-task-details'};
    const ui=await $.ui.mount(pane);
    expect(await ui.find({type:'Text',text:'Checklist completed / total: 3/5'})).toBeDefined();
    expect(f.calls.some(c=>c.operation==='task_details' && typeof c.payload.session_id==='string')).toBe(true);
    expect(f.calls.some(c=>['apply','profiles_apply','runtime'].includes(c.operation))).toBe(false);
    expect(f.configCalls).toEqual([]);
    await ui.unmount();
});
