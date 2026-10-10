import type { ClientProps } from '../../lib/session.ts';
import { expect, test } from 'claude-code/testing';
import { copyDraft } from '../../lib/editor/draft.ts';
import { setup, START, RUN, PANE, keys, reply, selectSetting, output } from '../fixtures.ts';

const change = {section:'host',kind:'change',scope:null,item_id:null,path:['host','padding'],before:0,after:7,
  label:{key:'review.fields.padding',params:{},fallback:'Padding'}};

test('import review previews a candidate, cancels unchanged, then accepts without saving or rereading', {timeoutMs:20000}, async ($, on) => {
  const fixture=setup(on), imported=copyDraft(fixture.store.draft);
  imported.host.padding=7; imported.display.statusline_language='zh-CN';
  fixture.behavior.process=(request,next)=>request.operation==='review_import' ? {value:reply({draft:imported,changes:[change]})} : next();
  await $.session.start(START); await $.command.run(RUN);
  const ui=await $.ui.mount(PANE);
  await keys(ui,'3',' ');
  await selectSetting(ui,'import-file');
  await keys(ui,'return','return');
  let props=(await ui.find({key:'statusline-client'}))!.props.props as ClientProps;
  expect(props.view.editor!.review).toBeDefined();
  expect(props.view.editor!.draft.display.use_colors).toBe(false);
  expect(props.view.editor!.draft.host.padding).toBe(0);
  await keys(ui,'return','tab','s');
  expect(fixture.calls.some(call=>call.operation==='apply')).toBe(false);
  expect(fixture.calls.filter(call=>call.operation==='preview').some(call=>call.payload.draft.host.padding===7)).toBe(true);
  await keys(ui,{key:'g',ctrl:true});
  props=(await ui.find({key:'statusline-client'}))!.props.props as ClientProps;
  expect(props.view.editor!.review).toBe(null);
  expect(props.view.editor!.draft.display.use_colors).toBe(false);
  await keys(ui,'return','return','a');
  props=(await ui.find({key:'statusline-client'}))!.props.props as ClientProps;
  expect(props.view.editor!.draft.host.padding).toBe(7);
  expect(props.view.editor!.baseline.revision).toBe('0'.repeat(64));
  expect(fixture.calls.filter(call=>call.operation==='review_import').length).toBe(2);
  expect(fixture.calls.some(call=>call.operation==='apply')).toBe(false);
  await keys(ui,'s');
  expect(fixture.store.draft.host.padding).toBe(7);
  expect(fixture.calls.filter(call=>call.operation==='review_import').length).toBe(2);
  await ui.unmount();
});

test('invalid imports and post-acceptance save conflicts preserve the draft', {timeoutMs:20000}, async ($, on) => {
  const fixture=setup(on), imported=copyDraft(fixture.store.draft);
  imported.host.padding=7;
  let invalid=true;
  fixture.behavior.process=(request,next)=> {
    if(request.operation==='review_import') return invalid ? {value:output(JSON.stringify({protocol_version:8,error:{code:'invalid_configuration',message:'Invalid file',localization:null}}),2)} : {value:reply({draft:imported,changes:[change]})};
    if(request.operation==='apply') return {value:output(JSON.stringify({protocol_version:8,error:{code:'configuration_conflict',message:'Changed externally',localization:null}}),2)};
    return next();
  };
  await $.session.start(START); await $.command.run(RUN); const ui=await $.ui.mount(PANE);
  await keys(ui,'3',' '); await selectSetting(ui,'import-file'); await keys(ui,'return','return');
  let props=(await ui.find({key:'statusline-client'}))!.props.props as ClientProps;
  expect(props.view.editor!.review).toBe(null);expect(props.view.editor!.draft.display.use_colors).toBe(false);
  invalid=false; await keys(ui,'return','return','a','s');
  props=(await ui.find({key:'statusline-client'}))!.props.props as ClientProps;
  expect(props.view.editor!.draft.host.padding).toBe(7);
  expect(props.view.editor!.baseline.revision).toBe('0'.repeat(64));
  expect(fixture.store.draft.host.padding).toBe(0);
  await ui.unmount();
});
