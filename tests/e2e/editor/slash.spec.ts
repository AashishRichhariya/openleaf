import { doc, li, list, p, quote, table } from '../support/doc';
import { Editor } from '../support/editor';
import { scenario } from '../support/scenario';
import { expect, test } from '../support/test';

// [title, query that finds it, keywords]
const OPTIONS: Array<[string, string, string[]]> = [
  ['Paragraph', 'paragraph', ['normal', 'paragraph', 'p', 'text']],
  ['Heading 1', 'h1', ['heading', 'header', 'h1']],
  ['Heading 2', 'h2', ['heading', 'header', 'h2']],
  ['Heading 3', 'h3', ['heading', 'header', 'h3']],
  ['Table', 'table', ['table', 'grid', 'spreadsheet', 'rows', 'columns']],
  ['Numbered List', 'numbered', ['numbered list', 'ordered list', 'ol']],
  ['Bulleted List', 'bulleted', ['bulleted list', 'unordered list', 'ul']],
  ['Check List', 'todo', ['check list', 'todo list']],
  ['Quote', 'quote', ['block quote']],
  ['Inline Equation', 'inline', ['equation', 'inline', 'inline equation', 'math', 'formula',
    'inline math']],
  ['Block Equation', 'display', ['equation', 'block', 'block equation', 'display',
    'display equation', 'math', 'formula', 'centered']],
  ['Code', 'codeblock', ['javascript', 'python', 'js', 'codeblock']],
  ['Divider', 'divider', ['horizontal rule', 'divider', 'hr']],
  ['Align left', 'left', ['align', 'justify', 'left']],
  ['Align center', 'align', ['align', 'justify', 'center']],
  ['Align right', 'right', ['align', 'justify', 'right']],
  ['Align justify', 'justify', ['align', 'justify']],
];

// The prefixes of "center", whose first match B14 fixed, have a scenario each (below).
const CENTER_QUERIES = ['ce', 'cen', 'cent', 'cente', 'center'];

const QUERIES = [
  ...new Set(
    OPTIONS.flatMap(([title, , keywords]) => [title.toLowerCase(), ...keywords])
      .flatMap((phrase) => phrase.split(' '))
      .flatMap((word) => Array.from(word, (_char, index) => word.slice(0, index + 1)))
      .concat(['H1', 'TABLE', 'zzz', '3', '3x', '3x4', '03x2', '0x2', '3X4', '12x', '99x99',
        '$', 'c++', 'code ', 'heading 2', 'block q']),
  ),
].filter((query) => !CENTER_QUERIES.includes(query));

/** Types each query, and reports the options it shows with the selected one starred. */
async function matches(ed: Editor, queries: string[]): Promise<string> {
  const results: string[] = [];
  for (const query of queries) {
    await ed.type(`/${query}`, 4);
    const titles = await ed.menu.locator('.item').evaluateAll((items) =>
      items.map((item) => {
        const title = item.querySelector('.text')!.textContent;
        return item.getAttribute('aria-selected') === 'true' ? `*${title}` : `${title}`;
      }));
    results.push(`/${query}: ${titles.join(', ')}`);
    await ed.selectAll();
    await ed.press('Backspace');
  }
  return results.join('\n');
}

for (let start = 0; start < QUERIES.length; start += 30) {
  const batch = QUERIES.slice(start, start + 30);
  scenario(`slash: matches and first match for queries ${start}-${start + 29}`,
    (ed) => matches(ed, batch), { persist: false, timeout: 180_000 });
}

for (const query of CENTER_QUERIES) {
  scenario(`slash: matches and first match for /${query}`, (ed) => matches(ed, [query]),
    { persist: false, tag: '@B14' });
}

scenario('slash: opens with every option', async (ed) => {
  await ed.type('/');
}, { persist: false });

scenario('slash: opens after a space', async (ed) => {
  await ed.type('text /');
}, { persist: false });

scenario('slash: stays closed inside a word', async (ed) => {
  await ed.type('and/or');
}, { persist: false });

scenario('slash: Escape closes', async (ed) => {
  await ed.type('/');
  await ed.press('Escape');
}, { persist: false });

scenario('slash: deleting the slash closes', async (ed) => {
  await ed.type('/he');
  await ed.press('Backspace', 3);
}, { persist: false });

scenario('slash: clicking elsewhere', async (ed) => {
  await ed.type('/');
  await ed.page.mouse.click(5, 780);
}, { persist: false });

scenario('slash: ArrowUp wraps to the last option', async (ed) => {
  await ed.type('/');
  await ed.press('ArrowUp');
}, { persist: false });

scenario('slash: ArrowDown through every option keeps it in view', async (ed) => {
  await ed.type('/');
  const seen: string[] = [];
  for (let i = 0; i < OPTIONS.length + 1; i += 1) {
    seen.push(await ed.menu.evaluate((menu) => {
      const item = menu.querySelector('[aria-selected="true"]')!;
      const [box, view] = [item, menu.querySelector('ul')!].map((e) => e.getBoundingClientRect());
      const inView = box.top >= view.top - 1 && box.bottom <= view.bottom + 1;
      return `${item.querySelector('.text')!.textContent}:${inView ? 'in view' : 'hidden'}`;
    }));
    await ed.press('ArrowDown');
  }
  return seen.join(', ');
}, { persist: false });

scenario('slash: hovering selects', async (ed) => {
  await ed.type('/');
  await ed.option('Heading 2').hover();
}, { persist: false });

scenario('slash: Tab picks', async (ed) => {
  await ed.slash('h2');
  await ed.press('Tab');
  await ed.type('Tabbed');
});

for (const [title, query] of OPTIONS) {
  scenario(`slash: ${title} by keyboard`, async (ed) => {
    await ed.pick(query === 'align' ? 'align c' : query);
    if (title === 'Table') return;
    await ed.type('typed next');
  }, { persist: title !== 'Table' });

  scenario(`slash: ${title} by mouse`, async (ed) => {
    await ed.slash('');
    await ed.option(title).click();
    await ed.settle();
    if (title === 'Table') return;
    await ed.type('typed next');
  }, { persist: title !== 'Table' });

  scenario(`slash: ${title} on existing text`, async (ed) => {
    await ed.caretAfter('existing words');
    await ed.type(' ');
    await ed.pick(query === 'align' ? 'align c' : query);
  }, { content: doc(p('existing words'), p('next')), persist: false });
}

const LINES = Array.from({ length: 70 }, (_line, index) => `Line ${index}`);

const PLACES = { top: 1, middle: 35, bottom: 69 };

for (const [place, line] of Object.entries(PLACES)) {
  const content = doc(...LINES.map((value) => p(value)));

  scenario(`slash long page ${place}: menu position`, async (ed) => {
    await ed.caretAfter(`Line ${line}`);
    await ed.enter();
    await ed.type('/');
  }, { content, persist: false });

  OPTIONS.forEach(([title, query], index) => {
    scenario(`slash long page ${place}: ${title} by arrows`, async (ed) => {
      await ed.caretAfter(`Line ${line}`);
      await ed.enter();
      await ed.type('/');
      await ed.press('ArrowDown', index);
      await ed.enter();
    }, { content, persist: false });

    scenario(`slash long page ${place}: ${title} by mouse (${query})`, async (ed) => {
      await ed.caretAfter(`Line ${line}`);
      await ed.enter();
      await ed.type('/');
      await ed.option(title).click();
    }, { content, persist: false });
  });
}

for (const query of ['h1', 'bulleted', 'numbered', 'todo', 'quote', 'codeblock', 'divider',
  'inline', 'display', '2x2', 'align c']) {
  scenario(`slash: ${query} inside a table cell`, async (ed) => {
    await ed.clickCell(1, 1);
    await ed.pick(query);
  }, { content: doc(table([['', ''], ['', '']]), p()), persist: false });

  scenario(`slash: ${query} inside a list`, async (ed) => {
    await ed.caretAfter('item');
    await ed.enter();
    await ed.pick(query);
  }, { content: doc(list('bullet', li(1, 'item'))), persist: false });

  scenario(`slash: ${query} inside a quote`, async (ed) => {
    await ed.caretAfter('quoted');
    await ed.type(' ');
    await ed.pick(query);
  }, { content: doc(quote('quoted')), persist: false });
}

for (const align of ['left', 'align c', 'right', 'justify']) {
  scenario(`align: ${align} with text`, async (ed) => {
    await ed.pick(align);
    await ed.type('Aligned text');
  });
}

scenario('align: kept on Enter', async (ed) => {
  await ed.pick('right');
  await ed.type('one');
  await ed.enter();
  await ed.type('two');
});

// Slash menu keys.
scenario('slash keys: no match, ArrowUp moves the caret', async (ed) => {
  await ed.caretAfter('second');
  await ed.type(' /zzzq');
  await ed.press('ArrowUp');
}, { content: doc(p('first line here'), p('second')), persist: false });

scenario('slash keys: no match, Enter', async (ed) => {
  await ed.type('/zzzq');
  await ed.enter();
});

scenario('slash keys: Shift+Enter', async (ed) => {
  await ed.type('/h2');
  await ed.press('Shift+Enter');
});

scenario('slash keys: the query resets the scroll', async (ed) => {
  await ed.type('/');
  await ed.press('ArrowUp');
  await ed.type('a');
}, { persist: false });

scenario('slash keys: hover on the half visible item', async (ed) => {
  await ed.type('/');
  await ed.option('Bulleted List').hover();
}, { persist: false });

scenario('slash keys: a second opening', async (ed) => {
  await ed.type('/h');
  await ed.press('Escape');
  await ed.enter();
  await ed.type('/');
}, { persist: false });

scenario('slash keys: near the right edge', async (ed) => {
  await ed.pick('right');
  await ed.type('/');
}, { persist: false });

// /center selects Align center first (B14) --------------------------------------------------------

for (const query of ['ce', 'cen', 'cent', 'cente', 'center']) {
  test(`/${query} selects Align center first`, { tag: '@B14' }, async ({ ed }) => {
    await ed.open();
    await ed.slash(query);
    await expect(ed.menu.locator('.item[aria-selected="true"] .text')).toHaveText('Align center');
  });
}

test('/center and Enter centers the line', { tag: '@B14' }, async ({ ed }) => {
  await ed.open();
  await ed.pick('center');
  await ed.type('middle');
  expect(await ed.tree()).toContain('paragraph format="center"');
});

test('Block Equation is still found by center and centered', { tag: '@B14' }, async ({ ed }) => {
  await ed.open();
  await ed.slash('center');
  await expect(ed.option('Block Equation')).toHaveCount(1);
  await ed.type('ed');
  await expect(ed.menu.locator('.item[aria-selected="true"] .text')).toHaveText('Block Equation');
});
