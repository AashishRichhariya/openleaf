/** Builders for serialized Lexical documents, in the shape 0.31 saved. */

const element = (type: string, children: object[], extra: object = {}) => ({
  children,
  direction: children.length ? 'ltr' : null,
  format: '',
  indent: 0,
  type,
  version: 1,
  ...extra,
});

export const text = (value: string, format = 0) => ({
  detail: 0,
  format,
  mode: 'normal',
  style: '',
  text: value,
  type: 'text',
  version: 1,
});

const inline = (children: Array<object | string>) =>
  children.map((child) => (typeof child === 'string' ? text(child) : child));

export const p = (...children: Array<object | string>) =>
  element('paragraph', inline(children), { textFormat: 0, textStyle: '' });

export const heading = (level: number, ...children: Array<object | string>) =>
  element('heading', inline(children), { tag: `h${level}` });

export const quote = (...children: Array<object | string>) => element('quote', inline(children));

export const code = (value = '', language: string | null = null) => {
  const children: object[] = [];
  value.split('\n').forEach((line, index) => {
    if (index > 0) children.push({ type: 'linebreak', version: 1 });
    if (line) children.push({ ...text(line), type: 'code-highlight' });
  });
  return element('code', children, language === null ? {} : { language });
};

export const li = (value: number, ...children: Array<object | string>) =>
  element('listitem', inline(children), { value });

export const list = (listType: 'bullet' | 'number' | 'check', ...items: object[]) =>
  element('list', items, { listType, start: 1, tag: listType === 'number' ? 'ol' : 'ul' });

export const link = (url: string, ...children: Array<object | string>) =>
  element('link', inline(children), { rel: 'noopener', target: '_blank', title: null, url });

export const br = () => ({ type: 'linebreak', version: 1 });

export const hr = () => ({ type: 'horizontalrule', version: 1 });

export const equation = (value: string, isInline = true) => ({
  equation: value,
  inline: isInline,
  startInEditMode: false,
  type: 'equation',
  version: 1,
});

export const tableWidget = () => ({ type: 'inline-table-input-node', version: 1 });

export const cell = (children: object[], headerState = 0) =>
  element('tablecell', children, {
    backgroundColor: null,
    colSpan: 1,
    headerState,
    rowSpan: 1,
  });

/** A table as INSERT_TABLE_COMMAND makes it: the first row and column are headers. */
export const table = (rows: string[][]) =>
  element(
    'table',
    rows.map((row, y) =>
      element(
        'tablerow',
        row.map((value, x) =>
          cell([value ? p(value) : p()], (y === 0 ? 1 : 0) | (x === 0 ? 2 : 0))),
      ),
    ),
  );

export const doc = (...blocks: object[]) => ({ root: element('root', blocks) });
