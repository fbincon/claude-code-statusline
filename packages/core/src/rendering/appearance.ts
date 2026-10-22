import type { DisplayDraft, ItemOptionsDraft, Scope } from '../contracts/ui.js';
import { BY_SCOPE } from '../config/catalog.js';
import * as styles from './styles.js';
import { terminalColor } from './colors.js';
import * as layout from './layout.js';
const ROLES = ['model', 'directory', 'branch', 'percentage', 'tokens', 'timer'];
const DARK = ['#f6e2b7', '#abdfa7', '#c8a9ee', '#f2b590', '#e990a9', '#8ed3d3'], LIGHT = ['#664515', '#205727', '#633487', '#864511', '#93284a', '#126168'];
const BLOCK_DARK = ['#3c3548', '#234337', '#3d3155', '#543720', '#542b3c', '#1f4148'], BLOCK_LIGHT = ['#eee1c4', '#d6ecd4', '#e7dcf2', '#f5dfce', '#f4d8e1', '#d1ecec'];
const ANSI = [3, 2, 5, 3, 5, 6], BLOCK_ANSI = [4, 2, 5, 3, 1, 6];
export function color(value: string | null): styles.Color | null { return value === null || value === 'default' ? null : value.startsWith('ansi:') ? ['ansi', Number(value.slice(5))] : ['rgb', value]; }
export function outputColor(value: styles.Color | null, config: DisplayDraft): styles.Color | null { return value !== null && config.palette === 'ansi' ? ['ansi', terminalColor(value, 16)!] : value; }
const themes = styles.memo<string, Record<string, string>>(16, key => {
    const [theme, ansi] = JSON.parse(key) as [
        string,
        boolean
    ], values = theme === 'light' ? LIGHT : DARK;
    const result = Object.fromEntries(ROLES.map((role, i) => [role, styles.serialize({ bold: true, foreground: ansi || theme === 'terminal' ? ['ansi', ANSI[i]!] : ['rgb', values[i]!], background: null })]));
    result.size = result.percentage!;
    result.git_error = styles.serialize({ bold: true, foreground: ansi || theme === 'terminal' ? ['ansi', 1] : ['rgb', theme === 'light' ? '#a02020' : '#f28686'], background: null });
    result.separator = styles.serialize({ bold: false, foreground: ansi || theme === 'terminal' ? ['ansi', 8] : ['rgb', theme === 'light' ? '#58616b' : '#aab2bd'], background: null });
    return result;
});
export function themeStyles(theme: string, ansi: boolean) { return themes(JSON.stringify([theme, ansi])); }
export function themedPalette<T extends Record<string, string>>(palette: T, config: DisplayDraft, subagent = false): T {
    if (!config.use_colors || config.theme === 'classic')
        return palette;
    const roles = themeStyles(config.theme, config.palette === 'ansi');
    if (!subagent)
        return { ...palette, ...roles };
    const mapping: Record<string, string> = { status: 'timer', name: 'model', model: 'model', context: 'percentage', elapsed: 'timer', task: 'directory', tokens: 'tokens', directory: 'directory', separator: 'separator' };
    return { ...palette, ...Object.fromEntries(Object.entries(mapping).map(([key, role]) => [key, roles[role]!])) };
}
export function itemRole(item: string, scope: Scope): string {
    const group = BY_SCOPE[scope].get(item)?.group ?? 'task';
    const roles: Record<string, string> = { model: 'model', location: 'directory', repo: 'branch', context: 'percentage', limits: 'percentage', usage: 'tokens', cache: 'tokens', requests: 'tokens' };
    return roles[group] ?? 'timer';
}
export function baseStyle(config: DisplayDraft, item: string, scope: Scope, position?: number): styles.Style {
    const role = itemRole(item, scope), index = position === undefined ? ROLES.indexOf(role) : position % ROLES.length;
    if (config.separator_style === 'powerline') {
        let foreground: styles.Color, background: styles.Color;
        if (config.palette === 'ansi' || config.theme === 'terminal') {
            background = ['ansi', BLOCK_ANSI[index]!];
            foreground = ['ansi', [3, 6].includes(BLOCK_ANSI[index]!) ? 0 : 15];
        }
        else {
            const light = config.theme === 'light';
            background = ['rgb', (light ? BLOCK_LIGHT : BLOCK_DARK)[index]!];
            foreground = ['rgb', light ? '#202630' : '#f4f5f7'];
        }
        return { bold: true, foreground, background };
    }
    return styles.parse(themeStyles(config.theme, config.palette === 'ansi')[role]!);
}
/** Recolor inherited block channels after fitting; explicit overrides and risk colors survive. */
export function sequence(text: string, config: DisplayDraft, id: string, scope: Scope, index: number): string {
    if (!config.use_colors || config.powerline.color_mode === 'semantic') return text;
    const node = (scope === 'main' ? config.instances : config.subagents.instances).find(node => node.id === id);
    if (!node || node.type_id === 'spacer') return text;
    const previous = baseStyle(config, node.type_id, scope), next = baseStyle(config, node.type_id, scope, index);
    return layout.renderStyledUnits(layout.styledUnits(text).map(unit => {
        const state = styles.parse(unit.style);
        const foreground = node.options.foreground === null && styles.sameColor(state.foreground, previous.foreground) ? next.foreground : state.foreground;
        let background = node.options.background === null ? next.background : state.background;
        // ANSI warning/red thresholds can match a rotating yellow/red block.
        // Keep threshold and explicit foreground colors; only adjust inherited backgrounds.
        if (node.options.background === null && foreground !== null && styles.sameColor(foreground, background))
            background = config.palette === 'ansi' || config.theme === 'terminal' ? ['ansi', 0]
                : ['rgb', config.theme === 'light' ? '#ffffff' : '#000000'];
        return { ...unit, style: styles.serialize({ ...state,
            foreground, background,
        }) };
    }));
}
export function riskColor(used: number | null, config: DisplayDraft): styles.Color | null {
    const limits = config.formatting.thresholds;
    if (!limits.enabled || used === null || used < limits.warning)
        return null;
    const critical = used >= limits.critical;
    if (config.palette === 'ansi' || config.theme === 'terminal')
        return ['ansi', critical ? 1 : 3];
    return ['rgb', config.theme === 'light' ? critical ? '#a02020' : '#805000' : critical ? '#f28686' : '#f2b550'];
}
export function apply(text: string, config: DisplayDraft, item: string, options: ItemOptionsDraft, scope: Scope = 'main', used: number | null = null): string {
    if (!config.use_colors)
        return layout.strip(text);
    const block = config.separator_style === 'powerline', risk = riskColor(used, config);
    if (config.theme === 'classic' && !block && options.foreground === null && options.background === null && risk === null)
        return text;
    const base = baseStyle(config, item, scope), foreground = outputColor(color(options.foreground), config), background = outputColor(color(options.background), config);
    return layout.renderStyledUnits(layout.styledUnits(text).map(unit => {
        const state = styles.parse(unit.style), fg = options.foreground !== null ? foreground : block ? base.foreground : state.foreground ?? base.foreground;
        const bg = options.background !== null ? background : block ? base.background : state.background;
        return { ...unit, style: styles.serialize({ bold: state.bold || block || risk !== null, foreground: risk ?? fg, background: bg }) };
    }));
}
