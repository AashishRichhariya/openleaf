import { doc, li, list, p, table } from '../support/doc';
import { scenario } from '../support/scenario';

const TRIGGERS = [
  '- ', '* ', '+ ', '1. ', '3. ', '1) ', '[] ', '[ ] ', '[x] ', '[X] ', '- [ ] ', '- [x] ',
];

for (const trigger of TRIGGERS) {
  scenario(`list: "${trigger}" starts a list`, async (ed) => {
    await ed.type(`${trigger}item`);
  });

  scenario(`list: "${trigger}" before existing text`, async (ed) => {
    await ed.caretBefore('existing');
    await ed.type(trigger);
  }, { content: doc(p('existing')) });
}

const KINDS = [['bullet', '- '], ['number', '1. '], ['check', '[] ']] as const;

for (const [kind, trigger] of KINDS) {
  scenario(`list ${kind}: Enter adds items`, async (ed) => {
    await ed.type(`${trigger}one`);
    await ed.enter();
    await ed.type('two');
    await ed.enter();
    await ed.type('three');
  });

  scenario(`list ${kind}: Enter twice leaves`, async (ed) => {
    await ed.type(`${trigger}one`);
    await ed.enter(2);
    await ed.type('outside');
  });

  scenario(`list ${kind}: Backspace on an empty item`, async (ed) => {
    await ed.type(`${trigger}one`);
    await ed.enter();
    await ed.press('Backspace');
  });

  scenario(`list ${kind}: Backspace at item start`, async (ed) => {
    await ed.caretBefore('two');
    await ed.press('Backspace');
  }, { content: doc(list(kind, li(1, 'one'), li(2, 'two'))) });

  scenario(`list ${kind}: Backspace at list start`, async (ed) => {
    await ed.caretBefore('one');
    await ed.press('Backspace');
  }, { content: doc(list(kind, li(1, 'one'), li(2, 'two'))) });

  scenario(`list ${kind}: Tab nests`, async (ed) => {
    await ed.type(`${trigger}one`);
    await ed.enter();
    await ed.press('Tab');
    await ed.type('child');
  });

  scenario(`list ${kind}: five levels deep`, async (ed) => {
    await ed.type(`${trigger}level 1`);
    for (const level of [2, 3, 4, 5]) {
      await ed.enter();
      await ed.press('Tab');
      await ed.type(`level ${level}`);
    }
  });

  scenario(`list ${kind}: nesting limit`, async (ed) => {
    await ed.type(`${trigger}one`);
    await ed.enter();
    await ed.press('Tab', 10);
    await ed.type('deep');
  });

  scenario(`list ${kind}: Shift+Tab un-nests`, async (ed) => {
    await ed.type(`${trigger}one`);
    await ed.enter();
    await ed.press('Tab');
    await ed.type('child');
    await ed.press('Shift+Tab');
  });

  scenario(`list ${kind}: Enter leaves nesting a level at a time`, async (ed) => {
    await ed.type(`${trigger}one`);
    await ed.enter();
    await ed.press('Tab');
    await ed.type('child');
    await ed.enter(2);
  });

  scenario(`list ${kind}: Enter splits an item`, async (ed) => {
    await ed.caretAfter('first');
    await ed.enter();
  }, { content: doc(list(kind, li(1, 'first half'), li(2, 'next'))) });

  scenario(`list ${kind}: Shift+Enter stays in the item`, async (ed) => {
    await ed.type(`${trigger}one`);
    await ed.press('Shift+Enter');
    await ed.type('same item');
  });

  scenario(`list ${kind}: inside a table cell`, async (ed) => {
    await ed.clickCell(1, 1);
    await ed.type(`${trigger}in cell`);
  }, { content: doc(table([['', ''], ['', '']]), p()) });

  scenario(`list ${kind}: formatting inside`, async (ed) => {
    await ed.type(`${trigger}a **bold** item`);
  });
}

scenario('list number: merges with the list above', async (ed) => {
  await ed.caretBefore('next');
  await ed.type('1. ');
}, { content: doc(list('number', li(1, 'a'), li(2, 'b')), p('next')) });

scenario('list number: renumbers after a removal', async (ed) => {
  await ed.select('b');
  await ed.press('Backspace', 2);
}, { content: doc(list('number', li(1, 'a'), li(2, 'b'), li(3, 'c'))) });

scenario('list bullet: merges with the list above', async (ed) => {
  await ed.caretBefore('next');
  await ed.type('- ');
}, { content: doc(list('bullet', li(1, 'a')), p('next')) });

scenario('list bullet: rule trigger inside stays text', async (ed) => {
  await ed.type('- ');
  await ed.type('--- ');
});

scenario('list check: click the box', async (ed) => {
  await ed.root.locator('li').first().click({ position: { x: 7, y: 10 } });
}, { content: doc(list('check', li(1, 'todo'), li(2, 'other'))) });

scenario('list check: click the box twice', async (ed) => {
  const box = ed.root.locator('li').first();
  await box.click({ position: { x: 7, y: 10 } });
  await ed.page.waitForTimeout(600);
  await box.click({ position: { x: 7, y: 10 } });
}, { content: doc(list('check', li(1, 'todo'))) });

scenario('list check: click the text does not toggle', async (ed) => {
  await ed.root.getByText('todo').click();
}, { content: doc(list('check', li(1, 'todo'))) });

scenario('list check: just outside the box', async (ed) => {
  await ed.root.locator('li').first().click({ position: { x: 20, y: 10 } });
}, { content: doc(list('check', li(1, 'todo'))) });

scenario('list check: ArrowLeft focuses the box, Space toggles', async (ed) => {
  await ed.caretBefore('todo');
  await ed.press('ArrowLeft');
  await ed.press('Space');
}, { content: doc(list('check', li(1, 'todo'))) });

scenario('list check: Escape leaves the box', async (ed) => {
  await ed.caretBefore('todo');
  await ed.press('ArrowLeft');
  await ed.press('Escape');
}, { content: doc(list('check', li(1, 'todo'))) });

scenario('list check: new item after a checked one', async (ed) => {
  await ed.type('[x] done');
  await ed.enter();
  await ed.type('open');
});
