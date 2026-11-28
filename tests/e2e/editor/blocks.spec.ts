/* Dividers, quotes and headings, and blocks inserted between others. */

import { doc, heading, hr, p, quote, text } from '../support/doc';
import { scenario } from '../support/scenario';

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
