import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { ReactElement, useEffect, useMemo, useState } from 'react';

import { DocumentSaver, SavedDocument, SaveProblem, SaveStatus } from '../autosave/DocumentSaver';

// A failed save is not shown: it is retried, and the next save sends the whole document anyway.
// Users never asked for the save, so a notice would only suggest that something is broken.
// A document locked while open is not shown either: it stays editable and is never saved.
const PROBLEMS: Partial<Record<SaveProblem, string>> = {
  'too-large': 'Changes not saved: this document is too large or too deeply nested.',
};

interface AutosavePluginProps {
  savedDocument: SavedDocument;
}

export function AutosavePlugin({ savedDocument }: AutosavePluginProps): ReactElement {
  const [editor] = useLexicalComposerContext();
  const [status, setStatus] = useState<SaveStatus>({ problem: null, conflict: false });
  const saver = useMemo(
    () => new DocumentSaver(editor, savedDocument, setStatus),
    [editor, savedDocument],
  );

  useEffect(() => saver.start(), [saver]);

  const problem = status.problem ? PROBLEMS[status.problem] : undefined;

  return (
    <>
      <OnChangePlugin
        onChange={(editorState, _editor, tags) => saver.onChange(editorState, tags)}
        ignoreSelectionChange={true}
        ignoreHistoryMergeTagChange={false}
      />
      {(problem || status.conflict) && (
        <div className="editor-notice" role="status">
          <span>
            {problem ?? 'This document was also edited elsewhere. Both versions were kept.'}
          </span>
          {!problem && (
            <button
              type="button"
              className="editor-notice-dismiss"
              onClick={() => saver.dismissConflict()}
              aria-label="Dismiss"
            >
              ×
            </button>
          )}
        </div>
      )}
    </>
  );
}

export default AutosavePlugin;
