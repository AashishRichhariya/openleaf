/* Autosave: when it saves, that it saves the last edit, and that opening saves nothing. */

import { getRow, newSlug, putRow, storedText } from '../support/db';
import { code, doc, heading, p } from '../support/doc';
import { Editor, notice } from '../support/editor';
import { expect, test } from '../support/test';

test('autosave, then reload', async ({ ed }) => {
  await ed.open();
  await ed.type('# Saved');
  await ed.enter();
  await ed.type('with a body');
  await ed.saved();
  await ed.reload();
  expect(await ed.blocks()).toEqual(['h1', 'paragraph']);
  await expect(ed.root).toContainText('with a body');
});

test('autosave waits for a pause of about two seconds', async ({ ed, page }) => {
  await ed.open();
  await ed.type('pause');
  await page.waitForTimeout(900);
  expect(await ed.row()).toBeNull();
  await ed.saved();
});

test('opening a document writes nothing', async ({ ed, page }) => {
  await ed.open({ content: doc(heading(1, 'untouched'), p('body')) });
  const before = await ed.row();
  await ed.root.getByText('body').click();
  await page.waitForTimeout(3000);
  expect(await ed.row()).toEqual(before);
});

test('opening a new slug creates no row', async ({ ed, page }) => {
  await ed.open();
  await page.waitForTimeout(3000);
  expect(await ed.row()).toBeNull();
});

test('rows keep their shape', async ({ ed }) => {
  await ed.open();
  await ed.type('row shape');
  await ed.saved();
  const row = (await ed.row())!;
  expect(row.version).toBe(1);
  expect(row.read_only).toBe(false);
  expect(row.slug).toBe(ed.slug);
  expect(Date.parse(row.created_at!)).not.toBeNaN();
  expect(Date.parse(row.updated_at!)).not.toBeNaN();
});

test('created_at survives later saves', async ({ ed }) => {
  await ed.open({ content: doc(p('kept')) });
  await ed.caretAfter('kept');
  await ed.type(' date');
  await ed.saved();
  expect((await ed.row())!.created_at).toBe('2025-05-19T10:00:00.000Z');
});

// Highlighting loads after the page. Whenever it comes, it is not an edit: on 0.3.0, opening a
// document never saved it.
for (const delay of [0, 1500]) {
  test(`opening code saves nothing, highlighting ${delay} ms late`, async ({ ed, page }) => {
    const slug = newSlug();
    await putRow({ slug, content: doc(code('def f(x):\n    return x + 1  # add', 'python')) });
    const stored = await getRow(slug);
    let held = 0;
    // Intercepting changes the timing, so it is only done to hold Prism back
    if (delay) {
      await page.route('**/_next/static/chunks/*.js', async (route) => {
        const response = await route.fetch();
        const body = await response.text();
        if (body.includes('languages.extend')) {
          held += 1;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
        await route.fulfill({ response, body });
      });
    }
    await ed.open({ slug });
    await expect(page.locator('.editor-input code span[class*="editor-token"]').first())
      .toBeVisible();
    // 0.3.0 loaded Prism with the page, so there it is never held back
    expect(held).toBeLessThanOrEqual(delay ? 1 : 0);
    // Longer than the autosave's wait, then the page is left
    await page.waitForTimeout(3000);
    await page.goto('about:blank');
    await page.waitForTimeout(1000);
    expect((await getRow(slug))?.updated_at).toBe(stored?.updated_at);
  });
}

// The last edit is saved when the page is left (B4) -----------------------------------------------

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
  test(`the last edit survives ${name}`, { tag: '@B4' }, async ({ ed, context }) => {
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

test('the last edit survives closing the tab', { tag: '@B4' }, async ({ page, context }) => {
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

test('the last edit of a saved document shows after a reload', { tag: '@B4' }, async ({ ed }) => {
  await ed.open();
  await ed.type('first');
  await ed.saved();
  await ed.type(' and last');
  await ed.reload();
  await expect(ed.root).toHaveText('first and last');
  await expect.poll(() => storedText(ed.slug)).toBe('first and last');
  await expect(notice(ed.page)).toHaveCount(0);
});

test('the last edit of a document over 64 KB survives a reload', { tag: '@B4' }, async ({ ed }) => {
  // keepalive requests may not carry more than 64 KB.
  const blocks = Array.from({ length: 260 }, (_line, i) => p(`Block ${i} ${'lorem '.repeat(30)}`));
  await ed.open({ content: doc(...blocks) });
  await ed.caretAfter('Block 1');
  await ed.type('-edited');
  await ed.reload();
  await expect.poll(() => storedText(ed.slug)).toContain('Block 1-edited');
  await expect(ed.root.locator('p').nth(1)).toContainText('Block 1-edited');
});

test('an edit during an unfinished save survives a reload', { tag: '@B4' }, async ({ ed, page }) => {
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

// Continuous typing is saved, and failed saves are retried quietly (B5) ---------------------------

test('continuous typing is saved within a maximum wait', { tag: '@B5' }, async ({ ed, page }) => {
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

test('continuous typing keeps saving', { tag: '@B5' }, async ({ ed, page }) => {
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
  test(`a ${failure} while saving is retried quietly, and saving recovers`, { tag: '@B5' }, async ({ ed, page }) => {
    await ed.open();
    // Saving is implicit, so a save that fails must never show a notice, not even for a moment.
    await page.evaluate(() => {
      const seen = window as unknown as { noticeSeen?: string };
      new MutationObserver(() => {
        const shown = document.querySelector('.editor-notice');
        if (shown) seen.noticeSeen = shown.textContent ?? '';
      }).observe(document.body, { childList: true, subtree: true, characterData: true });
    });
    let failed = 0;
    await page.route('**/*', (route) => {
      if (route.request().method() === 'GET') return route.fallback();
      failed += 1;
      return failure === 'network error'
        ? route.abort('connectionrefused')
        : route.fulfill({ status: 500, body: 'failed' });
    });
    await ed.type('must not be lost');
    // The save and at least one retry fail
    await expect.poll(() => failed, { timeout: 12_000 }).toBeGreaterThanOrEqual(2);
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await ed.type('!');
    await expect.poll(() => storedText(ed.slug), { timeout: 15_000 }).toBe('must not be lost!');
    await expect(notice(page)).toHaveCount(0);
    await expect(page.getByText(/not saved|retrying/i)).toHaveCount(0);
    expect(await page.evaluate(() => (window as unknown as { noticeSeen?: string }).noticeSeen))
      .toBeUndefined();
  });
}

const SHOWN: Record<string, [object, RegExp]> = {
  'too large': [{ status: 413, body: '' }, /too large/],
};

for (const [name, [response, message]] of Object.entries(SHOWN)) {
  test(`a save refused as ${name} is still shown`, { tag: '@B5' }, async ({ ed, page }) => {
    await ed.open();
    await page.route('**/api/documents', (route) =>
      route.request().method() === 'POST' ? route.fulfill(response) : route.fallback());
    await ed.type('refused');
    await expect(notice(page)).toContainText(message, { timeout: 8000 });
  });
}
