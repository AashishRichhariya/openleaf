
import { doc, p, table, tableWidget,
} from '../support/doc';
import { Editor } from '../support/editor';
import { scenario } from '../support/scenario';
import { expect, test } from '../support/test';


const mod = 'ControlOrMeta';

const GRID = [['A', 'B', 'C'], ['d', 'e', 'f'], ['g', 'h', 'i']];

const content = doc(p('before'), table(GRID), p('after'));

const empty = doc(table([['', ''], ['', '']]), p());

for (const size of ['1x1', '2x2', '3x4', '5x10', '10x3', '99x2', '2x99']) {
  scenario(`table: /${size}`, async (ed) => {
    await ed.pick(size);
  }, { persist: size === '3x4' || size === '1x1' });
}

scenario('table: /3x4 then typing', async (ed) => {
  await ed.pick('3x4');
  await ed.type('first');
  await ed.press('Tab');
  await ed.type('second');
});

scenario('table: /4 offers one to ten columns', async (ed) => {
  await ed.slash('4');
}, { persist: false });

scenario('table: /4 pick the third size', async (ed) => {
  await ed.slash('4');
  await ed.press('ArrowDown', 2);
  await ed.enter();
});

scenario('table: created between paragraphs', async (ed) => {
  await ed.caretAfter('one');
  await ed.enter();
  await ed.pick('2x2');
}, { content: doc(p('one'), p('two')) });

const widget = (ed: Editor) => ed.pick('table');

scenario('table widget: opens focused', widget, { persist: false });

scenario('table widget: Tab, then Enter', async (ed) => {
  await widget(ed);
  await ed.type('2');
  await ed.press('Tab');
  await ed.type('3');
  await ed.enter();
  await ed.page.waitForTimeout(100);
  await ed.type('cell');
});

scenario('table widget: ArrowRight, then Space', async (ed) => {
  await widget(ed);
  await ed.type('2');
  await ed.press('ArrowRight');
  await ed.type('2');
  await ed.press('Space');
  await ed.page.waitForTimeout(100);
});

scenario('table widget: Insert button', async (ed) => {
  await widget(ed);
  await ed.type('3');
  await ed.press('Tab');
  await ed.type('2');
  await ed.page.locator('.editor-table-button').click();
  await ed.page.waitForTimeout(100);
});

scenario('table widget: ArrowLeft returns to rows', async (ed) => {
  await widget(ed);
  await ed.type('2');
  await ed.press('Tab');
  await ed.press('ArrowLeft');
}, { persist: false });

scenario('table widget: Shift+Tab returns to rows', async (ed) => {
  await widget(ed);
  await ed.type('2');
  await ed.press('Tab');
  await ed.press('Shift+Tab');
}, { persist: false });

scenario('table widget: rows capped at 500', async (ed) => {
  await widget(ed);
  await ed.type('501');
}, { persist: false });

scenario('table widget: columns capped at 50', async (ed) => {
  await widget(ed);
  await ed.type('2');
  await ed.press('Tab');
  await ed.type('51');
}, { persist: false });

scenario('table widget: zero is refused', async (ed) => {
  await widget(ed);
  await ed.type('0');
}, { persist: false });

scenario('table widget: button disabled until both are set', async (ed) => {
  await widget(ed);
  await ed.type('2');
}, { persist: false });

const ITEMS = [
  'above', 'below', 'left', 'right',
  'Delete column', 'Delete row', 'Delete table', 'row header', 'column header',
];

const CELLS = { 'first cell': [0, 0], 'middle cell': [1, 1], 'last cell': [2, 2] };

for (const [where, [row, column]] of Object.entries(CELLS)) {
  for (const item of ITEMS) {
    scenario(`table menu: ${item} from the ${where}`, async (ed) => {
      await ed.clickCell(row, column);
      await ed.cellMenu(item);
    }, { content });
  }

  scenario(`table menu: open on the ${where}`, async (ed) => {
    await ed.clickCell(row, column);
    await ed.page.locator('.table-cell-action-button').click();
  }, { content, persist: false });
}

scenario('table menu: header toggled back', async (ed) => {
  await ed.clickCell(0, 1);
  await ed.cellMenu('row header');
  await ed.clickCell(0, 1);
  await ed.cellMenu('row header');
}, { content });

scenario('table menu: clicking outside closes it', async (ed) => {
  await ed.clickCell(1, 1);
  await ed.page.locator('.table-cell-action-button').click();
  await ed.root.getByText('before').click();
}, { content, persist: false });

scenario('table menu: button toggles it closed', async (ed) => {
  await ed.clickCell(1, 1);
  await ed.page.locator('.table-cell-action-button').click();
  await ed.page.locator('.table-cell-action-button').click();
}, { content, persist: false });

scenario('table menu: button hidden outside a table', async (ed) => {
  await ed.clickCell(1, 1);
  await ed.root.getByText('after').click();
}, { content, persist: false });

scenario('table menu: undo a deleted table', async (ed) => {
  await ed.clickCell(1, 1);
  await ed.cellMenu('Delete table');
  await ed.undo();
}, { content });

async function dragSelect(ed: Editor, from: [number, number], to: [number, number]) {
  await ed.clickCell(...from);
  await ed.page.waitForTimeout(350);
  const a = (await ed.cell(...from).boundingBox())!;
  const b = (await ed.cell(...to).boundingBox())!;
  await ed.page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await ed.page.mouse.down();
  await ed.page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 });
  await ed.page.waitForTimeout(60);
  await ed.page.mouse.up();
  await ed.settle();
}

scenario('table selection: drag over cells', async (ed) => {
  await dragSelect(ed, [0, 0], [1, 1]);
}, { content, persist: false });

scenario('table selection: menu over a selection', async (ed) => {
  await dragSelect(ed, [0, 0], [1, 1]);
  const button = ed.page.locator('.table-cell-action-button');
  if (await button.count()) await button.click();
}, { content, persist: false });

for (const item of ITEMS) {
  scenario(`table selection: ${item} on four cells`, async (ed) => {
    await dragSelect(ed, [0, 0], [1, 1]);
    if (!(await ed.page.locator('.table-cell-action-button').count())) return 'no menu button';
    await ed.cellMenu(item);
  }, { content });
}

scenario('table selection: Backspace clears cells', async (ed) => {
  await dragSelect(ed, [1, 1], [2, 2]);
  await ed.press('Backspace');
}, { content });

scenario('table selection: bold cells', async (ed) => {
  await dragSelect(ed, [1, 1], [2, 2]);
  await ed.press('ControlOrMeta+b');
}, { content });

scenario('table selection: Shift+ArrowDown', async (ed) => {
  await ed.caretAfter('e', 1);
  await ed.press('Shift+ArrowDown', 2);
}, { content, persist: false });

scenario('table selection: select all and delete', async (ed) => {
  await ed.root.getByText('before').click();
  await ed.selectAll();
  await ed.press('Backspace');
}, { content });

scenario('table keys: Tab moves right', async (ed) => {
  await ed.clickCell(0, 0);
  await ed.press('Tab');
}, { content, persist: false });

scenario('table keys: Tab wraps to the next row', async (ed) => {
  await ed.clickCell(0, 2);
  await ed.press('Tab');
}, { content, persist: false });

scenario('table keys: Tab from the last cell', async (ed) => {
  await ed.clickCell(2, 2);
  await ed.press('Tab');
}, { content, persist: false });

scenario('table keys: Shift+Tab moves left', async (ed) => {
  await ed.clickCell(1, 1);
  await ed.press('Shift+Tab');
}, { content, persist: false });

for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) {
  scenario(`table keys: ${key} in an empty table`, async (ed) => {
    await ed.clickCell(1, 1);
    await ed.press(key);
  }, { content: empty, persist: false });

  scenario(`table keys: ${key} leaves the edge`, async (ed) => {
    const last = key === 'ArrowDown' || key === 'ArrowRight';
    await ed.clickCell(last ? 2 : 0, last ? 2 : 0);
    await ed.press(key, 3);
  }, { content, persist: false });
}

scenario('table keys: arrow into a table from above', async (ed) => {
  await ed.caretAfter('before');
  await ed.press('ArrowDown');
}, { content, persist: false });

scenario('table keys: arrow into a table from below', async (ed) => {
  await ed.caretBefore('after');
  await ed.press('ArrowUp');
}, { content, persist: false });

scenario('table keys: Enter in a cell', async (ed) => {
  await ed.clickCell(1, 1);
  await ed.enter();
  await ed.type('second line');
}, { content: empty });

scenario('table keys: Backspace at a cell start', async (ed) => {
  await ed.caretBefore('e', 1);
  await ed.press('Backspace');
}, { content });

scenario('table keys: Backspace after a table', async (ed) => {
  await ed.caretBefore('after');
  await ed.press('Backspace');
}, { content });

scenario('table keys: typing in a header and a cell', async (ed) => {
  await ed.clickCell(0, 1);
  await ed.type('Head');
  await ed.clickCell(1, 1);
  await ed.type('body');
}, { content: empty });

scenario('table hover: bottom row shows add row', async (ed) => {
  await ed.cell(2, 1).hover();
  await ed.page.waitForTimeout(400);
}, { content, persist: false });

scenario('table hover: last column shows add column', async (ed) => {
  await ed.cell(1, 2).hover();
  await ed.page.waitForTimeout(400);
}, { content, persist: false });

scenario('table hover: inner cell shows nothing', async (ed) => {
  await ed.cell(1, 1).hover();
  await ed.page.waitForTimeout(400);
}, { content, persist: false });

scenario('table hover: leaving hides the buttons', async (ed) => {
  await ed.cell(2, 1).hover();
  await ed.page.waitForTimeout(400);
  await ed.page.mouse.move(5, 5, { steps: 5 });
  await ed.page.waitForTimeout(400);
}, { content, persist: false });

scenario('table hover: add a row', async (ed) => {
  await ed.cell(2, 1).hover();
  await ed.page.locator('.editor-table-add-rows').click();
  await ed.type('new row');
}, { content });

scenario('table hover: add a column', async (ed) => {
  await ed.cell(1, 2).hover();
  await ed.page.locator('.editor-table-add-columns').click();
  await ed.type('new column');
}, { content });

const LONG = Array.from({ length: 50 }, (_line, index) => p(`Filler ${index}`));

const PLACED = doc(...LONG.slice(0, 25), table(GRID), ...LONG.slice(25));

scenario('table position: menu on a scrolled page', async (ed) => {
  await ed.clickCell(1, 1);
  await ed.page.locator('.table-cell-action-button').click();
}, { content: PLACED, persist: false });

scenario('table position: menu near the window bottom', async (ed) => {
  await ed.clickCell(2, 1);
  await ed.page.locator('.table-cell-action-button').click();
}, { content, persist: false, viewport: { width: 1280, height: 420 } });

scenario('table position: delete keeps the scroll', async (ed) => {
  await ed.clickCell(1, 1);
  await ed.cellMenu('Delete row');
}, { content: PLACED });

scenario('table position: hover buttons on a scrolled page', async (ed) => {
  await ed.cell(2, 1).hover();
  await ed.page.waitForTimeout(400);
}, { content: PLACED, persist: false });

const WIDE = doc(table([0, 1, 2].map((row) =>
  Array.from({ length: 16 }, (_cell, column) => `r${row}c${column}`))), p());

scenario('table position: wide table', async () => {}, { content: WIDE, persist: false });

scenario('table position: hover on a wide table', async (ed) => {
  await ed.cell(2, 0).hover();
  await ed.page.waitForTimeout(400);
}, { content: WIDE, persist: false });

scenario('table position: cell button after scrolling sideways', async (ed) => {
  await ed.root.locator('.editor-table-scrollable-wrapper').evaluate((wrapper) => {
    wrapper.scrollLeft = 120;
  });
  await ed.clickCell(1, 3);
}, { content: WIDE, persist: false });

scenario('table position: after the window is resized', async (ed) => {
  await ed.clickCell(1, 1);
  await ed.page.setViewportSize({ width: 800, height: 700 });
  await ed.page.waitForTimeout(200);
  await ed.clickCell(1, 2);
}, { content, persist: false });

scenario('table position: narrow screen', async (ed) => {
  await ed.clickCell(1, 2);
  await ed.page.locator('.table-cell-action-button').click();
}, { content, persist: false, viewport: { width: 390, height: 740 } });

scenario('table widget: select all inside the field', async (ed) => {
  await ed.pick('table');
  await ed.type('12');
  await ed.press(`${mod}+a`);
}, { persist: false });

// Paste over selected cells, and tables.
async function selectCells(ed: Editor) {
  await ed.clickCell(1, 1);
  const a = (await ed.cell(1, 1).boundingBox())!;
  const b = (await ed.cell(2, 2).boundingBox())!;
  await ed.page.waitForTimeout(350);
  await ed.page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await ed.page.mouse.down();
  await ed.page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 });
  await ed.page.mouse.up();
  await ed.settle();
}

const NINE_CELLS = doc(p('before'), table([['A', 'B', 'C'], ['d', 'e', 'f'], ['g', 'h', 'i']]), p('after'));

scenario('cells selected: paste rich text', async (ed) => {
  await selectCells(ed);
  await ed.paste({ 'text/html': '<b>bold</b> paste', 'text/plain': 'bold paste' });
}, { content: NINE_CELLS });

scenario('cells selected: paste a table', async (ed) => {
  await selectCells(ed);
  await ed.paste({
    'text/html': '<table><tr><td>1</td><td>2</td></tr></table>', 'text/plain': '1\t2',
  });
}, { content: NINE_CELLS });

scenario('cells selected: paste plain text', async (ed) => {
  await selectCells(ed);
  await ed.paste({ 'text/plain': 'plain' });
}, { content: NINE_CELLS });

scenario('table: select all inside a lone table', async (ed) => {
  await ed.clickCell(1, 1);
  await ed.selectAll();
  await ed.press('Backspace');
}, { content: doc(table([['a', 'b'], ['c', 'd']])) });

scenario('table: Delete on the empty line before it', async (ed) => {
  await ed.root.locator('p').first().click();
  await ed.press('Delete');
}, { content: doc(p(), table([['a', 'b']]), p()) });

scenario('table: a range from outside into it, deleted', async (ed) => {
  await ed.caretBefore('before');
  await ed.press('Shift+ArrowDown', 2);
  await ed.press('Backspace');
}, { content: NINE_CELLS });

// Escape in the table size widget keeps the caret (B13) -------------------------------------------

test('Escape in the table size widget on an empty line leaves the caret there', { tag: '@B13' }, async ({ ed }) => {
  await ed.open();
  await ed.pick('table');
  await ed.press('Escape');
  await expect(ed.root).toBeFocused();
  await ed.type('back');
  await expect(ed.root).toHaveText('back');
});

test('Escape in the table size widget after text leaves the caret after it', { tag: '@B13' }, async ({ ed }) => {
  await ed.open();
  await ed.type('before ');
  await ed.pick('table');
  await ed.press('Escape');
  await ed.type('X');
  await expect(ed.root).toHaveText('before X');
});

test('Escape in the table size widget in the middle of text leaves the caret there', { tag: '@B13' }, async ({ ed }) => {
  await ed.open({ content: doc(p('left right'), p('next')) });
  await ed.caretAfter('left ');
  await ed.pick('table');
  await ed.press('Escape');
  await ed.type('X');
  await expect(ed.root.locator('p').first()).toHaveText('left Xright');
});

test('Escape from the columns box of the table size widget leaves the caret there', { tag: '@B13' }, async ({ ed }) => {
  await ed.open();
  await ed.type('cols ');
  await ed.pick('table');
  await ed.type('3');
  await ed.press('Tab');
  await ed.press('Escape');
  await ed.type('X');
  await expect(ed.root).toHaveText('cols X');
});

test('Escape on a table size widget saved by 0.3.0 leaves the caret there', { tag: '@B13' }, async ({ ed, page }) => {
  await ed.open({ content: doc(p('old '), p('mid ', tableWidget())) });
  await page.locator('.editor-table-input input').first().click();
  await ed.press('Escape');
  await ed.type('X');
  await expect(ed.root.locator('p').nth(1)).toHaveText('mid X');
});

// Large tables from the slash menu, and the add-column button (B16) -------------------------------

for (const size of ['100x3', '250x2', '500x1', '101x1']) {
  test(`/${size} makes that table`, { tag: '@B16' }, async ({ ed }) => {
    test.setTimeout(120_000);
    await ed.open();
    await ed.slash(size);
    await ed.enter();
    const [rows, columns] = size.split('x').map(Number);
    await expect(ed.root.locator('table tr')).toHaveCount(rows, { timeout: 30_000 });
    await expect(ed.root.locator('table tr').first().locator('th, td')).toHaveCount(columns);
  });
}

test('/100 offers column counts', { tag: '@B16' }, async ({ ed }) => {
  await ed.open();
  await ed.slash('100');
  await expect(ed.option('100x3 Table')).toHaveCount(1);
});

for (const size of ['501x1', '9999x2', '500x50', '2x1000']) {
  test(`/${size} is over the table size limit`, { tag: '@B16' }, async ({ ed }) => {
    await ed.open();
    await ed.type(`/${size}`);
    await expect(ed.option(`${size} Table`)).toHaveCount(0);
  });
}

const FOUR_CELLS = doc(p('before'), table([['A', 'B'], ['c', 'd']]), p('after'));

test('the bottom-right cell offers add column', { tag: '@B16' }, async ({ ed, page }) => {
  await ed.open({ content: FOUR_CELLS });
  await ed.cell(1, 1).hover();
  await expect(page.locator('.editor-table-add-columns')).toBeVisible({ timeout: 2000 });
});

test('add column from the bottom-right cell works', { tag: '@B16' }, async ({ ed, page }) => {
  await ed.open({ content: FOUR_CELLS });
  await ed.cell(1, 1).hover();
  await page.locator('.editor-table-add-columns').click({ timeout: 3000 });
  await expect(ed.root.locator('table tr').first().locator('th, td')).toHaveCount(3);
});

test('the bottom-right cell still offers add row', { tag: '@B16' }, async ({ ed, page }) => {
  await ed.open({ content: FOUR_CELLS });
  await ed.cell(1, 1).hover();
  await page.locator('.editor-table-add-rows').click({ timeout: 3000 });
  await expect(ed.root.locator('table tr')).toHaveCount(3);
});
