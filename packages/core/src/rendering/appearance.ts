import type { RenderTrace } from './trace.js';
import type { DisplayDraft, ItemOptionsDraft, Scope } from '../contracts/ui.js';
import { BY_SCOPE } from '../config/catalog.js';
import * as styles from './styles.js';
import { terminalColor } from './colors.js';
import * as layout from './layout.js';
import { THEME_ROLES as ROLES, ANSI_ROLES as ANSI, ANSI_BLOCKS as BLOCK_ANSI, themeDefinition } from '../editor/themes.js';
export function color(value: string | null): styles.Color | null { return value === null || value === 'default' ? null : value.startsWith('ansi:') ? ['ansi', Number(value.slice(5))] : ['rgb', value]; }
export function outputColor(value: styles.Color | null, config: DisplayDraft): styles.Color | null { return value !== null && config.palette === 'ansi' ? ['ansi', terminalColor(value, 16)!] : value; }
const themes = styles.memo<string, Record<string, string>>(16, key => {
    const [theme, ansi] = JSON.parse(key) as [
        string,
        boolean
    ], definition = themeDefinition(theme), values = definition.foreground;
    const result = Object.fromEntries(ROLES.map((role, i) => [role, styles.serialize({ bold: true, foreground: ansi || theme === 'terminal' ? ['ansi', ANSI[i]!] : ['rgb', values[i]!], background: null })]));
    result.size = result.percentage!;
    result.git_error = styles.serialize({ bold: true, foreground: ansi || theme === 'terminal' ? ['ansi', 1] : ['rgb', definition.critical], background: null });
    result.separator = styles.serialize({ bold: false, foreground: ansi || theme === 'terminal' ? ['ansi', 8] : ['rgb', definition.separator], background: null });
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
    const role = itemRole(item, scope), index = position === undefined ? (ROLES as readonly string[]).indexOf(role) : position % ROLES.length;
    if (config.separator_style === 'powerline') {
        let foreground: styles.Color, background: styles.Color;
        if (config.palette === 'ansi' || config.theme === 'terminal') {
            background = ['ansi', BLOCK_ANSI[index]!];
            foreground = ['ansi', [3, 6].includes(BLOCK_ANSI[index]!) ? 0 : 15];
        }
        else {
            const definition = themeDefinition(config.theme);
            background = ['rgb', definition.backgrounds[index]!];
            foreground = ['rgb', definition.blockText];
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
                : ['rgb', themeDefinition(config.theme).surface === 'light' ? '#ffffff' : '#000000'];
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
    return ['rgb', critical ? themeDefinition(config.theme).critical : themeDefinition(config.theme).warning];
}
export function apply(text: string, config: DisplayDraft, item: string, options: ItemOptionsDraft, scope: Scope = 'main', used: number | null = null, trace?:RenderTrace, id?:string): string {
    if (!config.use_colors)
        return layout.withoutColors(text);
    const block = config.separator_style === 'powerline', risk = riskColor(used, config);
    if(risk&&id)trace?.style(scope,id,used!>=config.formatting.thresholds.critical?'threshold_critical':'threshold_warning');
    if (config.theme === 'classic' && !block && options.foreground === null && options.background === null && risk === null)
        return text;
    const base = baseStyle(config, item, scope), foreground = outputColor(color(options.foreground), config), background = outputColor(color(options.background), config);
    return layout.renderStyledUnits(layout.styledUnits(text).map(unit => {
        const state = styles.parse(unit.style), fg = options.foreground !== null ? foreground : block ? base.foreground : state.foreground ?? base.foreground;
        const bg = options.background !== null ? background : block ? base.background : state.background;
        return { ...unit, style: styles.serialize({ bold: state.bold || block || risk !== null, foreground: risk ?? fg, background: bg }) };
    }));
}
