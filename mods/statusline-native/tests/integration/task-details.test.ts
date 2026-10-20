import { expect,test } from 'claude-code/testing';
import { setup,START,RUN,PANE,reply } from '../fixtures.ts';
import type { TaskDetails } from '../../lib/generated-contracts.ts';

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
