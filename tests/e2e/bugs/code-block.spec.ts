import {
  br, code, doc, heading, li, link, list, p, quote, table, text,
} from '../support/doc';
import { expect, test } from '../support/test';
import { plainText, shape, tree } from '../support/tree';

import type { Editor } from '../support/editor';

/** B8: the code block made by three backticks must sit in the right place in the tree. */

const shapes = async (ed: Editor) => (await ed.state()).root.children.map(shape).join(' ');

const cellBlocks = async (ed: Editor) =>
  (await ed.state()).root.children[0].children[1].children[1].children.map(shape).join(' ');

async function exitCode(ed: Editor) {
  await ed.type('code');
  await ed.enter(3);
}

test('B8: on an empty line the tree is exactly what /code gives', async ({ ed, page }) => {
  await ed.open();
  await ed.type('```');
  await ed.type('x');
  const typed = await ed.tree();
  await page.goto('about:blank');
  await ed.open();
  await ed.pick('codeblock');
  await ed.type('x');
  expect(typed).toBe(await ed.tree());
});

test('B8: leading spaces give a top-level block', async ({ ed }) => {
  await ed.open();
  await ed.type('  ```x');
  expect(await shapes(ed)).toBe('code');
});

test('B8: between paragraphs', async ({ ed }) => {
  await ed.open({ content: doc(p('one'), p('two')) });
  await ed.caretAfter('one');
  await ed.enter();
  await ed.type('```x');
  expect(await shapes(ed)).toBe('paragraph code paragraph');
  expect(plainText(await ed.state())).toBe('one|x|two');
});

test('B8: before existing text', async ({ ed }) => {
  await ed.open({ content: doc(p('after')) });
  await ed.caretBefore('after');
  await ed.type('```x');
  expect(await shapes(ed)).toBe('code paragraph');
  expect(plainText(await ed.state())).toBe('x|after');
});

test('B8: after formatted text', async ({ ed }) => {
  await ed.open({ content: doc(p(text('bold', 1))) });
  await ed.caretAfter('bold');
  await ed.press('ControlOrMeta+b');
  await ed.type('```x');
  expect(await shapes(ed)).toBe('paragraph code');
  expect(plainText(await ed.state())).toBe('bold|x');
});

test('B8: between formatted runs keeps the order', async ({ ed }) => {
  await ed.open({ content: doc(p(text('one', 1), text('two', 2))) });
  await ed.caretAfter('one');
  await ed.press('ControlOrMeta+b');
  await ed.type('```x');
  expect(await shapes(ed)).toBe('paragraph code paragraph');
  expect(plainText(await ed.state())).toBe('one|x|two');
});

test('B8: after inline code', async ({ ed }) => {
  await ed.open();
  await ed.type('`a`');
  await ed.type(' ');
  await ed.type('```x');
  expect(await shapes(ed)).toMatch(/^(paragraph code|code)$/);
});

test('B8: after a link', async ({ ed }) => {
  await ed.open({ content: doc(p(link('https://example.com', 'site'))) });
  await ed.caretAfter('site');
  await ed.type('```x');
  expect(await shapes(ed)).toBe('paragraph[link] code');
});

test('B8: after an equation', async ({ ed }) => {
  await ed.open();
  await ed.type('$x$```y');
  expect(await shapes(ed)).toBe('paragraph code');
});

test('B8: after a line break', async ({ ed }) => {
  await ed.open();
  await ed.type('line');
  await ed.press('Shift+Enter');
  await ed.type('```x');
  expect(await shapes(ed)).toBe('paragraph code');
});

test('B8: between two line breaks', async ({ ed }) => {
  await ed.open({ content: doc(p('one', br(), 'two')) });
  await ed.caretAfter('one');
  await ed.press('Shift+Enter');
  await ed.type('```x');
  expect(await shapes(ed)).toBe('paragraph code paragraph');
  expect(plainText(await ed.state())).toMatch(/^one\|x\|+two$/);
});

test('B8: in an aligned line', async ({ ed }) => {
  await ed.open();
  await ed.pick('align c');
  await ed.type('```x');
  expect(await ed.tree()).toMatch(/^code format="center"/);
});

test('B8: in a table cell the block is a direct child', async ({ ed }) => {
  await ed.open({ content: doc(table([['', ''], ['', '']]), p()) });
  await ed.clickCell(1, 1);
  await ed.type('```x');
  expect(await cellBlocks(ed)).toBe('code');
});

const SHORTCUTS: Array<[string, string, string]> = [
  ['heading', '# ', 'heading'],
  ['bullet', '- ', 'list'],
  ['number', '1. ', 'list'],
  ['check', '[] ', 'list'],
  ['quote', '> ', 'quote'],
  ['rule', '--- ', 'horizontalrule'],
];

const STARTS: Record<string, { prefix: string; before: string }> = {
  'a line': { prefix: '', before: 'code' },
  'a quote': { prefix: '> ', before: 'quote[code]' },
  'a heading': { prefix: '## ', before: 'heading[code]' },
};

for (const [where, { prefix, before }] of Object.entries(STARTS)) {
  for (const [name, trigger, type] of SHORTCUTS) {
    test(`B8: the ${name} shortcut works after leaving code in ${where}`, async ({ ed }) => {
      await ed.open();
      if (prefix) await ed.type(prefix);
      await ed.type('```');
      await exitCode(ed);
      await ed.type(trigger);
      if (type !== 'horizontalrule') await ed.type('next');
      const now = await shapes(ed);
      expect(now.startsWith(`${before} `), now).toBe(true);
      expect(await ed.blocks()).toContainEqual(type === 'heading' ? 'h1' : type);
      expect(now).not.toContain('paragraph[');
    });
  }
}

const ITEMS: Array<[string, RegExp]> = [
  ['paragraph', /^code paragraph/], ['h1', /^code heading/], ['h2', /^code heading/],
  ['h3', /^code heading/], ['2x2', /^code (paragraph )?table/], ['numbered', /^code list/],
  ['bulleted', /^code list/], ['todo', /^code list/], ['quote', /^code quote/],
  ['inline', /^code paragraph/], ['display', /^code paragraph/], ['codeblock', /^code code/],
  ['divider', /^code (paragraph )?horizontalrule/], ['left', /^code paragraph/],
  ['align c', /^code paragraph/], ['right', /^code paragraph/], ['justify', /^code paragraph/],
  ['table', /^code paragraph/],
];

for (const [query, wanted] of ITEMS) {
  test(`B8: slash ${query} works after leaving code`, async ({ ed }) => {
    await ed.open();
    await ed.type('```');
    await exitCode(ed);
    await ed.pick(query);
    expect(await shapes(ed)).toMatch(wanted);
  });
}

for (const [kind, trigger] of [['bullet', '- '], ['number', '1. '], ['check', '[] ']]) {
  test(`B8: leaving code in a ${kind} list gives the next item`, async ({ ed }) => {
    await ed.open();
    await ed.type(trigger);
    await ed.type('```');
    await exitCode(ed);
    await ed.type('next');
    const items = (await ed.state()).root.children[0].children;
    expect(items.map(shape)).toEqual(['listitem[code]', 'listitem']);
    expect(plainText(items.length > 1 ? { root: items[1] } : null)).toBe('next');
    await ed.enter();
    await ed.type('third');
    await expect(ed.root.locator('li')).toHaveCount(3);
  });
}

test('B8: leaving code in a middle bullet inserts the item in between', async ({ ed }) => {
  await ed.open({ content: doc(list('bullet', li(1, 'one'), li(2, 'two'))) });
  await ed.caretAfter('one');
  await ed.enter();
  await ed.type('```');
  await exitCode(ed);
  await ed.type('new');
  const items = (await ed.state()).root.children[0].children;
  expect(items.map(shape)).toEqual(['listitem', 'listitem[code]', 'listitem', 'listitem']);
  expect(plainText(await ed.state())).toBe('one|code|new|two');
});

test('B8: a following shortcut works in a cell', async ({ ed }) => {
  await ed.open({ content: doc(table([['', ''], ['', '']]), p()) });
  await ed.clickCell(1, 1);
  await ed.type('```');
  await exitCode(ed);
  await ed.type('- item');
  expect(await cellBlocks(ed)).toBe('code list[listitem]');
});

test('B8: Backspace on an empty block leaves a normal line', async ({ ed }) => {
  await ed.open();
  await ed.type('```');
  await ed.press('Backspace');
  expect(await ed.tree()).toBe('paragraph');
  await ed.type('# works');
  expect(await ed.blocks()).toEqual(['h1']);
});

test('B8: Backspace on an empty block in a bullet leaves the bullet', async ({ ed }) => {
  await ed.open();
  await ed.type('- ');
  await ed.type('```');
  await ed.press('Backspace');
  expect(await shapes(ed)).toBe('list[listitem]');
  await ed.type('plain');
  await ed.enter();
  await ed.type('second');
  expect(await shapes(ed)).toBe('list[listitem,listitem]');
});

test('B8: Backspace on an empty block in a quote leaves the quote', async ({ ed }) => {
  await ed.open();
  await ed.type('> ');
  await ed.type('```');
  await ed.press('Backspace');
  expect(await shapes(ed)).toBe('quote');
});

test('B8: Backspace on an empty block in a heading leaves the heading', async ({ ed }) => {
  await ed.open();
  await ed.type('## ');
  await ed.type('```');
  await ed.press('Backspace');
  expect(await shapes(ed)).toBe('heading');
});

test('B8: Backspace on an empty block in a cell leaves a line', async ({ ed }) => {
  await ed.open({ content: doc(table([['', ''], ['', '']]), p()) });
  await ed.clickCell(1, 1);
  await ed.type('```');
  await ed.press('Backspace');
  expect(await cellBlocks(ed)).toBe('paragraph');
});

const nest = (container: any, ...children: object[]) => ({ ...container, children });
const OLD: Record<string, object> = {
  'a paragraph': nest(p(), code('old code', 'javascript'), p('tail')),
  'a paragraph twice over': nest(p(), code('old code', 'javascript'), nest(p(), p('tail'))),
  'a quote': nest(quote(), code('old code', 'javascript'), p('tail')),
  'a heading': nest(heading(2), code('old code', 'javascript'), p('tail')),
  'a list item': list('bullet', nest(li(1), code('old code', 'javascript'), p('tail'))),
};

for (const [where, saved] of Object.entries(OLD)) {
  for (const [name, trigger, type] of SHORTCUTS) {
    test(`B8: old nesting in ${where}, the ${name} shortcut works`, async ({ ed }) => {
      await ed.open({ content: doc(saved) });
      await ed.caretBefore('tail');
      await ed.type(trigger);
      const now = await ed.state();
      expect(tree(now)).toMatch(new RegExp(`(^|\\n)${type}( |\\n|$)`));
      // The typed shortcut is consumed, and nothing is lost.
      expect(plainText(now).replace(/\|/g, '')).toBe('old codetail');
    });
  }

  test(`B8: old nesting in ${where}, a slash item works`, async ({ ed }) => {
    await ed.open({ content: doc(saved) });
    await ed.caretAfter('tail');
    await ed.type(' ');
    await ed.pick('h1');
    expect(await ed.tree()).toMatch(/(^|\n)heading tag="h1"/);
  });
}

test('B8: old nesting in a list item, Enter gives the next bullet', async ({ ed }) => {
  await ed.open({ content: doc(OLD['a list item']) });
  await ed.caretAfter('tail');
  await ed.enter();
  await ed.type('next');
  await expect(ed.root.locator('li')).toHaveCount(2);
});
