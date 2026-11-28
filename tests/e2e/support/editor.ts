import { expect, Locator, Page } from '@playwright/test';

import { getRow, newSlug, putRow, Row } from './db';
import { tree } from './tree';

/** The notice under the editor, shown when a save is refused or edits conflict. */
export const notice = (page: Page) => page.locator('.editor-notice');

interface OpenOptions {
  /** Seeds the row before the page is opened. */
  content?: object | null;
  row?: Partial<Row>;
  slug?: string;
}

/** Drives the editor as a user does, and reads back what it holds. */
export class Editor {
  slug = '';
  readonly root: Locator;
  readonly menu: Locator;

  constructor(readonly page: Page) {
    this.root = page.locator('.editor-input');
    this.menu = page.locator('.component-picker-menu');
  }

  async open({ content, row, slug = newSlug() }: OpenOptions = {}): Promise<void> {
    this.slug = slug;
    if (content !== undefined || row) {
      await putRow({ slug: slug.toLowerCase(), content, ...row });
    }
    await this.page.goto(`/${slug}`);
    await this.ready();
  }

  async ready(): Promise<void> {
    await this.page.waitForFunction(() => {
      const root: any = document.querySelector('.editor-input');
      return root?.__lexicalEditor && root.__lexicalEditor._rootElement === root;
    }, undefined, { timeout: 30_000 });
    await this.page.evaluate(() => document.fonts.ready.then(() => undefined));
    // Since 0.4.0, code highlighting loads right after the page, as the owner agreed to for speed.
    // A document with code is ready once it is highlighted, as 0.3.0 had it from the start.
    await this.page.waitForFunction(() => !document.querySelector('.editor-input code')
      || !!(globalThis as { Prism?: unknown }).Prism, undefined, { timeout: 30_000 });
    await this.settle();
  }

  async reload(): Promise<void> {
    await this.page.reload();
    await this.ready();
  }

  /** Waits until the document has stopped changing and the page has stopped scrolling. */
  async settle(): Promise<void> {
    await this.page.evaluate(async () => {
      const root: any = document.querySelector('.editor-input');
      const frame = () => new Promise((done) => requestAnimationFrame(() => setTimeout(done, 25)));
      for (let calm = 0, round = 0; calm < 3 && round < 80; round += 1) {
        const before = root?.__lexicalEditor?.getEditorState();
        const scroll = scrollY;
        await frame();
        const still = before === root?.__lexicalEditor?.getEditorState() && scroll === scrollY;
        calm = still ? calm + 1 : 0;
      }
    });
  }

  async type(value: string, delay = 12): Promise<void> {
    await this.page.keyboard.type(value, { delay });
    await this.settle();
  }

  async press(key: string, times = 1): Promise<void> {
    for (let i = 0; i < times; i += 1) {
      await this.page.keyboard.press(key);
      // Like a person: let each key land before the next.
      await this.page.waitForTimeout(40);
    }
    await this.settle();
  }

  enter(times = 1): Promise<void> {
    return this.press('Enter', times);
  }

  undo(times = 1): Promise<void> {
    return this.press('ControlOrMeta+z', times);
  }

  redo(times = 1): Promise<void> {
    return this.press('ControlOrMeta+Shift+z', times);
  }

  async selectAll(): Promise<void> {
    await this.press('ControlOrMeta+a');
  }

  /** History merges edits made within a second, so this makes the next edit its own undo step. */
  async pause(): Promise<void> {
    await this.page.waitForTimeout(1150);
  }

  /**
   * A double click with a person's timing: two presses at one spot, 250 ms apart (well within a
   * system's double-click interval). Playwright's dblclick presses twice within a millisecond, so
   * what the second press met depended on how fast the page had reacted to the first.
   */
  async doubleClick(target: Locator): Promise<void> {
    const box = (await target.boundingBox())!;
    const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
    await this.page.mouse.click(x, y);
    await this.page.waitForTimeout(250);
    await this.page.mouse.click(x, y, { clickCount: 2 });
  }

  /** Puts the caret at an offset of the n-th text run containing `value`, or selects it. */
  async select(value: string, options: { collapse?: 'start' | 'end'; nth?: number } = {}) {
    await this.page.evaluate(
      ({ value, collapse, nth }) => {
        const root = document.querySelector<HTMLElement>('.editor-input')!;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let found = 0;
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const at = node.textContent!.indexOf(value);
          if (at < 0 || found++ < nth) continue;
          const start = collapse === 'end' ? at + value.length : at;
          const end = collapse === 'start' ? at : at + value.length;
          root.focus({ preventScroll: true });
          const range = document.createRange();
          range.setStart(node, start);
          range.setEnd(node, end);
          getSelection()!.removeAllRanges();
          getSelection()!.addRange(range);
          node.parentElement!.scrollIntoView({ block: 'nearest', behavior: 'instant' });
          return;
        }
        throw new Error(`"${value}" is not in the document`);
      },
      { value, collapse: options.collapse, nth: options.nth ?? 0 },
    );
    await this.page.waitForTimeout(80);
    await this.settle();
  }

  caretAfter(value: string, nth = 0): Promise<void> {
    return this.select(value, { collapse: 'end', nth });
  }

  caretBefore(value: string, nth = 0): Promise<void> {
    return this.select(value, { collapse: 'start', nth });
  }

  /** A paste event carrying exactly these clipboard types. The system clipboard is untouched. */
  async paste(data: Record<string, string>): Promise<void> {
    await this.page.evaluate((data) => {
      const transfer = new DataTransfer();
      for (const [type, value] of Object.entries(data)) transfer.setData(type, value);
      const event = new ClipboardEvent('paste', { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'clipboardData', { value: transfer });
      const focused = document.getSelection()?.anchorNode;
      const target = focused instanceof Element ? focused : focused?.parentElement;
      const root = document.querySelector('.editor-input')!;
      (target && root.contains(target) ? target : root).dispatchEvent(event);
    }, data);
    await this.settle();
  }

  /** What a copy or cut would put on the clipboard. */
  async copy(kind: 'copy' | 'cut' = 'copy'): Promise<Record<string, string>> {
    const data = await this.page.evaluate(async (kind) => {
      const transfer = new DataTransfer();
      const event = new ClipboardEvent(kind, { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'clipboardData', { value: transfer });
      const focused = document.getSelection()?.anchorNode;
      const target = focused instanceof Element ? focused : focused?.parentElement;
      const root = document.querySelector('.editor-input')!;
      (target && root.contains(target) ? target : root).dispatchEvent(event);
      await new Promise((done) => setTimeout(done, 80));
      return Object.fromEntries(transfer.types.map((type) => [type, transfer.getData(type)]));
    }, kind);
    await this.settle();
    return data;
  }

  async slash(query: string): Promise<void> {
    await this.type(`/${query}`);
    await expect(this.menu).toBeVisible();
  }

  /** Runs the first option matching `query`. */
  async pick(query: string): Promise<void> {
    // The menu closes on a space, so "align c" means /align and one step down, to Align center.
    const [word, below] = query.split(' ');
    await this.slash(word);
    if (below) await this.press('ArrowDown');
    await this.enter();
  }

  option(title: string): Locator {
    return this.menu.getByRole('option').filter({
      has: this.page.locator('.text', { hasText: new RegExp(`^${title}$`) }),
    });
  }

  cell(row: number, column: number, tableIndex = 0): Locator {
    return this.root.locator('table').nth(tableIndex)
      .locator('tr').nth(row)
      .locator('th, td').nth(column);
  }

  async clickCell(row: number, column: number): Promise<void> {
    const target = this.cell(row, column);
    await target.scrollIntoViewIfNeeded();
    const box = (await target.boundingBox())!;
    // The left part of the cell: the menu button covers the top right corner.
    await target.click({ position: { x: Math.min(12, box.width / 3), y: box.height / 2 } });
    await this.settle();
  }

  async cellMenu(item: string): Promise<void> {
    await this.page.locator('.table-cell-action-button').click();
    await this.page.locator('.table-action-menu-item', { hasText: item }).click();
    await this.settle();
  }

  state(): Promise<any> {
    return this.page.evaluate(() =>
      JSON.parse(JSON.stringify(
        (document.querySelector('.editor-input') as any).__lexicalEditor.getEditorState().toJSON(),
      )));
  }

  async tree(): Promise<string> {
    return tree(await this.state());
  }

  /** Top-level block types, the quickest way to see a document's structure. */
  async blocks(): Promise<string[]> {
    return (await this.state()).root.children.map((block: any) =>
      (block.type === 'heading' ? block.tag : block.type));
  }

  row(): Promise<Row | null> {
    return getRow(this.slug.toLowerCase());
  }

  /** Waits until the stored row holds what is on screen. */
  async saved(timeout = 8000): Promise<void> {
    await expect
      .poll(async () => {
        const row = await this.row();
        return row ? tree(row.content) : '(no row)';
      }, { timeout })
      .toBe(await this.tree());
  }
}
