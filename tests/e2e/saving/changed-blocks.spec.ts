/*
 * Since 0.5.0 every save sends only the blocks that changed since the revision the server last
 * confirmed, as ranges of that revision's top-level blocks. The whole document is sent when it is
 * smaller, when the server asks for it, and once after the changes were refused.
 */

import { getRow, newSlug, putRow, storedText } from '../support/db';
import { doc, p } from '../support/doc';
import { Editor, notice } from '../support/editor';
import { postSave } from '../support/requests';
import { expect, test } from '../support/test';
import { plainText } from '../support/tree';

import type { BrowserContext, Page, Request } from '@playwright/test';

/** 300 one-line paragraphs, then long ones, so that the document is over 64 KB. */
const LINES = 300;
const LARGE = doc(
  ...Array.from({ length: LINES }, (_, i) => p(`line ${i}`)),
  ...Array.from({ length: 150 }, (_, i) => p(`filler ${i} ${'lorem ipsum '.repeat(30)}`)),
);
const LARGE_BYTES = JSON.stringify(LARGE).length;

interface Sent {
  body: any;
  size: number;
}

const isSave = (request: Request) =>
  request.method() === 'POST' && new URL(request.url()).pathname === '/api/documents';

/** Every save request the page (or every page of the context) sends, as it sends it. */
function recordSaves(target: Page | BrowserContext): Sent[] {
  const sent: Sent[] = [];
  target.on('request', (request) => {
    if (!isSave(request)) return;
    const text = request.postData() ?? '';
    sent.push({ body: JSON.parse(text), size: Buffer.byteLength(text) });
  });
  return sent;
}

/** The answers to those requests, in order. */
function recordAnswers(page: Page): string[] {
  const answers: string[] = [];
  page.on('response', async (response) => {
    if (!isSave(response.request())) return;
    answers.push(await response.json().then((json) => json.status, () => `HTTP ${response.status()}`));
  });
  return answers;
}

/** How many blocks a save carried. */
function blocksSent({ body }: Sent): number {
  if (body.changes) {
    return body.changes.ranges.reduce((sum: number, range: any) => sum + range.blocks.length, 0);
  }
  return body.content?.root.children.length ?? body.patch?.blocks.length ?? 0;
}

const texts = (blocks: any[]) => blocks.map((block) => plainText({ root: block }));

const expectedLines = (change: (lines: string[]) => void) => {
  const lines = texts(LARGE.root.children);
  change(lines);
  return lines.join('|');
};

test('typing in one block of a large document sends only that block', async ({ ed, page }) => {
  await ed.open({ content: LARGE });
  const sent = recordSaves(page);
  await ed.caretAfter('line 200');
  await ed.type(' typed');
  await ed.saved();
  expect(sent).toHaveLength(1);
  const [save] = sent;
  expect(save.body.content).toBeUndefined();
  expect(save.body.changes.count).toBe(LARGE.root.children.length);
  expect(save.body.changes.ranges).toHaveLength(1);
  expect(save.body.changes.ranges[0]).toMatchObject({ start: 200, deleteCount: 1 });
  expect(texts(save.body.changes.ranges[0].blocks)).toEqual(['line 200 typed']);
  // A few hundred bytes, of a document of over 100 KB
  expect(LARGE_BYTES).toBeGreaterThan(100_000);
  expect(save.size).toBeLessThan(1000);
  expect(await storedText(ed.slug)).toBe(expectedLines((lines) => { lines[200] += ' typed'; }));
  await ed.reload();
  await expect(ed.root.locator('p').nth(200)).toHaveText('line 200 typed');
});

test('two far-apart edits in one save send only those two blocks', async ({ ed, page }) => {
  await ed.open({ content: LARGE });
  const sent = recordSaves(page);
  await ed.caretAfter('line 3');
  await ed.type(' first');
  await ed.caretAfter('filler 140 ');
  await ed.type('second ');
  // Both before the save, which waits for a pause of 2 s
  expect(sent).toHaveLength(0);
  await ed.saved();
  expect(sent).toHaveLength(1);
  const { ranges } = sent[0].body.changes;
  expect(ranges.map((range: any) => [range.start, range.deleteCount, range.blocks.length]))
    .toEqual([[3, 1, 1], [LINES + 140, 1, 1]]);
  expect(sent[0].size).toBeLessThan(2000);
  await ed.reload();
  await expect(ed.root.locator('p').nth(3)).toHaveText('line 3 first');
  await expect(ed.root.locator('p').nth(LINES + 140)).toContainText('filler 140 second lorem');
});

test('deleting blocks sends only where they were', async ({ ed, page }) => {
  await ed.open({ content: LARGE });
  const sent = recordSaves(page);
  await ed.caretBefore('line 101');
  await ed.press('Shift+ArrowDown', 2);
  await ed.press('Backspace');
  await ed.saved();
  expect(await storedText(ed.slug)).toBe(expectedLines((lines) => lines.splice(101, 2)));
  expect(sent).toHaveLength(1);
  expect(sent[0].body.changes).toBeDefined();
  expect(blocksSent(sent[0])).toBeLessThanOrEqual(1);
  expect(sent[0].size).toBeLessThan(1000);
  await ed.reload();
  expect(await storedText(ed.slug)).toBe(plainText(await ed.state()));
});

test('inserting blocks sends only the new ones', async ({ ed, page }) => {
  await ed.open({ content: LARGE });
  const sent = recordSaves(page);
  await ed.caretAfter('line 50');
  await ed.enter();
  await ed.type('inserted one');
  await ed.enter();
  await ed.type('inserted two');
  await ed.saved();
  expect(await storedText(ed.slug))
    .toBe(expectedLines((lines) => lines.splice(51, 0, 'inserted one', 'inserted two')));
  const last = sent.at(-1)!;
  expect(last.body.changes.ranges).toEqual([
    expect.objectContaining({ start: 51, deleteCount: 0 }),
  ]);
  expect(texts(last.body.changes.ranges[0].blocks)).toEqual(['inserted one', 'inserted two']);
  await ed.reload();
  await expect(ed.root.locator('p').nth(52)).toHaveText('inserted two');
});

test('moving a block sends it and its old place, not what is between', async ({ ed, page }) => {
  await ed.open({ content: LARGE });
  const sent = recordSaves(page);
  await ed.caretBefore('line 10');
  await ed.press('Shift+ArrowDown');
  const cut = await ed.copy('cut');
  await ed.caretBefore('line 250');
  await ed.paste(cut);
  await ed.saved();
  const stored = (await storedText(ed.slug)).split('|');
  expect(stored.indexOf('line 10')).toBeGreaterThan(stored.indexOf('line 249'));
  expect(stored.indexOf('line 10')).toBeLessThan(stored.indexOf('line 250'));
  expect(stored).not.toContain('line 10line 11');
  expect(sent.every((save) => save.body.changes)).toBe(true);
  for (const save of sent) expect(blocksSent(save)).toBeLessThanOrEqual(4);
  const shown = await ed.tree();
  await ed.reload();
  expect(await ed.tree()).toBe(shown);
});

test('the whole document is sent when it is smaller than the changes', async ({ ed, page }) => {
  await ed.open({ content: doc(p('one short line')) });
  const sent = recordSaves(page);
  await ed.caretAfter('one short line');
  await ed.selectAll();
  await ed.type('all new');
  await ed.saved();
  expect(sent).toHaveLength(1);
  expect(sent[0].body.changes).toBeUndefined();
  expect(texts(sent[0].body.content.root.children)).toEqual(['all new']);
});

test('a new document\'s first save sends the whole document', async ({ ed, page }) => {
  await ed.open();
  const sent = recordSaves(page);
  await ed.type('brand new');
  await ed.saved();
  expect(sent.map((save) => Object.keys(save.body).includes('content'))).toEqual([true]);
});

test('changes that don\'t fit the stored blocks get the whole document, at once', async ({ ed, page }) => {
  await ed.open({ content: LARGE });
  const sent = recordSaves(page);
  const answers = recordAnswers(page);
  // The stored revision gains a block behind the tab's back, without a new updated_at
  const row = (await getRow(ed.slug))!;
  await putRow({ ...row, content: doc(...LARGE.root.children, p('added elsewhere')) });
  await ed.caretAfter('line 7');
  await ed.type(' edited');
  await expect.poll(() => answers, { timeout: 10_000 }).toEqual(['resend', 'saved']);
  expect(sent[0].body.changes).toBeDefined();
  expect(sent[1].body.content).toBeDefined();
  expect(sent[1].body.changes).toBeUndefined();
  // As the whole document always did: what the tab shows is stored
  await ed.saved();
  await expect(notice(page)).toHaveCount(0);
});

test('changes refused as invalid are sent once as the whole document', async ({ ed, page }) => {
  await ed.open({ content: LARGE });
  const sent = recordSaves(page);
  let refused = 0;
  await page.route('**/api/documents', async (route) => {
    const body = route.request().postDataJSON();
    if (body.changes && refused === 0) {
      refused += 1;
      return route.fulfill({ status: 400, contentType: 'application/json', body: '{"status":"invalid"}' });
    }
    return route.continue();
  });
  await ed.caretAfter('line 9');
  await ed.type(' refused');
  await ed.saved();
  expect(sent.map((save) => (save.body.changes ? 'changes' : 'content'))).toEqual(['changes', 'content']);
  await expect(notice(page)).toHaveCount(0);
});

test('a whole document refused as invalid is not sent again', async ({ ed, page }) => {
  await ed.open({ content: LARGE });
  const sent = recordSaves(page);
  await page.route('**/api/documents', (route) =>
    route.fulfill({ status: 400, contentType: 'application/json', body: '{"status":"invalid"}' }));
  await ed.caretAfter('line 9');
  await ed.type(' refused');
  await expect.poll(() => sent.length, { timeout: 8000 }).toBe(2);
  await page.waitForTimeout(5000);
  expect(sent.map((save) => (save.body.changes ? 'changes' : 'content'))).toEqual(['changes', 'content']);
  await expect(notice(page)).toHaveCount(0);
});

test('a lost response, then a further edit to the same block, saves quietly', async ({ ed, page }) => {
  await ed.open({ content: LARGE });
  let lost = 0;
  await page.route('**/api/documents', async (route) => {
    if (lost) return route.continue();
    lost += 1;
    // The server gets the save and stores it, but the answer never arrives
    await route.fetch();
    return route.abort('connectionreset');
  });
  await ed.caretAfter('line 12');
  await ed.type(' one');
  await expect.poll(() => storedText(ed.slug), { timeout: 8000 }).toContain('line 12 one');
  await ed.type(' two');
  await expect.poll(() => storedText(ed.slug), { timeout: 15_000 })
    .toBe(expectedLines((lines) => { lines[12] += ' one two'; }));
  await expect(notice(page)).toHaveCount(0);
  await ed.reload();
  await expect(ed.root.locator('p').nth(12)).toHaveText('line 12 one two');
  // Saved once each, nothing doubled
  expect((await storedText(ed.slug)).match(/one/g)).toHaveLength(1);
});

async function twoTabs(ed: Editor): Promise<[Editor, Editor]> {
  await ed.open({ content: LARGE });
  const other = new Editor(await ed.page.context().newPage());
  await other.open({ slug: ed.slug });
  return [ed, other];
}

test('two tabs changing different blocks of a large document are merged quietly', async ({ ed }) => {
  const [a, b] = await twoTabs(ed);
  const sentByB = recordSaves(b.page);
  await a.page.bringToFront();
  await a.caretAfter('line 20');
  await a.type(' by A');
  await a.saved();
  await b.page.bringToFront();
  await b.caretAfter('line 280');
  await b.type(' by B');
  await expect.poll(() => storedText(ed.slug), { timeout: 15_000 })
    .toBe(expectedLines((lines) => { lines[20] += ' by A'; lines[280] += ' by B'; }));
  await expect(b.root.locator('p').nth(20)).toHaveText('line 20 by A');
  for (const tab of [a, b]) await expect(notice(tab.page)).toHaveCount(0);
  expect(sentByB.length).toBeGreaterThanOrEqual(2);
  for (const save of sentByB) {
    expect(save.body.changes).toBeDefined();
    expect(blocksSent(save)).toBe(1);
  }
});

test('two tabs changing the same block keep both, with the notice', async ({ ed }) => {
  const [a, b] = await twoTabs(ed);
  await a.page.bringToFront();
  await a.caretAfter('line 40');
  await a.type(' by A');
  await a.saved();
  await b.page.bringToFront();
  await b.caretAfter('line 40');
  await b.type(' by B');
  await expect(notice(b.page)).toHaveText(/also edited elsewhere\. Both versions were kept/, { timeout: 10_000 });
  await expect.poll(() => storedText(ed.slug), { timeout: 12_000 }).toContain('line 40 by B');
  expect(await storedText(ed.slug)).toContain('line 40 by A');
  await expect(notice(a.page)).toHaveCount(0);
});

test('closing a tab with a large document sends only the changes', async ({ page, context }) => {
  const slug = newSlug();
  await putRow({ slug, content: LARGE });
  // A closing page's request is not reported to Playwright, so the page notes what it sends
  await context.addInitScript(() => {
    const send = window.fetch;
    window.fetch = (input, init) => {
      if (String(input).endsWith('/api/documents') && typeof init?.body === 'string') {
        const sent = JSON.parse(localStorage.getItem('e2e:sent') ?? '[]');
        localStorage.setItem('e2e:sent', JSON.stringify([...sent, init.body]));
      }
      return send(input, init);
    };
  });
  await page.goto('/robots.txt');
  const opened = context.waitForEvent('page');
  await page.evaluate((url) => void window.open(url, '_blank'), `/${slug}`);
  const tab = new Editor(await opened);
  tab.slug = slug;
  await tab.ready();
  await tab.caretAfter('line 150');
  await tab.type(' last words');
  await tab.page.waitForTimeout(150);
  const closed = tab.page.waitForEvent('close');
  await tab.page.evaluate(() => void setTimeout(() => window.close(), 0));
  await closed;
  await expect.poll(() => storedText(slug), { timeout: 5000 })
    .toBe(expectedLines((lines) => { lines[150] += ' last words'; }));
  const bodies: string[] = await page.evaluate(() => JSON.parse(localStorage.getItem('e2e:sent') ?? '[]'));
  const sent = bodies.map((body) => ({ body: JSON.parse(body), size: Buffer.byteLength(body) }));
  expect(sent).toHaveLength(1);
  expect(sent[0].body.changes.ranges).toHaveLength(1);
  // Well under the 64 KB a closing page may send
  expect(sent[0].size).toBeLessThan(1000);
});

test('leaving during an unfinished save stores the last edit without reopening', async ({ ed, page }) => {
  await ed.open({ content: doc(p('first'), p('second')) });
  // Every save takes over a second to arrive
  await page.route('**/api/documents', async (route) => {
    await new Promise((done) => setTimeout(done, 1200));
    return route.continue().catch(() => undefined);
  });
  await ed.caretAfter('second');
  await ed.type(' saving');
  await page.waitForTimeout(2300);
  // The save is on its way: this edit goes with the page being left
  await ed.type(' plus more');
  await page.goto('about:blank');
  await expect.poll(() => storedText(ed.slug), { timeout: 8000 }).toBe('first|second saving plus more');
});

// Tabs opened before 0.5.0 keep saving --------------------------------------------------------------

test('a whole document, as tabs opened on 0.4.x send it, is saved', async ({ page }) => {
  await page.goto('/robots.txt');
  const slug = newSlug();
  await putRow({ slug, content: doc(p('as stored by 0.4.1')) });
  const revision = (await getRow(slug))!.updated_at!;
  const first = await postSave(page, {
    slug, tab: 'old-tab', seq: 1, revision, content: doc(p('saved by 0.4.x'), p('whole')),
  });
  expect(first.result.status).toBe('saved');
  expect(await storedText(slug)).toBe('saved by 0.4.x|whole');
  // Its next save is based on the first, whose answer it may not have seen yet
  const second = await postSave(page, {
    slug, tab: 'old-tab', seq: 2, revision, content: doc(p('saved again')),
  });
  expect(second.result.status).toBe('saved');
  expect(await storedText(slug)).toBe('saved again');
});

test('a single-range patch, as tabs opened on 0.4.x send it on closing, is saved', async ({ page }) => {
  await page.goto('/robots.txt');
  const slug = newSlug();
  await putRow({ slug, content: doc(p('one'), p('two'), p('three'), p('four')) });
  const revision = (await getRow(slug))!.updated_at!;
  const patch = { start: 1, end: 1, count: 4, blocks: [p('two, patched'), p('inserted')] };
  const { result } = await postSave(page, { slug, tab: 'closing-tab', seq: 1, revision, patch });
  expect(result.status).toBe('saved');
  expect(await storedText(slug)).toBe('one|two, patched|inserted|four');
  // Positions in another revision are a conflict, as they were
  const stale = await postSave(page, {
    slug, tab: 'closing-tab', seq: 2, revision,
    patch: { start: 0, end: 0, count: 5, blocks: [p('stale')] },
  });
  expect(stale.result.status).toBe('conflict');
  expect(await storedText(slug)).toBe('one|two, patched|inserted|four');
});

test('changes on another tab\'s revision are a conflict, and change nothing', async ({ page }) => {
  await page.goto('/robots.txt');
  const slug = newSlug();
  await putRow({ slug, content: doc(p('one'), p('two')) });
  const { result } = await postSave(page, {
    slug, tab: 't', seq: 1, revision: '2020-01-01T00:00:00.000Z',
    changes: { count: 2, ranges: [{ start: 1, deleteCount: 1, blocks: [p('stale')] }] },
  });
  expect(result.status).toBe('conflict');
  expect(texts(result.content.root.children)).toEqual(['one', 'two']);
  expect(await storedText(slug)).toBe('one|two');
});
