/* Bold, italic, underline and the other text formats, indentation, and heading styles. */

import { doc, heading, p, text } from '../support/doc';
import { scenario } from '../support/scenario';
import { expect, test } from '../support/test';

const mod = 'ControlOrMeta';

const SHORTCUTS = [
  ['bold', 'b'],
  ['italic', 'i'],
  ['underline', 'u'],
] as const;

for (const [name, key] of SHORTCUTS) {
  scenario(`format: ${name} shortcut while typing`, async (ed) => {
    await ed.type('plain ');
    await ed.press(`ControlOrMeta+${key}`);
    await ed.type('styled');
    await ed.press(`ControlOrMeta+${key}`);
    await ed.type(' plain');
  });

  scenario(`format: ${name} a selection`, async (ed) => {
    await ed.select('word');
    await ed.press(`ControlOrMeta+${key}`);
  }, { content: doc(p('a word here')) });

  scenario(`format: un-${name} a selection`, async (ed) => {
    await ed.select('word');
    await ed.press(`ControlOrMeta+${key}`);
    await ed.press(`ControlOrMeta+${key}`);
  }, { content: doc(p('a word here')) });
}

scenario('format: bold, italic and underline together', async (ed) => {
  await ed.select('all three');
  for (const key of ['b', 'i', 'u']) await ed.press(`ControlOrMeta+${key}`);
}, { content: doc(p('all three')) });

scenario('format: bold over several blocks', async (ed) => {
  await ed.root.click();
  await ed.selectAll();
  await ed.press('ControlOrMeta+b');
}, { content: doc(heading(3, 'head'), p('body')) });

scenario('format: saved bold, italic, underline, code and combinations render', async () => {}, {
  content: doc(p(
    text('bold', 1), ' ', text('italic', 2), ' ', text('underline', 8), ' ',
    text('code', 16), ' ', text('sub', 32), ' ', text('sup', 64), ' ',
    text('mark', 128), ' ', text('bold code', 17), ' ', text('all', 11),
  )),
});

scenario('format: saved strikethrough renders', async () => {}, {
  content: doc(p(text('struck', 4), ' ', text('both', 12))),
});

scenario('indent: Tab at paragraph start', async (ed) => {
  await ed.caretBefore('para');
  await ed.press('Tab');
}, { content: doc(p('para')) });

scenario('indent: Tab in the middle inserts a tab', async (ed) => {
  await ed.caretAfter('left');
  await ed.press('Tab');
}, { content: doc(p('left right')) });

scenario('indent: Tab on an empty line', async (ed) => {
  await ed.press('Tab');
  await ed.type('after tab');
});

scenario('indent: Tab over a selection indents', async (ed) => {
  await ed.root.click();
  await ed.selectAll();
  await ed.press('Tab');
}, { content: doc(p('one'), p('two')) });

scenario('indent: stops at seven levels', async (ed) => {
  await ed.caretBefore('deep');
  await ed.press('Tab', 10);
}, { content: doc(p('deep')) });

scenario('indent: Shift+Tab outdents', async (ed) => {
  await ed.caretBefore('para');
  await ed.press('Tab', 2);
  await ed.press('Shift+Tab');
}, { content: doc(p('para')) });

scenario('indent: a heading', async (ed) => {
  await ed.caretBefore('head');
  await ed.press('Tab');
}, { content: doc(heading(2, 'head')) });

scenario('indent: Backspace at start of an indented paragraph', async (ed) => {
  await ed.caretBefore('para');
  await ed.press('Tab');
  await ed.press('Backspace');
}, { content: doc(p('para')) });

// Toggling a mixed selection.
for (const [key, format] of [['b', 1], ['i', 2], ['u', 8]] as const) {
  for (const first of ['formatted', 'plain']) {
    const runs = first === 'formatted' ? [text('one', format), ' two'] : ['one ', text('two', format)];
    scenario(`mixed selection: ${key} with ${first} first`, async (ed) => {
      await ed.root.click();
      await ed.selectAll();
      await ed.press(`${mod}+${key}`);
    }, { content: doc(p(...runs)) });
  }
}

// Indent limit and Enter after quote or heading.
scenario('indent: a selection where one block is at the limit', async (ed) => {
  await ed.root.getByText('shallow').click();
  await ed.selectAll();
  await ed.press('Tab');
}, { content: doc({ ...p('deep'), indent: 6 }, p('shallow')) });

// Strikethrough, H4 and H5 have styling (B15) -----------------------------------------------------

test('strikethrough is struck', { tag: '@B15' }, async ({ ed }) => {
  await ed.open();
  await ed.type('a ~~gone~~ b');
  await expect(ed.root.getByText('gone')).toHaveCSS('text-decoration-line', 'line-through');
});

test('underline with strikethrough shows both', { tag: '@B15' }, async ({ ed }) => {
  await ed.open({ content: doc(p('x ', text('both', 12))) });
  await expect(ed.root.getByText('both')).toHaveCSS('text-decoration-line', /underline line-through/);
});

test('H4 and H5 look like headings', { tag: '@B15' }, async ({ ed }) => {
  await ed.open({
    content: doc(heading(3, 'three'), heading(4, 'four'), heading(5, 'five'), p('body')),
  });
  const [three, four, five, body] = await Promise.all(
    ['h3', 'h4', 'h5', 'p'].map((tag) =>
      ed.root.locator(tag).evaluate((element) => {
        const css = getComputedStyle(element);
        return { size: parseFloat(css.fontSize), weight: Number(css.fontWeight) };
      })),
  );
  expect(four.weight).toBeGreaterThanOrEqual(600);
  expect(five.weight).toBeGreaterThanOrEqual(600);
  expect(four.size).toBeLessThan(three.size);
  expect(five.size).toBeLessThan(four.size);
  expect(five.size).toBeGreaterThanOrEqual(body.size);
});
