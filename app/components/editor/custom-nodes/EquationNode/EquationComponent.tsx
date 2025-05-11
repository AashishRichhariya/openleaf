import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useLexicalEditable } from '@lexical/react/useLexicalEditable';
import { mergeRegister } from '@lexical/utils';
import {
  $createNodeSelection,
  $getNodeByKey,
  $getSelection,
  $isNodeSelection,
  $setSelection,
  COMMAND_PRIORITY_HIGH,
  createCommand,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  KEY_ESCAPE_COMMAND,
  LexicalCommand,
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

export const SELECT_EQUATION_COMMAND: LexicalCommand<string> = 
  createCommand('SELECT_EQUATION_COMMAND');

  export const EDIT_EQUATION_COMMAND: LexicalCommand<string> = 
  createCommand('EDIT_EQUATION_COMMAND');


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

   // This ensures only one equation is selected or edited at a time
   useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        SELECT_EQUATION_COMMAND,
        (selectedNodeKey) => {
          if (selectedNodeKey === nodeKey) {
            setIsSelected(true);
          } else {
            setIsSelected(false);
            setShowEquationEditor(false);
          }
          return false;
        },
        COMMAND_PRIORITY_HIGH,
      ),
      
      editor.registerCommand(
        EDIT_EQUATION_COMMAND,
        (editedNodeKey) => {
          if (editedNodeKey === nodeKey) {
            setIsSelected(true);
            setShowEquationEditor(true);
          } else {
            setShowEquationEditor(false);
          }
          return false;
        },
        COMMAND_PRIORITY_HIGH,
      )
    );
  }, [editor, nodeKey]);

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


  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!isEditable) return;
    
    e.stopPropagation();
    editor.dispatchCommand(SELECT_EQUATION_COMMAND, nodeKey);
    
    // Also update Lexical's selection state
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if ($isEquationNode(node)) {
        const selection = $createNodeSelection();
        selection.add(nodeKey);
        $setSelection(selection);
      }
    });
  }, [editor, isEditable, nodeKey]);
  
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (!isEditable) return;
    
    e.stopPropagation();
    
    // Dispatch command to edit this equation and close other editors
    editor.dispatchCommand(EDIT_EQUATION_COMMAND, nodeKey);
  }, [editor, isEditable, nodeKey]);


  // Render based on state
  return (
    <div 
      className={`equation-wrapper ${isSelected ? 'equation-selected' : ''}`}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
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
                onClick={(e) => {
                  e.stopPropagation(); // NEW: Prevent click from bubbling
                  onDelete();
                }}
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