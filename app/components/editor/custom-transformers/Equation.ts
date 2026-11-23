import { TextMatchTransformer } from '@lexical/markdown';

import { $createEquationNode, $isEquationNode } from '@/app/components/editor/custom-nodes';

// What follows the opening $ of two prices in prose, as in "costs $5 and $":
// an amount such as 5, 4.99, 1,000 or 10k, and then either only separators, or words
// without math in them that end where the next amount would start.
const AMOUNT = String.raw`\d[\d,.]*(?:[kKmMbB]|bn)?%?`;
const ONLY_SEPARATORS = String.raw`[\s\-–—/,;:&(]+`;
const PROSE = String.raw`(?=[\s,.;:!?)\-–—/&])`
  + String.raw`(?![^$\n]*[\\^_={}<>*|+])`
  + String.raw`(?=[^$\n]*(?<=[\s(])[A-Za-z]{2,}(?![A-Za-z0-9]))`
  + String.raw`[^$\n]*[\s(\-–—/]`;
const NOT_A_PRICE = String.raw`(?!${AMOUNT}(?:${ONLY_SEPARATORS}|${PROSE})\$)`;
const INLINE_EQUATION_PATTERN =
  String.raw`(?<!\$)\$(?!\$)` + NOT_A_PRICE + String.raw`([^$\n]+?)(?<!\$)\$(?!\$)`;

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
  importRegExp: new RegExp(INLINE_EQUATION_PATTERN),
  regExp: new RegExp(`${INLINE_EQUATION_PATTERN}$`),
  replace: (textNode, match) => {
    const [, equation] = match;
    const equationNode = $createEquationNode(equation, true);
    textNode.replace(equationNode);
  },
  trigger: '$',
  type: 'text-match',
};