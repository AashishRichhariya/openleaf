import { doc, equation, li, list, p, table } from '../support/doc';
import { Editor } from '../support/editor';
import { KEYS } from '../support/keys';
import { scenario } from '../support/scenario';
import { expect, test } from '../support/test';
import { plainText } from '../support/tree';

const mod = 'ControlOrMeta';

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
    await ed.press(KEYS.lineEnd);
    await ed.type('+2');
    await ed.enter();
  }, { content });

  scenario(`equation ${kind}: Escape after an edit`, async (ed) => {
    await first(ed).dblclick();
    await ed.press(KEYS.lineEnd);
    await ed.type('+9');
    await ed.press('Escape');
  }, { content });

  scenario(`equation ${kind}: clicking away saves`, async (ed) => {
    await first(ed).dblclick();
    await ed.press(KEYS.lineEnd);
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
  'Backspace': [KEYS.lineEnd, 'Backspace'],
  'Delete': [KEYS.lineStart, 'Delete'],
  'line start': [KEYS.lineEnd, KEYS.lineStart],
  'line end': [KEYS.lineStart, KEYS.lineEnd],
  'select all': [`${mod}+a`],
  'ArrowUp': [KEYS.lineEnd, 'ArrowUp'],
  'ArrowDown': [KEYS.lineStart, 'ArrowDown'],
  'ArrowLeft': [KEYS.lineEnd, 'ArrowLeft'],
  'ArrowRight at the end': [KEYS.lineEnd, 'ArrowRight'],
  'Tab': [KEYS.lineEnd, 'Tab'],
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
  await ed.press(KEYS.lineEnd);
  await ed.type('+1');
  await ed.caretAfter('before');
}, { content: doc(p('before ', equation('x^2'), ' after')) });

scenario('equation input: clicking outside the editor', async (ed) => {
  await ed.root.locator('.equation-wrapper').dblclick();
  await ed.page.mouse.click(5, 300);
}, { content: doc(p('before ', equation('x^2'), ' after')), persist: false });

// Deleting a selected equation must cancel the key, or the browser deletes a character next to it
// too. Firefox did, now and then: the handlers removed the node without preventDefault.
for (const key of ['Backspace', 'Delete']) {
  test(`${key} on a selected equation deletes only the equation`, async ({ ed, page }) => {
    await ed.open({ content: sample });
    await selectFirst(ed);
    await page.evaluate(() => document.addEventListener('keydown', (event) => {
      (window as unknown as { keyPrevented?: boolean }).keyPrevented = event.defaultPrevented;
    }));
    await page.keyboard.press(key);
    await ed.settle();
    const prevented = await page.evaluate(
      () => (window as unknown as { keyPrevented?: boolean }).keyPrevented,
    );
    expect(prevented).toBe(true);
    await expect(ed.root).toHaveText('before  after');
    expect(await ed.tree()).not.toContain('equation');
  });
}

test('clicking away from an equation keeps the edit, and typing goes where you clicked', { tag: '@U1' },
  async ({ ed }) => {
    await ed.open({ content: doc(p('before ', equation('x+1'), ' after')) });
    await ed.root.locator('.equation-wrapper').first().dblclick();
    await ed.settle();
    await ed.press(KEYS.lineEnd);
    await ed.type('+7');
    await ed.root.getByText('after').click();
    await ed.settle();
    await ed.type('Z');
    await ed.settle();
    expect(await ed.tree()).toContain('equation equation="x+1+7" inline=true');
    // The Z went into " after", wherever in it the click landed
    const [, , last] = plainText(await ed.state()).split('|');
    expect(last).toContain('Z');
    expect(last.replace('Z', '')).toBe(' after');
  });

for (const [kind, query] of [['inline', 'inline'], ['block', 'display']]) {
  test(`Enter that closes a new ${kind} equation adds no line break`, { tag: '@U4' }, async ({ ed }) => {
    await ed.open();
    await ed.pick(query);
    await ed.type('a+b');
    await ed.enter();
    await ed.type(' after');
    await ed.settle();
    const tree = await ed.tree();
    expect(tree).toContain('equation="a+b"');
    expect(tree).not.toContain('linebreak');
    expect(tree).toContain('text " after"');
  });
}
