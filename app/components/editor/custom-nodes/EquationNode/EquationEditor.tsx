import React, { forwardRef, MutableRefObject, Ref, useLayoutEffect, useRef } from 'react';

type EquationEditorProps = {
  equation: string;
  inline: boolean;
  setEquation: (equation: string) => void;
};

function EquationEditor(
  { equation = '', setEquation, inline }: EquationEditorProps,
  forwardedRef: Ref<HTMLInputElement>,
): React.ReactElement {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setEquation(event.target.value);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.stopPropagation();
    }
  };

  // Focused without scrolling: Lexical already scrolls the equation into view, smoothly
  // (scroll-behavior: smooth), and the browser's own scroll to a focused input landing in the
  // middle of that animation left the page at a different place from one time to the next.
  const input = useRef<HTMLInputElement | null>(null);
  useLayoutEffect(() => {
    input.current?.focus({ preventScroll: true });
  }, []);
  const setInput = (element: HTMLInputElement | null) => {
    input.current = element;
    if (typeof forwardedRef === 'function') forwardedRef(element);
    else if (forwardedRef) {
      (forwardedRef as MutableRefObject<HTMLInputElement | null>).current = element;
    }
  };

  const delimiter = inline ? '$' : '$$';
  
  return (
    <span className="equation-editor-container equation-editor-inline">
      <span className="equation-editor-delimiter">{delimiter}</span>
      <input
        className="equation-editor-input"
        value={equation ?? ''}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        ref={setInput}
        size={Math.max((equation ?? '').length + 2, 5)}
        placeholder="y=mx+c"
      />
      <span className="equation-editor-delimiter">{delimiter}</span>
    </span>
  );
}

export default forwardRef(EquationEditor);