import fs from 'node:fs';

import { expect, test } from './test';

import type { Page } from '@playwright/test';

/** A --grep pattern for this title that works as a regex and inside double quotes in a shell. */
export function grepFor(title: string): string {
  return title.replace(/[$`"!\\*+?^{}()|[\]]/g, '.');
}

/** The failure for a test with no baseline yet: what to run if the test is new or intended. */
export function noBaseline(what: string, browser: string, title: string): string {
  return `no baseline for "${what}" (${browser}). If this is new or intended, run:\n`
    + `pnpm test:e2e:update --grep "${grepFor(title)}"`;
}

/** toHaveScreenshot, failing with the update command when screenshots/<browser>/ lacks `name`. */
export async function expectScreenshot(page: Page, name: string): Promise<void> {
  const info = test.info();
  const file = info.snapshotPath(name, { kind: 'screenshot' });
  if (info.config.updateSnapshots === 'none' && !fs.existsSync(file)) {
    throw new Error(noBaseline(`screenshot ${name}`, info.project.name, info.title));
  }
  await expect(page).toHaveScreenshot(name);
}
