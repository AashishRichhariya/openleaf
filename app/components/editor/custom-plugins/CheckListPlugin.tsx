/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * The check list behavior of Lexical 0.31.1. Later versions take the checkbox's 16px for the
 * hit area, which was 20px, and 48px for touch, which is on top of the text.
 * From packages/lexical-list/src/checkList.ts at v0.31.1
 */

import {
  $insertList,
  $isListItemNode,
  $isListNode,
  INSERT_CHECK_LIST_COMMAND,
  ListItemNode,
} from '@lexical/list';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $findMatchingParent, calculateZoomLevel, mergeRegister } from '@lexical/utils';
import {
  $getNearestNodeFromDOMNode,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  getNearestEditorFromDOMNode,
  isHTMLElement,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_LEFT_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_ESCAPE_COMMAND,
  KEY_SPACE_COMMAND,
  LexicalEditor,
  LexicalNode,
} from 'lexical';
import { useEffect } from 'react';

const IS_FIREFOX = typeof navigator !== 'undefined' && /Firefox/.test(navigator.userAgent);

function registerCheckList(editor: LexicalEditor) {
  return mergeRegister(
    editor.registerCommand(
      INSERT_CHECK_LIST_COMMAND,
      () => {
        $insertList('check');
        return true;
      },
      COMMAND_PRIORITY_LOW,
    ),
    editor.registerCommand<KeyboardEvent>(
      KEY_ARROW_DOWN_COMMAND,
      (event) => {
        return handleArrowUpOrDown(event, editor, false);
      },
      COMMAND_PRIORITY_LOW,
    ),
    editor.registerCommand<KeyboardEvent>(
      KEY_ARROW_UP_COMMAND,
      (event) => {
        return handleArrowUpOrDown(event, editor, true);
      },
      COMMAND_PRIORITY_LOW,
    ),
    editor.registerCommand<KeyboardEvent>(
      KEY_ESCAPE_COMMAND,
      () => {
        const activeItem = getActiveCheckListItem();

        if (activeItem != null) {
          const rootElement = editor.getRootElement();

          if (rootElement != null) {
            rootElement.focus();
          }

          return true;
        }

        return false;
      },
      COMMAND_PRIORITY_LOW,
    ),
    editor.registerCommand<KeyboardEvent>(
      KEY_SPACE_COMMAND,
      (event) => {
        const activeItem = getActiveCheckListItem();

        if (activeItem != null && editor.isEditable()) {
          editor.update(() => {
            const listItemNode = $getNearestNodeFromDOMNode(activeItem);

            if ($isListItemNode(listItemNode)) {
              event.preventDefault();
              listItemNode.toggleChecked();
            }
          });
          return true;
        }

        return false;
      },
      COMMAND_PRIORITY_LOW,
    ),
    editor.registerCommand<KeyboardEvent>(
      KEY_ARROW_LEFT_COMMAND,
      (event) => {
        return editor.getEditorState().read(() => {
          const selection = $getSelection();

          if ($isRangeSelection(selection) && selection.isCollapsed()) {
            const {anchor} = selection;
            const isElement = anchor.type === 'element';

            if (isElement || anchor.offset === 0) {
              const anchorNode = anchor.getNode();
              const elementNode = $findMatchingParent(
                anchorNode,
                (node) => $isElementNode(node) && !node.isInline(),
              );
              if ($isListItemNode(elementNode)) {
                const parent = elementNode.getParent();
                if (
                  $isListNode(parent) &&
                  parent.getListType() === 'check' &&
                  (isElement || elementNode.getFirstDescendant() === anchorNode)
                ) {
                  const domNode = editor.getElementByKey(elementNode.__key);

                  if (domNode != null && document.activeElement !== domNode) {
                    domNode.focus();
                    event.preventDefault();
                    return true;
                  }
                }
              }
            }
          }

          return false;
        });
      },
      COMMAND_PRIORITY_LOW,
    ),
    editor.registerRootListener((rootElement, prevElement) => {
      if (rootElement !== null) {
        rootElement.addEventListener('click', handleClick);
        rootElement.addEventListener('pointerdown', handlePointerDown);
      }

      if (prevElement !== null) {
        prevElement.removeEventListener('click', handleClick);
        prevElement.removeEventListener('pointerdown', handlePointerDown);
      }
    }),
  );
}

function handleCheckItemEvent(event: PointerEvent, callback: () => void) {
  const target = event.target;

  if (!isHTMLElement(target)) {
    return;
  }

  // Ignore clicks on LI that have nested lists
  const firstChild = target.firstChild;

  if (
    isHTMLElement(firstChild) &&
    (firstChild.tagName === 'UL' || firstChild.tagName === 'OL')
  ) {
    return;
  }

  const parentNode = target.parentNode;

  // @ts-ignore internal field
  if (!parentNode || parentNode.__lexicalListType !== 'check') {
    return;
  }

  const rect = target.getBoundingClientRect();
  // clientX, as rects don't move with a page scrolled sideways
  const clickX = event.clientX / calculateZoomLevel(target);
  if (
    target.dir === 'rtl'
      ? clickX < rect.right && clickX > rect.right - 20
      : clickX > rect.left && clickX < rect.left + 20
  ) {
    callback();
  }
}

// What the click that follows a pointerdown came from
let lastPointerType = '';

function handleClick(event: Event) {
  handleCheckItemEvent(event as PointerEvent, () => {
    if (isHTMLElement(event.target)) {
      const domNode = event.target;
      const editor = getNearestEditorFromDOMNode(domNode);

      if (editor != null && editor.isEditable()) {
        editor.update(() => {
          const node = $getNearestNodeFromDOMNode(domNode);

          if ($isListItemNode(node)) {
            if (IS_FIREFOX) {
              // As Lexical 0.31 ended up in Firefox: the caret at the start of the item. Focus
              // ends on the editor after a first click, and on the item after a later click.
              domNode.focus({ preventScroll: true });
              node.selectStart();
            } else {
              domNode.focus();
            }
            node.toggleChecked();
          }
        }, IS_FIREFOX && lastPointerType === 'touch'
          // After a tap it ends on the item, which placing the caret would take the focus from
          ? { onUpdate: () => domNode.focus({ preventScroll: true }) }
          : undefined);
      }
    }
  });
}

function handlePointerDown(event: PointerEvent) {
  lastPointerType = event.pointerType;
  handleCheckItemEvent(event, () => {
    // Prevents caret moving when clicking on check mark
    event.preventDefault();
  });
}

function getActiveCheckListItem(): HTMLElement | null {
  const activeElement = document.activeElement;

  return isHTMLElement(activeElement) &&
    activeElement.tagName === 'LI' &&
    activeElement.parentNode != null &&
    // @ts-ignore internal field
    activeElement.parentNode.__lexicalListType === 'check'
    ? activeElement
    : null;
}

function findCheckListItemSibling(
  node: ListItemNode,
  backward: boolean,
): ListItemNode | null {
  let sibling = backward ? node.getPreviousSibling() : node.getNextSibling();
  let parent: ListItemNode | null = node;

  // Going up in a tree to get non-null sibling
  while (sibling == null && $isListItemNode(parent)) {
    // Get li -> parent ul/ol -> parent li
    const grandparent: LexicalNode | null = parent.getParentOrThrow().getParent();
    parent = $isListItemNode(grandparent) ? grandparent : null;

    if (parent != null) {
      sibling = backward
        ? parent.getPreviousSibling()
        : parent.getNextSibling();
    }
  }

  // Going down in a tree to get first non-nested list item
  while ($isListItemNode(sibling)) {
    const firstChild = backward
      ? sibling.getLastChild()
      : sibling.getFirstChild();

    if (!$isListNode(firstChild)) {
      return sibling;
    }

    sibling = backward ? firstChild.getLastChild() : firstChild.getFirstChild();
  }

  return null;
}

function handleArrowUpOrDown(
  event: KeyboardEvent,
  editor: LexicalEditor,
  backward: boolean,
) {
  const activeItem = getActiveCheckListItem();

  if (activeItem != null) {
    editor.update(() => {
      const listItem = $getNearestNodeFromDOMNode(activeItem);

      if (!$isListItemNode(listItem)) {
        return;
      }

      const nextListItem = findCheckListItemSibling(listItem, backward);

      if (nextListItem != null) {
        nextListItem.selectStart();
        const dom = editor.getElementByKey(nextListItem.__key);

        if (dom != null) {
          event.preventDefault();
          setTimeout(() => {
            dom.focus();
          }, 0);
        }
      }
    });
  }

  return false;
}

export function CheckListPlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return registerCheckList(editor);
  }, [editor]);

  return null;
}

export default CheckListPlugin;
