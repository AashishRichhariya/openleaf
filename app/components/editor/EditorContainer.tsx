'use client';

import { useMemo } from 'react';

import { SaveLogEntry } from '@/types';

import { SavedDocument } from './autosave/DocumentSaver';
import Editor from './Editor';

interface EditorContainerProps {
  slug: string;
  initialContent?: string | null;
  isReadOnly?: boolean;
  /** When the document was last saved, which identifies what an edit is based on */
  revision?: string | null;
  saveLog?: SaveLogEntry[];
}

export default function EditorContainer({
  slug,
  initialContent = null,
  isReadOnly = false,
  revision = null,
  saveLog,
}: EditorContainerProps) {
  const savedDocument = useMemo<SavedDocument>(
    () => ({
      slug,
      content: initialContent ? JSON.parse(initialContent) : null,
      revision,
      log: saveLog ?? [],
    }),
    [slug, initialContent, revision, saveLog],
  );

  return (
    <Editor
      initialContent={initialContent}
      isReadOnly={isReadOnly}
      savedDocument={savedDocument}
    />
  );
}
