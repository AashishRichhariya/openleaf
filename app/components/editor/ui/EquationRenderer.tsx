// EquationRenderer.tsx
import katex from 'katex';
import Image from 'next/image';
import React, { useEffect, useRef } from 'react';

interface EquationRendererProps {
  equation: string;
  inline: boolean;
}

export default function EquationRenderer({
  equation,
  inline,
}: EquationRendererProps): React.ReactElement {
  const katexElementRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const katexElement = katexElementRef.current;

    if (katexElement !== null) {
      katex.render(equation, katexElement, {
        displayMode: !inline, 
        errorColor: '#cc0000',
        output: 'html',
        strict: 'warn',
        throwOnError: false,
        trust: false,
      });
    }
  }, [equation, inline]);


  return (
    <>
      <Image
        src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
        width={0}
        height={0}
        alt=""
        style={{ display: 'inline' }}
      />
      <span 
        ref={katexElementRef} 
        className={inline ? "equation-renderer editor-equation-inline" : "equation-renderer editor-equation-block"} 
      />
      <Image
        src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
        width={0}
        height={0}
        alt=""
        style={{ display: 'inline' }}
      />
    </>
  );
}