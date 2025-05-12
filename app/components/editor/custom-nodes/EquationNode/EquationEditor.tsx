import React, { forwardRef, Ref } from 'react';

type EquationEditorProps = {
  equation: string;
  inline: boolean;
  setEquation: (equation: string) => void;
};

function EquationEditor(
  { equation, setEquation, inline }: EquationEditorProps,
  forwardedRef: Ref<HTMLDivElement>
): React.ReactElement {
  const handleInput = (event: React.FormEvent<HTMLDivElement>) => {
    setEquation(event.currentTarget.textContent || '');
  };

  const delimiter = inline ? '$' : '$$';
  return (
    <span className={`equation-editor-container equation-editor-inline`}>
      <span className="equation-editor-delimiter">{delimiter}</span>
      <div
        className="equation-editor-content"
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        ref={forwardedRef}
        dangerouslySetInnerHTML={{ __html: equation }}
      />
      <span className="equation-editor-delimiter">{delimiter}</span>
    </span>
  );
}

export default forwardRef(EquationEditor);