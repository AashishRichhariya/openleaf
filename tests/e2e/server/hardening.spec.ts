/*
 * Requests no editor sends, which must neither crash nor stall the server, nor change a document.
 * They hold on 0.3.0 too, where most of them reach no save at all, except the one marked found.
 */

import { getRow, newSlug, putRow } from '../support/db';
import { doc, p } from '../support/doc';
import { legacySave, postSave } from '../support/requests';
import { expect, test } from '../support/test';

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
test('a page for a slug too long to store is not found, not an error', async ({ page }) => {
  const response = await page.goto(`/${'a'.repeat(3000)}`);
  expect(response?.status()).toBe(404);
});

// Changes no tab sends (0.5.0): refused as invalid, quickly, changing nothing --------------------

const block = { type: 'paragraph', children: [{ type: 'text', text: 'crafted' }] };
const range = (start: number, deleteCount: number, blocks: unknown[] = [block]) =>
  ({ start, deleteCount, blocks });

/** Each against a stored document of 3 blocks */
const CRAFTED: Record<string, unknown> = {
  'a range past the end': { count: 3, ranges: [range(3, 1)] },
  'a range starting past the end': { count: 3, ranges: [range(4, 0)] },
  'overlapping ranges': { count: 3, ranges: [range(0, 2), range(1, 1)] },
  'ranges out of order': { count: 3, ranges: [range(2, 1), range(0, 1)] },
  'ranges that touch': { count: 3, ranges: [range(0, 1), range(1, 1)] },
  'two insertions at one place': { count: 3, ranges: [range(1, 0), range(1, 0)] },
  'a range that changes nothing': { count: 3, ranges: [range(1, 0, [])] },
  'a negative start': { count: 3, ranges: [range(-1, 1)] },
  'a fractional position': { count: 3, ranges: [range(0.5, 1)] },
  'a count of zero': { count: 0, ranges: [] },
  'a count beyond safe integers': { count: 2 ** 53, ranges: [range(0, 1)] },
  'a count as text': { count: '3', ranges: [range(0, 1)] },
  'more ranges than blocks allow': {
    count: 3, ranges: Array.from({ length: 5 }, (_, i) => range(i * 2, 0)),
  },
  'ranges that are not a list': { count: 3, ranges: { 0: range(0, 1) } },
  'blocks that are not a list': { count: 3, ranges: [{ start: 0, deleteCount: 1, blocks: block }] },
  'a block without a type': { count: 3, ranges: [range(0, 1, [{ text: 'no type' }])] },
  'a null block': { count: 3, ranges: [range(0, 1, [null])] },
  'a root with children': { count: 3, root: { type: 'root', children: [] }, ranges: [range(0, 1)] },
  'a root with nested fields': { count: 3, root: { type: 'root', deep: { x: 1 } }, ranges: [range(0, 1)] },
  'a root with very many fields': {
    count: 3,
    root: Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`f${i}`, i])),
    ranges: [range(0, 1)],
  },
  'changes that are not an object': [range(0, 1)],
  'too many blocks': {
    count: 3, ranges: [range(0, 1, Array.from({ length: 100_001 }, () => ({ type: 'p' })))],
  },
};

for (const [name, changes] of Object.entries(CRAFTED)) {
  test(`app: changes with ${name} are refused as invalid`, async ({ page }) => {
    const slug = newSlug();
    await putRow({ slug, content: doc(p('one'), p('two'), p('three')) });
    const before = await getRow(slug);
    const body = JSON.stringify({ slug, tab: 't', seq: 1, revision: before!.updated_at, changes });
    const { status, ms } = await timed(page, '/api/documents', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body,
    });
    expect(status).toBe(400);
    expect(ms).toBeLessThan(2000);
    expect(await getRow(slug)).toEqual(before);
    expect((await timed(page, '/robots.txt', {})).status).toBe(200);
  });
}

test('app: changes along with a whole document or a patch are refused as invalid', async ({ page }) => {
  const slug = newSlug();
  await putRow({ slug, content: doc(p('one')) });
  const before = await getRow(slug);
  const changes = { count: 1, ranges: [range(0, 1)] };
  for (const extra of [{ content: doc(p('whole')) }, { patch: { start: 0, end: 0, count: 1, blocks: [] } }]) {
    const body = JSON.stringify({ slug, tab: 't', seq: 1, revision: before!.updated_at, changes, ...extra });
    const { status } = await timed(page, '/api/documents', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body,
    });
    expect(status).toBe(400);
  }
  expect(await getRow(slug)).toEqual(before);
});

test('app: changes with blocks nested too deep to work on are refused, not crashed on', async ({ page }) => {
  const slug = newSlug();
  await putRow({ slug, content: doc(p('precious')) });
  const before = await getRow(slug);
  const changes = `{"count":1,"ranges":[{"start":0,"deleteCount":1,"blocks":[${nested(60_000)}]}]}`;
  const save = await timed(page, '/api/documents', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: `{"slug":"${slug}","tab":"t","seq":1,"revision":"${before!.updated_at}","changes":${changes}}`,
  });
  expect(save.status).toBe(400);
  expect(save.ms).toBeLessThan(2000);
  expect(await getRow(slug)).toEqual(before);
  expect((await timed(page, '/robots.txt', {})).status).toBe(200);
});

test('app: well-formed changes that don\'t fit the stored blocks get "resend", and change nothing', async ({ page }) => {
  const slug = newSlug();
  await putRow({ slug, content: doc(p('one'), p('two'), p('three')) });
  const before = await getRow(slug);
  for (const changes of [
    { count: 4, ranges: [range(0, 1)] },
    { count: 2, ranges: [range(0, 1)] },
  ]) {
    const { result } = await postSave(page, { slug, tab: 't', seq: 1, revision: before!.updated_at, changes });
    expect(result).toEqual({ status: 'resend' });
  }
  // Only changes are ever answered so: a whole document on the same revision is saved
  const whole = await postSave(page, {
    slug, tab: 't', seq: 2, revision: before!.updated_at, content: doc(p('whole')),
  });
  expect(whole.result.status).toBe('saved');
});

test('app: many valid ranges over a large document are applied quickly', async ({ page }) => {
  const slug = newSlug();
  const count = 5000;
  await putRow({
    slug,
    content: doc(...Array.from({ length: count }, (_, i) => p(`b${i}`))),
  }, { compressed: true });
  const before = await getRow(slug);
  // Every other block replaced: 2,500 ranges
  const ranges = Array.from({ length: count / 2 }, (_, i) => range(i * 2, 1, [p(`new ${i}`)]));
  const started = Date.now();
  const { result } = await postSave(page, {
    slug, tab: 't', seq: 1, revision: before!.updated_at, changes: { count, ranges },
  });
  expect(result.status).toBe('saved');
  expect(Date.now() - started).toBeLessThan(5000);
  const children = (await getRow(slug))!.content.root.children;
  expect(children).toHaveLength(count);
  expect(children[0].children[0].text).toBe('new 0');
  expect(children[1].children[0].text).toBe('b1');
  expect(children[count - 2].children[0].text).toBe(`new ${count / 2 - 1}`);
});
