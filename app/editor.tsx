import { AutoFocusPlugin } from "@lexical/react/LexicalAutoFocusPlugin";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ReactElement } from "react";

const theme = {
  // Theme styling goes here
  //...
};

function onError(error: Error) {
  console.error(error);
}

export default function Editor(): ReactElement {
  const initialConfig = {
    namespace: "OpenleafEditor",
    theme,
    onError,
  };

  return (
    <div className="editor-container">
      <div className="editor-content">
        <LexicalComposer initialConfig={initialConfig}>
          <div className="relative min-h-screen py-12">
            <RichTextPlugin
              contentEditable={<ContentEditable className="editor-root" />}
              placeholder={
                <div className="absolute top-12 text-gray-400 pointer-events-none">
                  Scribe away...
                </div>
              }
              ErrorBoundary={LexicalErrorBoundary}
            />
            <HistoryPlugin />
            <AutoFocusPlugin />
          </div>
        </LexicalComposer>
      </div>
    </div>
  );
}
