"use client";

import { useDebounce } from "@/app/hooks";
import { saveDocument } from "@/lib/document-actions";
import { EditorState } from "lexical";
import Editor from "./Editor";

interface EditorContainerProps {
  slug: string;
  initialContent?: string | null;
  isReadOnly?: boolean;
}

export default function EditorContainer({
  slug,
  initialContent = null,
  isReadOnly = false,
}: EditorContainerProps) {
  const isNewPage = !initialContent;

  const debouncedSave = useDebounce(async (editorState: EditorState) => {
    try {
      await saveDocument(slug, editorState.toJSON());
      console.log("Document saved successfully");
    } catch (err) {
      console.error("Error saving document:", err);
    }
  }, 2000);

  // Handle editor changes
  const handleEditorStateChange = (editorState: EditorState) => {
    if (isReadOnly) {
      return;
    }
    debouncedSave(editorState);
  };

  return (
    <Editor
      initialContent={initialContent}
      onEditorStateChange={handleEditorStateChange}
    />
  );
}
