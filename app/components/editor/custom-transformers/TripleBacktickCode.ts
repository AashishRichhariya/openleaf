import { $createCodeNode, CodeNode } from '@lexical/code';
import { TextMatchTransformer } from '@lexical/markdown';

export const TRIPLE_BACKTICK_CODE: TextMatchTransformer = {
  dependencies: [CodeNode],
  export: undefined,
  importRegExp: undefined,
  regExp: /^([ \t]*)```$/,
  
  replace: (textNode) => {
    const codeNode = $createCodeNode();
    textNode.replace(codeNode);
    codeNode.selectStart();
  },
  trigger: '`',
  type: 'text-match',
};