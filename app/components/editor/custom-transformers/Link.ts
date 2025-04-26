import { $createLinkNode, $isLinkNode, LinkNode } from '@lexical/link';
import { TextMatchTransformer } from '@lexical/markdown';
import { $createTextNode } from 'lexical';

import { formatUrl, sanitizeUrl } from '@/app/utils';

export const LINK: TextMatchTransformer = {
  dependencies: [LinkNode],
  export: (node, exportChildren, exportFormat) => {
    if (!$isLinkNode(node)) {
      return null;
    }
    const title = node.getTitle();

    const textContent = exportChildren(node);

    const linkContent = title
      ? `[${textContent}](${node.getURL()} "${title}")`
      : `[${textContent}](${node.getURL()})`;

    return linkContent;
  },
  importRegExp:
    /(?:\[([^[]+)\])(?:\((?:([^()\s]+)(?:\s"((?:[^"]*\\")*[^"]*)"\s*)?)\))/,
  regExp:
    /(?:\[([^[]+)\])(?:\((?:([^()\s]+)(?:\s"((?:[^"]*\\")*[^"]*)"\s*)?)\))$/,
  replace: (textNode, match) => {
    const [, linkText, linkUrl, linkTitle] = match;
    
    const formattedUrl = formatUrl(linkUrl);
    const sanitizedUrl = sanitizeUrl(formattedUrl);
    
    const linkNode = $createLinkNode(sanitizedUrl, {title: linkTitle});
    const linkTextNode = $createTextNode(linkText);
    linkTextNode.setFormat(textNode.getFormat());
    linkNode.append(linkTextNode);
    textNode.replace(linkNode);

    return linkTextNode;
  },
  trigger: ')',
  type: 'text-match',
};

export default LINK;