import { br, code, doc, heading, li, link, list, p, quote, table, text } from '../support/doc';
import { scenario } from '../support/scenario';

const JS = 'const x = 1;\n// note\nfunction f(a) {\n  return "s" + a;\n}';

scenario('backticks: convert on the third', async (ed) => {
  await ed.type('```');
}, { changedBy: 'B8' });

scenario('backticks: two do not convert', async (ed) => {
  await ed.type('``');
});

scenario('backticks: the next key is code', async (ed) => {
  await ed.type('```x');
}, { changedBy: 'B8' });

scenario('backticks: typed without any delay', async (ed) => {
  await ed.type('```const a = 1', 0);
}, { changedBy: 'B8' });

scenario('backticks: then a language and a space are code', async (ed) => {
  await ed.type('```js x');
}, { changedBy: 'B8' });

scenario('backticks: leading spaces still convert', async (ed) => {
  await ed.type('  ```x');
}, { changedBy: 'B8' });

scenario('backticks: after a word stay text', async (ed) => {
  await ed.type('hello```');
});

scenario('backticks: after a word and a space stay text', async (ed) => {
  await ed.type('hello ```');
});

scenario('backticks: four', async (ed) => {
  await ed.type('````');
}, { changedBy: 'B8' });

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
}, { changedBy: 'B8' });

scenario('backticks: before existing text', async (ed) => {
  await ed.caretBefore('after');
  await ed.type('```inside');
}, { changedBy: 'B8', content: doc(p('after')) });

scenario('backticks: between two paragraphs', async (ed) => {
  await ed.caretAfter('one');
  await ed.enter();
  await ed.type('```middle');
}, { changedBy: 'B8', content: doc(p('one'), p('two')) });

scenario('backticks: after formatted text', async (ed) => {
  await ed.caretAfter('bold');
  await ed.press('ControlOrMeta+b');
  await ed.type('```x');
}, { changedBy: 'B8', content: doc(p(text('bold', 1))) });

scenario('backticks: after inline code', async (ed) => {
  await ed.type('`a` ');
  await ed.type('```x');
}, { changedBy: 'B8' });

scenario('backticks: after a link', async (ed) => {
  await ed.caretAfter('site');
  await ed.type('```x');
}, { changedBy: 'B8', content: doc(p(link('https://example.com', 'site'))) });

scenario('backticks: after an equation', async (ed) => {
  await ed.type('$x$```y');
}, { changedBy: 'B8' });

scenario('backticks: after a line break', async (ed) => {
  await ed.type('line');
  await ed.press('Shift+Enter');
  await ed.type('```x');
}, { changedBy: 'B8' });

scenario('backticks: between two line breaks', async (ed) => {
  await ed.caretAfter('one');
  await ed.press('Shift+Enter');
  await ed.type('```x');
}, { changedBy: 'B8', content: doc(p('one', br(), 'two')) });

scenario('backticks: in an aligned paragraph', async (ed) => {
  await ed.pick('align c');
  await ed.type('```x');
}, { changedBy: 'B8' });

scenario('backticks: in an indented paragraph', async (ed) => {
  await ed.caretBefore('after');
  await ed.press('Tab');
  await ed.type('```x');
}, { changedBy: 'B8', content: doc(p('after')) });

scenario('backticks: in a bullet', async (ed) => {
  await ed.type('- ');
  await ed.type('```x');
}, { changedBy: 'B8' });

scenario('backticks: in a second bullet', async (ed) => {
  await ed.caretAfter('one');
  await ed.enter();
  await ed.type('```x');
}, { changedBy: 'B8', content: doc(list('bullet', li(1, 'one'))) });

scenario('backticks: in a numbered item', async (ed) => {
  await ed.type('1. ');
  await ed.type('```x');
}, { changedBy: 'B8' });

scenario('backticks: in a check item', async (ed) => {
  await ed.type('[] ');
  await ed.type('```x');
}, { changedBy: 'B8' });

scenario('backticks: in a nested bullet', async (ed) => {
  await ed.caretAfter('one');
  await ed.enter();
  await ed.press('Tab');
  await ed.type('```x');
}, { changedBy: 'B8', content: doc(list('bullet', li(1, 'one'))) });

scenario('backticks: in a quote', async (ed) => {
  await ed.type('> ');
  await ed.type('```x');
}, { changedBy: 'B8' });

scenario('backticks: before quoted text', async (ed) => {
  await ed.caretBefore('quoted');
  await ed.type('```x');
}, { changedBy: 'B8', content: doc(quote('quoted')) });

scenario('backticks: in a heading', async (ed) => {
  await ed.type('## ');
  await ed.type('```x');
}, { changedBy: 'B8' });

scenario('backticks: before heading text', async (ed) => {
  await ed.caretBefore('head');
  await ed.type('```x');
}, { changedBy: 'B8', content: doc(heading(1, 'head')) });

scenario('backticks: in a table cell', async (ed) => {
  await ed.clickCell(1, 1);
  await ed.type('```x');
}, { changedBy: 'B8', content: doc(table([['', ''], ['', '']]), p()) });

scenario('backticks: in a header cell', async (ed) => {
  await ed.clickCell(0, 0);
  await ed.type('```x');
}, { changedBy: 'B8', content: doc(table([['', ''], ['', '']]), p()) });

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
