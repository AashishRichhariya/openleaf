import { doc, li, list, p, quote, table } from '../support/doc';
import { scenario } from '../support/scenario';

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

// B14 changes the first match of exactly these queries.
const B14_QUERIES = new Set(['ce', 'cen', 'cent', 'cente', 'center']);

const QUERIES = [
  ...new Set(
    OPTIONS.flatMap(([title, , keywords]) => [title.toLowerCase(), ...keywords])
      .flatMap((phrase) => phrase.split(' '))
      .flatMap((word) => Array.from(word, (_char, index) => word.slice(0, index + 1)))
      .concat(['H1', 'TABLE', 'zzz', '3', '3x', '3x4', '03x2', '0x2', '3X4', '12x', '99x99',
        '$', 'c++', 'code ', 'heading 2', 'block q']),
  ),
].filter((query) => !B14_QUERIES.has(query));

for (let start = 0; start < QUERIES.length; start += 30) {
  const batch = QUERIES.slice(start, start + 30);
  scenario(`slash: matches and first match for queries ${start}-${start + 29}`, async (ed) => {
    const results: string[] = [];
    for (const query of batch) {
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
  }, { persist: false, timeout: 180_000 });
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
