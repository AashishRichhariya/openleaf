/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */


import { CodeNode } from '@lexical/code';
import { PrismTokenizer, registerCodeHighlighting, Tokenizer } from '@lexical/code-prism';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { mergeRegister } from '@lexical/utils';
import { ReactElement, useEffect } from 'react';

// The grammars Lexical 0.31.1 loaded, with their aliases
const LANGUAGES_OF_0_31 = new Set([
  'markup', 'html', 'mathml', 'svg', 'xml', 'ssml', 'atom', 'rss', 'css', 'clike', 'javascript',
  'js', 'c', 'cpp', 'objectivec', 'objc', 'markdown', 'md', 'powershell', 'python', 'py', 'rust',
  'sql', 'swift', 'typescript', 'ts', 'java',
  // No highlighting in either version
  'plain', 'plaintext', 'text', 'txt',
]);

// Lexical 0.53 has grammars for these, which 0.31 colored as JavaScript
const AS_JAVASCRIPT = /^(go|diff|diff-[\w-]+)$/i;
const asBefore = (language?: string) =>
  (language && AS_JAVASCRIPT.test(language) ? 'javascript' : language);

const TOKENIZER: Tokenizer = {
  ...PrismTokenizer,
  tokenize(code, language) {
    return PrismTokenizer.tokenize.call(this, code, asBefore(language));
  },
  $tokenize(codeNode, language) {
    return PrismTokenizer.$tokenize.call(this, codeNode, asBefore(language));
  },
};

export function CodeHighlightPlugin(): ReactElement | null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return mergeRegister(
      // Lexical 0.31 highlighted languages it had no grammar for, such as json or bash, as
      // JavaScript. Later versions leave them plain, so those get JavaScript under their name.
      // Nothing that Prism defines is replaced.
      editor.registerNodeTransform(CodeNode, (node) => {
        const language = node.getLanguage();
        const languages = (globalThis as { Prism?: { languages: Record<string, unknown> } })
          .Prism?.languages;
        if (!languages || !language || !/^[\w-]+$/.test(language)) return;
        if (!LANGUAGES_OF_0_31.has(language) && !(language in languages)) {
          languages[language] = languages.javascript;
        }
      }),
      registerCodeHighlighting(editor, TOKENIZER),
    );
  }, [editor]);

  return null;
}

export default CodeHighlightPlugin;
