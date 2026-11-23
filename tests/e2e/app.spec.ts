import { getRow, newSlug, putRow } from './support/db';
import { code, doc, heading, p } from './support/doc';
import { ENV } from './support/env';
import { expect, test } from './support/test';
import { plainText } from './support/tree';

test('app: / redirects to a new random document', async ({ ed, page }) => {
  await page.goto('/');
  await ed.ready();
  const slug = new URL(page.url()).pathname.slice(1);
  expect(slug).toMatch(/^[a-z]+(-[a-z]+)+$/);
  await expect(ed.root).toBeFocused();
  await expect(page.locator('.editor-placeholder')).toHaveText('Scribble away...');
});

test('app: / gives a different slug each time', async ({ request }) => {
  const seen = new Set<string>();
  for (let i = 0; i < 6; i += 1) {
    const response = await request.get('/', { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    seen.add(response.headers().location);
  }
  expect(seen.size).toBeGreaterThan(4);
});

test('app: an uppercase URL opens the lowercase document', async ({ ed }) => {
  const slug = newSlug();
  await putRow({ slug, content: doc(p('same document')) });
  await ed.open({ slug: slug.toUpperCase() });
  await expect(ed.root).toHaveText('same document');
  await ed.caretAfter('same document');
  await ed.type('!');
  await expect.poll(async () => plainText((await getRow(slug))?.content)).toBe('same document!');
});

test('app: the title keeps the URL as typed', async ({ ed, page }) => {
  await ed.open({ slug: `Mixed-${newSlug()}` });
  await expect(page).toHaveTitle(`openleaf | ${ed.slug}`);
});

// [as in the URL bar, as stored]. A changed key would orphan every such document.
const SLUGS = [
  ['My-Doc_1.2', 'my-doc_1.2'],
  ['With Space', 'with%20space'],
  ['café', 'caf%c3%a9'],
  ['CAFÉ', 'caf%c3%89'],
  ['日本語', '%e6%97%a5%e6%9c%ac%e8%aa%9e'],
  ['a+b', 'a%2bb'],
  ['a@b', 'a%40b'],
  ['a:b', 'a%3ab'],
  ['it\'s~', 'it\'s~'],
  ['UPPER', 'upper'],
];

for (const [typed, stored] of SLUGS) {
  test(`app: slug ${typed} is stored under the same key`, async ({ ed, page }) => {
    const unique = newSlug();
    await page.goto(`/${unique}${typed}`);
    await ed.ready();
    await ed.type('keyed');
    await expect
      .poll(async () => plainText((await getRow(`${unique}${stored}`))?.content), { timeout: 8000 })
      .toBe('keyed');
    await ed.reload();
    await expect(ed.root).toHaveText('keyed');
  });

  test(`app: slug ${typed} opens an existing row`, async ({ ed, page }) => {
    const unique = newSlug();
    await putRow({ slug: `${unique}${stored}`, content: doc(p('existing row')) });
    await page.goto(`/${unique}${typed}`);
    await ed.ready();
    await expect(ed.root).toHaveText('existing row');
  });
}

test('app: autosave, then reload', async ({ ed }) => {
  await ed.open();
  await ed.type('# Saved');
  await ed.enter();
  await ed.type('with a body');
  await ed.saved();
  await ed.reload();
  expect(await ed.blocks()).toEqual(['h1', 'paragraph']);
  await expect(ed.root).toContainText('with a body');
});

test('app: autosave waits for a pause of about two seconds', async ({ ed, page }) => {
  await ed.open();
  await ed.type('pause');
  await page.waitForTimeout(900);
  expect(await ed.row()).toBeNull();
  await ed.saved();
});

test('app: opening a document writes nothing', async ({ ed, page }) => {
  await ed.open({ content: doc(heading(1, 'untouched'), p('body')) });
  const before = await ed.row();
  await ed.root.getByText('body').click();
  await page.waitForTimeout(3000);
  expect(await ed.row()).toEqual(before);
});

test('app: opening a new slug creates no row', async ({ ed, page }) => {
  await ed.open();
  await page.waitForTimeout(3000);
  expect(await ed.row()).toBeNull();
});

test('app: an existing document does not take focus', async ({ ed }) => {
  await ed.open({ content: doc(p('reading')) });
  await expect(ed.root).not.toBeFocused();
});

test('app: an emptied document is stored empty and takes focus again', async ({ ed }) => {
  await ed.open({ content: doc(p('gone soon')) });
  await ed.root.click();
  await ed.selectAll();
  await ed.press('Backspace');
  await expect.poll(async () => (await ed.row())!.content, { timeout: 8000 }).toBeNull();
  await ed.reload();
  await expect(ed.root).toBeFocused();
  await expect(ed.page.locator('.editor-placeholder')).toBeVisible();
});

test('app: whitespace alone is an empty document', async ({ ed }) => {
  await ed.open({ content: doc(p('x')) });
  await ed.root.click();
  await ed.selectAll();
  await ed.type('   ');
  await expect.poll(async () => (await ed.row())!.content, { timeout: 8000 }).toBeNull();
});

test('app: rows keep their shape', async ({ ed }) => {
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

test('app: created_at survives later saves', async ({ ed }) => {
  await ed.open({ content: doc(p('kept')) });
  await ed.caretAfter('kept');
  await ed.type(' date');
  await ed.saved();
  expect((await ed.row())!.created_at).toBe('2025-05-19T10:00:00.000Z');
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

// Highlighting loads after the page. Whenever it comes, it is not an edit: on 0.3.0, opening a
// document never saved it.
for (const delay of [0, 1500]) {
  test(`app: opening code saves nothing, highlighting ${delay} ms late`, async ({ ed, page }) => {
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
