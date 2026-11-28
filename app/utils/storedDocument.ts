/*
 * What is stored for a document, and how to read what older versions stored. Shared by server
 * and client, so this file must not import Lexical or anything server-only.
 */

export interface SerializedBlock {
  type: string;
  children?: SerializedBlock[];
  [key: string]: unknown;
}

export interface DocumentContent {
  root: SerializedBlock;
  [key: string]: unknown;
}

const EMPTY_PARAGRAPH: SerializedBlock = {
  children: [],
  direction: null,
  format: '',
  indent: 0,
  type: 'paragraph',
  version: 1,
};

/** The table size widget is UI, so it is never stored. */
const TRANSIENT_TYPES = new Set(['inline-table-input-node']);
/** These count as content even while they have no text. */
const CONTENT_TYPES = new Set(['table', 'code']);
/** Up to 0.3.0 DynamoDB stored these as null when they were empty strings. */
const STRING_FIELDS = new Set(['style', 'textStyle', 'equation', 'text', 'format']);
/** Blocks that up to 0.3.0 could end up inside a paragraph. */
const BLOCK_TYPES = new Set([
  'code', 'paragraph', 'heading', 'quote', 'list', 'table', 'horizontalrule',
]);

// Far beyond what a document can store: 400 KB compressed, 31 levels of nesting
const MAX_NODES = 100_000;
const MAX_DEPTH = 100;

/**
 * Whether content is small and shallow enough to work on. Checked without recursion, as content
 * nested too deeply for the stack is what it must catch.
 */
export function isWithinLimits(content: DocumentContent): boolean {
  const pending: Array<[unknown, number]> = [[content.root, 0]];
  let nodes = 0;
  while (pending.length) {
    const [node, depth] = pending.pop()!;
    if (++nodes > MAX_NODES || depth > MAX_DEPTH) return false;
    const children = (node as SerializedBlock | null)?.children;
    if (Array.isArray(children)) {
      for (const child of children) pending.push([child, depth + 1]);
    }
  }
  return true;
}

export function isDocumentContent(value: unknown): value is DocumentContent {
  const root = (value as DocumentContent | null)?.root;
  return Array.isArray(root?.children)
    && root.children.every((block) => typeof block?.type === 'string');
}

/**
 * Checks if a document has no meaningful content.
 *
 * @param content The editor state to check
 * @returns true if the content is empty or null, false otherwise
 */
export function isContentEmpty(content: DocumentContent | null | undefined): boolean {
  const hasContent = (node: SerializedBlock): boolean => {
    if (node?.type === 'text') return typeof node.text === 'string' && node.text.trim().length > 0;
    if (CONTENT_TYPES.has(node?.type)) return true;
    if (Array.isArray(node?.children)) return node.children.some(hasContent);
    // Any other node counts as content
    return Boolean(node?.type);
  };
  return !content?.root?.children?.some(hasContent);
}

/** The top-level blocks. No content is one empty paragraph, as the editor shows it. */
export function getBlocks(content: DocumentContent | null): SerializedBlock[] {
  return content?.root.children?.length ? content.root.children : [EMPTY_PARAGRAPH];
}

/** A copy without what is only there while editing. */
export function withoutTransientNodes(content: DocumentContent): DocumentContent {
  const strip = (node: SerializedBlock): SerializedBlock =>
    (node.children
      ? {
        ...node,
        children: node.children.filter((child) => !TRANSIENT_TYPES.has(child.type)).map(strip),
      }
      : node);
  return { ...content, root: strip(content.root) };
}

function restoreEmptyStrings(node: SerializedBlock): SerializedBlock {
  const restored: SerializedBlock = { ...node };
  for (const [key, value] of Object.entries(node)) {
    if (value === null && STRING_FIELDS.has(key)) restored[key] = '';
  }
  if (Array.isArray(node.children)) restored.children = node.children.map(restoreEmptyStrings);
  return restored;
}

/**
 * Up to 0.3.0 three backticks put the code block inside its paragraph, along with every line
 * typed after it. Lift those blocks out, keeping order and look.
 *
 * An indented paragraph keeps its nesting, because the block's indentation comes from it. So
 * do quotes, headings and list items, whose look surrounds the block.
 */
function liftNestedBlocks(block: SerializedBlock): SerializedBlock[] {
  const children = block.children;
  if (!children) return [block];

  if (
    block.type !== 'paragraph'
    || block.indent
    || !children.some((child) => BLOCK_TYPES.has(child.type))
  ) {
    return [liftInShadowRoots(block)];
  }

  const lifted: SerializedBlock[] = [];
  let line: SerializedBlock[] = [];
  for (const child of children) {
    if (!BLOCK_TYPES.has(child.type)) {
      line.push(child);
      continue;
    }
    if (line.length) {
      // The block already starts on a new line.
      if (line.at(-1)?.type === 'linebreak') line = line.slice(0, -1);
      lifted.push({ ...block, children: line });
      line = [];
    }
    // A block used to take its alignment from the paragraph around it.
    const aligned = child.children && !child.format ? { ...child, format: block.format } : child;
    lifted.push(...liftNestedBlocks(aligned));
  }
  if (line.length) lifted.push({ ...block, children: line });
  return lifted;
}

function liftInShadowRoots(block: SerializedBlock): SerializedBlock {
  if (!block.children) return block;
  const children = block.type === 'tablecell'
    ? block.children.flatMap(liftNestedBlocks)
    : block.children.map(liftInShadowRoots);
  return { ...block, children };
}

/** A stored document as the editor should get it, whichever version stored it. */
export function readStoredContent(content: unknown): DocumentContent | null {
  if (!isDocumentContent(content)) return null;
  const root = restoreEmptyStrings(content.root);
  return { ...content, root: { ...root, children: root.children!.flatMap(liftNestedBlocks) } };
}

/**
 * A string that is equal for equal content. It ignores key order (DynamoDB does not keep it),
 * text direction (derived from the text) and fields at their empty default, which versions
 * write differently.
 */
export function toComparable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(toComparable).join(',')}]`;
  if (value && typeof value === 'object') {
    const fields: string[] = [];
    for (const key of Object.keys(value).sort()) {
      const field = (value as Record<string, unknown>)[key];
      if (!field || key === 'direction') continue;
      fields.push(`${JSON.stringify(key)}:${toComparable(field)}`);
    }
    return `{${fields.join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}
