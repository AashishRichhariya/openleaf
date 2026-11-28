/*
 * The save log in each document: one entry per tab, for the 10 most recent tabs, the latest last.
 * Tabs use it to recognize their own saves, late duplicates and the edits of closed tabs.
 */

import { getRow, newSlug, putRow, storedText } from '../support/db';
import { doc, p } from '../support/doc';
import { Editor, notice } from '../support/editor';
import { postSave, tabHash } from '../support/requests';
import { expect, test } from '../support/test';

import type { Page } from '@playwright/test';

/** Saves `text` as the whole document from `tab`, on the stored revision. Returns the new revision. */
async function saveAs(page: Page, slug: string, tab: string, seq: number, text: string) {
  const revision = (await getRow(slug))?.updated_at ?? null;
  const { result } = await postSave(page, { slug, tab, seq, revision, content: doc(p(text)) });
  expect(result.status).toBe('saved');
  return result.revision as string;
}

test.beforeEach(async ({ page }) => {
  // Any page of the app, for its origin
  await page.goto('/robots.txt');
});

test('with 12 tabs saving, the log keeps one entry for each of the last 10', async ({ page }) => {
  const slug = newSlug();
  const tabs = Array.from({ length: 12 }, (_, i) => `tab-${i}-${slug}`);
  // Each tab saves twice, in turns, so that a tab's second save must replace its first
  for (const round of [1, 2]) {
    for (const tab of tabs) await saveAs(page, slug, tab, round, `${tab} round ${round}`);
  }
  const log = (await getRow(slug))!.save_log as Array<{ tab: string; seq: number; at: string }>;
  expect(log).toHaveLength(10);
  expect(log.map((entry) => entry.tab)).toEqual(tabs.slice(2).map(tabHash));
  expect(log.every((entry) => entry.seq === 2)).toBe(true);
  // The latest last
  expect(log.at(-1)!.at).toBe((await getRow(slug))!.updated_at);
  const times = log.map((entry) => Date.parse(entry.at));
  expect([...times].sort((a, b) => a - b)).toEqual(times);
});

test('a save replaces its own tab\'s entry instead of adding one', async ({ page }) => {
  const slug = newSlug();
  for (let seq = 1; seq <= 15; seq += 1) await saveAs(page, slug, 'only-tab', seq, `save ${seq}`);
  const log = (await getRow(slug))!.save_log as Array<{ tab: string; seq: number }>;
  expect(log).toEqual([expect.objectContaining({ tab: tabHash('only-tab'), seq: 15 })]);
});

test('an old log of 100 entries shrinks on the next save', async ({ page }) => {
  const slug = newSlug();
  const old = Array.from({ length: 100 }, (_, i) => ({
    tab: tabHash(`old-${i % 30}`),
    seq: i,
    at: new Date(Date.UTC(2025, 4, 19, 9, 0, i)).toISOString(),
  }));
  await putRow({ slug, content: doc(p('old log')), save_log: old });
  await saveAs(page, slug, 'new-tab', 1, 'new save');
  const log = (await getRow(slug))!.save_log as Array<{ tab: string }>;
  expect(log).toHaveLength(10);
  expect(new Set(log.map((entry) => entry.tab)).size).toBe(10);
  expect(log.at(-1)!.tab).toBe(tabHash('new-tab'));
  // The 9 tabs that saved last before it, in their order
  expect(log.slice(0, -1).map((entry) => entry.tab))
    .toEqual([91, 92, 93, 94, 95, 96, 97, 98, 99].map((i) => tabHash(`old-${i % 30}`)));
});

test('an old log alternating between a few tabs keeps one entry per tab', async ({ page }) => {
  const slug = newSlug();
  const old = Array.from({ length: 100 }, (_, i) => ({
    tab: tabHash(i % 2 ? 'old-b' : 'old-a'),
    seq: i,
    at: new Date(Date.UTC(2025, 4, 19, 9, 0, i)).toISOString(),
  }));
  await putRow({ slug, content: doc(p('old log')), save_log: old });
  await saveAs(page, slug, 'new-tab', 1, 'new save');
  const log = (await getRow(slug))!.save_log as Array<{ tab: string; seq: number }>;
  expect(log.map((entry) => entry.tab)).toEqual(['old-a', 'old-b', 'new-tab'].map(tabHash));
  // Each tab's latest save
  expect(log.map((entry) => entry.seq)).toEqual([98, 99, 1]);
});

test('a late duplicate is still recognized after other tabs saved', async ({ page }) => {
  const slug = newSlug();
  const first = await saveAs(page, slug, 'tab-a', 1, 'a one');
  await saveAs(page, slug, 'tab-a', 2, 'a two');
  for (let i = 0; i < 8; i += 1) await saveAs(page, slug, `tab-${i}`, 1, `other ${i}`);
  const before = await getRow(slug);
  // Save 1 of tab A arrives now, on the revision it was made from
  const { result } = await postSave(page, {
    slug, tab: 'tab-a', seq: 1, revision: null, content: doc(p('a one, late')),
  });
  expect(result).toEqual({ status: 'saved', revision: before!.updated_at });
  expect(await getRow(slug)).toEqual(before);
  expect(first).not.toBe(before!.updated_at);
});

test('the saved content is the content sent, whatever the log holds', async ({ page }) => {
  const slug = newSlug();
  for (let i = 0; i < 12; i += 1) await saveAs(page, slug, `tab-${i}`, 1, `text ${i}`);
  const content = doc(p('first'), p('second', ' part'), p());
  const revision = (await getRow(slug))!.updated_at;
  const { result } = await postSave(page, { slug, tab: 'tab-x', seq: 1, revision, content });
  expect(result.status).toBe('saved');
  expect((await getRow(slug))!.content).toEqual(content);
});

/** Opens a document in a tab that can close itself, which is a real close with its unload events. */
async function closableTab(page: Page, slug: string): Promise<Editor> {
  const opened = page.context().waitForEvent('page');
  await page.evaluate((url) => void window.open(url, '_blank'), `/${slug}`);
  const tab = new Editor(await opened);
  tab.slug = slug;
  await tab.ready();
  return tab;
}

async function close(tab: Editor): Promise<void> {
  const closed = tab.page.waitForEvent('close');
  await tab.page.evaluate(() => void setTimeout(() => window.close(), 0));
  await closed;
}

test('a tab\'s edit that never arrived is recovered, after other tabs saved', async ({ page }) => {
  const slug = newSlug();
  await putRow({ slug, content: doc(p('base'), p('middle'), p('end')) });
  // A closing page's own request can't be stopped (even offline, Chromium delivers it), so the tab
  // goes as in a crash, without its pagehide and visibilitychange, after its saves failed
  await page.context().addInitScript(() => {
    for (const type of ['pagehide', 'visibilitychange']) {
      window.addEventListener(type, (event) => {
        const crashing = (window as unknown as { crashing?: boolean }).crashing;
        if (crashing) event.stopImmediatePropagation();
      }, true);
    }
  });
  const tab = await closableTab(page, slug);
  let failed = 0;
  await tab.page.route('**/api/documents', (route) => {
    failed += 1;
    return route.abort('connectionrefused');
  });
  await tab.caretAfter('end');
  await tab.type(' from the closed tab');
  await expect.poll(() => failed, { timeout: 8000 }).toBeGreaterThanOrEqual(1);
  await tab.page.evaluate(() => { (window as unknown as { crashing?: boolean }).crashing = true; });
  await close(tab);
  expect(await storedText(slug)).toBe('base|middle|end');
  // 11 other tabs save meanwhile, more than the log keeps
  for (let i = 0; i < 11; i += 1) {
    const row = (await getRow(slug))!;
    const { result } = await postSave(page, {
      slug, tab: `other-${i}`, seq: 1, revision: row.updated_at,
      content: doc(p(`base ${i}`), p('middle'), p('end')),
    });
    expect(result.status).toBe('saved');
  }
  const reopened = new Editor(await page.context().newPage());
  await reopened.open({ slug });
  await expect.poll(() => storedText(slug), { timeout: 10_000 })
    .toBe('base 10|middle|end from the closed tab');
  await expect(reopened.root).toContainText('end from the closed tab');
  await expect(notice(reopened.page)).toHaveCount(0);
});

test('a closed tab\'s edit that did arrive is recognized and not applied again', async ({ page }) => {
  const slug = newSlug();
  await putRow({ slug, content: doc(p('base'), p('end')) });
  const tab = await closableTab(page, slug);
  await tab.caretAfter('end');
  await tab.type(' once');
  await tab.page.waitForTimeout(150);
  await close(tab);
  await expect.poll(() => storedText(slug), { timeout: 5000 }).toBe('base|end once');
  // Other tabs then change the same paragraph, but fewer than the log keeps
  for (let i = 0; i < 5; i += 1) {
    const row = (await getRow(slug))!;
    const { result } = await postSave(page, {
      slug, tab: `other-${i}`, seq: 1, revision: row.updated_at,
      content: doc(p('base'), p(`rewritten ${i}`)),
    });
    expect(result.status).toBe('saved');
  }
  const before = await getRow(slug);
  const reopened = new Editor(await page.context().newPage());
  await reopened.open({ slug });
  await reopened.page.waitForTimeout(3000);
  await expect(reopened.root).not.toContainText('end once');
  expect(await getRow(slug)).toEqual(before);
  await expect(notice(reopened.page)).toHaveCount(0);
});

test('a closed tab\'s edit left in the browser is recovered after more than 10 other tabs saved', async ({ page }) => {
  const slug = newSlug();
  const base = doc(p('base'), p('middle'), p('end'));
  await putRow({ slug, content: base });
  const revision = (await getRow(slug))!.updated_at;
  await page.goto('/robots.txt');
  // What a tab closing offline leaves (unsavedEdits.ts), as its last request never arrived
  const content = doc(p('base'), p('middle'), p('end from the closed tab'));
  await page.evaluate(({ slug, revision, base, content }) => {
    localStorage.setItem(`openleaf:unsaved:${slug}:closed-tab`, JSON.stringify({
      tab: 'closed-tab', seq: 3, left: true, storedAt: Date.now(), revision,
      localBase: base, remoteBase: base, content,
    }));
  }, { slug, revision, base, content });
  for (let i = 0; i < 11; i += 1) {
    const row = (await getRow(slug))!;
    const { result } = await postSave(page, {
      slug, tab: `other-${i}`, seq: 1, revision: row.updated_at,
      content: doc(p(`base ${i}`), p('middle'), p('end')),
    });
    expect(result.status).toBe('saved');
  }
  expect((await getRow(slug))!.save_log).toHaveLength(10);
  const reopened = new Editor(await page.context().newPage());
  await reopened.open({ slug });
  await expect.poll(() => storedText(slug), { timeout: 10_000 })
    .toBe('base 10|middle|end from the closed tab');
  await expect(notice(reopened.page)).toHaveCount(0);
});
