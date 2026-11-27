/* What is saved is what a reload shows. */

import { newSlug, putRow, storedText } from '../support/db';
import { doc, p, tableWidget,
} from '../support/doc';
import { Editor } from '../support/editor';
import { expect, test } from '../support/test';
import { tree } from '../support/tree';


// Documents of only an empty table or code block survive a reload (B3) ----------------------------

const EMPTY_BLOCKS: Record<string, (ed: Editor) => Promise<void>> = {
  'a table from /2x3': (ed) => ed.pick('2x3'),
  'a one-cell table': (ed) => ed.pick('1x1'),
  'a code block from /code': (ed) => ed.pick('codeblock'),
  'a code block from backticks': (ed) => ed.type('```'),
};

for (const [name, make] of Object.entries(EMPTY_BLOCKS)) {
  test(`${name}, left empty, survives a reload`, { tag: '@B3' }, async ({ ed, page }) => {
    await ed.open();
    await make(ed);
    const blocks = await ed.tree();
    await page.waitForTimeout(3200);
    await ed.reload();
    expect(await ed.tree()).toBe(blocks);
  });
}

// The table size widget is never saved (B13) ------------------------------------------------------

test('the table size widget is never saved', { tag: '@B13' }, async ({ ed, page }) => {
  await ed.open();
  await ed.type('before ');
  await ed.pick('table');
  await page.waitForTimeout(3200);
  const row = await ed.row();
  expect(await storedText(ed.slug)).toContain('before');
  expect(tree(row!.content)).not.toContain('inline-table-input-node');
});

test('an old document with a saved widget opens, and it works', { tag: '@B13' }, async ({ ed, page }) => {
  const slug = newSlug();
  await putRow({ slug, content: doc(p('old '), p(tableWidget())) });
  await ed.open({ slug });
  await expect(page.locator('.editor-table-input')).toBeVisible();
  // It inserts at the caret, so it needs one. Safari gives that up when a button is clicked.
  await ed.caretAfter('old ');
  await page.locator('.editor-table-input input').first().focus();
  await ed.type('2');
  await ed.press('Tab');
  await ed.type('2');
  await ed.enter();
  await expect(ed.root.locator('table tr')).toHaveCount(2);
});
