import React, { forwardRef, Ref, RefObject } from 'react';

type EquationEditorProps = {
  equation: string;
  inline: boolean;
  setEquation: (equation: string) => void;
};

function EquationEditor(
  { equation, setEquation, inline }: EquationEditorProps,
  forwardedRef: Ref<HTMLInputElement>,
): React.ReactElement {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setEquation(event.target.value);
  };

  const delimiter = inline ? '$' : '$$';
  
  return (
    <span className="equation-editor-container equation-editor-inline">
      <span className="equation-editor-delimiter">{delimiter}</span>
      <input
        className="equation-editor-input"
        value={equation}
        onChange={handleChange}
        autoFocus
        ref={forwardedRef as RefObject<HTMLInputElement>}
        size={Math.max(equation.length + 2, 5)}
        placeholder="y=mx+c"
      />
      <span className="equation-editor-delimiter">{delimiter}</span>
    </span>
  );
}

export default forwardRef(EquationEditor);