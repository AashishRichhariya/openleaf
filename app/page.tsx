"use client";

import { useState } from "react";

export default function EditorPage() {
  const [content, setContent] = useState("");

  return (
    <div className="editor-container">
      <div
        className="editor-content"
        contentEditable
        suppressContentEditableWarning
        // placeholder="Start writing..."
        onInput={(e) => {
          const text = e.currentTarget.textContent || "";
          setContent(text);
        }}
      />
    </div>
  );
}
