import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { mergeRegister } from '@lexical/utils';
import {
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isRootOrShadowRoot,
  $isTextNode,
  COMMAND_PRIORITY_NORMAL,
  DELETE_CHARACTER_COMMAND,
  INSERT_PARAGRAPH_COMMAND,
} from 'lexical';
import { useEffect } from 'react';


import { OPENLEAF_TRANSFORMERS } from '../custom-transformers/OpenleafTransformers';
import {
  $deleteNestedCodeBlock,
  $insertParagraphByNestedBlock,
  $liftCaretLine,
} from '../custom-utils/codeBlockPlacement';

import {
  runElementTransformers,
  runMultilineElementTransformers,
} from './MarkdownShortcutPlugin';

import type { ElementTransformer, MultilineElementTransformer } from '@lexical/markdown';

const ELEMENT_TRANSFORMERS = OPENLEAF_TRANSFORMERS.filter(
  (transformer): transformer is ElementTransformer => transformer.type === 'element',
);
const MULTILINE_TRANSFORMERS = OPENLEAF_TRANSFORMERS.filter(
  (transformer): transformer is MultilineElementTransformer =>
    transformer.type === 'multiline-element',
);

/** Lift the caret's line, then run its shortcut, as the line is now where shortcuts work */
function $liftLineAndRunShortcut(): void {
  $liftCaretLine();
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return;
  const anchor = selection.anchor.getNode();
  const parent = anchor.getParent();
  if (!$isTextNode(anchor) || !parent) return;
  const { offset } = selection.anchor;
  if (!runElementTransformers(parent, anchor, offset, ELEMENT_TRANSFORMERS)) {
    runMultilineElementTransformers(parent, anchor, offset, MULTILINE_TRANSFORMERS);
  }
}

// Shortcuts that only work at the start of a top-level block
const BLOCK_SHORTCUTS = OPENLEAF_TRANSFORMERS.flatMap((transformer) => {
  if (transformer.type === 'element') return [transformer.regExp];
  if (transformer.type !== 'multiline-element') return [];
  const end = transformer.regExpEnd;
  return !end || ('optional' in end && end.optional) ? [transformer.regExpStart] : [];
});

/** Whether the caret follows a block shortcut that can't run because its line is nested */
function $isNestedShortcut(): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;
  const { anchor } = selection;
  const node = anchor.getNode();
  if (!$isTextNode(node)) return false;

  const text = node.getTextContent();
  if (text[anchor.offset - 1] !== ' ') return false;

  const parent = node.getParent();
  if (!parent || parent.getType() === 'code') return false;
  const previous = node.getPreviousSibling();
  if (previous) {
    // The text can also directly follow a nested block
    if (!$isElementNode(previous) || previous.isInline()) return false;
  } else {
    const grandparent = parent.getParent();
    if (parent.getType() === 'paragraph') {
      if ($isRootOrShadowRoot(grandparent)) return false;
    } else if (!parent.getChildren().some((child) => $isElementNode(child) && !child.isInline())) {
      return false;
    }
  }

  return BLOCK_SHORTCUTS.some((regExp) => {
    const match = text.match(regExp);
    return match
      && match[0].length === (match[0].endsWith(' ') ? anchor.offset : anchor.offset - 1);
  });
}

/**
 * Makes code blocks that are nested in other blocks behave like top-level ones.
 * Has to come before MarkdownShortcutPlugin, to lift a line before its shortcut runs.
 */
export function CodeBlockPlacementPlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        INSERT_PARAGRAPH_COMMAND,
        $insertParagraphByNestedBlock,
        COMMAND_PRIORITY_NORMAL,
      ),
      editor.registerCommand(
        DELETE_CHARACTER_COMMAND,
        (isBackward) => isBackward && $deleteNestedCodeBlock(),
        COMMAND_PRIORITY_NORMAL,
      ),
      editor.registerUpdateListener(({ dirtyLeaves, editorState, prevEditorState, tags }) => {
        if (!dirtyLeaves.size || tags.has('historic') || editor.isComposing()) return;
        const typed = editorState.read(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection) || !dirtyLeaves.has(selection.anchor.key)) return false;
          const before = prevEditorState.read($getSelection);
          if (!$isRangeSelection(before) || selection.is(before)) return false;
          const { offset } = selection.anchor;
          // As the shortcuts themselves: only while typing
          return (offset === 1 || offset <= before.anchor.offset + 1) && $isNestedShortcut();
        });
        if (typed) editor.update($liftLineAndRunShortcut);
      }),
    );
  }, [editor]);

  return null;
}

export default CodeBlockPlacementPlugin;
