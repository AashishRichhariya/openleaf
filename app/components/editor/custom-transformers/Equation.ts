import { $createEquationNode, $isEquationNode } from '@/app/components/editor/custom-nodes';
import { TextMatchTransformer } from '@lexical/markdown';

export const BLOCK_EQUATION: TextMatchTransformer = {
  dependencies: [],
  export: (node) => {
    if (!$isEquationNode(node) || node.__inline) {
      return null;
    }
    return `$$${node.getEquation()}$$`;
  },
  importRegExp: /\$\$([^$]+?)\$\$/, 
  regExp: /\$\$([^$]+?)\$\$$/, 
  replace: (textNode, match) => {
    const [, equation] = match;
    const equationNode = $createEquationNode(equation, false);
    textNode.replace(equationNode);
  },
  trigger: '$',
  type: 'text-match',
};

export const INLINE_EQUATION: TextMatchTransformer = {
  dependencies: [],
  export: (node) => {
    if (!$isEquationNode(node)) {
      return null;
    }
    return `$${node.getEquation()}$`;
  },
  // Don't match $ that are preceded or followed by another $ (i.e., part of a block equation)
  importRegExp: /(?<!\$)\$(?!\$)([^$\n]+?)(?<!\$)\$(?!\$)/,
  regExp: /(?<!\$)\$(?!\$)([^$\n]+?)(?<!\$)\$(?!\$)$/,
  replace: (textNode, match) => {
    const [, equation] = match;
    const equationNode = $createEquationNode(equation, true);
    textNode.replace(equationNode);
  },
  trigger: '$',
  type: 'text-match',
};