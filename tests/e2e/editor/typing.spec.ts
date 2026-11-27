/* Typing, deleting, selecting, text direction and text inserted without keys. */

import {
  br, doc, heading, li, list, p, table, text,
} from '../support/doc';
import { KEYS } from '../support/keys';
import { scenario } from '../support/scenario';


const mod = 'ControlOrMeta';

scenario('typing: empty document shows placeholder and takes focus', async () => {});

scenario('typing: one line', async (ed) => {
  await ed.type('Hello, world.');
});

scenario('typing: several paragraphs', async (ed) => {
  await ed.type('First');
  await ed.enter();
  await ed.type('Second');
  await ed.enter(2);
  await ed.type('Fourth');
});

scenario('typing: line break with Shift+Enter', async (ed) => {
  await ed.type('one');
  await ed.press('Shift+Enter');
  await ed.type('two');
});

scenario('typing: unicode', async (ed) => {
  await ed.type('café αβγ हिंदी 中文 🎉 ok');
});

scenario('typing: repeated and trailing spaces', async (ed) => {
  await ed.type('a  b   c  ');
});

scenario('typing: fast, with no delay between keys', async (ed) => {
  await ed.type('The quick brown fox jumps over the lazy dog, twice over.', 0);
});

scenario('typing: Backspace', async (ed) => {
  await ed.type('abcdef');
  await ed.press('Backspace', 2);
});

scenario('typing: Delete', async (ed) => {
  await ed.type('abcdef');
  await ed.press('ArrowLeft', 3);
  await ed.press('Delete');
});

scenario('typing: emoji is deleted whole', async (ed) => {
  await ed.type('ok 🎉');
  await ed.press('Backspace');
});

scenario('typing: delete a word', async (ed) => {
  await ed.type('alpha beta gamma');
  await ed.press(KEYS.deleteWordBackward);
});

scenario('typing: delete to line start', async (ed) => {
  await ed.type('keep');
  await ed.enter();
  await ed.type('remove all of this');
  for (const key of KEYS.deleteLineBackward) await ed.press(key);
});

scenario('typing: Enter splits a paragraph', async (ed) => {
  await ed.caretAfter('Hello');
  await ed.enter();
}, { content: doc(p('Hello world')) });

scenario('typing: Enter at paragraph start', async (ed) => {
  await ed.caretBefore('Hello');
  await ed.enter();
}, { content: doc(p('Hello')) });

scenario('typing: Backspace joins paragraphs', async (ed) => {
  await ed.caretBefore('two');
  await ed.press('Backspace');
}, { content: doc(p('one'), p('two')) });

scenario('typing: Delete joins paragraphs', async (ed) => {
  await ed.caretAfter('one');
  await ed.press('Delete');
}, { content: doc(p('one'), p('two')) });

scenario('typing: insert in the middle', async (ed) => {
  await ed.caretAfter('Hello');
  await ed.type(' big');
}, { content: doc(p('Hello world')) });

scenario('selection: replace by typing', async (ed) => {
  await ed.select('world');
  await ed.type('there');
}, { content: doc(p('Hello world again')) });

scenario('selection: select all and delete', async (ed) => {
  await ed.root.click();
  await ed.selectAll();
  await ed.press('Backspace');
}, { content: doc(heading(1, 'Title'), p('body'), p('more')) });

scenario('selection: select all and replace', async (ed) => {
  await ed.root.click();
  await ed.selectAll();
  await ed.type('new');
}, { content: doc(heading(2, 'Title'), p('body')) });

scenario('selection: extend with Shift+arrows', async (ed) => {
  await ed.caretAfter('abcdef');
  await ed.press('Shift+ArrowLeft', 3);
}, { content: doc(p('abcdef')) });

scenario('selection: extend by word', async (ed) => {
  await ed.caretAfter('one two three');
  await ed.press(KEYS.selectWordBackward);
}, { content: doc(p('one two three')) });

scenario('selection: across paragraphs, then Backspace', async (ed) => {
  await ed.caretAfter('first');
  await ed.press('Shift+ArrowDown');
  await ed.press('Backspace');
}, { content: doc(p('first'), p('second')) });

scenario('selection: double click selects a word', async (ed) => {
  await ed.root.getByText('solo').dblclick();
}, { content: doc(p('solo')) });

scenario('selection: triple click selects a paragraph', async (ed) => {
  await ed.root.getByText('one two three').click({ clickCount: 3 });
}, { content: doc(p('one two three'), p('next')) });

scenario('selection: click below the last line', async (ed) => {
  const box = (await ed.root.boundingBox())!;
  await ed.page.mouse.click(box.x + 60, box.y + Math.min(box.height - 10, 300));
  await ed.type('+');
}, { content: doc(p('only line')) });

// Dictation, autocorrect, emoji pickers and IME commits insert text without key presses.
for (const value of ['dictated words ', '中文输入', 'हिंदी', '```', '# ', '$x$', '**bold**']) {
  scenario(`inserted text without keys: ${value}`, async (ed) => {
    for (const part of value === '中文输入' ? ['中文', '输入'] : [value]) {
      await ed.page.keyboard.insertText(part);
      await ed.settle();
    }
  });
}

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
