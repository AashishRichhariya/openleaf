import fs from 'node:fs';
import path from 'node:path';

import { noBaseline } from './baseline';
import { capture, Box, View } from './capture';
import { Editor } from './editor';
import { ENV } from './env';
import { expect, test } from './test';
import { tree, withoutDerivedTextFormat as derivedOut } from './tree';

/*
 * A scenario performs what a user does, then records everything observable: text, focus, caret,
 * scroll, element boxes and styles, floating UI, the document, what was saved and what a reload
 * shows. Every run must reproduce the baseline in expected/<browser>.json, which is what main does
 * today. `pnpm test:e2e:update` records it (see README).
 */

interface Options {
  content?: object | null;
  /** Also compare what was saved and what a reload shows. On unless switched off. */
  persist?: boolean;
  viewport?: { width: number; height: number };
  timeout?: number;
  /** Playwright tags, such as '@B14' for a fixed bug or '@issue-42'. */
  tag?: string | string[];
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
  const file = path.join(ROOT, 'expected', `${project}.json`);
  loaded[project] ??= fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, 'utf8'))
    : { styles: [], scenarios: {} };
  const { styles, scenarios } = loaded[project];
  const found = scenarios[name];
  if (!found) throw new Error(noBaseline(name, project, name));
  const expand = (box: any) => ({ ...box, style: styles[box.style] });
  return { ...found, boxes: found.boxes.map(expand), floating: found.floating.map(expand) };
}

function record(project: string, name: string, value: Recorded): void {
  const folder = path.join(ROOT, '.recording', project);
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, `${fileName(name)}.json`), JSON.stringify([name, value]));
}

function compareBoxes(actual: Box[], wanted: Box[], label: string): void {
  const names = (boxes: Box[]) => boxes.map((box) => box.el);
  expect.soft(names(actual), `${label}: elements`).toEqual(names(wanted));
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

function compare(actual: Recorded, wanted: Recorded): void {
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
  expect.soft(derivedOut(actual.tree), 'document').toBe(derivedOut(wanted.tree));
  expect.soft(actual.caret, 'caret').toBe(wanted.caret);
  compareBoxes(actual.boxes, wanted.boxes, 'editor');
  if (wanted.saved !== undefined || actual.saved !== undefined) {
    expect.soft(derivedOut(actual.saved), 'saved document').toBe(derivedOut(wanted.saved));
    expect.soft(derivedOut(actual.reloaded), 'reloaded document').toBe(derivedOut(wanted.reloaded));
  }
}

export function scenario(
  name: string,
  steps: (ed: Editor) => Promise<string | void>,
  { content, persist = true, viewport, timeout, tag }: Options = {},
): void {
  test(name, { tag }, async ({ ed, page, problems }, info) => {
    if (timeout) test.setTimeout(timeout);
    if (viewport) await page.setViewportSize(viewport);
    // Fails before any work when there is nothing to compare with.
    const wanted = ENV.record ? null : expected(info.project.name, name);
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
          // A known outcome need not be waited out.
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

    if (wanted) compare(actual, wanted);
    else record(info.project.name, name, actual);
  });
}
