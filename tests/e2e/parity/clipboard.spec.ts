import { code, doc, equation, heading, li, list, p, quote, table, text } from '../support/doc';
import { scenario } from '../support/scenario';

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
