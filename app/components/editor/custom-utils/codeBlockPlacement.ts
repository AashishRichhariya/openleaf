import { $isCodeNode, CodeNode } from '@lexical/code';
import { $isListItemNode, ListItemNode } from '@lexical/list';
import {
  $createParagraphNode,
  $createTextNode,
  $getSelection,
  $isElementNode,
  $isLineBreakNode,
  $isParagraphNode,
  $isRangeSelection,
  $isRootOrShadowRoot,
  $isTextNode,
  $parseSerializedNode,
  ElementNode,
  LexicalNode,
  RangeSelection,
} from 'lexical';

/*
 * Where the code block from three backticks goes.
 *
 * On a normal line it becomes a block of its own, as from /code. In quotes, headings, list items
 * and indented lines it stays inside, because that is the only way to keep how it looks there.
 * Lexical doesn't expect blocks inside those, so leaving one and starting new blocks from inside
 * one are handled here.
 */

/** A block: something that takes a line of its own */
function $isBlock(node: LexicalNode): boolean {
  return $isElementNode(node) ? !node.isInline() : !node.isInline() && !$isTextNode(node);
}

/** An empty element with everything else as in `node` */
function $createEmptyCopy<T extends ElementNode>(node: T): T {
  return $parseSerializedNode({ ...node.exportJSON(), children: [] } as any) as T;
}

/** Replace `marker` with `code` as a block of its own, keeping what is around it in order */
export function $replaceWithBlock(marker: LexicalNode, code: CodeNode): void {
  const line = marker.getParent();
  if (!$isParagraphNode(line) || line.getIndent() || !$isRootOrShadowRoot(line.getParent())) {
    marker.replace(code);
    return;
  }

  const before = marker.getPreviousSiblings();
  const after = marker.getNextSiblings();
  code.setFormat(line.getFormatType());
  code.setDirection(line.getDirection());

  if (after.length) {
    const rest = $createEmptyCopy(line);
    line.insertAfter(rest);
    rest.append(...after);
  }
  line.insertAfter(code);
  code.selectStart();
  marker.remove(true);

  if (!before.length) {
    line.remove();
  } else {
    const last = before[before.length - 1];
    // The block already starts on a new line
    if ($isLineBreakNode(last)) last.remove(true);
  }
}

/** The innermost block around the caret */
function $getCaretBlock(selection: RangeSelection): ElementNode | null {
  let node: LexicalNode | null = selection.anchor.getNode();
  while (node) {
    if ($isElementNode(node) && !node.isInline()) return node;
    node = node.getParent();
  }
  return null;
}

/** The list item, or else the top-level block, that `block` is nested in */
function $getContainer(block: ElementNode, stopAtListItem: boolean): ElementNode | null {
  let container = block.getParent();
  if (!container || $isRootOrShadowRoot(container)) return null;
  while (
    !(stopAtListItem && $isListItemNode(container))
    && !$isRootOrShadowRoot(container.getParent())
  ) {
    const parent: ElementNode | null = container.getParent();
    if (!parent) return null;
    container = parent;
  }
  return container;
}

/**
 * Move `line` out to just after `container`. What followed the line follows it still, in copies
 * of what it was in. Returns the block that the line became.
 */
function $liftOut(line: ElementNode, container: ElementNode): ElementNode {
  const selection = $getSelection();
  const onLine = $isRangeSelection(selection) && selection.anchor.key === line.getKey()
    ? selection.anchor.offset
    : null;
  const onText = $isRangeSelection(selection) && selection.anchor.type === 'text'
    ? { node: selection.anchor.getNode(), offset: selection.anchor.offset }
    : null;

  const ancestors: ElementNode[] = [];
  let child: LexicalNode = line;
  while (!child.is(container)) {
    const parent: ElementNode = child.getParentOrThrow();
    const following = child.getNextSiblings();
    if (following.length) {
      const rest = $createEmptyCopy(parent);
      parent.insertAfter(rest, false);
      rest.append(...following);
    }
    ancestors.push(parent);
    child = parent;
  }

  let lifted: ElementNode;
  if ($isListItemNode(container)) {
    const item: ListItemNode = $createEmptyCopy(container);
    item.setChecked(container.getChecked() === undefined ? undefined : false);
    container.insertAfter(item, false);
    item.append(...line.getChildren());
    line.remove(true);
    lifted = item;
  } else {
    if ($isParagraphNode(container)) {
      line.setIndent(container.getIndent());
      if (!line.getFormatType()) line.setFormat(container.getFormatType());
    }
    container.insertAfter(line, false);
    lifted = line;
  }

  for (const ancestor of ancestors) {
    if (ancestor.isAttached() && ancestor.isEmpty()) ancestor.remove();
  }

  if (onText && onText.node.isAttached() && $isTextNode(onText.node)) {
    onText.node.select(onText.offset, onText.offset);
  } else if (onLine !== null) {
    lifted.select(onLine, onLine);
  } else {
    lifted.selectStart();
  }
  return lifted;
}

/**
 * Where the caret is in the text beside a nested block, give that line a paragraph of its own.
 * It starts at the caret if `fromCaret`, else at the start of the line.
 */
function $wrapLineBesideBlock(
  selection: RangeSelection,
  fromCaret: boolean,
): ElementNode | null {
  const container = $getCaretBlock(selection);
  if (!container || $isCodeNode(container) || $isRootOrShadowRoot(container)) return null;
  if (!container.getChildren().some($isBlock)) return null;

  let index: number;
  const { anchor } = selection;
  if (anchor.type === 'element') {
    if (anchor.key !== container.getKey()) return null;
    index = anchor.offset;
  } else {
    const anchorNode = anchor.getNode();
    if (!anchorNode.getParent()?.is(container) || !$isTextNode(anchorNode)) return null;
    index = anchorNode.getIndexWithinParent();
    if (fromCaret && anchor.offset > 0) {
      if (anchor.offset < anchorNode.getTextContentSize()) anchorNode.splitText(anchor.offset);
      index += 1;
    }
  }

  const children = container.getChildren();
  let start = index;
  if (!fromCaret) {
    while (start > 0 && !$isBlock(children[start - 1])) start -= 1;
  }
  let end = start;
  while (end < children.length && !$isBlock(children[end])) end += 1;

  const anchorNode = anchor.getNode();
  const { offset, type } = anchor;
  const line = $createParagraphNode();
  // Not append: a list item takes in a paragraph's children instead of the paragraph
  if (start < children.length) children[start].insertBefore(line, false);
  else children[children.length - 1].insertAfter(line, false);
  line.append(...children.slice(start, end));

  if (fromCaret) line.selectStart();
  else if (type === 'element') line.select(index - start, index - start);
  else if ($isTextNode(anchorNode)) anchorNode.select(offset, offset);
  return line;
}

/** Enter in or next to a nested code block */
export function $insertParagraphByNestedBlock(): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return false;
  const block = $getCaretBlock(selection);
  if (!block) return false;

  if ($isCodeNode(block) || $isParagraphNode(block)) {
    if (!$getContainer(block, true)) {
      if ($isCodeNode(block)) return false;
    } else if ($isCodeNode(block) || !block.getChildren().some($isBlock)) {
      const created = selection.insertParagraph();
      // Nothing is created while Enter only adds a line to the code
      if ($isParagraphNode(created)) {
        const container = $getContainer(created, true);
        if (container) $liftOut(created, container);
      }
      return true;
    }
  }

  if (!selection.isCollapsed()) return false;
  const line = $wrapLineBesideBlock(selection, true);
  if (!line) return false;
  const container = $getContainer(line, true);
  if (container) $liftOut(line, container);
  return true;
}

/** Backspace on an empty nested code block leaves the line it was typed on */
export function $deleteNestedCodeBlock(): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;
  if (selection.anchor.offset !== 0) return false;

  const code = $getCaretBlock(selection);
  if (!$isCodeNode(code)) return false;
  const parent = code.getParent();
  if (!parent || $isRootOrShadowRoot(parent)) return false;

  const anchorNode = selection.anchor.getNode();
  if (!anchorNode.is(code) && !anchorNode.is(code.getFirstChild())) return false;
  const index = code.getIndexWithinParent();
  if (index > 0 && !code.isEmpty()) return false;

  // Highlighted runs become plain text
  const content = code.getChildren().map((child) =>
    ($isTextNode(child) && child.getType() !== 'tab'
      ? $createTextNode(child.getTextContent())
      : child));
  parent.splice(index, 1, content);
  parent.select(index, index);
  return true;
}

/**
 * Give the caret's line a top-level block of its own, so that shortcuts and slash items that
 * create blocks work on it.
 */
export function $liftCaretLine(): void {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) return;

  let block = $getCaretBlock(selection);
  if (!block || $isCodeNode(block)) return;
  if (block.getChildren().some($isBlock)) {
    block = $wrapLineBesideBlock(selection, false);
    if (!block) return;
  } else if (!$isParagraphNode(block)) {
    return;
  }

  const container = $getContainer(block, false);
  if (container) $liftOut(block, container);
}
