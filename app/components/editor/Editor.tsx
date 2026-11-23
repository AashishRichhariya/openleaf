'use client';


import { CodeHighlightNode, CodeNode } from '@lexical/code';
import { AutoLinkNode, LinkNode } from '@lexical/link';
import { ListItemNode, ListNode } from '@lexical/list';
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { HorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode';
import { HorizontalRulePlugin } from '@lexical/react/LexicalHorizontalRulePlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { TabIndentationPlugin } from '@lexical/react/LexicalTabIndentationPlugin';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { TableCellNode, TableNode, TableRowNode } from '@lexical/table';
import { ReactElement, useState } from 'react';

import { EquationNode, InlineTableInputNode } from './custom-nodes';
import {
  AutosavePlugin,
  BehaviorParityPlugin,
  CheckListPlugin,
  CodeBlockPlacementPlugin,
  CodeHighlightPlugin,
  ComponentPickerPlugin,
  EquationPlugin,
  LinksPlugin,
  MarkdownShortcutPlugin,
  TablePlugin,
} from './custom-plugins';
import { OPENLEAF_TRANSFORMERS } from './custom-transformers/OpenleafTransformers';
import { HTML_IMPORT } from './custom-utils/htmlImport';
import DefaultTheme from './themes/DefaultTheme';

import type { SavedDocument } from './autosave/DocumentSaver';

interface EditorProps {
  initialContent: string | null;
  isReadOnly: boolean;
  savedDocument: SavedDocument;
}

const theme = DefaultTheme;
const MAX_INDENT = 7;

function onError(error: Error) {
  console.error(error);
}

export default function Editor({
  initialContent,
  isReadOnly,
  savedDocument,
}: EditorProps): ReactElement {
  // Create a ref for the floating anchor element
  const [floatingAnchorElem, setFloatingAnchorElem] =
    useState<HTMLDivElement | null>(null);

  // Function to set the floating anchor ref
  const onRef = (_floatingAnchorElem: HTMLDivElement) => {
    if (_floatingAnchorElem !== null) {
      setFloatingAnchorElem(_floatingAnchorElem);
    }
  };

  const editorConfig = {
    namespace: 'openleaf-editor',
    theme,
    onError,
    nodes: [
      HeadingNode,
      ListNode,
      ListItemNode,
      QuoteNode,
      CodeNode,
      CodeHighlightNode,
      TableNode,
      TableCellNode,
      TableRowNode,
      AutoLinkNode,
      LinkNode,
      InlineTableInputNode,
      HorizontalRuleNode,
      EquationNode,
    ],
    editorState: initialContent,
    html: { import: HTML_IMPORT },
  };

  return (
    <div className="editor-root">
      <LexicalComposer initialConfig={editorConfig}>
        <div className="editor-area">
          <RichTextPlugin
            contentEditable={
              <div ref={onRef} className="editor-wrapper">
                <ContentEditable className="editor-input" aria-label="Text editor content" role="textbox" />
              </div>
            }
            placeholder={
              <div className="editor-placeholder">Scribble away...</div>
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
          <HistoryPlugin />
          {!initialContent && <AutoFocusPlugin />}
          <ListPlugin />
          <ComponentPickerPlugin />
          <CheckListPlugin />
          <CodeHighlightPlugin />
          <CodeBlockPlacementPlugin />
          <TabIndentationPlugin maxIndent={MAX_INDENT} />
          <MarkdownShortcutPlugin transformers={OPENLEAF_TRANSFORMERS} />
          <HorizontalRulePlugin />
          <LinksPlugin/>
          <TablePlugin anchorElem={floatingAnchorElem} />
          <EquationPlugin />
          <BehaviorParityPlugin maxIndent={MAX_INDENT} />
          {/* Last, so that it sees the document as the other plugins set it up */}
          {/* A read-only document can be played with, as on 0.3.0, but is never saved. The server
              refuses to change it anyway. */}
          {!isReadOnly && <AutosavePlugin savedDocument={savedDocument} />}
        </div>
      </LexicalComposer>
    </div>
  );
}
