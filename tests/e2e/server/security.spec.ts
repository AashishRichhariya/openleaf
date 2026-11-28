/* Forged requests cannot lock or overwrite documents (B1, B2). */
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { getRow, newSlug, putRow } from '../support/db';
import { doc, p } from '../support/doc';
import { ENV } from '../support/env';
import { captureSave, legacySave, postSave, send } from '../support/requests';
import { expect, test } from '../support/test';
import { plainText } from '../support/tree';

import type { CapturedSave } from '../support/requests';

const UNKNOWN_ACTION = randomBytes(21).toString('hex');

/** The same request, claiming whatever an attacker would like to claim. */
function forge(request: CapturedSave, change: (body: string) => string = (body) => body) {
  const body = JSON.parse(change(request.body));
  const forged = Array.isArray(body)
    ? [body[0], body[1], true, true]
    : { ...body, readOnly: true, read_only: true, isNewDocument: true };
  return { ...request, body: JSON.stringify(forged) };
}

/** Every server action in the build under test. */
function actionIds(): string[] {
  const file = path.join(ENV.appDir, '.next/server/server-reference-manifest.json');
  return Object.keys(JSON.parse(fs.readFileSync(file, 'utf8')).node ?? {});
}

test('a forged readOnly cannot lock a new document', { tag: '@B1' }, async ({ ed, page }) => {
  await ed.open();
  const save = await captureSave(page, 'lock-marker', () => ed.type('lock-marker'));
  await ed.saved();
  const victim = newSlug();
  await send(page, forge({ ...save, url: save.url.replace(ed.slug, victim) },
    (body) => body.replaceAll(ed.slug, victim)));
  await page.waitForTimeout(800);
  expect((await getRow(victim))?.read_only ?? false).toBe(false);
});

test('a forged readOnly cannot lock an existing document', { tag: '@B1' }, async ({ ed, page }) => {
  await ed.open({ content: doc(p('existing text')) });
  await ed.caretAfter('existing text');
  const save = await captureSave(page, 'lock-marker', () => ed.type(' lock-marker'));
  await ed.saved();
  await send(page, forge(save));
  await page.waitForTimeout(800);
  expect((await ed.row())!.read_only).toBe(false);
});

test('the request format of old tabs cannot lock a document either', { tag: '@B1' }, async ({ ed, page }) => {
  await ed.open({ content: doc(p('existing text')) });
  const origin = new URL(page.url()).origin;
  for (const id of [UNKNOWN_ACTION, ...actionIds()]) {
    for (const isNew of [true, false]) {
      await send(page, legacySave(origin, id, [ed.slug, doc(p('existing text')), true, isNew]));
    }
  }
  expect((await ed.row())!.read_only).toBe(false);
});

// 0.3.0 let anyone store any value as read_only, and its page shows every truthy one as locked
for (const locked of [false, true, 'true', 1]) {
  const kind = locked === false ? 'an existing'
    : locked === true ? 'a locked' : `a locked (read_only ${JSON.stringify(locked)})`;

  test(`a forged isNewDocument cannot overwrite ${kind} document`, { tag: '@B2' }, async ({ ed, page }) => {
    const victim = newSlug();
    await putRow({ slug: victim, content: doc(p('precious')), read_only: locked as boolean });
    await ed.open();
    // A real "create" request, then pointed at somebody else's document.
    const create = await captureSave(page, 'overwrite-marker', () => ed.type('overwrite-marker'));
    await ed.saved();
    await send(page, forge({ ...create, url: create.url.replace(ed.slug, victim) },
      (body) => body.replaceAll(ed.slug, victim)));
    await page.waitForTimeout(800);
    const row = (await getRow(victim))!;
    expect(plainText(row.content)).toContain('precious');
    expect(plainText(row.content)).not.toContain('overwrite-marker');
    expect(row.read_only).toBe(locked);
  });
}

test('no exposed server action can overwrite a locked document', { tag: '@B2' }, async ({ ed, page }) => {
  await ed.open({ content: doc(p('precious')), row: { read_only: true } });
  const before = await ed.row();
  const stamp = new Date().toISOString();
  const evil = doc(p('overwritten'));
  const record = {
    slug: ed.slug,
    content: evil,
    read_only: false,
    version: 1,
    created_at: stamp,
    updated_at: stamp,
  };
  const argumentLists = [
    [record],
    [ed.slug, { content: evil, read_only: false }, 1],
    [ed.slug, evil, false, true],
    [ed.slug, evil, false, false],
  ];
  const origin = new URL(page.url()).origin;
  for (const id of [UNKNOWN_ACTION, ...actionIds()]) {
    for (const args of argumentLists) await send(page, legacySave(origin, id, args, ed.slug));
  }
  expect(await ed.row()).toEqual(before);
});

// Changes (0.5.0) are held to the same rules -------------------------------------------------------

test('changes cannot lock a document, or change a locked one', { tag: '@B1' }, async ({ page }) => {
  await page.goto('/robots.txt');
  const open = newSlug();
  const locked = newSlug();
  await putRow({ slug: open, content: doc(p('one'), p('two')) });
  await putRow({ slug: locked, content: doc(p('one'), p('two')), read_only: true });
  for (const slug of [open, locked]) {
    const before = (await getRow(slug))!;
    const { result } = await postSave(page, {
      slug, tab: 't', seq: 1, revision: before.updated_at, readOnly: true, read_only: true,
      changes: {
        count: 2,
        root: { type: 'root', read_only: true },
        ranges: [{ start: 1, deleteCount: 1, blocks: [p('changed')] }],
      },
    });
    const after = (await getRow(slug))!;
    expect(after.read_only).toBe(before.read_only);
    if (before.read_only) {
      expect(result).toEqual({ status: 'read-only' });
      expect(after).toEqual(before);
    } else {
      expect(result.status).toBe('saved');
      expect(plainText(after.content)).toBe('one|changed');
    }
  }
});

test('changes cannot make the root anything but a root', async ({ page }) => {
  await page.goto('/robots.txt');
  const slug = newSlug();
  await putRow({ slug, content: doc(p('one'), p('two')) });
  const before = (await getRow(slug))!;
  const { result } = await postSave(page, {
    slug, tab: 't', seq: 1, revision: before.updated_at,
    changes: { count: 2, root: { type: 'paragraph' }, ranges: [{ start: 0, deleteCount: 1, blocks: [p('x')] }] },
  });
  expect(result.status).toBe('saved');
  expect((await getRow(slug))!.content.root.type).toBe('root');
  const response = await page.goto(`/${slug}`);
  expect(response!.status()).toBe(200);
  await expect(page.locator('.editor-input')).toContainText('x');
});
