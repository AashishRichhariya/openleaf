import { $createLinkNode, $isLinkNode, LinkNode } from '@lexical/link';
import { TextMatchTransformer } from '@lexical/markdown';
import { $createTextNode } from 'lexical';

// Enhanced link transformer that automatically adds https:// to URLs when needed
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
    
    // Format URL - add protocol if needed
    let formattedUrl = linkUrl;
    
    // Check if URL has a protocol or is a relative path
    if (!/^(?:[a-z]+:)?\/\//i.test(formattedUrl) && !formattedUrl.startsWith('/')) {
      formattedUrl = `https://${formattedUrl}`;
    }
    
    const linkNode = $createLinkNode(formattedUrl, {title: linkTitle});
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