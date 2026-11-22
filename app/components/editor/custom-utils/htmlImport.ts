import { $isTableCellNode, TableCellHeaderStates, TableCellNode } from '@lexical/table';
import { DOMConversionMap, DOMConversionOutput } from 'lexical';

/**
 * Pasted HTML as Lexical 0.31.1 imported it: every th is a row header. Later versions make a th
 * in the first column a column header too.
 */
export const HTML_IMPORT: DOMConversionMap = {
  th: (domNode: HTMLElement) => {
    const convert = TableCellNode.importDOM?.()?.th;
    const stock = convert ? convert(domNode) : null;
    if (!stock) return null;
    return {
      ...stock,
      conversion: (node: HTMLElement): DOMConversionOutput | null => {
        const output = stock.conversion(node);
        const cell = output?.node;
        if (!Array.isArray(cell) && $isTableCellNode(cell)) {
          cell.setHeaderStyles(TableCellHeaderStates.ROW, TableCellHeaderStates.BOTH);
        }
        return output;
      },
    };
  },
};
