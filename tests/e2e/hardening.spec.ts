/*
 * Requests no editor sends, which must neither crash nor stall the server, nor change a document.
 * They hold on 0.3.0 too, where most of them reach no save at all, except the one marked found.
 */
import { getRow, newSlug, putRow } from './support/db';
import { doc, p } from './support/doc';
import { legacySave } from './support/requests';
import { expect, test } from './support/test';

import type { Page } from '@playwright/test';

interface Init { method?: string; headers?: Record<string, string>; body?: string }

/** Sends a request from the page. Returns its status and how long it took. */
function timed(page: Page, url: string, init: Init): Promise<{ status: number; ms: number }> {
  return page.evaluate(async ({ url, init }) => {
    const started = performance.now();
    const response = await fetch(url, init);
    await response.text();
    return { status: response.status, ms: performance.now() - started };
  }, { url, init });
}

/** Content whose nodes share each other by reference: tiny as sent, 2^levels nodes decoded. */
function expandingArgs(slug: string, levels: number): unknown[] {
  const shared: object[] = [{ type: 'text', text: 'x', format: 0 }];
  for (let level = 1; level < levels; level += 1) {
    const below = `$0:1:shared:${level - 1}`;
    shared.push({ type: 'paragraph', children: [below, below] });
  }
  const top = `$0:1:shared:${levels - 1}`;
  return [slug, { shared, root: { type: 'root', children: [top, top] } }, false, false];
}

/** Too deep for a recursive walk to survive, and still under the 2 MB a save may send */
function nested(depth: number): string {
  return `${'{"type":"p","children":['.repeat(depth)}${']}'.repeat(depth)}`;
}

test.beforeEach(async ({ page }) => {
  // Any page of the app, for its origin
  await page.goto('/robots.txt');
});

test('app: an old-tab request that expands when decoded is refused quickly', async ({ page }) => {
  const slug = newSlug();
  await putRow({ slug, content: doc(p('precious')) });
  const before = await getRow(slug);
  const request = legacySave(new URL(page.url()).origin, 'x'.repeat(42), expandingArgs(slug, 40));
  expect(request.body.length).toBeLessThan(4000);

  const { status, ms } = await timed(page, request.url, request);
  expect(status).toBeLessThan(500);
  expect(ms).toBeLessThan(2000);
  expect(await getRow(slug)).toEqual(before);
  // Still serving
  expect((await timed(page, '/robots.txt', {})).status).toBe(200);
});

test('app: content nested too deep to work on is refused, not crashed on', async ({ page }) => {
  const slug = newSlug();
  const content = `{"root":{"type":"root","children":[${nested(60_000)}]}}`;
  // Only 0.4.0 has these routes. 0.3.0 answers before reading such a body, which Firefox and
  // Safari report as a network error, so there only the server's health is checked.
  const routes = (await timed(page, '/api/documents', {})).status === 405;
  if (routes) {
    const save = await timed(page, '/api/documents', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: `{"slug":"${slug}","tab":"t","seq":1,"revision":null,"content":${content}}`,
    });
    expect(save.status).toBeGreaterThan(0);
    expect(save.status).toBeLessThan(500);
    const old = legacySave(new URL(page.url()).origin, 'x'.repeat(42), [slug]);
    const oldSave = await timed(page, old.url, { ...old, body: `["${slug}",${content},false,true]` });
    expect(oldSave.status).toBeGreaterThan(0);
    expect(oldSave.status).toBeLessThan(500);
  }
  expect(await getRow(slug)).toBeNull();
  expect((await timed(page, '/robots.txt', {})).status).toBe(200);
});

test('app: an old tab\'s first save of very many blocks does not crash', async ({ page }) => {
  const slug = newSlug();
  await putRow({ slug, content: doc(p('precious')) });
  const before = await getRow(slug);
  // As many as a decoded old-tab request may hold, and more than a function takes as arguments
  const blocks = Array.from({ length: 90_000 }, () => ({ type: 'p' }));
  const request = legacySave(new URL(page.url()).origin, 'x'.repeat(42),
    [slug, { root: { type: 'root', children: blocks } }, false, true]);
  const { status } = await timed(page, request.url, request);
  expect(status).toBeLessThan(500);
  expect(await getRow(slug)).toEqual(before);
});

test('app: a slug too long once lowercased is refused, not crashed on', async ({ page }) => {
  // İ is 2 bytes, and 3 once lowercased: 700 of them fit DynamoDB's 2048 bytes only uppercase
  const slug = 'İ'.repeat(700);
  const { status } = await timed(page, '/api/documents', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ slug, tab: 't', seq: 1, revision: null, content: doc(p('x')) }),
  });
  expect(status).toBeLessThan(500);
});

// A bug of 0.3.0, which answers 500 here, found by the review of the upgrade
test('found: a page for a slug too long to store is not found, not an error', async ({ page }) => {
  const response = await page.goto(`/${'a'.repeat(3000)}`);
  expect(response?.status()).toBe(404);
});
