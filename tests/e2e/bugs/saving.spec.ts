import { asStoredByV030, getRow, newSlug, putRow } from '../support/db';
import { code, doc, equation, li, link, list, p, table, tableWidget, text } from '../support/doc';
import { Editor } from '../support/editor';
import { expect, test } from '../support/test';
import { plainText, tree } from '../support/tree';

import type { Page } from '@playwright/test';

const notice = (page: Page) => page.locator('.editor-notice');

async function storedText(slug: string): Promise<string> {
  return plainText((await getRow(slug))?.content ?? null);
}

// B3 ---------------------------------------------------------------------------------------------

const EMPTY_BLOCKS: Record<string, (ed: Editor) => Promise<void>> = {
  'a table from /2x3': (ed) => ed.pick('2x3'),
  'a one-cell table': (ed) => ed.pick('1x1'),
  'a code block from /code': (ed) => ed.pick('codeblock'),
  'a code block from backticks': (ed) => ed.type('```'),
};

for (const [name, make] of Object.entries(EMPTY_BLOCKS)) {
  test(`B3: ${name}, left empty, survives a reload`, async ({ ed, page }) => {
    await ed.open();
    await make(ed);
    const blocks = await ed.tree();
    await page.waitForTimeout(3200);
    await ed.reload();
    expect(await ed.tree()).toBe(blocks);
  });
}

// B4 ---------------------------------------------------------------------------------------------

const LEAVE: Record<string, (ed: Editor) => Promise<unknown>> = {
  'reloading': (ed) => ed.page.reload(),
  'going to another document': (ed) => ed.page.goto(`/${newSlug()}`),
  'going to a blank page': (ed) => ed.page.goto('about:blank'),
  'switching away from the tab': (ed) =>
    ed.page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange', { bubbles: true }));
    }),
};

for (const [name, leave] of Object.entries(LEAVE)) {
  test(`B4: the last edit survives ${name}`, async ({ ed, context }) => {
    // Keeps the browser context alive once the editor tab closes.
    await context.newPage();
    await ed.open();
    await ed.page.bringToFront();
    await ed.root.click();
    await ed.type('last words');
    await ed.page.waitForTimeout(150);
    await leave(ed);
    await expect
      .poll(() => storedText(ed.slug), { timeout: name === 'switching away from the tab' ? 1200 : 5000 })
      .toContain('last words');
  });
}

test('B4: the last edit survives closing the tab', async ({ page, context }) => {
  // A tab a script opened can close itself, which is a real close with its unload events.
  await page.goto('/robots.txt');
  const slug = newSlug();
  const opened = context.waitForEvent('page');
  await page.evaluate((url) => void window.open(url, '_blank'), `/${slug}`);
  const tab = new Editor(await opened);
  await tab.ready();
  await tab.root.click();
  await tab.type('last words');
  await tab.page.waitForTimeout(150);
  const closed = tab.page.waitForEvent('close');
  await tab.page.evaluate(() => void setTimeout(() => window.close(), 0));
  await closed;
  await expect.poll(() => storedText(slug), { timeout: 5000 }).toContain('last words');
});

test('B4: the last edit of a saved document shows after a reload', async ({ ed }) => {
  await ed.open();
  await ed.type('first');
  await ed.saved();
  await ed.type(' and last');
  await ed.reload();
  await expect(ed.root).toHaveText('first and last');
  await expect.poll(() => storedText(ed.slug)).toBe('first and last');
  await expect(notice(ed.page)).toHaveCount(0);
});

test('B4: the last edit of a document over 64 KB survives a reload', async ({ ed }) => {
  // keepalive requests may not carry more than 64 KB.
  const blocks = Array.from({ length: 260 }, (_line, i) => p(`Block ${i} ${'lorem '.repeat(30)}`));
  await ed.open({ content: doc(...blocks) });
  await ed.caretAfter('Block 1');
  await ed.type('-edited');
  await ed.reload();
  await expect.poll(() => storedText(ed.slug)).toContain('Block 1-edited');
  await expect(ed.root.locator('p').nth(1)).toContainText('Block 1-edited');
});

test('B4: an edit during an unfinished save survives a reload', async ({ ed, page }) => {
  await ed.open();
  await page.route('**/*', async (route) => {
    if (route.request().method() === 'GET') return route.fallback();
    await new Promise((done) => setTimeout(done, 1200));
    return route.continue().catch(() => undefined);
  });
  await ed.type('saving');
  await page.waitForTimeout(2300);
  await ed.type(' plus more');
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await ed.reload();
  await expect(ed.root).toHaveText('saving plus more');
  await expect.poll(() => storedText(ed.slug), { timeout: 8000 }).toBe('saving plus more');
});

// B5 ---------------------------------------------------------------------------------------------

test('B5: continuous typing is saved within a maximum wait', async ({ ed, page }) => {
  await ed.open();
  const started = Date.now();
  let stored = '';
  let typed = 0;
  while (Date.now() - started < 10_000 && !stored) {
    await page.keyboard.type(`w${typed} `, { delay: 90 });
    typed += 1;
    stored = await storedText(ed.slug);
  }
  expect(stored).toContain('w0');
});

test('B5: continuous typing keeps saving', async ({ ed, page }) => {
  test.setTimeout(60_000);
  await ed.open({ content: doc(p('start')) });
  await ed.caretAfter('start');
  const seen = new Set<string>();
  const started = Date.now();
  let typed = 0;
  while (Date.now() - started < 16_000 && seen.size < 3) {
    await page.keyboard.type(` w${typed}`, { delay: 90 });
    typed += 1;
    seen.add(await storedText(ed.slug));
  }
  expect(seen.size).toBeGreaterThanOrEqual(3);
});

for (const failure of ['network error', 'server error'] as const) {
  test(`B5: a ${failure} while saving is shown, and saving recovers`, async ({ ed, page }) => {
    await ed.open();
    await page.route('**/*', (route) => {
      if (route.request().method() === 'GET') return route.fallback();
      return failure === 'network error'
        ? route.abort('connectionrefused')
        : route.fulfill({ status: 500, body: 'failed' });
    });
    await ed.type('must not be lost');
    await expect(notice(page)).toContainText(/not saved|save/i, { timeout: 8000 });
    await expect(notice(page)).toBeVisible();
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await ed.type('!');
    await expect.poll(() => storedText(ed.slug), { timeout: 15_000 }).toBe('must not be lost!');
    await expect(notice(page)).toHaveCount(0, { timeout: 10_000 });
  });
}

// B6 ---------------------------------------------------------------------------------------------

async function twoTabs(ed: Editor, content?: object): Promise<[Editor, Editor]> {
  await ed.open(content ? { content } : {});
  const other = new Editor(await ed.page.context().newPage());
  await other.open({ slug: ed.slug });
  return [ed, other];
}

async function focus(tab: Editor) {
  await tab.page.bringToFront();
  await tab.root.focus();
}

test('B6: edits to different paragraphs in two tabs are both kept', async ({ ed }) => {
  const [a, b] = await twoTabs(ed, doc(p('alpha'), p('middle'), p('omega')));
  await focus(a);
  await a.caretAfter('alpha');
  await a.type(' from A');
  await a.saved();
  await focus(b);
  await b.caretAfter('omega');
  await b.type(' from B');
  await expect
    .poll(() => storedText(ed.slug), { timeout: 12_000 })
    .toBe('alpha from A|middle|omega from B');
  await expect(b.root).toContainText('alpha from A');
});

test('B6: edits to the same paragraph are both kept, and shown as a conflict', async ({ ed }) => {
  const [a, b] = await twoTabs(ed, doc(p('shared')));
  await focus(a);
  await a.caretAfter('shared');
  await a.type(' by A');
  await a.saved();
  await focus(b);
  await b.caretAfter('shared');
  await b.type(' by B');
  await expect(notice(b.page)).toBeVisible({ timeout: 10_000 });
  await expect.poll(() => storedText(ed.slug), { timeout: 12_000 }).toContain('shared by B');
  expect(await storedText(ed.slug)).toContain('shared by A');
});

test('B6: two tabs starting the same new document keep both texts', async ({ ed }) => {
  const [a, b] = await twoTabs(ed);
  await focus(a);
  await a.type('written in A');
  await a.saved();
  await focus(b);
  await b.type('written in B');
  await expect.poll(() => storedText(ed.slug), { timeout: 12_000 }).toContain('written in B');
  expect(await storedText(ed.slug)).toContain('written in A');
});

test('B6: going back to the first tab keeps the second tab\'s edit', async ({ ed }) => {
  const [a, b] = await twoTabs(ed, doc(p('one'), p('two'), p('three')));
  await focus(a);
  await a.caretAfter('one');
  await a.type(' A1');
  await a.saved();
  await focus(b);
  await b.caretAfter('two');
  await b.type(' B1');
  await expect.poll(() => storedText(ed.slug), { timeout: 12_000 }).toContain('two B1');
  await focus(a);
  await a.caretAfter('three');
  await a.type(' A2');
  await expect
    .poll(() => storedText(ed.slug), { timeout: 12_000 })
    .toBe('one A1|two B1|three A2');
});

test('B6: a paragraph edited in one tab outlives its deletion in the other', async ({ ed }) => {
  const [a, b] = await twoTabs(ed, doc(p('keep'), p('contested')));
  await focus(a);
  await a.caretAfter('contested');
  await a.type(' and improved');
  await a.saved();
  await focus(b);
  await b.select('contested');
  await b.press('Backspace', 2);
  await expect.poll(async () => (await b.row())!.updated_at, { timeout: 6000 }).toBeTruthy();
  await b.page.waitForTimeout(5000);
  expect(await storedText(ed.slug)).toContain('contested and improved');
});

test('guard B6: one tab saving many times never sees a warning', async ({ ed, page }) => {
  await ed.open();
  let warned = false;
  for (const word of ['one', ' two', ' three']) {
    await ed.type(word);
    await ed.saved();
    warned ||= (await notice(page).count()) > 0;
  }
  await ed.enter();
  await ed.type('four');
  await ed.saved();
  expect(warned).toBe(false);
  await expect(notice(page)).toHaveCount(0);
});

test('guard B6: reloading never warns or duplicates', async ({ ed, page }) => {
  await ed.open({ content: doc(p('base')) });
  await ed.caretAfter('base');
  await ed.type(' one');
  await ed.saved();
  await ed.reload();
  await ed.caretAfter('base one');
  await ed.type(' two');
  await ed.saved();
  await expect(notice(page)).toHaveCount(0);
  expect(await storedText(ed.slug)).toBe('base one two');
});

test('guard B6: two tabs that only read never warn', async ({ ed }) => {
  const [a, b] = await twoTabs(ed, doc(p('just reading')));
  await a.reload();
  await b.page.waitForTimeout(2500);
  for (const tab of [a, b]) await expect(notice(tab.page)).toHaveCount(0);
});

test('guard B6: rows without timestamps still save', async ({ ed }) => {
  await ed.open({
    content: doc(p('ancient')),
    row: { created_at: undefined, updated_at: undefined },
  });
  await ed.caretAfter('ancient');
  await ed.type(' row');
  await ed.saved();
  await expect(notice(ed.page)).toHaveCount(0);
});

// B7 ---------------------------------------------------------------------------------------------

const locked = { read_only: true };

test('B7: a read-only document is not editable and says so', async ({ ed, page }) => {
  await ed.open({ content: doc(p('locked text')), row: locked });
  await expect(ed.root).toHaveAttribute('contenteditable', 'false');
  await expect(page.getByText(/read-only/i)).toBeVisible();
});

test('B7: typing does not appear in a read-only document', async ({ ed, page }) => {
  await ed.open({ content: doc(p('locked text')), row: locked });
  await ed.root.getByText('locked text').click();
  await page.keyboard.type('XYZ');
  await ed.settle();
  await expect(ed.root).toHaveText('locked text');
});

test('B7: checkboxes in a read-only document do not toggle', async ({ ed }) => {
  await ed.open({ content: doc(list('check', li(1, 'todo'))), row: locked });
  await ed.root.locator('li').click({ position: { x: 7, y: 10 } });
  await ed.settle();
  await expect(ed.root.locator('li')).not.toHaveAttribute('aria-checked', 'true');
});

test('B7: an empty read-only document takes no typing', async ({ ed, page }) => {
  await ed.open({ content: null, row: locked });
  await page.keyboard.type('XYZ');
  await ed.settle();
  await expect(ed.root).not.toContainText('XYZ');
});

test('guard B7: a read-only document stays unchanged in the database', async ({ ed, page }) => {
  await ed.open({ content: doc(p('locked text')), row: locked });
  const before = await ed.row();
  await ed.root.getByText('locked text').click();
  await page.keyboard.type('XYZ');
  await page.waitForTimeout(3000);
  expect(await ed.row()).toEqual(before);
});

test('guard B7: read-only links still open and text can be copied', async ({ ed, context }) => {
  await ed.open({ content: doc(p(link('https://example.com/ro', 'open me'))), row: locked });
  const popup = context.waitForEvent('page');
  await ed.root.getByText('open me').click();
  await expect(await popup).toHaveURL('https://example.com/ro');
  await ed.page.bringToFront();
  await ed.select('open me');
  expect(await ed.page.evaluate(() => getSelection()!.toString())).toBe('open me');
});

// B17 --------------------------------------------------------------------------------------------

function nulledFields(node: any): string[] {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(nulledFields);
  return Object.entries(node).flatMap(([key, value]) =>
    (value === null && ['style', 'textStyle', 'equation', 'format', 'text'].includes(key)
      ? [`${node.type}.${key}`]
      : nulledFields(value)));
}

test('B17: an empty style is stored as an empty string', async ({ ed }) => {
  await ed.open();
  await ed.type('styled');
  await ed.saved();
  const content = (await ed.row())!.content;
  expect(nulledFields(content)).toEqual([]);
  expect(content.root.children[0].children[0].style).toBe('');
});

test('B17: an empty equation is stored as an empty string', async ({ ed }) => {
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

test('B17: saving an old row with nulls stores empty strings', async ({ ed }) => {
  await ed.open({
    content: asStoredByV030(doc(p(text('old row'), ' ', equation('')), p(equation('', false)))),
  });
  await ed.caretAfter('old row');
  await ed.type('!');
  await ed.saved();
  expect(nulledFields((await ed.row())!.content)).toEqual([]);
});

test('guard B17: old rows with nulls open and edit', async ({ ed, problems }) => {
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

// B13, the part about what is saved --------------------------------------------------------------

test('B13: the table size widget is never saved', async ({ ed, page }) => {
  await ed.open();
  await ed.type('before ');
  await ed.pick('table');
  await page.waitForTimeout(3200);
  const row = await ed.row();
  expect(await storedText(ed.slug)).toContain('before');
  expect(tree(row!.content)).not.toContain('inline-table-input-node');
});

test('guard B13: an old document with a saved widget opens, and it works', async ({ ed, page }) => {
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
