/*
 * Documents and clipboard contents saved by 0.3.0.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

import { asStoredByV030, getRow, newSlug, putRow } from '../support/db';
import { code, doc, equation, heading, hr, li, link, list, p, quote, table, tableWidget, text,
} from '../support/doc';
import { Editor } from '../support/editor';
import { scenario } from '../support/scenario';
import { expect, test } from '../support/test';
import { plainText, tree, withoutDerivedTextFormat as derivedOut } from '../support/tree';


const FIXTURES = path.join(__dirname, '..', 'fixtures');

const nest = (container: any, ...children: object[]) => ({ ...container, children });

const OLD = {
  'every node type, with nulls for empty strings': doc(
    heading(1, 'one'), heading(2, 'two'), heading(3, 'three'),
    p(text('b', 1), text('i', 2), text('u', 8), text('c', 16), ' ',
      link('https://example.com', 'link')),
    p(),
    quote('quote'),
    list('bullet', li(1, 'bullet')),
    list('number', li(1, 'number')),
    list('check', { ...li(1, 'checked'), checked: true }),
    hr(),
    code('let x = 1', 'javascript'),
    table([['A', ''], ['', 'd']]),
    p(equation('x^2'), ' and ', equation('')),
    p(equation('', false)),
    p(equation('\\sum_i i', false)),
  ),
  'an empty inline equation': doc(p('before ', equation(''), ' after')),
  'an empty block equation': doc(p(equation('', false)), p('after')),
  'a saved table widget': doc(p('text ', tableWidget())),
  'code without a language': doc(code('plain code')),
};

for (const [name, content] of Object.entries(OLD)) {
  scenario(`old document: ${name}`, async () => {}, { content: asStoredByV030(content) });
}

// Nesting as B8 saved it. The look must not move.
const NESTED = {
  'a paragraph': doc(nest(p(), code('old code', 'javascript'))),
  'a paragraph with text around': doc(
    nest(p(), text('before', 1), code('old', 'javascript'), text('after')),
  ),
  'a paragraph and the line after it': doc(nest(p(), code('old', 'javascript'), p('tail'))),
  'a paragraph inside a paragraph': doc(nest(p(), p('inner'))),
  'an empty paragraph inside a paragraph': doc(nest(p(), p()), p('next')),
  'lines that nest deeper': doc(
    nest(p(), code('old', 'javascript'), p('one'), nest(p(), code('two', 'javascript'), p('3'))),
  ),
  'a quote': doc(nest(quote(), code('old', 'javascript'), p('tail'))),
  'a heading': doc(nest(heading(2), code('old', 'javascript'), p('tail'))),
  'a list item': doc(list('bullet', nest(li(1), code('old', 'javascript'), p('tail')))),
  'an indented paragraph': doc({ ...nest(p(), code('old', 'javascript')), indent: 1 }),
  'a centered paragraph': doc({ ...nest(p(), code('old', 'javascript')), format: 'center' }),
};

for (const [name, content] of Object.entries(NESTED)) {
  scenario(`old nesting: code in ${name}`, async () => {}, {
    content: asStoredByV030(content),
  });
}

for (const [name, content] of Object.entries({ ...OLD, ...NESTED })) {
  test(`compat: ${name} is edited without loss`, async ({ ed }) => {
    const stored = asStoredByV030(content);
    await ed.open({ content: stored });
    const before = plainText(await ed.state());
    // Highlighting splits code into runs, so separators are not compared.
    expect(before.replace(/\|/g, '')).toBe(plainText(content).replace(/\|/g, ''));
    const anchor = /one|before|text |plain code|old|inner|after|next/.exec(before)![0].trim();
    await ed.caretAfter(anchor);
    await ed.type('Z');
    await expect
      .poll(async () => plainText((await ed.row())!.content), { timeout: 8000 })
      .toContain('Z');
    const saved = plainText((await ed.row())!.content).replace(/\|/g, '');
    expect(saved.replace('Z', '')).toBe(before.replace(/\|/g, ''));
  });
}

test('compat: a null equation can be edited', async ({ ed }) => {
  await ed.open({ content: asStoredByV030(doc(p('eq ', equation('')), p('below'))) });
  // An empty equation has no width to aim the pointer at.
  await ed.root.locator('.equation-wrapper').dispatchEvent('dblclick');
  await ed.page.locator('.equation-editor-input').focus();
  await ed.type('y');
  await ed.enter();
  await expect
    .poll(async () => tree((await getRow(ed.slug))!.content), { timeout: 8000 })
    .toContain('equation="y"');
});

// A corpus of everything 0.3.0 saved while these tests were recorded on it.
const corpusFile = path.join(FIXTURES, 'documents-v030.json.gz');

const corpus: Array<{ content: any; opened: string }> = fs.existsSync(corpusFile)
  ? JSON.parse(zlib.gunzipSync(fs.readFileSync(corpusFile)).toString('utf8'))
  : [];

// Where B8's repair changes the tree on purpose, only the content is compared.
function hasNestedBlock(node: any, parent?: string): boolean {
  const nested = (node.type === 'code' || node.type === 'paragraph')
    && parent !== undefined && !['root', 'tablecell'].includes(parent);
  return nested || (node.children ?? []).some((child: any) => hasNestedBlock(child, node.type));
}

test('compat: the corpus is present', () => {
  expect(corpus.length).toBeGreaterThan(100);
});

for (let start = 0; start < corpus.length; start += 20) {
  const batch = corpus.slice(start, start + 20);

  test(`compat corpus: ${start}-${start + batch.length - 1} open the same`, async ({ ed, problems }) => {
    test.setTimeout(180_000);
    for (const [offset, { content, opened }] of batch.entries()) {
      const slug = newSlug();
      await putRow({ slug, content });
      await ed.open({ slug });
      const now = await ed.state();
      if (hasNestedBlock(content.root)) {
        const flat = (value: any) => plainText(value).replace(/\|/g, '');
        expect.soft(flat(now), `document ${start + offset}`).toBe(flat(content));
      } else {
        expect.soft(derivedOut(tree(now)), `document ${start + offset}`).toBe(derivedOut(opened));
      }
    }
    expect(problems.filter((problem) => problem.startsWith('pageerror'))).toEqual([]);
  });

  test(`compat corpus: ${start}-${start + batch.length - 1} edit and save`, async ({ context }) => {
    test.setTimeout(420_000);
    // Several tabs at once, since each save waits two seconds.
    for (let at = 0; at < batch.length; at += 3) {
      await Promise.all(batch.slice(at, at + 3).map(async ({ content }, offset) => {
        const tab = new Editor(await context.newPage());
        await tab.open({ content });
        await tab.page.evaluate(() => {
          const editor = (document.querySelector('.editor-input') as any).__lexicalEditor;
          const state = editor.getEditorState().toJSON();
          state.root.children.push({
            children: [{
              detail: 0, format: 0, mode: 'normal', style: '', text: 'EDITED', type: 'text',
              version: 1,
            }],
            direction: 'ltr', format: '', indent: 0, type: 'paragraph', version: 1,
          });
          editor.setEditorState(editor.parseEditorState(state));
        });
        await expect
          .poll(async () => plainText((await tab.row())?.content), { timeout: 30_000 })
          .toContain('EDITED');
        const saved = plainText((await tab.row())!.content).replace(/\|/g, '');
        expect.soft(saved, `document ${start + at + offset}`)
          .toBe(`${plainText(content).replace(/\|/g, '')}EDITED`);
        await tab.page.close();
      }));
    }
  });
}

test('compat: clipboard contents copied from 0.3.0 paste the same', async ({ ed }) => {
  const { data, pasted, pastedFromHtml } = JSON.parse(
    fs.readFileSync(path.join(FIXTURES, 'clipboard-v030.json'), 'utf8'),
  );
  await ed.open();
  await ed.paste(data);
  expect.soft(derivedOut(await ed.tree()), 'Lexical payload')
    .toBe(derivedOut(pasted[test.info().project.name]));
  await ed.selectAll();
  await ed.press('Backspace');
  await ed.paste({ 'text/html': data['text/html'] });
  expect.soft(derivedOut(await ed.tree()), 'HTML')
    .toBe(derivedOut(pastedFromHtml[test.info().project.name]));
});
