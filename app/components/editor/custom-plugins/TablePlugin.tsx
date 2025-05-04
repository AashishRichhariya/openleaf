'use client';

import { TablePlugin as LexicalTablePlugin } from '@lexical/react/LexicalTablePlugin';
import * as React from 'react';

import { TableActionMenuPlugin } from './TableActionMenuPlugin';
import { TableHoverActionsPlugin } from './TableHoverActionsPlugin';

interface TablePluginsProps {
  anchorElem: HTMLElement | null;
  hasHorizontalScroll?: boolean;
}

export function TablePlugin({ 
  anchorElem = null, 
  hasHorizontalScroll = true, 
}: TablePluginsProps): React.ReactElement {
  return (
    <>
      <LexicalTablePlugin hasHorizontalScroll={hasHorizontalScroll} />
      {anchorElem && (
        <>
          <TableHoverActionsPlugin anchorElem={anchorElem} />
          <TableActionMenuPlugin anchorElem={anchorElem} />
        </>
      )}
    </>
  );
}

export default TablePlugin;