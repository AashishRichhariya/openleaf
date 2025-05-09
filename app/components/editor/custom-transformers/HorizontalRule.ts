import { ElementTransformer } from '@lexical/markdown';
import { $createHorizontalRuleNode, $isHorizontalRuleNode, HorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode';
import { LexicalNode } from 'lexical';


export const HORIZONTAL_RULE: ElementTransformer = {
  dependencies: [HorizontalRuleNode],
  export: (node: LexicalNode) => {
    return $isHorizontalRuleNode(node) ? '---' : null;
  },
  
  // matches 3 or more hyphens
  regExp: /^(-{3,})\s?$/,
  replace: (parentNode) => {
    const line = $createHorizontalRuleNode();
    
    // Handle insertion based on whether there's a next sibling
    if (parentNode.getNextSibling() != null) {
      parentNode.replace(line);
    } else {
      parentNode.insertBefore(line);
    }
    
    line.selectNext();
  },
  type: 'element',
};

export default HORIZONTAL_RULE;