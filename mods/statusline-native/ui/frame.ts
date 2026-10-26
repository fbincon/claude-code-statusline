import type { ClientElements, RenderElement } from 'claude-code';

/** Private presentation data. Children reference earlier nodes, never editor state. */
export type FrameNode = [kind: 'Box' | 'Text', attributes: Record<string, string | number | boolean>, children: (number | string)[]];
export type Frame = FrameNode[];
export const OUTPUT_CHARACTERS = 48_000;
export const OUTPUT_VALUES = 10_000;
export const OUTPUT_DEPTH = 16;

export class CapacityError extends Error {
  constructor() { super('Native presentation exceeds its capacity budget'); }
}

/** Conservative preflight, not a replacement for the actual host validator. */
export function withinBudget(value: unknown): boolean {
  try {
    const encoded = JSON.stringify(value);
    // Account for hosts that escape non-ASCII UTF-16 code units in their envelope.
    if (!encoded || encoded.length + (encoded.match(/[^\x00-\x7f]/g)?.length ?? 0) * 5 > OUTPUT_CHARACTERS) return false;
    const pending: [unknown, number][] = [[value, 0]];
    let count = 0;
    while (pending.length) {
      const [item, depth] = pending.pop()!;
      if (typeof item === 'function' || item === undefined) continue;
      if (++count > OUTPUT_VALUES || depth > OUTPUT_DEPTH) return false;
      if (item && typeof item === 'object')
        for (const child of Object.values(item)) pending.push([child, depth + 1]);
    }
    return true;
  } catch { return false; }
}

/** The existing pure drawing rules write a flat, detached presentation frame. */
export function frameElements(): { elements: ClientElements; frame: Frame } {
  const frame: Frame = [];
  let characters = 0;
  const element = (kind: FrameNode[0]) => (props: Record<string, unknown>) => {
    const attributes: FrameNode[1] = {};
    for (const [key, value] of Object.entries(props)) {
      if (key === 'children' || value === undefined) continue;
      if (!['string', 'number', 'boolean'].includes(typeof value)) throw new Error('Unsupported presentation attribute: ' + key);
      attributes[key] = value as string | number | boolean;
    }
    const children = (props.children ?? []) as FrameNode[2];
    const node: FrameNode = [kind, attributes, [...children]];
    characters += JSON.stringify(node).length;
    if (characters > OUTPUT_CHARACTERS || frame.length >= OUTPUT_VALUES) throw new CapacityError();
    frame.push(node);
    return (frame.length - 1) as unknown as RenderElement;
  };
  return { elements: { Box: element('Box'), Text: element('Text') } as unknown as ClientElements, frame };
}

export function drawFrame(ui: Pick<ClientElements, 'Box' | 'Text'>, frame: Frame): RenderElement {
  const nodes: RenderElement[] = [];
  for (const [kind, attributes, children] of frame) {
    const resolved = children.map(child => {
      if (typeof child === 'string') return child;
      if (!Number.isSafeInteger(child) || child < 0 || child >= nodes.length) throw new Error('Invalid presentation reference');
      return nodes[child]!;
    });
    nodes.push(ui[kind]({ ...attributes, children: resolved }));
  }
  if (!nodes.length) throw new Error('Empty presentation frame');
  return nodes[nodes.length - 1]!;
}

/** Same topology as the public render tree, without a host or Client instance. */
export function frameTree(frame: Frame): RenderElement {
  const element = (type: string) => ({ children, ...props }: Record<string, unknown>) => ({ type, props, children });
  return drawFrame({ Box: element('Box'), Text: element('Text') } as unknown as ClientElements, frame);
}
