
import { code, doc, equation, heading, li, list, p, quote, table, text,
} from '../support/doc';
import { Editor } from '../support/editor';
import { scenario } from '../support/scenario';
import { expect, test } from '../support/test';
import { plainText } from '../support/tree';


const has = async (ed: Editor, type: string) =>
  new RegExp(`(^|\\n) *${type}( |\\n|$)`).test(await ed.tree());

const HTML: Record<string, string> = {
  'inline formats': '<p>a <b>bold</b> <i>it</i> <u>under</u> <code>code</code> <sup>2</sup></p>',
  'headings': '<h1>One</h1><h2>Two</h2><h3>Three</h3><p>body</p>',
  'bullets': '<ul><li>one</li><li>two<ul><li>inner</li></ul></li></ul>',
  'numbers': '<ol start="3"><li>three</li><li>four</li></ol>',
  'checklist': '<ul><li role="checkbox" aria-checked="true">done</li></ul>',
  'github checklist': '<ul class="contains-task-list"><li class="task-list-item">'
    + '<input type="checkbox" checked disabled> done</li></ul>',
  'quote': '<blockquote>wise words</blockquote>',
  'link': '<p>go <a href="https://example.com">there</a></p>',
  'javascript link': '<p><a href="javascript:alert(1)">click</a></p>',
  'table': '<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>',
  'styled table': '<table><colgroup><col width="80"><col width="120"></colgroup><tr>'
    + '<td style="background-color:#ff0">x</td><td colspan="1">y</td></tr></table>',
  'merged table': '<table><tr><td colspan="2">wide</td></tr><tr><td>a</td><td>b</td></tr></table>',
  'preformatted': '<pre>line 1\nline 2</pre>',
  'code block': '<pre><code class="language-python">x = 1</code></pre>',
  'rule': '<p>a</p><hr><p>b</p>',
  'line breaks': '<p>one<br>two</p><p><br></p><p>three</p>',
  'styled spans': '<p><span style="font-weight:700;color:red">red bold</span> '
    + '<span style="font-style:italic">slanted</span></p>',
  'alignment': '<p style="text-align:center">middle</p><p style="text-align:right">end</p>',
  'google docs': '<meta charset="utf-8"><b style="font-weight:normal;" id="docs-internal-guid-1">'
    + '<p dir="ltr"><span style="font-weight:700">Title</span></p><p dir="ltr">'
    + '<span style="font-weight:400">text</span></p></b>',
  'old inline equation': `<span data-lexical-equation="${btoa('x^2')}" data-lexical-inline="true"`
    + ' data-lexical-start-edit="false">x2</span>',
  'old block equation': `<div data-lexical-equation="${btoa('a+b')}" data-lexical-inline="false"`
    + ' data-lexical-start-edit="false">a+b</div>',
  'scripts are dropped': '<p>safe</p><script>window.pwned = 1</script><img src=x onerror="1">',
  'indent': '<p style="padding-inline-start: 80px">indented</p>',
};

for (const [name, html] of Object.entries(HTML)) {
  scenario(`paste HTML: ${name}`, async (ed) => {
    await ed.paste({ 'text/html': html, 'text/plain': 'plain fallback' });
  });

  scenario(`paste HTML into text: ${name}`, async (ed) => {
    await ed.caretAfter('left ');
    await ed.paste({ 'text/html': html, 'text/plain': 'plain fallback' });
  }, { content: doc(p('left right')), persist: false });
}

const PLAIN: Record<string, string> = {
  'one line': 'just words',
  'several lines': 'one\ntwo\nthree',
  'blank lines': 'one\n\n\ntwo\n',
  'windows line ends': 'one\r\ntwo',
  'tabs': 'a\tb\tc',
  'markdown stays literal': '# not a heading\n- not a list\n**not bold**',
  'backticks stay literal': '```',
};

for (const [name, value] of Object.entries(PLAIN)) {
  scenario(`paste plain: ${name}`, async (ed) => {
    await ed.paste({ 'text/plain': value });
  });
}

const RICH = doc(
  heading(2, 'Head'),
  p('some ', text('bold', 1), ' ', equation('x+1'), ' end'),
  list('check', li(1, 'task')),
  quote('said'),
  code('let a = 1', 'javascript'),
  table([['A', 'B'], ['1', '2']]),
  p('last'),
);

scenario('copy: plain text and Lexical payload', async (ed) => {
  await ed.root.getByText('last').click();
  await ed.selectAll();
  const data = await ed.copy();
  return data['text/plain'];
}, { content: RICH, persist: false });

scenario('copy, then paste in the same document', async (ed) => {
  await ed.root.getByText('last').click();
  await ed.selectAll();
  const data = await ed.copy();
  await ed.caretAfter('last');
  await ed.enter();
  await ed.paste(data);
}, { content: RICH });

scenario('copy, then paste as HTML only', async (ed) => {
  await ed.root.getByText('last').click();
  await ed.selectAll();
  const data = await ed.copy();
  await ed.press('Backspace');
  await ed.paste({ 'text/html': data['text/html'] });
}, { content: RICH });

scenario('cut removes and can be pasted', async (ed) => {
  await ed.select('move me');
  const data = await ed.copy('cut');
  await ed.caretAfter('end');
  await ed.paste(data);
}, { content: doc(p('move me'), p('end')) });

scenario('paste into a table cell', async (ed) => {
  await ed.clickCell(1, 1);
  await ed.paste({ 'text/plain': 'one\ntwo' });
}, { content: doc(table([['', ''], ['', '']]), p()) });

scenario('paste a table into a table', async (ed) => {
  await ed.clickCell(1, 1);
  await ed.paste({ 'text/html': HTML.table, 'text/plain': 'A B' });
}, { content: doc(table([['', ''], ['', '']]), p()) });

scenario('paste a divider at the document end', async (ed) => {
  await ed.caretAfter('last');
  await ed.paste({ 'text/html': '<hr>', 'text/plain': '---' });
  await ed.type('typed after');
}, { content: doc(p('last')) });

scenario('paste after an empty line keeps the type', async (ed) => {
  await ed.caretAfter('above');
  await ed.enter();
  await ed.paste({ 'text/html': '<h2>pasted</h2>', 'text/plain': 'pasted' });
}, { content: doc(p('above')) });

scenario('paste rich text, then type', async (ed) => {
  await ed.paste({ 'text/html': '<p>plain <b>bold</b></p>', 'text/plain': 'plain bold' });
  await ed.type(' more');
});

test('after pasting several blocks, typing goes at the end of what was pasted', { tag: '@U2' },
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

// Equations with non-Latin characters copy and paste (B9) -----------------------------------------

for (const value of ['α+β', 'गणित', '∑ 🎉', '\\text{中文}', 'café — ok']) {
  test(`an equation with ${value} can be copied and pasted`, { tag: '@B9' }, async ({ ed, problems }) => {
    await ed.open({ content: doc(p('start ', equation(value), ' end')) });
    await ed.root.getByText('start').click();
    await ed.selectAll();
    const data = await ed.copy();
    expect(data['text/html']).toBeTruthy();
    expect(data['text/plain']).toContain(value);
    await ed.press('Backspace');
    await ed.paste({ 'text/html': data['text/html'] });
    expect(await ed.tree()).toContain(`equation=${JSON.stringify(value)}`);
    expect(problems).toEqual([]);
  });
}

for (const value of ['x^2 + 1', 'café', '5 \\times 3']) {
  test(`equation HTML copied from 0.3.0 still pastes (${value})`, { tag: '@B9' }, async ({ ed }) => {
    await ed.open();
    await ed.paste({
      'text/html': `<span data-lexical-equation="${btoa(value)}" data-lexical-inline="true"`
        + ' data-lexical-start-edit="false">x</span>',
    });
    expect(await ed.tree()).toContain(`equation=${JSON.stringify(value)}`);
  });

  test(`copied equations keep the HTML that 0.3.0 pastes (${value})`, { tag: '@B9' }, async ({ ed }) => {
    await ed.open({ content: doc(p('start ', equation(value), ' end')) });
    await ed.root.getByText('start').click();
    await ed.selectAll();
    const html = (await ed.copy())['text/html'];
    expect(html).toContain(`data-lexical-equation="${btoa(value)}"`);
  });
}

// Prose with a URL pasted over a selection makes no link (B11) ------------------------------------

const PROSE = [
  'read https://example.com today', 'see www.example.com for more',
  'write to user@example.com please', 'https://example.com is great',
  'intro\nhttps://example.com', 'https://example.com\nhttps://example.org',
  '(https://example.com)', 'note: see https://example.com/a',
];

for (const value of PROSE) {
  test(`pasting ${JSON.stringify(value)} over a selection makes no link`, { tag: '@B11' }, async ({ ed }) => {
    await ed.open({ content: doc(p('the target word')) });
    await ed.select('target');
    await ed.paste({ 'text/plain': value });
    expect(await has(ed, 'link')).toBe(false);
    const flat = plainText(await ed.state()).replace(/\|/g, '');
    expect(flat).toBe(`the ${value} word`.replace(/\n/g, ''));
  });
}
