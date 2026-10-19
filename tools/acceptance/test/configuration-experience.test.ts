import test from 'node:test';
import { fixture, assert, fs, Session } from '../../migration/ts-04/test/support.js';
import { openPty } from '../../migration/ts-04/test/pty.js';
import { LANGUAGES, t as tr } from '@fbincon/statusline-core/i18n/messages';

test('external editor adds, previews, saves and reopens the optional cache cause component', async t => {
  const f = await fixture(t);
  assert.ok(!f.e.draft.display.instances.some(i => i.type_id === 'cache-miss-reason' && i.enabled));
  await f.session.key({key:'a',ctrl:true});
  await f.session.key({key:'/'});
  await f.session.key({key:'cache-miss-reason',text:true});
  await f.session.key({key:'return'});
  await f.session.key({key:'return'});
  assert.ok(f.e.draft.display.instances.some(i => i.type_id === 'cache-miss-reason' && i.enabled));
  assert.ok(f.state.preview!.main.flat().map(s => s.text).join('').includes('tools changed'));
  assert.equal(await f.session.key({key:'s',ctrl:true}), 'save');
  await f.session.save();
  const reopen = await Session.open(f.backend, 'en');
  assert.ok(reopen.state.editor.draft.display.instances.some(i => i.type_id === 'cache-miss-reason' && i.enabled));
});

test('external explanation uses the selected instance and never applies or changes files', async t=>{
  const f=await fixture(t), before=f.bytes();
  await f.session.key({key:'e',ctrl:true});await f.session.key({key:'home'});await f.session.key({key:'return'});
  const explanation=f.e.explanation!;
  assert.equal(explanation.id,f.e.selected.main);assert.ok(explanation.result);
  assert.deepEqual(f.state.preview,explanation.result!.preview);
  await f.session.key({key:'end'});await f.session.key({key:'g',ctrl:true});
  assert.equal(f.e.explanation,null);assert.deepEqual(f.bytes(),before);
  assert.ok(!f.calls.some(call=>call.operation==='apply'));
});

for(const language of LANGUAGES) test(`quick setup, explanation and save/reopen in a real ${language} terminal`,{
  skip:process.platform==='win32'?'POSIX PTY; Windows has native console and pure state checks':false,timeout:15000,
},async t=>{
  const f=await fixture(t), pty=openPty(f.root,120,32,{},language);
  try {
    await pty.wait(text=>text.includes(tr('ui.drawing.configure_status_line',language)));
    const key=async(value:string,label:string)=>{const offset=pty.captured().toString('utf8').length;pty.send(value);await pty.wait(text=>text.slice(offset).includes(label));};
    await key('\x10',tr('quick.title',language));
    await key('\r',tr('quick.appearance',language));
    await key('\x1b[F\r',tr('quick.review',language));
    await key('\r',tr('ui.drawing.main_items',language));
    await key('\x05\x1b[H\r',tr('explain.title',language));
    await key('\x07',tr('ui.drawing.edit_item_format',language).trim());
    pty.send('\x13');await pty.exited();assert.equal(pty.child.exitCode,0);
    assert.equal(JSON.parse(fs.readFileSync(f.displayPath,'utf8')).layout.mode,'explicit');
    assert.deepEqual(pty.attributes(),pty.before);
  } finally {await pty.close();}
  const reopen=openPty(f.root,120,32,{},language);
  try {await reopen.wait(text=>text.includes(tr('ui.drawing.configure_status_line',language)));reopen.send('\x1b');await reopen.exited();assert.equal(reopen.child.exitCode,0);}
  finally {await reopen.close();}
});
