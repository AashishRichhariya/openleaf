import fs from 'node:fs';
import path from 'node:path';

import { capture, Box, View } from './capture';
import { Editor } from './editor';
import { ENV } from './env';
import { expect, test } from './test';
import { tree } from './tree';

/*
 * A scenario performs what a user does, then records everything observable. On the untouched
 * baseline that record is saved to expected/<browser>.json (see README). Every later run must
 * reproduce it.
 */

/** A listed bug whose fix changes part of what a scenario records. The rest is still compared. */
export type ChangedBy =
  // The tree is fixed, the look is not allowed to move.
  | 'B8'
  // The table size widget is no longer saved.
  | 'B13'
  // Strikethrough, H4 and H5 gain styling.
  | 'B15';

interface Options {
  content?: object | null;
  changedBy?: ChangedBy;
  /** Also compare what was saved and what a reload shows. On unless switched off. */
  persist?: boolean;
  viewport?: { width: number; height: number };
  timeout?: number;
}

interface Recorded extends View {
  tree: string;
  saved?: string;
  reloaded?: string;
  /** Whatever else the steps chose to report, such as clipboard contents. */
  note?: string;
  problems: string[];
}

const ROOT = path.resolve(__dirname, '..');
// Styles repeat a lot, so each file lists them once and boxes refer to them by index.
const loaded: Record<string, { styles: string[]; scenarios: Record<string, any> }> = {};

function fileName(name: string): string {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  const readable = name.replace(/[^a-z0-9]+/gi, '-').slice(0, 90);
  return `${readable}-${(hash >>> 0).toString(36)}`;
}

function expected(project: string, name: string): Recorded {
  loaded[project] ??= JSON.parse(
    fs.readFileSync(path.join(ROOT, 'expected', `${project}.json`), 'utf8'),
  );
  const { styles, scenarios } = loaded[project];
  const found = scenarios[name];
  if (!found) throw new Error(`"${name}" has no recording from the baseline`);
  const expand = (box: any) => ({ ...box, style: styles[box.style] });
  return { ...found, boxes: found.boxes.map(expand), floating: found.floating.map(expand) };
}

function record(project: string, name: string, value: Recorded): void {
  const folder = path.join(ROOT, '.recording', project);
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, `${fileName(name)}.json`), JSON.stringify([name, value]));
}

// Blocks whose wrapper B8 removes are compared through what is drawn inside them.
const B8_DRAWN = /^(code|span.*"|.*katex)/;

function compareBoxes(actual: Box[], wanted: Box[], label: string): void {
  expect.soft(actual.map((box) => box.el), `${label}: elements`).toEqual(wanted.map((box) => box.el));
  if (actual.length !== wanted.length) return;
  const differences: string[] = [];
  wanted.forEach((want, index) => {
    const got = actual[index];
    if (got.style !== want.style) {
      differences.push(`${want.el}: style\n  was ${want.style}\n  now ${got.style}`);
    }
    // One pixel of slack for sub-pixel rounding.
    if (got.rect.some((value, side) => Math.abs(value - want.rect[side]) > 1)) {
      differences.push(`${want.el}: box was ${want.rect} now ${got.rect}`);
    }
  });
  expect.soft(differences.slice(0, 12), `${label}: look`).toEqual([]);
}

function compare(actual: Recorded, wanted: Recorded, changedBy?: ChangedBy): void {
  expect.soft(actual.text, 'visible text').toBe(wanted.text);
  expect.soft(actual.focus, 'focus').toBe(wanted.focus);
  expect.soft(actual.note, 'reported by the steps').toBe(wanted.note);
  expect.soft(Math.abs(actual.scroll - wanted.scroll), 'page scroll moved').toBeLessThanOrEqual(1);
  compareBoxes(actual.floating, wanted.floating, 'floating UI');
  // The first line: stack traces name the build's own chunk files.
  const firstLine = (problem: string) => problem.split('\n')[0];
  const known = wanted.problems.map(firstLine);
  const newProblems = actual.problems.filter((problem) => !known.includes(firstLine(problem)));
  expect.soft(newProblems, 'console and page errors').toEqual([]);

  if (changedBy === 'B8') {
    const drawn = (boxes: Box[]) => boxes.filter((box) => B8_DRAWN.test(box.el));
    compareBoxes(drawn(actual.boxes), drawn(wanted.boxes), 'editor');
    // Compared with itself, as the tree differs by design, wherever 0.3.0 saved what it showed.
    if (wanted.saved !== undefined && wanted.saved === wanted.tree && wanted.reloaded === wanted.tree) {
      expect.soft(actual.saved ?? actual.tree, 'saved document').toBe(actual.tree);
      expect.soft(actual.reloaded ?? actual.tree, 'reloaded document').toBe(actual.tree);
    }
    return;
  }

  expect.soft(actual.tree, 'document').toBe(wanted.tree);
  expect.soft(actual.caret, 'caret').toBe(wanted.caret);
  if (changedBy !== 'B15') compareBoxes(actual.boxes, wanted.boxes, 'editor');

  if (wanted.saved !== undefined) {
    // Where 0.3.0 lost the document (B3), not losing it is the only acceptable difference.
    const lostByBaseline = wanted.reloaded === 'paragraph' && wanted.tree !== 'paragraph';
    const orKept = (was?: string, now?: string) =>
      (lostByBaseline && now === actual.tree ? actual.tree : was);
    const withoutWidget = (value?: string) =>
      (changedBy === 'B13' ? value?.replace(/\n *inline-table-input-node/g, '') : value);
    // Without the widget there can be nothing to save.
    const saved = changedBy === 'B13' && actual.saved === '(no row)' ? 'paragraph' : actual.saved;
    expect.soft(saved, 'saved document').toBe(orKept(withoutWidget(wanted.saved), actual.saved));
    expect.soft(actual.reloaded, 'reloaded document')
      .toBe(orKept(withoutWidget(wanted.reloaded), actual.reloaded));
  }
}

export function scenario(
  name: string,
  steps: (ed: Editor) => Promise<string | void>,
  { content, changedBy, persist = true, viewport, timeout }: Options = {},
): void {
  test(`parity: ${name}`, async ({ ed, page, problems }, info) => {
    if (timeout) test.setTimeout(timeout);
    if (viewport) await page.setViewportSize(viewport);
    await ed.open(content === undefined ? {} : { content });
    const note = (await steps(ed)) || undefined;
    await ed.settle();
    // Hover and fade transitions last 100-200ms, and the page scrolls smoothly.
    await page.waitForTimeout(250);
    await page.evaluate(async () => {
      for (let calm = 0, round = 0, last = scrollY; calm < 3 && round < 40; round += 1) {
        await new Promise((done) => setTimeout(done, 40));
        calm = scrollY === last ? calm + 1 : 0;
        last = scrollY;
      }
    });

    const actual: Recorded = {
      ...(await capture(page)),
      tree: await ed.tree(),
      note,
      problems: [],
    };

    if (ENV.screens) {
      const folder = path.join(ENV.screens, info.project.name);
      fs.mkdirSync(folder, { recursive: true });
      await page.screenshot({
        path: path.join(folder, `${fileName(name)}.png`),
        animations: 'disabled',
        caret: 'hide',
      });
    }

    const wanted = ENV.record ? null : expected(info.project.name, name);
    let leftBehind: string[] = [];

    if (persist) {
      const initial = tree(content ?? null);
      if (actual.tree !== initial) {
        const deadline = Date.now() + 6000;
        let stored = '(no row)';
        while (Date.now() < deadline && stored !== actual.tree) {
          await page.waitForTimeout(250);
          const row = await ed.row();
          stored = row ? tree(row.content) : '(no row)';
          // A known baseline outcome need not be waited out.
          if (wanted && stored === wanted.saved && Date.now() > deadline - 2500) break;
        }
        actual.saved = stored;
        // A request aborted by the reload is reported by the page being left.
        leftBehind = [...problems];
        page.once('framenavigated', () => problems.splice(0));
        await ed.reload();
        actual.reloaded = await ed.tree();
      }
    }

    actual.problems = [...new Set([...leftBehind, ...problems])].sort();

    if (wanted) compare(actual, wanted, changedBy);
    else record(info.project.name, name, actual);
  });
}
