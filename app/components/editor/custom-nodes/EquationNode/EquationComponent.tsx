import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useLexicalEditable } from '@lexical/react/useLexicalEditable';
import { mergeRegister } from '@lexical/utils';
import {
  $getNodeByKey,
  $getSelection,
  $isNodeSelection,
  COMMAND_PRIORITY_HIGH,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  KEY_ESCAPE_COMMAND,
  NodeKey,
  SELECTION_CHANGE_COMMAND,
} from 'lexical';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { $isEquationNode } from '.';
import EquationEditor from './EquationEditor';
import EquationRenderer from './EquationRenderer';

type EquationComponentProps = {
  equation: string;
  inline: boolean;
  nodeKey: NodeKey;
};

export default function EquationComponent({
  equation,
  inline,
  nodeKey,
}: EquationComponentProps): React.ReactElement {
  const [editor] = useLexicalComposerContext();
  const isEditable = useLexicalEditable();
  const [equationValue, setEquationValue] = useState(equation);
  const [showEquationEditor, setShowEquationEditor] = useState<boolean>(false);
  const [isSelected, setIsSelected] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // Handler to save changes and hide editor
  const onHide = useCallback(
    (restoreSelection?: boolean) => {
      setShowEquationEditor(false);
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if ($isEquationNode(node)) {
          node.setEquation(equationValue);
          if (restoreSelection) {
            node.selectNext(0, 0);
          }
        }
      });
    },
    [editor, equationValue, nodeKey],
  );

  // Handle deletion
  const onDelete = useCallback(() => {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if ($isEquationNode(node)) {
        node.remove();
      }
    });
  }, [editor, nodeKey]);

  // Reset equation value when editor is closed
  useEffect(() => {
    if (!showEquationEditor && equationValue !== equation) {
      setEquationValue(equation);
    }
  }, [showEquationEditor, equation, equationValue]);

  // Register selection and key command handlers
  useEffect(() => {
    if (!isEditable) {
      return;
    }

    // When in editing mode
    if (showEquationEditor) {
      return mergeRegister(
        editor.registerCommand(
          SELECTION_CHANGE_COMMAND,
          () => {
            const activeElement = document.activeElement;
            const inputElem = inputRef.current;
            if (inputElem !== activeElement) {
              onHide();
            }
            return false;
          },
          COMMAND_PRIORITY_HIGH,
        ),
        editor.registerCommand(
          KEY_ESCAPE_COMMAND,
          () => {
            const activeElement = document.activeElement;
            const inputElem = inputRef.current;
            if (inputElem === activeElement) {
              onHide(true);
              return true;
            }
            return false;
          },
          COMMAND_PRIORITY_HIGH,
        ),
      );
    }
    
    // Track selection state and enable deletion
    return mergeRegister(
      editor.registerUpdateListener(({editorState}) => {
        const isNodeSelected = editorState.read(() => {
          const selection = $getSelection();
          return (
            $isNodeSelection(selection) &&
            selection.has(nodeKey) &&
            selection.getNodes().length === 1
          );
        });
        setIsSelected(isNodeSelected);
      }),
      
      // Handle delete and backspace keys
      editor.registerCommand(
        KEY_DELETE_COMMAND,
        () => {
          if (isSelected) {
            onDelete();
            return true;
          }
          return false;
        },
        COMMAND_PRIORITY_HIGH,
      ),
      editor.registerCommand(
        KEY_BACKSPACE_COMMAND,
        () => {
          if (isSelected) {
            onDelete();
            return true;
          }
          return false;
        },
        COMMAND_PRIORITY_HIGH,
      ),
    );
  }, [editor, nodeKey, onHide, showEquationEditor, isEditable, isSelected, onDelete]);

  // Render based on state
  return (
    <div 
      className={`equation-wrapper ${isSelected ? 'equation-selected' : ''}`}
      onClick={() => isEditable && setIsSelected(true)}
      onDoubleClick={() => isEditable && setShowEquationEditor(true)}
    >
      {showEquationEditor && isEditable ? (
        <EquationEditor
          equation={equationValue}
          setEquation={setEquationValue}
          inline={inline}
          ref={inputRef}
        />
      ) : (
        <>
          <EquationRenderer equation={equationValue} inline={inline} />
          {isSelected && isEditable && (
            <div className="equation-controls">
              <button 
                className="equation-delete-btn" 
                onClick={onDelete}
                aria-label="Delete equation"
              >
                ×
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}