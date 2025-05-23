import { CHECK_LIST, ELEMENT_TRANSFORMERS, MULTILINE_ELEMENT_TRANSFORMERS, TEXT_FORMAT_TRANSFORMERS, TEXT_MATCH_TRANSFORMERS, Transformer } from '@lexical/markdown';

import { BLOCK_EQUATION, INLINE_EQUATION } from './Equation';
import HORIZONTAL_RULE from './HorizontalRule';
import { TRIPLE_BACKTICK_CODE } from './TripleBacktickCode';

export const OPENLEAF_TRANSFORMERS: Array<Transformer> = [
  BLOCK_EQUATION, 
  INLINE_EQUATION,
  HORIZONTAL_RULE,
  CHECK_LIST,
  TRIPLE_BACKTICK_CODE,
  ...ELEMENT_TRANSFORMERS,
  ...MULTILINE_ELEMENT_TRANSFORMERS,
  ...TEXT_FORMAT_TRANSFORMERS,
  ...TEXT_MATCH_TRANSFORMERS,
];
