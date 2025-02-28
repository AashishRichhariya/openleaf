import DefaultTheme from "./themes/DefaultTheme";

import { CodeHighlightNode, CodeNode } from "@lexical/code";
import { ListItemNode, ListNode } from "@lexical/list";
import { TRANSFORMERS } from "@lexical/markdown";
import { AutoFocusPlugin } from "@lexical/react/LexicalAutoFocusPlugin";
import { CheckListPlugin } from "@lexical/react/LexicalCheckListPlugin";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { TabIndentationPlugin } from "@lexical/react/LexicalTabIndentationPlugin";
import { TablePlugin } from "@lexical/react/LexicalTablePlugin";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { ReactElement, useState } from "react";
import {
  ComponentPickerPlugin,
  TableHoverActionsPlugin,
} from "./custom-plugins";

import { AutoLinkNode, LinkNode } from "@lexical/link";
import { TableCellNode, TableNode, TableRowNode } from "@lexical/table";
import { InlineTableInputNode } from "./custom-nodes";

const theme = DefaultTheme;

function onError(error: Error) {
  console.error(error);
}

export default function Editor(): ReactElement {
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
    namespace: "openleaf-editor",
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
    ],
  };

  return (
    <div className="editor-root">
      <LexicalComposer initialConfig={editorConfig}>
        <div className="editor-area">
          <RichTextPlugin
            contentEditable={
              <div ref={onRef}>
                <ContentEditable className="editor-input" />
              </div>
            }
            placeholder={
              <div className="editor-placeholder">Scribble away...</div>
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
          <HistoryPlugin />
          <AutoFocusPlugin />
          <ListPlugin />
          <ComponentPickerPlugin />
          <CheckListPlugin />
          <TablePlugin hasHorizontalScroll={true} />
          <TabIndentationPlugin maxIndent={7} />
          <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
          {/* Add the table-related plugins with the anchor element */}
          {floatingAnchorElem && (
            <TableHoverActionsPlugin anchorElem={floatingAnchorElem} />
          )}
        </div>
      </LexicalComposer>
    </div>
  );
}
