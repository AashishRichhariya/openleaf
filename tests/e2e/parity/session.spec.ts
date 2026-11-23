/* Whole-page looks at the widths people use, and the editor in longer sessions. */
import {
  code, doc, equation, heading, hr, li, link, list, p, quote, table, text,
} from '../support/doc';
import { scenario } from '../support/scenario';

const EVERYTHING = doc(
  heading(1, 'Heading one'),
  heading(2, 'Heading two'),
  heading(3, 'Heading three'),
  p('Text with ', text('bold', 1), ', ', text('italic', 2), ', ', text('code', 16), ', ',
    link('https://example.com', 'a link'), ' and ', equation('x^2')),
  quote('A quote'),
  list('bullet', li(1, 'bullet')),
  list('number', li(1, 'number')),
  list('check', li(1, 'check')),
  hr(),
  code('const a = 1;', 'javascript'),
  table([['Head', 'Two'], ['a', 'b']]),
  p(equation('\\sum_i i', false)),
);

for (const width of [320, 390, 639, 640, 768, 1024, 1280, 1920]) {
  scenario(`page at ${width}px: everything`, async () => {}, {
    content: EVERYTHING,
    viewport: { width, height: 900 },
    persist: false,
  });

  scenario(`page at ${width}px: empty`, async () => {}, {
    viewport: { width, height: 700 },
    persist: false,
  });

  scenario(`page at ${width}px: slash menu`, async (ed) => {
    await ed.type('/');
  }, { viewport: { width, height: 700 }, persist: false });
}

scenario('session: a page written from scratch', async (ed) => {
  await ed.type('# Notes');
  await ed.enter();
  await ed.type('Some **bold** and $x^2$ here');
  await ed.enter();
  await ed.type('- one');
  await ed.enter();
  await ed.type('two');
  await ed.enter(2);
  await ed.type('> quoted');
  await ed.enter();
  await ed.pick('codeblock');
  await ed.type('let a = 1');
  await ed.enter(3);
  await ed.pick('2x2');
  await ed.type('cell');
}, { timeout: 120_000 });
