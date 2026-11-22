/*
 * Typing latency and page load of a candidate build against a reference build, interleaved so
 * that both see the same machine. Exits 1 if the candidate is more than 10% slower.
 *
 *   node tests/e2e/perf.mjs <reference url> <reference table> <candidate url> <candidate table>
 */
import { randomUUID } from 'node:crypto';

import { chromium } from '@playwright/test';

const [refURL, refTable, newURL, newTable] = process.argv.slice(2);
const DB = process.env.E2E_DB_URL ?? 'http://127.0.0.1:8000';
const ROUNDS = Number(process.env.PERF_ROUNDS ?? 12);

for (const url of [refURL, newURL, DB]) {
  if (!['127.0.0.1', 'localhost'].includes(new URL(url).hostname)) throw new Error('loopback only');
}
for (const table of [refTable, newTable]) {
  if (!table.startsWith('openleaf-local')) throw new Error('local tables only');
}

const text = (value) => ({
  detail: 0, format: 0, mode: 'normal', style: '', text: value, type: 'text', version: 1,
});
const element = (type, children, extra = {}) => ({
  children, direction: 'ltr', format: '', indent: 0, type, version: 1, ...extra,
});
const p = (value) => element('paragraph', value ? [text(value)] : [], { textFormat: 0 });
const root = (children) => ({ root: element('root', children) });

const DOCUMENTS = {
  'short document': root([p('Type here')]),
  '400 paragraphs': root([
    p('Type here'),
    ...Array.from({ length: 400 }, (_, i) => p(`Paragraph ${i}: ${'plain words '.repeat(12)}`)),
  ]),
  '80-row table': root([
    p('Type here'),
    element('table', Array.from({ length: 80 }, (_, row) =>
      element('tablerow', [0, 1, 2, 3].map((column) =>
        element('tablecell', [p(`r${row} c${column}`)], {
          backgroundColor: null, colSpan: 1, rowSpan: 1, headerState: 0,
        }))))),
  ]),
  '200-line code block': root([
    p('Type here'),
    element('code', Array.from({ length: 200 }, (_, line) => [
      ...(line ? [{ type: 'linebreak', version: 1 }] : []),
      { ...text(`const value${line} = compute(${line});`), type: 'code-highlight' },
    ]).flat(), { language: 'javascript' }),
  ]),
};

function marshall(value) {
  if (value === null || value === undefined) return { NULL: true };
  if (typeof value === 'string') return { S: value };
  if (typeof value === 'number') return { N: String(value) };
  if (typeof value === 'boolean') return { BOOL: value };
  if (Array.isArray(value)) return { L: value.map(marshall) };
  return { M: Object.fromEntries(Object.entries(value).map(([k, v]) => [k, marshall(v)])) };
}

async function seed(table, slug, content) {
  const response = await fetch(DB, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-amz-json-1.0',
      'x-amz-target': 'DynamoDB_20120810.PutItem',
      authorization: 'AWS4-HMAC-SHA256 Credential=local/20260101/ap-south-1/dynamodb/aws4_request'
        + ', SignedHeaders=host, Signature=0',
    },
    body: JSON.stringify({
      TableName: table,
      Item: marshall({
        slug, version: 1, content, read_only: false,
        created_at: '2025-05-19T10:00:00.000Z', updated_at: '2025-05-19T10:00:00.000Z',
      }).M,
    }),
  });
  if (!response.ok) throw new Error(await response.text());
}

async function measure(browser, base, slug) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.route(
    (url) => !['127.0.0.1', 'localhost'].includes(url.hostname),
    (route) => route.abort(),
  );
  const page = await context.newPage();
  await page.addInitScript(() => {
    const check = () => {
      const editor = document.querySelector('.editor-input')?.__lexicalEditor;
      if (editor?._rootElement) window.readyAt = performance.now();
      else setTimeout(check, 2);
    };
    check();
  });
  await page.goto(`${base}/${slug}`);
  await page.waitForFunction(() => window.readyAt !== undefined);
  const load = await page.evaluate(() => window.readyAt);

  await page.locator('.editor-input p').first().click();
  await page.keyboard.press('End');
  await page.evaluate(() => {
    const input = document.querySelector('.editor-input');
    const first = input.querySelector('p');
    window.samples = [];
    let started = 0;
    input.addEventListener('keydown', () => { started = performance.now(); }, { capture: true });
    new MutationObserver(() => {
      if (!started) return;
      void first.getBoundingClientRect().height;
      window.samples.push(performance.now() - started);
      started = 0;
    }).observe(first, { subtree: true, childList: true, characterData: true });
  });
  await page.keyboard.type('the quick brown fox jumps over the lazy dog', { delay: 30 });
  const typing = await page.evaluate(() => window.samples);
  await context.close();
  return { load, typing };
}

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const at = (values, q) => [...values].sort((a, b) => a - b)[Math.floor(values.length * q)];

const browser = await chromium.launch({
  proxy: { server: 'http://127.0.0.1:9', bypass: '127.0.0.1,localhost' },
});
let failed = false;

for (const [name, content] of Object.entries(DOCUMENTS)) {
  const sides = [
    { base: refURL, table: refTable, load: [], typing: [] },
    { base: newURL, table: newTable, load: [], typing: [] },
  ];
  for (let round = -1; round < ROUNDS; round += 1) {
    for (const side of round % 2 ? [...sides].reverse() : sides) {
      const slug = `perf-${randomUUID()}`;
      await seed(side.table, slug, content);
      const { load, typing } = await measure(browser, side.base, slug);
      if (round < 0) continue; // warm-up
      side.load.push(load);
      side.typing.push(...typing);
    }
  }
  const [ref, next] = sides;
  for (const [metric, pick] of [
    ['page load, median', (side) => median(side.load)],
    ['typing, median', (side) => median(side.typing)],
    ['typing, p90', (side) => at(side.typing, 0.9)],
  ]) {
    const [was, now] = [pick(ref), pick(next)];
    // Below half a millisecond is under the timer's resolution.
    const slower = now > was * 1.1 && now - was > 0.5;
    failed ||= slower;
    console.log([
      name.padEnd(20), metric.padEnd(18), `${was.toFixed(1)} ms`.padStart(10),
      `${now.toFixed(1)} ms`.padStart(10), `${((now / was - 1) * 100).toFixed(1)}%`.padStart(8),
      slower ? 'SLOWER' : 'ok',
    ].join(' '));
  }
}

await browser.close();
process.exit(failed ? 1 : 0);
