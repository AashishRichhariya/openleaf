
import { doc, heading, li, link, list, p, quote, table, text,
} from '../support/doc';
import { Editor } from '../support/editor';
import { scenario } from '../support/scenario';
import { expect, test } from '../support/test';


const has = async (ed: Editor, type: string) =>
  new RegExp(`(^|\\n) *${type}( |\\n|$)`).test(await ed.tree());

function typed(name: string, value: string) {
  scenario(`markdown: ${name}`, async (ed) => {
    await ed.type(value);
  });
}

for (const level of [1, 2, 3, 4, 5, 6]) {
  typed(`heading ${level}`, `${'#'.repeat(level)} Heading`);
}

typed('seven hashes stay text', '####### no');

typed('hash without a space stays text', '#tag here');

typed('hash mid-line stays text', 'number # one');

typed('heading trigger alone', '# ');

typed('quote', '> quoted');

typed('quote without a space stays text', '>quoted');

typed('bold with stars', 'a **bold** b');

typed('bold with underscores', 'a __bold__ b');

typed('italic with a star', 'a *italic* b');

typed('italic with an underscore', 'a _italic_ b');

typed('bold italic with stars', 'a ***both*** b');

typed('bold italic with underscores', 'a ___both___ b');

typed('strikethrough', 'a ~~gone~~ b');

typed('inline code', 'a `code` b');

typed('highlight', 'a ==marked== b');

typed('inline code keeps markdown literal', '`**not bold**` x');

typed('bold around italic', '**bold _and italic_** end');

typed('snake_case is untouched', 'snake_case_name here');

typed('space before closing tag cancels', 'a *not italic * b');

typed('space after opening tag cancels', 'a * not italic* b');

typed('empty tags stay', 'a **** b');

typed('arithmetic stars', '2 * 3 * 4');

typed('format at line start', '**first** word');

typed('format before punctuation', '*yes*, then.');

typed('single tilde stays', 'about ~5~ items');

typed('two backticks stay', '`` ok');

typed('markdown link', 'see [the docs](https://example.com) now');

typed('markdown link with title', '[t](https://example.com "Title") x');

typed('image syntax', '![alt](https://example.com/a.png) x');

typed('markdown table row stays text', '| a | b | ');

typed('tags in angle brackets stay text', '<b>html</b> ');

typed('three dashes and a space', '--- ');

typed('four dashes and a space', '---- ');

typed('three dashes without a space stay', '---');

typed('two dashes and a space stay', '-- ');

typed('three stars and a space stay', '*** ');

typed('three underscores and a space stay', '___ ');

typed('rule, then typing', '--- below');

typed('dashes mid-line stay', 'a --- b');

typed('tilde fence stays', '~~~ ');

scenario('markdown: rule above existing text', async (ed) => {
  await ed.caretBefore('next');
  await ed.enter();
  await ed.press('ArrowUp');
  await ed.type('--- ');
}, { content: doc(p('next')) });

scenario('markdown: rule typed before text', async (ed) => {
  await ed.caretBefore('text');
  await ed.type('--- ');
}, { content: doc(p('text'), p('after')) });

scenario('markdown: heading before existing text', async (ed) => {
  await ed.caretBefore('Title');
  await ed.type('## ');
}, { content: doc(p('Title')) });

scenario('markdown: quote before existing text', async (ed) => {
  await ed.caretBefore('said');
  await ed.type('> ');
}, { content: doc(p('said')) });

scenario('markdown: bold completed in the middle', async (ed) => {
  await ed.caretAfter('**mid');
  await ed.type('**');
}, { content: doc(p('a **mid z')) });

scenario('markdown: after formatted text', async (ed) => {
  await ed.caretAfter('bold');
  await ed.press('ControlOrMeta+b');
  await ed.type(' then _it_ ');
}, { content: doc(p(text('bold', 1))) });

scenario('markdown: heading inside a table cell', async (ed) => {
  await ed.clickCell(1, 1);
  await ed.type('# In cell');
}, { content: doc(table([['', ''], ['', '']]), p()) });

scenario('markdown: bold inside a table cell', async (ed) => {
  await ed.clickCell(1, 1);
  await ed.type('**x** ');
}, { content: doc(table([['', ''], ['', '']]), p()) });

scenario('markdown: quote inside a table cell', async (ed) => {
  await ed.clickCell(1, 1);
  await ed.type('> q');
}, { content: doc(table([['', ''], ['', '']]), p()) });

scenario('markdown: rule inside a table cell', async (ed) => {
  await ed.clickCell(1, 1);
  await ed.type('--- ');
}, { content: doc(table([['', ''], ['', '']]), p()) });

for (const [name, value] of [['heading', '# x'], ['bold', '**x** '], ['equation', '$x$ ']]) {
  scenario(`markdown: ${name} inside a quote`, async (ed) => {
    await ed.caretBefore('quoted');
    await ed.type(value);
  }, { content: doc(quote('quoted')) });

  scenario(`markdown: ${name} inside a heading`, async (ed) => {
    await ed.caretBefore('head');
    await ed.type(value);
  }, { content: doc(heading(2, 'head')) });
}

for (const [name, value] of [
  ['heading', '# '], ['bold', '**x**'], ['bullet', '- '], ['rule', '--- '], ['quote', '> '],
]) {
  scenario(`markdown: undo ${name} gives the typed text back`, async (ed) => {
    await ed.type(value);
    await ed.undo();
  });
}

scenario('heading: Enter at the end starts a paragraph', async (ed) => {
  await ed.type('# Title');
  await ed.enter();
  await ed.type('body');
});

scenario('heading: Enter in the middle', async (ed) => {
  await ed.caretAfter('Ti');
  await ed.enter();
}, { content: doc(heading(1, 'Title')) });

scenario('heading: Enter at the start', async (ed) => {
  await ed.caretBefore('Title');
  await ed.enter();
}, { content: doc(heading(1, 'Title')) });

scenario('heading: Backspace at the start', async (ed) => {
  await ed.caretBefore('Title');
  await ed.press('Backspace');
}, { content: doc(heading(1, 'Title')) });

scenario('heading: Backspace on an empty heading', async (ed) => {
  await ed.type('## ');
  await ed.press('Backspace');
});

scenario('quote: Enter starts a paragraph', async (ed) => {
  await ed.type('> quoted');
  await ed.enter();
  await ed.type('after');
});

scenario('quote: Shift+Enter stays inside', async (ed) => {
  await ed.type('> one');
  await ed.press('Shift+Enter');
  await ed.type('two');
});

scenario('quote: Backspace at the start', async (ed) => {
  await ed.caretBefore('quoted');
  await ed.press('Backspace');
}, { content: doc(quote('quoted')) });

// Markdown.
for (const source of ['# ', '- ', '1. ', '> ', '[ ] ', '```js', '---', '## Title', '- [ ] x']) {
  scenario(`markdown on Enter: "${source}"`, async (ed) => {
    await ed.paste({ 'text/plain': source });
    await ed.enter();
    await ed.type('next');
  });
}

scenario('markdown on Enter: backticks after undo', async (ed) => {
  await ed.type('```');
  await ed.undo();
  await ed.enter();
});

const CONTAINERS: Record<string, object> = {
  heading: heading(2, 'text'),
  quote: quote('text'),
};

for (const [name, block] of Object.entries(CONTAINERS)) {
  for (const trigger of ['- ', '1. ', '[] ', '# ', '> ', '--- ']) {
    scenario(`markdown in a ${name}: "${trigger}"`, async (ed) => {
      await ed.caretBefore('text');
      await ed.type(trigger);
    }, { content: doc(block) });
  }
}

const MARKDOWN = [
  'a ` then **bold** ', 'a ` then _it_ ', '* [ ] item', '+ [ ] item', '- [X] item', '[a](google.com) ',
  '[]() ', '[a]() ', '[a]( b ) ', '[a [b]](https://example.com) ', '[a](https://example.com \'t\') ',
  ':smile: ', '__init__ ', 'x**y**z ', '~~a~~~ ',
];

for (const source of MARKDOWN) {
  scenario(`markdown edge: ${source}`, async (ed) => {
    await ed.type(source);
  });
}

scenario('markdown edge: a number above a numbered list', async (ed) => {
  await ed.caretBefore('above');
  await ed.type('7. ');
}, { content: doc(p('above'), list('number', li(1, 'first'))) });

scenario('markdown edge: an indented item under a list', async (ed) => {
  await ed.caretBefore('para');
  await ed.press('Tab');
  await ed.type('1. ');
}, { content: doc(list('bullet', li(1, 'item')), p('para')) });

scenario('markdown edge: a bullet between two lists', async (ed) => {
  await ed.caretBefore('middle');
  await ed.type('- ');
}, { content: doc(list('bullet', li(1, 'a')), p('middle'), list('bullet', li(1, 'c'))) });

for (const lang of ['js', 'python', 'objective-c', 'c++']) {
  scenario(`markdown fence: ${lang} and Space`, async (ed) => {
    await ed.paste({ 'text/plain': `\`\`\`${lang}` });
    await ed.press('Space');
    await ed.type('x');
  });
}

scenario('markdown after a multi-character paste', async (ed) => {
  await ed.paste({ 'text/plain': '**bold**' });
  await ed.type(' ');
});

scenario('markdown in inline code after a link', async (ed) => {
  await ed.caretAfter('site');
  await ed.type(' `x` **y** ');
}, { content: doc(p(link('https://example.com', 'site'))) });

// Prices are not math (B10) -----------------------------------------------------------------------

const PRICES = [
  'costs $5 and $', 'costs $5 and $10 each', 'between $5 and $10', 'from $5 to $10',
  'it is $5 or $', '$20 is more than $', '$5-$10', '$5 - $10', '$5, $10', '$1,000 and $2,000',
  '$4.99 (was $9.99)', '$5k to $10k', '$10/$20', 'was $5. Now it is $', 'paid $15 for lunch and $',
];

for (const value of PRICES) {
  test(`"${value}" typed stays text, not math`, { tag: '@B10' }, async ({ ed }) => {
    await ed.open();
    await ed.type(value);
    expect(await has(ed, 'equation')).toBe(false);
    await expect(ed.root).toHaveText(value);
  });
}

test('real math after a price still converts', { tag: '@B10' }, async ({ ed }) => {
  await ed.open();
  await ed.type('costs $5 and $x$');
  const saved = await ed.tree();
  expect(saved).toContain('text "costs $5 and "');
  expect(saved).toContain('equation="x"');
});
