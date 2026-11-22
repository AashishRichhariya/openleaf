/*
 * One or more scenarios for each behavior change found in the source audit of Lexical
 * 0.31.1 to 0.53.0. They pin what returning users have today.
 */
import {
  br, code, doc, equation, heading, hr, li, link, list, p, quote, table, text,
} from '../support/doc';
import { scenario } from '../support/scenario';
import { test } from '../support/test';

import type { Editor } from '../support/editor';

const mod = 'ControlOrMeta';

// Keys typed in the equation input belong to the input, however it was opened.
const OPEN: Record<string, (ed: Editor) => Promise<void>> = {
  'a double click': async (ed) => {
    await ed.root.locator('.equation-wrapper').dblclick();
  },
  'a click and Enter': async (ed) => {
    await ed.root.locator('.equation-wrapper').click();
    await ed.settle();
    await ed.enter();
  },
  'two clicks': async (ed) => {
    await ed.root.locator('.equation-wrapper').click();
    await ed.page.waitForTimeout(600);
    await ed.root.locator('.equation-wrapper').click();
  },
};

const INPUT_KEYS: Record<string, string[]> = {
  'Backspace': ['End', 'Backspace'],
  'Delete': ['Home', 'Delete'],
  'line start': ['End', `${mod}+ArrowLeft`],
  'line end': ['Home', `${mod}+ArrowRight`],
  'select all': [`${mod}+a`],
  'ArrowUp': ['End', 'ArrowUp'],
  'ArrowDown': ['Home', 'ArrowDown'],
  'ArrowLeft': ['End', 'ArrowLeft'],
  'ArrowRight at the end': ['End', 'ArrowRight'],
  'Tab': ['End', 'Tab'],
};

for (const [how, open] of Object.entries(OPEN)) {
  for (const [name, keys] of Object.entries(INPUT_KEYS)) {
    scenario(`equation input via ${how}: ${name}`, async (ed) => {
      await open(ed);
      await ed.settle();
      for (const key of keys) await ed.press(key);
    }, { content: doc(p('before ', equation('x^2'), ' after'), p('below')), persist: false });
  }
}

for (const key of ['Backspace', 'Delete', `${mod}+a`, 'ArrowUp', 'Tab']) {
  scenario(`equation input via slash: ${key}`, async (ed) => {
    await ed.pick('inline');
    await ed.type('abc');
    await ed.press(key);
  }, { persist: false });
}

scenario('equation input: clicking back where the caret was', async (ed) => {
  await ed.caretAfter('before');
  await ed.root.locator('.equation-wrapper').dblclick();
  await ed.press('End');
  await ed.type('+1');
  await ed.caretAfter('before');
}, { content: doc(p('before ', equation('x^2'), ' after')) });

scenario('equation input: clicking outside the editor', async (ed) => {
  await ed.root.locator('.equation-wrapper').dblclick();
  await ed.page.mouse.click(5, 300);
}, { content: doc(p('before ', equation('x^2'), ' after')), persist: false });

scenario('table widget: select all inside the field', async (ed) => {
  await ed.pick('table');
  await ed.type('12');
  await ed.press(`${mod}+a`);
}, { persist: false });

// Text direction.
const RTL: Record<string, object> = {
  'paragraph': doc(p('مرحبا بالعالم'), p('english')),
  'mixed list': doc(list('bullet', li(1, 'english'), li(2, 'עברית'))),
  'check list': doc(list('check', li(1, 'مهمة'))),
  'table': doc(table([['رأس', 'head'], ['خلية', 'cell']])),
};

for (const [name, content] of Object.entries(RTL)) {
  scenario(`direction: saved ${name}`, async () => {}, { content });
}

scenario('direction: typed RTL', async (ed) => {
  await ed.type('مرحبا');
  await ed.enter();
});

scenario('direction: RTL added to an old document', async (ed) => {
  await ed.caretAfter('english');
  await ed.enter();
  await ed.type('שלום');
}, { content: doc(p('english')) });

scenario('direction: English rewritten as RTL', async (ed) => {
  await ed.root.getByText('english').click();
  await ed.selectAll();
  await ed.type('שלום');
}, { content: doc(p('english')) });

scenario('direction: RTL checklist click', async (ed) => {
  const item = ed.root.locator('li');
  const box = (await item.boundingBox())!;
  await item.click({ position: { x: box.width - 7, y: 10 } });
}, { content: doc(list('check', li(1, 'مهمة'))) });

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
  }, { changedBy: source.startsWith('~~') ? 'B15' : undefined });
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

// List Backspace.
for (const kind of ['bullet', 'number', 'check'] as const) {
  const three = doc(p('para'), list(kind, li(1, 'one'), li(2, 'two'), li(3, 'three')));
  for (const item of ['one', 'two', 'three']) {
    scenario(`list ${kind}: Backspace before ${item} of three`, async (ed) => {
      await ed.caretBefore(item);
      await ed.press('Backspace');
    }, { content: three });
  }

  scenario(`list ${kind}: Backspace on an emptied middle item`, async (ed) => {
    await ed.select('two');
    await ed.press('Backspace', 2);
  }, { content: three });

  scenario(`list ${kind}: Enter on a whitespace item`, async (ed) => {
    await ed.caretAfter('one');
    await ed.enter();
    await ed.type(' ');
    await ed.enter();
  }, { content: doc(list(kind, li(1, 'one'))) });
}

scenario('list: conversion keeps or resets the start', async (ed) => {
  await ed.caretAfter('five');
  await ed.type(' ');
  await ed.pick('bulleted');
}, { content: doc({ ...list('number', li(5, 'five')), start: 5 }) });

scenario('list: select all and Backspace', async (ed) => {
  await ed.root.getByText('one').click();
  await ed.selectAll();
  await ed.press('Backspace');
}, { content: doc(list('bullet', li(1, 'one'), li(2, 'two'))) });

scenario('list: leaving the middle of a numbered list', async (ed) => {
  await ed.caretAfter('b');
  await ed.enter(2);
}, { content: doc(list('number', li(1, 'a'), li(2, 'b'), li(3, 'c'))) });

// A block inserted with content below.
for (const query of ['divider', '3x3', 'table']) {
  for (const [where, at] of [['empty line', ''], ['line end', 'end'], ['line start', 'start']]) {
    scenario(`insert ${query} at ${where}, content below`, async (ed) => {
      if (where === 'line start') {
        await ed.caretBefore('above');
      } else {
        await ed.caretAfter('above');
        if (where === 'empty line') await ed.enter();
        else await ed.type(' ');
      }
      if (at === 'start') {
        await ed.type('/');
        await ed.type(query);
        await ed.enter();
      } else {
        await ed.pick(query);
      }
      if (query === 'table') {
        await ed.type('2');
        await ed.press('Tab');
        await ed.type('2');
        await ed.enter();
        await ed.page.waitForTimeout(100);
      }
    }, { content: doc(p('above'), p('below')), persist: query !== 'table' });
  }

  scenario(`insert ${query} in the middle of a line`, async (ed) => {
    await ed.caretAfter('left ');
    await ed.pick(query);
  }, { content: doc(p('left  right'), p('below')), persist: false });
}

// Checklist hit area.
for (const x of [2, 15, 17, 19, 22, 30]) {
  scenario(`checklist: mouse at ${x}px`, async (ed) => {
    await ed.root.locator('li').click({ position: { x, y: 10 } });
  }, { content: doc(list('check', li(1, 'todo item'))) });
}

test.describe('touch', () => {
  test.use({ hasTouch: true });
  for (const x of [4, 10, 18, 30, 45]) {
    scenario(`checklist: touch at ${x}px`, async (ed) => {
      await ed.root.locator('li').tap({ position: { x, y: 10 } });
    }, { content: doc(list('check', li(1, 'todo item'))) });
  }
});

// Highlighting of languages without a bundled grammar.
for (const language of ['json', 'bash', 'jsx', 'tsx', 'yaml', 'go', 'diff', 'sql', 'html', 'css',
  'typescript', 'nonsense', 'plain']) {
  scenario(`code language: ${language}`, async () => {}, {
    content: doc(code('{"a": 1, "b": true}\n# note\nconst x = "s" + 2;\n+ added\n- gone', language)),
  });
}

// Triple click.
const TRIPLE: Record<string, object> = {
  'paragraph': doc(p('click three'), p('next block')),
  'heading': doc(heading(2, 'click three'), p('next block')),
  'list item': doc(list('bullet', li(1, 'click three'), li(2, 'next block'))),
  'formatted line': doc(p(text('click three', 1), ' plain'), p('next block')),
  'cell': doc(table([['click three', 'b'], ['c', 'd']]), p('next block')),
};

for (const [name, content] of Object.entries(TRIPLE)) {
  scenario(`triple click a ${name}, then Backspace`, async (ed) => {
    await ed.root.getByText('click three').click({ clickCount: 3 });
    await ed.settle();
    await ed.press('Backspace');
  }, { content });

  scenario(`triple click a ${name}, then bold`, async (ed) => {
    await ed.root.getByText('click three').click({ clickCount: 3 });
    await ed.settle();
    await ed.press(`${mod}+b`);
  }, { content });
}

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

// Arrows around a divider.
const RULED = doc(p('above line'), hr(), p('below line'));

for (const [key, start] of [
  ['ArrowDown', 'above'], ['ArrowUp', 'below'], ['ArrowRight', 'above'], ['ArrowLeft', 'below'],
  ['Delete', 'above'], ['Backspace', 'below'], ['Shift+ArrowDown', 'above'],
]) {
  scenario(`divider: ${key} next to it`, async (ed) => {
    if (start === 'above') await ed.caretAfter('above line');
    else await ed.caretBefore('below line');
    await ed.press(key);
  }, { content: RULED });
}

scenario('divider: ArrowDown from mid-line', async (ed) => {
  await ed.caretAfter('above');
  await ed.press('ArrowDown');
}, { content: RULED, persist: false });

scenario('divider: click selects', async (ed) => {
  await ed.root.locator('hr').click();
}, { content: RULED, persist: false });

scenario('divider: click twice', async (ed) => {
  await ed.root.locator('hr').click();
  await ed.page.waitForTimeout(600);
  await ed.root.locator('hr').click();
}, { content: RULED, persist: false });

for (const key of ['Enter', 'Backspace', 'ArrowDown', 'ArrowUp']) {
  scenario(`divider selected: ${key}`, async (ed) => {
    await ed.root.locator('hr').click();
    await ed.settle();
    await ed.press(key);
  }, { content: RULED });
}

scenario('divider at the document edges', async () => {}, {
  content: doc(hr(), p('between'), hr()),
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

// Indent limit and Enter after quote or heading.
scenario('indent: a selection where one block is at the limit', async (ed) => {
  await ed.root.getByText('shallow').click();
  await ed.selectAll();
  await ed.press('Tab');
}, { content: doc({ ...p('deep'), indent: 6 }, p('shallow')) });

scenario('quote: Enter after a centered quote', async (ed) => {
  await ed.caretAfter('centered');
  await ed.enter();
  await ed.type('after');
}, { content: doc({ ...quote('centered'), format: 'center' }) });

scenario('heading: split a centered heading', async (ed) => {
  await ed.caretAfter('cent');
  await ed.enter();
}, { content: doc({ ...heading(2, 'centered'), format: 'center' }) });

scenario('heading: Enter at a format boundary', async (ed) => {
  await ed.caretBefore(' plain');
  await ed.enter();
}, { content: doc(heading(2, text('bold', 1), ' plain')) });

// Paste over selected cells, and tables.
async function selectCells(ed: Editor) {
  await ed.clickCell(1, 1);
  const a = (await ed.cell(1, 1).boundingBox())!;
  const b = (await ed.cell(2, 2).boundingBox())!;
  await ed.page.waitForTimeout(350);
  await ed.page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await ed.page.mouse.down();
  await ed.page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 });
  await ed.page.mouse.up();
  await ed.settle();
}

const GRID = doc(p('before'), table([['A', 'B', 'C'], ['d', 'e', 'f'], ['g', 'h', 'i']]), p('after'));

scenario('cells selected: paste rich text', async (ed) => {
  await selectCells(ed);
  await ed.paste({ 'text/html': '<b>bold</b> paste', 'text/plain': 'bold paste' });
}, { content: GRID });

scenario('cells selected: paste a table', async (ed) => {
  await selectCells(ed);
  await ed.paste({
    'text/html': '<table><tr><td>1</td><td>2</td></tr></table>', 'text/plain': '1\t2',
  });
}, { content: GRID });

scenario('cells selected: paste plain text', async (ed) => {
  await selectCells(ed);
  await ed.paste({ 'text/plain': 'plain' });
}, { content: GRID });

scenario('table: select all inside a lone table', async (ed) => {
  await ed.clickCell(1, 1);
  await ed.selectAll();
  await ed.press('Backspace');
}, { content: doc(table([['a', 'b'], ['c', 'd']])) });

scenario('table: Delete on the empty line before it', async (ed) => {
  await ed.root.locator('p').first().click();
  await ed.press('Delete');
}, { content: doc(p(), table([['a', 'b']]), p()) });

scenario('table: a range from outside into it, deleted', async (ed) => {
  await ed.caretBefore('before');
  await ed.press('Shift+ArrowDown', 2);
  await ed.press('Backspace');
}, { content: GRID });

// Core editing.
scenario('merge: Backspace at a heading under an empty line', async (ed) => {
  await ed.caretBefore('title');
  await ed.press('Backspace');
}, { content: doc(p(), heading(1, 'title')) });

scenario('merge: Backspace after a line break', async (ed) => {
  await ed.caretBefore('two');
  await ed.press('Backspace');
}, { content: doc(p('one', br(), 'two')) });

scenario('merge: Delete before a line break', async (ed) => {
  await ed.caretAfter('one');
  await ed.press('Delete');
}, { content: doc(p('one', br(), 'two')) });

scenario('paste a divider at the document end', async (ed) => {
  await ed.caretAfter('last');
  await ed.paste({ 'text/html': '<hr>', 'text/plain': '---' });
  await ed.type('typed after');
}, { content: doc(p('last')) });

scenario('paste after an empty line keeps the type', async (ed) => {
  await ed.caretAfter('above');
  await ed.enter();
  await ed.paste({ 'text/html': '<h2>pasted</h2>', 'text/plain': 'pasted' });
}, { content: doc(p('above')) });

scenario('paste rich text, then type', async (ed) => {
  await ed.paste({ 'text/html': '<p>plain <b>bold</b></p>', 'text/plain': 'plain bold' });
  await ed.type(' more');
});

scenario('replace selected bold text by typing', async (ed) => {
  await ed.select('bold');
  await ed.type('new');
}, { content: doc(p('a ', text('bold', 1), ' z')) });

scenario('type at a bold boundary', async (ed) => {
  await ed.caretBefore(' z');
  await ed.type('X');
}, { content: doc(p('a ', text('bold', 1), ' z')) });

for (const value of ['हिंदी', '👨‍👩‍👧', 'é́', '🇮🇳']) {
  scenario(`delete one unit of ${value}`, async (ed) => {
    await ed.paste({ 'text/plain': `x${value}` });
    await ed.press('Backspace');
  });
}

scenario('history: paste is undone', async (ed) => {
  await ed.type('typed');
  await ed.paste({ 'text/plain': ' pasted' });
  await ed.undo();
});

scenario('history: cut is undone', async (ed) => {
  await ed.select('cut me');
  await ed.copy('cut');
  await ed.undo();
}, { content: doc(p('cut me please')) });

scenario('history: undo in code is one group', async (ed) => {
  await ed.pick('codeblock');
  await ed.pause();
  await ed.type('const a = 1');
  await ed.undo();
});

// Code navigation.
scenario('code: ArrowUp at the first line', async (ed) => {
  await ed.caretAfter('first');
  await ed.press('ArrowUp');
}, { content: doc(p('above'), code('first\nsecond', 'javascript')), persist: false });

scenario('code: ArrowDown at the last line', async (ed) => {
  await ed.caretAfter('second');
  await ed.press('ArrowDown');
}, { content: doc(code('first\nsecond', 'javascript'), p('below')), persist: false });

for (const key of ['Shift+End', 'Shift+Home', `${mod}+ArrowLeft`, `${mod}+ArrowRight`]) {
  scenario(`code: ${key}`, async (ed) => {
    await ed.caretAfter('sec');
    await ed.press(key);
  }, { content: doc(code('first\n  second', 'javascript')), persist: false });
}

scenario('code: Shift+Tab over lines', async (ed) => {
  await ed.root.locator('.editor-code').click();
  await ed.selectAll();
  await ed.press('Shift+Tab');
}, { content: doc(code('\ta\n\n\tc', 'javascript')) });

// Autolink, typed key by key.
for (const value of ['www.google.com', 'www.example.co.uk', 'https://example.com).',
  'https://example.com-', 'user@example.com,next']) {
  scenario(`autolink typing: ${value}`, async (ed) => {
    await ed.type(value);
    await ed.press('ArrowLeft', 3);
    await ed.press('Backspace');
  });
}

scenario('autolink typing: text before a link', async (ed) => {
  await ed.caretBefore('https');
  await ed.type('x');
}, { content: doc(p('https://example.com')) });

scenario('autolink typing: next to bold', async (ed) => {
  await ed.caretAfter('bold');
  await ed.press(`${mod}+b`);
  await ed.type(' https://example.com ');
}, { content: doc(p(text('bold', 1))) });
