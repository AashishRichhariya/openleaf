import { doc, equation, heading, link, p, table, tableWidget, text } from '../support/doc';
import { expect, test } from '../support/test';
import { plainText, tree } from '../support/tree';

import type { Editor } from '../support/editor';

const has = async (ed: Editor, type: string) =>
  new RegExp(`(^|\\n) *${type}( |\\n|$)`).test(await ed.tree());

// B9 ---------------------------------------------------------------------------------------------

for (const value of ['α+β', 'गणित', '∑ 🎉', '\\text{中文}', 'café — ok']) {
  test(`B9: an equation with ${value} can be copied and pasted`, async ({ ed, problems }) => {
    await ed.open({ content: doc(p('start ', equation(value), ' end')) });
    await ed.root.getByText('start').click();
    await ed.selectAll();
    const data = await ed.copy();
    expect(data['text/html']).toBeTruthy();
    expect(data['text/plain']).toContain(value);
    await ed.press('Backspace');
    await ed.paste({ 'text/html': data['text/html'] });
    expect(await ed.tree()).toContain(`equation=${JSON.stringify(value)}`);
    expect(problems).toEqual([]);
  });
}

for (const value of ['x^2 + 1', 'café', '5 \\times 3']) {
  test(`guard B9: HTML copied by 0.3.0 still imports (${value})`, async ({ ed }) => {
    await ed.open();
    await ed.paste({
      'text/html': `<span data-lexical-equation="${btoa(value)}" data-lexical-inline="true"`
        + ' data-lexical-start-edit="false">x</span>',
    });
    expect(await ed.tree()).toContain(`equation=${JSON.stringify(value)}`);
  });

  test(`guard B9: what is copied still pastes into 0.3.0 (${value})`, async ({ ed }) => {
    await ed.open({ content: doc(p('start ', equation(value), ' end')) });
    await ed.root.getByText('start').click();
    await ed.selectAll();
    const html = (await ed.copy())['text/html'];
    expect(html).toContain(`data-lexical-equation="${btoa(value)}"`);
  });
}

// B10 --------------------------------------------------------------------------------------------

const PRICES = [
  'costs $5 and $', 'costs $5 and $10 each', 'between $5 and $10', 'from $5 to $10',
  'it is $5 or $', '$20 is more than $', '$5-$10', '$5 - $10', '$5, $10', '$1,000 and $2,000',
  '$4.99 (was $9.99)', '$5k to $10k', '$10/$20', 'was $5. Now it is $', 'paid $15 for lunch and $',
];

for (const value of PRICES) {
  test(`B10: "${value}" is not math`, async ({ ed }) => {
    await ed.open();
    await ed.type(value);
    expect(await has(ed, 'equation')).toBe(false);
    await expect(ed.root).toHaveText(value);
  });
}

test('B10: real math after a price still converts', async ({ ed }) => {
  await ed.open();
  await ed.type('costs $5 and $x$');
  const saved = await ed.tree();
  expect(saved).toContain('text "costs $5 and "');
  expect(saved).toContain('equation="x"');
});

// B11 --------------------------------------------------------------------------------------------

const PROSE = [
  'read https://example.com today', 'see www.example.com for more',
  'write to user@example.com please', 'https://example.com is great',
  'intro\nhttps://example.com', 'https://example.com\nhttps://example.org',
  '(https://example.com)', 'note: see https://example.com/a',
];

for (const value of PROSE) {
  test(`B11: pasting ${JSON.stringify(value)} over a selection is no link`, async ({ ed }) => {
    await ed.open({ content: doc(p('the target word')) });
    await ed.select('target');
    await ed.paste({ 'text/plain': value });
    expect(await has(ed, 'link')).toBe(false);
    const flat = plainText(await ed.state()).replace(/\|/g, '');
    expect(flat).toBe(`the ${value} word`.replace(/\n/g, ''));
  });
}

// B12 --------------------------------------------------------------------------------------------

const HOSTILE: Record<string, string> = {
  '60 KB token': 'a'.repeat(60_000),
  '45 KB token': 'q'.repeat(45_000),
  '60 KB token with a dot every few letters': 'abcde.'.repeat(10_000),
  '60 KB token then an at sign': `${'b'.repeat(60_000)}@`,
  '30 KB of words without spaces after dots': 'word.'.repeat(6_000),
};

for (const [name, value] of Object.entries(HOSTILE)) {
  test(`B12: link detection on a ${name} stays under a second`, async ({ ed, page }) => {
    test.setTimeout(180_000);
    await ed.open();
    const took = await page.evaluate(async (value) => {
      const event = new ClipboardEvent('paste', { bubbles: true, cancelable: true });
      const transfer = new DataTransfer();
      transfer.setData('text/plain', value);
      Object.defineProperty(event, 'clipboardData', { value: transfer });
      // Layout of one giant word is the browser's cost, not the regex's.
      const root = document.querySelector<HTMLElement>('.editor-input')!;
      root.style.whiteSpace = 'pre';
      root.style.overflow = 'hidden';
      const started = performance.now();
      root.dispatchEvent(event);
      await Promise.resolve();
      await new Promise((done) => setTimeout(done, 0));
      return performance.now() - started;
    }, value);
    expect(took).toBeLessThan(1000);
  });
}

test('B12: pasting a 60 KB token over a selection stays under a second', async ({ ed, page }) => {
  test.setTimeout(180_000);
  await ed.open({ content: doc(p('the target word')) });
  await ed.select('target');
  const took = await page.evaluate(async () => {
    const event = new ClipboardEvent('paste', { bubbles: true, cancelable: true });
    const transfer = new DataTransfer();
    transfer.setData('text/plain', 'x'.repeat(60_000));
    Object.defineProperty(event, 'clipboardData', { value: transfer });
    const root = document.querySelector<HTMLElement>('.editor-input')!;
    root.style.whiteSpace = 'pre';
    root.style.overflow = 'hidden';
    const started = performance.now();
    root.dispatchEvent(event);
    await new Promise((done) => setTimeout(done, 0));
    return performance.now() - started;
  });
  expect(took).toBeLessThan(1000);
});

test('guard B12: an email after a long token is still linked', async ({ ed }) => {
  await ed.open();
  await ed.paste({ 'text/plain': `${'a'.repeat(5000)} user@example.com` });
  expect(await ed.tree()).toContain('url="mailto:user@example.com"');
});

// B13 --------------------------------------------------------------------------------------------

test('B13: Escape on an empty line leaves the caret there', async ({ ed }) => {
  await ed.open();
  await ed.pick('table');
  await ed.press('Escape');
  await expect(ed.root).toBeFocused();
  await ed.type('back');
  await expect(ed.root).toHaveText('back');
});

test('B13: Escape after text leaves the caret after it', async ({ ed }) => {
  await ed.open();
  await ed.type('before ');
  await ed.pick('table');
  await ed.press('Escape');
  await ed.type('X');
  await expect(ed.root).toHaveText('before X');
});

test('B13: Escape in the middle of text leaves the caret there', async ({ ed }) => {
  await ed.open({ content: doc(p('left right'), p('next')) });
  await ed.caretAfter('left ');
  await ed.pick('table');
  await ed.press('Escape');
  await ed.type('X');
  await expect(ed.root.locator('p').first()).toHaveText('left Xright');
});

test('B13: Escape from the columns box too', async ({ ed }) => {
  await ed.open();
  await ed.type('cols ');
  await ed.pick('table');
  await ed.type('3');
  await ed.press('Tab');
  await ed.press('Escape');
  await ed.type('X');
  await expect(ed.root).toHaveText('cols X');
});

test('B13: Escape on a widget saved by 0.3.0 leaves the caret there', async ({ ed, page }) => {
  await ed.open({ content: doc(p('old '), p('mid ', tableWidget())) });
  await page.locator('.editor-table-input input').first().click();
  await ed.press('Escape');
  await ed.type('X');
  await expect(ed.root.locator('p').nth(1)).toHaveText('mid X');
});

// B14 --------------------------------------------------------------------------------------------

for (const query of ['ce', 'cen', 'cent', 'cente', 'center']) {
  test(`B14: /${query} selects Align center first`, async ({ ed }) => {
    await ed.open();
    await ed.slash(query);
    await expect(ed.menu.locator('.item[aria-selected="true"] .text')).toHaveText('Align center');
  });
}

test('B14: /center and Enter centers the line', async ({ ed }) => {
  await ed.open();
  await ed.pick('center');
  await ed.type('middle');
  expect(await ed.tree()).toContain('paragraph format="center"');
});

test('guard B14: Block Equation is still found by center and centered', async ({ ed }) => {
  await ed.open();
  await ed.slash('center');
  await expect(ed.option('Block Equation')).toHaveCount(1);
  await ed.type('ed');
  await expect(ed.menu.locator('.item[aria-selected="true"] .text')).toHaveText('Block Equation');
});

// B15 --------------------------------------------------------------------------------------------

test('B15: strikethrough is struck', async ({ ed }) => {
  await ed.open();
  await ed.type('a ~~gone~~ b');
  await expect(ed.root.getByText('gone')).toHaveCSS('text-decoration-line', 'line-through');
});

test('B15: underline with strikethrough shows both', async ({ ed }) => {
  await ed.open({ content: doc(p('x ', text('both', 12))) });
  await expect(ed.root.getByText('both')).toHaveCSS('text-decoration-line', /underline line-through/);
});

test('B15: H4 and H5 look like headings', async ({ ed }) => {
  await ed.open({
    content: doc(heading(3, 'three'), heading(4, 'four'), heading(5, 'five'), p('body')),
  });
  const [three, four, five, body] = await Promise.all(
    ['h3', 'h4', 'h5', 'p'].map((tag) =>
      ed.root.locator(tag).evaluate((element) => {
        const css = getComputedStyle(element);
        return { size: parseFloat(css.fontSize), weight: Number(css.fontWeight) };
      })),
  );
  expect(four.weight).toBeGreaterThanOrEqual(600);
  expect(five.weight).toBeGreaterThanOrEqual(600);
  expect(four.size).toBeLessThan(three.size);
  expect(five.size).toBeLessThan(four.size);
  expect(five.size).toBeGreaterThanOrEqual(body.size);
});

// B16 --------------------------------------------------------------------------------------------

for (const size of ['100x3', '250x2', '500x1', '101x1']) {
  test(`B16: /${size} makes that table`, async ({ ed }) => {
    test.setTimeout(120_000);
    await ed.open();
    await ed.slash(size);
    await ed.enter();
    const [rows, columns] = size.split('x').map(Number);
    await expect(ed.root.locator('table tr')).toHaveCount(rows, { timeout: 30_000 });
    await expect(ed.root.locator('table tr').first().locator('th, td')).toHaveCount(columns);
  });
}

test('B16: /100 offers column counts', async ({ ed }) => {
  await ed.open();
  await ed.slash('100');
  await expect(ed.option('100x3 Table')).toHaveCount(1);
});

for (const size of ['501x1', '9999x2', '500x50', '2x1000']) {
  test(`guard B16: /${size} is over the limit`, async ({ ed }) => {
    await ed.open();
    await ed.type(`/${size}`);
    await expect(ed.option(`${size} Table`)).toHaveCount(0);
  });
}

const GRID = doc(p('before'), table([['A', 'B'], ['c', 'd']]), p('after'));

test('B16: the bottom-right cell offers add column', async ({ ed, page }) => {
  await ed.open({ content: GRID });
  await ed.cell(1, 1).hover();
  await expect(page.locator('.editor-table-add-columns')).toBeVisible({ timeout: 2000 });
});

test('B16: add column from the bottom-right cell works', async ({ ed, page }) => {
  await ed.open({ content: GRID });
  await ed.cell(1, 1).hover();
  await page.locator('.editor-table-add-columns').click({ timeout: 3000 });
  await expect(ed.root.locator('table tr').first().locator('th, td')).toHaveCount(3);
});

test('guard B16: the bottom-right cell still offers add row', async ({ ed, page }) => {
  await ed.open({ content: GRID });
  await ed.cell(1, 1).hover();
  await page.locator('.editor-table-add-rows').click({ timeout: 3000 });
  await expect(ed.root.locator('table tr')).toHaveCount(3);
});

// B18 --------------------------------------------------------------------------------------------

const CLICKS = {
  'a click': {},
  'a modifier click': { modifiers: ['ControlOrMeta'] },
  'a middle click': { button: 'middle' },
} as const;

for (const [name, options] of Object.entries(CLICKS)) {
  for (const kind of ['link', 'detected link'] as const) {
    test(`B18: ${name} on a ${kind} gives the new tab no opener`, async ({ ed, context }) => {
      const url = 'https://example.com/opener';
      if (kind === 'link') {
        await ed.open({ content: doc(p(link(url, 'open me'))) });
      } else {
        await ed.open();
        await ed.type(`${url} end`);
      }
      const popup = context.waitForEvent('page');
      await ed.root.locator('a').click(options as any);
      const tab = await popup;
      await tab.waitForURL(url);
      expect(await tab.evaluate(() => window.opener === null)).toBe(true);
    });
  }
}

test('guard: saved trees never hold javascript: as a live link', async ({ ed }) => {
  await ed.open({ content: doc(p(link('javascript:alert(1)', 'bad'))) });
  await expect(ed.root.locator('a')).not.toHaveAttribute('href', /^javascript:/);
  expect(tree((await ed.row())!.content)).toContain('javascript:alert(1)');
});
