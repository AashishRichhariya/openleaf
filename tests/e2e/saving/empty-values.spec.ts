/* Empty documents and empty values are stored as such. */

import { asStoredByV030 } from '../support/db';
import { code, doc, equation, p, table, tableWidget, text,
} from '../support/doc';
import { expect, test } from '../support/test';
import { plainText } from '../support/tree';


test('an emptied document is stored empty and takes focus again', async ({ ed }) => {
  await ed.open({ content: doc(p('gone soon')) });
  await ed.root.click();
  await ed.selectAll();
  await ed.press('Backspace');
  await expect.poll(async () => (await ed.row())!.content, { timeout: 8000 }).toBeNull();
  await ed.reload();
  await expect(ed.root).toBeFocused();
  await expect(ed.page.locator('.editor-placeholder')).toBeVisible();
});

test('whitespace alone is an empty document', async ({ ed }) => {
  await ed.open({ content: doc(p('x')) });
  await ed.root.click();
  await ed.selectAll();
  await ed.type('   ');
  await expect.poll(async () => (await ed.row())!.content, { timeout: 8000 }).toBeNull();
});

// Empty strings are stored as empty strings, not null (B17) ---------------------------------------

function nulledFields(node: any): string[] {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(nulledFields);
  return Object.entries(node).flatMap(([key, value]) =>
    (value === null && ['style', 'textStyle', 'equation', 'format', 'text'].includes(key)
      ? [`${node.type}.${key}`]
      : nulledFields(value)));
}

test('an empty style is stored as an empty string', { tag: '@B17' }, async ({ ed }) => {
  await ed.open();
  await ed.type('styled');
  await ed.saved();
  const content = (await ed.row())!.content;
  expect(nulledFields(content)).toEqual([]);
  expect(content.root.children[0].children[0].style).toBe('');
});

test('an empty equation is stored as an empty string', { tag: '@B17' }, async ({ ed }) => {
  await ed.open();
  await ed.type('eq ');
  await ed.pick('inline');
  await ed.enter();
  await ed.saved();
  const content = (await ed.row())!.content;
  expect(nulledFields(content)).toEqual([]);
  const saved = content.root.children[0].children.find((node: any) => node.type === 'equation');
  expect(saved.equation).toBe('');
});

test('saving an old row with nulls stores empty strings', { tag: '@B17' }, async ({ ed }) => {
  await ed.open({
    content: asStoredByV030(doc(p(text('old row'), ' ', equation('')), p(equation('', false)))),
  });
  await ed.caretAfter('old row');
  await ed.type('!');
  await ed.saved();
  expect(nulledFields((await ed.row())!.content)).toEqual([]);
});

test('old rows with nulls open and edit', { tag: '@B17' }, async ({ ed, problems }) => {
  const original = doc(
    p(text('bold', 1), ' plain ', equation('')),
    p(equation('', false)),
    table([['A', ''], ['', 'd']]),
    code('x', 'javascript'),
    p(tableWidget()),
  );
  await ed.open({ content: asStoredByV030(original) });
  await expect(ed.root).toContainText('bold plain');
  await ed.caretAfter('plain');
  await ed.type(' edited');
  expect(plainText(await ed.state())).toContain('plain edited');
  expect(problems.filter((problem) => problem.startsWith('pageerror'))).toEqual([]);
});
