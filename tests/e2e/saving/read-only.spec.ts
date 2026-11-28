import { putRow } from '../support/db';
import { doc, li, link, list, p } from '../support/doc';
import { notice } from '../support/editor';
import { expect, test } from '../support/test';

import type { Page, Request } from '@playwright/test';

/*
 * Read-only documents (B7). The owner chose (2026-11-23) to keep 0.3.0's behavior: a read-only
 * document, such as the info page, can be edited to try things out, and is never saved. The server
 * refuses to change it anyway (B1, B2). These tests pin that behavior.
 */

const locked = { read_only: true };

/** Every request that could save, made while `steps` run and for 3 seconds after. */
async function savesDuring(page: Page, steps: () => Promise<void>): Promise<string[]> {
  const sent: string[] = [];
  const listen = (request: Request) => {
    if (request.method() !== 'GET') sent.push(`${request.method()} ${request.url()}`);
  };
  page.on('request', listen);
  await steps();
  await page.waitForTimeout(3000);
  page.off('request', listen);
  return sent;
}

test('a read-only document can be edited, with no read-only badge', { tag: '@B7' }, async ({ ed, page }) => {
  await ed.open({ content: doc(p('locked text')), row: locked });
  await expect(ed.root).toHaveAttribute('contenteditable', 'true');
  await expect(page.getByText(/read-only/i)).toHaveCount(0);
  await ed.caretAfter('locked text');
  await ed.type(' XYZ');
  await expect(ed.root).toHaveText('locked text XYZ');
});

test('edits to a read-only document are never sent, and a reload undoes them', { tag: '@B7' },
  async ({ ed, page }) => {
    await ed.open({ content: doc(p('locked text'), list('check', li(1, 'todo'))), row: locked });
    const before = await ed.row();
    const sent = await savesDuring(page, async () => {
      await ed.caretAfter('locked text');
      await ed.type(' XYZ');
      await ed.root.locator('li').click({ position: { x: 7, y: 10 } });
      await expect(ed.root.locator('li')).toHaveAttribute('aria-checked', 'true');
    });
    expect(sent).toEqual([]);
    expect(await ed.row()).toEqual(before);
    await ed.reload();
    await expect(ed.root.locator('p').first()).toHaveText('locked text');
    await expect(ed.root.locator('li')).not.toHaveAttribute('aria-checked', 'true');
  });

test('an empty read-only document takes typing, and keeps none of it', { tag: '@B7' },
  async ({ ed, page }) => {
    await ed.open({ content: null, row: locked });
    const sent = await savesDuring(page, () => page.keyboard.type('XYZ'));
    await expect(ed.root).toContainText('XYZ');
    expect(sent).toEqual([]);
    await ed.reload();
    await expect(ed.root).not.toContainText('XYZ');
  });

test('a read-only document stays unchanged in the database', { tag: '@B7' }, async ({ ed, page }) => {
  await ed.open({ content: doc(p('locked text')), row: locked });
  const before = await ed.row();
  await ed.root.getByText('locked text').click();
  await page.keyboard.type('XYZ');
  await page.waitForTimeout(3000);
  expect(await ed.row()).toEqual(before);
});

test('a document locked while it is open stays editable, shows nothing, and is never saved', { tag: '@B7' },
  async ({ ed, page }) => {
    await ed.open({ content: doc(p('saved text')) });
    await ed.caretAfter('saved text');
    await ed.type(' one');
    await ed.saved();
    await putRow({ ...(await ed.row())!, read_only: true });
    const lockedRow = await ed.row();
    const answers: unknown[] = [];
    page.on('response', async (response) => {
      if (response.request().method() === 'POST') answers.push(await response.json().catch(() => null));
    });

    await ed.type(' two');
    await expect.poll(() => answers.length, { timeout: 8000 }).toBeGreaterThan(0);
    expect(answers[0]).toEqual({ status: 'read-only' });
    await ed.type(' three');
    await page.waitForTimeout(3000);

    await expect(ed.root).toHaveAttribute('contenteditable', 'true');
    await expect(ed.root).toHaveText('saved text one two three');
    // Nothing more is sent once the server said it is locked
    expect(answers).toHaveLength(1);
    await expect(notice(page)).toHaveCount(0);
    await expect(page.getByText(/read-only|not saved/i)).toHaveCount(0);
    expect(await ed.row()).toEqual(lockedRow);
  });

test('read-only links still open and text can be copied', { tag: '@B7' }, async ({ ed, context }) => {
  await ed.open({ content: doc(p(link('https://example.com/ro', 'open me'))), row: locked });
  const popup = context.waitForEvent('page');
  await ed.root.getByText('open me').click();
  await expect(await popup).toHaveURL('https://example.com/ro');
  await ed.page.bringToFront();
  await ed.select('open me');
  expect(await ed.page.evaluate(() => getSelection()!.toString())).toBe('open me');
});
