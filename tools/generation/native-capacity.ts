import { SCENARIO_SCHEMES } from '@fbincon/statusline-core/config/scenario-presets';
import { openColors } from '@fbincon/statusline-core/editor/color-manager';
import { openChanges, changePreview } from '@fbincon/statusline-core/editor/change-review';
import { openReuse } from '@fbincon/statusline-core/editor/reuse-manager';
import { reuseDraft } from '@fbincon/statusline-core/editor/reuse';
import { packageManager } from '@fbincon/statusline-core/editor/package-manager';
import { textInput } from '@fbincon/statusline-core/editor/text-input';
/** Rebuild the issue #154/#155 state matrix from canonical rules and rendering. */
import assert from 'node:assert/strict';
import { configurationDescription } from '@fbincon/statusline-cli/ui/protocol';
import { defaultDisplay, defaultItem } from '@fbincon/statusline-core/config/display';
import { DEFAULT_HOST } from '@fbincon/statusline-core/config/draft';
import { applyPreset } from '@fbincon/statusline-core/config/presets';
import { PRESETS, type Draft, type DescribeResult, type ReadResult, type PreviewResult, type SourceDefinition } from '@fbincon/statusline-core/contracts/ui';
import { Editor, copyDraft } from '@fbincon/statusline-core/editor/draft';
import { openQuick, receivePreset } from '@fbincon/statusline-core/editor/quick-setup';
import { openExplanation } from '@fbincon/statusline-core/editor/explanation';
import { createReview, navigateReview } from '@fbincon/statusline-core/editor/import-review';
import { differences } from '@fbincon/statusline-core/editor/import-differences';
import { openProfiles, profilesKey } from '@fbincon/statusline-core/editor/profile-manager';
import { openSources } from '@fbincon/statusline-core/editor/source-manager';
import { openGroups, groupsKey } from '@fbincon/statusline-core/editor/group-manager';
import { openAlignments, alignmentsKey } from '@fbincon/statusline-core/editor/alignment-manager';
import { isDraft } from '@fbincon/statusline-core/editor/backend';
import { previewRows, SAMPLE_NOW } from '@fbincon/statusline-core/rendering/preview';
import { previewRows as agentRows } from '@fbincon/statusline-core/rendering/subagents';
import { rowSpans } from '@fbincon/statusline-core/rendering/spans';
import { explain } from '@fbincon/statusline-core/rendering/explain';
import { RenderTrace } from '@fbincon/statusline-core/rendering/trace';
import { Presentation } from '@fbincon/statusline-core/rendering/language';
import { MESSAGES } from '@fbincon/statusline-core/i18n/statusline/en';
import type { RenderEnvironment } from '@fbincon/statusline-core/rendering/context';
import { directory, pathName, formatDate } from '@fbincon/statusline-platform/presentation';

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const description = copy(configurationDescription([2, 1, 310])) as unknown as DescribeResult;
const home = '/home/example';
const absent = (): never => { throw new Error('Capacity fixtures must not collect live observations'); };
const environment: RenderEnvironment = {
    language: new Presentation('en', MESSAGES), compactStaged: false, now: () => SAMPLE_NOW,
    directory: (value, style, project) => directory(value, style, project, home, false), basename: value => pathName(value, false),
    formatDate: (seconds, _utc, withDate) => formatDate(seconds, true, withDate), hostname: () => 'devbox',
    git: absent, branchDiff: absent, usage: () => null, task: absent, activePoint: () => ({ value: null }),
    hadSubagents: () => false, live: absent, agentEndings: () => ({}),
};
function sample(draft: Draft, width: number, trace?: RenderTrace): PreviewResult {
    const env = { ...environment, ...(trace ? { trace } : {}) };
    return { sample: true, main: previewRows(draft.display, width, env, home, draft.host.padding).map(rowSpans), subagents: agentRows(draft.display, width, env).map(rowSpans) };
}
export function nativeCapacityData() {
    const instance = (id: string) => ({ id, type_id: id, enabled: true, options: defaultItem(), text: null });
    const base: Draft = { display: defaultDisplay(), host: { ...DEFAULT_HOST } };
    base.display.instances = ['model-with-effort','current-dir','git','context-remaining','context-window-size','five-hour-limit','weekly-limit','spend-limit','tokens','task-timer'].map(instance);
    base.display.subagents.instances = ['status-elapsed','name','model-with-effort','context-remaining','task'].map(instance);
    const read = (draft = base): ReadResult => ({ backend_version: description.backend_version, draft: copyDraft(draft), revision: '0'.repeat(64), installed: true,
        installation: { statusLine: { state: 'owned' }, subagentStatusLine: { state: 'owned' } }, capabilities: description.capabilities });
    const editor = (draft = base) => new Editor(copy(description), read(draft));
    const values: unknown[] = [], indices = new Map<string, number>();
    const intern = (value: unknown): number => { const key = JSON.stringify(value), existing = indices.get(key); if (existing !== undefined) return existing; const index = values.length; indices.set(key, index); values.push(JSON.parse(key)); return index; };
    const cases: { name: string; columns: number; rows: number; editor: Record<string, number>; preview: number; padding: number; search: boolean }[] = [];
    const add = (name: string, e: Editor, columns = 72, rows = 24, padding = 0, search = false) => {
        e.sourceDraftOwner='draft-capacity-fixture';
        assert(isDraft(e.draft), 'Invalid capacity draft: ' + name);
        const width = columns - (columns >= 64 && rows >= 20 ? 2 : 0);
        const draft = e.changeReview ? changePreview(e) : e.reuse?.result && !e.reuse.result.blocked.length ? e.reuse.result.draft : e.profiles?.candidate ? { ...e.draft, display: e.profiles.candidate } : e.quick?.candidate ?? e.review?.result.draft ?? e.draft;
        let preview = sample(draft, width);
        if (e.explanation) {
            const trace = new RenderTrace(draft.display); preview = sample(draft, width, trace);
            e.explanation.result = explain(draft, e.explanation.scope, width, preview, trace, { installation: { main: 'owned', subagent: 'owned' }, host_version: [2,1,310], runtime: { native_timing: true, live_metrics: false } });
        }
        cases.push({ name, columns, rows, editor: Object.fromEntries(Object.entries(e).filter(([key]) => key !== 'description').map(([key, value]) => [key, intern(value)])), preview: intern(preview), padding, search });
    };
    const mutate = (fn: (draft: Draft) => void) => { const d = copyDraft(base); fn(d); return d; };
    const gradients = (count: number) => mutate(d => { for (const node of d.display.instances.filter(node => ['model-with-effort','current-dir','context-remaining','context-window-size'].slice(0,count).includes(node.id))) node.options.foreground_gradient = ['#22d3ee','#3b82f6']; });
    const minimal = { ...copyDraft(base), display: applyPreset(base.display, 'minimal', () => 'fixture') };
    const copies = (count: number, saved: boolean) => {
        const e = editor();
        for (let i = 0; i < count; i++) { const node = copy(e.draft.display.instances[0]!); node.id = 'copy-' + i; e.draft.display.instances.push(node); e.order.main.push(node.id); e.selected.main = node.id; }
        if (saved) e.committed(read(e.draft));
        return e;
    };
    const profiles = (count: number) => { const e = editor(); openProfiles(e); Object.assign(e.profiles!, { effect: null, library: { version: 1, revision: '1'.repeat(64), profiles: Array.from({ length: count }, (_, i) => ({ id: 'profile-' + i, name: 'Capacity profile ' + i, display: copy(base.display) })), bindings: [] } }); return e; };
    const agents = () => editor(mutate(d => { for (const node of d.display.subagents.instances) node.options.foreground_gradient = ['#22d3ee','#3b82f6']; }));
    for (const width of [32,53,64,72,87,118,196]) {
        add('plain-main-w' + width, editor(), width);
        for (const scope of ['main','subagent'] as const) { const e = editor(); e.detail = { scope, id: scope === 'main' ? 'model-with-effort' : 'task' }; if (scope === 'subagent') e.page = 'subagents'; e.explanation = openExplanation(scope, e.detail.id); add('explanation-' + scope + '-w' + width, e, width); }
    }
    for (const page of ['main','subagents','settings','layout'] as const) { const e = editor(); e.page = page; e.advanced = page === 'settings'; add('page-' + page, e); }
    for (const kind of ['detail','guidance','picker','search','groups','group-form','alignments','alignment-form','quick-opening']) {
        const e = editor();
        if (kind === 'detail' || kind === 'guidance') { e.detail = { scope: 'main', id: 'model-with-effort' }; if (kind === 'guidance') e.guidanceScroll = 0; }
        if (kind === 'picker') e.openPicker('main');
        if (kind.startsWith('group')) { openGroups(e); if (kind === 'group-form') for (const key of ['end','return']) groupsKey(e, { key }); }
        if (kind.startsWith('alignment')) { openAlignments(e); if (kind === 'alignment-form') alignmentsKey(e, { key: 'return' }); }
        if (kind === 'quick-opening') e.quick = openQuick(e.draft);
        add(kind, e, 72, 24, 0, kind === 'search');
    }
    for (const preset of PRESETS.slice(0,9)) { const e = editor(); e.quick = openQuick(e.draft, preset.id); receivePreset(e.quick, { ...copyDraft(base), display: applyPreset(base.display, preset.id, () => 'fixture') }); add('quick-preset-' + preset.id, e); }
    add('minimal-main', editor(minimal));
    for (const which of ['identical','palette','minimal','four-gradients']) {
        const incoming = which === 'minimal' ? minimal : which === 'four-gradients' ? gradients(4) : copyDraft(base);
        if (which === 'palette') incoming.display.palette = 'ansi';
        const e = editor(); e.review = createReview({ draft: incoming, changes: differences(base, incoming) }, e.draft);
        add('import-' + which, e); navigateReview(e.review, 's', 'zh-CN', 70, 16); add('import-select-' + which, e);
    }
    for (const count of [0,1,2,3,5]) {
        const e = profiles(count); add('profiles-list-' + count, e);
        if (count && count <= 3) { profilesKey(e, { key: 'down' }); profilesKey(e, { key: 'enter' }); add('profiles-actions-' + count, e); }
        if (count <= 2) { const save = profiles(count); save.profiles!.cursor = count + 1; profilesKey(save, { key: 'enter' }); save.profiles!.candidate = copy(base.display); add('profiles-save-as-' + count, save); profilesKey(save, { key: 'Capacity copy', text: true }); profilesKey(save, { key: 'enter' }); add('profiles-save-confirm-' + count, save); }
    }
    const source = (i: number): SourceDefinition => ({ id: 'source-' + i, name: 'Local sample ' + i, kind: 'json', scope: { project: null, session: null, agent: null }, ttl_seconds: 300, settings: { path: '/fixture/sample-' + i + '.json', pointer: '/value', observed_at_pointer: '/observed_at', unit: '' }, enabled: false, revision: 'revision-' + i });
    const sources = (label: string, definitions: SourceDefinition[], details: boolean) => {
        const e = editor(); openSources(e); const m = e.sources!;
        Object.assign(m, { owner: 'capacity-fixture', effect: null, library: { version: 2, revision: '2'.repeat(64), sources: definitions, bindings: [], automatic: [] }, context: { project: '/fixture', session: null, agent: null, branch: null } });
        add('sources-list-' + label, e);
        if (details) { m.selected = definitions[0]!.id; m.review = { source: definitions[0]!, review_revision: '3'.repeat(64) }; m.page = 'review'; add('sources-review-' + label, e); m.page = 'diagnose'; m.details = JSON.stringify({ source: definitions[0], observation: { state: 'missing', reason: 'disabled' }, jobs: [] }, null, 2).split('\n'); add('sources-diagnose-' + label, e); }
    };
    for (const count of [1,10,20,30,64]) sources(String(count), Array.from({ length: count }, (_, i) => source(i)), count === 1 || count === 20);
    for (const length of [1024,4096,8192]) sources('command-arg-' + length, [{ ...source(0), kind: 'command', settings: { executable: '/fixture/never-execute', args: ['x'.repeat(length)], cwd: '/fixture', input: {}, output: 'text', timeout_ms: 5000 } }], true);
    for (const count of [8,16,24,40]) {
        add('disabled-main-extra-' + count, editor(mutate(d => { for (let i = 0; i < count; i++) d.display.instances.push({ ...copy(d.display.instances[0]!), id: 'extra-' + i, enabled: false }); })));
        for (const saved of [false,true]) add('copy-main-' + (saved ? 'saved-' : 'unsaved-') + count, copies(count, saved));
    }
    for (const length of [32,64,128,256]) add('gradient-text-' + length, editor(mutate(d => d.display.instances.push({ id: 'gradient-text', type_id: 'text', enabled: true, text: 'x'.repeat(length), options: { ...defaultItem(), foreground_gradient: ['#22d3ee','#3b82f6'] } }))));
    for (const count of [1,2,3,10]) add('background-gradient-' + count, editor(mutate(d => { d.display.separator_style = 'powerline'; for (const node of d.display.instances.slice(0,count)) node.options.background_gradient = ['#22d3ee','#3b82f6']; })));
    for (const which of ['task','all','disabled-all']) { const e = agents(); if (which === 'task') for (const n of e.draft.display.subagents.instances) if (n.type_id !== 'task') delete n.options.foreground_gradient; if (which === 'disabled-all') e.draft.display.subagents.enabled = false; add('agent-gradient-' + which, e); }
    for (const length of [64,128,256]) add('long-labels-' + length, editor(mutate(d => { for (const n of d.display.instances) n.options.label = 'L'.repeat(length); })));
    for (const kind of ['main','quick','guidance','groups']) { const e = editor(gradients(3)); if (kind === 'quick') e.quick = openQuick(e.draft); if (kind === 'guidance') { e.detail = { scope: 'main', id: 'model-with-effort' }; e.guidanceScroll = 0; } if (kind === 'groups') openGroups(e); add('three-gradients-' + kind, e); }
    assert.equal(cases.length, 114);
    for (const columns of [32,72,120,200,300,400,500]) for (const rows of [12,24,50,100,200]) add(`viewport-${columns}x${rows}`, editor(minimal), columns, rows);
    for (const name of ['quick-opening','import-identical','profiles-list-2','agent-gradient-all']) for (const width of [32,53,72,118,196]) { const e = name === 'profiles-list-2' ? profiles(2) : name === 'agent-gradient-all' ? agents() : editor(); if (name === 'quick-opening') e.quick = openQuick(e.draft); if (name === 'import-identical') e.review = createReview({ draft: copyDraft(base), changes: [] }, e.draft); add(name + '-w' + width, e, width); }
    for (const rows of [100,120,140,150,160,170,180,190]) add('minimal-height-' + rows, editor(minimal), 72, rows);
    for (const count of [10,12,14,15]) for (const saved of [false,true]) add('copies-' + count + '-' + (saved ? 'saved' : 'unsaved'), copies(count, saved));
    for (const length of [0,7000,7500,8000,8250,8500,8750,9000,9500,9750]) add('padding-' + length, editor(), 72, 24, length);
    assert.equal(cases.length, 195);
    add('captured-72x213', editor(minimal), 72, 213);
    add('extreme-10000x10000', editor(gradients(10)), 10000, 10000);
    for(const width of [32,196]){
        const sourceEntry={...source(0),kind:'command' as const,enabled:true,settings:{executable:'/fixture/never-execute',args:['x'.repeat(4096)],cwd:'/fixture',input:{},output:'text' as const,timeout_ms:5000}};
        const makeSource=()=>{const e=editor();openSources(e);Object.assign(e.sources!,{owner:'capacity-fixture',effect:null,selected:sourceEntry.id,library:{version:3,revision:'1'.repeat(64),sources:[sourceEntry],bindings:[],automatic:[]}});return e;};
        for(const page of ['diagnose','checks','bindings','binding-cleanup'] as const){
            const e=makeSource(),m=e.sources!;m.page=page;m.inspection={source:sourceEntry,view:{source_id:sourceEntry.id,name:sourceEntry.name,state:'error',reason:'timeout',observed_at:'2026-10-28T00:00:00Z',freshness:'stale',value:42,unit:null},automatic:{state:'backoff',reason:'retry',interval_seconds:300,next_at:'2026-10-28T00:05:00Z',last_attempt:'2026-10-28T00:00:00Z',last_success:'2026-10-27T23:55:00Z'},jobs:[],last_success:'2026-10-27T23:55:00Z',checks_observed_at:'2026-10-28T00:00:00Z',checks_context:{project:'/project',session:null,agent:null,branch:'main',head:'a'.repeat(40)},checks:Array.from({length:16},(_,i)=>({name:'Check '+i+' '+('界'.repeat(128)),state:'pending',bucket:'pending',url:'https://github.com/example/project/actions/runs/'+(i+1)})),offset:0,total:64};
            m.bindingReview={revision:'2'.repeat(64),rows:Array.from({length:16},(_,i)=>({id:'binding-'+i,source_id:sourceEntry.id,references:['profile:retained','draft:other-editor'],duplicate:true,removable:false})),offset:0,total:4096,uncertain:false};m.bindingSelection='binding-0';add('source-operations-'+page+'-w'+width,e,width,width===32?12:40);
        }
        for(const mode of ['status','draft','execute-confirm','cleanup','cleanup-confirm','export'] as const){
            const e=editor(),p=packageManager();p.owner='viewer-capacity-fixture';p.effect=null;p.mode=mode==='export'?'draft':mode;p.prefix='/fixture/prefix';p.cleanupId='pkg-00000000-0000-0000-0000-000000000001';p.cleanup={version:1,revision:'2'.repeat(64),prefix:p.prefix,offset:0,total:4096,uncertain:false,rows:Array.from({length:16},(_,i)=>({id:'pkg-history-'+i,version:'3.11.0',removable:i%2===0,reasons:i%2?['current','previous','running']:[]}))};
            if(mode==='status'){p.execution={version:1,id:'execution-00000000-0000-0000-0000-000000000001',transaction_id:p.cleanupId,action:'update',prefix:p.prefix,state:'running',stage:'integrating',started_at:'2026-10-28T00:00:00Z',updated_at:'2026-10-28T00:00:00Z',finished_at:null,error:null,running:true,results:{package:true,integration:false,configuration:null},control:{executable:'/fixture/node',args:['/fixture/retained/bin/claude-statusline.js'],config_dir:'/fixture/config'}};e.packageLocked=true;}
            if(mode==='export'){p.editing='export_path';p.input=textInput('/fixture/'+('界'.repeat(512))+'/saved.json');}
            e.packages=p;add('package-operations-'+mode+'-w'+width,e,width,width===32?12:40);
        }
    }
    assert.equal(cases.length,217);
    const grouped=copyDraft(minimal);
    grouped.display.instances=['a','b','c','d'].map(id=>({id,type_id:'model',enabled:true,text:null,options:defaultItem()}));
    grouped.display.groups=[{id:'g1',member_ids:['a','b'],primary_id:'a',link_visibility:true,shared_powerline:true},{id:'g2',member_ids:['c','d'],primary_id:'c',link_visibility:true,shared_powerline:true}];
    grouped.display.layout={mode:'explicit',rows:[['a','b'],['c','d']],alignments:[{id:'table',columns:[[{kind:'group',id:'g1'},{kind:'group',id:'g2'}]]}]};
    for(const width of [32,196]) for(const name of ['history-full','history-compare','history-export','history-discard','structure','style-source','style-select','style-fields','style-review','groups-select','groups-dependencies','groups-review','groups-complete']) {
        const e=editor(name.startsWith('groups')||name==='structure'?grouped:minimal);
        if(name.startsWith('history')) {
            for(let i=0;i<100;i++){const next=copyDraft(e.draft);next.host.padding=(i+1)%2;e.commitDraft(next);}
            openChanges(e);
            if(name==='history-compare'){const current=read(copyDraft(minimal));current.draft.display.palette='ansi';e.changeReview!.current=current;e.changeReview!.external=createReview({draft:current.draft,changes:differences(e.baseline.draft,current.draft)});e.changeReview!.comparison=1;}
            if(name==='history-export')e.changeReview!.input=textInput('/fixture/'+('界'.repeat(512))+'/draft.json');
            if(name==='history-discard')e.changeReview!.confirm=true;
        }else if(name==='structure'){e.selected.main='a';e.instanceAction('main','remove');}
        else {
            openReuse(e,name.startsWith('style')?'style':'groups');const m=e.reuse!;m.from=e.draft.display.instances[0]!.id;m.fields=['foreground','label'];m.groups=['g1'];
            m.page=name.endsWith('source')?'source':name.endsWith('select')?'select':name.endsWith('fields')?'fields':name.endsWith('complete')?'complete':'review';
            if(m.kind==='style'){m.incoming.display.instances[0]!.options.foreground='#abcdef';m.incoming.display.instances[0]!.options.label='Copied 中文 👩‍💻';}
            if(m.page==='review'||m.page==='complete'){
                let serial=0;m.references=name==='groups-dependencies'?'review':'expand';m.explicit=true;m.details=name==='groups-dependencies';
                m.result=reuseDraft(e.draft,m.incoming,m.kind==='style'?{kind:'style',scope:'main',from_scope:'main',from_id:m.from,to_ids:[m.destination],fields:m.fields}:{kind:'groups',scope:'main',group_ids:m.groups,references:m.references,explicit:true},()=> 'reuse-'+ ++serial,description.catalog,m.local);
                m.review=createReview(m.result);
            }
        }
        add('draft-reuse-'+name+'-w'+width,e,width,width===32?12:200);
    }
    assert.equal(cases.length,243);
    for (const name of SCENARIO_SCHEMES) for (const width of [32,196]) {
        const d=copyDraft(base);d.display=applyPreset(d.display,name,()=> 'scenario-fixture');
        add('appearance-scenario-'+name+'-w'+width,editor(d),width,width===32?12:213);
    }
    for (const language of ['en','zh-CN','zh-TW','zh-HK','ja','ko']) {
        const e=editor();e.detail={scope:'main',id:'context-remaining'};e.draft.display.instances.find(n=>n.id==='context-remaining')!.options.presentation='adaptive';
        add('appearance-adaptive-'+language,e,72,24);
        const colors=editor();openColors(colors,'field:powerline.row_background_gradient');colors.colors!.candidate=['#112233','#445566'];
        add('appearance-row-colors-'+language,colors,32,12);
        const q=editor();q.quick=openQuick(q.draft,'light-readable');q.quick.selected=13;
        add('appearance-quick-last-'+language,q,72,213);
    }
    assert.equal(cases.length,271);
    for (const language of ['en','zh-CN','zh-TW','zh-HK','ja','ko'] as const) for (const tall of [false,true]) {
        const e=editor();e.draft.display.statusline_language=language;
        e.draft.display.instances[0]!.options.label='Context 界👩🏽‍💻é 한글 '.repeat(5);
        e.draft.display.instances[0]!.options.icon='👩🏽‍💻';
        if(tall){e.page='settings';e.advanced=true;}
        add('i18n-long-'+(tall?'tall':'narrow')+'-'+language,e,tall?72:32,tall?213:12);
    }
    assert.equal(cases.length,283);
    return { description, values, cases };
}

export function nativeCapacityFixtures(): Map<string, string> {
    const { description, values, cases } = nativeCapacityData();
    const header = '// Generated by tools/generation/resources.ts; do not edit.\n';
    const root = 'mods/statusline-native/tests/', result = new Map<string, string>();
    const chunks: unknown[][] = [[]];
    let bytes = 0;
    for (const value of values) {
        const size = Buffer.byteLength(JSON.stringify(value));
        assert(size < 500000, 'One capacity value exceeds the host module budget');
        if (bytes + size > 250000) { chunks.push([]); bytes = 0; }
        chunks[chunks.length - 1]!.push(value); bytes += size;
    }
    for (const [index, chunk] of chunks.entries()) result.set(root + 'generated-capacity-values-' + index + '.ts', header + 'export const values: unknown[] = ' + JSON.stringify(chunk) + ';\n');
    result.set(root + 'generated-capacity-fixtures.ts', header + chunks.map((_, index) => `import { values as values${index} } from './generated-capacity-values-${index}.ts';`).join('\n') + '\n' +
        'export const CAPACITY_DESCRIPTION = ' + JSON.stringify(description) + ';\n' +
        'export const CAPACITY_VALUES: unknown[] = [' + chunks.map((_, index) => '...values' + index).join(',') + '];\n' +
        'export const CAPACITY_CASES = ' + JSON.stringify(cases) + ';\n');
    return result;
}
