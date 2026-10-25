import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultDisplay, defaultItem, validateDisplay } from '../src/config/display.js';
import { DEFAULT_HOST } from '../src/config/draft.js';
import { edit } from '../src/config/instances.js';
import { editLayout } from '../src/config/editor-fields.js';
import { editAlignment, parseAlignmentColumns, validAlignments } from '../src/editor/alignments.js';
import { selectImport } from '../src/editor/import-selection.js';
import { isDraft } from '../src/editor/backend.js';
import { editGroup } from '../src/editor/groups.js';
import type { DisplayDraft, AlignmentRef } from '../src/contracts/ui.js';
const ref=(id:string):AlignmentRef=>({kind:'instance',id});
const fixture=():DisplayDraft=>{
  const d=defaultDisplay();d.instances=['a','b','c','d'].map(id=>({id,type_id:'text',enabled:true,text:id,options:defaultItem()}));
  d.layout={mode:'explicit',rows:[['a','b'],['c','d']]};return d;
};
test('alignment references reject ambiguous rows, missing/grouped members, reversed columns and spacer-side conflicts',()=>{
  const d=fixture(),valid=[{id:'table',columns:[[ref('a'),ref('c')],[ref('b'),ref('d')]]}];
  assert(validAlignments(valid,d.layout,d.instances,d.groups));
  const invalid=[
    [{id:'bad',columns:[[ref('a'),ref('b')]]}],
    [{id:'bad',columns:[[ref('a'),ref('missing')]]}],
    [{id:'bad',columns:[[ref('b'),ref('d')],[ref('a'),ref('c')]]}],
    [{id:'bad',columns:[[ref('a'),ref('c')],[ref('a'),ref('d')]]}],
    [{id:'bad',columns:[[ref('a')]]}],
    [valid[0],{id:'other',columns:[[ref('b'),ref('d')]]}],
  ];
  for(const value of invalid){assert(!validAlignments(value,d.layout,d.instances,d.groups));assert.throws(()=>validateDisplay({...d,layout:{...d.layout,alignments:value}}));}
  d.instances[1]!.type_id='spacer';d.instances[1]!.text=null;
  d.layout.rows=[['a','b','c'],['d']];
  assert(!validAlignments([{id:'bad',columns:[[ref('c'),ref('d')]]}],d.layout,d.instances,d.groups));
});
test('copy retains original relationships; delete, destructive moves and automatic layout refuse before mutation',()=>{
  const original=editAlignment(fixture(),'table',[[ref('a'),ref('c')],[ref('b'),ref('d')]]), bytes=JSON.stringify(original);
  const copied=edit(original,'main',{action:'copy',id:'b'},()=> 'copy').config;
  assert.deepEqual(copied.layout.alignments,original.layout.alignments);
  assert.throws(()=>edit(original,'main',{action:'remove',id:'b'},()=> 'unused'));
  assert.throws(()=>edit(original,'main',{action:'move',id:'b',after:'d'},()=> 'unused'));
  assert.throws(()=>editLayout(original,'auto'));
  assert.equal(JSON.stringify(original),bytes);
  const detached=editAlignment(original,'table');
  assert.doesNotThrow(()=>edit(detached,'main',{action:'remove',id:'b'},()=> 'unused'));
});
test('old files migrate without alignment and selective section replacement retains complete references',()=>{
  const old=fixture();const bytes=JSON.stringify({...old,schema_version:14});
  assert.equal(validateDisplay(JSON.parse(bytes)).layout.alignments,undefined);
  const incoming=editAlignment(fixture(),'table',parseAlignmentColumns('instance:a,instance:c;instance:b,instance:d'));
  assert.throws(()=>validateDisplay({...incoming,schema_version:14}));
  const base={display:defaultDisplay(),host:{...DEFAULT_HOST}},source={display:incoming,host:{...DEFAULT_HOST}};
  assert.equal(selectImport(base,source,['theme']).display.layout.alignments,undefined);
  const imported=selectImport(base,source,['main']);
  assert.deepEqual(imported.display.layout.alignments,incoming.layout.alignments);
  assert(isDraft(imported));assert.deepEqual(validateDisplay(imported.display),imported.display);
  assert.equal(JSON.stringify(JSON.parse(bytes)),bytes);
});
test('whole-group references survive copies and prevent ungrouping or partial-member selection',()=>{
  const d=fixture();d.instances[1]!.type_id='model';d.instances[1]!.text=null;
  d.instances[3]!.type_id='model';d.instances[3]!.text=null;
  d.groups=[{id:'left',member_ids:['a','b'],primary_id:'b',link_visibility:true,shared_powerline:true},
    {id:'right',member_ids:['c','d'],primary_id:'d',link_visibility:true,shared_powerline:true}];
  assert(!validAlignments([{id:'partial',columns:[[ref('a'),ref('c')]]}],d.layout,d.instances,d.groups));
  const original=editAlignment(d,'group-columns',[[{kind:'group',id:'left'},{kind:'group',id:'right'}]]);
  let serial=0;
  const copied=editGroup(original,'main',{action:'copy',id:'left'},()=> 'copy-'+ ++serial);
  assert.deepEqual(copied.layout.alignments,original.layout.alignments);
  assert.doesNotThrow(()=>validateDisplay(copied));
  assert.throws(()=>editGroup(original,'main',{action:'ungroup',id:'left'},()=>''), (error:any)=>error.ids?.includes('group-columns'));
  assert.equal(original.groups.length,2);
});
