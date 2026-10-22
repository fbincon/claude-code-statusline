/** Copied outside the checkout; all display code below is loaded from the installed artifact. */
import * as fs from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const [modules, output] = process.argv.slice(2);
if (!modules || !output) throw new Error('Require installed modules and output');
const load = (name: string, file: string) => import(pathToFileURL(join(modules, 'statusline-' + name, 'dist/src', file + '.js')).href);
const [{ defaultDisplay }, { applyPreset, COMPLETE_SCHEMES }, { LANGUAGES }, preview, items, agents, environment, layout] = await Promise.all([
    load('core','config/display'),load('core','config/presets'),load('core','i18n/registry'),load('core','rendering/preview'),
    load('core','rendering/items'),load('core','rendering/subagents'),load('cli','rendering/environment'),load('core','rendering/layout'),
]);
const records: Record<string, unknown>[] = [];
for (const language of LANGUAGES) {
    const env = environment.baseEnvironment(await environment.presentation(language), { home: '/sample', now: () => preview.SAMPLE_NOW });
    for (const scheme of COMPLETE_SCHEMES) for (const width of [80,120]) {
        const scenarios = ['standard', ...(scheme === 'agent-focus' ? ['none','running','completed','failed'] : scheme === 'quota-watch' ? ['missing','expired','zero'] : [])];
        for (const scenario of scenarios) for (const theme of scenario === 'standard' ? ['dark','light','terminal'] : ['terminal'])
            for (const decorated of scenario === 'standard' && theme === 'dark' ? [false,true] : [false]) {
                const config = applyPreset(defaultDisplay(),scheme,()=> { throw new Error('Unexpected duplicate builtin ID'); });
                Object.assign(config,{theme,palette:theme==='terminal'?'ansi':'default',statusline_language:language});
                if(decorated) {config.separator_style='powerline';Object.assign(config.powerline,{padding:'left',separator:'slash',start_cap:true,end_cap:false,color_mode:'continuous'});}
                const data=preview.samplePreviewData('/sample');
                if(scenario==='missing') delete data.rate_limits;
                if(scenario==='expired') for(const window of Object.values(data.rate_limits) as any[]) window.resets_at=preview.SAMPLE_NOW-1;
                if(scenario==='zero') for(const window of Object.values(data.rate_limits) as any[]) window.used_percentage=0;
                const now=preview.SAMPLE_NOW*1000;
                const tasks=['running','completed','failed'].filter(status=>scenario==='standard'||scenario===status).map((status,index)=>({
                    id:status,status,name:['Explorer','Reviewer','Tests'][index],label:['inspect auth flow','review lifecycle','check failure recovery'][index],
                    startTime:now-42000,_frozen_duration_ms:42000,model:'claude-sonnet-5',effort:'high',contextWindowSize:200000,tokenCount:48000,cwd:'/sample/project/src',
                }));
                const agentOnly=['none','running','completed','failed'].includes(scenario);
                class Sample extends preview.SampleRenderState {
                    constructor(...args: any[]) { super(...args); }
                    liveData() { const value=super.liveData();value['active-agents']={value:1,partial:false};value['task-progress']={value:{completed:1,total:3},partial:false};return value; }
                    promptTimer() { return {text:this.palette.timer+'⏳ '+this.text('timer.waiting.one',{count:1})+' · 1m 42s'+this.palette.reset}; }
                }
                const main=agentOnly?[]:items.configuredRows(data,config,width,env,(...args:any[])=>new Sample(...args));
                const subagents=scenario==='standard'||agentOnly?agents.renderPayload({columns:width,tasks},config,env,now).map((row:any)=>row.content).filter(Boolean):[];
                for(const line of [...main,...subagents]) if(layout.displayWidth(line)>width) throw new Error('Installed scheme exceeds width');
                records.push({scheme,language,width,theme,scenario,decorated,sample:true,main,subagents});
            }
    }
}
fs.writeFileSync(output,JSON.stringify(records,null,2)+'\n');
