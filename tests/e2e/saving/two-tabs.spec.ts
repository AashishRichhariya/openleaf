/* Two tabs editing one document keep both edits (B6). */

import { storedText } from '../support/db';
import { doc, p } from '../support/doc';
import { Editor, notice } from '../support/editor';
import { expect, test } from '../support/test';

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

test('edits to different paragraphs in two tabs are both kept', { tag: '@B6' }, async ({ ed }) => {
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

test('edits to the same paragraph are both kept, and shown as a conflict', { tag: '@B6' }, async ({ ed }) => {
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

test('two tabs starting the same new document keep both texts', { tag: '@B6' }, async ({ ed }) => {
  const [a, b] = await twoTabs(ed);
  await focus(a);
  await a.type('written in A');
  await a.saved();
  await focus(b);
  await b.type('written in B');
  await expect.poll(() => storedText(ed.slug), { timeout: 12_000 }).toContain('written in B');
  expect(await storedText(ed.slug)).toContain('written in A');
});

test('going back to the first tab keeps the second tab\'s edit', { tag: '@B6' }, async ({ ed }) => {
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

test('a paragraph edited in one tab outlives its deletion in the other', { tag: '@B6' }, async ({ ed }) => {
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

test('one tab saving many times never sees a warning', { tag: '@B6' }, async ({ ed, page }) => {
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

test('reloading never warns or duplicates', { tag: '@B6' }, async ({ ed, page }) => {
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

test('two tabs that only read never warn', { tag: '@B6' }, async ({ ed }) => {
  const [a, b] = await twoTabs(ed, doc(p('just reading')));
  await a.reload();
  await b.page.waitForTimeout(2500);
  for (const tab of [a, b]) await expect(notice(tab.page)).toHaveCount(0);
});

test('rows without timestamps still save', { tag: '@B6' }, async ({ ed }) => {
  await ed.open({
    content: doc(p('ancient')),
    row: { created_at: undefined, updated_at: undefined },
  });
  await ed.caretAfter('ancient');
  await ed.type(' row');
  await ed.saved();
  await expect(notice(ed.page)).toHaveCount(0);
});
