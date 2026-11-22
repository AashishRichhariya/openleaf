/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * The markdown transformers of Lexical 0.31.1 that changed since. Later versions refuse lists in
 * headings and block shortcuts in quotes, read [X] differently, save list markers and raw link
 * URLs, and accept more link syntax, some of which eats text.
 * From packages/lexical-markdown/src at v0.31.1
 */

import { $createCodeNode } from '@lexical/code';
import { $createLinkNode } from '@lexical/link';
import { $createListItemNode, $createListNode, $isListNode, ListType } from '@lexical/list';
import {
  CHECK_LIST as STOCK_CHECK_LIST,
  CODE as STOCK_CODE,
  ELEMENT_TRANSFORMERS,
  ElementTransformer,
  HEADING as STOCK_HEADING,
  LINK as STOCK_LINK,
  MULTILINE_ELEMENT_TRANSFORMERS,
  MultilineElementTransformer,
  ORDERED_LIST as STOCK_ORDERED_LIST,
  QUOTE as STOCK_QUOTE,
  TEXT_MATCH_TRANSFORMERS,
  TextMatchTransformer,
  Transformer,
  UNORDERED_LIST as STOCK_UNORDERED_LIST,
} from '@lexical/markdown';
import { $createHeadingNode, $createQuoteNode, HeadingTagType } from '@lexical/rich-text';
import { $createTextNode, ElementNode } from 'lexical';

const ORDERED_LIST_REGEX = /^(\s*)(\d{1,})\.\s/;
const UNORDERED_LIST_REGEX = /^(\s*)[-*+]\s/;
const CHECK_LIST_REGEX = /^(\s*)(?:-\s)?\s?(\[(\s|x)?\])\s/i;
const CODE_START_REGEX = /^[ \t]*```(\w+)?/;
const HEADING_REGEX = /^(#{1,6})\s/;
const QUOTE_REGEX = /^>\s/;
const PHONE_NUMBER_REGEX = /^\+?[0-9\s()-]{5,}$/;

function formatUrl(url: string): string {
  // Check if URL already has a protocol
  if (url.match(/^[a-z][a-z0-9+.-]*:/i)) {
    // URL already has a protocol, leave it as is
    return url;
  }
  // Check if it's a relative path (starting with '/', '.', or '#')
  else if (url.match(/^[/#.]/)) {
    // Relative path, leave it as is
    return url;
  }

  // Check for email address
  else if (url.includes('@')) {
    return `mailto:${url}`;
  }

  // Check for phone number
  else if (PHONE_NUMBER_REGEX.test(url)) {
    return `tel:${url}`;
  }

  // For everything else, return with https:// prefix
  return `https://${url}`;
}

const createBlockNode = (
  createNode: (match: Array<string>) => ElementNode,
): ElementTransformer['replace'] => {
  return (parentNode, children, match) => {
    const node = createNode(match);
    node.append(...children);
    parentNode.replace(node);
    node.select(0, 0);
  };
};

// Amount of spaces that define indentation level
const LIST_INDENT_SIZE = 4;

function getIndent(whitespaces: string): number {
  const tabs = whitespaces.match(/\t/g);
  const spaces = whitespaces.match(/ /g);

  let indent = 0;

  if (tabs) {
    indent += tabs.length;
  }

  if (spaces) {
    indent += Math.floor(spaces.length / LIST_INDENT_SIZE);
  }

  return indent;
}

const listReplace = (listType: ListType): ElementTransformer['replace'] => {
  return (parentNode, children, match) => {
    const previousNode = parentNode.getPreviousSibling();
    const nextNode = parentNode.getNextSibling();
    const listItem = $createListItemNode(
      listType === 'check' ? match[3] === 'x' : undefined,
    );
    if ($isListNode(nextNode) && nextNode.getListType() === listType) {
      const firstChild = nextNode.getFirstChild();
      if (firstChild !== null) {
        firstChild.insertBefore(listItem);
      } else {
        // should never happen, but let's handle gracefully, just in case.
        nextNode.append(listItem);
      }
      parentNode.remove();
    } else if (
      $isListNode(previousNode) &&
      previousNode.getListType() === listType
    ) {
      previousNode.append(listItem);
      parentNode.remove();
    } else {
      const list = $createListNode(
        listType,
        listType === 'number' ? Number(match[2]) : undefined,
      );
      list.append(listItem);
      parentNode.replace(list);
    }
    listItem.append(...children);
    listItem.select(0, 0);
    const indent = getIndent(match[1]);
    if (indent) {
      listItem.setIndent(indent);
    }
  };
};

export const HEADING: ElementTransformer = {
  ...STOCK_HEADING,
  regExp: HEADING_REGEX,
  replace: createBlockNode((match) => $createHeadingNode(`h${match[1].length}` as HeadingTagType)),
};

export const QUOTE: ElementTransformer = {
  ...STOCK_QUOTE,
  regExp: QUOTE_REGEX,
  replace: createBlockNode(() => $createQuoteNode()),
};

export const UNORDERED_LIST: ElementTransformer = {
  ...STOCK_UNORDERED_LIST,
  regExp: UNORDERED_LIST_REGEX,
  replace: listReplace('bullet'),
};

export const ORDERED_LIST: ElementTransformer = {
  ...STOCK_ORDERED_LIST,
  regExp: ORDERED_LIST_REGEX,
  replace: listReplace('number'),
};

export const CHECK_LIST: ElementTransformer = {
  ...STOCK_CHECK_LIST,
  regExp: CHECK_LIST_REGEX,
  replace: listReplace('check'),
};

export const CODE: MultilineElementTransformer = {
  ...STOCK_CODE,
  regExpStart: CODE_START_REGEX,
  // Only ever run for typing, as openleaf doesn't import markdown
  replace: (rootNode, children, startMatch, _endMatch, _linesInBetween, isImport) => {
    if (children) {
      createBlockNode((match) => $createCodeNode(match ? match[1] : undefined))(
        rootNode,
        children,
        startMatch,
        isImport,
      );
    }
  },
};

export const LINK: TextMatchTransformer = {
  ...STOCK_LINK,
  regExp:
    /(?:\[([^[]+)\])(?:\((?:([^()\s]+)(?:\s"((?:[^"]*\\")*[^"]*)"\s*)?)\))$/,
  replace: (textNode, match) => {
    const [, linkText, linkUrl, linkTitle] = match;
    const linkNode = $createLinkNode(formatUrl(linkUrl), { title: linkTitle });
    const linkTextNode = $createTextNode(linkText);
    linkTextNode.setFormat(textNode.getFormat());
    linkNode.append(linkTextNode);
    textNode.replace(linkNode);

    return linkTextNode;
  },
};

const REPLACEMENTS = new Map<Transformer, Transformer>([
  [STOCK_HEADING, HEADING],
  [STOCK_QUOTE, QUOTE],
  [STOCK_UNORDERED_LIST, UNORDERED_LIST],
  [STOCK_ORDERED_LIST, ORDERED_LIST],
  [STOCK_CODE, CODE],
  [STOCK_LINK, LINK],
]);

const withReplacements = (transformers: Array<Transformer>) =>
  transformers.map((transformer) => REPLACEMENTS.get(transformer) ?? transformer);

// The package's arrays, in their order, with the members above swapped in
export const BLOCK_TRANSFORMERS = withReplacements(ELEMENT_TRANSFORMERS);
export const MULTILINE_TRANSFORMERS = withReplacements(MULTILINE_ELEMENT_TRANSFORMERS);
export const INLINE_TRANSFORMERS = withReplacements(TEXT_MATCH_TRANSFORMERS);
