/* The page around the editor: focus, navbar, metadata, widths, privacy and errors. */

import { code, doc, equation, heading, hr, li, link, list, p, quote, table, text,
} from '../support/doc';
import { ENV } from '../support/env';
import { scenario } from '../support/scenario';
import { expect, test } from '../support/test';


test('app: an existing document does not take focus', async ({ ed }) => {
  await ed.open({ content: doc(p('reading')) });
  await expect(ed.root).not.toBeFocused();
});

test('app: navbar links', async ({ ed, page }) => {
  await ed.open();
  const links = await page.locator('nav a').evaluateAll((anchors) =>
    anchors.map((a) => [a.getAttribute('href'), a.getAttribute('target'), a.getAttribute('rel')]));
  expect(links).toHaveLength(4);
  expect(links[0]).toEqual(['/', '_blank', 'noopener noreferrer']);
  for (const [, target, rel] of links) {
    expect(target).toBe('_blank');
    expect(rel).toContain('noopener');
  }
});

test('app: the logo opens a new document in a new tab', async ({ ed, context, page }) => {
  await ed.open();
  const popup = context.waitForEvent('page');
  await page.locator('.navbar-logo a').click();
  await expect(await popup).toHaveURL(/127\.0\.0\.1:\d+\/[a-z]+-/);
  expect(page.url()).toContain(ed.slug);
});

test('app: metadata and icons', async ({ ed, page, request }) => {
  await ed.open();
  await expect(page.locator('meta[name="description"]'))
    .toHaveAttribute('content', /minimalist browser-based rich text editor/);
  await expect(page.locator('link[rel="manifest"]'))
    .toHaveAttribute('href', '/favicon/manifest.json');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  for (const file of ['animated-favicon-minified.svg', 'favicon.ico', 'favicon-16x16.png',
    'favicon-32x32.png', 'apple-icon.png', 'manifest.json']) {
    expect((await request.get(`/favicon/${file}`)).status(), file).toBe(200);
  }
  expect((await request.get('/logo/animated-logo-minified.svg')).status()).toBe(200);
});

test('app: robots.txt', async ({ request }) => {
  const body = await (await request.get('/robots.txt')).text();
  for (const line of ['Allow: /', 'Disallow: /server/', 'Disallow: /_next/', 'Disallow: /_vercel/',
    'Host: https://openleaf.xyz']) {
    expect(body).toContain(line);
  }
});

test('app: the editor is labelled for assistive technology', async ({ ed, page }) => {
  await ed.open();
  await expect(page.getByRole('textbox', { name: 'Text editor content' })).toBeVisible();
});

for (const width of [320, 390, 768, 1280, 1920]) {
  test(`app: usable at ${width}px with no sideways page scroll`, async ({ ed, page }) => {
    await page.setViewportSize({ width, height: 780 });
    await ed.open();
    await ed.type('fits');
    await ed.enter();
    await ed.pick('codeblock');
    await ed.type('a long line of code that keeps going and going and going and going on');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test('app: nothing is requested outside this machine', async ({ ed, external }) => {
  await ed.open();
  await ed.type('private');
  await ed.saved();
  expect(external).toEqual([]);
  expect(ENV.baseURL).toMatch(/127\.0\.0\.1|localhost/);
});

test('app: no console or page errors in a normal session', async ({ ed, problems }) => {
  await ed.open();
  await ed.type('# Hello');
  await ed.enter();
  await ed.type('- list $x$ ');
  await ed.enter(2);
  await ed.pick('2x2');
  await ed.type('cell');
  await ed.saved();
  await ed.reload();
  expect(problems).toEqual([]);
});

/* Whole-page looks at the widths people use, and the editor in longer sessions. */

const EVERYTHING = doc(
  heading(1, 'Heading one'),
  heading(2, 'Heading two'),
  heading(3, 'Heading three'),
  p('Text with ', text('bold', 1), ', ', text('italic', 2), ', ', text('code', 16), ', ',
    link('https://example.com', 'a link'), ' and ', equation('x^2')),
  quote('A quote'),
  list('bullet', li(1, 'bullet')),
  list('number', li(1, 'number')),
  list('check', li(1, 'check')),
  hr(),
  code('const a = 1;', 'javascript'),
  table([['Head', 'Two'], ['a', 'b']]),
  p(equation('\\sum_i i', false)),
);

for (const width of [320, 390, 639, 640, 768, 1024, 1280, 1920]) {
  scenario(`page at ${width}px: everything`, async () => {}, {
    content: EVERYTHING,
    viewport: { width, height: 900 },
    persist: false,
  });

  scenario(`page at ${width}px: empty`, async () => {}, {
    viewport: { width, height: 700 },
    persist: false,
  });

  scenario(`page at ${width}px: slash menu`, async (ed) => {
    await ed.type('/');
  }, { viewport: { width, height: 700 }, persist: false });
}

scenario('session: a page written from scratch', async (ed) => {
  await ed.type('# Notes');
  await ed.enter();
  await ed.type('Some **bold** and $x^2$ here');
  await ed.enter();
  await ed.type('- one');
  await ed.enter();
  await ed.type('two');
  await ed.enter(2);
  await ed.type('> quoted');
  await ed.enter();
  await ed.pick('codeblock');
  await ed.type('let a = 1');
  await ed.enter(3);
  await ed.pick('2x2');
  await ed.type('cell');
}, { timeout: 120_000 });
