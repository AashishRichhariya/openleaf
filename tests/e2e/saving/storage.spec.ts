/*
 * How documents are stored: compressed since 0.5.0 (content_gz, the gzip of the content's JSON),
 * while documents stored as maps by 0.3.0 to 0.4.1 keep opening as they did, and are stored
 * compressed from their next save on. Empty documents are stored as they always were.
 */
import { randomBytes } from 'node:crypto';
import { gunzipSync, gzipSync } from 'node:zlib';

import { asStoredByV030, compress, getRow, getStoredItem, newSlug, putRow, storedText } from '../support/db';
import { code, doc, equation, heading, li, link, list, p, quote, table, text } from '../support/doc';
import { Editor, notice } from '../support/editor';
import { legacySave, postSave } from '../support/requests';
import { expect, test } from '../support/test';
import { tree } from '../support/tree';

import type { Page } from '@playwright/test';

/** A document with every kind of block. */
const VARIED = doc(
  heading(1, 'Stored document'),
  p('Some ', text('bold', 1), ' text and ', link('https://example.com', 'a link'), '.'),
  list('bullet', li(1, 'first'), li(2, 'second')),
  p('Inline math ', equation('x^2 + y^2'), ' here'),
  code('const answer = 42;\nconsole.log(answer);', 'javascript'),
  table([['a', 'b'], ['c', 'd']]),
  quote('A quote'),
  p(),
  p('The end'),
);

/** Paragraphs of words until the content's JSON is about `bytes` long. */
function wordy(bytes: number, words = (i: number) => `Paragraph ${i} ${'plain words here '.repeat(20)}`) {
  const blocks = [];
  let size = 0;
  for (let i = 0; size < bytes; i += 1) {
    const block = p(words(i));
    size += JSON.stringify(block).length + 1;
    blocks.push(block);
  }
  return doc(...blocks);
}

/** Text that doesn't compress, in paragraphs of `length` characters. */
function noise(paragraphs: number, length = 400): string[] {
  return Array.from({ length: paragraphs }, () => randomBytes(length).toString('base64').slice(0, length));
}

async function expectCompressed(slug: string): Promise<any> {
  const item = (await getStoredItem(slug))!;
  expect(Buffer.isBuffer(item.content_gz)).toBe(true);
  expect('content' in item).toBe(false);
  return JSON.parse(gunzipSync(item.content_gz).toString('utf8'));
}

test('a new document is stored compressed', async ({ ed }) => {
  await ed.open();
  await ed.type('# Compressed');
  await ed.enter();
  await ed.type('from the start');
  await ed.saved();
  const content = await expectCompressed(ed.slug);
  expect(tree(content)).toBe(await ed.tree());
  await ed.reload();
  expect(tree((await getRow(ed.slug))!.content)).toBe(await ed.tree());
  await expect(ed.root).toContainText('from the start');
});

test('an old-format document opens like a compressed one, and converts on its next save', async ({
  ed, page,
}) => {
  // The same content in both formats opens the same
  const twin = new Editor(await page.context().newPage());
  await twin.open({ content: VARIED, compressed: true });
  await ed.open({ content: VARIED });
  expect(await ed.tree()).toBe(await twin.tree());
  // Opening writes nothing, so it stays as it was
  await page.waitForTimeout(2500);
  const item = (await getStoredItem(ed.slug))!;
  expect(item.content).toEqual(VARIED);
  expect('content_gz' in item).toBe(false);

  await ed.caretAfter('The end');
  await ed.type(', edited');
  await ed.saved();
  const stored = await expectCompressed(ed.slug);
  const shown = await ed.tree();
  expect(tree(stored)).toBe(shown);
  await ed.reload();
  expect(await ed.tree()).toBe(shown);
  await expect(notice(page)).toHaveCount(0);
});

test('a document saved by 0.3.0 opens as before, and converts on its next save', async ({
  ed, page,
}) => {
  // Empty strings stored as null, and code that three backticks put inside its paragraph (B8)
  const old = asStoredByV030(doc(
    p('before'),
    { ...p(), children: [text('typed '), code('old code', 'javascript'), text('after')] },
    p('', ''),
  ));
  const twin = new Editor(await page.context().newPage());
  await twin.open({ content: old });
  await ed.open({ content: old, compressed: true });
  // The compressed copy reads as the old one: the same repairs are made
  expect(await ed.tree()).toBe(await twin.tree());
  await twin.caretAfter('before');
  await twin.type(' and now');
  await twin.saved();
  const stored = await expectCompressed(twin.slug);
  const shown = await twin.tree();
  expect(tree(stored)).toBe(shown);
  await twin.reload();
  expect(await twin.tree()).toBe(shown);
});

test('an empty document is stored as before: content null, nothing compressed', async ({ ed }) => {
  await ed.open({ content: doc(p('to delete')), compressed: true });
  await ed.select('to delete');
  await ed.press('Backspace');
  await expect.poll(async () => (await getStoredItem(ed.slug))!.content, { timeout: 8000 })
    .toBeNull();
  const item = (await getStoredItem(ed.slug))!;
  expect('content' in item).toBe(true);
  expect('content_gz' in item).toBe(false);
});

test('a new document left empty is never stored compressed', async ({ ed, page }) => {
  await ed.open();
  await ed.type('x');
  await ed.saved();
  await ed.press('Backspace');
  await expect.poll(async () => (await getStoredItem(ed.slug))!.content, { timeout: 8000 })
    .toBeNull();
  expect('content_gz' in (await getStoredItem(ed.slug))!).toBe(false);
  await ed.reload();
  expect(await ed.blocks()).toEqual(['paragraph']);
  await expect(notice(page)).toHaveCount(0);
});

test('a document of 1.5 MB, over the old limit of 400 KB, saves and reloads', async ({ ed, page }) => {
  test.setTimeout(120_000);
  const content = wordy(1_500_000);
  expect(JSON.stringify(content).length).toBeGreaterThan(1_500_000);
  await page.goto('/robots.txt');
  const slug = newSlug();
  const { result } = await postSave(page, { slug, tab: 'big', seq: 1, revision: null, content });
  expect(result.status).toBe('saved');
  const item = (await getStoredItem(slug))!;
  expect(item.content_gz.length).toBeLessThan(400_000);
  expect((await getRow(slug))!.content).toEqual(content);

  await ed.open({ slug });
  await expect(ed.root.locator('p')).toHaveCount(content.root.children.length);
  await ed.caretAfter('Paragraph 3 ');
  await ed.type('edited ');
  await expect.poll(() => storedText(slug), { timeout: 15_000 }).toContain('Paragraph 3 edited plain');
  await ed.reload();
  await expect(ed.root.locator('p').nth(3)).toContainText('Paragraph 3 edited plain');
  await expect(notice(page)).toHaveCount(0);
});

test('content too large even compressed is refused as too large', async ({ page }) => {
  await page.goto('/robots.txt');
  const slug = newSlug();
  await putRow({ slug, content: doc(p('precious')) });
  const before = await getStoredItem(slug);
  // About 600 KB that compresses to about 450 KB
  const content = doc(...noise(1500).map((value) => p(value)));
  // DynamoDB's limit is 400 KB, 409,600 bytes
  expect(gzipSync(JSON.stringify(content)).length).toBeGreaterThan(420_000);
  const { result } = await postSave(page, { slug, tab: 't', seq: 1, revision: before!.updated_at, content });
  expect(result).toEqual({ status: 'too-large' });
  expect(await getStoredItem(slug)).toEqual(before);
});

test('an edit that makes a document too large even compressed shows "too large"', async ({ ed, page }) => {
  test.setTimeout(120_000);
  // Just under the limit of 409,600 bytes once compressed
  const blocks = [p('Type here')];
  while (gzipSync(JSON.stringify(doc(...blocks))).length < 380_000) {
    blocks.push(...noise(50).map((value) => p(value)));
  }
  await ed.open({ content: doc(...blocks), compressed: true });
  const before = await getStoredItem(ed.slug);
  await ed.caretAfter('Type here');
  // About 80 KB more, which compresses to about 60 KB
  await ed.paste({ 'text/plain': noise(200).join('\n') });
  await expect(notice(page)).toContainText(/too large/, { timeout: 15_000 });
  expect(await getStoredItem(ed.slug)).toEqual(before);
});

/** Stored bytes no save wrote: damaged, not JSON, not a document, or expanding past the cap. */
const UNREADABLE: Record<string, () => Buffer> = {
  'damaged bytes': () => {
    const bytes = compress(doc(p('precious')));
    bytes[bytes.length - 6] ^= 0xff; // The checksum no longer matches
    return bytes;
  },
  'cut short': () => compress(doc(p('precious'))).subarray(0, 20),
  'not gzip': () => randomBytes(64),
  'not JSON': () => gzipSync('precious, but not JSON'),
  'not a document': () => gzipSync(JSON.stringify({ precious: true })),
  // 6 MiB of JSON, which compresses to a few KB
  'bytes that expand past the cap': () =>
    gzipSync(JSON.stringify(doc(p('x'.repeat(6 * 1024 * 1024))))),
};

async function sendEverySave(page: Page, slug: string, revision: string) {
  const sent = [
    await postSave(page, { slug, tab: 't', seq: 1, revision, content: doc(p('overwritten')) }),
    await postSave(page, { slug, tab: 't', seq: 2, revision: null, content: doc(p('overwritten')) }),
    await postSave(page, {
      slug, tab: 't', seq: 3, revision,
      patch: { start: 0, end: 0, count: 1, blocks: [p('overwritten')] },
    }),
  ];
  const old = legacySave(new URL(page.url()).origin, 'x'.repeat(42), [slug, doc(p('overwritten')), false, false]);
  const oldStatus = await page.evaluate(async ({ url, method, headers, body }) =>
    (await fetch(url, { method, headers, body })).status, old);
  return { sent, oldStatus };
}

for (const [name, bytes] of Object.entries(UNREADABLE)) {
  test(`stored content with ${name} fails safely and is never overwritten`, async ({ page }) => {
    const slug = newSlug();
    await putRow({ slug, content: undefined, content_gz: bytes() });
    const before = await getStoredItem(slug);

    // The page fails instead of showing a blank document that a save would overwrite
    const response = await page.goto(`/${slug}`);
    expect(response!.status()).toBe(500);
    await expect(page.locator('.editor-input')).toHaveCount(0);

    // Every kind of save is refused without writing
    await page.goto('/robots.txt');
    const { sent, oldStatus } = await sendEverySave(page, slug, before!.updated_at);
    for (const { status, result } of sent) {
      expect(status).toBe(500);
      expect(result.status).toBeUndefined();
    }
    expect(oldStatus).toBe(500);
    expect(await getStoredItem(slug)).toEqual(before);
  });
}
