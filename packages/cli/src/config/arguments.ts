import type { Scope } from '@fbincon/statusline-core/contracts/ui';
import { OPTIONS } from './operations.js';
import { PALETTE_VALUES, DIRECTORYSTYLE_VALUES, SEPARATORSTYLE_VALUES, SCOPELABELS_VALUES, STATUSLINELANGUAGE_VALUES } from '@fbincon/statusline-core/contracts/ui';
import { ROWS } from '@fbincon/statusline-core/config/presets';
export class ArgumentError extends Error {
    constructor(message: string, public readonly key = 'cli.unrecognized', public readonly params: Record<string, unknown> = { arguments: message }, public readonly help?: { unrecognizedOption?: string; pending?: boolean }) {
        super(message);
    }
}
/** Help still rejects an invalid command path or an option missing its value.
 * Required final arguments and unrecognized extras are checked after argparse's
 * help action, so they do not prevent help from exiting successfully.
 */
export function validateConfigHelp(argv: readonly string[]): void {
    const end = argv.findIndex(value => value === '--help' || value === '-h');
    let prefix = argv.slice(0, end < 0 ? argv.length : end);
    for (;;) {
        if (!prefix.length || ['language', 'subagents'].includes(prefix[0]!) && prefix.length === 1 || prefix[0] === 'instance' && (prefix.length === 1 || prefix.length === 2 && ['main', 'subagent'].includes(prefix[1]!))) return;
        try { parseConfig(prefix); return; }
        catch (error) {
            if (!(error instanceof ArgumentError)) throw error;
            if (error.help?.unrecognizedOption) {
                const option = error.help.unrecognizedOption;
                prefix = prefix.filter(value => value !== option && !value.startsWith(option + '='));
                continue;
            }
            if (error.key === 'cli.required' || error.help?.pending) return;
            throw error;
        }
    }
}
function positionalChoices(action: string, selected: string | undefined, values: string[]): void {
    const first = values[0];
    if (first === undefined) return;
    if (action === 'set' && !OPTIONS.includes(first)) throw new ArgumentError(`invalid option: ${first}`, 'cli.invalid_choice', { value: first, choices: OPTIONS.join(', ') });
    if (action === 'item' && !['main', 'subagent'].includes(first)) throw new ArgumentError('scope must be main or subagent');
    if (action === 'layout' && !['auto', 'explicit'].includes(first)) throw new ArgumentError('layout must be auto or explicit');
    if (action === 'language' && selected === 'set' && !(STATUSLINELANGUAGE_VALUES as readonly string[]).includes(first)) throw new ArgumentError('unsupported language');
    if (action === 'preset' && !Object.hasOwn(ROWS, first)) throw new ArgumentError('unknown preset');
}
function applyChoices(flags: ConfigArguments['flags']): void {
    const choices: Record<string, readonly string[]> = { colors: ['on', 'off'], palette: PALETTE_VALUES, 'directory-style': DIRECTORYSTYLE_VALUES, 'separator-style': SEPARATORSTYLE_VALUES, 'scope-labels': SCOPELABELS_VALUES, 'statusline-language': STATUSLINELANGUAGE_VALUES, 'subagent-statusline': ['on', 'off'], 'hide-vim-mode-indicator': ['on', 'off'] };
    for (const [key, values] of Object.entries(choices)) if (flags[key] !== undefined && !values.includes(flags[key] as string)) throw new ArgumentError(`invalid value for --${key}`);
}
function commandToken(value: string | undefined): void {
    if (value !== undefined && optionToken(value)) throw new ArgumentError(`unrecognized option: ${value}`, 'cli.unrecognized', { arguments: value }, { unrecognizedOption: value });
}
// Python 3.14 argparse uses a negative-looking prefix, not numeric validation.
// Business rules validate the entire value after parsing. Spaces also make an
// otherwise unknown option-looking token positional in the reference parser.
export const optionToken = (value: string) => value.length > 1 && value.startsWith('-') && !/^-\.?\p{Decimal_Number}/u.test(value) && !value.includes(' ');
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
    commandToken(action);
    const result: ConfigArguments = { action, items: [], flags: {} };
    let allowed: Record<string, 'boolean' | 'one' | 'many'> = {}, minimum = 0, maximum = 0;
    let positional: string[] = [];
    if (action === 'subagents' || action === 'language')
        result.subaction = args.shift();
    if (action === 'instance') {
        const scope = args.shift();
        commandToken(scope);
        if (!['main', 'subagent'].includes(scope ?? ''))
            throw new ArgumentError('scope must be main or subagent');
        result.scope = scope as Scope;
        result.subaction = args.shift();
    }
    const selected = action === 'subagents' || action === 'instance' || action === 'language' ? result.subaction : action;
    commandToken(selected);
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
                throw new ArgumentError(`unrecognized option: ${flag}`, 'cli.unrecognized', { arguments: flag }, { unrecognizedOption: flag });
            const name = flag.slice(2);
            if (kind === 'boolean') {
                if (inline !== undefined)
                    throw new ArgumentError(`${flag} does not take a value`);
                result.flags[name] = true;
            }
            else if (kind === 'one') {
                const value = inline ?? args[++i];
                if (value === undefined || inline === undefined && optionToken(value))
                    throw new ArgumentError(`${flag} requires a value`);
                result.flags[name] = value;
            }
            else {
                const values = inline === undefined ? [] : [inline];
                if (inline === undefined)
                    while (i + 1 < args.length && !optionToken(args[i + 1]!))
                        values.push(args[++i]!);
                result.flags[name] = values;
            }
        }
        else if (!literal && optionToken(token))
            throw new ArgumentError(`unrecognized option: ${token}`, 'cli.unrecognized', { arguments: token }, { unrecognizedOption: token });
        else
            positional.push(token);
    }
    positionalChoices(action, selected, positional);
    if (action === 'apply') applyChoices(result.flags);
    if (action === 'instance' && selected === 'move' && Object.hasOwn(result.flags, 'before') && Object.hasOwn(result.flags, 'after')) throw new ArgumentError('move requires exactly one of --before and --after');
    if (positional.length < minimum)
        throw new ArgumentError(`invalid arguments for config ${selected}`, 'cli.required', { arguments: `config ${selected}` });
    if (positional.length > maximum)
        throw new ArgumentError(`invalid arguments for config ${selected}`, 'cli.unrecognized', { arguments: positional.slice(maximum).join(' ') }, { pending: true });
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
        if (selected === 'move' && Object.hasOwn(result.flags, 'before') === Object.hasOwn(result.flags, 'after'))
            throw new ArgumentError('move requires exactly one of --before and --after', 'cli.unrecognized', { arguments: 'move requires exactly one of --before and --after' }, { pending: !Object.hasOwn(result.flags, 'before') });
    }
    else if (action === 'set') {
        result.option = positional[0];
        result.value = positional[1];
    }
    else if (action === 'item') {
        result.scope = positional[0] as Scope;
        result.id = positional[1];
        result.option = positional[2];
        result.value = positional[3];
    }
    else if (action === 'layout') {
        result.mode = positional[0];
        result.rows = positional.slice(1);
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
                throw new ArgumentError(`required option: --${name}`, 'cli.required', { arguments: '--' + name });
    return result;
}
