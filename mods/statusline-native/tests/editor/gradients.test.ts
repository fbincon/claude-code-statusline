import { expect, test } from 'claude-code/testing';
import { description, readResult } from '../fixtures.ts';
import { Editor } from '../../lib/editor/draft.ts';
import { formRows, adjustForm } from '../../lib/editor/forms.ts';
import { settingPresentation } from '../../lib/i18n/presentation.ts';
import { LANGUAGES, t } from '../../lib/i18n/index.ts';
import type { View } from '../../lib/session.ts';

test('gradient states and presets are localized while editable values stay canonical in all six languages', () => {
  for (const language of LANGUAGES) {
    const e=new Editor(description(),readResult());
    e.detail={scope:'main',id:e.draft.display.instances[0]!.id};
    const view:View={editor:e,language,input:null,preview:null,preferences:[],preferencesError:'',error:'',previewError:'',previewBusy:false,message:'',busy:'',uncertain:false};
    const field=()=>formRows(view).find(row=>row.key==='item:foreground_gradient')!;
    expect(settingPresentation(view,[field()])[0]!.value).toBe(t('values.off',language));
    adjustForm(view,field(),1);
    expect(field().value).toBe('ocean');
    expect(settingPresentation(view,[field()])[0]!.value).toBe(t('gradients.preset.ocean',language));
    expect(e.baseline.draft.display.instances[0]!.options.foreground_gradient).toBeUndefined();
  }
});
