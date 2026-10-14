import type { Scope } from '@fbincon/statusline-core/contracts/ui';
import { OPTIONS } from './operations.js';
import { PALETTE_VALUES, DIRECTORYSTYLE_VALUES, SEPARATORSTYLE_VALUES, SCOPELABELS_VALUES, STATUSLINELANGUAGE_VALUES } from '@fbincon/statusline-core/contracts/ui';
import { ROWS } from '@fbincon/statusline-core/config/presets';
export class ArgumentError extends Error {
}
export interface ConfigArguments {
    action: string;
    subaction?: string;
    scope?: Scope;
    items: string[];
    option?: string;
    value?: string;
    id?: string;
    type_id?: string;
    mode?: string;
    rows?: string[];
    path?: string;
    preset?: string;
    flags: Record<string, string | string[] | boolean>;
}
export function parseConfig(argv: readonly string[]): ConfigArguments {
    const args = [...argv], action = args.shift();
    if (!action)
        throw new ArgumentError('config requires a subcommand');
    const result: ConfigArguments = { action, items: [], flags: {} };
    let allowed: Record<string, 'boolean' | 'one' | 'many'> = {}, minimum = 0, maximum = 0;
    let positional: string[] = [];
    if (action === 'subagents' || action === 'language')
        result.subaction = args.shift();
    if (action === 'instance') {
        const scope = args.shift();
        if (!['main', 'subagent'].includes(scope ?? ''))
            throw new ArgumentError('scope must be main or subagent');
        result.scope = scope as Scope;
        result.subaction = args.shift();
    }
    const selected = action === 'subagents' || action === 'instance' || action === 'language' ? result.subaction : action;
    if (action === 'language') {
        if (selected === 'show')
            allowed = { '--json': 'boolean' };
        else if (selected === 'set')
            minimum = maximum = 1;
        else if (selected !== 'reset')
            throw new ArgumentError('language requires show, set or reset');
    }
    else if (action === 'instance') {
        if (selected === 'list')
            allowed = { '--json': 'boolean' };
        else if (selected === 'add') {
            minimum = maximum = 1;
            allowed = { '--after': 'one', '--text': 'one' };
        }
        else if (['copy', 'remove', 'enable', 'disable'].includes(selected ?? ''))
            minimum = maximum = 1;
        else if (selected === 'set')
            minimum = maximum = 3;
        else if (selected === 'move') {
            minimum = maximum = 1;
            allowed = { '--before': 'one', '--after': 'one' };
        }
        else
            throw new ArgumentError('unknown instance subcommand');
    }
    else if (selected === 'show' && action !== 'subagents' || selected === 'list-items')
        allowed = { '--json': 'boolean' };
    else if (['set-items', 'enable', 'disable', 'order'].includes(selected ?? '')) {
        minimum = ['enable', 'disable'].includes(selected!) ? 1 : 0;
        maximum = Infinity;
    }
    else if (action === 'set')
        minimum = maximum = 2;
    else if (action === 'apply') {
        allowed = { '--items': 'many', '--colors': 'one', '--palette': 'one', '--directory-style': 'one', '--separator-style': 'one', '--padding': 'one', '--refresh-interval': 'one', '--hide-vim-mode-indicator': 'one', '--subagent-items': 'many', '--subagent-statusline': 'one', '--scope-labels': 'one', '--statusline-language': 'one' };
    }
    else if (['preset', 'import', 'export'].includes(action)) {
        minimum = maximum = 1;
        allowed = action === 'export' ? { '--overwrite': 'boolean' } : { '--dry-run': 'boolean' };
    }
    else if (action === 'item')
        minimum = maximum = 4;
    else if (action === 'layout') {
        minimum = 1;
        maximum = Infinity;
        allowed = { '--by-instance': 'boolean' };
    }
    else if (action !== 'reset')
        throw new ArgumentError(`unknown config subcommand: ${action}`);
    let literal = false;
    for (let i = 0; i < args.length; i++) {
        const token = args[i]!;
        if (!literal && token === '--') {
            literal = true;
            continue;
        }
        if (!literal && token.startsWith('--')) {
            const equals = token.indexOf('='), flag = equals < 0 ? token : token.slice(0, equals), inline = equals < 0 ? undefined : token.slice(equals + 1);
            const kind = Object.hasOwn(allowed, flag) ? allowed[flag] : undefined;
            if (!kind)
                throw new ArgumentError(`unrecognized option: ${flag}`);
            const name = flag.slice(2);
            if (kind === 'boolean') {
                if (inline !== undefined)
                    throw new ArgumentError(`${flag} does not take a value`);
                result.flags[name] = true;
            }
            else if (kind === 'one') {
                const value = inline ?? args[++i];
                if (value === undefined || inline === undefined && value.startsWith('--'))
                    throw new ArgumentError(`${flag} requires a value`);
                result.flags[name] = value;
            }
            else {
                const values = inline === undefined ? [] : [inline];
                if (inline === undefined)
                    while (i + 1 < args.length && !args[i + 1]!.startsWith('--'))
                        values.push(args[++i]!);
                result.flags[name] = values;
            }
        }
        else if (!literal && token.startsWith('-') && !/^-\d/u.test(token))
            throw new ArgumentError(`unrecognized option: ${token}`);
        else
            positional.push(token);
    }
    if (positional.length < minimum || positional.length > maximum)
        throw new ArgumentError(`invalid arguments for config ${selected}`);
    if (action === 'language')
        result.value = positional[0];
    else if (action === 'instance') {
        if (selected === 'add')
            result.type_id = positional[0];
        else
            result.id = positional[0];
        if (selected === 'set') {
            result.option = positional[1];
            result.value = positional[2];
        }
        if (selected === 'move' && Boolean(result.flags.before) === Boolean(result.flags.after))
            throw new ArgumentError('move requires exactly one of --before and --after');
    }
    else if (action === 'set') {
        result.option = positional[0];
        result.value = positional[1];
        if (!OPTIONS.includes(result.option!))
            throw new ArgumentError(`invalid option: ${result.option}`);
    }
    else if (action === 'item') {
        if (!['main', 'subagent'].includes(positional[0]!))
            throw new ArgumentError('scope must be main or subagent');
        result.scope = positional[0] as Scope;
        result.id = positional[1];
        result.option = positional[2];
        result.value = positional[3];
    }
    else if (action === 'layout') {
        result.mode = positional[0];
        result.rows = positional.slice(1);
        if (!['auto', 'explicit'].includes(result.mode!))
            throw new ArgumentError('layout must be auto or explicit');
    }
    else if (action === 'preset')
        result.preset = positional[0];
    else if (action === 'import' || action === 'export')
        result.path = positional[0];
    else
        result.items = positional;
    if (action === 'apply')
        for (const name of ['items', 'colors', 'palette', 'directory-style', 'separator-style', 'padding', 'refresh-interval', 'hide-vim-mode-indicator'])
            if (!Object.hasOwn(result.flags, name))
                throw new ArgumentError(`required option: --${name}`);
    if (action === 'apply') {
        const choices: Record<string, readonly string[]> = { colors: ['on', 'off'], palette: PALETTE_VALUES, 'directory-style': DIRECTORYSTYLE_VALUES, 'separator-style': SEPARATORSTYLE_VALUES, 'scope-labels': SCOPELABELS_VALUES, 'statusline-language': STATUSLINELANGUAGE_VALUES, 'subagent-statusline': ['on', 'off'], 'hide-vim-mode-indicator': ['on', 'off'] };
        for (const [key, values] of Object.entries(choices))
            if (result.flags[key] !== undefined && !values.includes(result.flags[key] as string))
                throw new ArgumentError(`invalid value for --${key}`);
    }
    if (action === 'language' && selected === 'set' && !(STATUSLINELANGUAGE_VALUES as readonly string[]).includes(result.value!))
        throw new ArgumentError('unsupported language');
    if (action === 'preset' && !Object.hasOwn(ROWS, result.preset!))
        throw new ArgumentError('unknown preset');
    return result;
}
