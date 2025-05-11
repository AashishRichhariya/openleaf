import { isHTMLElement } from 'lexical';
import React, { ChangeEvent, forwardRef, Ref, RefObject } from 'react';

type EquationEditorProps = {
  equation: string;
  inline: boolean;
  setEquation: (equation: string) => void;
};

function EquationEditor(
  { equation, setEquation, inline }: EquationEditorProps,
  forwardedRef: Ref<HTMLInputElement | HTMLTextAreaElement>,
): React.ReactElement {
  const onChange = (event: ChangeEvent) => {
    setEquation((event.target as HTMLInputElement).value);
  };

  return inline && isHTMLElement(forwardedRef) ? (
    <span className="equation-editor-container equation-editor-inline">
      <span className="equation-editor-delimiter">$</span>
      <input
        className="equation-editor-input"
        value={equation}
        onChange={onChange}
        autoFocus={true}
        ref={forwardedRef as RefObject<HTMLInputElement>}
      />
      <span className="equation-editor-delimiter">$</span>
    </span>
  ) : (
    <div className="equation-editor-container equation-editor-block">
      <span className="equation-editor-delimiter">$$</span>
      <textarea
        className="equation-editor-input"
        value={equation}
        onChange={onChange}
        autoFocus={true}
        ref={forwardedRef as RefObject<HTMLTextAreaElement>}
      />
      <span className="equation-editor-delimiter">$$</span>
    </div>
  );
}

export default forwardRef(EquationEditor);