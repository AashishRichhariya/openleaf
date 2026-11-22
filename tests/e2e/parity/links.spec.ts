import { doc, link, p } from '../support/doc';
import { scenario } from '../support/scenario';

const DETECT = [
  'https://example.com', 'http://example.com', 'www.example.com', 'https://www.example.co.uk/a/b',
  'https://example.com/path?q=1&r=2', 'https://example.com/#section', 'http://127.0.0.1:3000/x',
  'https://example.com/wiki/Foo_(bar)', 'https://example.com.', 'https://example.com,',
  '(https://example.com)', 'https://user@host.example/x', 'https://example.com/a-b_c~d',
  'user@example.com', 'first.last+tag@sub.example.org', '"odd name"@example.com', 'a@b.io.',
  'a@[192.168.0.1]', 'mailto:user@example.com', 'x<user@example.com>', 'a,b@example.com',
  'example.com', 'javascript:alert(1)', 'ftp://example.com', 'tel:+15551234567',
  'sms:+15551234567', 'localhost:3000', 'name@host', 'https://', 'WWW.EXAMPLE.COM',
  'xhttps://example.com', '..a@example.com', 'a..b@example.com', 'a.b.c@d.example.com',
];

for (const value of DETECT) {
  scenario(`link typed: ${value}`, async (ed) => {
    await ed.type(`see ${value} now`);
  });

  scenario(`link typed at line start: ${value}`, async (ed) => {
    await ed.type(value);
  }, { persist: false });
}

const TARGETS = [
  'https://example.com/md', 'http://example.com', 'mailto:user@example.com', 'sms:+15551234567',
  'tel:+15551234567', 'www.example.com', '/relative', 'javascript:alert(1)', 'ftp://example.com',
];

for (const target of TARGETS) {
  scenario(`link markdown: ${target}`, async (ed) => {
    await ed.type(`go [here](${target}) ok`);
  });
}

// Pasted over a selection. Prose around a URL is B11 and is tested with the bugs.
const PASTE = [
  'https://example.com', 'http://example.com/a?b=c#d', 'www.example.com', 'user@example.com',
  'mailto:user@example.com', 'mailto:u@example.com?subject=Hello world', 'tel:+15551234567',
  'tel:+1 555 123 4567', 'sms:+15551234567', ' https://example.com ', 'https://example.com\n',
  'https://example.com/My Report.pdf', 'http://localhost:3000', 'https://例え.jp/パス',
  'ftp://example.com/file', 'javascript:alert(1)', 'plain words', 'https://', 'example.com',
  'https://example.com/a(b)', 'notes:today', 'vscode://file/x',
];

for (const value of PASTE) {
  scenario(`link paste over selection: ${JSON.stringify(value)}`, async (ed) => {
    await ed.select('target');
    await ed.paste({ 'text/plain': value });
  }, { content: doc(p('the target word')) });
}

scenario('link paste: over a selection across formats', async (ed) => {
  await ed.root.click();
  await ed.selectAll();
  await ed.paste({ 'text/plain': 'https://example.com' });
}, { content: doc(p('whole paragraph')) });

scenario('link paste: plain URL at the caret', async (ed) => {
  await ed.paste({ 'text/plain': 'https://example.com/pasted' });
});

scenario('link paste: URL in prose at the caret', async (ed) => {
  await ed.paste({ 'text/plain': 'read https://example.com/a today' });
});

scenario('link edit: breaking a typed link', async (ed) => {
  await ed.type('https://example.com');
  await ed.press('Backspace', 5);
});

scenario('link edit: extending a typed link', async (ed) => {
  await ed.type('https://example.com');
  await ed.type('/more');
});

scenario('link edit: typing after a link', async (ed) => {
  await ed.caretAfter('site');
  await ed.type('x');
}, { content: doc(p(link('https://example.com', 'site'))) });

scenario('link: saved links render', async () => {}, {
  content: doc(p('a ', link('https://example.com', 'web'), ' ', link('mailto:a@example.com', 'mail'),
    ' ', link('javascript:alert(1)', 'bad'))),
});

scenario('link: hover', async (ed) => {
  await ed.root.locator('a').hover();
}, { content: doc(p('a ', link('https://example.com', 'web'))), persist: false });

const CLICKS = {
  plain: {}, meta: { modifiers: ['ControlOrMeta'] }, middle: { button: 'middle' },
} as const;

for (const [name, options] of Object.entries(CLICKS)) {
  scenario(`link click: ${name}`, async (ed) => {
    const opened: string[] = [];
    ed.page.context().on('page', (tab) => {
      void tab.waitForLoadState().then(() => opened.push(tab.url()), () => opened.push('?'));
    });
    await ed.root.locator('a').click(options as any);
    await ed.page.waitForTimeout(1500);
    return `${[...new Set(opened)].join(', ')} | editor still here: ${ed.page.url().includes(ed.slug)}`;
  }, { content: doc(p(link('https://example.com/open', 'open me'))), persist: false });
}

scenario('link click: while selecting does not open', async (ed) => {
  let opened = 0;
  ed.page.context().on('page', () => {
    opened += 1;
  });
  await ed.select('open');
  await ed.page.waitForTimeout(500);
  return `${opened}`;
}, { content: doc(p(link('https://example.com/open', 'open me'))), persist: false });
