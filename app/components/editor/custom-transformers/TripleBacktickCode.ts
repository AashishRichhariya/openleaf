import { $createCodeNode, CodeNode } from '@lexical/code';
import { TextMatchTransformer } from '@lexical/markdown';

import { $replaceWithBlock } from '../custom-utils/codeBlockPlacement';

export const TRIPLE_BACKTICK_CODE: TextMatchTransformer = {
  dependencies: [CodeNode],
  export: undefined,
  importRegExp: undefined,
  regExp: /^([ \t]*)```$/,
  
  replace: (textNode) => {
    const codeNode = $createCodeNode();
    $replaceWithBlock(textNode, codeNode);
    codeNode.selectStart();
  },
  trigger: '`',
  type: 'text-match',
};
