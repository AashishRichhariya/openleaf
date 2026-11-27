/* URLs and slugs: what opens which document, and under which key it is stored. */

import { getRow, newSlug, putRow } from '../support/db';
import { doc, p } from '../support/doc';
import { expect, test } from '../support/test';
import { plainText } from '../support/tree';

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
    expect(response.status()).toBe(308);
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
