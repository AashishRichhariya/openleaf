import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { getRow, newSlug, putRow } from '../support/db';
import { doc, p } from '../support/doc';
import { ENV } from '../support/env';
import { captureSave, legacySave, send } from '../support/requests';
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

test('B1: a forged readOnly cannot lock a new document', async ({ ed, page }) => {
  await ed.open();
  const save = await captureSave(page, 'lock-marker', () => ed.type('lock-marker'));
  await ed.saved();
  const victim = newSlug();
  await send(page, forge({ ...save, url: save.url.replace(ed.slug, victim) },
    (body) => body.replaceAll(ed.slug, victim)));
  await page.waitForTimeout(800);
  expect((await getRow(victim))?.read_only ?? false).toBe(false);
});

test('B1: a forged readOnly cannot lock an existing document', async ({ ed, page }) => {
  await ed.open({ content: doc(p('existing text')) });
  await ed.caretAfter('existing text');
  const save = await captureSave(page, 'lock-marker', () => ed.type(' lock-marker'));
  await ed.saved();
  await send(page, forge(save));
  await page.waitForTimeout(800);
  expect((await ed.row())!.read_only).toBe(false);
});

test('B1: the request format of old tabs cannot lock either', async ({ ed, page }) => {
  await ed.open({ content: doc(p('existing text')) });
  const origin = new URL(page.url()).origin;
  for (const id of [UNKNOWN_ACTION, ...actionIds()]) {
    for (const isNew of [true, false]) {
      await send(page, legacySave(origin, id, [ed.slug, doc(p('existing text')), true, isNew]));
    }
  }
  expect((await ed.row())!.read_only).toBe(false);
});

for (const locked of [false, true]) {
  const kind = locked ? 'a locked' : 'an existing';

  test(`B2: a forged isNewDocument cannot overwrite ${kind} document`, async ({ ed, page }) => {
    const victim = newSlug();
    await putRow({ slug: victim, content: doc(p('precious')), read_only: locked });
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

test('B2: no exposed server action can overwrite a locked document', async ({ ed, page }) => {
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
