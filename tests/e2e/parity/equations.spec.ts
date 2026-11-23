import { doc, equation, li, list, p, table } from '../support/doc';
import { scenario } from '../support/scenario';

import type { Editor } from '../support/editor';

// Everything here is math today and must stay math (B10 only rejects prices in prose).
const CONVERT = [
  '$x$', '$5x+3$', '$2^n$', '$ x $', '$ equation=inline $', '$5$', '$5 + x$', '$5 + x $',
  '$5 \\times 3 $', '$\\frac{1}{2}$', '$a_i$', '$1,000$', '$\\alpha + \\beta$', '$E=mc^2$',
  '$α + β$', '$x*y*z$', '$5 apples$', '$10 + 2$', '$5, 6, 7$', '$ 5 and $', '$3 = 3 $',
  '$$x^2$$', '$$ equation=block $$', '$$\\sum_{i=1}^n i$$', '$$5 and 6$$', '$bad {$',
];

for (const source of CONVERT) {
  scenario(`equation: ${source} converts`, async (ed) => {
    await ed.type(source);
  });

  scenario(`equation: ${source} after words`, async (ed) => {
    await ed.type(`we get ${source} then`);
  }, { persist: false });
}

for (const source of ['$', '$$', '$$$', '$$$$', '$5', 'US$ 5', 'a $ b', '$x$$']) {
  scenario(`equation: ${source} as typed`, async (ed) => {
    await ed.type(source);
  });
}

scenario('equation: two in a line', async (ed) => {
  await ed.type('$a$ and $b$ done');
});

scenario('equation: closed in the middle of text', async (ed) => {
  await ed.caretAfter('$y');
  await ed.type('$');
}, { content: doc(p('let $y be real')) });

scenario('equation: undo gives the dollars back', async (ed) => {
  await ed.type('$x$');
  await ed.undo();
});

for (const [kind, query] of [['inline', 'inline'], ['block', 'display']]) {
  scenario(`equation ${kind}: slash opens the editor`, async (ed) => {
    await ed.pick(query);
  }, { persist: false });

  scenario(`equation ${kind}: created with Enter`, async (ed) => {
    await ed.pick(query);
    await ed.type('a+b');
    await ed.enter();
    await ed.type(' after');
  });

  scenario(`equation ${kind}: created with Escape`, async (ed) => {
    await ed.pick(query);
    await ed.type('a+b');
    await ed.press('Escape');
  });

  scenario(`equation ${kind}: left empty`, async (ed) => {
    await ed.pick(query);
    await ed.enter();
  });

  scenario(`equation ${kind}: created, then clicking away`, async (ed) => {
    await ed.caretAfter('below');
    await ed.enter();
    await ed.pick(query);
    await ed.type('c^2');
    await ed.root.getByText('below').click();
  }, { content: doc(p('below')) });

  scenario(`equation ${kind}: arrows move inside the input`, async (ed) => {
    await ed.pick(query);
    await ed.type('ac');
    await ed.press('ArrowLeft');
    await ed.type('b');
    await ed.enter();
  });
}

const sample = doc(p('before ', equation('x+1'), ' after'));
const block = doc(p(equation('x^2', false)), p('after'));
const first = (ed: Editor) => ed.root.locator('.equation-wrapper').first();

async function selectFirst(ed: Editor) {
  await first(ed).click();
  await ed.settle();
}

for (const [kind, content] of [['inline', sample], ['block', block]] as const) {
  scenario(`equation ${kind}: click selects`, selectFirst, { content, persist: false });

  scenario(`equation ${kind}: second click edits`, async (ed) => {
    await selectFirst(ed);
    await ed.page.waitForTimeout(500);
    await first(ed).click();
  }, { content, persist: false });

  scenario(`equation ${kind}: double click edits`, async (ed) => {
    await first(ed).dblclick();
  }, { content, persist: false });

  scenario(`equation ${kind}: Enter edits, Enter saves`, async (ed) => {
    await selectFirst(ed);
    await ed.enter();
    await ed.press('End');
    await ed.type('+2');
    await ed.enter();
  }, { content });

  scenario(`equation ${kind}: Escape after an edit`, async (ed) => {
    await first(ed).dblclick();
    await ed.press('End');
    await ed.type('+9');
    await ed.press('Escape');
  }, { content });

  scenario(`equation ${kind}: clicking away saves`, async (ed) => {
    await first(ed).dblclick();
    await ed.press('End');
    await ed.type('+7');
    await ed.root.getByText('after').click();
  }, { content });

  scenario(`equation ${kind}: Backspace deletes`, async (ed) => {
    await selectFirst(ed);
    await ed.press('Backspace');
  }, { content });

  scenario(`equation ${kind}: Delete deletes`, async (ed) => {
    await selectFirst(ed);
    await ed.press('Delete');
  }, { content });

  scenario(`equation ${kind}: button deletes`, async (ed) => {
    await selectFirst(ed);
    await ed.page.getByRole('button', { name: 'Delete equation' }).click();
  }, { content });

  scenario(`equation ${kind}: undo a delete`, async (ed) => {
    await selectFirst(ed);
    await ed.press('Backspace');
    await ed.undo();
  }, { content });

  scenario(`equation ${kind}: typing next to it`, async (ed) => {
    await ed.caretBefore('after');
    await ed.type('well ');
  }, { content });
}

scenario('equation: arrows across', async (ed) => {
  await ed.caretAfter('before ');
  await ed.press('ArrowRight', 2);
  await ed.type('Z');
}, { content: sample });

scenario('equation: Backspace from the text after it', async (ed) => {
  await ed.caretBefore(' after');
  await ed.press('Backspace');
}, { content: sample });

const pair = doc(p(equation('a'), ' and ', equation('b')));

scenario('equation: shift+click selects two', async (ed) => {
  await selectFirst(ed);
  await ed.root.locator('.equation-wrapper').nth(1).click({ modifiers: ['Shift'] });
}, { content: pair, persist: false });

scenario('equation: Enter ignores two selected', async (ed) => {
  await selectFirst(ed);
  await ed.root.locator('.equation-wrapper').nth(1).click({ modifiers: ['Shift'] });
  await ed.enter();
}, { content: pair, persist: false });

scenario('equation: editing one closes the other', async (ed) => {
  await first(ed).dblclick();
  await ed.settle();
  await ed.root.locator('.equation-wrapper').nth(1).dblclick();
}, { content: pair, persist: false });

scenario('equation: rendering of common constructs', async () => {}, {
  content: doc(
    p(equation('\\frac{a+b}{c}'), ' ', equation('\\sqrt{x^2+y^2}'), ' ', equation('\\alpha\\beta')),
    p(equation('\\int_0^\\infty e^{-x}\\,dx = 1', false)),
    p(equation('\\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}', false)),
    p(equation('\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}', false)),
    p(equation('\\text{words} \\mathbb{R} \\mathcal{L} \\vec{v} \\hat{x}')),
  ),
});

scenario('equation: invalid renders as an error', async () => {}, {
  content: doc(p(equation('\\frac{1}{')), p(equation('\\notacommand', false))),
});

scenario('equation: saved empty renders', async () => {}, {
  content: doc(p('a ', equation('')), p(equation('', false))),
});

scenario('equation: inside a list', async (ed) => {
  await ed.caretAfter('item');
  await ed.type(' $x_1$ ');
}, { content: doc(list('bullet', li(1, 'item'))) });

scenario('equation: inside a cell', async (ed) => {
  await ed.clickCell(1, 1);
  await ed.type('$y$');
}, { content: doc(table([['', ''], ['', '']]), p()) });
