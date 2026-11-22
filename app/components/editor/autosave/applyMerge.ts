import {
  $addUpdateTag,
  $getRoot,
  $getSelection,
  $parseSerializedNode,
  $setSelection,
  CLEAR_HISTORY_COMMAND,
  LexicalEditor,
  LexicalNode,
  SerializedLexicalNode,
} from 'lexical';

import { MergedBlock } from '@/app/utils/mergeDocuments';

/**
 * Change only the blocks a merge changed, so that the caret and what is being typed stay put
 */
export function applyMerge(editor: LexicalEditor, blocks: MergedBlock[]): void {
  const root = editor.getRootElement();
  const hasFocus = !!root?.contains(document.activeElement);

  editor.update(
    () => {
      const current = $getRoot().getChildren();
      const kept = new Set<LexicalNode>();
      let previous: LexicalNode | null = null;

      for (const block of blocks) {
        let node: LexicalNode;
        if ('keep' in block) {
          node = current[block.keep];
          kept.add(node);
        } else {
          node = $parseSerializedNode(block.insert as unknown as SerializedLexicalNode);
          if (previous) {
            previous.insertAfter(node, false);
          } else {
            const first: LexicalNode | null = $getRoot().getFirstChild();
            if (first) first.insertBefore(node, false);
            else $getRoot().append(node);
          }
        }
        previous = node;
      }

      for (const node of current) {
        if (!kept.has(node)) node.remove();
      }
      if (!hasFocus && $getSelection()) $setSelection(null);
      $addUpdateTag('skip-scroll-into-view');
    },
    { discrete: true },
  );

  // Undoing past this point would delete the other side's edit
  editor.dispatchCommand(CLEAR_HISTORY_COMMAND, undefined);
}
