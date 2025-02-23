import { INSERT_TABLE_COMMAND } from "@lexical/table";
import { $getNodeByKey, LexicalEditor, TextNode } from "lexical";
import { ReactElement, useEffect, useRef, useState } from "react";

interface InlineTableInputProps {
  editor: LexicalEditor;
  nodeKey: string;
}

export function InlineTableInput({ editor, nodeKey }: InlineTableInputProps) {
  const [dimensions, setDimensions] = useState({ rows: "", cols: "" });
  const [activeInput, setActiveInput] = useState<"rows" | "cols">("rows");
  const rowsInputRef = useRef<HTMLInputElement>(null);
  const colsInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    rowsInputRef.current?.focus();
  }, []);

  const handleInputChange = (type: "rows" | "cols", value: string) => {
    const numValue = Number(value);
    const maxValue = type === "rows" ? 500 : 50;

    if (!value || (numValue > 0 && numValue <= maxValue)) {
      setDimensions((prev) => ({ ...prev, [type]: value }));
    }
  };

  const handleFocus = (type: "rows" | "cols") => {
    setActiveInput(type);
  };

  const handleKeyDown = (e: React.KeyboardEvent, type: "rows" | "cols") => {
    const rows = Number(dimensions.rows);
    const cols = Number(dimensions.cols);
    const isValid = rows > 0 && rows <= 500 && cols > 0 && cols <= 50;

    switch (e.key) {
      case "Enter":
      case " ":
        if (isValid) {
          e.preventDefault();
          insertTable(rows, cols);
        }
        break;
      case "Tab":
        if (!e.shiftKey && type === "rows") {
          e.preventDefault();
          setActiveInput("cols");
          colsInputRef.current?.focus();
        } else if (e.shiftKey && type === "cols") {
          e.preventDefault();
          setActiveInput("rows");
          rowsInputRef.current?.focus();
        }
        break;
      case "ArrowRight":
        if (
          type === "rows" &&
          rowsInputRef.current?.selectionStart === dimensions.rows.length
        ) {
          e.preventDefault();
          setActiveInput("cols");
          colsInputRef.current?.focus();
        }
        break;
      case "ArrowLeft":
        if (type === "cols" && colsInputRef.current?.selectionStart === 0) {
          e.preventDefault();
          setActiveInput("rows");
          rowsInputRef.current?.focus();
        }
        break;
      case "Escape":
        e.preventDefault();
        removeNode();
        break;
    }
  };

  const insertTable = (rows: number, cols: number) => {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if (node) {
        node.remove();
      }
      editor.dispatchCommand(INSERT_TABLE_COMMAND, {
        columns: String(cols),
        rows: String(rows),
      });
    });
  };

  const removeNode = () => {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if (node) {
        node.remove();
      }
    });
  };

  return (
    <span className="editor-table-input">
      <span className="text-gray-500">/table</span>
      <input
        ref={rowsInputRef}
        type="number"
        value={dimensions.rows}
        onChange={(e) => handleInputChange("rows", e.target.value)}
        onKeyDown={(e) => handleKeyDown(e, "rows")}
        onFocus={() => handleFocus("rows")}
        className={`editor-table-input input ${
          activeInput === "rows" ? "ring-2 ring-blue-500" : ""
        }`}
        min="1"
        max="500"
        placeholder="rows"
      />
      <span className="text-gray-500">×</span>
      <input
        ref={colsInputRef}
        type="number"
        value={dimensions.cols}
        onChange={(e) => handleInputChange("cols", e.target.value)}
        onKeyDown={(e) => handleKeyDown(e, "cols")}
        onFocus={() => handleFocus("cols")}
        className={`editor-table-input input ${
          activeInput === "cols" ? "ring-2 ring-blue-500" : ""
        }`}
        min="1"
        max="50"
        placeholder="cols"
      />
    </span>
  );
}

export class InlineTableInputNode extends TextNode {
  __editor: LexicalEditor;

  constructor(editor: LexicalEditor, text?: string, key?: string) {
    super(text, key);
    this.__editor = editor;
  }

  static getType(): string {
    return "inline-table-input-node";
  }

  static clone(node: InlineTableInputNode): InlineTableInputNode {
    return new InlineTableInputNode(node.__editor, node.__text, node.__key);
  }

  createDOM(): HTMLElement {
    const dom = document.createElement("span");
    dom.className = "inline-block";
    return dom;
  }

  updateDOM(): boolean {
    return false;
  }

  decorate(editor: LexicalEditor): ReactElement {
    return <InlineTableInput editor={editor} nodeKey={this.__key} />;
  }
}

export function $createTableInputNode(
  editor: LexicalEditor
): InlineTableInputNode {
  return new InlineTableInputNode(editor);
}
