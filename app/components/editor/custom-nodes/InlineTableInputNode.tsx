import { INSERT_TABLE_COMMAND } from '@lexical/table';
import { $getNodeByKey, DecoratorNode, LexicalEditor, NodeKey } from 'lexical';
import { ReactElement, useEffect, useRef, useState } from 'react';

interface InlineTableInputProps {
  editor: LexicalEditor;
  nodeKey: NodeKey;
}

export function InlineTableInput({ editor, nodeKey }: InlineTableInputProps) {
  const [dimensions, setDimensions] = useState({ rows: '', cols: '' });
  const [activeInput, setActiveInput] = useState<'rows' | 'cols'>('rows');
  const rowsInputRef = useRef<HTMLInputElement>(null);
  const colsInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus the rows input on mount
    rowsInputRef.current?.focus();
  }, []);

  const handleInputChange = (type: 'rows' | 'cols', value: string) => {
    const numValue = Number(value);
    const maxValue = type === 'rows' ? 500 : 50;

    if (!value || (numValue > 0 && numValue <= maxValue)) {
      setDimensions((prev) => ({ ...prev, [type]: value }));
    }
  };

  const handleFocus = (type: 'rows' | 'cols') => {
    setActiveInput(type);
  };

  const handleKeyDown = (e: React.KeyboardEvent, type: 'rows' | 'cols') => {
    const rows = Number(dimensions.rows);
    const cols = Number(dimensions.cols);
    const isValid = rows > 0 && rows <= 500 && cols > 0 && cols <= 50;

    switch (e.key) {
    case 'Enter':
    case ' ':
      if (isValid) {
        e.preventDefault();
        e.stopPropagation();
        insertTable(rows, cols);
      }
      break;
    case 'Tab':
      if (!e.shiftKey && type === 'rows') {
        e.preventDefault();
        setActiveInput('cols');
        colsInputRef.current?.focus();
      } else if (e.shiftKey && type === 'cols') {
        e.preventDefault();
        setActiveInput('rows');
        rowsInputRef.current?.focus();
      }
      break;
    case 'ArrowRight':
      if (
        type === 'rows' &&
          rowsInputRef.current?.selectionStart === dimensions.rows.length
      ) {
        e.preventDefault();
        setActiveInput('cols');
        colsInputRef.current?.focus();
      }
      break;
    case 'ArrowLeft':
      if (type === 'cols' && colsInputRef.current?.selectionStart === 0) {
        e.preventDefault();
        setActiveInput('rows');
        rowsInputRef.current?.focus();
      }
      break;
    case 'Escape':
      e.preventDefault();
      removeNode();
      break;
    }
  };

  const insertTable = (rows: number, cols: number) => {
    // First remove the node in a separate update
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if (node) {
        node.remove();
      }
    });

    // Then dispatch the table command in a separate update with a small delay
    // This prevents command collision issues
    setTimeout(() => {
      editor.dispatchCommand(INSERT_TABLE_COMMAND, {
        rows: String(rows),
        columns: String(cols),
        includeHeaders: true,
      });
    }, 10);
  };

  const removeNode = () => {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if (node) {
        node.remove();
      }
    });
  };

  // Check if inputs are valid for enabling/disabling the button
  const isValid =
    Number(dimensions.rows) > 0 &&
    Number(dimensions.rows) <= 500 &&
    Number(dimensions.cols) > 0 &&
    Number(dimensions.cols) <= 50;

  // Handle insertion with a button click as well
  const handleButtonClick = () => {
    if (isValid) {
      insertTable(Number(dimensions.rows), Number(dimensions.cols));
    }
  };

  return (
    <span className="editor-table-input" contentEditable={false}>
      <span className="table-command-text">/table</span>
      <input
        ref={rowsInputRef}
        type="number"
        value={dimensions.rows}
        onChange={(e) => handleInputChange('rows', e.target.value)}
        onKeyDown={(e) => handleKeyDown(e, 'rows')}
        onFocus={() => handleFocus('rows')}
        className={activeInput === 'rows' ? 'active' : ''}
        min="1"
        max="500"
        placeholder="rows"
      />
      <span className="dimension-separator">×</span>
      <input
        ref={colsInputRef}
        type="number"
        value={dimensions.cols}
        onChange={(e) => handleInputChange('cols', e.target.value)}
        onKeyDown={(e) => handleKeyDown(e, 'cols')}
        onFocus={() => handleFocus('cols')}
        className={activeInput === 'cols' ? 'active' : ''}
        min="1"
        max="50"
        placeholder="cols"
      />
      <button
        className="editor-table-button"
        onClick={handleButtonClick}
        disabled={!isValid}
      >
        Insert
      </button>
    </span>
  );
}

export class InlineTableInputNode extends DecoratorNode<ReactElement> {
  static getType(): string {
    return 'inline-table-input-node';
  }

  static clone(node: InlineTableInputNode): InlineTableInputNode {
    return new InlineTableInputNode(node.__key);
  }

  constructor(key?: NodeKey) {
    super(key);
  }

  createDOM(): HTMLElement {
    const dom = document.createElement('span');
    dom.className = 'editor-table-input-wrapper';
    return dom;
  }

  updateDOM(): boolean {
    return false;
  }

  decorate(editor: LexicalEditor): ReactElement {
    return <InlineTableInput editor={editor} nodeKey={this.__key} />;
  }

  getTextContent(): string {
    return '/table';
  }

  isInline(): boolean {
    return true;
  }

  // This helps with selection and editing behavior
  isIsolated(): boolean {
    return true;
  }

  // This prevents the node from being affected by text operations
  canBeEmpty(): boolean {
    return false;
  }

  exportJSON() {
    return {
      ...super.exportJSON(),
      type: 'inline-table-input-node',
      version: 1,
    };
  }

  static importJSON(serializedNode: any): InlineTableInputNode {
    const node = new InlineTableInputNode();
    return node;
  }
}

export function $createInlineTableInputNode(): InlineTableInputNode {
  return new InlineTableInputNode();
}
