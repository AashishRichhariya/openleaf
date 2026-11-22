import { AutoLinkPlugin, createLinkMatcherWithRegExp } from '@lexical/react/LexicalAutoLinkPlugin';
import { ClickableLinkPlugin } from '@lexical/react/LexicalClickableLinkPlugin';
import { LinkPlugin as LexicalLinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import * as React from 'react';

import {
  AUTO_DETECTION_EMAIL_REGEX,
  AUTO_DETECTION_URL_REGEX,
  validateUrl,
} from '@/app/utils';

const MATCHERS = [
  createLinkMatcherWithRegExp(AUTO_DETECTION_URL_REGEX, (text: string) => {
    return text.startsWith('http') ? text : `https://${text}`;
  }),
  createLinkMatcherWithRegExp(AUTO_DETECTION_EMAIL_REGEX, (text: string) => {
    return `mailto:${text}`;
  }),
];

// A constant: a new object on each render would make Lexical re-register and touch every link
const LINK_ATTRIBUTES = {
  rel: 'noopener',
  target: '_blank',
};

export function LinksPlugin(): React.ReactElement {
  return (
    <>
      <LexicalLinkPlugin
        validateUrl={validateUrl}
        attributes={LINK_ATTRIBUTES}
      />
      
      {/* Auto-link detection */}
      <AutoLinkPlugin matchers={MATCHERS} />
      <ClickableLinkPlugin />
    </>
  );
}

export default LinksPlugin;