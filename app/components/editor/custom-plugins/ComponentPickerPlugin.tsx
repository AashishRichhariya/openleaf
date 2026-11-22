import { $createCodeNode } from '@lexical/code';
import {
  INSERT_CHECK_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
} from '@lexical/list';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { INSERT_HORIZONTAL_RULE_COMMAND } from '@lexical/react/LexicalHorizontalRuleNode';
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  useBasicTypeaheadTriggerMatch,
} from '@lexical/react/LexicalTypeaheadMenuPlugin';
import { $createHeadingNode, $createQuoteNode } from '@lexical/rich-text';
import { $setBlocksType } from '@lexical/selection';
import { INSERT_TABLE_COMMAND } from '@lexical/table';
import { mergeRegister } from '@lexical/utils';
import {
  $createParagraphNode,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_NORMAL,
  FORMAT_ELEMENT_COMMAND,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_ENTER_COMMAND,
  LexicalEditor,
  TextNode,
} from 'lexical';
import {
  ReactElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as ReactDOM from 'react-dom';

import { Icon } from '@/app/components/icons';

import { $createInlineTableInputNode } from '../custom-nodes';
import { $liftCaretLine } from '../custom-utils/codeBlockPlacement';

import { INSERT_EQUATION_COMMAND } from './EquationPlugin';


// /NxM: any size of up to two digits each, and longer tables up to 500 rows. A table much
// over 1000 cells is too large to be saved, as DynamoDB items stop at 400 KB.
const MAX_TABLE_ROWS = 500;
const MAX_TABLE_COLUMNS = 500;
const MAX_LARGE_TABLE_CELLS = 1000;

function isAllowedTableSize(rows: number, columns: number): boolean {
  if (rows < 100 && columns < 100) return true;
  return rows <= MAX_TABLE_ROWS
    && columns <= MAX_TABLE_COLUMNS
    && rows * columns <= MAX_LARGE_TABLE_CELLS;
}

class ComponentPickerOption extends MenuOption {
  // What shows up in the editor
  title: string;
  // Icon for display
  icon?: ReactElement;
  // For extra searching.
  keywords: Array<string>;
  // Keyboard shortcut
  shortcut?: string;
  // Whether it makes a block, which can't go inside another block
  createsBlock: boolean;
  // What happens when you select this option?
  onSelect: (queryString: string) => void;

  constructor(
    title: string,
    options: {
      icon?: ReactElement;
      keywords?: Array<string>;
      shortcut?: string; 
      createsBlock?: boolean;
      onSelect: (queryString: string) => void;
    },
  ) {
    super(title);
    this.title = title;
    this.keywords = options.keywords || [];
    this.icon = options.icon;
    this.shortcut = options.shortcut;
    this.createsBlock = options.createsBlock ?? true;
    this.onSelect = options.onSelect.bind(this);
  }
}

function ComponentPickerMenuItem({
  index,
  isSelected,
  onClick,
  onMouseEnter,
  option,
}: {
  index: number;
  isSelected: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  option: ComponentPickerOption;
}) {
  const itemRef = useRef<HTMLLIElement | null>(null);
  const { setRefElement } = option;
  const setItem = useCallback(
    (element: HTMLLIElement | null) => {
      itemRef.current = element;
      setRefElement(element);
    },
    [setRefElement],
  );
  let className = 'item';
  if (isSelected) {
    className += ' selected';
  }

  /*
    Force scroll selected item into view when it's outside the visible area.
    Fixes arrow key navigation on initial "/" trigger where default scroll behavior doesn't work.
    Corrective measure taken to compensate lexical menu scroll doesn't work properly on initial render.
  */
  useLayoutEffect(() => {
    if (!isSelected) return;
    const element = itemRef.current;
    const parent = element?.closest('.typeahead-popover ul');

    if (element && parent) {
      const parentRect = parent.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();

      if (
        elementRect.top < parentRect.top ||
        elementRect.bottom > parentRect.bottom
      ) {
        element.scrollIntoView({ block: 'nearest' });
      }
    }
  });

  return (
    <li
      key={option.key}
      tabIndex={-1}
      className={className}
      ref={setItem}
      role="option"
      aria-selected={isSelected}
      id={'typeahead-item-' + index}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
    >
      {option.icon}
      <span className="text">{option.title}</span>
      {option.shortcut && <span className="shortcut">{option.shortcut}</span>}
    </li>
  );
}

function getDynamicOptions(editor: LexicalEditor, queryString: string) {
  const options: Array<ComponentPickerOption> = [];

  if (queryString == null) {
    return options;
  }

  const tableMatch = queryString.match(/^([1-9]\d{0,2})(?:x([1-9]\d{0,2})?)?$/);

  if (tableMatch !== null) {
    const rows = tableMatch[1];
    const colOptions = (tableMatch[2]
      ? [tableMatch[2]]
      : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(String)
    ).filter((columns) => isAllowedTableSize(Number(rows), Number(columns)));
      
    options.push(
      ...colOptions.map(
        (columns) =>
          new ComponentPickerOption(`${rows}x${columns} Table`, {
            icon: <Icon name="table"/>,
            keywords: ['table'],
            shortcut: '/N×M',
            onSelect: () =>
              editor.dispatchCommand(INSERT_TABLE_COMMAND, { columns, rows }),
          }),
      ),
    );
  }

  return options;
}

function getBaseOptions(editor: LexicalEditor) {
  return [
    new ComponentPickerOption('Paragraph', {
      icon: <Icon name="paragraph"/>,
      keywords: ['normal', 'paragraph', 'p', 'text'],
      shortcut: (() => {
        function isSupported(char: string): string | null {
          try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (ctx === null) {
              return null; 
            }
            ctx.font = '16px sans-serif';
            const fallbackWidth = ctx.measureText('□').width;
            const testWidth = ctx.measureText(char).width;
            return testWidth !== fallbackWidth ? char : null;
          } catch (e) {
            return null;
          }
        }
        return isSupported('\u2B90') ?? // ⮐ 
              isSupported('\u21B5') ?? // ↵
              isSupported('\u23CE') ?? // ⏎ 
              'enter';        
      })(),
      onSelect: () =>
        editor.update(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            $setBlocksType(selection, () => $createParagraphNode());
          }
        }),
    }),
    ...([1, 2, 3] as const).map(
      (n) =>
        new ComponentPickerOption(`Heading ${n}`, {
          icon: <Icon name={`h${n}`}/>,
          keywords: ['heading', 'header', `h${n}`],
          shortcut: '#'.repeat(n),
          onSelect: () =>
            editor.update(() => {
              const selection = $getSelection();
              if ($isRangeSelection(selection)) {
                $setBlocksType(selection, () => $createHeadingNode(`h${n}`));
              }
            }),
        }),
    ),
    new ComponentPickerOption('Table', {
      icon: <Icon name="table"/>,
      keywords: ['table', 'grid', 'spreadsheet', 'rows', 'columns'],
      shortcut: '/N×M',
      onSelect: () => {
        editor.update(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            const node = $createInlineTableInputNode();
            selection.insertNodes([node]);
          }
        });
      },
    }),
    new ComponentPickerOption('Numbered List', {
      icon: <Icon name="number"/>,
      keywords: ['numbered list', 'ordered list', 'ol'],
      shortcut: '1.',
      onSelect: () =>
        editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined),
    }),
    new ComponentPickerOption('Bulleted List', {
      icon: <Icon name="bullet"/>,
      keywords: ['bulleted list', 'unordered list', 'ul'],
      shortcut: '-',
      onSelect: () =>
        editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined),
    }),
    new ComponentPickerOption('Check List', {
      icon: <Icon name="check"/>,
      keywords: ['check list', 'todo list'],
      shortcut: '[x]',
      onSelect: () =>
        editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined),
    }),
    new ComponentPickerOption('Quote', {
      icon: <Icon name="quote"/>,
      keywords: ['block quote'],
      shortcut: '>',
      onSelect: () =>
        editor.update(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            $setBlocksType(selection, () => $createQuoteNode());
          }
        }),
    }),
    new ComponentPickerOption('Inline Equation', {
      icon: <Icon name="equation"/>,
      keywords: ['equation', 'inline', 'inline equation', 'math', 'formula', 'inline math', '$'],
      shortcut: '$.$',
      createsBlock: false,
      onSelect: () =>
        editor.dispatchCommand(INSERT_EQUATION_COMMAND, {
          equation: '',
          inline: true,
          startInEditMode: true,
        }),
    }),
    new ComponentPickerOption('Block Equation', {
      icon: <Icon name="equation"/>,
      keywords: ['equation', 'block', 'block equation', 'display', 'display equation', 'math', 'formula', '$$', 'centered'],
      shortcut: '$$.$$',
      createsBlock: false,
      onSelect: () =>
        editor.dispatchCommand(INSERT_EQUATION_COMMAND, {
          equation: '',
          inline: false,
          startInEditMode: true,
        }),
    }),
    new ComponentPickerOption('Code', {
      icon: <Icon name="code"/>,
      keywords: ['javascript', 'python', 'js', 'codeblock'],
      shortcut: '```',
      onSelect: () =>
        editor.update(() => {
          const selection = $getSelection();

          if ($isRangeSelection(selection)) {
            if (selection.isCollapsed()) {
              $setBlocksType(selection, () => $createCodeNode());
            } else {
              // Will this ever happen?
              const textContent = selection.getTextContent();
              const codeNode = $createCodeNode();
              selection.insertNodes([codeNode]);
              selection.insertRawText(textContent);
            }
          }
        }),
    }),
    new ComponentPickerOption('Divider', {
      icon: <Icon name="horizontal-rule"/>,
      keywords: ['horizontal rule', 'divider', 'hr'],
      shortcut: '---',
      onSelect: () =>
        editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined),
    }),
    ...(['left', 'center', 'right', 'justify'] as const).map(
      (alignment) =>
        new ComponentPickerOption(`Align ${alignment}`, {
          icon: <Icon name={`align-${alignment}`}/>,
          keywords: ['align', 'justify', alignment],
          createsBlock: false,
          onSelect: () =>
            editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, alignment),
        }),
    ),
  ];
}

// Block Equation is listed first and matches these through its keyword 'centered'
function putAlignCenterFirst(
  options: Array<ComponentPickerOption>,
  queryString: string,
): Array<ComponentPickerOption> {
  const query = queryString.toLowerCase();
  if (query.length < 2 || !'center'.startsWith(query)) return options;
  const alignCenter = options.find((option) => option.title === 'Align center');
  if (!alignCenter) return options;
  return [alignCenter, ...options.filter((option) => option !== alignCenter)];
}

export function ComponentPickerPlugin(): ReactElement {
  const [editor] = useLexicalComposerContext();
  const [queryString, setQueryString] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const checkForTriggerMatch = useBasicTypeaheadTriggerMatch('/', {
    minLength: 0,
  });

  const options = useMemo(() => {
    const baseOptions = getBaseOptions(editor);

    if (!queryString) {
      return baseOptions;
    }

    const regex = new RegExp(queryString, 'i');

    return putAlignCenterFirst([
      ...getDynamicOptions(editor, queryString),
      ...baseOptions.filter(
        (option) =>
          regex.test(option.title) ||
          option.keywords.some((keyword) => regex.test(keyword)),
      ),
    ], queryString);
  }, [editor, queryString]);

  // Keys as Lexical 0.31 handled them while the menu is open
  useEffect(() => {
    if (!isOpen) return;
    // With nothing to choose from, the arrows move the caret
    const moveCaret = () => options.length === 0;
    return mergeRegister(
      editor.registerCommand(KEY_ARROW_DOWN_COMMAND, moveCaret, COMMAND_PRIORITY_NORMAL),
      editor.registerCommand(KEY_ARROW_UP_COMMAND, moveCaret, COMMAND_PRIORITY_NORMAL),
      // Shift+Enter picks the option, as Enter does
      editor.registerCommand(
        KEY_ENTER_COMMAND,
        (event) => {
          if (!event?.shiftKey || options.length === 0) return false;
          event.preventDefault();
          return editor.dispatchCommand(KEY_ENTER_COMMAND, null);
        },
        COMMAND_PRIORITY_NORMAL,
      ),
    );
  }, [editor, isOpen, options]);

  const onSelectOption = useCallback(
    (
      selectedOption: ComponentPickerOption,
      nodeToRemove: TextNode | null,
      closeMenu: () => void,
      matchingString: string,
    ) => {
      editor.update(() => {
        nodeToRemove?.remove();
        if (selectedOption.createsBlock) $liftCaretLine();
        selectedOption.onSelect(matchingString);
        closeMenu();
      });
    },
    [editor],
  );

  return (
    <LexicalTypeaheadMenuPlugin<ComponentPickerOption>
      onQueryChange={setQueryString}
      onOpen={() => setIsOpen(true)}
      onClose={() => setIsOpen(false)}
      onSelectOption={onSelectOption}
      triggerFn={checkForTriggerMatch}
      options={options}
      menuRenderFn={(
        anchorElementRef,
        { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex },
      ) =>
        anchorElementRef.current && options.length
          ? ReactDOM.createPortal(
            <div className="typeahead-popover component-picker-menu">
              <ul>
                {options.map((option, i: number) => (
                  <ComponentPickerMenuItem
                    index={i}
                    isSelected={selectedIndex === i}
                    onClick={() => {
                      setHighlightedIndex(i);
                      selectOptionAndCleanUp(option);
                    }}
                    onMouseEnter={() => {
                      setHighlightedIndex(i);
                    }}
                    key={option.key}
                    option={option}
                  />
                ))}
              </ul>
            </div>,
            anchorElementRef.current,
          )
          : null
      }
    />
  );
}
