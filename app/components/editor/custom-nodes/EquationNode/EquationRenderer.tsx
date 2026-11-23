import Image from 'next/image';
import React, { useEffect, useRef } from 'react';

import { getKatex, KATEX_OPTIONS, loadKatex } from './katex';

interface EquationRendererProps {
  equation: string;
  inline: boolean;
}

export default function EquationRenderer({
  equation = '',
  inline,
}: EquationRendererProps): React.ReactElement {
  const katexElementRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let current = true;
    const render = () => {
      const katexElement = katexElementRef.current;
      const katex = getKatex();
      if (current && katexElement !== null && katex) {
        katex.render(equation ?? '', katexElement, { ...KATEX_OPTIONS, displayMode: !inline });
      }
    };

    if (getKatex()) render();
    else void loadKatex().then(render);
    return () => {
      current = false;
    };
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
        className={inline ? 'equation-renderer editor-equation-inline' : 'equation-renderer editor-equation-block'} 
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