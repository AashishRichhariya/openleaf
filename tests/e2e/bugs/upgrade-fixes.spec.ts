/*
 * Bugs of 0.3.0 that Lexical 0.53 fixed, which the owner chose to keep (see support/accepted.ts).
 * Each test fails on 0.3.0 in the browsers named there, and passes on 0.4.0 in all of them.
 */
import { code, doc, equation, heading, li, list, p, quote, table, text } from '../support/doc';
import { expect, test } from '../support/test';
import { plainText } from '../support/tree';

test('U1: clicking away from an equation keeps the edit, and typing goes where you clicked',
  async ({ ed }) => {
    await ed.open({ content: doc(p('before ', equation('x+1'), ' after')) });
    await ed.root.locator('.equation-wrapper').first().dblclick();
    await ed.settle();
    await ed.press('End');
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

test('U2: after pasting several blocks, typing goes at the end of what was pasted',
  async ({ ed }) => {
    await ed.open({
      content: doc(
        heading(2, 'Head'),
        p('some ', text('bold', 1), ' end'),
        list('check', li(1, 'task')),
        quote('said'),
        code('let a = 1', 'javascript'),
        table([['A', 'B'], ['1', '2']]),
        p('last'),
      ),
    });
    await ed.root.getByText('last').click();
    await ed.selectAll();
    const data = await ed.copy();
    await ed.press('Backspace');
    await ed.paste({ 'text/html': data['text/html'] });
    await ed.settle();
    await ed.type('Z');
    await ed.settle();
    const typed = plainText(await ed.state());
    expect(typed.endsWith('lastZ')).toBe(true);
    expect(typed.match(/Z/g)).toHaveLength(1);
  });

test('U3: ArrowDown from the last line of code moves typing to the line below',
  async ({ ed }) => {
    await ed.open({ content: doc(code('first\nsecond', 'javascript'), p('below')) });
    await ed.caretAfter('second');
    await ed.press('ArrowDown');
    await ed.settle();
    await ed.type('Z');
    await ed.settle();
    expect(plainText(await ed.state())).toBe('first|second|belowZ');
  });

for (const [kind, query] of [['inline', 'inline'], ['block', 'display']]) {
  test(`U4: Enter that closes a new ${kind} equation adds no line break`, async ({ ed }) => {
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
