/** Group-aware layout is opt-in; ungrouped configurations keep their old path. */
import type { DisplayDraft, GroupDraft, Scope } from '../contracts/ui.js';
import type { Cell } from './components.js';
import type { FitObserver } from './trace.js';
import * as layout from './layout.js';
import * as powerline from './powerline.js';
import * as appearance from './appearance.js';
import * as styles from './styles.js';

interface Unit { id: string; priority: number; cells: Cell[]; group?: GroupDraft; spacer?: boolean }
// '$' cannot occur in user instance/group identifiers.
export const SCOPE_LABEL_ID = '$scope';
export function groupedRows(cells: readonly Cell[], groups: readonly GroupDraft[], config: DisplayDraft, scope: Scope,
  columns: number, separator: string, auto: boolean, observe?: FitObserver, colors = powerline.cursor(scope)): string[] {
  columns = Math.max(2, Math.trunc(columns));
  const nodes = new Map((scope === 'main' ? config.instances : config.subagents.instances).map(n => [n.id, n]));
  const byId = new Map(cells.map(c => [c.id, c])), membership = new Map(groups.flatMap(g => g.member_ids.map(id => [id, g] as const)));
  const units: Unit[] = [], seen = new Set<string>();
  const drop = (cell: Cell, reason: 'group_hidden' | 'width_omitted' | 'priority_omitted') => observe?.(cell.id, reason);
  for (const cell of cells) {
    const group = membership.get(cell.id);
    if (!group) { if (cell.text || cell.spacer) units.push({ id: cell.id, priority: cell.priority, cells: [{ ...cell }], spacer: cell.spacer }); continue; }
    if (seen.has(group.id)) continue;
    seen.add(group.id);
    const primary = byId.get(group.primary_id);
    const members = group.member_ids.flatMap(id => {
      const value = byId.get(id);
      if (!value?.text) return [];
      if (group.link_visibility && !primary?.text && nodes.get(id)?.type_id === 'text') { drop(value, 'group_hidden'); return []; }
      return [{ ...value }];
    });
    if (members.length) units.push({ id: group.id, priority: nodes.get(group.primary_id)!.options.priority, cells: members, group });
  }
  if (!units.some(unit => unit.id !== SCOPE_LABEL_ID && !unit.spacer)) return [];
  const isPowerline = config.separator_style === 'powerline';
  const draw = (values: readonly Unit[], padding: boolean, caps: boolean, start: number): { text: string; next: number } => {
    if (!isPowerline) return { text: values.map(u => u.cells.map(c => c.paint?.(c.text) ?? c.text).join(u.group ? ' ' : separator)).join(separator), next: start };
    const blocks: powerline.Block[] = [];
    let index = start;
    for (const unit of values) {
      if (unit.group?.shared_powerline) {
        const primary = nodes.get(unit.group.primary_id)!;
        const base = byId.get(primary.id)?.text || appearance.apply(' ', config, primary.type_id, primary.options, scope);
        const primaryStyle = styles.parse(layout.styledUnits(appearance.sequence(base, config, primary.id, scope, index))[0]?.style ?? '');
        const text = unit.cells.map(c => c.paint?.(c.text) ?? c.text).join(' ');
        const shared = config.use_colors ? layout.renderStyledUnits(layout.styledUnits(text).map(c => ({ ...c, style: styles.serialize({ ...styles.parse(c.style), background: primaryStyle.background }) }))) : layout.withoutColors(text);
        blocks.push({ text: shared, sequence: false, background_gradient: primary.options.background_gradient }); index++;
      } else for (const cell of unit.cells) {
        blocks.push({ text: cell.sequence === false ? cell.text : appearance.sequence(cell.text, config, cell.id, scope, index++), sequence: false,
          paint: cell.paint, background_gradient: nodes.get(cell.id)?.options.background_gradient });
      }
    }
    return { text: powerline.row(blocks, config, padding, caps), next: index };
  };
  const measure = (values: readonly Unit[], padding = true, caps = true) => layout.displayWidth(draw(values, padding, caps, config.powerline.color_mode === 'restart' ? 0 : colors.index).text);
  const trim = (unit: Unit, width: number, padding: boolean, caps: boolean) => {
    const anchor = unit.cells.find(c => c.id === unit.group?.primary_id) ?? unit.cells.reduce((a, b) => a.priority >= b.priority ? a : b);
    const victims = unit.cells.filter(c => c !== anchor).sort((a, b) => Number(nodes.get(b.id)?.type_id === 'text') - Number(nodes.get(a.id)?.type_id === 'text') || a.priority - b.priority);
    for (const victim of victims) {
      if (measure([unit], padding, caps) <= width) break;
      drop(victim, 'width_omitted'); unit.cells = unit.cells.filter(c => c !== victim);
    }
    if (measure([unit], padding, caps) > width) {
      // All decorations have gone before truncating the remaining metric.
      const overhead = measure([unit], padding, caps) - layout.displayWidth(anchor.text);
      const shortened = layout.truncateStyled(anchor.text, Math.max(0, width - overhead));
      observe?.(anchor.id, shortened ? 'truncated' : 'width_omitted'); anchor.text = shortened;
      unit.cells = shortened ? [anchor] : [];
    }
  };
  const emit = (input: Unit[]): string => {
    if (config.powerline.color_mode === 'restart') colors.index = 0;
    const divider = input.findIndex(u => u.spacer), left = input.slice(0, divider < 0 ? input.length : divider), right = divider < 0 ? [] : input.slice(divider + 1);
    let padding = true, caps = true;
    const drawing = () => { const a = draw(left, padding, caps, colors.index), b = draw(right, padding, caps, a.next); return { a, b, width: layout.displayWidth(a.text) + layout.displayWidth(b.text) }; };
    if (isPowerline && drawing().width > columns) padding = false;
    if (isPowerline && drawing().width > columns) caps = false;
    // Make an over-wide group a usable unit before comparing row priorities.
    for (const u of [...left, ...right]) if (measure([u], padding, caps) > columns) trim(u, columns, padding, caps);
    while (left.length + right.length > 1 && drawing().width > columns) {
      const candidates = [...left, ...right];
      const victim = candidates.reduce((a, b) => a.priority < b.priority ? a : b);
      victim.cells.forEach(c => drop(c, 'priority_omitted'));
      const side = left.includes(victim) ? left : right; side.splice(side.indexOf(victim), 1);
    }
    const output = drawing(); colors.index = output.b.next;
    const gap = divider < 0 ? '' : ' '.repeat(Math.max(0, columns - output.width));
    return layout.ensureReset(output.a.text + (gap ? (config.use_colors ? styles.RESET : '') + gap : '') + output.b.text, config.use_colors ? styles.RESET : '');
  };
  if (!auto) { const row = emit(units); return layout.strip(row).trim() ? [row] : []; }
  const rows: string[] = []; let line: Unit[] = [];
  for (const unit of units) {
    if (line.some(u => u.id !== SCOPE_LABEL_ID && !u.spacer) && measure([...line, unit]) > columns) { rows.push(emit(line)); line = []; }
    line.push(unit);
  }
  if (line.length) rows.push(emit(line));
  return rows.filter(Boolean);
}
