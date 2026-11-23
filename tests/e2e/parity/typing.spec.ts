import { doc, heading, p, text } from '../support/doc';
import { scenario } from '../support/scenario';

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
  await ed.press('Alt+Backspace');
});

scenario('typing: delete to line start', async (ed) => {
  await ed.type('keep');
  await ed.enter();
  await ed.type('remove all of this');
  await ed.press('ControlOrMeta+Backspace');
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
  await ed.press('Alt+Shift+ArrowLeft');
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

scenario('history: undo typing', async (ed) => {
  await ed.type('first');
  await ed.pause();
  await ed.type(' second');
  await ed.undo();
});

scenario('history: undo twice', async (ed) => {
  await ed.type('first');
  await ed.pause();
  await ed.type(' second');
  await ed.pause();
  await ed.type(' third');
  await ed.undo(2);
});

scenario('history: redo', async (ed) => {
  await ed.type('first');
  await ed.pause();
  await ed.type(' second');
  await ed.undo();
  await ed.redo();
});

scenario('history: undo a paragraph break', async (ed) => {
  await ed.type('line');
  await ed.pause();
  await ed.enter();
  await ed.undo();
});

scenario('history: undo deleting everything', async (ed) => {
  await ed.root.click();
  await ed.selectAll();
  await ed.press('Backspace');
  await ed.undo();
}, { content: doc(heading(1, 'Title'), p('body')) });

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
  changedBy: 'B15',
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

// Dictation, autocorrect, emoji pickers and IME commits insert text without key presses.
for (const value of ['dictated words ', '中文输入', 'हिंदी', '```', '# ', '$x$', '**bold**']) {
  scenario(`inserted text without keys: ${value}`, async (ed) => {
    for (const part of value === '中文输入' ? ['中文', '输入'] : [value]) {
      await ed.page.keyboard.insertText(part);
      await ed.settle();
    }
  }, { changedBy: value === '```' ? 'B8' : undefined });
}
