import { ArgumentError } from '../config/arguments.js';
import type { Language } from '@fbincon/statusline-core/i18n/messages';
import { taskDetailLines } from '@fbincon/statusline-core/editor/task-detail';
import { pythonJson } from '@fbincon/statusline-core/json-text';
import type { RuntimeContext } from '../runtime/context.js';
import { detailService } from './service.js';

export function taskCommand(args: readonly string[], context: RuntimeContext, language: Language): string {
    if (args[0] !== 'show') throw new ArgumentError('task requires show');
    const values: Record<string,string | boolean> = {};
    for (let i=1;i<args.length;i++) {
        const key=args[i]!;
        if (!['--session-id','--prompt-id','--json','--config-dir'].includes(key) || values[key] !== undefined) throw new ArgumentError('Unknown or repeated task option: '+key);
        if(key==='--json') values[key]=true;
        else {
            const value=args[++i];
            if(!value || value.startsWith('--')) throw new ArgumentError(key+' requires a value');
            values[key]=value;
        }
    }
    const result=detailService({session_id:values['--session-id'],prompt_id:values['--prompt-id'] ?? null},context);
    return values['--json'] ? pythonJson(result,{ensureAscii:false,indent:2}) : taskDetailLines(result,language).join('\n');
}
