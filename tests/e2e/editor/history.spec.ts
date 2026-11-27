/* Undo and redo. */

import { doc, heading, p,
} from '../support/doc';
import { scenario } from '../support/scenario';


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
