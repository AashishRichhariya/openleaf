import { br, code, doc, heading, li, link, list, p, quote, table, text } from '../support/doc';
import { Editor } from '../support/editor';
import { KEYS } from '../support/keys';
import { scenario } from '../support/scenario';
import { expect, test } from '../support/test';
import { plainText, shape, tree } from '../support/tree';

const JS = 'const x = 1;\n// note\nfunction f(a) {\n  return "s" + a;\n}';

scenario('backticks: convert on the third', async (ed) => {
  await ed.type('```');
});

scenario('backticks: two do not convert', async (ed) => {
  await ed.type('``');
});

scenario('backticks: the next key is code', async (ed) => {
  await ed.type('```x');
});

scenario('backticks: typed without any delay', async (ed) => {
  await ed.type('```const a = 1', 0);
});

scenario('backticks: then a language and a space are code', async (ed) => {
  await ed.type('```js x');
});

scenario('backticks: leading spaces still convert', async (ed) => {
  await ed.type('  ```x');
});

scenario('backticks: after a word stay text', async (ed) => {
  await ed.type('hello```');
});

scenario('backticks: after a word and a space stay text', async (ed) => {
  await ed.type('hello ```');
});

scenario('backticks: four', async (ed) => {
  await ed.type('````');
});

scenario('backticks: one undo returns them', async (ed) => {
  await ed.type('```');
  await ed.undo();
});

scenario('backticks: one undo returns them after a pause', async (ed) => {
  await ed.type('``');
  await ed.pause();
  await ed.type('`');
  await ed.undo();
});

scenario('backticks: redo converts again', async (ed) => {
  await ed.type('```');
  await ed.undo();
  await ed.redo();
});

scenario('backticks: before existing text', async (ed) => {
  await ed.caretBefore('after');
  await ed.type('```inside');
}, { content: doc(p('after')) });

scenario('backticks: between two paragraphs', async (ed) => {
  await ed.caretAfter('one');
  await ed.enter();
  await ed.type('```middle');
}, { content: doc(p('one'), p('two')) });

scenario('backticks: after formatted text', async (ed) => {
  await ed.caretAfter('bold');
  await ed.press('ControlOrMeta+b');
  await ed.type('```x');
}, { content: doc(p(text('bold', 1))) });

scenario('backticks: after inline code', async (ed) => {
  await ed.type('`a` ');
  await ed.type('```x');
});

scenario('backticks: after a link', async (ed) => {
  await ed.caretAfter('site');
  await ed.type('```x');
}, { content: doc(p(link('https://example.com', 'site'))) });

scenario('backticks: after an equation', async (ed) => {
  await ed.type('$x$```y');
});

scenario('backticks: after a line break', async (ed) => {
  await ed.type('line');
  await ed.press('Shift+Enter');
  await ed.type('```x');
});

scenario('backticks: between two line breaks', async (ed) => {
  await ed.caretAfter('one');
  await ed.press('Shift+Enter');
  await ed.type('```x');
}, { content: doc(p('one', br(), 'two')) });

scenario('backticks: in an aligned paragraph', async (ed) => {
  await ed.pick('align c');
  await ed.type('```x');
});

scenario('backticks: in an indented paragraph', async (ed) => {
  await ed.caretBefore('after');
  await ed.press('Tab');
  await ed.type('```x');
}, { content: doc(p('after')) });

scenario('backticks: in a bullet', async (ed) => {
  await ed.type('- ');
  await ed.type('```x');
});

scenario('backticks: in a second bullet', async (ed) => {
  await ed.caretAfter('one');
  await ed.enter();
  await ed.type('```x');
}, { content: doc(list('bullet', li(1, 'one'))) });

scenario('backticks: in a numbered item', async (ed) => {
  await ed.type('1. ');
  await ed.type('```x');
});

scenario('backticks: in a check item', async (ed) => {
  await ed.type('[] ');
  await ed.type('```x');
});

scenario('backticks: in a nested bullet', async (ed) => {
  await ed.caretAfter('one');
  await ed.enter();
  await ed.press('Tab');
  await ed.type('```x');
}, { content: doc(list('bullet', li(1, 'one'))) });

scenario('backticks: in a quote', async (ed) => {
  await ed.type('> ');
  await ed.type('```x');
});

scenario('backticks: before quoted text', async (ed) => {
  await ed.caretBefore('quoted');
  await ed.type('```x');
}, { content: doc(quote('quoted')) });

scenario('backticks: in a heading', async (ed) => {
  await ed.type('## ');
  await ed.type('```x');
});

scenario('backticks: before heading text', async (ed) => {
  await ed.caretBefore('head');
  await ed.type('```x');
}, { content: doc(heading(1, 'head')) });

scenario('backticks: in a table cell', async (ed) => {
  await ed.clickCell(1, 1);
  await ed.type('```x');
}, { content: doc(table([['', ''], ['', '']]), p()) });

scenario('backticks: in a header cell', async (ed) => {
  await ed.clickCell(0, 0);
  await ed.type('```x');
}, { content: doc(table([['', ''], ['', '']]), p()) });

scenario('backticks: inside code stay literal', async (ed) => {
  await ed.pick('codeblock');
  await ed.type('```');
});

scenario('code: slash, then several lines', async (ed) => {
  await ed.pick('codeblock');
  await ed.type('const x = 1;');
  await ed.enter();
  await ed.type('let y = "two";');
});

scenario('code: Enter three times leaves', async (ed) => {
  await ed.pick('codeblock');
  await ed.type('code');
  await ed.enter(3);
  await ed.type('outside');
});

scenario('code: Enter twice stays', async (ed) => {
  await ed.pick('codeblock');
  await ed.type('code');
  await ed.enter(2);
  await ed.type('inside');
});

scenario('code: markdown after leaving', async (ed) => {
  await ed.pick('codeblock');
  await ed.type('code');
  await ed.enter(3);
  await ed.type('# Title');
});

scenario('code: Enter keeps the indentation', async (ed) => {
  await ed.pick('codeblock');
  await ed.type('  indented');
  await ed.enter();
  await ed.type('next');
});

scenario('code: Tab indents', async (ed) => {
  await ed.pick('codeblock');
  await ed.press('Tab');
  await ed.type('x');
});

scenario('code: Tab over lines', async (ed) => {
  await ed.root.locator('.editor-code').click();
  await ed.selectAll();
  await ed.press('Tab');
}, { content: doc(code('a\nb\nc', 'javascript')) });

scenario('code: Tab at the start of a line', async (ed) => {
  await ed.caretBefore('second');
  await ed.press('Tab');
}, { content: doc(code('first\nsecond', 'javascript')) });

scenario('code: Shift+Tab outdents', async (ed) => {
  await ed.pick('codeblock');
  await ed.press('Tab');
  await ed.type('x');
  await ed.press('Shift+Tab');
});

scenario('code: Alt+ArrowUp moves the line', async (ed) => {
  await ed.caretAfter('second');
  await ed.press('Alt+ArrowUp');
}, { content: doc(code('first\nsecond\nthird', 'javascript')) });

scenario('code: Alt+ArrowDown moves the line', async (ed) => {
  await ed.caretAfter('first');
  await ed.press('Alt+ArrowDown');
}, { content: doc(code('first\nsecond\nthird', 'javascript')) });

scenario('code: markdown stays literal', async (ed) => {
  await ed.pick('codeblock');
  await ed.type('# **not** $x$ ');
});

scenario('code: URLs stay plain', async (ed) => {
  await ed.pick('codeblock');
  await ed.type('https://example.com ');
});

scenario('code: Backspace on an empty block', async (ed) => {
  await ed.pick('codeblock');
  await ed.press('Backspace');
});

scenario('code: Backspace at the start keeps the text', async (ed) => {
  await ed.caretBefore('first');
  await ed.press('Backspace');
}, { content: doc(code('first', 'javascript')) });

scenario('code: arrows leave at the bottom', async (ed) => {
  await ed.caretAfter('last');
  await ed.press('ArrowDown');
}, { content: doc(code('last', 'javascript'), p('below')), persist: false });

scenario('code: saved highlighting and line numbers', async () => {}, {
  content: doc(code(JS, 'javascript')),
});

scenario('code: saved python', async () => {}, {
  content: doc(code('def f(x):\n    return x + 1  # add', 'python')),
});

scenario('code: saved without a language', async () => {}, {
  content: doc(code(JS)),
});

scenario('code: unknown language', async () => {}, {
  content: doc(code('some text', 'brainfuck')),
});

scenario('code: twelve line numbers', async () => {}, {
  content: doc(code(Array.from({ length: 12 }, (_line, i) => `line${i}`).join('\n'), 'javascript')),
});

scenario('code: long line scrolls', async () => {}, {
  content: doc(code(`const long = "${'x'.repeat(220)}";`, 'javascript')),
});

scenario('code: typed code is highlighted', async (ed) => {
  await ed.pick('codeblock');
  await ed.type('function f() { return true; } // c');
});

scenario('code: paste several lines', async (ed) => {
  await ed.pick('codeblock');
  await ed.paste({ 'text/plain': 'a = 1\n\tb = 2\nc = 3' });
});

// Highlighting of languages without a bundled grammar.
for (const language of ['json', 'bash', 'jsx', 'tsx', 'yaml', 'go', 'diff', 'sql', 'html', 'css',
  'typescript', 'nonsense', 'plain']) {
  scenario(`code language: ${language}`, async () => {}, {
    content: doc(code('{"a": 1, "b": true}\n# note\nconst x = "s" + 2;\n+ added\n- gone', language)),
  });
}

// Code navigation.
scenario('code: ArrowUp at the first line', async (ed) => {
  await ed.caretAfter('first');
  await ed.press('ArrowUp');
}, { content: doc(p('above'), code('first\nsecond', 'javascript')), persist: false });

scenario('code: ArrowDown at the last line', async (ed) => {
  await ed.caretAfter('second');
  await ed.press('ArrowDown');
}, { content: doc(code('first\nsecond', 'javascript'), p('below')), persist: false });

const LINE_KEYS: Record<string, string> = {
  'select to line end': KEYS.selectToLineEnd,
  'select to line start': KEYS.selectToLineStart,
  'line start': KEYS.lineStart,
  'line end': KEYS.lineEnd,
};

for (const [name, key] of Object.entries(LINE_KEYS)) {
  scenario(`code: ${name}`, async (ed) => {
    await ed.caretAfter('sec');
    await ed.press(key);
  }, { content: doc(code('first\n  second', 'javascript')), persist: false });
}

scenario('code: Shift+Tab over lines', async (ed) => {
  await ed.root.locator('.editor-code').click();
  await ed.selectAll();
  await ed.press('Shift+Tab');
}, { content: doc(code('\ta\n\n\tc', 'javascript')) });

// Three backticks put the code block in the right place (B8) --------------------------------------

const shapes = async (ed: Editor) => (await ed.state()).root.children.map(shape).join(' ');

const cellBlocks = async (ed: Editor) =>
  (await ed.state()).root.children[0].children[1].children[1].children.map(shape).join(' ');

async function exitCode(ed: Editor) {
  await ed.type('code');
  await ed.enter(3);
}

test('three backticks on an empty line give exactly the tree of /code', { tag: '@B8' }, async ({ ed, page }) => {
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

test('three backticks after leading spaces make a top-level block', { tag: '@B8' }, async ({ ed }) => {
  await ed.open();
  await ed.type('  ```x');
  expect(await shapes(ed)).toBe('code');
});

test('three backticks between paragraphs make a block between them', { tag: '@B8' }, async ({ ed }) => {
  await ed.open({ content: doc(p('one'), p('two')) });
  await ed.caretAfter('one');
  await ed.enter();
  await ed.type('```x');
  expect(await shapes(ed)).toBe('paragraph code paragraph');
  expect(plainText(await ed.state())).toBe('one|x|two');
});

test('three backticks before existing text make a block before it', { tag: '@B8' }, async ({ ed }) => {
  await ed.open({ content: doc(p('after')) });
  await ed.caretBefore('after');
  await ed.type('```x');
  expect(await shapes(ed)).toBe('code paragraph');
  expect(plainText(await ed.state())).toBe('x|after');
});

test('three backticks after formatted text make a block after it', { tag: '@B8' }, async ({ ed }) => {
  await ed.open({ content: doc(p(text('bold', 1))) });
  await ed.caretAfter('bold');
  await ed.press('ControlOrMeta+b');
  await ed.type('```x');
  expect(await shapes(ed)).toBe('paragraph code');
  expect(plainText(await ed.state())).toBe('bold|x');
});

test('three backticks between formatted runs keep the text in order', { tag: '@B8' }, async ({ ed }) => {
  await ed.open({ content: doc(p(text('one', 1), text('two', 2))) });
  await ed.caretAfter('one');
  await ed.press('ControlOrMeta+b');
  await ed.type('```x');
  expect(await shapes(ed)).toBe('paragraph code paragraph');
  expect(plainText(await ed.state())).toBe('one|x|two');
});

test('three backticks after inline code make a top-level block', { tag: '@B8' }, async ({ ed }) => {
  await ed.open();
  await ed.type('`a`');
  await ed.type(' ');
  await ed.type('```x');
  expect(await shapes(ed)).toMatch(/^(paragraph code|code)$/);
});

test('three backticks after a link make a block after its paragraph', { tag: '@B8' }, async ({ ed }) => {
  await ed.open({ content: doc(p(link('https://example.com', 'site'))) });
  await ed.caretAfter('site');
  await ed.type('```x');
  expect(await shapes(ed)).toBe('paragraph[link] code');
});

test('three backticks after an equation make a block after its paragraph', { tag: '@B8' }, async ({ ed }) => {
  await ed.open();
  await ed.type('$x$```y');
  expect(await shapes(ed)).toBe('paragraph code');
});

test('three backticks after a line break make a block after its paragraph', { tag: '@B8' }, async ({ ed }) => {
  await ed.open();
  await ed.type('line');
  await ed.press('Shift+Enter');
  await ed.type('```x');
  expect(await shapes(ed)).toBe('paragraph code');
});

test('three backticks between two line breaks split the paragraph around the block', { tag: '@B8' }, async ({ ed }) => {
  await ed.open({ content: doc(p('one', br(), 'two')) });
  await ed.caretAfter('one');
  await ed.press('Shift+Enter');
  await ed.type('```x');
  expect(await shapes(ed)).toBe('paragraph code paragraph');
  expect(plainText(await ed.state())).toMatch(/^one\|x\|+two$/);
});

test('three backticks in an aligned line make an aligned block', { tag: '@B8' }, async ({ ed }) => {
  await ed.open();
  await ed.pick('align c');
  await ed.type('```x');
  expect(await ed.tree()).toMatch(/^code format="center"/);
});

test('three backticks in a table cell make a block that is a direct child of the cell', { tag: '@B8' }, async ({ ed }) => {
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
    test(`the ${name} shortcut works after leaving a backtick code block in ${where}`, { tag: '@B8' }, async ({ ed }) => {
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
  test(`slash ${query} works after leaving a backtick code block`, { tag: '@B8' }, async ({ ed }) => {
    await ed.open();
    await ed.type('```');
    await exitCode(ed);
    await ed.pick(query);
    expect(await shapes(ed)).toMatch(wanted);
  });
}

for (const [kind, trigger] of [['bullet', '- '], ['number', '1. '], ['check', '[] ']]) {
  test(`leaving a backtick code block in a ${kind} list gives the next item`, { tag: '@B8' }, async ({ ed }) => {
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

test('leaving a backtick code block in a middle bullet inserts the next item in between', { tag: '@B8' }, async ({ ed }) => {
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

test('a shortcut after a backtick code block in a cell works', { tag: '@B8' }, async ({ ed }) => {
  await ed.open({ content: doc(table([['', ''], ['', '']]), p()) });
  await ed.clickCell(1, 1);
  await ed.type('```');
  await exitCode(ed);
  await ed.type('- item');
  expect(await cellBlocks(ed)).toBe('code list[listitem]');
});

test('Backspace on an empty backtick code block leaves a normal line', { tag: '@B8' }, async ({ ed }) => {
  await ed.open();
  await ed.type('```');
  await ed.press('Backspace');
  expect(await ed.tree()).toBe('paragraph');
  await ed.type('# works');
  expect(await ed.blocks()).toEqual(['h1']);
});

test('Backspace on an empty backtick code block in a bullet leaves the bullet', { tag: '@B8' }, async ({ ed }) => {
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

test('Backspace on an empty backtick code block in a quote leaves the quote', { tag: '@B8' }, async ({ ed }) => {
  await ed.open();
  await ed.type('> ');
  await ed.type('```');
  await ed.press('Backspace');
  expect(await shapes(ed)).toBe('quote');
});

test('Backspace on an empty backtick code block in a heading leaves the heading', { tag: '@B8' }, async ({ ed }) => {
  await ed.open();
  await ed.type('## ');
  await ed.type('```');
  await ed.press('Backspace');
  expect(await shapes(ed)).toBe('heading');
});

test('Backspace on an empty backtick code block in a cell leaves a line', { tag: '@B8' }, async ({ ed }) => {
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
    test(`with code nested in ${where} as 0.3.0 saved it, the ${name} shortcut works`, { tag: '@B8' }, async ({ ed }) => {
      await ed.open({ content: doc(saved) });
      // As on a normal line: the rule needs a line of its own, the others go before text.
      const rule = type === 'horizontalrule';
      if (rule) {
        // Typing over it keeps the line
        await ed.select('tail');
      } else {
        await ed.caretBefore('tail');
      }
      await ed.type(trigger);
      const now = await ed.state();
      expect(tree(now)).toMatch(new RegExp(`(^|\\n)${type}( |\\n|$)`));
      // The typed shortcut is consumed, and nothing else is lost.
      expect(plainText(now).replace(/\|/g, '')).toBe(rule ? 'old code' : 'old codetail');
    });
  }

  test(`with code nested in ${where} as 0.3.0 saved it, a slash item works`, { tag: '@B8' }, async ({ ed }) => {
    await ed.open({ content: doc(saved) });
    await ed.caretAfter('tail');
    await ed.type(' ');
    await ed.pick('h1');
    expect(await ed.tree()).toMatch(/(^|\n)heading tag="h1"/);
  });
}

test('with code nested in a list item as 0.3.0 saved it, Enter gives the next bullet', { tag: '@B8' }, async ({ ed }) => {
  await ed.open({ content: doc(OLD['a list item']) });
  await ed.caretAfter('tail');
  await ed.enter();
  await ed.type('next');
  await expect(ed.root.locator('li')).toHaveCount(2);
});

test('ArrowDown from the last line of code moves typing to the line below', { tag: '@U3' },
  async ({ ed }) => {
    await ed.open({ content: doc(code('first\nsecond', 'javascript'), p('below')) });
    await ed.caretAfter('second');
    await ed.press('ArrowDown');
    await ed.settle();
    await ed.type('Z');
    await ed.settle();
    expect(plainText(await ed.state())).toBe('first|second|belowZ');
  });
