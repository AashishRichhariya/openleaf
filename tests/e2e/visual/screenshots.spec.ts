/* Screenshots compared pixel by pixel with screenshots/<browser>/, what main shows today. */

import { expectScreenshot } from '../support/baseline';
import { code, doc, equation, heading, hr, li, link, list, p, quote, table, text,
} from '../support/doc';
import { Editor } from '../support/editor';
import { test } from '../support/test';


const CONTENT: Record<string, object> = {
  text: doc(
    heading(1, 'Heading one'),
    heading(2, 'Heading two'),
    heading(3, 'Heading three'),
    p('Plain ', text('bold', 1), ' ', text('italic', 2), ' ', text('underline', 8), ' ',
      text('code', 16), ' ', link('https://example.com', 'link')),
    quote('A quote'),
    hr(),
  ),
  lists: doc(
    list('bullet', li(1, 'bullet one'), li(2, 'bullet two')),
    list('number', li(1, 'number one'), li(2, 'number two')),
    list('check', li(1, 'open'), { ...li(2, 'done'), checked: true }),
  ),
  code: doc(code('// comment\nfunction f(a) {\n  return "s" + a * 2;\n}', 'javascript')),
  table: doc(table([['Name', 'Value', 'Note'], ['a', '1', 'first'], ['b', '2', 'second']]), p()),
  math: doc(
    p('Inline ', equation('E=mc^2'), ' text'),
    p(equation('\\int_0^1 \\frac{x^2}{2}\\,dx', false)),
    p(equation('\\frac{1}{', true)),
  ),
};

for (const [name, content] of Object.entries(CONTENT)) {
  for (const width of [1280, 390]) {
    test(`visual: ${name} at ${width}px`, async ({ ed, page }) => {
      await page.setViewportSize({ width, height: 640 });
      await ed.open({ content });
      await page.waitForTimeout(300);
      await expectScreenshot(page, `${name}-${width}.png`);
    });
  }
}

const OPENED: Record<string, [object | undefined, (ed: Editor) => Promise<void>]> = {
  'empty': [undefined, async () => {}],
  'slash-menu': [undefined, async (ed) => ed.slash('')],
  'table-widget': [undefined, async (ed) => ed.pick('table')],
  'table-menu': [CONTENT.table, async (ed) => {
    await ed.clickCell(1, 1);
    await ed.page.locator('.table-cell-action-button').click();
  }],
  'table-hover': [CONTENT.table, async (ed) => {
    await ed.cell(2, 1).hover();
    await ed.page.waitForTimeout(400);
  }],
  'equation-selected': [CONTENT.math, async (ed) => {
    await ed.root.locator('.equation-wrapper').first().click();
  }],
  'equation-editing': [CONTENT.math, async (ed) => {
    await ed.root.locator('.equation-wrapper').first().dblclick();
  }],
};

for (const [name, [content, open]] of Object.entries(OPENED)) {
  test(`visual: ${name}`, async ({ ed, page }) => {
    await page.setViewportSize({ width: 1280, height: 640 });
    await ed.open(content ? { content } : {});
    await open(ed);
    await ed.settle();
    await page.waitForTimeout(350);
    await expectScreenshot(page, `${name}.png`);
  });
}
