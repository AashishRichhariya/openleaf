import { $isCodeNode, CodeHighlightNode, CodeNode } from '@lexical/code';
import { AutoLinkNode, LinkNode } from '@lexical/link';
import {
  $createListItemNode,
  $createListNode,
  $insertList,
  $isListItemNode,
  $isListNode,
  INSERT_CHECK_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  ListItemNode,
  ListNode,
  ListType,
} from '@lexical/list';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $createHorizontalRuleNode,
  $isHorizontalRuleNode,
  INSERT_HORIZONTAL_RULE_COMMAND,
} from '@lexical/react/LexicalHorizontalRuleNode';
import { $isHeadingNode, $isQuoteNode, HeadingNode, QuoteNode } from '@lexical/rich-text';
import {
  $createTableNodeWithDimensions,
  $findTableNode,
  $isTableNode,
  $isTableSelection,
  INSERT_TABLE_COMMAND,
  TableCellNode,
  TableNode,
  TableRowNode,
} from '@lexical/table';
import {
  $findMatchingParent,
  $getNearestBlockElementAncestorOrThrow,
  $insertNodeToNearestRootAtCaret,
  mergeRegister,
} from '@lexical/utils';
import {
  $caretFromPoint,
  $createParagraphNode,
  $getAdjacentChildCaret,
  $getAdjacentNode,
  $getCollapsedCaretRange,
  $getNearestNodeFromDOMNode,
  $getPreviousSelection,
  $getRoot,
  $getSelection,
  $isChildCaret,
  $isDecoratorNode,
  $isElementNode,
  $isNodeSelection,
  $isParagraphNode,
  $isRangeSelection,
  $isTabNode,
  $isTextNode,
  $normalizeCaret,
  $setSelectionFromCaretRange,
  CLICK_COMMAND,
  COMMAND_PRIORITY_BEFORE_CRITICAL,
  COMMAND_PRIORITY_BEFORE_EDITOR,
  COMMAND_PRIORITY_CRITICAL,
  COMMAND_PRIORITY_LOW,
  COMMAND_PRIORITY_NORMAL,
  DELETE_CHARACTER_COMMAND,
  ElementNode,
  FORMAT_TEXT_COMMAND,
  HISTORY_MERGE_TAG,
  INDENT_CONTENT_COMMAND,
  INSERT_PARAGRAPH_COMMAND,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  KEY_ENTER_COMMAND,
  LexicalEditor,
  LexicalNode,
  LineBreakNode,
  NodeKey,
  ParagraphNode,
  TabNode,
  TextNode,
  OUTDENT_CONTENT_COMMAND,
  RootNode,
  PASTE_COMMAND,
  PASTE_TAG,
  SELECTION_CHANGE_COMMAND,
  SELECTION_INSERT_CLIPBOARD_NODES_COMMAND,
} from 'lexical';
import { useEffect } from 'react';

/*
 * What Lexical 0.31.1 did and 0.53 does differently, where a returning user would notice. Each
 * part says what it restores. The parity tests in tests/e2e fail if one of them goes.
 */

// From packages/lexical/src/LexicalConstants.ts at v0.31.1
const RTL = '֑-߿יִ-﷽ﹰ-ﻼ';
const LTR =
  'A-Za-zÀ-ÖØ-ö'
  + 'ø-ʸ̀-֐ࠀ-῿‎Ⰰ-﬜'
  + '︀-﹯﻽-￿';
const RTL_REGEX = new RegExp(`^[^${LTR}]*[${RTL}]`);
const LTR_REGEX = new RegExp(`^[^${RTL}]*[${LTR}]`);

function $getTextDirection(element: ElementNode): 'ltr' | 'rtl' | null {
  for (let child = element.getFirstChild(); child; child = child.getNextSibling()) {
    if ($isTextNode(child) && !child.isDirectionless()) {
      const text = child.getTextContent();
      if (RTL_REGEX.test(text)) return 'rtl';
      if (LTR_REGEX.test(text)) return 'ltr';
    }
  }
  return null;
}

/** Sets the direction of an element and everything in it. Returns whether anything changed. */
function $syncBlockDirection(
  block: ElementNode,
  incoming: 'ltr' | 'rtl' | null,
): { changed: boolean; outgoing: 'ltr' | 'rtl' | null } {
  let active = incoming;
  let changed = false;
  const visit = (element: ElementNode) => {
    for (let child = element.getFirstChild(); child; child = child.getNextSibling()) {
      if ($isElementNode(child)) visit(child);
    }
    const direction = $getTextDirection(element) ?? active;
    active = direction;
    if (direction && element.getDirection() !== direction) {
      element.setDirection(direction);
      changed = true;
    }
  };
  visit(block);
  return { changed, outgoing: active };
}

/**
 * Direction as Lexical 0.31 reconciled it: from an element's own text, else from the last element
 * before it in document order that has one. So an empty line follows the line above, a list its
 * last item and the root its last block.
 *
 * Only changed blocks are visited, and the blocks after them as long as they change too.
 */
function $syncDirection(root: RootNode, changedBlocks: Set<NodeKey>): void {
  let incoming: 'ltr' | 'rtl' | null = null;
  let follow = false;
  for (let block = root.getFirstChild(); block; block = block.getNextSibling()) {
    if (!$isElementNode(block)) continue;
    const isChanged = changedBlocks.has(block.getKey());
    if (isChanged || follow) {
      const { changed, outgoing } = $syncBlockDirection(block, incoming);
      // The next block may start from this one's direction
      follow = changed || isChanged;
      incoming = outgoing;
    } else {
      incoming = block.getDirection() ?? incoming;
    }
  }
  if (incoming && root.getDirection() !== incoming) root.setDirection(incoming);
}

// Every kind of node that can change a block's direction, so that changed blocks are known
const DIRECTION_SOURCES = [
  TextNode, CodeHighlightNode, TabNode, LineBreakNode, ParagraphNode, HeadingNode, QuoteNode,
  ListNode, ListItemNode, CodeNode, TableNode, TableRowNode, TableCellNode, LinkNode, AutoLinkNode,
];

/**
 * The root's transform runs last in every update that changes anything, inside that update, so it
 * neither adds an undo step nor joins one to another. The other transforms note what changed.
 */
function registerTextDirection(editor: LexicalEditor): () => void {
  const changedBlocks = new Set<NodeKey>();
  const note = (node: LexicalNode) => {
    const block = node.getTopLevelElement();
    if (block) changedBlocks.add(block.getKey());
  };
  return mergeRegister(
    ...DIRECTION_SOURCES.map((klass) =>
      editor.registerNodeTransform(klass as unknown as typeof TextNode, note)),
    editor.registerNodeTransform(RootNode, (root) => {
      $syncDirection(root, changedBlocks);
      changedBlocks.clear();
    }),
  );
}

/** Backspace at the start of a list item joins it to what is above, instead of splitting the list */
function $isAtListItemStart(event: KeyboardEvent): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !selection.isCollapsed() || selection.anchor.offset !== 0) {
    return false;
  }
  if (event.target && $isDecoratorNode($getNearestNodeFromDOMNode(event.target as Node))) {
    return false;
  }
  let node: LexicalNode = selection.anchor.getNode();
  while (!$isListItemNode(node)) {
    if (node.getPreviousSibling()) return false;
    const parent: ElementNode | null = node.getParent();
    if (!parent) return false;
    node = parent;
  }
  return true;
}

/** A divider or table leaves an empty line after it, also when there is content below */
function $insertBlockKeepingLine(node: LexicalNode): boolean {
  const selection = $getSelection() || $getPreviousSelection();
  if (!$isRangeSelection(selection)) return false;
  const after = $insertNodeToNearestRootAtCaret(node, $caretFromPoint(selection.focus, 'next'));
  const adjacent = $getAdjacentChildCaret(after);
  $setSelectionFromCaretRange(
    $getCollapsedCaretRange($isChildCaret(adjacent) ? $normalizeCaret(adjacent) : after),
  );
  return true;
}

/** Arrow Up and Down skip over a divider, and leave a selected node as 0.31 did */
function $moveNearDivider(event: KeyboardEvent, backward: boolean): boolean {
  const selection = $getSelection();
  if ($isNodeSelection(selection)) {
    const [node] = selection.getNodes();
    if (!node) return false;
    // Without preventDefault: the browser moves the caret on from there
    if (backward) node.selectPrevious();
    else node.selectNext(0, 0);
    return true;
  }
  if (event.shiftKey || !$isRangeSelection(selection) || !selection.isCollapsed()) return false;
  const adjacent = $getAdjacentNode(selection.focus, backward);
  if ($isHorizontalRuleNode(adjacent)) {
    if (backward) adjacent.selectPrevious();
    else adjacent.selectNext();
    event.preventDefault();
    return true;
  }
  if (selection.focus.key === 'root') return false;
  const block = selection.anchor.getNode().getTopLevelElement();
  const sibling = backward ? block?.getPreviousSibling() : block?.getNextSibling();
  // Handled, without preventDefault: the browser moves the caret
  return $isHorizontalRuleNode(sibling);
}

/**
 * In a code block the arrows move the caret natively, except that they leave the block from its
 * first or last line when nothing is before or after it.
 */
function $moveInCode(event: KeyboardEvent, up: boolean): boolean {
  const selection = $getSelection();
  if (event.altKey || !$isRangeSelection(selection)) return false;
  const anchor = selection.anchor.getNode();
  const code = anchor.getParent();
  if (!$isCodeNode(code) || !code.is(selection.focus.getNode().getParent())) return false;
  if (selection.isCollapsed()) {
    const atStart = up && selection.anchor.offset === 0 && !anchor.getPreviousSibling();
    const atEnd = !up
      && selection.anchor.offset === anchor.getTextContentSize()
      && !anchor.getNextSibling();
    if ((atStart && !code.getPreviousSibling()) || (atEnd && !code.getNextSibling())) {
      if (up) code.selectPrevious();
      else code.selectNext();
      event.preventDefault();
      return true;
    }
  }
  return true;
}

/** Whether the selection runs from the start of the document to its end */
function $isWholeDocumentSelected(): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || selection.isCollapsed()) return false;
  const root = $getRoot();
  const [start, end] = selection.isBackward()
    ? [selection.focus, selection.anchor]
    : [selection.anchor, selection.focus];
  const first = root.getFirstDescendant();
  const last = root.getLastDescendant();
  const startsAtStart = !!first && start.getNode().is(first) && start.offset === 0;
  const endOffset = $isTextNode(last) ? last.getTextContentSize() : 0;
  const endsAtEnd = !!last && end.getNode().is(last) && end.offset === endOffset;
  return startsAtStart && endsAtEnd;
}

/** Deleting everything in a document that starts with a list leaves an empty item */
function $deleteWholeDocument(): boolean {
  if (!$isWholeDocumentSelected()) return false;
  const first = $getRoot().getFirstChild();
  const selection = $getSelection();
  if (!$isListNode(first) || !$isRangeSelection(selection)) return false;
  selection.removeText();
  const remaining = $getRoot().getFirstChild();
  if ($isParagraphNode(remaining) && remaining.isEmpty()) {
    const item = $createListItemNode(first.getListType() === 'check' ? false : undefined);
    remaining.replace($createListNode(first.getListType()).append(item));
    item.select();
  }
  return true;
}

/**
 * Backspace at the start of a heading or quote below an empty line turns it into that line, and
 * Delete on an empty line before a table does nothing.
 */
function $deleteNextToEmptyLine(isBackward: boolean): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;
  const anchor = selection.anchor.getNode();
  const block = $isElementNode(anchor) ? anchor : anchor.getParent();
  if (!block || !block.getParent()?.is($getRoot())) return false;

  if (!isBackward) {
    return $isParagraphNode(block) && block.isEmpty() && $isTableNode(block.getNextSibling());
  }
  const atStart = block.is(anchor) || !!block.getFirstDescendant()?.is(anchor);
  if (selection.anchor.offset !== 0 || !atStart) return false;
  const previous = block.getPreviousSibling();
  if (!$isParagraphNode(previous) || !previous.isEmpty()) return false;
  if (!$isHeadingNode(block) && !$isQuoteNode(block)) return false;
  previous.append(...block.getChildren());
  block.remove();
  previous.selectStart();
  return true;
}

/**
 * Backspace over a selection that empties the first block removes that block, or turns a heading
 * or quote into a plain line, as Lexical 0.31 did after deleting a selection.
 */
function $deleteSelectionInFirstBlock(isBackward: boolean): boolean {
  const selection = $getSelection();
  if (!isBackward || !$isRangeSelection(selection) || selection.isCollapsed()) return false;
  const [start, end] = selection.isBackward()
    ? [selection.focus, selection.anchor]
    : [selection.anchor, selection.focus];
  const block = $getRoot().getFirstChild();
  if (!$isElementNode(block) || $isListNode(block) || $isTableNode(block) || $isCodeNode(block)) {
    return false;
  }
  const first = block.getFirstDescendant();
  const startNode = start.getNode();
  const startsAtStart = start.offset === 0 && (startNode.is(first) || startNode.is(block));
  const endsInBlock = end.getNode().getTopLevelElement()?.is(block);
  if (!startsAtStart || !endsInBlock) return false;

  selection.removeText();
  const after = $getSelection();
  const emptied = $isRangeSelection(after) && after.isCollapsed() && block.isAttached();
  if (!emptied || !block.isEmpty()) return true;
  if ($isParagraphNode(block)) {
    const next = block.getNextSibling();
    const previous = block.getPreviousSibling();
    if (next) {
      block.selectNext();
      block.remove();
    } else if (previous) {
      block.selectPrevious();
      block.remove();
    }
  } else if ($isHeadingNode(block) || $isQuoteNode(block)) {
    const paragraph = $createParagraphNode();
    block.replace(paragraph);
    paragraph.select();
  }
  return true;
}

/** Converting a list to another kind starts its numbering afresh */
function $insertListAsBefore(type: ListType): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return false;
  const previousType = $findMatchingParent(selection.anchor.getNode(), $isListNode)?.getListType();
  $insertList(type);
  const after = $getSelection();
  if (!$isRangeSelection(after)) return true;
  const list = $findMatchingParent(after.anchor.getNode(), $isListNode);
  if ($isListNode(list) && previousType && previousType !== type && list.getStart() !== 1) {
    list.setStart(1);
  }
  return true;
}

export function BehaviorParityPlugin({ maxIndent }: { maxIndent: number }): null {
  const [editor] = useLexicalComposerContext();
  const isMenuOpen = () => !!document.querySelector('.typeahead-popover');

  useEffect(() => {
    let formatBeforePaste: { format: number; style: string } | null = null;
    let formatAfterPaste: { format: number; style: string } | null = null;
    const $restoreFormatAfterPaste = () => {
      const selection = $getSelection();
      if (formatAfterPaste && $isRangeSelection(selection) && selection.isCollapsed()) {
        selection.format = formatAfterPaste.format;
        selection.style = formatAfterPaste.style;
      }
    };

    return mergeRegister(
      registerTextDirection(editor),

      editor.registerCommand(
        KEY_BACKSPACE_COMMAND,
        (event) => {
          if (!$isAtListItemStart(event)) return false;
          event.preventDefault();
          const selection = $getSelection();
          const indent = $isRangeSelection(selection)
            ? $getNearestBlockElementAncestorOrThrow(selection.anchor.getNode()).getIndent()
            : 0;
          return indent > 0
            ? editor.dispatchCommand(OUTDENT_CONTENT_COMMAND, undefined)
            : editor.dispatchCommand(DELETE_CHARACTER_COMMAND, true);
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        DELETE_CHARACTER_COMMAND,
        (isBackward) =>
          $deleteWholeDocument()
          || $deleteSelectionInFirstBlock(isBackward)
          || $deleteNextToEmptyLine(isBackward),
        COMMAND_PRIORITY_LOW,
      ),
      ...[KEY_BACKSPACE_COMMAND, KEY_DELETE_COMMAND].map((command) =>
        editor.registerCommand(
          command,
          (event) => {
            if (!$deleteWholeDocument()) return false;
            event.preventDefault();
            return true;
          },
          COMMAND_PRIORITY_NORMAL,
        )),

      editor.registerCommand(
        INSERT_HORIZONTAL_RULE_COMMAND,
        () =>
          $isRangeSelection($getSelection())
          && $insertBlockKeepingLine($createHorizontalRuleNode()),
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        INSERT_TABLE_COMMAND,
        ({ columns, rows, includeHeaders }) => {
          const selection = $getSelection() || $getPreviousSelection();
          if (!$isRangeSelection(selection)) return false;
          // No tables inside tables
          if ($findTableNode(selection.anchor.getNode())) return true;
          const table = $createTableNodeWithDimensions(
            Number(rows),
            Number(columns),
            includeHeaders,
          );
          $insertBlockKeepingLine(table);
          const first = table.getFirstDescendant();
          if ($isTextNode(first) || $isElementNode(first)) first.selectStart();
          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        INSERT_ORDERED_LIST_COMMAND,
        () => $insertListAsBefore('number'),
        COMMAND_PRIORITY_NORMAL,
      ),
      editor.registerCommand(
        INSERT_UNORDERED_LIST_COMMAND,
        () => $insertListAsBefore('bullet'),
        COMMAND_PRIORITY_NORMAL,
      ),
      editor.registerCommand(
        INSERT_CHECK_LIST_COMMAND,
        () => $insertListAsBefore('check'),
        COMMAND_PRIORITY_NORMAL,
      ),

      // A triple click stays in its block
      editor.registerCommand(
        CLICK_COMMAND,
        (event) => {
          const selection = $getSelection();
          if (event.detail === 3 && $isRangeSelection(selection) && !selection.isCollapsed()) {
            const anchor = selection.anchor.getNode();
            if (!anchor.is(selection.focus.getNode())) {
              const block = $findMatchingParent(
                anchor,
                (node) => $isElementNode(node) && !node.isInline(),
              );
              if ($isElementNode(block)) block.select(0);
            }
          }
          return false;
        },
        COMMAND_PRIORITY_CRITICAL,
      ),

      // The first selected text decides whether a format is added or removed
      editor.registerCommand(
        FORMAT_TEXT_COMMAND,
        (format) => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection) || selection.isCollapsed()) return false;
          const start = selection.isBackward() ? selection.focus : selection.anchor;
          let texts = selection.getNodes().filter($isTextNode);
          if (
            start.type === 'text'
            && texts[0]
            && start.offset === texts[0].getTextContentSize()
          ) {
            texts = texts.slice(1);
          }
          if (!texts.length) return false;
          selection.formatText(format, texts[0].getFormatFlags(format, null));
          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),

      // Before the code block's own handlers (LOW), but not while the slash menu is open
      editor.registerCommand(
        KEY_ARROW_UP_COMMAND,
        (event) => !isMenuOpen() && $moveInCode(event, true),
        COMMAND_PRIORITY_NORMAL,
      ),
      editor.registerCommand(
        KEY_ARROW_DOWN_COMMAND,
        (event) => !isMenuOpen() && $moveInCode(event, false),
        COMMAND_PRIORITY_NORMAL,
      ),
      // After the slash menu (LOW) and before rich text
      editor.registerCommand(
        KEY_ARROW_UP_COMMAND,
        (event) => $moveNearDivider(event, true),
        COMMAND_PRIORITY_BEFORE_EDITOR,
      ),
      editor.registerCommand(
        KEY_ARROW_DOWN_COMMAND,
        (event) => $moveNearDivider(event, false),
        COMMAND_PRIORITY_BEFORE_EDITOR,
      ),
      // Enter on a selected divider does nothing
      editor.registerCommand(
        KEY_ENTER_COMMAND,
        (event) => {
          const selection = $getSelection();
          if (!$isNodeSelection(selection)) return false;
          if (!selection.getNodes().every($isHorizontalRuleNode)) return false;
          event?.preventDefault();
          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),

      // Multi-line Tab in code keeps the selection where it started, after the new tab
      editor.registerCommand(
        INDENT_CONTENT_COMMAND,
        () => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection) || selection.isCollapsed()) return false;
          const start = selection.isBackward() ? 'focus' : 'anchor';
          const { key, offset } = selection[start];
          if (offset !== 0 || !$isCodeNode(selection[start].getNode().getParent())) return false;
          editor.update(() => {
            const after = $getSelection();
            if (!$isRangeSelection(after)) return;
            const point = after[start];
            const node = point.getNode();
            if ($isTabNode(node) && point.offset === 0 && node.getNextSibling()?.getKey() === key) {
              point.set(key, 0, 'text');
            }
          });
          return false;
        },
        COMMAND_PRIORITY_CRITICAL,
      ),

      // Pasted content does not set the format of what is typed next
      editor.registerCommand(
        PASTE_COMMAND,
        () => {
          const selection = $getSelection();
          formatBeforePaste = $isRangeSelection(selection)
            ? { format: selection.format, style: selection.style }
            : null;
          return false;
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
      editor.registerUpdateListener(({ tags, dirtyLeaves, dirtyElements }) => {
        if (tags.has(PASTE_TAG) && formatBeforePaste) {
          formatAfterPaste = formatBeforePaste;
          formatBeforePaste = null;
          editor.update($restoreFormatAfterPaste, { tag: HISTORY_MERGE_TAG });
        } else if (dirtyLeaves.size || dirtyElements.size) {
          // Kept only until the next edit
          formatAfterPaste = null;
        }
      }),
      // The browser's selection change that follows a paste derives the format from the text
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          $restoreFormatAfterPaste();
          return false;
        },
        COMMAND_PRIORITY_CRITICAL,
      ),

      // Over selected cells, rich content keeps its formatting, and plain text does nothing
      editor.registerCommand(
        SELECTION_INSERT_CLIPBOARD_NODES_COMMAND,
        ({ nodes, selection }) => {
          if (!$isTableSelection(selection) || nodes.some($isTableNode)) return false;
          selection.insertNodes(nodes);
          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        PASTE_COMMAND,
        (event) => {
          const data = event instanceof ClipboardEvent ? event.clipboardData : null;
          if (!$isTableSelection($getSelection()) || !data) return false;
          const rich = data.types.some(
            (type) => type === 'text/html' || type === 'application/x-lexical-editor',
          );
          if (rich) return false;
          event.preventDefault();
          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),

      // Nothing indents once one of the selected blocks is at the limit
      editor.registerCommand(
        INDENT_CONTENT_COMMAND,
        () => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return false;
          return selection
            .getNodes()
            .some(
              (node) => $getNearestBlockElementAncestorOrThrow(node).getIndent() + 1 >= maxIndent,
            );
        },
        COMMAND_PRIORITY_BEFORE_CRITICAL,
      ),

      // The line after a quote starts without its alignment, as does the second half of a
      // split heading
      editor.registerCommand(
        INSERT_PARAGRAPH_COMMAND,
        () => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return false;
          const anchor = selection.anchor.getNode();
          const block = $isElementNode(anchor) ? anchor : anchor.getParent();
          if ($isQuoteNode(block)) {
            selection
              .insertParagraph()
              ?.setFormat('')
              .setStyle('')
              .setTextFormat(0)
              .setTextStyle('');
            return true;
          }
          if ($isHeadingNode(block) && block.getFormatType()) {
            const created = selection.insertParagraph();
            if ($isHeadingNode(created)) created.setFormat('');
            return true;
          }
          return false;
        },
        COMMAND_PRIORITY_LOW,
      ),
      // Enter on an item of only whitespace makes another item
      editor.registerCommand(
        INSERT_PARAGRAPH_COMMAND,
        () => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return false;
          const anchor = selection.anchor.getNode();
          const item = anchor.getParent();
          if (!$isTextNode(anchor) || !$isListItemNode(item)) return false;
          if (item.getTextContent().trim() !== '') return false;
          selection.insertParagraph();
          return true;
        },
        COMMAND_PRIORITY_NORMAL,
      ),

    );
  }, [editor, maxIndent]);

  return null;
}

export default BehaviorParityPlugin;
