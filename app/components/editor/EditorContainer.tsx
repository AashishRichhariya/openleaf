'use client';

import { EditorState } from 'lexical';
import { useRef } from 'react';

import { useDebounce } from '@/app/hooks';
import { saveDocument } from '@/server/document-actions';

import Editor from './Editor';

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
  let isNewDocument = !initialContent;
  const lastSavedContentRef = useRef<string | null>(
    initialContent ? JSON.stringify(JSON.parse(initialContent)) : null,
  );

  const debouncedSave = useDebounce(async (editorState: EditorState) => {
    try {
      const editorStateJson = editorState.toJSON();
      const currentContent = JSON.stringify(editorStateJson);
      if (currentContent !== lastSavedContentRef.current) {
        await saveDocument(slug, editorStateJson, isReadOnly, isNewDocument);
        console.log('Document saved successfully');
        isNewDocument = false;
        lastSavedContentRef.current = currentContent;
      }
    } catch (err) {
      console.error('Error saving document:', err);
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
