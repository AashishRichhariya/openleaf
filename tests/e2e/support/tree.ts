/**
 * A compact, readable form of a serialized document, for exact comparisons.
 *
 * It leaves out only what carries no meaning: key order, schema versions, text direction (checked
 * through computed styles instead) and values equal to their default, including the null that
 * 0.3.0 stored in place of an empty string.
 */

const FORMATS = ['b', 'i', 's', 'u', 'c', 'sub', 'sup', 'mark'];
const IGNORED = new Set(['type', 'version', 'children', 'direction', 'text']);
const DEFAULT_ONE = new Set(['colSpan', 'rowSpan']);

function isDefault(key: string, value: unknown): boolean {
  if (value === null || value === undefined || value === '' || value === 0 || value === false) {
    return true;
  }
  return (key === 'mode' && value === 'normal') || (DEFAULT_ONE.has(key) && value === 1);
}

function serialize(node: any, depth: number): string {
  const pad = '  '.repeat(depth);
  const attributes = Object.keys(node)
    .filter((key) => !IGNORED.has(key) && !isDefault(key, node[key]))
    .filter((key) => !(key === 'format' && typeof node[key] === 'number'))
    .sort()
    .map((key) => ` ${key}=${JSON.stringify(node[key])}`)
    .join('');
  let head = `${pad}${node.type}${attributes}`;
  if (typeof node.format === 'number' && node.format) {
    head += ` +${FORMATS.filter((_, bit) => node.format & (1 << bit)).join('+')}`;
  }
  if ('text' in node) head += ` ${JSON.stringify(node.text ?? '')}`;
  return [head, ...(node.children ?? []).map((child: any) => serialize(child, depth + 1))]
    .join('\n');
}

export function tree(content: any): string {
  // A document without content is one empty paragraph in the editor.
  const blocks: any[] = content?.root?.children ?? [];
  if (!blocks.length) return 'paragraph';
  return blocks.map((block) => serialize(block, 0)).join('\n');
}

/** All text in document order, to prove that no content was lost. */
export function plainText(content: any): string {
  const walk = (node: any): string =>
    node.text ?? node.equation ?? (node.children ?? []).map(walk).join('|');
  return content?.root ? walk(content.root).replace(/\|+/g, '|') : '';
}

/** The types along the first branch, such as `paragraph>code`, for nesting checks. */
export function shape(node: any): string {
  const children = (node.children ?? []).filter((child: any) => child.children);
  return children.length ? `${node.type}[${children.map(shape).join(',')}]` : node.type;
}
